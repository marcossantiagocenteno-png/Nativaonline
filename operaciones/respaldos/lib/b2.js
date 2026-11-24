/* Nativa Online — respaldos: cliente mínimo de la API nativa de Backblaze B2 (v4), sin dependencias (fetch de Node ≥ 20).
   Endpoints y encabezados tomados de la documentación oficial (backblaze.com/apidocs: b2_authorize_account, b2_get_upload_url,
   b2_upload_file, b2_list_file_names, b2_get_file_info, b2_download_file_by_name, b2_delete_file_version, b2_list_buckets).
   ESTADO: probado contra un B2 simulado (pruebas/ayudas/b2-falso.js), NO contra el B2 real: no hay cuenta. El primer paso al
   contratar es correr operaciones/respaldos/verificar-b2.js, que comprueba cada cosa contra el servicio de verdad.
   La clave de subida sólo necesita writeFiles: este cliente de subida no lista, no lee y no borra. */
'use strict';
const crypto=require('crypto');
const espera=ms=>new Promise(r=>setTimeout(r,ms));

class ErrorB2 extends Error{
  constructor(estado,codigo,msg){ super('B2 '+estado+' '+codigo+': '+msg); this.estado=estado; this.codigo=codigo; }
}
const codificar=n=>encodeURIComponent(n).replace(/%2F/g,'/');
async function leer(r){
  let j=null; const t=await r.text(); try{ j=JSON.parse(t); }catch(e){}
  if(!r.ok) throw new ErrorB2(r.status,(j&&j.code)||'sin_codigo',(j&&j.message)||t.slice(0,200));
  return j;
}

class B2{
  constructor({id,clave,api}){
    this.id=id; this.clave=clave; this.tok=null;
    this.api=(api||process.env.NATIVA_B2_API||'https://api.backblazeb2.com').replace(/\/$/,'');
  }
  async autorizar(){
    const r=await fetch(this.api+'/b2api/v4/b2_authorize_account',{headers:{Authorization:'Basic '+Buffer.from(this.id+':'+this.clave).toString('base64')}});
    const j=await leer(r), s=j.apiInfo.storageApi;
    this.tok=j.authorizationToken; this.apiUrl=s.apiUrl; this.descarga=s.downloadUrl; this.permitido=s.allowed; this.cuenta=j.accountId;
    return j;
  }
  cuboId(nombre){
    const b=(this.permitido.buckets||[]).find(x=>x.name===nombre);
    if(!b) throw new Error('la clave de B2 no da acceso al bucket «'+nombre+'» (o B2 no devolvió su nombre)');
    return b.id;
  }
  async llamar(ruta,op){
    op=op||{};
    for(let i=0;i<2;i++){
      if(!this.tok) await this.autorizar();
      const q=op.query?'?'+new URLSearchParams(op.query):'';
      const r=await fetch(this.apiUrl+'/b2api/v4/'+ruta+q,{method:op.metodo||'GET',headers:Object.assign({Authorization:this.tok},op.cuerpo?{'Content-Type':'application/json'}:{}),body:op.cuerpo?JSON.stringify(op.cuerpo):undefined});
      try{ return await leer(r); }
      catch(e){ if(i===0&&e instanceof ErrorB2&&e.estado===401&&/expired_auth_token|bad_auth_token/.test(e.codigo)){ this.tok=null; continue; } throw e; }
    }
  }
  /* Sube un buffer. Reintenta con un URL de subida nuevo en 401 (token) / 503 / 408 / errores de red, como pide la documentación. */
  async subir(cubo,nombre,buf,tipo){
    if(!this.tok) await this.autorizar();
    const id=this.cuboId(cubo), sha1=crypto.createHash('sha1').update(buf).digest('hex'); let ultimo;
    for(let intento=1;intento<=5;intento++){
      try{
        const u=await this.llamar('b2_get_upload_url',{query:{bucketId:id}});
        const r=await fetch(u.uploadUrl,{method:'POST',headers:{Authorization:u.authorizationToken,'X-Bz-File-Name':codificar(nombre),'Content-Type':tipo||'application/octet-stream','X-Bz-Content-Sha1':sha1},body:buf});
        const j=await leer(r);
        if(j.contentSha1!==sha1) throw new Error('B2 guardó el archivo con otra suma SHA-1');
        return {id:j.fileId,nombre:j.fileName,sha1,subido:j.uploadTimestamp};
      }catch(e){
        ultimo=e;
        const reintentable=!(e instanceof ErrorB2)||e.estado===503||e.estado===408||(e.estado===401&&/expired_auth_token|bad_auth_token/.test(e.codigo));
        if(!reintentable) throw e;
        await espera(Math.min(30000,500*2**intento));
      }
    }
    throw ultimo;
  }
  async listar(cubo,prefijo){
    if(!this.tok) await this.autorizar();
    const id=this.cuboId(cubo), out=[]; let sig=null;
    do{
      const q={bucketId:id,prefix:prefijo||'',maxFileCount:'1000'}; if(sig) q.startFileName=sig;
      const j=await this.llamar('b2_list_file_names',{query:q});
      for(const f of j.files) if(f.action==='upload') out.push({nombre:f.fileName,id:f.fileId,subido:f.uploadTimestamp,tamano:f.contentLength,sha1:f.contentSha1,retencion:f.fileRetention||null});
      sig=j.nextFileName;
    }while(sig);
    return out;
  }
  async descargar(cubo,nombre){
    if(!this.tok) await this.autorizar();
    const r=await fetch(this.descarga+'/file/'+cubo+'/'+codificar(nombre),{headers:{Authorization:this.tok}});
    if(!r.ok){ let j=null; try{ j=await r.json(); }catch(e){} throw new ErrorB2(r.status,(j&&j.code)||'sin_codigo',(j&&j.message)||'descarga fallida'); }
    const buf=Buffer.from(await r.arrayBuffer());
    const sha1=r.headers.get('x-bz-content-sha1');
    if(sha1&&!/^none$|^unverified/.test(sha1)&&crypto.createHash('sha1').update(buf).digest('hex')!==sha1) throw new Error('la descarga no coincide con su suma SHA-1');
    return buf;
  }
  info(fileId){ return this.llamar('b2_get_file_info',{query:{fileId}}); }
  borrar(nombre,fileId){ return this.llamar('b2_delete_file_version',{metodo:'POST',cuerpo:{fileName:nombre,fileId}}); }
  async cubos(){ if(!this.tok) await this.autorizar(); return this.llamar('b2_list_buckets',{metodo:'POST',cuerpo:{accountId:this.cuenta}}); }
}
module.exports={B2,ErrorB2,codificar};

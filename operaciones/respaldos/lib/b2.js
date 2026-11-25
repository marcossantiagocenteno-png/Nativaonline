/* Nativa Online — respaldos: cliente mínimo de la API nativa de Backblaze B2 (v4), sin dependencias (fetch de Node ≥ 20).
   Endpoints y encabezados tomados de la documentación oficial (backblaze.com/apidocs: b2_authorize_account, b2_get_upload_url,
   b2_upload_file, b2_list_file_names, b2_get_file_info, b2_download_file_by_name, b2_delete_file_version, b2_list_buckets).
   ESTADO: probado contra un B2 simulado (pruebas/ayudas/b2-falso.js), NO contra el B2 real: no hay cuenta. El primer paso al
   contratar es correr operaciones/respaldos/verificar-b2.js, que comprueba cada cosa contra el servicio de verdad.
   La clave de subida sólo necesita writeFiles: este cliente de subida no lista, no lee y no borra. */
'use strict';
const crypto=require('crypto'), fs=require('fs'), path=require('path'), http=require('http'), https=require('https');
const espera=ms=>new Promise(r=>setTimeout(r,ms));

class ErrorB2 extends Error{
  constructor(estado,codigo,msg){ super('B2 '+estado+' '+codigo+': '+msg); this.estado=estado; this.codigo=codigo; }
}
function sha1Archivo(ruta){ return new Promise((ok,mal)=>{ const h=crypto.createHash('sha1'); fs.createReadStream(ruta,{highWaterMark:1<<20}).on('data',d=>h.update(d)).on('error',mal).on('end',()=>ok(h.digest('hex'))); }); }
/* Envía un archivo por POST con http/https de Node y pipe: el archivo avanza al ritmo del socket (contrapresión real). El fetch de Node
   acumula en memoria el cuerpo en flujo (medido: 150 MiB subidos → 220 MB de RAM con fetch, 89 con esto). Devuelve algo con la forma
   mínima de una Response (ok, status, text()) para pasar por leer() igual que antes. Si el socket pasa INACTIVO_MS sin actividad, falla
   con un error de red (reintentable), como el tiempo de espera de fetch. */
const INACTIVO_MS=300000;
function postArchivo(url,encabezados,ruta){
  return new Promise((ok,mal)=>{
    const u=new URL(url), mod=u.protocol==='https:'?https:http, lectura=fs.createReadStream(ruta,{highWaterMark:256*1024});
    const rq=mod.request({hostname:u.hostname,port:u.port||undefined,path:u.pathname+u.search,method:'POST',headers:encabezados},res=>{
      const trozos=[]; res.on('data',d=>trozos.push(d)); res.on('error',mal);
      res.on('end',()=>{ const t=Buffer.concat(trozos).toString('utf8'); ok({ok:res.statusCode>=200&&res.statusCode<300,status:res.statusCode,text:async()=>t}); });
    });
    const fallar=e=>{ lectura.destroy(); mal(e); };
    rq.on('error',fallar); lectura.on('error',e=>{ rq.destroy(); mal(e); });
    rq.setTimeout(INACTIVO_MS,()=>{ const e=new Error('B2: la subida no avanza ('+INACTIVO_MS/1000+' s sin actividad)'); rq.destroy(e); fallar(e); });
    lectura.pipe(rq);
  });
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
    const sha1=crypto.createHash('sha1').update(buf).digest('hex');
    return this._subirCon(cubo,nombre,sha1,tipo,()=>buf,undefined);
  }
  /* Sube un ARCHIVO sin cargarlo entero en memoria: la suma SHA-1 se calcula leyéndolo por bloques y el cuerpo de cada intento es una
     lectura nueva del archivo, enviada con http/https y pipe (ver postArchivo) (con Content-Length, que B2 exige). Mismas reglas de reintento y mismas comprobaciones que subir(). Si el
     archivo cambiara entre la suma y el envío, B2 lo rechaza por suma distinta (400) y no se reintenta: nunca queda algo guardado mal. */
  async subirArchivo(cubo,nombre,ruta,tipo){
    const tamano=fs.statSync(ruta).size, sha1=await sha1Archivo(ruta);
    return this._subirCon(cubo,nombre,sha1,tipo,()=>ruta,tamano);
  }
  async _subirCon(cubo,nombre,sha1,tipo,cuerpoNuevo,tamano){
    if(!this.tok) await this.autorizar();
    const id=this.cuboId(cubo); let ultimo;
    for(let intento=1;intento<=5;intento++){
      try{
        const u=await this.llamar('b2_get_upload_url',{query:{bucketId:id}});
        const enc={Authorization:u.authorizationToken,'X-Bz-File-Name':codificar(nombre),'Content-Type':tipo||'application/octet-stream','X-Bz-Content-Sha1':sha1};
        let r;
        if(tamano!==undefined){ enc['Content-Length']=String(tamano); r=await postArchivo(u.uploadUrl,enc,cuerpoNuevo()); }
        else r=await fetch(u.uploadUrl,{method:'POST',headers:enc,body:cuerpoNuevo()});
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
  /* Descarga a un ARCHIVO sin cargarla entera en memoria: va escribiendo a un temporal, calcula el SHA-1 al vuelo y sólo al terminar y
     comprobarlo lo pone en su sitio. Si no coincide, borra el temporal y falla con el mismo mensaje que descargar(). */
  async descargarA(cubo,nombre,ruta){
    if(!this.tok) await this.autorizar();
    const r=await fetch(this.descarga+'/file/'+cubo+'/'+codificar(nombre),{headers:{Authorization:this.tok}});
    if(!r.ok){ let j=null; try{ j=await r.json(); }catch(e){} throw new ErrorB2(r.status,(j&&j.code)||'sin_codigo',(j&&j.message)||'descarga fallida'); }
    const sha1=r.headers.get('x-bz-content-sha1'), tmp=ruta+'.tmp-'+process.pid, h=crypto.createHash('sha1'); let fo=null;
    try{
      fs.mkdirSync(path.dirname(ruta),{recursive:true}); fo=fs.openSync(tmp,'w');
      if(r.body) for await(const trozo of r.body){ h.update(trozo); let w=0; while(w<trozo.length) w+=fs.writeSync(fo,trozo,w,trozo.length-w); }
      fs.fsyncSync(fo); fs.closeSync(fo); fo=null;
      if(sha1&&!/^none$|^unverified/.test(sha1)&&h.digest('hex')!==sha1) throw new Error('la descarga no coincide con su suma SHA-1');
      fs.renameSync(tmp,ruta);
    }catch(e){ if(fo!==null){ try{ fs.closeSync(fo); }catch(x){} } try{ fs.rmSync(tmp,{force:true}); }catch(x){} throw e; }
  }
  info(fileId){ return this.llamar('b2_get_file_info',{query:{fileId}}); }
  borrar(nombre,fileId){ return this.llamar('b2_delete_file_version',{metodo:'POST',cuerpo:{fileName:nombre,fileId}}); }
  async cubos(){ if(!this.tok) await this.autorizar(); return this.llamar('b2_list_buckets',{metodo:'POST',cuerpo:{accountId:this.cuenta}}); }
}
module.exports={B2,ErrorB2,codificar,sha1Archivo};

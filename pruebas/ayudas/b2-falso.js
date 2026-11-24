/* B2 simulado para pruebas: implementa SÓLO lo que usa operaciones/respaldos (autorizar, subir, listar, leer, info, borrar, buckets) con las reglas
   de permisos y de Object Lock Compliance descritas en la documentación oficial. No prueba B2 real: prueba nuestro cliente y nuestras expectativas. */
'use strict';
const http=require('http'), crypto=require('crypto');
function crear({claves,cubos,fallosSubida}){
  const archivos=[], tokens=new Map(); let n=0, intentosSubida=0; const lg={peticiones:0};
  const js=(res,c,o)=>{ res.writeHead(c,{'Content-Type':'application/json'}); res.end(JSON.stringify(o)); };
  const err=(res,c,code,msg)=>js(res,c,{status:c,code,message:msg});
  const srv=http.createServer((req,res)=>{
    lg.peticiones++; const u=new URL(req.url,'http://x'), cuerpo=[];
    req.on('data',d=>cuerpo.push(d)); req.on('end',()=>{
      const buf=Buffer.concat(cuerpo), base='http://127.0.0.1:'+srv.address().port;
      if(u.pathname==='/b2api/v4/b2_authorize_account'){
        const [id,k]=Buffer.from((req.headers.authorization||'').replace('Basic ',''),'base64').toString().split(':'), c=claves[id];
        if(!c||c.clave!==k) return err(res,401,'bad_auth_token','credenciales inválidas');
        const t='tok-'+(++n); tokens.set(t,c);
        return js(res,200,{accountId:'cuenta1',authorizationToken:t,apiInfo:{storageApi:{apiUrl:base,downloadUrl:base,allowed:{capabilities:c.cap,buckets:c.cubos?c.cubos.map(nm=>({id:'id-'+nm,name:nm})):null,namePrefix:null}}}});
      }
      const c=tokens.get(req.headers.authorization), tiene=x=>c&&c.cap.includes(x);
      if(u.pathname.startsWith('/upload/')){
        const t=req.headers.authorization, bid=u.pathname.split('/')[2]; const cc=tokens.get(t);
        intentosSubida++; if(fallosSubida&&fallosSubida(intentosSubida)) return err(res,503,'service_unavailable','ocupado');
        if(!cc||!cc.cap.includes('writeFiles')) return err(res,401,'unauthorized','sin writeFiles');
        const nombre=decodeURIComponent(req.headers['x-bz-file-name']), sha=crypto.createHash('sha1').update(buf).digest('hex');
        if(req.headers['x-bz-content-sha1']!==sha) return err(res,400,'bad_request','sha1 no coincide');
        const cuboNom=bid.replace('id-',''), cfg=cubos[cuboNom]||{}, ahora=Date.now();
        const f={fileId:'f'+(++n),fileName:nombre,bucket:cuboNom,data:buf,sha1:sha,uploadTimestamp:ahora,retencion:cfg.retencionDias?{mode:'compliance',retainUntilTimestamp:ahora+cfg.retencionDias*864e5}:null};
        archivos.push(f); return js(res,200,{fileId:f.fileId,fileName:nombre,contentSha1:sha,uploadTimestamp:ahora,contentLength:buf.length});
      }
      if(u.pathname.startsWith('/file/')){
        if(!tiene('readFiles')) return err(res,401,'unauthorized','sin readFiles');
        const [,,cubo,...r]=u.pathname.split('/'), nombre=decodeURIComponent(r.join('/')), f=archivos.filter(x=>x.bucket===cubo&&x.fileName===nombre).pop();
        if(!f){ res.writeHead(404,{'Content-Type':'application/json'}); return res.end(JSON.stringify({code:'not_found',message:'no existe'})); }
        res.writeHead(200,{'X-Bz-Content-Sha1':f.sha1}); return res.end(f.data);
      }
      const q=u.searchParams, ruta=u.pathname.replace('/b2api/v4/','');
      if(!c) return err(res,401,'bad_auth_token','token');
      if(ruta==='b2_get_upload_url'){ if(!tiene('writeFiles')) return err(res,401,'unauthorized','sin writeFiles'); const b=q.get('bucketId'); if(c.cubos&&!c.cubos.includes(b.replace('id-',''))) return err(res,401,'unauthorized','bucket'); const t='up-'+(++n); tokens.set(t,c); return js(res,200,{bucketId:b,uploadUrl:base+'/upload/'+b+'/'+t,authorizationToken:t}); }
      if(ruta==='b2_list_file_names'){ if(!tiene('listFiles')) return err(res,401,'unauthorized','sin listFiles'); const nm=q.get('bucketId').replace('id-',''), p=q.get('prefix')||'';
        return js(res,200,{files:archivos.filter(x=>x.bucket===nm&&x.fileName.startsWith(p)).sort((a,b)=>a.fileName<b.fileName?-1:1).map(x=>({fileName:x.fileName,fileId:x.fileId,action:'upload',contentLength:x.data.length,contentSha1:x.sha1,uploadTimestamp:x.uploadTimestamp})),nextFileName:null}); }
      if(ruta==='b2_get_file_info'){ if(!tiene('readFiles')) return err(res,401,'unauthorized','sin readFiles'); const f=archivos.find(x=>x.fileId===q.get('fileId')); if(!f) return err(res,404,'not_found','no existe');
        return js(res,200,{fileId:f.fileId,fileName:f.fileName,fileRetention:tiene('readFileRetentions')?{isClientAuthorizedToRead:true,value:f.retencion}:{isClientAuthorizedToRead:false,value:null}}); }
      if(ruta==='b2_delete_file_version'){ const j=JSON.parse(buf.toString()||'{}'); if(!tiene('deleteFiles')) return err(res,401,'access_denied','sin deleteFiles'); const i=archivos.findIndex(x=>x.fileId===j.fileId); if(i<0) return err(res,404,'file_not_present','no existe');
        if(archivos[i].retencion&&archivos[i].retencion.retainUntilTimestamp>Date.now()) return err(res,401,'access_denied','el archivo está bajo retención'); archivos.splice(i,1); return js(res,200,{fileId:j.fileId}); }
      if(ruta==='b2_list_buckets'){ if(!tiene('listBuckets')) return err(res,401,'unauthorized','sin listBuckets'); const ver=tiene('readBucketRetentions');
        return js(res,200,{buckets:Object.entries(cubos).map(([nm,cf])=>({bucketName:nm,bucketId:'id-'+nm,bucketType:cf.tipo||'allPrivate',lifecycleRules:cf.ciclo||[],fileLockConfiguration:ver?{isClientAuthorizedToRead:true,value:{isFileLockEnabled:!!cf.retencionDias,defaultRetention:cf.retencionDias?{mode:cf.modo||'compliance',period:{duration:cf.retencionDias,unit:'days'}}:{mode:null,period:null}}}:{isClientAuthorizedToRead:false,value:null}}))}); }
      err(res,400,'bad_request','endpoint desconocido '+ruta);
    });
  });
  return {archivos,lg,iniciar:()=>new Promise(r=>srv.listen(0,'127.0.0.1',()=>r('http://127.0.0.1:'+srv.address().port))),cerrar:()=>new Promise(r=>srv.close(r)),intentos:()=>intentosSubida};
}
module.exports={crear};

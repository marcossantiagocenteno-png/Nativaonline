/* Nativa Online — respaldos: utilidades comunes. Sólo módulos de Node; ninguna dependencia.
   Todo esto vive FUERA del servidor y del juego: lee la carpeta de datos, nunca la escribe. */
'use strict';
const fs=require('fs'), path=require('path'), crypto=require('crypto'), cp=require('child_process');

const sha256=d=>crypto.createHash('sha256').update(d).digest('hex');
function hashArchivo(ruta,alg){
  const h=crypto.createHash(alg||'sha256'), fd=fs.openSync(ruta,'r'), buf=Buffer.alloc(1<<20);
  try{ let n; while((n=fs.readSync(fd,buf,0,buf.length,null))>0) h.update(buf.subarray(0,n)); } finally{ fs.closeSync(fd); }
  return h.digest('hex');
}
/* temporal + fsync + renombrar: o queda entero o no queda */
function escribirAtomico(ruta,dato){
  fs.mkdirSync(path.dirname(ruta),{recursive:true});
  const tmp=ruta+'.tmp-'+process.pid+'-'+Date.now(), fd=fs.openSync(tmp,'w');
  try{ fs.writeSync(fd,dato); fs.fsyncSync(fd); } finally{ fs.closeSync(fd); }
  fs.renameSync(tmp,ruta);
}
function ejecutar(cmd,args,op){
  op=op||{};
  const r=cp.spawnSync(cmd,args,{encoding:op.binario?'buffer':'utf8',maxBuffer:256*1024*1024,input:op.entrada,env:op.env||process.env,cwd:op.cwd,timeout:op.timeout});
  if(r.error) throw new Error(cmd+': '+r.error.message);
  if(r.status!==0&&!op.tolerar) throw new Error(cmd+' '+args.slice(0,3).join(' ')+' salió con '+r.status+': '+String(r.stderr||'').trim().slice(0,400));
  return r;
}
const log=(nivel,msg,extra)=>process.stderr.write(JSON.stringify(Object.assign({ts:new Date().toISOString(),nivel,msg},extra||{}))+'\n');
const vivo=pid=>{ try{ process.kill(pid,0); return true; }catch(e){ return e.code==='EPERM'; } };
const espera=ms=>new Promise(r=>setTimeout(r,ms));

/* un solo respaldo a la vez; si el dueño del candado murió (apagón, kill -9), se retoma */
function tomarCandado(ruta){
  fs.mkdirSync(path.dirname(ruta),{recursive:true});
  for(let i=0;i<2;i++){
    try{
      const fd=fs.openSync(ruta,'wx'); fs.writeSync(fd,String(process.pid)); fs.closeSync(fd);
      return {liberar(){ try{ if(fs.readFileSync(ruta,'utf8')===String(process.pid)) fs.unlinkSync(ruta); }catch(e){} }};
    }catch(e){
      if(e.code!=='EEXIST') throw e;
      let pid=0; try{ pid=+fs.readFileSync(ruta,'utf8'); }catch(x){}
      if(pid&&vivo(pid)) return null;
      try{ fs.unlinkSync(ruta); }catch(x){}
    }
  }
  return null;
}

/* ---- tiempo, siempre en UTC ---- */
const p2=n=>String(n).padStart(2,'0');
const dia=d=>d.getUTCFullYear()+'-'+p2(d.getUTCMonth()+1)+'-'+p2(d.getUTCDate());
const seisHoras=d=>dia(d)+'T'+p2(Math.floor(d.getUTCHours()/6)*6);
function semanaISO(d){
  const t=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate())), n=t.getUTCDay()||7;
  t.setUTCDate(t.getUTCDate()+4-n);
  const y=t.getUTCFullYear(), s=Math.ceil(((t-Date.UTC(y,0,1))/864e5+1)/7);
  return y+'-W'+p2(s);
}
const marca=d=>d.toISOString().replace(/[-:]/g,'').replace(/\.\d+Z$/,'Z');

/* nombres relativos con '/', ordenados: así el mismo contenido da el mismo mapa en cualquier sistema */
function listarArbol(dir,op){
  op=op||{}; const out={};
  (function rec(rel){
    const abs=path.join(dir,rel);
    for(const e of fs.readdirSync(abs,{withFileTypes:true}).sort((a,b)=>a.name<b.name?-1:1)){
      const r=rel?rel+'/'+e.name:e.name;
      if(e.name==='.lock'||e.name.includes('.tmp-')) continue;
      if(e.isDirectory()) rec(r); else if(e.isFile()) out[r]=hashArchivo(path.join(dir,r));
    }
  })('');
  return out;
}
function igualesArboles(a,b){
  const ka=Object.keys(a), kb=Object.keys(b), dif=[];
  for(const k of ka) if(!(k in b)) dif.push('falta '+k); else if(a[k]!==b[k]) dif.push('distinto '+k);
  for(const k of kb) if(!(k in a)) dif.push('sobra '+k);
  return dif;
}
/* copia una carpeta entera, archivo por archivo (sin fs.cpSync, que en algunas versiones de Node para Windows se cae sin dejar mensaje). Sólo archivos y carpetas normales. */
function copiarArbol(origen,destino){
  fs.mkdirSync(destino,{recursive:true});
  for(const e of fs.readdirSync(origen,{withFileTypes:true})){
    const a=path.join(origen,e.name), b=path.join(destino,e.name);
    if(e.isDirectory()) copiarArbol(a,b); else if(e.isFile()) fs.copyFileSync(a,b);
  }
}
module.exports={copiarArbol,sha256,hashArchivo,escribirAtomico,ejecutar,log,vivo,espera,tomarCandado,dia,seisHoras,semanaISO,marca,listarArbol,igualesArboles};

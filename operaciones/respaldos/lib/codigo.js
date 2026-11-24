/* Nativa Online — respaldos: el código que corría cuando se hizo la copia.
   El respaldo lleva dentro el código exacto (servidor/, src/, operaciones/): restaurar no depende de que GitHub siga teniendo
   ese commit. Sólo se copian archivos que git sigue (nunca un .env suelto); si no hay git, se recorre con una lista de exclusiones. */
'use strict';
const fs=require('fs'), path=require('path'), os=require('os');
const {ejecutar,listarArbol,sha256}=require('./comun.js');
const RAICES=['servidor','src','operaciones'];

function git(raiz,args){ const r=ejecutar('git',['-C',raiz].concat(args),{tolerar:true}); return r.status===0?String(r.stdout):null; }

function archivosDeCodigo(raiz){
  const lista=git(raiz,['ls-files','-z','--'].concat(RAICES));
  if(lista!==null&&lista.length) return {git:true,archivos:lista.split('\0').filter(Boolean)};
  const out=[], MAL=/(^|\/)(node_modules|\.git|datos)(\/|$)|\.env($|\.)|\.pem$|\.key$/;
  for(const r of RAICES){
    const base=path.join(raiz,r); if(!fs.existsSync(base)) continue;
    (function rec(rel){ for(const e of fs.readdirSync(path.join(raiz,rel),{withFileTypes:true})){
      const x=rel+'/'+e.name; if(MAL.test(x)) continue; if(e.isDirectory()) rec(x); else if(e.isFile()) out.push(x); } })(r);
  }
  return {git:false,archivos:out};
}

function copiarCodigo(raiz,dest){
  const {git:hayGit,archivos}=archivosDeCodigo(raiz); let copiados=0;
  for(const rel of archivos){
    const o=path.join(raiz,rel); if(!fs.existsSync(o)||!fs.statSync(o).isFile()) continue;     // borrado sin confirmar: no entra
    fs.mkdirSync(path.dirname(path.join(dest,rel)),{recursive:true}); fs.copyFileSync(o,path.join(dest,rel)); copiados++;
  }
  const commit=hayGit?(git(raiz,['rev-parse','HEAD'])||'').trim()||'desconocido':'desconocido';
  const sucio=hayGit?(git(raiz,['status','--porcelain','--'].concat(RAICES))||'').trim().length>0:true;
  return {commit,arbolSucio:sucio,git:hayGit,archivos:copiados};
}

function versionDe(cmd,args){ const r=ejecutar(cmd,args||['--version'],{tolerar:true}); return r.status===0?String(r.stdout||r.stderr).trim().split('\n')[0]:'no disponible'; }
function entorno(raiz){
  let ws='desconocida'; try{ ws=JSON.parse(fs.readFileSync(path.join(raiz,'servidor','package.json'),'utf8')).dependencies.ws; }catch(e){}
  return {node:process.version,arquitectura:os.platform()+'-'+os.arch(),ws,age:versionDe('age'),tar:versionDe('tar')};
}
module.exports={copiarCodigo,entorno,archivosDeCodigo,RAICES};

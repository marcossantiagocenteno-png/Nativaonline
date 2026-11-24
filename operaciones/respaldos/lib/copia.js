/* Nativa Online — respaldos: copiar la carpeta de datos de un servidor que sigue funcionando.
   Esto sólo LEE el origen. No abre el almacén, no toma su candado, no avisa al servidor.

   Por qué esta forma de copiar es consistente (se lee de servidor/almacen.js):
     · una instantánea se escribe a un temporal y se renombra: o está entera o no aparece con su nombre final;
     · el diario sólo crece, y cada renglón se anota ANTES de que se escriba la instantánea que lo contiene.
   Entonces, si se copian primero las instantáneas y el diario AL FINAL, el diario copiado siempre llega igual o más adelante que
   cualquier instantánea copiada. (Al revés habría una instantánea sin su renglón, y el servidor inventaría una entrada
   «recuperado»: se perdería la fidelidad del historial.) El diario se corta en el último salto de línea: un renglón a medias nunca
   entra. Aun así NO se confía en el orden: toda copia se abre con el mismo código del servidor y se audita antes de valer. */
'use strict';
const fs=require('fs'), path=require('path');
const {listarArbol}=require('./comun.js');

const RE_SNAP=/^\d{9}\.json$/, RE_COLA=/^diario\.cola-\d+\.txt$/, RE_REVOCADAS=/^sesiones-revocadas\.json(\.danado-.+)?$/;

function copiarOrdenado(origen,dest,op){
  op=op||{};
  fs.mkdirSync(path.join(dest,'instantaneas'),{recursive:true});
  const omitidos=[]; let top;
  try{ top=fs.readdirSync(origen); }catch(e){ throw new Error('no puedo leer la carpeta de datos '+origen+': '+e.message); }
  const cp=(rel)=>fs.copyFileSync(path.join(origen,rel),path.join(dest,rel));
  // 1) meta
  if(top.includes('meta.json')) cp('meta.json');
  // 2) todas las instantáneas (sólo nombres finales: los temporales no cuentan)
  const dSnap=path.join(origen,'instantaneas');
  if(fs.existsSync(dSnap)) for(const n of fs.readdirSync(dSnap).sort()) if(RE_SNAP.test(n)) cp('instantaneas/'+n);
  // 3) lo demás permitido
  for(const n of top){
    if(n==='.lock'||n.includes('.tmp-')||n==='meta.json'||n==='instantaneas'||n==='diario.ndjson') continue;
    if(RE_COLA.test(n)||RE_REVOCADAS.test(n)){ cp(n); continue; }
    if(n==='respaldos'){
      if(op.respaldos){ try{ fs.cpSync(path.join(origen,n),path.join(dest,n),{recursive:true}); }catch(e){ if(e.code!=='ENOENT') throw e; } }
      continue;
    }
    omitidos.push(n);                                    // sólo se anota el NOMBRE; el contenido jamás se lee
  }
  // 4) el diario, al final, cortado en el último salto de línea
  const fd=path.join(origen,'diario.ndjson');
  if(fs.existsSync(fd)){
    const buf=fs.readFileSync(fd), fin=buf.lastIndexOf(10);
    fs.writeFileSync(path.join(dest,'diario.ndjson'),fin>=0?buf.subarray(0,fin+1):Buffer.alloc(0));
  }
  return {omitidos,sinRespaldos:!op.respaldos};
}

/* La huella que el mundo «de verdad» tenía en la versión seq, leída de sus propios archivos (no de la memoria del servidor). */
function huellaVivaEn(vivo,seq){
  const fd=path.join(vivo,'diario.ndjson');
  if(seq>0&&fs.existsSync(fd)){
    for(const l of fs.readFileSync(fd,'utf8').split('\n')){
      if(!l) continue;
      let e; try{ e=JSON.parse(l); }catch(x){ continue; }          // el último renglón puede estar a medias
      if(e&&e.seq===seq&&typeof e.h==='string') return e.h;
    }
  }
  const fs0=path.join(vivo,'instantaneas',String(seq).padStart(9,'0')+'.json');
  if(fs.existsSync(fs0)){ try{ return JSON.parse(fs.readFileSync(fs0,'utf8')).huella||null; }catch(e){} }
  return null;
}
module.exports={copiarOrdenado,huellaVivaEn,listarArbol};

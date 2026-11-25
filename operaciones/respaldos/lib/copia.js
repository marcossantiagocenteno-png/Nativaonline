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
const {listarArbol,copiarArbol}=require('./comun.js');

const RE_SNAP=/^\d{9}\.json$/, RE_COLA=/^diario\.cola-\d+\.txt$/, RE_REVOCADAS=/^sesiones-revocadas\.json(\.danado-.+)?$/, RE_PERSONAJE=/^[0-9a-f]{12}\.json(\.danado-\d+)?$/;

function copiarOrdenado(origen,dest,op){
  op=op||{};
  fs.mkdirSync(path.join(dest,'instantaneas'),{recursive:true});
  const omitidos=[]; let top, personajes=0;
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
    if(n==='personajes'){ personajes=copiarPersonajes(origen,dest); continue; }
    if(n==='respaldos'){
      if(op.respaldos){ try{ copiarArbol(path.join(origen,n),path.join(dest,n)); }catch(e){ if(e.code!=='ENOENT') throw e; } }
      continue;
    }
    omitidos.push(n);                                    // sólo se anota el NOMBRE; el contenido jamás se lee
  }
  // 4) el diario, al final, cortado en el último salto de línea
  copiarDiarioCortado(path.join(origen,'diario.ndjson'),path.join(dest,'diario.ndjson'));
  return {omitidos,sinRespaldos:!op.respaldos,personajes};
}

/* Los personajes permanentes (servidor/personajes.js): un archivo por personaje, escrito de forma atómica (temporal + renombrar). Se copian sólo los
   nombres finales (<12 hex>.json y los <…>.json.danado-<hora> apartados); los temporales no. Cada archivo copiado es una versión entera de ese personaje
   (la anterior o la nueva, nunca a medias) y lleva su suma de control: la auditoría la comprueba. */
function copiarPersonajes(origen,dest){
  const d=path.join(origen,'personajes'); let nombres; try{ nombres=fs.readdirSync(d); }catch(e){ if(e.code==='ENOENT') return 0; throw e; }
  fs.mkdirSync(path.join(dest,'personajes'),{recursive:true}); let n=0;
  for(const nom of nombres.sort()) if(RE_PERSONAJE.test(nom)){
    try{ fs.copyFileSync(path.join(d,nom),path.join(dest,'personajes',nom)); n++; }catch(e){ if(e.code!=='ENOENT') throw e; }     // ENOENT: se apartó justo ahora; la auditoría decide
  }
  return n;
}

/* El diario se copia POR BLOQUES de 1 MiB (la memoria no crece con el diario) y se corta en el último salto de línea.
   Se fija el tamaño S al empezar: se copian como mucho esos S bytes, aunque el servidor siga añadiendo renglones. Es el mismo resultado de siempre:
   los primeros S bytes del diario, hasta el último «\n» que haya entre ellos (si no hay ninguno, un archivo vacío). Un renglón a medias no entra. */
const BLOQUE=1<<20;
function copiarDiarioCortado(origen,destino){
  let fi; try{ fi=fs.openSync(origen,'r'); }catch(e){ if(e.code==='ENOENT') return false; throw e; }
  let fo=null;
  try{
    const S=fs.fstatSync(fi).size, buf=Buffer.allocUnsafe(Math.min(BLOQUE,Math.max(S,1)));
    fo=fs.openSync(destino,'w');
    let pos=0, ultimo=-1;                                // ultimo: posición del último salto de línea ya copiado
    while(pos<S){
      const n=fs.readSync(fi,buf,0,Math.min(buf.length,S-pos),pos); if(n<=0) break;
      const i=buf.lastIndexOf(10,n-1); if(i>=0&&i<n) ultimo=pos+i;
      let w=0; while(w<n) w+=fs.writeSync(fo,buf,w,n-w);
      pos+=n;
    }
    fs.ftruncateSync(fo,ultimo+1);                       // ultimo=-1 → 0 bytes
  } finally{ if(fo!==null) fs.closeSync(fo); fs.closeSync(fi); }
  return true;
}

/* Recorre un archivo por renglones sin cargarlo entero: llama a cada(renglón) con el texto de cada línea (sin el «\n») y se detiene si devuelve true.
   Un renglón se decodifica ya completo: el salto de línea nunca aparece dentro de un carácter UTF-8 de varios bytes, así que cortar por bloques
   no parte caracteres. El último renglón cuenta aunque no termine en salto de línea. */
function recorrerRenglones(ruta,cada){
  let fd; try{ fd=fs.openSync(ruta,'r'); }catch(e){ if(e.code==='ENOENT') return; throw e; }
  try{
    const buf=Buffer.allocUnsafe(BLOQUE); let resto=[], restoLen=0;
    for(;;){
      const n=fs.readSync(fd,buf,0,buf.length,null); if(n<=0) break;
      let ini=0;
      for(;;){
        const i=buf.indexOf(10,ini); if(i<0||i>=n) break;
        const trozo=buf.subarray(ini,i), linea=restoLen?Buffer.concat(resto.concat([trozo])):trozo;
        resto=[]; restoLen=0; ini=i+1;
        if(cada(linea.toString('utf8'))) return;
      }
      if(ini<n){ resto.push(Buffer.from(buf.subarray(ini,n))); restoLen+=n-ini; }   // se copia: el bloque se reutiliza
    }
    if(restoLen&&cada(Buffer.concat(resto).toString('utf8'))) return;
  } finally{ fs.closeSync(fd); }
}

/* La huella que el mundo «de verdad» tenía en la versión seq, leída de sus propios archivos (no de la memoria del servidor). */
function huellaVivaEn(vivo,seq){
  const fd=path.join(vivo,'diario.ndjson');
  if(seq>0){
    let h=null;
    recorrerRenglones(fd,l=>{                                      // por renglones, sin cargar el diario: se queda con el PRIMero que coincide, como siempre
      if(!l) return false;
      let e; try{ e=JSON.parse(l); }catch(x){ return false; }       // el último renglón puede estar a medias
      if(e&&e.seq===seq&&typeof e.h==='string'){ h=e.h; return true; }
      return false;
    });
    if(h!==null) return h;
  }
  const fs0=path.join(vivo,'instantaneas',String(seq).padStart(9,'0')+'.json');
  if(fs.existsSync(fs0)){ try{ return JSON.parse(fs.readFileSync(fs0,'utf8')).huella||null; }catch(e){} }
  return null;
}
module.exports={copiarOrdenado,huellaVivaEn,listarArbol,copiarDiarioCortado,recorrerRenglones};

#!/usr/bin/env node
/* Arnés de carga — genera un mundo oficial con un número dado de ediciones (el «tamaño del mundo»: lo que de verdad pesa en un respaldo es el
   diario y las instantáneas, no el mapa). Determinista: misma semilla y mismas ediciones → mismo mundo, versión por versión.
   Uso:  node pruebas/carga/mundo.js --dir <carpeta> --ediciones 6000 [--cadaN 100] [--semilla 1]
   Usa el servidor SIN modificarlo (servidor/mundo-oficial.js, sólo lectura). La generación es cuadrática (cada edición re-suma el mundo): en
   esta máquina 6000 ediciones tardan del orden de medio minuto y 12 000 más de un minuto. */
'use strict';
const path=require('path'), {prng}=require('./util.js');
const RAIZ=path.resolve(__dirname,'..','..'), EXTENSION=400;
/* la edición número i de un mundo con esa semilla (la usa también el administrador simulado, con otra semilla) */
function edicion(azar){ return {t:'suelo',x:Math.floor(azar()*EXTENSION),y:Math.floor(azar()*EXTENSION),m:azar()<.5?'d':'g'}; }
async function generarMundo({dir,ediciones,cadaN,semilla,progreso}){
  const {abrirMundoOficial}=require(path.join(RAIZ,'servidor','mundo-oficial.js')), azar=prng(semilla||1);
  const M=await abrirMundoOficial({dir,cadaN:cadaN||100}); const t0=Date.now();
  for(let i=0;i<ediciones;i++){ await M.aplicar(edicion(azar),'gen'+(i%4)); if(progreso&&i%1000===999) progreso(i+1,(Date.now()-t0)/1000); }
  const seq=M.seq(), huella=M.huella(); await M.cerrar(); return {seq,huella,segundos:+((Date.now()-t0)/1000).toFixed(1)};
}
module.exports={generarMundo,edicion,EXTENSION};
if(require.main===module){
  const a=process.argv.slice(2), g=n=>{ const i=a.indexOf('--'+n); return i>=0?a[i+1]:undefined; };
  if(!g('dir')||!g('ediciones')){ console.error('uso: node pruebas/carga/mundo.js --dir <carpeta> --ediciones N [--cadaN 100] [--semilla 1]'); process.exit(2); }
  generarMundo({dir:path.resolve(g('dir')),ediciones:+g('ediciones'),cadaN:+g('cadaN')||100,semilla:+g('semilla')||1,progreso:(n,s)=>console.error('  '+n+' ediciones ('+s.toFixed(0)+' s)')}).then(r=>console.log(JSON.stringify(r))).catch(e=>{ console.error(e); process.exit(1); });
}

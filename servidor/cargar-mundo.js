/* Nativa Online — SERVIDOR: carga el mundo sin pantalla.
   Evalúa, en una sola función (como el navegador, que comparte lo declarado arriba entre los scripts), los módulos de
   NV_MODULOS_SERVIDOR de src/modulos.js. Es el mismo código que corre en el cliente: la colisión, las alturas y las
   ediciones no tienen una segunda versión. Devuelve un objeto NV propio (cada llamada es un mundo aparte).
   Sin dependencias. */
'use strict';
const fs=require('fs'), path=require('path');
const RAIZ=path.resolve(__dirname,'..');

function listas(){
  const w={}; new Function('window',fs.readFileSync(path.join(RAIZ,'src/modulos.js'),'utf8'))(w);
  return w;
}
/* todo módulo del juego está en exactamente una de las dos listas: si no, un motor nuevo se quedaría sin decidir dónde corre */
function clasificacion(){
  const w=listas(), srv=new Set(w.NV_MODULOS_SERVIDOR), cli=new Set(w.NV_MODULOS_SOLO_CLIENTE), faltan=[], dobles=[], sobran=[];
  for(const m of w.NV_MODULOS){ const a=srv.has(m), b=cli.has(m); if(!a&&!b) faltan.push(m); if(a&&b) dobles.push(m); }
  for(const m of [...srv,...cli]) if(!w.NV_MODULOS.includes(m)) sobran.push(m);
  return {faltan,dobles,sobran,ok:!faltan.length&&!dobles.length&&!sobran.length};
}

/* opciones: {datos: el contenido de un mundo editado (si no, el de src/mundo/mundo-datos.js), semilla: para pruebas} */
function cargarMundo(op){
  op=op||{};
  const w=listas(), orden=w.NV_MODULOS.filter(m=>w.NV_MODULOS_SERVIDOR.includes(m));      // el orden de carga es el del juego
  const fuentes=orden.map(m=>fs.readFileSync(path.join(RAIZ,'src',m+'.js'),'utf8'));
  const ventana={}; ventana.window=ventana;
  const sombra={console,Math,JSON,Date,Map,Set,Array,Object,Number,String,Boolean,Error,Uint8Array,Uint16Array,Uint32Array,Int8Array,Int16Array,Int32Array,
    Float32Array,Float64Array,Symbol,RegExp,isNaN,isFinite,parseInt,parseFloat,performance:{now:()=>Number(process.hrtime.bigint()/1000000n)},
    setTimeout:()=>0,clearTimeout:()=>{},setInterval:()=>0,clearInterval:()=>{},requestAnimationFrame:()=>0};
  const nombres=Object.keys(sombra);
  let fuente=fuentes[0]+(op.semilla?'\nwindow.NV.CONFIG.seed='+JSON.stringify(op.semilla)+';\n':'')+'\n;\n'+fuentes.slice(1).join('\n;\n');
  fuente+='\n;return window.NV;';
  const NV=new Function('window',...nombres,fuente)(ventana,...nombres.map(n=>sombra[n]));
  if(op.datos) NV.mundo.cargar(op.datos);
  return NV;
}
module.exports={cargarMundo,clasificacion,listas,RAIZ};

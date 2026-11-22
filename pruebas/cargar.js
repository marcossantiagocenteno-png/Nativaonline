// Carga los módulos en orden en un navegador simulado y devuelve el motor.
const fs=require('fs');
const R='/home/claude/nativaonline/';
const ORDEN=['src/motor/base.js','src/mundo/diccionario.js','src/mundo/generar.js',
  'src/mundo/astro.js','src/mundo/cielo.js','src/mundo/mareas.js','src/mundo/clima.js','src/motor/lienzo.js','src/juego/interfaz.js','src/juego/dibujar.js','src/juego/astros.js','src/juego/jugar.js'];
const ctx={font:'',textBaseline:'',textAlign:'',fillStyle:'',letterSpacing:'0px',
  measureText:t=>({width:6*(t?t.length:1)}),setTransform(){},fillRect(){},fillText(){},
  createRadialGradient(){return{addColorStop(){}}}};
const els={};
const el=id=>els[id]||(els[id]={id,textContent:'',innerHTML:'',value:'',dataset:{},style:{},
  clientWidth:1200,clientHeight:700,width:1200,height:700,
  classList:{toggle(){},add(){},remove(){},contains(){return false}},
  addEventListener(){},querySelectorAll:()=>[],getContext:()=>ctx});
global.window={claude:{use:async()=>null}};
global.document={getElementById:el,querySelector:()=>null,querySelectorAll:()=>[],hidden:false,body:{classList:{add(){}},insertAdjacentHTML(){}}};
global.matchMedia=()=>({matches:false});
global.addEventListener=()=>{};
global.requestAnimationFrame=cb=>cb();
global.performance={now:()=>Number(process.hrtime.bigint()/1000000n)};
global.setInterval=()=>0;global.clearInterval=()=>{};global.setTimeout=()=>0;global.clearTimeout=()=>{};
const src=ORDEN.map(f=>fs.readFileSync(R+f,'utf8')).join('\n;\n');
module.exports=function(extra){
  const mod={exports:{}};
  new Function('module','exports',src+'\n'+(extra||'module.exports=window.NV;'))(mod,mod.exports);
  return mod.exports;
};

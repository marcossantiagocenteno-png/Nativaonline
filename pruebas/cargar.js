// Carga los módulos en orden en un navegador simulado y devuelve el motor.
const fs=require('fs');
const R='/home/claude/nativaonline/';
const ORDEN=['src/motor/base.js','src/mundo/diccionario.js','src/mundo/generar.js',
  'src/mundo/paneles.js','src/mundo/astro.js','src/mundo/cielo.js','src/mundo/mareas.js','src/mundo/clima.js','src/motor/lienzo.js',
  'src/arte/myrella.js','src/motor/sprites.js','src/juego/interfaz.js','src/juego/personajes.js','src/juego/dibujar.js','src/juego/astros.js','src/juego/jugar.js'];
const ctx={font:'',textBaseline:'',textAlign:'',fillStyle:'',letterSpacing:'0px',
  measureText:t=>({width:6*(t?t.length:1)}),setTransform(){},fillRect(){},fillText(){},
  save(){},restore(){},translate(){},
  createRadialGradient(){return{addColorStop(){}}}};
/* Solo existen los elementos que el marcado de interfaz.js declara de verdad.
   Para cualquier otro id se devuelve null, igual que el navegador: así los
   descuidos aparecen acá y no en la pantalla de Marcos. */
const marcado=fs.readFileSync(R+'src/juego/interfaz.js','utf8');
const IDS=new Set([...marcado.matchAll(/id="([^"]+)"/g)].map(m=>m[1]));
const els={};
const el=id=>IDS.has(id) ? (els[id]||(els[id]={id,textContent:'',innerHTML:'',value:'',dataset:{},style:{},
  clientWidth:1200,clientHeight:700,width:1200,height:700,
  classList:{toggle(){},add(){},remove(){},contains(){return false}},
  addEventListener(){},querySelectorAll:()=>[],getContext:()=>ctx})) : null;
global.window={claude:{use:async()=>null}, addEventListener(){}, removeEventListener(){}};
global.document={getElementById:el,createElement:()=>({style:{},textContent:'',appendChild(){}}),querySelector:()=>null,querySelectorAll:()=>[],hidden:false,body:{classList:{add(){}},insertAdjacentHTML(){},appendChild(){}}};
global.matchMedia=()=>({matches:false});
global.addEventListener=()=>{};
/* El navegador llama a esto en el próximo cuadro; acá se ejecuta al instante.
   Con un lazo que se vuelve a agendar solo, eso sería recursión infinita, así
   que se corta a tres niveles. Las pruebas que miden cuadros se arman su propia
   cola después de cargar. */
let profundidad=0;
global.requestAnimationFrame=cb=>{
  if(profundidad>2) return 0;
  profundidad++;
  try{ cb(Date.now()); } finally{ profundidad--; }
  return 0;
};
global.performance={now:()=>Number(process.hrtime.bigint()/1000000n)};
global.setInterval=()=>0;global.clearInterval=()=>{};global.setTimeout=()=>0;global.clearTimeout=()=>{};
const src=ORDEN.map(f=>fs.readFileSync(R+f,'utf8')).join('\n;\n');
module.exports=function(extra){
  const mod={exports:{}};
  new Function('module','exports',src+'\n'+(extra||'module.exports=window.NV;'))(mod,mod.exports);
  return mod.exports;
};

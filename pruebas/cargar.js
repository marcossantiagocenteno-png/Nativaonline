// Carga los módulos en orden en un navegador simulado y devuelve el motor.
const fs=require('fs');
const R='/home/claude/nativaonline/';
/* la lista de módulos es la de src/modulos.js: la misma que lee index.html */
const ORDEN=new Function('window',fs.readFileSync(R+'src/modulos.js','utf8')+';return window.NV_MODULOS;')({}).map(f=>'src/'+f+'.js');
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
/* El juego trae el mundo sin árboles (NV.CONFIG.arboles=false). Las pruebas que miden
   árboles ponen global.__arboles=true ANTES de cargar: se aplica justo después de base.js,
   antes de que se genere el primer panel. */
const partes=ORDEN.map(f=>fs.readFileSync(R+f,'utf8'));
const src=[partes[0],'window.NV.CONFIG.arboles=!!global.__arboles;',...partes.slice(1)].join('\n;\n');
/* Las partículas dependen del reloj, y casi todas las pruebas comparan cuadros: arrancan apagadas.
   La que las mide (particulas.js) las enciende con NV.particulas=true. */
module.exports=function(extra){
  const mod={exports:{}};
  new Function('module','exports',src+'\n;window.NV.particulas=false;\n'+(extra||'module.exports=window.NV;'))(mod,mod.exports);
  return mod.exports;
};

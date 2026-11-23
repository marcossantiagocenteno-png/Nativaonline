/* Nativa Online — base: proyección, azar y color.
   Reglas en docs/DISENO.md. Sin dependencias ni compilación:
   los módulos se cargan en orden y comparten el objeto global NV. */

const NV = window.NV || (window.NV = {});
NV.luz = NV.luz || {amb:1, r:1, g:1, b:1};   // el módulo cielo la reemplaza

const MONO='ui-monospace, SFMono-Regular, Menlo, Consolas, "DejaVu Sans Mono", monospace';


/* La escala es continua: el zoom no salta entre niveles. CPM y RPM —caracteres
   y filas por metro— los recalcula el lienzo a partir de cuánto mundo se quiere
   ver a lo ancho. Ver aplicarEscala en motor/lienzo.js. */
let CPM=13, RPM=4, HPM=6.8;

const CONFIG={ name:'Claro del norte', seed:'bosque-02', w:100, h:100,
               treeDensity:0.009, clearing:true, sunElev:30 };
const FAM={
  verde:  ['#0a1f1b','#113b31','#1c6350','#46b48f'],   // verde frío casi negro, con la punta menta
  verdeO: ['#071612','#0c2a23','#154a3d','#2a8470'],   // follaje en sombra propia
  corteza:['#1c1917','#2a2420','#3d342c','#584b3f'],
  piedra: ['#262c33','#3b4550','#5a6975','#8797a5'],
  tierra: ['#26231f','#38342b','#524b3c','#70664f'],
  flor:   ['#6b3a53','#8e4d6d','#b56389','#d07da3'],
  musgo:  ['#0d2a22','#16443a','#25695a','#3c9078'],
  hoja:   ['#2c2313','#463619','#664e25','#896a33'],
  agua:   ['#1d3c4a','#2f6478','#4a93a8','#6fbdcf'],
  arena:  ['#2a2f33','#454d52','#6b767c','#95a3a8'],   // arena de luna: gris azulado, no beige
  hongo:  ['#1b2224','#2f3a3d','#4a5a5d','#74878a'],   // hongo de bosque viejo: pálido y frío
  pino:        ['#08171a','#0e2a2a','#173f3c','#2a6458'],
  alamo:       ['#16332a','#245044','#3a7a62','#68b392'],
  cortezaClara:['#3a3f42','#596064','#838b8e','#adb5b7'],
  abismo: ['#05070b','#0b1016','#141c24','#1e2834'],
  roca2:  ['#473f36','#6a6054','#8f8475','#b3a897'],
  honda:  ['#10212b','#1b3a4a','#2a5a6e','#3d7e94'],
  espuma: ['#5b7b86','#93b0ba','#c6dce2','#eef7fa'],
  nieve:  ['#6e7b84','#9fadb6','#ccd8de','#f0f6f9'],
  hueso:  ['#45412f','#6b6450','#968d72','#c6bb9c'],
  piel:   ['#8d9a93','#b9c6bd','#dfe9e2','#f4faf5']
};

const $=id=>document.getElementById(id);
const clamp=(v,a,b)=>v<a?a:(v>b?b:v);
const esc=s=>String(s).replace(/[&<>]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]));
function hashStr(s){ let h=2166136261; for(let i=0;i<s.length;i++){h^=s.charCodeAt(i); h=Math.imul(h,16777619);} return h>>>0; }
function mulberry(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function hash3(x,y,z){ let h=(x*374761393+y*668265263+z*2147483647)|0; h=Math.imul(h^(h>>>13),1274126177); return ((h^(h>>>16))>>>0)&0x7fffffff; }
/* El agua pide dos o tres senos y otros tantos cosenos por celda, y hay
   decenas de miles de celdas de agua por cuadro. Una tabla de mil veinticuatro
   entradas los saca de encima: el error de redondeo es menor que el salto entre
   dos glifos, así que no se ve. */
const SEN=new Float32Array(1024);
for(let i=0;i<1024;i++) SEN[i]=Math.sin(i*Math.PI/512);
const K2PI=1024/(Math.PI*2);
const sen=a=>SEN[((a*K2PI)|0)&1023];
const cosn=a=>SEN[(((a*K2PI)|0)+256)&1023];

function makeNoise(rnd){
  const s=256,g=new Float64Array(s*s);
  for(let i=0;i<g.length;i++) g[i]=rnd();
  const at=(x,y)=>g[((y&255)*s)+(x&255)], sm=t=>t*t*(3-2*t);
  function val(x,y){
    const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi;
    const a=at(xi,yi),b=at(xi+1,yi),c=at(xi,yi+1),d=at(xi+1,yi+1);
    const u=sm(xf),v=sm(yf);
    return (a*(1-u)+b*u)*(1-v)+(c*(1-u)+d*u)*v;
  }
  return (x,y,oct,sc)=>{ let s2=0,amp=1,f=sc,t=0; for(let i=0;i<oct;i++){s2+=val(x*f,y*f)*amp;t+=amp;amp*=0.5;f*=2;} return s2/t; };
}
function rgbOf(hex){ const v=parseInt(hex.slice(1),16); return [(v>>16)&255,(v>>8)&255,v&255]; }
const RGB={};
for(const k in FAM) RGB[k]=FAM[k].map(rgbOf);
function step(fam,s){ /* s 0..1 -> escalón 0..3 */
  const f=RGB[fam]||RGB.piedra;
  return f[clamp(Math.round(s*3.4-0.2),0,3)];
}
function pick(ramp,t){ return ramp[clamp(Math.round(t*(ramp.length-1)),0,ramp.length-1)]; }

NV.MONO=MONO; NV.CONFIG=CONFIG;
NV.FAM=FAM; NV.RGB=RGB; NV.step=step; NV.pick=pick;
NV.clamp=clamp; NV.esc=esc; NV.$=$;
NV.sen=sen; NV.cosn=cosn;
NV.hashStr=hashStr; NV.mulberry=mulberry; NV.hash3=hash3; NV.makeNoise=makeNoise;

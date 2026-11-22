/* Nativa Online — base: proyección, azar y color.
   Reglas en docs/DISENO.md. Sin dependencias ni compilación:
   los módulos se cargan en orden y comparten el objeto global NV. */

const NV = window.NV || (window.NV = {});
NV.luz = NV.luz || {amb:1, r:1, g:1, b:1};   // el módulo cielo la reemplaza

const MONO='ui-monospace, SFMono-Regular, Menlo, Consolas, "DejaVu Sans Mono", monospace';


/* Cada nivel tiene su propia resolución: de lejos menos caracteres por metro,
   de cerca más. Así la cámara puede alejarse sin que la pantalla reviente. */
const LODS=[
  {cpm:9,  rpm:3,  fs:5},    // 1 · muy lejos
  {cpm:18, rpm:6,  fs:6},    // 2 · media
  {cpm:36, rpm:12, fs:8}     // 3 · cerca
];
let CPM=18, RPM=6, HPM=10.2;

const CONFIG={ name:'Claro del norte', seed:'bosque-02', w:100, h:100,
               treeDensity:0.009, clearing:true, sunElev:30 };
const FAM={
  verde:  ['#17401f','#245a2b','#357f3b','#58a84f'],
  verdeO: ['#12351a','#1d4a24','#2a6b33','#3f8a42'],   // follaje en sombra propia
  corteza:['#3a2a19','#4f3a23','#6a4e30','#8a6940'],
  piedra: ['#3b4042','#565b5e','#767c80','#949b9f'],
  tierra: ['#4a3f2d','#67583f','#857252','#a08a64'],
  flor:   ['#6b3a53','#8e4d6d','#b56389','#d07da3'],
  musgo:  ['#1b3d18','#2a5a22','#3d7a2e','#55993c'],
  hoja:   ['#4a3a1e','#6b5429','#8e7238','#b0914b'],
  agua:   ['#1d3c4a','#2f6478','#4a93a8','#6fbdcf'],
  arena:  ['#5a5140','#7d7158','#a39a7a','#c6bda2'],
  hongo:  ['#5a4a3a','#7d6a52','#a08c6e','#c4b093'],
  pino:        ['#10281c','#17402a','#215c3b','#2f7c50'],
  alamo:       ['#3b5620','#577f31','#7aa743','#a0c660'],
  cortezaClara:['#4e4e46','#737266','#9c9b8c','#c2c1b1'],
  piel:   ['#8d9a93','#b9c6bd','#dfe9e2','#f4faf5']
};

const $=id=>document.getElementById(id);
const clamp=(v,a,b)=>v<a?a:(v>b?b:v);
const esc=s=>String(s).replace(/[&<>]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]));
function hashStr(s){ let h=2166136261; for(let i=0;i<s.length;i++){h^=s.charCodeAt(i); h=Math.imul(h,16777619);} return h>>>0; }
function mulberry(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function hash3(x,y,z){ let h=(x*374761393+y*668265263+z*2147483647)|0; h=Math.imul(h^(h>>>13),1274126177); return ((h^(h>>>16))>>>0)&0x7fffffff; }
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

NV.MONO=MONO; NV.LODS=LODS; NV.CONFIG=CONFIG;
NV.FAM=FAM; NV.RGB=RGB; NV.step=step; NV.pick=pick;
NV.clamp=clamp; NV.esc=esc; NV.$=$;
NV.hashStr=hashStr; NV.mulberry=mulberry; NV.hash3=hash3; NV.makeNoise=makeNoise;

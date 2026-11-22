/* Dibuja un parche de cada suelo en texto plano, para ver la estructura. */
require('./suelo.js');
const OVX=0.70, OVY=0.54, ASPECTO=OVY/(0.6*OVX);
const CPM=14, RPM=Math.max(2,Math.round(CPM/3)), HPM=RPM*1.7;
const W=6, H=4;
const sel=process.argv[2];
for(const k in NVS.SUELO){
  if(sel && k.indexOf(sel)<0) continue;
  const cols=W*CPM, rows=H*RPM+10;
  const g=Array.from({length:rows},()=>new Array(cols).fill(' '));
  const G={CPM,RPM,HPM,c0:0,r0:8,mx0:0,my0:0};
  const pon=(c,r,ch)=>{ if(c>=0&&r>=0&&c<cols&&r<rows) g[r][c]=ch; };
  for(let my=0;my<H;my++) for(let mx=0;mx<W;mx++)
    NVS.pintarMetro(k,G,pon,()=>'x',mx,my,1,0);
  console.log('\n--- '+k+' · '+NVS.SUELO[k].n+' ---');
  console.log(g.map(f=>f.join('').replace(/\s+$/,'')).join('\n'));
}

/* Dibuja cada roca en texto plano, para revisar la forma sin color. */
require('./rocas.js');
const OVX=0.70, OVY=0.54, ASPECTO=OVY/(0.6*OVX);
const CPM=14, RPM=Math.max(2,Math.round(CPM/3)), HPM=RPM*1.7;
const sel=process.argv[2];
for(const cat in NVR.MODELOS) for(const m of NVR.MODELOS[cat]){
  if(sel && m.id!==sel && cat!==sel) continue;
  const anchoX=m.ancho||m.alto;
  const esc=m.muro?0.42:1;
  const cpm=Math.max(3,Math.round(CPM*esc)), rpm=Math.max(2,Math.round(cpm/3)), hpm=rpm*1.7;
  const cols=Math.ceil(anchoX*cpm*(m.muro?1.08:1.3))+8, rows=Math.ceil(m.alto*hpm)+6;
  const g=Array.from({length:rows},()=>new Array(cols).fill(' '));
  const G={CPM:cpm,HPM:hpm,baseC:Math.floor(cols/2),baseR:rows-3};
  const pon=(c,r,ch)=>{ if(c>=0&&r>=0&&c<cols&&r<rows) g[r][c]=ch; };
  (m.muro?NVR.dibujarMuro:NVR.dibujar)(m,G,pon,()=>'x');
  console.log('\n--- '+m.id+' · '+m.n+' · '+m.alto+' m · '+cols+'×'+rows+' ---');
  console.log(g.map(f=>f.join('').replace(/\s+$/,'')).join('\n'));
}

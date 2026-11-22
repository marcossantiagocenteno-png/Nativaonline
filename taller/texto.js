/* Dibuja cada modelo en texto plano, para revisar la geometría sin color. */
require('./modelos.js');
const OVX=0.70, OVY=0.54, ASPECTO=OVY/(0.6*OVX);
const CPM=14, RPM=Math.max(2,Math.round(CPM/3)), HPM=RPM*1.7;
const soloEste = process.argv[2];
for(const m of NVT.MODELOS){
  if(soloEste && m.id!==soloEste) continue;
  const cols=Math.ceil(m.ancho*CPM)+14, rows=Math.ceil(m.alto*HPM)+6;
  const g=Array.from({length:rows},()=>new Array(cols).fill(' '));
  NVT.dibujar(m,{CPM:CPM,HPM:HPM,baseC:Math.floor(cols/2),baseR:rows-3},
    (c,r,ch)=>{ if(c>=0&&r>=0&&c<cols&&r<rows) g[r][c]=ch; },
    ()=>'x');
  console.log('\n--- '+m.id+' · '+m.n+' · '+m.alto.toFixed(1)+' m · '+cols+'×'+rows+' ---');
  console.log(g.map(f=>f.join('').replace(/\s+$/,'')).join('\n'));
}

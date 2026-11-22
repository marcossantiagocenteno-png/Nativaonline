// Caminar sostenido y que los objetos se dibujen de verdad.
const cargar=require('./cargar.js');          // este archivo pisa los temporizadores
const T=new Map(); let id=0;
global.setInterval=f=>{ T.set(++id,f); return id; };
global.clearInterval=i=>T.delete(i);
const latir=n=>{ for(let k=0;k<n;k++) for(const f of [...T.values()]) f(); };

const m=cargar('module.exports={NV:window.NV, empezarACaminar, dejarDeCaminar, draw_, tictac, me:()=>me, fbG:()=>fbG, fbC:()=>fbC};');
const ok=[],mal=[]; const probar=(t,c)=>(c?ok:mal).push(t);
m.tictac();

console.log('=== mantener apretado camina ===');
for(const [nom,dx,dy] of [['norte',0,-1],['oeste',-1,0],['sur',0,1],['este',1,0]]){
  const ini={...m.me()};
  m.empezarACaminar(dx,dy);
  latir(8);
  const rec=Math.abs(m.me().x-ini.x)+Math.abs(m.me().y-ini.y);
  m.dejarDeCaminar(dx,dy);
  const q={...m.me()}; latir(5);
  const quieto=JSON.stringify(m.me())===JSON.stringify(q);
  console.log('  '+nom.padEnd(7), rec+' m en 8 latidos ·', quieto?'para al soltar':'NO PARA');
  probar('caminar al '+nom+' avanza mientras se sostiene', rec>=4);
  probar('caminar al '+nom+' se detiene al soltar', quieto);
}

console.log('\n=== los objetos llegan a la pantalla ===');
m.draw_();
const g=m.fbG(), C=m.fbC();
let tronco=0, copa=0;
for(let i=0;i<g.length;i++){
  if(!g[i]) continue;
  const ch=String.fromCharCode(g[i]), v=C[i], r=(v>>16)&255, gg=(v>>8)&255, b=v&255;
  if('thH'.indexOf(ch)>=0 && r>gg && gg>b) tronco++;
  if('oe8@'.indexOf(ch)>=0 && gg>r) copa++;
}
console.log('  troncos:', tronco, '· follaje:', copa);
probar('se dibujan troncos', tronco>30);
probar('se dibuja follaje', copa>300);

console.log('\n'+ok.length+' comprobaciones pasaron'+(mal.length?', '+mal.length+' FALLARON:':''));
mal.forEach(x=>console.log('  ✗',x));
process.exit(mal.length?1:0);

global.__viejo=true;   // el mundo de nueve paneles de antes (ver cargar.js)
// Tocar la pantalla y caminar hasta ahí: que encuentre camino, que llegue,
// que rodee lo que no se puede pisar y que prefiera el sendero.
const cargar=require('./cargar.js');
const T=new Map(); let id=0;
global.setInterval=f=>{ T.set(++id,f); return id; };
global.clearInterval=i=>T.delete(i);
const latir=n=>{ for(let k=0;k<n;k++){ for(const f of [...T.values()]) f(); NV.pasoForzado(); } };

const m=cargar('module.exports={NV:window.NV, irHacia, buscarCamino, empezarACaminar, me:()=>me, tictac};');
const NV=m.NV, ok=[], mal=[]; const probar=(t,c)=>(c?ok:mal).push(t);
m.tictac();
const inicio=NV.panel(0,0).inicio;
const ir=(x,y,latidos)=>{ m.me().x=inicio.x; m.me().y=inicio.y; m.irHacia(x,y); latir(latidos||400);
  return Math.abs(m.me().x-x)+Math.abs(m.me().y-y); };

console.log('=== llegar a destinos del claro ===');
for(const [nom,x,y] of [['al norte',inicio.x,inicio.y-30],['al este',inicio.x+34,inicio.y+4],
                        ['al sudoeste',inicio.x-26,inicio.y+22],['cruzando el arroyo',20,52]]){
  const t0=Date.now();
  const resto=ir(x,y);
  console.log('  '+nom.padEnd(20), 'quedó a', resto, 'm ·', Date.now()-t0, 'ms');
  probar('llega '+nom, resto<=2);
}

console.log('\n=== rodea lo que no se puede pisar ===');
// un punto al otro lado de la pared de roca del oeste
const camino=m.buscarCamino(inicio.x,inicio.y,-95,50);
console.log('  hasta detrás de la pared de roca:', camino?camino.length+' pasos':'no hay camino');
probar('no atraviesa la pared de roca', !camino || camino.every(p=>!NV.solidoEn(p.x,p.y)));

const porAgua=m.buscarCamino(inicio.x,inicio.y,inicio.x+40,inicio.y);
console.log('  hasta 40 m al este:', porAgua?porAgua.length+' pasos':'no hay');
probar('ningún paso cae en algo sólido', porAgua && porAgua.every(p=>!NV.solidoEn(p.x,p.y)));

console.log('\n=== prefiere el sendero ===');
let sumaPasos=0, sumaTierra=0;
for(const [nom,ax,ay,bx,by] of [
  ['norte → este lejano', inicio.x, inicio.y-14, inicio.x+42, inicio.y-2],
  ['sur → norte largo',   inicio.x-10, inicio.y+30, inicio.x+6, inicio.y-34],
  ['travesía al oeste',   inicio.x+20, inicio.y+6, inicio.x-40, inicio.y-6]]){
  const c=m.buscarCamino(ax,ay,bx,by);
  if(!c){ console.log('  '+nom+': sin camino'); continue; }
  const d=c.filter(p=>NV.sueloEn(p.x,p.y)==='d').length;
  sumaPasos+=c.length; sumaTierra+=d;
  console.log('  '+nom.padEnd(22), c.length+' pasos ·', d+' por tierra pisada ('+Math.round(d/c.length*100)+'%)');
}
console.log('  en conjunto:', Math.round(sumaTierra/sumaPasos*100)+'% del recorrido por sendero');
probar('aprovecha el sendero cuando le queda de paso', sumaTierra/sumaPasos>0.25);

console.log('\n=== el mando manual corta la marcha automática ===');
m.me().x=inicio.x; m.me().y=inicio.y;
m.irHacia(inicio.x, inicio.y-30);
latir(3);
const medio={...m.me()};
m.empezarACaminar(1,0);
latir(6);
console.log('  iba al norte y se le ordenó ir al este:', JSON.stringify(medio), '→', JSON.stringify(m.me()));
probar('el mando manual manda', m.me().x>medio.x);

console.log('\n'+ok.length+' comprobaciones pasaron'+(mal.length?', '+mal.length+' FALLARON:':''));
mal.forEach(x=>console.log('  ✗',x));
process.exit(mal.length?1:0);

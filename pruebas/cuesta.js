// La cuesta cuesta: al buscar camino, subir pesa y un paso bajo puede ganarle a trepar.
// Escena sintética (suelo parejo, una loma en forma de cerco con un paso), no depende del mundo.
const cargar=require('./cargar.js');
const m=cargar('module.exports={NV:window.NV, buscarCamino, tictac};');
const NV=m.NV, ok=[], mal=[]; const probar=(t,c)=>(c?ok:mal).push(t);
m.tictac();
NV.sueloEn=()=>'g'; NV.solidoEn=()=>false;
const paso=t=>t<=0?0:t>=1?1:t*t*(3-2*t);
/* un cerco de 2 m a lo largo de x=50 (rampa de 4 m), con un paso al ras entre y=28 y y=32 */
const cerco=(x,y)=>{ const c=2*paso(1-Math.abs(x-50)/4); const abierto=y>=28&&y<=32; return abierto?0:c; };
NV.alturaEn=cerco;
const largo=c=>c?c.length:-1;
const sube=c=>c.reduce((a,p,i)=>a+Math.max(0,cerco(p.x+0.5,p.y+0.5)-(i?cerco(c[i-1].x+0.5,c[i-1].y+0.5):cerco(40.5,26.5))),0);

console.log('=== el paso bajo gana si queda cerca ===');
const a=m.buscarCamino(40,26,60,26,20000);
console.log('  de (40,26) a (60,26): '+largo(a)+' pasos, subiendo '+sube(a).toFixed(2)+' m en total (recto serían 20 pasos y 4 m)');
probar('llega', a&&a[a.length-1].x===60&&a[a.length-1].y===26);
probar('toma el paso: sube mucho menos que cruzando recto', sube(a)<1.0);

console.log('\n=== trepa si el paso queda lejos ===');
const b=m.buscarCamino(40,2,60,2,20000);
console.log('  de (40,2) a (60,2): '+largo(b)+' pasos, subiendo '+sube(b).toFixed(2)+' m');
probar('si el paso queda a 26 m, cruza el cerco en vez de dar la vuelta', b&&largo(b)<30);

console.log('\n=== en llano no cambia nada ===');
NV.alturaEn=()=>0;
const c=m.buscarCamino(40,26,60,26,20000);
probar('sobre suelo plano el camino es recto (20 pasos)', largo(c)===20);

console.log('\n'+ok.length+' comprobaciones pasaron'+(mal.length?', '+mal.length+' FALLARON:':''));
for(const t of mal) console.log('  ✗ '+t);
process.exit(mal.length?1:0);

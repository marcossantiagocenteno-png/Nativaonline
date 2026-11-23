// Caminar sostenido y que los objetos se dibujen de verdad.
const cargar=require('./cargar.js');          // este archivo pisa los temporizadores
const T=new Map(); let id=0;
global.setInterval=f=>{ T.set(++id,f); return id; };
global.clearInterval=i=>T.delete(i);
const latir=n=>{ for(let k=0;k<n;k++) for(const f of [...T.values()]) f(); };

const m=cargar('module.exports={NV:window.NV, empezarACaminar, dejarDeCaminar, draw_, tictac, me:()=>me, fbG:()=>fbG, fbC:()=>fbC, move, rumbo:()=>facing};');
const ok=[],mal=[]; const probar=(t,c)=>(c?ok:mal).push(t);
m.tictac();
const NV_=m.NV;

console.log('=== mantener apretado camina ===');
/* Lo que se prueba es el mecanismo de mantener apretado, no el bosque: sin
   obstáculos, y volviendo al punto de partida entre una dirección y la otra.
   (Con el bosque real, un árbol a siete metros al sur la hacía fallar.) */
const solido0=NV_.solidoEn; NV_.solidoEn=()=>false;
const salida={...m.me()};
for(const [nom,dx,dy] of [['norte',0,-1],['oeste',-1,0],['sur',0,1],['este',1,0]]){
  m.me().x=salida.x; m.me().y=salida.y;
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
NV_.solidoEn=solido0;

console.log('\n=== los objetos llegan a la pantalla ===');
/* con árboles puestos por la prueba alrededor del personaje: que se vean no
   puede depender de dónde cayó el bosque sorteado */
const obj0=NV_.objetosEn, yo=m.me();
NV_.objetosEn=(a,b,c,d)=>[...obj0(a,b,c,d),
  ...[-7,-4,-1,2,5,8].map((dx,i)=>({x:yo.x+dx,y:yo.y+(i%2?-3:-6),h:4+(i%3),k:'arbol',sp:'encino',s:1000+i*977}))];
m.draw_();
const g=m.fbG(), C=m.fbC();
let tronco=0, copa=0;
for(let i=0;i<g.length;i++){
  if(!g[i]) continue;
  const ch=String.fromCharCode(g[i]), v=C[i], r=(v>>16)&255, gg=(v>>8)&255, b=v&255;
  if('thH'.indexOf(ch)>=0 && r>gg && gg>b) tronco++;
  if('oe8@pqgdb6'.indexOf(ch)>=0 && gg>r) copa++;     // el encino ahora es de glifos: p q g d b 6
}
console.log('  troncos:', tronco, '· follaje:', copa);
probar('se dibujan troncos', tronco>30);
probar('se dibuja follaje', copa>300);
NV_.objetosEn=obj0;

console.log('\n=== la dirección no salta de un juego de poses a otro ===');
/* Un camino en diagonal sale en escalera —este, norte, este, norte— y sacando
   la dirección del último paso, el dibujo alterna entre el juego de poses del
   este y el del norte cada 186 ms. Se saca del desplazamiento NETO de los
   últimos cuatro pasos, con histéresis para que cueste salir del eje en el
   que ya está, y con salida inmediata cuando el personaje se da vuelta. */
{
  const andar=(camino,nombre)=>{
    let cambios=0, antes=m.rumbo(); const vistos=[];
    for(const [dx,dy] of camino){ m.move(dx,dy); const f=m.rumbo();
      if(f!==antes) cambios++; antes=f; vistos.push(f[0]); }
    console.log('  '+nombre.padEnd(24)+vistos.join('')+'  → '+cambios+' cambios');
    return cambios;
  };
  probar('una escalera en diagonal no hace alternar la dirección',
    andar([[1,0],[0,-1],[1,0],[0,-1],[1,0],[0,-1],[1,0],[0,-1]],'escalera al noreste')<=1);
  probar('ir derecho no la hace cambiar',
    andar([[1,0],[1,0],[1,0],[1,0],[1,0]],'recto al este')<=1);
  probar('darse vuelta la cambia en el acto',
    andar([[1,0],[1,0],[1,0],[-1,0],[-1,0],[-1,0]],'vuelta en U')===1);
  probar('doblar la cambia, pero una sola vez',
    andar([[1,0],[1,0],[0,1],[0,1],[0,1],[0,1]],'dobla al sur')<=2);
}

console.log('\n'+ok.length+' comprobaciones pasaron'+(mal.length?', '+mal.length+' FALLARON:':''));
mal.forEach(x=>console.log('  ✗',x));
process.exit(mal.length?1:0);

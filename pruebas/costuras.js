// Las costuras entre paneles.
//
// Cada bioma tenía su propia proporción de pasto largo contra corto, y entre dos
// paneles la proporción saltaba en seco: 83 % de un lado y 50 % del otro, una raya
// de textura a mitad del prado. El umbral ahora se mezcla hacia la costura.
// La promesa que hay que cuidar es la otra: que sea sólo dibujo del suelo y no
// mueva ni un árbol ni una piedra, así que se compara contra una huella de los
// objetos de cada panel tomada ANTES del cambio.
const cargar=require('./cargar.js');
const NV=cargar();
const ok=[],mal=[]; const probar=(t,c)=>(c?ok:mal).push(t);

console.log('=== ¿la costura es más brusca que cualquier otro punto del prado? ===');
/* El ruido del pasto largo mide unos 20 m, así que la proporción sube y baja sola
   hasta 30 puntos entre franjas vecinas EN CUALQUIER PARTE. Por eso no se compara
   un lado con el otro: se compara el escalón en la costura con el escalón típico
   dentro de un panel, medido en las mismas franjas de 3 m. */
const fr=(x0,x1,y0,y1)=>{ let G=0,g=0; for(let y=y0;y<y1;y++) for(let x=x0;x<x1;x++){ const t=NV.sueloEn(x,y); if(t==='G')G++; else if(t==='g')g++; } return G/Math.max(1,G+g); };
const S=3;
const horiz=l=>Math.abs(fr(10,90,l-S,l)-fr(10,90,l,l+S));     // escalón en la línea y=l
const vert =l=>Math.abs(fr(l-S,l,10,90)-fr(l,l+S,10,90));      // escalón en la línea x=l
const natural=[]; for(let l=30;l<=70;l+=2){ natural.push(horiz(l)); natural.push(vert(l)); }
natural.sort((a,b)=>a-b);
const media=natural.reduce((a,b)=>a+b,0)/natural.length, p90=natural[Math.floor(natural.length*0.9)];
console.log('  escalón natural en el interior del claro: media '+(media*100).toFixed(1)+' · el 90 % de los puntos está por debajo de '+(p90*100).toFixed(1)+' puntos');
const costuras=[['El filo del desierto',horiz(0)],['Los pinos fríos',horiz(100)],['El bosque viejo',vert(0)],['El acantilado',vert(100)]];
let peor=0;
for(const [n,e] of costuras){ peor=Math.max(peor,e); console.log('  costura con '+n.padEnd(22)+(e*100).toFixed(1)+' puntos'); }
console.log('  (antes del cambio: 48,8 en el desierto, 20,9 en el acantilado, 7,0 en los pinos y 4,3 en el bosque viejo)');
probar('ninguna costura es más brusca que el 90 % de los puntos del interior', peor<=p90);
probar('la costura del desierto, que era de 49 puntos, ya no pasa de 15', costuras[0][1]<0.15);

console.log('\n=== el umbral es continuo y no toca el centro de los paneles ===');
const tiene=typeof NV.umbralG==='function';
probar('existe la mezcla del umbral', tiene);
if(tiene){
  let salto=0;
  for(let t=3;t<97;t+=3){
    salto=Math.max(salto,
      Math.abs(NV.umbralG(t,-0.01,100)-NV.umbralG(t,0.01,100)),       // costura claro / norte
      Math.abs(NV.umbralG(t,99.99,100)-NV.umbralG(t,100.01,100)),     // claro / sur
      Math.abs(NV.umbralG(-0.01,t,100)-NV.umbralG(0.01,t,100)),       // oeste / claro
      Math.abs(NV.umbralG(99.99,t,100)-NV.umbralG(100.01,t,100)));    // claro / este
  }
  console.log('  salto mayor del umbral al cruzar una costura: '+salto.toFixed(4));
  probar('al cruzar una costura el umbral no salta (< 0.01)', salto<0.01);
  const centro=[[50,50,0.50],[-50,50,0.44],[150,50,0.52],[50,-50,0.38],[50,150,0.56]];
  probar('a más de 24 m de toda costura cada panel conserva su umbral', centro.every(([x,y,t])=>Math.abs(NV.umbralG(x,y,100)-t)<1e-9));
  let mn=9,mx=0; for(let x=-100;x<200;x+=7) for(let y=-100;y<200;y+=7){ const u=NV.umbralG(x,y,100); mn=Math.min(mn,u); mx=Math.max(mx,u); }
  probar('nunca sale del rango de los nueve paneles (0,38 a 0,56)', mn>=0.38-1e-9&&mx<=0.56+1e-9);
}

console.log('\n=== los árboles de cada costura ===');
/* Se cuentan los árboles en franjas de 10 m pegadas a cada costura. Entre el claro
   (0,009) y el filo del desierto (0,030) el bosque pasaba de ralo a tupido en una
   línea. Lo que se mide es la razón entre un lado y el otro, en logaritmo natural:
   0 es igual, 0,69 es el doble. */
const arboles=(x0,x1,y0,y1)=>NV.objetosEn(x0,y0,x1,y1).filter(o=>o.k==='arbol'&&o.x>=x0&&o.x<x1&&o.y>=y0&&o.y<y1).length;
const B=10, lr=(a,b)=>Math.abs(Math.log((a+1)/(b+1)));
const pares=[
  ['El filo del desierto', arboles(5,95,-B,0),     arboles(5,95,0,B)],
  ['Los pinos fríos',      arboles(5,95,100-B,100),arboles(5,95,100,100+B)],
  ['El bosque viejo',      arboles(-B,0,5,95),     arboles(0,B,5,95)],
  ['El acantilado',        arboles(100-B,100,5,95),arboles(100,100+B,5,95)]];
let suma=0;
for(const [n,a,b] of pares){ suma+=lr(a,b); console.log('  '+n.padEnd(22)+String(a).padStart(3)+' árboles contra '+String(b).padStart(3)+'   razón '+(Math.exp(lr(a,b))).toFixed(1)+'×'); }
const mediaArb=suma/pares.length;
console.log('  razón media: '+Math.exp(mediaArb).toFixed(2)+'×   (con el generador anterior: 2,0×; el desierto 2,6×, los pinos 2,7×)');
probar('en promedio, un lado de la costura no tiene más de 1,7 veces los árboles del otro', mediaArb<Math.log(1.7));
probar('hay árboles en las franjas de las cuatro costuras', pares.every(([,a,b])=>a+b>8));
if(typeof NV.densidadArboles==='function'){
  let salto=0; for(let t=3;t<97;t+=3) salto=Math.max(salto,
    Math.abs(NV.densidadArboles(t,-0.01,100)-NV.densidadArboles(t,0.01,100)),
    Math.abs(NV.densidadArboles(-0.01,t,100)-NV.densidadArboles(0.01,t,100)));
  probar('la densidad de diseño no salta al cruzar una costura (< 0,0005)', salto<0.0005);
} else probar('existe la densidad mezclada', false);

console.log('\n=== el bosque es el mismo en cada partida ===');
/* Huella de los árboles y piedras de cada panel. Es una foto del bosque ACTUAL: la
   promesa es que no cambie sin querer (el generador es determinista). Si el
   generador de árboles se cambia a propósito, se vuelve a tomar: es la única
   razón válida para tocar estas cifras. Última vez: densidad de árboles mezclada
   entre paneles, que volvió a sortear el bosque. */
const HUELLA={"-1,-1":"1239:e5824cae","0,-1":"1093:5dc56a2e","1,-1":"307:f96bdd49","-1,0":"1180:a2ac85d3","0,0":"785:fe5b28af","1,0":"279:1bc0036f","-1,1":"534:59e47926","0,1":"335:763d46fe","1,1":"171:8cd839af"};
const hs=s=>{ let h=2166136261; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619);} return (h>>>0).toString(16); };
let distintos=[];
for(let pj=-1;pj<=1;pj++) for(let pi=-1;pi<=1;pi++){
  const l=NV.objetosEn(pi*100,pj*100,pi*100+100,pj*100+100).map(o=>[o.k,o.x,o.y,o.sp||'',(o.h||0).toFixed(3),o.s||0].join(',')).sort();
  const h=l.length+':'+hs(l.join('|')); if(h!==HUELLA[pi+','+pj]) distintos.push(pi+':'+(-pj));
}
console.log('  paneles con objetos distintos a la huella: '+(distintos.length?distintos.join(', '):'ninguno')+' (de 9)');
probar('los nueve paneles tienen los mismos árboles y piedras que la huella', distintos.length===0);

console.log('\n'+ok.length+' comprobaciones pasaron'+(mal.length?', '+mal.length+' FALLARON:':''));
mal.forEach(t=>console.log('  ✗ '+t)); process.exit(mal.length?1:0);

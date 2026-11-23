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

console.log('\n=== no mueve ni un árbol ni una piedra ===');
/* huella de los objetos de cada panel, tomada con el generador de antes del cambio */
const HUELLA={"-1,-1":"1212:953ed15","0,-1":"1066:bdd08459","1,-1":"297:35b00164","-1,0":"1136:c98679a7","0,0":"737:242918f3","1,0":"260:139b89ac","-1,1":"557:bb93f4cd","0,1":"364:be7424ca","1,1":"167:471192de"};
const hs=s=>{ let h=2166136261; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619);} return (h>>>0).toString(16); };
let distintos=[];
for(let pj=-1;pj<=1;pj++) for(let pi=-1;pi<=1;pi++){
  const l=NV.objetosEn(pi*100,pj*100,pi*100+100,pj*100+100).map(o=>[o.k,o.x,o.y,o.sp||'',(o.h||0).toFixed(3),o.s||0].join(',')).sort();
  const h=l.length+':'+hs(l.join('|')); if(h!==HUELLA[pi+','+pj]) distintos.push(pi+':'+(-pj));
}
console.log('  paneles con objetos distintos a los de antes: '+(distintos.length?distintos.join(', '):'ninguno')+' (de 9)');
probar('los nueve paneles tienen exactamente los mismos árboles y piedras', distintos.length===0);

console.log('\n'+ok.length+' comprobaciones pasaron'+(mal.length?', '+mal.length+' FALLARON:':''));
mal.forEach(t=>console.log('  ✗ '+t)); process.exit(mal.length?1:0);

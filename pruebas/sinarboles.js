global.__viejo=true;   // el mundo de nueve paneles de antes (ver cargar.js)
// Sin árboles: el mundo viene sin ninguno, y apagarlos no mueve nada más.
//
// NV.CONFIG.arboles=false es el estado del juego. Los árboles se generan igual y se
// quitan al final del panel, para que el azar de las piedras y de todo lo demás no
// cambie; lo que se mide acá es justo eso: que no quede ni uno, que no queden casillas
// ocupadas por árboles que ya no están, y que las piedras caigan en los mismos lugares.
// Cada variante corre en un proceso aparte: los paneles se guardan al generarse y no
// se pueden regenerar con otra configuración en el mismo proceso.
const {execFileSync}=require('child_process');
if(process.argv[2]==='listar'){
  const cargar=require('./cargar.js');
  global.__arboles=process.argv[3]==='con';
  const NV=cargar();
  const o=NV.objetosEn(-100,-100,200,200);
  let solidos=0; for(let y=-100;y<200;y++) for(let x=-100;x<200;x++) if(NV.solidoEn(x,y)) solidos++;
  process.stdout.write(JSON.stringify({o:o.map(t=>[t.k,t.x,t.y,+(t.h||0).toFixed(3),t.s||0]),solidos}));
  process.exit(0);
}
const ok=[],mal=[]; const probar=(t,c)=>(c?ok:mal).push(t);
const correr=v=>JSON.parse(execFileSync(process.execPath,[__filename,'listar',v],{maxBuffer:1<<28}).toString());
const A=correr('sin'), B=correr('con');
const de=(R,k)=>R.o.filter(t=>t[0]===k);
console.log('  sin árboles:', A.o.length, 'objetos · con árboles:', B.o.length);
probar('el juego no trae ningún árbol', de(A,'arbol').length===0);
probar('con los árboles encendidos sí hay (la prueba tiene con qué compararse)', de(B,'arbol').length>100);
const firma=(R,k)=>de(R,k).map(t=>t.join(',')).sort().join('|');
probar('las piedras caen en los mismos lugares con o sin árboles', firma(A,'roca')===firma(B,'roca'));
probar('los troncos caídos, la hoguera y los arbustos no se tocan',
       ['caido','hoguera','arbusto'].every(k=>firma(A,k)===firma(B,k)));
const quitadas=B.solidos-A.solidos, arboles=de(B,'arbol').length;
console.log('  casillas ocupadas: '+B.solidos+' con árboles · '+A.solidos+' sin ellos ('+quitadas+' menos, para '+arboles+' árboles)');
probar('donde había árboles ahora se puede caminar', quitadas>=arboles*0.95);

console.log('\n'+ok.length+' comprobaciones pasaron'+(mal.length?', '+mal.length+' FALLARON:':''));
mal.forEach(t=>console.log('  ✗ '+t)); process.exit(mal.length?1:0);

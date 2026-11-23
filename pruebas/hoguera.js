// Hoguera: que exista y que no cueste caro. (La niebla por hora se fue con el sistema de astros.)
const cargar=require('./cargar.js');
const NV=cargar();
const ok=[],mal=[]; const probar=(t,c)=>(c?ok:mal).push(t);
const w=NV.panel(0,0);

console.log('=== hoguera ===');
const h=w.trees.filter(t=>t.k==='hoguera');
const sp=w.inicio;
console.log('  hoguera en', JSON.stringify(w.hoguera), '· partida en', JSON.stringify(sp),
            '· distancia', Math.round(Math.hypot(w.hoguera.x-sp.x,w.hoguera.y-sp.y)), 'm');
let celdas=0, maxg=0;
for(let i=0;i<w.fuego.length;i++){ if(w.fuego[i]>0){celdas++; maxg=Math.max(maxg,w.fuego[i]);} }
console.log('  resplandor sobre', celdas, 'casillas · máximo', maxg.toFixed(2));
probar('hay una sola hoguera', h.length===1);
probar('está cerca del punto de partida', Math.hypot(w.hoguera.x-sp.x,w.hoguera.y-sp.y)<8);
probar('alumbra alrededor', celdas>80 && maxg>1);
probar('no se puede caminar sobre el fuego', NV.solidoEn(w.hoguera.x,w.hoguera.y));

console.log('\n=== la llama late, no parpadea al azar ===');
const vals=[]; for(let i=0;i<40;i++) vals.push(NV.titilar? NV.titilar(i*0.05):null);
if(vals[0]!==null){
  const mn=Math.min(...vals), mx=Math.max(...vals);
  console.log('  titileo entre', mn.toFixed(2), 'y', mx.toFixed(2));
  probar('el titileo es suave', mx-mn>0.15 && mx-mn<1.2);
} else console.log('  (la función vive dentro del dibujo)');

// La hoguera tiene que terminar DIBUJADA, no solo existir en los datos.
// (Se agregó tras descubrir que se añadía al mundo después de ordenar por profundidad.)
{
  const m=require('./cargar.js')('module.exports={draw_, fbG:()=>fbG, fbC:()=>fbC, tictac};');
  m.tictac(); m.draw_();
  const g=m.fbG(), c=m.fbC(); let llama=0;
  for(let i=0;i<g.length;i++){ if(!g[i]) continue; const v=c[i];
    if(((v>>16)&255)>200 && ((v>>8)&255)>100 && (v&255)<120) llama++; }
  const t=NV.panel(0,0).trees; let ord=true;
  for(let i=1;i<t.length;i++) if(t[i].y<t[i-1].y) ord=false;
  console.log('\n=== la hoguera en pantalla ===');
  console.log('  glifos de llama dibujados:', llama, '· objetos ordenados por profundidad:', ord?'sí':'no');
  probar('la hoguera llega a dibujarse', llama>0);
  probar('los objetos quedan ordenados por profundidad', ord);
}

console.log('\n'+ok.length+' comprobaciones pasaron'+(mal.length?', '+mal.length+' FALLARON:':''));
mal.forEach(m=>console.log('  ✗',m));
process.exit(mal.length?1:0);

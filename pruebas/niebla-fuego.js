// Niebla y hoguera: que existan, que cambien con la hora y que no cuesten caro.
const cargar=require('./cargar.js');
const NV=cargar();
const ok=[],mal=[]; const probar=(t,c)=>(c?ok:mal).push(t);
const w=NV.panel(0,0);
NV.actualizarCielo(Date.now());

console.log('=== niebla por hora del día (suma sobre el tercio oeste) ===');
const base=Math.floor(NV.tiempoAstro(Date.now()));
const med=h=>{let s=0,n=0;for(let y=0;y<100;y+=4)for(let x=0;x<34;x+=4){s+=NV.nieblaEn(x,y,base+h);n++;}return s/n;};
const horas=[0.04,0.17,0.29,0.5,0.71,0.85,0.97];
horas.forEach(h=>console.log('  '+String(Math.round(h*24)).padStart(2,'0')+':00 →',med(h).toFixed(3)));
probar('de madrugada hay más niebla que al mediodía', med(0.04)>med(0.5)*1.6);
/* Ya no se apaga como un interruptor: de día adelgaza pero sigue estando.
   Lo que la hace aparecer y desaparecer en un lugar son los bancos que pasan. */
probar('al mediodía adelgaza sin irse del todo', med(0.5)>0.02 && med(0.5)<med(0.04)*0.75);

console.log('\n=== la niebla carga al oeste ===');
const franja=x0=>{let s=0,n=0;for(let y=0;y<100;y+=4)for(let x=x0;x<x0+20;x+=4){s+=NV.nieblaEn(x,y,base+0.05);n++;}return s/n;};
console.log('  oeste', franja(0).toFixed(3), '· centro', franja(40).toFixed(3), '· este', franja(78).toFixed(3));
probar('hay más niebla al oeste que al este', franja(0)>franja(78)*1.5);

console.log('\n=== la niebla se mueve ===');
const a=NV.nieblaEn(12,40,base+0.05), b=NV.nieblaEn(12,40,base+0.05+0.01);
console.log('  misma casilla, 15 minutos después:', a.toFixed(3), '→', b.toFixed(3));
probar('el banco de niebla se desplaza', Math.abs(a-b)>0.02);

console.log('\n=== hoguera ===');
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

// Agua: que cada agua tenga su ola, que el mar cambie con el tiempo que hace,
// que el reflejo del sol aparezca, y que todo eso no cueste el cuadro.
const cargar=require('./cargar.js');
const m=cargar(`module.exports={
  NV:window.NV, celdaOla, estadoDelMar, draw_, tictac,
  estado:()=>({fbG,fbC,cols,rowsN,CPM,RPM}),
  irA:(x,y)=>{ me.x=x; me.y=y; NV.camXf=undefined; }
};`);
const NV=m.NV;
const ok=[],mal=[]; const probar=(t,c)=>(c?ok:mal).push(t);
m.tictac();

console.log('=== cada agua tiene su estado de ola ===');
const aguas=Object.keys(NV.MAT).filter(k=>NV.MAT[k].agua);
let faltan=[];
for(const k of aguas){
  const o=NV.MAT[k].ola;
  if(!o) faltan.push(k);
  else if(o!=='mar'&&!NV.OLAS[o]) faltan.push(k+'→'+o);
}
console.log('  materiales de agua: '+aguas.join(' ')+(faltan.length?' · sin ola: '+faltan.join(' '):' · todos con ola'));
probar('ningún agua quedó sin su estado de ola', faltan.length===0);

console.log('\n=== el mar siempre está en calma ===');
probar('el mar no tiene más estado que la calma (ya no hay tiempo que lo revuelva)', m.estadoDelMar()==='mar-calma');

console.log('\n=== la ola tiene cresta, valle y reflejo ===');
for(const est of ['tranquila','rio','mar-olas','mar-tormenta','rompiente']){
  const cuenta={};
  let brillos=0, n=0;
  for(let j=0;j<40;j++) for(let i=0;i<60;i++){
    const o=m.celdaOla(est, i*0.07, j*0.09, 2.5);
    const g=String.fromCharCode(o.g);
    cuenta[g]=(cuenta[g]||0)+1;
    /* se cuenta la espuma por el GLIFO y no por la familia: la rompiente tiene
       familia espuma de entrada, así que por familia daba 100% siempre */
    if(g==='*'||g==='#') brillos++;
    n++;
  }
  const dist=Object.entries(cuenta).sort((a,b)=>b[1]-a[1])
    .map(([g,c])=>g+':'+Math.round(100*c/n)+'%').join(' ');
  console.log('  '+est.padEnd(14)+dist+'  · rompe en '+Math.round(100*brillos/n)+'%');
  probar('el '+est+' usa más de dos glifos', Object.keys(cuenta).length>2);   // con el vacío de la muestra, el agua quieta también cuenta el espacio
  probar('el '+est+' no es todo espuma', brillos/n<0.75);
}

console.log('\n=== el agua se mueve ===');
{
  let distintas=0, n=0;
  for(let j=0;j<30;j++) for(let i=0;i<40;i++){
    const a=m.celdaOla('rio', i*0.08, j*0.1, 1.0);
    const g1=a.g;
    const b=m.celdaOla('rio', i*0.08, j*0.1, 1.5);
    if(g1!==b.g) distintas++;
    n++;
  }
  console.log('  medio segundo después cambió el '+Math.round(100*distintas/n)+'% de las celdas');
  probar('el agua cambia con el tiempo', distintas/n>0.15);
}

console.log('\n=== coste del cuadro con el mar en pantalla ===');
/* el panel del acantilado es el peor caso: el mar ocupa media pantalla */
m.irA(135,50); m.tictac(); m.draw_();
let peor=0;
for(const nom of ['en calma']){
  const t0=Date.now(); for(let i=0;i<12;i++) m.draw_();
  const ms=(Date.now()-t0)/12;
  peor=Math.max(peor,ms);
  console.log('  mar '+nom.padEnd(13)+ms.toFixed(1)+' ms');
}
probar('el cuadro con mar se arma en menos de 90 ms', peor<90);

console.log('\n'+ok.length+' comprobaciones pasaron'+(mal.length?', '+mal.length+' FALLARON:':''));
mal.forEach(t=>console.log('  ✗ '+t));
process.exit(mal.length?1:0);

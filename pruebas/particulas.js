// Partículas: hojas, polvo, chispas y luciérnagas. No guardan estado (cada una es una
// función del reloj) y cada tipo sale sólo donde corresponde. Escena inventada: el
// suelo, los árboles y el reloj los pone la prueba.
const cargar=require('./cargar.js');
const m=cargar(`module.exports={
  NV:window.NV, draw_, tictac,
  ponerYo:(x,y)=>{ me.x=x; me.y=y; NV.camXf=undefined; NV.camYf=undefined; NV.camAlz=undefined; },
  cuadro:v=>{ if(v!==undefined) frame=v; return frame; },
  quitar:()=>{ const o=dibujarParticulas; dibujarParticulas=()=>{}; return ()=>{ dibujarParticulas=o; }; },
  estado:()=>({fbG,fbC,fbL,cols,rowsN,CPM,RPM,HPM,camX,camY})
};`);
const NV=m.NV; const ok=[],mal=[]; const probar=(t,c)=>(c?ok:mal).push(t);
m.tictac();
NV.particulas=true;
const sueloReal=NV.sueloEn, objReal=NV.objetosEn, alturaReal=NV.alturaEn;
const DIA=Date.UTC(2026,4,1,21,0,0), NOCHE=Date.UTC(2026,4,1,15,0,0);   // el reloj del mundo no es el de la pared: a las 21 UTC es mediodía
const relojReal=Date.now; let AHORA=1000000;
Date.now=()=>AHORA;
NV.fuegoEn=()=>0; NV.calorCerca=()=>false; NV.calorEn=()=>0; NV.nieblaEn=()=>0; NV.alturaEn=()=>0;

/* una escena: suelo parejo y los objetos que se pidan; devuelve las casillas que SÓLO existen
   porque hay partículas (el mismo cuadro con y sin ellas, restado) */
function particulas(suelo,objetos,ahora,hora,estacion,viento){
  NV.actualizarCielo(hora); if(estacion) NV.cielo.estacion=estacion;
  NV.vientoFactor=viento===undefined?1:viento;
  NV.sueloEn=()=>suelo; NV.objetosEn=()=>objetos;
  AHORA=ahora;
  m.ponerYo(40,60); m.draw_(); m.draw_();                 // el viento se mide en el cuadro anterior
  /* el contador de cuadros mueve el pasto: se fija para que las dos tomas difieran sólo en las partículas */
  m.cuadro(500); m.draw_();
  const con=m.estado(); const gc=con.fbG.slice(), cc=con.fbC.slice();
  const volver=m.quitar(); m.cuadro(500); m.draw_(); volver();
  const sin=m.estado(); const dif=[];
  for(let i=0;i<gc.length;i++) if(gc[i]!==sin.fbG[i]||cc[i]!==sin.fbC[i]) dif.push({r:Math.floor(i/con.cols),c:i%con.cols,g:gc[i],col:cc[i]});
  return {dif,E:con};
}
const rojo=c=>(c>>16)&255, verde=c=>(c>>8)&255, azul=c=>c&255;

console.log('=== chispas ===');
const hoguera=[{x:44,y:60,h:0.9,k:'hoguera',s:4242}];
const f1=particulas('d',hoguera,1000000,DIA);
const E=f1.E, baseFila=(60-E.camY)*E.RPM+E.RPM-1, colFuego=(44-E.camX)*E.CPM+E.CPM/2;
const arriba=f1.dif.map(d=>baseFila-d.r);
console.log(`  ${f1.dif.length} casillas de chispa; suben hasta ${Math.max(...arriba)} filas sobre el pie (3,6 m = ${Math.round(3.6*E.HPM)})`);
probar('una hoguera suelta chispas', f1.dif.length>=8);
probar('las chispas son cálidas (más rojo que azul)', f1.dif.every(d=>rojo(d.col)>azul(d.col)*1.5));
probar('no suben más de 3,6 m', Math.max(...arriba)<=Math.round(3.6*E.HPM)+2);
probar('se quedan cerca de la hoguera (a menos de 2 m de lado)', f1.dif.every(d=>Math.abs(d.c-colFuego)<=2*E.CPM));
const f2=particulas('d',hoguera,1000000+370,DIA);
const clave=a=>a.map(d=>d.r+','+d.c).sort().join('|');
probar('van cambiando con el tiempo', clave(f1.dif)!==clave(f2.dif));
const f3=particulas('d',hoguera,1000000,DIA);
probar('sin estado: el mismo instante da las mismas casillas', clave(f1.dif)===clave(f3.dif));
probar('sin hoguera no hay chispas', particulas('d',[],1000000,DIA).dif.length===0);

console.log('\n=== hojas ===');
const arboles=[0,1,2,3,4,5].map(i=>({x:34+i*2,y:60+(i%2),h:6,k:'arbol',sp:'encino',s:1000+i}));
const cuenta=(est,viento)=>{ let n=0; for(let t=0;t<8;t++) n+=particulas('g',arboles,1000000+t*700,DIA,est,viento).dif.length; return n; };
const otoño=cuenta('otoño'), primavera=cuenta('primavera'), invierno=cuenta('invierno');
console.log(`  casillas de hoja en ocho instantes: otoño ${otoño} · primavera ${primavera} · invierno ${invierno}`);
probar('en otoño caen muchas más hojas que en primavera (≥ 3 veces)', otoño>=primavera*3&&otoño>20);
probar('en otoño las hojas son del color de la hoja seca (más rojo que azul)', particulas('g',arboles,1000000,DIA,'otoño').dif.every(d=>rojo(d.col)>=azul(d.col)));
probar('sin árboles no hay hojas', particulas('g',[],1000000,DIA,'otoño').dif.length===0);
const pinos=arboles.map(a=>({...a,sp:'pino'}));
probar('los pinos no sueltan hoja', particulas('g',pinos,1000000,DIA,'otoño').dif.length===0);

console.log('\n=== polvo ===');
const polvo=v=>{ let n=0; for(let t=0;t<8;t++) n+=particulas('D',[],1000000+t*900,DIA,'verano',v).dif.length; return n; };
const calmo=polvo(0.2), racheado=polvo(3);
console.log(`  casillas de polvo en ocho instantes: viento calmo ${calmo} · racheado ${racheado}`);
probar('con el viento calmo no hay polvo', calmo===0);
probar('con viento racheado hay polvo sobre la arena', racheado>20);
let enPasto=0; for(let t=0;t<8;t++) enPasto+=particulas('g',[],1000000+t*900,DIA,'verano',3).dif.length;
probar('sobre el pasto no se levanta polvo', enPasto===0);

console.log('\n=== luciérnagas ===');
const luciernagas=(hora,suelo)=>{ let n=0; for(let t=0;t<8;t++) n+=particulas(suelo,[],1000000+t*900,hora,'verano',0.3).dif.length; return n; };
const deNoche=luciernagas(NOCHE,'g'), deDia=luciernagas(DIA,'g'), enArena=luciernagas(NOCHE,'D');
console.log(`  casillas en ocho instantes: noche sobre pasto ${deNoche} · día ${deDia} · noche sobre arena ${enArena}`);
probar('de noche, sobre pasto, hay luciérnagas', deNoche>10);
probar('de día no hay luciérnagas', deDia===0);
probar('en la arena no hay luciérnagas', enArena===0);

NV.sueloEn=sueloReal; NV.objetosEn=objReal; NV.alturaEn=alturaReal; Date.now=relojReal;
console.log('\n'+ok.length+' comprobaciones pasaron'+(mal.length?', '+mal.length+' FALLARON:':''));
for(const t of mal) console.log('  ✗ '+t);
process.exit(mal.length?1:0);

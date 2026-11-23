// Mesetas y paredes: tierra alta de bordes marcados. Un borde es pared (se ve como roca
// estratificada y no se pisa) o rampa (se sube caminando), según un ruido que cambia a
// lo largo del borde. Se comprueba el campo en el mundo real y el dibujo en una escena
// inventada.
const cargar=require('./cargar.js');
const m=cargar(`module.exports={
  NV:window.NV, draw_, tictac,
  ponerYo:(x,y)=>{ me.x=x; me.y=y; NV.camXf=undefined; NV.camYf=undefined; NV.camAlz=undefined; },
  estado:()=>({fbG,fbC,fbL,cols,rowsN,CPM,RPM,HPM,camX,camY})
};`);
const NV=m.NV; const ok=[],mal=[]; const probar=(t,c)=>(c?ok:mal).push(t);
m.tictac(); NV.actualizarCielo(Date.UTC(2026,4,1,12,0,0));
NV.fuegoEn=()=>0; NV.calorCerca=()=>false; NV.calorEn=()=>0; NV.nieblaEn=()=>0;
const alturaReal=NV.alturaEn, sueloReal=NV.sueloEn, objReal=NV.objetosEn, solidoReal=NV.solidoEn;
const MES=NV.ALTURA.meseta;

console.log('=== las mesetas en el mundo ===');
let n=0, altos=0, enClaro=0, claroN=0, paredes=0, paredesSuaves=0, solidoSinPared=0;
for(let y=-95;y<195;y+=3) for(let x=-95;x<195;x+=3){
  n++; const h=alturaReal(x+0.5,y+0.5); if(h>MES.alto*0.8) altos++;
  if(Math.max(Math.abs(x-50),Math.abs(y-50))<55){ claroN++; if(NV.mesetaEn(x,y)>0.01) enClaro++; }
  if(NV.paredEn(x,y)){ paredes++;
    let d=0; for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) d=Math.max(d,Math.abs(alturaReal(x+dx+0.5,y+dy+0.5)-h));
    if(d<=MES.pared) paredesSuaves++;
    if(!NV.solidoEn(x,y)) solidoSinPared++; } }
console.log(`  ${(altos/n*100).toFixed(1)} % del mundo es meseta alta · ${paredes} metros de pared muestreados · en el claro del centro: ${enClaro} de ${claroN}`);
probar('hay mesetas, pero no cubren el mundo (entre 3 y 25 %)', altos/n>0.03&&altos/n<0.25);
probar('el claro del centro no tiene meseta', enClaro===0);
probar('hay paredes', paredes>20);
probar('toda pared tiene un vecino a más de '+MES.pared+' m de desnivel', paredesSuaves===0);
probar('una pared es sólida: no se pisa', solidoSinPared===0);

/* una meseta no es una isla: desde la mayoría se baja caminando */
const pts=[]; for(let y=-95;y<195;y+=10) for(let x=-95;x<195;x+=10) if(alturaReal(x+0.5,y+0.5)>MES.alto*0.8&&!NV.solidoEn(x,y)) pts.push([x,y]);
let baja=0; for(const [x0,y0] of pts){ const vistos=new Set([x0+','+y0]), q=[[x0,y0]]; let llega=false;
  for(let i=0;i<q.length&&i<6000;i++){ const [x,y]=q[i]; if(alturaReal(x+0.5,y+0.5)<0.5){ llega=true; break; }
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ const a=x+dx,b=y+dy,k=a+','+b; if(vistos.has(k)) continue; vistos.add(k);
      if(!sueloReal(a,b)||NV.solidoEn(a,b)) continue; q.push([a,b]); } }
  if(llega) baja++; }
console.log(`  puntos de meseta muestreados: ${pts.length}; desde ${baja} se baja caminando (${Math.round(baja/Math.max(1,pts.length)*100)} %)`);
probar('desde al menos la mitad de la meseta se baja caminando', pts.length>20&&baja/pts.length>=0.5);

console.log('\n=== la pared dibujada ===');
const paso=t=>t<=0?0:t>=1?1:t*t*(3-2*t);
const COL=44, FIL=60;
function cuadro(f){
  NV.alturaEn=f; NV.sueloEn=()=>'D'; NV.objetosEn=()=>[]; NV.solidoEn=()=>false;
  m.ponerYo(37,FIL-6); m.draw_();
  const E=m.estado(); const g=E.fbG.slice(); return {E,g};
}
const contar=(g,set)=>{ let k=0; for(let i=0;i<g.length;i++) if(g[i]&&set.includes(String.fromCharCode(g[i]))) k++; return k; };
const ROCA=['^','A','M'];                               // glifos de la roca madre que no tiene la duna
/* la cámara mira al norte: sólo se ve la cara que mira al SUR, es decir, donde el terreno BAJA hacia el sur */
const pared=cuadro((x,y)=>5*(1-paso((y-FIL)/1.2)));    // 5 m que bajan en poco más de un metro
const rampa=cuadro((x,y)=>5*(1-paso((y-(FIL-12))/24)));// 5 m repartidos en 24
const llano=cuadro(()=>0);
const rp=contar(pared.g,ROCA), rr=contar(rampa.g,ROCA), rl=contar(llano.g,ROCA);
console.log(`  casillas de roca (^ A M): pared ${rp} · rampa ${rr} · llano ${rl}`);
probar('una pared se dibuja como roca', rp>300);
probar('una rampa suave no se dibuja como roca: sigue siendo suelo', rr<rp*0.05);
probar('un llano no tiene roca (salvo algún destello suelto)', rl<=3);
/* estratos a altura absoluta: lo de al lado, a la misma altura, se parece más que lo de arriba o abajo */
{ const E=pared.E; const lum=i=>{ const c=E.fbC[i]; return ((c>>16)&255)+((c>>8)&255)+(c&255); };
  const roca=i=>pared.g[i]&&ROCA.includes(String.fromCharCode(pared.g[i]));
  let h=0,hn=0,v=0,vn=0;
  for(let r=1;r<E.rowsN-1;r++) for(let c=1;c<E.cols-1;c++){ const i=r*E.cols+c; if(!roca(i)) continue;
    if(roca(i+1)){ h+=Math.abs(lum(i)-lum(i+1)); hn++; } if(roca(i+E.cols)){ v+=Math.abs(lum(i)-lum(i+E.cols)); vn++; } }
  console.log(`  diferencia de tono entre vecinas: en horizontal ${(h/hn).toFixed(1)} · en vertical ${(v/vn).toFixed(1)}`);
  probar('la cara tiene bandas: en horizontal las vecinas se parecen más que en vertical', hn>500&&vn>500&&h/hn<0.8*(v/vn)); }

NV.alturaEn=alturaReal; NV.sueloEn=sueloReal; NV.objetosEn=objReal; NV.solidoEn=solidoReal;
console.log('\n'+ok.length+' comprobaciones pasaron'+(mal.length?', '+mal.length+' FALLARON:':''));
for(const t of mal) console.log('  ✗ '+t);
process.exit(mal.length?1:0);

// La altura del terreno, etapa 1: se DIBUJA, todavía no se camina.
//
// Cada metro se dibuja desplazado hacia arriba según su altura. Lo que se prueba:
// que el campo de altura sea sano (nunca negativo, sin escalones, plano en el agua),
// que lo que está sobre una loma suba con ella, que no queden huecos donde el terreno
// baja hacia el sur, que una loma tape lo que queda detrás, y que la vista siga al
// jugador cuando sube. La escena es sintética: no depende del mundo generado.
const cargar=require('./cargar.js');
const m=cargar(`module.exports={
  NV:window.NV, draw_, tictac,
  ponerYo:(x,y)=>{ me.x=x; me.y=y; NV.camXf=undefined; NV.camYf=undefined; NV.camAlz=undefined; },
  estado:()=>({fbG,fbC,fbL,cols,rowsN,CPM,RPM,HPM,camX,camY,vista:NV.camAlz})
};`);
const NV=m.NV;
const ok=[],mal=[]; const probar=(t,c)=>(c?ok:mal).push(t);
m.tictac(); NV.actualizarCielo(Date.UTC(2026,4,1,12,0,0));
NV.fuegoEn=()=>0; NV.calorCerca=()=>false; NV.calorEn=()=>0; NV.nieblaEn=()=>0;
const alturaReal=NV.alturaEn, sueloReal=NV.sueloEn, objReal=NV.objetosEn;

console.log('=== el campo de altura ===');
let mn=9,mx=0,salto=0,n=0,planoAgua=0,aguaN=0;
for(let x=-95;x<195;x+=2.3) for(let y=-95;y<195;y+=2.9){
  const h=alturaReal(x,y); mn=Math.min(mn,h); mx=Math.max(mx,h); n++;
  salto=Math.max(salto,Math.abs(alturaReal(x+0.25,y)-h),Math.abs(alturaReal(x,y+0.25)-h));
  const t=sueloReal(Math.floor(x),Math.floor(y));
  if(t&&NV.MAT[t]&&NV.MAT[t].ola){ aguaN++; if(h<1e-9) planoAgua++; }
}
console.log(`  ${n} puntos · altura de ${mn.toFixed(2)} a ${mx.toFixed(2)} m · salto mayor en 25 cm: ${salto.toFixed(3)} m · agua: ${planoAgua} de ${aguaN} planos`);
probar('la altura nunca es negativa', mn>=0);
probar('hay lomas que se notan (más de 1 m) y no pasan del tope declarado', mx>1&&mx<=NV.ALTURA.max+1e-9);
probar('sin escalones: en 25 cm la altura no salta más de 8 cm', salto<0.08);
probar('el agua está siempre al nivel cero', aguaN>50&&planoAgua===aguaN);
probar('la altura es la misma en cada llamada (no depende del azar ni del reloj)', alturaReal(33.3,71.7)===alturaReal(33.3,71.7));

console.log('\n=== una loma dibujada ===');
const COL=44, FIL=60, R=2.5;
const loma=(x,y)=>2.0*Math.exp(-((x-COL)*(x-COL)+(y-FIL)*(y-FIL))/(2*R*R));
let relieve=loma;
function cuadro(conLoma,yo,arboles){
  NV.alturaEn=conLoma?relieve:()=>0;
  NV.sueloEn=()=>'D';
  NV.objetosEn=()=>arboles||[];
  m.ponerYo(yo[0],yo[1]); m.draw_();
  const E=m.estado();           // los buffers se reusan en cada cuadro: se copian
  return Object.assign({},E,{fbG:E.fbG.slice(),fbC:E.fbC.slice(),fbL:E.fbL.slice()});
}
const filas=(E,capa)=>{ let a=[]; for(let r=0;r<E.rowsN;r++){ let k=0; for(let c=0;c<E.cols;c++){ const i=r*E.cols+c; if(E.fbG[i]&&(capa===undefined||E.fbL[i]===capa)) k++; } a.push(k); } return a; };
const encino={x:COL,y:FIL,h:4.5,k:'arbol',sp:'encino',s:424242};

/* un árbol en la cima sube lo que sube la loma; el jugador está lejos, en el llano */
const llano=cuadro(false,[37,60],[encino]), cima=cuadro(true,[37,60],[encino]);
const techo=E=>{ const f=filas(E,2); return f.findIndex(v=>v>0); };
const sube=techo(llano)-techo(cima), esperado=Math.round(loma(COL+0.5,FIL+0.5)*llano.HPM);
console.log(`  el encino de la cima sube ${sube} filas; la loma ahí mide ${loma(COL+0.5,FIL+0.5).toFixed(2)} m = ${esperado} filas`);
probar('un árbol en la cima sube lo que sube la loma (±1 fila)', Math.abs(sube-esperado)<=1&&esperado>8);

/* sin huecos: el suelo es denso, y la ladera que baja al sur se rellena */
const llenos=E=>filas(E,0).reduce((a,b)=>a+b,0);
const dens=llenos(cima)/llenos(llano);
console.log(`  casillas de suelo: ${llenos(llano)} en el llano, ${llenos(cima)} con la loma (${(dens*100).toFixed(0)} %)`);
probar('con la loma el suelo no pierde casillas (hay cara de pendiente, no hueco): ≥ 97 %', dens>=0.97);

/* la loma tapa lo que queda detrás: un árbol al norte, justo detrás de la cresta */
/* un escalón: del llano a 2 m en dos metros de ladera, a lo ancho de toda la vista */
const paso=t=>t<=0?0:t>=1?1:t*t*(3-2*t);
relieve=(x,y)=>2.0*paso((y-(FIL-1))/2);
const detras={x:COL,y:FIL-1,h:3,k:'arbol',sp:'encino',s:777};
const a=cuadro(false,[37,52],[detras]), b=cuadro(true,[37,52],[detras]);
const vis=E=>filas(E,2).reduce((x,y)=>x+y,0);
console.log(`  árbol detrás de la loma: ${vis(a)} casillas visibles en el llano, ${vis(b)} con la loma`);
probar('un árbol detrás del escalón queda tapado en parte (menos del 93 % visible)', vis(b)<vis(a)*0.93);
const lejos={x:COL,y:FIL-16,h:3,k:'arbol',sp:'encino',s:777};
const c1=cuadro(false,[37,52],[lejos]), c2=cuadro(true,[37,52],[lejos]);
relieve=loma;
probar('un árbol lejos del escalón se ve igual con y sin él', vis(c1)===vis(c2));

console.log('\n=== la vista sigue al jugador ===');
const sobre=cuadro(true,[COL,FIL],[]);
const lift=Math.round(sobre.vista), subeJ=Math.round(loma(COL+0.5,FIL+0.5)*sobre.HPM);
console.log(`  jugador en la cima: la vista baja ${lift} filas (la loma sube ${subeJ})`);
probar('en la cima la vista baja lo que sube la loma, para que el jugador no se vaya hacia arriba', Math.abs(lift-subeJ)<=1&&subeJ>8);
const abajo=cuadro(true,[30,60],[]);
probar('en el llano la vista no se mueve (menos de media fila)', abajo.vista<0.5);

console.log('\n=== tocar la pantalla ===');
/* con la loma dibujada y el jugador en la cima, tocar el centro de un metro tiene que
   dar ese metro, no el que saldría en el llano */
/* la altura real se interpola entre metros enteros; la loma de la prueba también */
const bil=(x,y)=>{ const x0=Math.floor(x), y0=Math.floor(y), u=x-x0, v=y-y0;
  return (loma(x0,y0)*(1-u)+loma(x0+1,y0)*u)*(1-v)+(loma(x0,y0+1)*(1-u)+loma(x0+1,y0+1)*u)*v; };
relieve=bil; cuadro(true,[COL,FIL],[]);
let mal2=0, pruebas2=0, peor='';
/* sólo metros que se ven enteros: en la ladera que sube hacia el sur, el metro de al sur tapa
   el centro del de al norte, y tocar ahí es tocar al que se ve (se comprueba aparte) */
for(const [x,y] of [[COL,FIL],[COL-3,FIL],[COL+3,FIL+2],[COL-2,FIL+1],[COL+2,FIL+4],[COL,FIL+3]]){
  const base=m.estado();
  const alza=Math.round(bil(x+0.5,y+0.5)*base.HPM);
  const fil=Math.floor((y-base.camY)*base.RPM+base.RPM/2-alza+Math.round(NV.camAlz));
  const col=Math.floor((x-base.camX)*base.CPM+base.CPM/2);
  const q=NV.casillaEn(col,fil); pruebas2++;
  if(q.x!==x||q.y!==y){ mal2++; peor+=` (${x},${y})→(${q.x},${q.y})`; }
}
console.log('  metros tocados al centro: '+pruebas2+', errados: '+mal2+peor);
probar('tocar el centro de un metro sobre la loma da ese metro', mal2===0);
{ const base=m.estado(), y=FIL-3, alza=Math.round(bil(COL+0.5,y+0.5)*base.HPM);
  const fil=Math.floor((y-base.camY)*base.RPM+base.RPM/2-alza+Math.round(NV.camAlz));
  const q=NV.casillaEn(Math.floor((COL-base.camX)*base.CPM+base.CPM/2),fil);
  probar('en la ladera que sube al sur, tocar donde tapa el metro de al sur da ese metro de al sur', q.y>=y&&q.y<=y+3); }
NV.alturaEn=alturaReal; NV.sueloEn=sueloReal; NV.objetosEn=objReal;

console.log('\n'+ok.length+' comprobaciones pasaron'+(mal.length?', '+mal.length+' FALLARON:':''));
for(const t of mal) console.log('  ✗ '+t);
process.exit(mal.length?1:0);

// El detalle suelto del suelo: flores, guijarros y hojarasca.
//
// El pasto era sólo briznas: un prado parejo de verde sin nada que mirar de
// cerca. Ahora lleva flores, guijarros y hojarasca, y lo que se mide acá es lo
// que podía salir mal: que no cambie con el zoom (la densidad es por metro
// cuadrado), que salga en MANCHAS y no esparcido parejo, que no pise la orilla
// ni el agua, que no parpadee, y que de noche se apague con el resto.
const cargar=require('./cargar.js');
const m=cargar(`module.exports={
  NV:window.NV, draw_, tictac,
  ponerYo:(x,y)=>{ me.x=x; me.y=y; NV.camXf=undefined; NV.camYf=undefined; },
  estado:()=>({fbG,fbC,fbL,cols,rowsN,CPM,RPM,camX,camY})
};`);
const NV=m.NV, ok=[],mal=[]; const probar=(t,c)=>(c?ok:mal).push(t);
m.tictac();
NV.fuegoEn=()=>0; NV.calorCerca=()=>false; NV.calorEn=()=>0;
NV.objetosEn=()=>[];
NV.alturaEn=()=>0;     // estas pruebas miden otra cosa sobre un suelo plano: la altura tiene su propia prueba (altura.js)
/* el pasto es sólo I con flores blancas: del detalle suelto queda la flor ('+'); los guijarros y la
   hojarasca ya no se dibujan en el pasto */
const GLIFO={flor:43};      // '+'

/* dibuja y devuelve las celdas de cada detalle, con su metro y su color */
function cuadro(suelo,cx,cy,zoom){
  NV.sueloEn=suelo;
  NV.zoomAbsoluto(zoom||NV.ZOOM.ini); while(NV.acercarZoom()){}
  m.ponerYo(cx,cy); m.draw_();
  const E=m.estado(), det={flor:[]};
  for(let r=0;r<E.rowsN;r++) for(let c=0;c<E.cols;c++){
    const i=r*E.cols+c; if(!E.fbG[i]||E.fbL[i]!==0) continue;
    for(const k in GLIFO) if(E.fbG[i]===GLIFO[k])
      det[k].push({mx:E.camX+Math.floor(c/E.CPM), my:E.camY+Math.floor(r/E.RPM), col:E.fbC[i], c, r});
  }
  const AN=Math.floor(E.cols/E.CPM), AL=Math.floor(E.rowsN/E.RPM);
  return {det,E,AN,AL,area:AN*AL};
}
const lum=c=>((c>>16)&255)*0.3+((c>>8)&255)*0.59+(c&255)*0.11;
const dispersion=(lista,E,AN,AL)=>{                    // varianza sobre media del conteo por metro
  const por=new Map(); for(const d of lista){ const k=d.mx+','+d.my; por.set(k,(por.get(k)||0)+1); }
  const v=[]; for(let j=1;j<AL-1;j++) for(let i=0;i<AN;i++) v.push(por.get((E.camX+i)+','+(E.camY+j))||0);
  const media=v.reduce((a,b)=>a+b,0)/v.length, va=v.reduce((a,b)=>a+(b-media)**2,0)/v.length;
  return {media, indice:media>0?va/media:0};
};

console.log('=== hay detalle en el pasto ===');
const g=cuadro(()=>'g',120,90);                         // todo pasto corto
for(const k in g.det) console.log('  '+k.padEnd(10)+g.det[k].length+' celdas en '+g.area+' m²  →  '+(g.det[k].length/g.area).toFixed(2)+' por m²');
probar('hay flores en el pasto', g.det.flor.length>10);
probar('no es una alfombra: menos de 12 detalles por m² en total', g.det.flor.length/g.area<12);

console.log('\n=== salen en manchas, no parejo ===');
/* Se compara contra lo mismo REPARTIDO AL AZAR: las mismas cuentas, tiradas en
   metros cualquiera del mismo cuadro. Al azar el índice ronda 1; en manchas, mucho más. */
let sem=12345; const azar=()=>{ sem=(Math.imul(sem,1103515245)+12345)&0x7fffffff; return sem/0x7fffffff; };
const barajado=(lista,E,AN,AL)=>lista.map(()=>({mx:E.camX+Math.floor(azar()*AN), my:E.camY+1+Math.floor(azar()*(AL-2))}));
const par=(lista)=>{ const a=dispersion(lista,g.E,g.AN,g.AL), b=dispersion(barajado(lista,g.E,g.AN,g.AL),g.E,g.AN,g.AL); return {a,b}; };
const pFl=par(g.det.flor);
console.log('  índice de dispersión por metro (1 = al azar), real contra la misma cantidad repartida al azar:');
probar('las flores salen en manchas (el doble o más que al azar)', pFl.a.indice>=2*pFl.b.indice && pFl.a.indice>2);
/* una mancha es de un solo color: dentro de un metro, las flores no mezclan familias */
const colPorM=new Map(); for(const d of g.det.flor){ const k=d.mx+','+d.my; (colPorM.get(k)||colPorM.set(k,[]).get(k)).push(d.col); }
const luzDe=c=>((c>>16)&255)-((c&255));     // rojo menos azul: separa lo rosado de lo ocre
let mezcla=0,metrosF=0; for(const [,cs] of colPorM){ if(cs.length<2) continue; metrosF++;
  const rb=cs.map(luzDe); if(Math.max(...rb)>0&&Math.min(...rb)<-5&&Math.max(...rb)-Math.min(...rb)>60) mezcla++; }
console.log('  metros con 2 o más flores: '+metrosF+' · con dos colores muy distintos: '+mezcla);
probar('cada mancha de flores es de un color, no un confeti', metrosF>5&&mezcla/metrosF<0.2);

console.log('\n=== no cambia con el zoom ===');
/* Misma zona del mundo a los dos extremos del zoom: sólo se cuentan los metros
   que se ven en los dos cuadros, y en cuatro puntos distintos para tener cuenta. */
const tot={cerca:{flor:0},lejos:{flor:0}}; let metrosComunes=0;
for(const [cx,cy] of [[120,90],[40,50],[150,40],[70,140]]){
  const a=cuadro(()=>'g',cx,cy,NV.ZOOM.cerca), b=cuadro(()=>'g',cx,cy,NV.ZOOM.lejos);
  const ax0=a.E.camX, ax1=a.E.camX+a.AN, ay0=a.E.camY+1, ay1=a.E.camY+a.AL-1;
  const bx0=b.E.camX, bx1=b.E.camX+b.AN, by0=b.E.camY+1, by1=b.E.camY+b.AL-1;
  const x0=Math.max(ax0,bx0), x1=Math.min(ax1,bx1), y0=Math.max(ay0,by0), y1=Math.min(ay1,by1);
  metrosComunes+=(x1-x0)*(y1-y0);
  for(const k in tot.cerca){
    tot.cerca[k]+=a.det[k].filter(d=>d.mx>=x0&&d.mx<x1&&d.my>=y0&&d.my<y1).length;
    tot.lejos[k]+=b.det[k].filter(d=>d.mx>=x0&&d.mx<x1&&d.my>=y0&&d.my<y1).length;
  }
}
for(const k in tot.cerca) console.log('  '+k.padEnd(10)+'cerca '+(tot.cerca[k]/metrosComunes).toFixed(2)+' por m² · lejos '+(tot.lejos[k]/metrosComunes).toFixed(2)+' por m²');
console.log('  ('+metrosComunes+' m² vistos en los dos zooms)');
const r=(k)=>tot.cerca[k]/Math.max(1,tot.lejos[k]);
probar('en los mismos metros hay la misma cantidad de detalle cerca y lejos (±30 %)',
       ['flor'].every(k=>tot.lejos[k]>30&&r(k)>0.7&&r(k)<1.43));

console.log('\n=== no pisa la orilla ni el agua ===');
const Y0=90;
const costa=cuadro((x,y)=>y>Y0?'a':'g',120,Y0-4);
/* el agua empieza en la fila Y0+1: el metro Y0 es pasto pero toca agua (no lleva detalle) */
let enAgua=0,pegadas=0,todas=0,aDosMetros=0;
for(const k in costa.det) for(const d of costa.det[k]){ todas++; if(d.my>Y0) enAgua++; else if(d.my===Y0) pegadas++; else if(d.my===Y0-1) aDosMetros++; }
console.log('  detalles en el cuadro: '+todas+' · en metros de agua: '+enAgua+' · en el metro que toca el agua: '+pegadas
            +' · en el metro de al lado (sí permitido): '+aDosMetros);
probar('hay detalle en la parte de tierra del cuadro, incluido el metro vecino al de la orilla', todas>30&&aDosMetros>0);
probar('ninguno cae en el agua ni en el metro pegado a la orilla', enAgua===0&&pegadas===0);
const arena=cuadro(()=>'s',120,90);
probar('la arena no lleva detalle de pasto', arena.det.flor.length===0);

console.log('\n=== queda quieto ===');
/* el reloj quieto: si el cuadro tarda, el motor baja la calidad y el segundo cuadro sale distinto sin que sea un parpadeo */
const _perf=global.performance; global.performance={now:()=>0};
const g1=cuadro(()=>'g',120,90), g2=cuadro(()=>'g',120,90);
global.performance=_perf;
const clave=l=>l.map(d=>d.c+':'+d.r).join('|');
probar('mismo cuadro, mismos detalles (no parpadea)', clave(g1.det.flor)===clave(g2.det.flor));

console.log('\n=== lo que cuesta ===');
/* Se mide el MEJOR de 14 cuadros, primero todos con detalle y luego todos sin él
   (alternar los desoptimiza): el reloj de una máquina ocupada ensucia la mediana,
   pero nunca hace un cuadro más rápido de lo que es. */
const mejor=(f)=>{ const a=process.hrtime.bigint(); f(); return Number(process.hrtime.bigint()-a)/1e6; };
NV.sueloEn=()=>'g'; m.ponerYo(120,90); m.draw_();
const MAT=NV.MAT||null;
let con=1e9, sinDet=null;
if(MAT&&MAT.g){ const o=MAT.g.detalle; sinDet=1e9;
  for(let i=0;i<14;i++) con=Math.min(con,mejor(()=>m.draw_()));
  MAT.g.detalle=null; for(let i=0;i<14;i++) sinDet=Math.min(sinDet,mejor(()=>m.draw_())); MAT.g.detalle=o; }
if(sinDet!==null) console.log('  un cuadro de pasto: '+con.toFixed(1)+' ms con detalle · '+sinDet.toFixed(1)+' ms sin detalle');
/* un cuadro todo de pasto es el peor caso (el detalle sólo va en pasto): con la medición del
   mejor cuadro cuesta alrededor de un 45 %; el tope vigila que no se dispare. */
/* tope 2,0 y no 1,7: al zoom estándar (28 m, 13 celdas por metro) hay menos briznas por metro
   y el detalle, que va por metro cuadrado, pesa más en proporción */
/* tope 3,5 y no 2,0: el pasto es ahora ralo (pocas briznas largas), así que el cuadro sin detalle
   cuesta mucho menos y el mismo detalle pesa más en proporción aunque cueste menos en total */
probar('el detalle no encarece un cuadro todo de pasto más de tres veces y media', sinDet===null || con<sinDet*3.5);

console.log('\n'+ok.length+' comprobaciones pasaron'+(mal.length?', '+mal.length+' FALLARON:':''));
mal.forEach(t=>console.log('  ✗ '+t)); process.exit(mal.length?1:0);

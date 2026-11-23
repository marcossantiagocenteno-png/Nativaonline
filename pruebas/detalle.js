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
const DIA=Date.UTC(2026,4,1,0,0,0)+4*30*86400e3/430/8, NOCHE=Date.UTC(2026,4,1,0,0,0);
m.tictac(); NV.actualizarCielo(DIA);
NV.fuegoEn=()=>0; NV.calorCerca=()=>false; NV.calorEn=()=>0; NV.nieblaEn=()=>0;
NV.objetosEn=()=>[];
const GLIFO={flor:43, guijarro:111, hojarasca:44};      // '+', 'o', ','

/* dibuja y devuelve las celdas de cada detalle, con su metro y su color */
function cuadro(suelo,cx,cy,zoom){
  NV.sueloEn=suelo;
  NV.zoomAbsoluto(zoom||NV.ZOOM.ini); while(NV.acercarZoom()){}
  m.ponerYo(cx,cy); m.draw_();
  const E=m.estado(), det={flor:[],guijarro:[],hojarasca:[]};
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
probar('hay flores, guijarros y hojarasca en el pasto corto', g.det.flor.length>10&&g.det.guijarro.length>10&&g.det.hojarasca.length>20);
probar('no es una alfombra: menos de 12 detalles por m² en total', (g.det.flor.length+g.det.guijarro.length+g.det.hojarasca.length)/g.area<12);

console.log('\n=== salen en manchas, no parejo ===');
/* Se compara contra lo mismo REPARTIDO AL AZAR: las mismas cuentas, tiradas en
   metros cualquiera del mismo cuadro. Al azar el índice ronda 1; en manchas, mucho más. */
let sem=12345; const azar=()=>{ sem=(Math.imul(sem,1103515245)+12345)&0x7fffffff; return sem/0x7fffffff; };
const barajado=(lista,E,AN,AL)=>lista.map(()=>({mx:E.camX+Math.floor(azar()*AN), my:E.camY+1+Math.floor(azar()*(AL-2))}));
const par=(lista)=>{ const a=dispersion(lista,g.E,g.AN,g.AL), b=dispersion(barajado(lista,g.E,g.AN,g.AL),g.E,g.AN,g.AL); return {a,b}; };
const pFl=par(g.det.flor), pGu=par(g.det.guijarro), pHo=par(g.det.hojarasca);
console.log('  índice de dispersión por metro (1 = al azar), real contra la misma cantidad repartida al azar:');
console.log('    flores '+pFl.a.indice.toFixed(1)+' contra '+pFl.b.indice.toFixed(1)
          +' · guijarros '+pGu.a.indice.toFixed(1)+' contra '+pGu.b.indice.toFixed(1)
          +' · hojarasca '+pHo.a.indice.toFixed(1)+' contra '+pHo.b.indice.toFixed(1));
probar('las flores salen en manchas (el doble o más que al azar)', pFl.a.indice>=2*pFl.b.indice && pFl.a.indice>2);
probar('los guijarros y la hojarasca también', pGu.a.indice>=2*pGu.b.indice&&pHo.a.indice>=2*pHo.b.indice&&pGu.a.indice>2&&pHo.a.indice>2);
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
const tot={cerca:{flor:0,guijarro:0,hojarasca:0},lejos:{flor:0,guijarro:0,hojarasca:0}}; let metrosComunes=0;
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
       ['flor','guijarro','hojarasca'].every(k=>tot.lejos[k]>30&&r(k)>0.7&&r(k)<1.43));

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
probar('la arena no lleva detalle de pasto', arena.det.flor.length+arena.det.guijarro.length+arena.det.hojarasca.length===0);

console.log('\n=== queda quieto y se apaga de noche ===');
const g1=cuadro(()=>'g',120,90), g2=cuadro(()=>'g',120,90);
const clave=l=>l.map(d=>d.c+':'+d.r).join('|');
probar('mismo cuadro, mismos detalles (no parpadea)', clave(g1.det.flor)===clave(g2.det.flor)&&clave(g1.det.guijarro)===clave(g2.det.guijarro));
const dia=g1.det.flor.reduce((a,d)=>a+lum(d.col),0)/g1.det.flor.length;
NV.actualizarCielo(NOCHE);
const n1=cuadro(()=>'g',120,90);
const noche=n1.det.flor.reduce((a,d)=>a+lum(d.col),0)/Math.max(1,n1.det.flor.length);
console.log('  luminosidad de una flor: de día '+dia.toFixed(0)+' · de noche '+noche.toFixed(0));
probar('de noche las flores se ven más oscuras que de día', n1.det.flor.length>10&&noche<dia*0.6);
NV.actualizarCielo(DIA);

console.log('\n=== lo que cuesta ===');
const med=(f)=>{ const t=[]; for(let i=0;i<6;i++){ const a=process.hrtime.bigint(); f(); t.push(Number(process.hrtime.bigint()-a)/1e6); } t.sort((a,b)=>a-b); return t[3]; };
NV.sueloEn=()=>'g'; m.ponerYo(120,90); m.draw_();
const con=med(()=>m.draw_());
const MAT=NV.MAT||null;
let sinDet=null;
if(MAT&&MAT.g){ const o=MAT.g.detalle; MAT.g.detalle=null; sinDet=med(()=>m.draw_()); MAT.g.detalle=o; }
if(sinDet!==null) console.log('  un cuadro de pasto: '+con.toFixed(1)+' ms con detalle · '+sinDet.toFixed(1)+' ms sin detalle');
probar('el detalle no encarece el cuadro más de un 35 %', sinDet===null || con<sinDet*1.35);

console.log('\n'+ok.length+' comprobaciones pasaron'+(mal.length?', '+mal.length+' FALLARON:':''));
mal.forEach(t=>console.log('  ✗ '+t)); process.exit(mal.length?1:0);

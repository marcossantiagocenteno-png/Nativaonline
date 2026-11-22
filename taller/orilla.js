/* Nativa Online — TALLER de orillas. Esto NO entra al juego todavía.

   EL PROBLEMA. El motor decide el material por METRO: sueloEn(mx,my) devuelve
   una letra por metro y después se rellenan las CPM×RPM celdas de ese metro con
   ella. Mientras la orilla es recta no se nota. En cuanto el río dobla, el borde
   sale como una escalera de un metro de paso: ocho o diez caracteres de ancho
   por escalón. Ninguna textura arregla eso, porque el defecto no está en la
   textura sino en dónde se toma la decisión.

   LA SALIDA. El borde no es un dato: es una función. El generador ya calcula el
   eje del arroyo y su ancho como funciones continuas de la coordenada. Si en vez
   de preguntar el material una vez por metro se lo pregunta una vez por CELDA,
   la orilla sigue la curva con el paso de la celda, que es diez veces más fino.
   Y si además, cerca del límite entre dos bandas, se sortea entre las dos con
   probabilidad según de qué lado cae la celda, el borde deja de ser una línea y
   se vuelve una franja mezclada: los dos materiales se entreveran unos
   centímetros, como se entreveran de verdad la arena y el guijarral.

   El metro sigue mandando para caminar y para el camino que busca el personaje.
   Lo que cambia es sólo quién decide el color de cada letra. */
(function(global){
const T={};
const NVA=global.NVA, NVS=global.NVS;

/* el eje del río: dos senos de distinto largo, que es lo que da un meandro
   que no se lee como un seno */
T.eje=wy=>5.2*Math.sin(wy/9.5)+2.3*Math.sin(wy/3.3+1.1);
T.ancho=wy=>3.4+0.9*Math.sin(wy/7.0)+0.4*Math.sin(wy/2.3);

/* las bandas, medidas en anchos de río desde el eje */
const BANDAS=[
 {m:'rio-profundo', hasta:0.42},
 {m:'rio',          hasta:0.80},
 {m:'riachuelo',    hasta:1.00},
 {m:'arena-mar',    hasta:1.20},
 {m:'arena-rio',    hasta:1.68},
 {m:'guijarral',    hasta:2.05},
 {m:'pasto-vega',   hasta:2.55},
 {m:'largo-vega',   hasta:1e9}
];
const MEZCLA=0.085;                     // de qué ancho es la franja entreverada

T.u=(wx,wy)=>Math.abs(wx-T.eje(wy))/T.ancho(wy);
function banda(u){
  for(let i=0;i<BANDAS.length;i++) if(u<BANDAS[i].hasta) return i;
  return BANDAS.length-1;
}
T.material=function(wx,wy,mezclar,cx,cy){
  const u=T.u(wx,wy), i=banda(u);
  if(!mezclar) return BANDAS[i].m;
  /* ¿estamos cerca de un límite? Si sí, se sortea entre las dos bandas. */
  const abajo=i>0?BANDAS[i-1].hasta:-1e9, arriba=BANDAS[i].hasta;
  const dA=u-abajo, dB=arriba-u;
  if(dA<MEZCLA&&i>0){
    const p=0.5+dA/(2*MEZCLA);          // 0,5 en el límite, 1 ya adentro
    return (NVA.r01(cx,cy,71)<p)?BANDAS[i].m:BANDAS[i-1].m;
  }
  if(dB<MEZCLA&&i<BANDAS.length-1){
    const p=0.5+dB/(2*MEZCLA);
    return (NVA.r01(cx,cy,73)<p)?BANDAS[i].m:BANDAS[i+1].m;
  }
  return BANDAS[i].m;
};
const esPasto=k=>NVS.SUELO[k]&&(NVS.SUELO[k].clase==='pasto'||NVS.SUELO[k].clase==='nieve');

/* modo: 'metro' (como el motor hoy), 'celda', o 'mezcla' */
T.pintar=function(modo,G,put,col,W,H,luz,t){
  const CPM=G.CPM, RPM=G.RPM;
  /* --- el relleno --- */
  for(let my=0;my<H;my++) for(let sy=0;sy<RPM;sy++){
    const r=G.r0+my*RPM+sy;
    for(let mx=0;mx<W;mx++) for(let k=0;k<CPM;k++){
      const c=G.c0+mx*CPM+k;
      let wx,wy,clave;
      if(modo==='metro'){
        wx=mx+0.5-W/2; wy=my+0.5;
        clave=T.material(wx,wy,false);
      } else {
        wx=mx+(k+0.5)/CPM-W/2; wy=my+(sy+0.5)/RPM;
        clave=T.material(wx,wy,modo==='mezcla',mx*CPM+k,my*RPM+sy);
      }
      if(esPasto(clave)) continue;                  // el pasto va aparte
      if(NVA.AGUA[clave]){
        const o=NVA.celda(clave,wx,wy,t);
        put(c,r,o.g,col(o.fam,o.lz*luz),'agua');
      } else {
        const o=NVS.celdaRelleno(clave,mx*CPM+k,my*RPM+sy,t,luz,CPM,RPM);
        if(o&&o.g!==' ') put(c,r,o.g,col(o.fam,o.lz),'suelo');
      }
    }
  }
  /* --- el pasto, por metro: las briznas son más altas que la celda y se
         enlazan de un metro al siguiente, así que no se puede partir --- */
  const Gm={CPM:CPM,RPM:RPM,HPM:G.HPM,c0:G.c0,r0:G.r0,mx0:0,my0:0};
  for(let my=0;my<H;my++) for(let mx=0;mx<W;mx++){
    const clave=T.material(mx+0.5-W/2,my+0.5,false);
    if(!esPasto(clave)) continue;
    NVS.pintarMetro(clave,Gm,put,col,mx,my,luz,t);
  }
};
/* cuántos escalones tiene el borde: se mide cuántas veces, bajando una fila, la
   orilla salta más de una celda a lo ancho */
T.medirEscalones=function(modo,W,H,CPM,RPM){
  let saltos=0, filas=0, peor=0, antes=null;
  for(let my=0;my<H;my++) for(let sy=0;sy<RPM;sy++){
    /* el borde es la primera celda de tierra DESPUÉS de haber visto agua: la
       primera de tierra a secas es el margen izquierdo del parche */
    let borde=null, hubo=false;
    for(let mx=0;mx<W&&borde===null;mx++) for(let k=0;k<CPM;k++){
      const wx=((modo==='metro')?mx+0.5:mx+(k+0.5)/CPM)-W/2;
      const wy=(modo==='metro')?my+0.5:my+(sy+0.5)/RPM;
      const cl=T.material(wx,wy,false);
      if(NVA.AGUA[cl]) hubo=true;
      else if(hubo){ borde=mx*CPM+k; break; }
    }
    if(borde===null) continue;
    if(antes!==null){ const d=Math.abs(borde-antes); if(d>1) saltos++; if(d>peor) peor=d; }
    antes=borde; filas++;
  }
  return {filas:filas, saltos:saltos, peor:peor};
};
T.BANDAS=BANDAS; T.MEZCLA=MEZCLA;
global.NVO=T;
})(typeof window!=='undefined'?window:global);
if(typeof module!=='undefined') module.exports=global.NVO||NVO;

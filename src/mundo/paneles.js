/* Nativa Online — paneles.
   El mundo es una cuadrícula de paneles de 100 × 100 metros. El claro es el
   0:0. Se nombran con ejes cartesianos: x crece al este, y crece al norte.

            (0:1) norte
   (-1:0) oeste  [0:0] claro  (1:0) este
            (0:-1) sur

   Hacia adentro, en cambio, la y crece al sur, que es como se dibuja la
   pantalla. Las dos coordenadas conviven y se traducen en un solo lugar: acá. */

const NVp = window.NV;
const LADO = 100;                       // metros por panel

/* clave interna: pi,pj  — pi crece al este, pj crece al SUR */
const clave=(pi,pj)=>pi+','+pj;
/* nombre para el jugador y para nosotros: cartesiano, y al norte */
const nombreDe=(pi,pj)=>pi+':'+(-pj);
const desdeNombre=n=>{ const [x,y]=n.split(':').map(Number); return {pi:x,pj:-y}; };

const BIOMAS={
  '0,0':  {bioma:'claro',    nombre:'El claro'},
  '-1,0': {bioma:'oeste',    nombre:'El bosque viejo'},
  '1,0':  {bioma:'este',     nombre:'El acantilado'},
  '0,-1': {bioma:'norte',    nombre:'El filo del desierto'},
  '0,1':  {bioma:'sur',      nombre:'Los pinos fríos'},
  /* las esquinas: sin ellas, caminar en diagonal daba pantalla negra */
  '-1,-1':{bioma:'esquina', nombre:'El arenal del oeste', esq:{ns:'norte'}},
  '1,-1': {bioma:'esquina', nombre:'La costa seca',       esq:{ns:'norte',costa:1}},
  '-1,1': {bioma:'esquina', nombre:'Los pinos del oeste', esq:{ns:'sur'}},
  '1,1':  {bioma:'esquina', nombre:'La costa helada',     esq:{ns:'sur',costa:1}}
};

const cache=new Map();
function panel(pi,pj){
  const k=clave(pi,pj);
  let p=cache.get(k);
  if(p) return p;
  const def=BIOMAS[k];
  if(!def) return null;                 // por ahora el mundo tiene cinco paneles
  p=NVp.generarPanel(pi,pj,def,LADO);
  p.pi=pi; p.pj=pj; p.clave=k; p.nombre=def.nombre; p.coord=nombreDe(pi,pj);
  cache.set(k,p);
  return p;
}
const panelDe=(gx,gy)=>panel(Math.floor(gx/LADO), Math.floor(gy/LADO));
const localX=gx=>((gx%LADO)+LADO)%LADO;
const localY=gy=>((gy%LADO)+LADO)%LADO;

/* ---------- consultas en coordenadas del mundo ---------- */
function sueloEn(gx,gy){
  const p=panelDe(gx,gy);
  if(!p) return null;                   // fuera del mundo conocido
  return p.ground[localY(gy)][localX(gx)];
}
function solidoEn(gx,gy){
  const p=panelDe(gx,gy);
  if(!p) return true;                   // el mundo termina
  const lx=localX(gx), ly=localY(gy);
  if(p.occ[ly*LADO+lx]) return true;
  const g=p.ground[ly][lx];
  const mat=NVp.MAT[g];
  return !!(mat&&mat.solido);
}
function sombraEn(gx,gy){
  const p=panelDe(gx,gy);
  return p?p.shade[localY(gy)*LADO+localX(gx)]:1;
}
function fuegoEn(gx,gy){
  const p=panelDe(gx,gy);
  return p&&p.fuego?p.fuego[localY(gy)*LADO+localX(gx)]:0;
}
/* El calor del fuego, CONTINUO. fuegoEn() da un valor por metro: dibujado tal
   cual, la luz de una hoguera sale en anillos cuadrados de un metro de lado,
   con un salto de unos veinticinco niveles de rojo entre uno y el siguiente.
   Acá se interpola entre los centros de metro vecinos, así que la luz cambia
   casilla por casilla y, de paso, un personaje que camina no la ve saltar al
   cruzar de un metro a otro. Las coordenadas son metros del mundo: el centro
   del metro m es m+0.5, y en el centro da exactamente lo mismo que fuegoEn. */
function calorEn(wx,wy){
  const u=wx-0.5, v=wy-0.5;
  const i=Math.floor(u), j=Math.floor(v), fu=u-i, fv=v-j;
  const a=fuegoEn(i,j), b=fuegoEn(i+1,j), c=fuegoEn(i,j+1), d=fuegoEn(i+1,j+1);
  return (a*(1-fu)+b*fu)*(1-fv)+(c*(1-fu)+d*fu)*fv;
}
/* ¿Hay algo ardiendo a la vista de este metro? Descarte barato para no
   interpolar en todo el mapa: el campo de la hoguera llega a 16 m de ancho y
   12,8 de alto (la elipse del proyecto), más un metro por la interpolación. */
function calorCerca(gx,gy){
  const p=panelDe(gx,gy);
  if(!p||!p.hoguera) return false;
  return Math.abs(localX(gx)-p.hoguera.x)<=18 && Math.abs(localY(gy)-p.hoguera.y)<=15;
}
function flujoEn(gx,gy){
  const p=panelDe(gx,gy);
  return p&&p.flow?p.flow[localY(gy)*LADO+localX(gx)]:0;
}

/* Objetos de los paneles que toca la vista, en coordenadas del mundo y
   ordenados de norte a sur, que es como los dibuja la pantalla. */
let ultimoJuego='', ultimaLista=[];
function objetosEn(gx0,gy0,gx1,gy1){
  const pi0=Math.floor(gx0/LADO), pi1=Math.floor(gx1/LADO);
  const pj0=Math.floor(gy0/LADO), pj1=Math.floor(gy1/LADO);
  const firma=pi0+' '+pi1+' '+pj0+' '+pj1;
  if(firma===ultimoJuego) return ultimaLista;
  const lista=[];
  for(let pj=pj0;pj<=pj1;pj++) for(let pi=pi0;pi<=pi1;pi++){
    const p=panel(pi,pj);
    if(!p) continue;
    for(const o of p.trees) lista.push(Object.assign({},o,{x:o.x+pi*LADO, y:o.y+pj*LADO}));
  }
  lista.sort((a,b)=>a.y-b.y);
  ultimoJuego=firma; ultimaLista=lista;
  return lista;
}
function olvidarObjetos(){ ultimoJuego=''; }

function recalcularSombras(){
  for(const p of cache.values()) NVp.calcularSombras(p, LADO);
  olvidarObjetos();
}

function limites(){
  let i0=0,i1=0,j0=0,j1=0;
  for(const k in BIOMAS){ const [i,j]=k.split(',').map(Number);
    i0=Math.min(i0,i); i1=Math.max(i1,i); j0=Math.min(j0,j); j1=Math.max(j1,j); }
  return {x0:i0*LADO, x1:(i1+1)*LADO, y0:j0*LADO, y1:(j1+1)*LADO};
}
NVp.limites=limites;
NVp.LADO=LADO; NVp.BIOMAS=BIOMAS; NVp.panel=panel; NVp.panelDe=panelDe;
NVp.nombreDe=nombreDe; NVp.desdeNombre=desdeNombre;
/* ---------- relieve: lomas y hondonadas que sólo se ven por la luz ----------
   El mundo es plano (no hay altura en ningún panel), y un suelo plano no recibe
   luz de lado: se ve igual de iluminado en todos lados. Esto es un campo de
   altura suave, en METROS DEL MUNDO, que no cambia dónde se camina ni dónde van
   las cosas: sólo decide cuánta luz recibe cada metro según hacia dónde mira su
   pendiente. El sol está al este y bajo, así que la ladera que mira al este se
   ilumina y la que mira al oeste queda en penumbra. */
const ruidoRelieve = NVp.makeNoise(NVp.mulberry((NVp.CONFIG&&NVp.CONFIG.seed?NVp.hashStr(NVp.CONFIG.seed+':relieve'):9187)));
const RELIEVE={escala:0.035, octavas:2, ganancia:7.5, piso:0.72, techo:1.28};
function relieveEn(wx,wy){ return ruidoRelieve(wx,wy,RELIEVE.octavas,RELIEVE.escala)-0.5; }
function luzRelieve(wx,wy){
  const dx=relieveEn(wx+0.5,wy)-relieveEn(wx-0.5,wy);       // sube hacia el este: mira al oeste
  return Math.max(RELIEVE.piso, Math.min(RELIEVE.techo, 1-dx*RELIEVE.ganancia));
}
NVp.relieveEn=relieveEn; NVp.luzRelieve=luzRelieve; NVp.RELIEVE=RELIEVE;
/* ---------- altura: el relieve de arriba, hecho geometría ----------
   alturaEn(wx,wy) son METROS sobre el nivel del agua, siempre >= 0. Sale del mismo
   campo del relieve (así la luz de la ladera y la altura cuentan lo mismo) y se
   aplana hacia el agua: a menos de 2 m de una orilla vale cero y a más de 14 m vale
   entera, para que playas y riberas sigan planas y el nivel del agua no se parta.
   Etapa 1: sólo se DIBUJA. Dónde se camina y dónde van las cosas no cambia. */
const ALTURA={amp:5, base:0.04, ribera0:2, ribera1:14, max:5*(0.5+0.04)};
const _dAgua=new Map();
function distAgua(mx,my){
  const k=(mx+2000)*8192+(my+2000), c=_dAgua.get(k); if(c!==undefined) return c;
  let d=ALTURA.ribera1;
  for(let r=0;r<ALTURA.ribera1&&d>r;r++){
    for(let dy=-r;dy<=r;dy++) for(let dx=-r;dx<=r;dx++){
      if(Math.max(Math.abs(dx),Math.abs(dy))!==r) continue;
      const t=sueloEn(mx+dx,my+dy); if(!t) continue;
      const m=NVp.MAT[t]; if(m&&m.ola){ const e=Math.hypot(dx,dy); if(e<d) d=e; }
    }
  }
  _dAgua.set(k,d); return d;
}
const _hPunto=new Map();               // el terreno no cambia: cada punto se calcula una vez
function alturaPunto(mx,my){          // en la retícula de metros enteros
  const k=(mx+2000)*8192+(my+2000), c=_hPunto.get(k); if(c!==undefined) return c;
  const v=alturaCalc(mx,my); _hPunto.set(k,v); return v;
}
function alturaCalc(mx,my){
  const rb=relieveEn(mx,my)+ALTURA.base; if(rb<=0) return 0;
  const t=Math.max(0,Math.min(1,(distAgua(mx,my)-ALTURA.ribera0)/(ALTURA.ribera1-ALTURA.ribera0)));
  return rb*ALTURA.amp*(t*t*(3-2*t));
}
function alturaEn(wx,wy){             // interpolada: sin escalones entre metros
  const x0=Math.floor(wx), y0=Math.floor(wy), u=wx-x0, v=wy-y0;
  const a=alturaPunto(x0,y0), b=alturaPunto(x0+1,y0), c=alturaPunto(x0,y0+1), d=alturaPunto(x0+1,y0+1);
  return (a*(1-u)+b*u)*(1-v)+(c*(1-u)+d*u)*v;
}
NVp.alturaEn=alturaEn; NVp.ALTURA=ALTURA;

NVp.sueloEn=sueloEn; NVp.solidoEn=solidoEn; NVp.sombraEn=sombraEn;
NVp.fuegoEn=fuegoEn; NVp.flujoEn=flujoEn; NVp.calorEn=calorEn; NVp.calorCerca=calorCerca;
NVp.objetosEn=objetosEn; NVp.olvidarObjetos=olvidarObjetos;
NVp.recalcularSombras=recalcularSombras; NVp.cachePaneles=cache;

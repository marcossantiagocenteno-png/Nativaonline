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
NVp.sueloEn=sueloEn; NVp.solidoEn=solidoEn; NVp.sombraEn=sombraEn;
NVp.fuegoEn=fuegoEn; NVp.flujoEn=flujoEn;
NVp.objetosEn=objetosEn; NVp.olvidarObjetos=olvidarObjetos;
NVp.recalcularSombras=recalcularSombras; NVp.cachePaneles=cache;

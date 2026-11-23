/* Nativa Online — TERRENO Y VEGETACIÓN POR SECTORES (aprobado por Marcos; integrado al juego y al Modo Dios).

   Esto no es un segundo motor de pasto. Es una CAPA DE CONFIGURACIÓN TERRITORIAL: guarda sectores
   rectangulares en metros del mundo y, para cada celda, decide qué características aplican. El pasto
   lo sigue dibujando el motor real (`pastoFranja`, src/juego/pasto.js, sin tocarlo): esta capa le gira
   sus perillas (cobertura, trazo, zona), lo llama, y transforma lo que él dibuja por un envoltorio
   sobre `put` (altura, color, estado, nieve). Con la configuración neutra no hay envoltorio: sale el
   mismo pasto, glifo por glifo, que sale hoy (lo vigila pruebas/terreno.js).

   De afuera recibe lo mismo que ya recibe el pasto: la luz del metro, el calor y el empuje del viento
   global (dPasto). No tiene luz ni viento propios.

   Dónde viven los datos:  NV.terreno.mundo.sectores  (JSON puro; exportar() / importar()).
   Para integrarlo al juego (cuando se apruebe) bastan tres puentes: guardar `exportar()` dentro del
   archivo del mundo, llamar a `dibujarMetro` en vez de `pastoFranja` en los metros con sector, y
   mandar el borrado/regenerado por `NV.mundo.editar`. Nada más.

   Globales que usa (los mismos que usa pasto.js): put, packc, tex2, hash3, CPM, RPM, HPM,
   pastoFranja, pastoPreparar. */
(function(){
'use strict';
const NV=window.NV;
const clamp=(v,a,b)=>v<a?a:v>b?b:v, lerp=(a,b,t)=>a+(b-a)*t, sm=t=>t<=0?0:t>=1?1:t*t*(3-2*t);
const hf=(a,b,c)=>(NV.hash3(a|0,b|0,c|0)%10000)/10000;     // azar 0..1 por tres enteros
const T={};
/* cómo se lee y se cambia el `put` que usa el pasto (en el navegador es window.put; en las pruebas lo pone el arnés) */
const PUT=T.puente={get:()=>window.put,set:f=>{window.put=f;}};

/* ===================================================================== CATÁLOGOS ==== */
/* Terrenos. pal: cuatro paradas de color de oscuro a claro. ramp: glifos de ralo a tupido.
   veg: cuánto pasto admite (multiplica la densidad). estado: el estado de la vegetación que le toca
   de natural (si el sector no pidió otro). flor: si admite flores. */
const TERRENOS={
  pradera:   {n:'Pradera (suelo bajo el pasto)', g:'Naturales', pal:[[7,14,13],[12,24,21],[18,34,28],[26,46,38]], ramp:'.,.:,', k:'terron', terron:0.30, esc:0.6, cov:0.9, veg:1, flor:1},
  natural:   {n:'Tierra natural', g:'Naturales', pal:[[28,24,20],[44,38,30],[66,56,42],[92,78,56]], ramp:'.,-_=', k:'terron', terron:0.55, esc:0.34, cov:0.97, veg:0.30, flor:1},
  compacta:  {n:'Tierra compactada', g:'Naturales', pal:[[40,36,32],[62,56,48],[88,80,68],[116,106,90]], ramp:'-=_.-', k:'liso', cov:0.99, veg:0.06, flor:0},
  arena:     {n:'Arena', g:'Naturales', pal:[[70,64,52],[112,102,82],[158,146,118],[200,188,156]], ramp:'..:°;', k:'onda', largo:1.6, fuerza:0.62, ang:0.18, cov:0.99, veg:0.05, flor:0},
  humeda:    {n:'Tierra húmeda', g:'Naturales', pal:[[12,10,9],[22,19,16],[34,29,23],[50,43,34]], ramp:',-:=~', k:'terron', terron:0.45, esc:0.40, cov:0.99, veg:0.55, estado:'humedo', brillo:0.10, flor:1},
  barro:     {n:'Barro', g:'Naturales', pal:[[24,18,12],[42,32,20],[64,48,30],[92,72,46]], ramp:':,-=~', k:'charco', charco:0.34, esc:0.36, brillo:1, cov:0.99, veg:0.08, flor:0, agua:[[16,24,26],[28,44,46],[50,78,80],[96,132,132]]},
  pantano:   {n:'Pantano', g:'Naturales', pal:[[20,22,12],[34,38,20],[52,58,30],[78,86,44]], ramp:',:-=~', k:'charco', charco:0.50, esc:0.55, brillo:1, cov:0.99, veg:1, estado:'humedo', flor:0,
              agua:[[8,26,30],[14,44,48],[28,70,66],[60,108,94]], mascara:'pantano'},
  seca:      {n:'Tierra seca', g:'Naturales', pal:[[70,60,40],[104,90,58],[138,120,76],[176,156,100]], ramp:'.,.:-', k:'grieta', th:0.012, cov:0.88, veg:0.18, estado:'seco', flor:0},
  agrietada: {n:'Tierra agrietada', g:'Naturales', pal:[[34,28,20],[62,52,38],[96,82,60],[134,118,86]], ramp:'.:..,', k:'grieta', th:0.050, cov:0.97, veg:0.04, flor:0},
  rocoso:    {n:'Terreno rocoso', g:'Naturales', pal:[[40,42,46],[66,70,76],[100,106,112],[146,152,158]], ramp:'.:°oc', k:'rocas', thr:0.56, cov:0.97, veg:0.9, mascara:'rocoso', flor:0},
  quemado:   {n:'Terreno quemado', g:'Afectados', pal:[[10,9,9],[22,19,18],[38,33,30],[62,56,52]], ramp:',.:\'-', k:'terron', terron:0.40, esc:0.40, ceniza:0.30, cov:0.97, veg:0.40, estado:'quemado', flor:0},
  carboniz:  {n:'Tierra carbonizada', g:'Afectados', pal:[[5,5,6],[12,11,12],[22,19,19],[40,34,32]], ramp:'.,:;\'', k:'terron', terron:0.35, esc:0.30, brasa:0.0025, cov:0.98, veg:0.12, estado:'quemado', flor:0},
  muerta:    {n:'Terreno con vegetación muerta', g:'Afectados', pal:[[44,36,24],[70,58,36],[104,88,52],[140,120,70]], ramp:'.,-:\'', k:'terron', terron:0.35, esc:0.45, cov:0.95, veg:0.85, estado:'marchito', flor:1},
  inundado:  {n:'Terreno inundado', g:'Afectados', pal:[[14,34,42],[24,58,70],[42,92,106],[84,138,150]], ramp:'~-=~.', k:'agua', cov:1, veg:0.45, estado:'humedo', mascara:'inundado', flor:0},
  erosion:   {n:'Terreno erosionado', g:'Afectados', pal:[[52,40,30],[88,66,44],[124,96,62],[164,130,86]], ramp:'.-=:_', k:'banda', cov:0.97, veg:0.08, flor:0},
  ceniza:    {n:'Terreno con ceniza', g:'Afectados', pal:[[44,44,44],[78,77,76],[118,116,112],[158,156,150]], ramp:'.,:\'-', k:'liso', estela:1, cov:0.96, veg:0.10, flor:0},
  nevado:    {n:'Terreno nevado', g:'Climáticos', pal:[[70,86,102],[130,150,168],[200,214,226],[244,250,255]], ramp:' .°**', k:'nieve', cov:0.97, veg:0.06, estado:'nieve-total', flor:0},
  pastonieve:{n:'Pasto cubierto parcialmente de nieve', g:'Climáticos', pal:[[22,34,36],[60,78,86],[150,170,184],[236,244,250]], ramp:'.,°*;', k:'nievemix', cov:0.97, veg:0.78, estado:'nieve-parcial', flor:0},
  congelado: {n:'Suelo congelado', g:'Climáticos', pal:[[40,56,72],[70,96,118],[118,150,172],[176,204,222]], ramp:'=-/°.', k:'hielo', cov:0.98, veg:0.04, flor:0},
  barrolluvia:{n:'Barro húmedo después de la lluvia', g:'Climáticos', pal:[[14,12,10],[26,22,17],[42,34,24],[66,54,38]], ramp:':,-=~', k:'charco', charco:0.55, esc:0.30, brillo:1, anillos:1, cov:0.99, veg:0.12, estado:'humedo', flor:0,
              agua:[[12,20,24],[22,38,44],[46,74,84],[96,134,146]]}
};
const GRUPOS_TERRENO=['Naturales','Afectados','Climáticos'];

const ESTADOS={fresco:'Pasto fresco',humedo:'Pasto húmedo',seco:'Pasto seco',marchito:'Pasto marchito',quemado:'Pasto quemado',
               'nieve-parcial':'Parcialmente nevado','nieve-total':'Completamente cubierto de nieve'};

/* tonos: el color al que se tira el pasto (con la luminosidad de cada celda conservada). 'natural' = el aprobado */
const TONOS={natural:{n:'Verde natural (el aprobado)',rgb:null,media:[58,86,78]},
  claro:{n:'Verde claro',rgb:[118,190,128],media:[104,160,112]}, intenso:{n:'Verde intenso',rgb:[34,150,66],media:[38,118,58]},
  oscuro:{n:'Verde oscuro',rgb:[12,56,38],media:[18,44,32]}, amarillento:{n:'Verde amarillento',rgb:[146,164,58],media:[120,134,52]},
  apagado:{n:'Verde apagado',rgb:[100,122,108],media:[88,102,92]}, seco:{n:'Verde seco',rgb:[150,142,76],media:[124,116,66]},
  marron:{n:'Marrón seco',rgb:[116,84,48],media:[96,72,44]}};

const DISTRIBUCIONES={
  dispersas:   {n:'Dispersas individualmente', TS:3,  p:0.40, nmin:1,  nmax:1,  rx:1.0, ry:0.5},
  grupos:      {n:'En pequeños grupos',        TS:5,  p:0.20, nmin:2,  nmax:4,  rx:0.9, ry:0.45},
  natural:     {n:'En agrupaciones naturales (como hoy)', TS:6, p:0.11, nmin:3, nmax:6, rx:1.1, ry:0.55},
  concentradas:{n:'En zonas concentradas',     TS:12, p:0.45, nmin:14, nmax:30, rx:4.4, ry:2.2},
  irregular:   {n:'Irregular por toda la superficie', TS:2, p:0.30, nmin:1, nmax:2, rx:0.9, ry:0.45, ruido:1}
};
const CANTIDADES=[['Sin flores',0],['Muy pocas flores',0.25],['Pocas flores',0.5],['Cantidad normal',1],['Muchas flores',1.8],['Flores abundantes',3.2]];
const COLORES_FLOR={roja:[206,58,60],amarilla:[230,198,64],blanca:[205,218,208]};

const RELIEVES={plano:{n:'Terreno prácticamente plano',amp:0},suave:{n:'Relieve suave',amp:0.30,esc:14,oct:1},
  ondulado:{n:'Ondulaciones naturales',amp:0.42,esc:7,oct:2},irregular:{n:'Relieve irregular',amp:0.50,esc:3.4,oct:3},
  elevaciones:{n:'Pequeñas elevaciones',amp:0.70,esc:6,oct:1,modo:'+'},depresiones:{n:'Pequeñas depresiones',amp:0.70,esc:6,oct:1,modo:'-'},
  accidentado:{n:'Terreno accidentado',amp:1.10,esc:4.6,oct:3}};
const TRANSICIONES={gradual:'Gradual',irregular:'Irregular',organica:'Orgánica',definida:'Definida'};

/* ============================================================== CONFIGURACIÓN POR DEFECTO ==== */
const DEF={
  nombre:'', x:0, y:0, w:20, h:20, sem:0,
  terreno:'pradera',
  pasto:{densidad:0.5, alto:0.5, tono:'natural', claridad:0, oscuridad:0, saturacion:0.5, variacion:0.5, estado:'fresco', nieve:0.5},
  flores:{cantidad:1, roja:false, amarilla:false, blanca:true, distribucion:'natural'},
  relieve:{tipo:'plano', intensidad:0.5, geometria:false},
  visual:{sombra:0.5, contraste:0.5, profundidad:0.5, variacionLuz:0.5, humedad:0, textura:0.5},
  trans:{tipo:'gradual', ancho:3}
};
const copia=o=>JSON.parse(JSON.stringify(o));
function normalizar(s){
  const o=copia(DEF); s=s||{};
  for(const k of ['nombre','terreno']) if(s[k]!==undefined) o[k]=String(s[k]);
  for(const k of ['x','y','w','h','sem']) if(s[k]!==undefined) o[k]=+s[k]||0;
  for(const g of ['pasto','flores','relieve','visual','trans']) if(s[g]) for(const k in o[g]) if(s[g][k]!==undefined) o[g][k]=s[g][k];
  if(s.id!==undefined) o.id=s.id;
  if(s.historial) o.historial=s.historial;
  o.w=clamp(o.w,1,400); o.h=clamp(o.h,1,400);
  if(!TERRENOS[o.terreno]) o.terreno='pradera';
  const P=o.pasto; for(const k of ['densidad','alto','claridad','oscuridad','saturacion','variacion','nieve']) P[k]=clamp(+P[k],0,1);
  if(!TONOS[P.tono]) P.tono='natural'; if(!ESTADOS[P.estado]) P.estado='fresco';
  const F=o.flores; F.cantidad=clamp(+F.cantidad,0,3.2); if(!DISTRIBUCIONES[F.distribucion]) F.distribucion='natural';
  for(const k of ['roja','amarilla','blanca']) F[k]=!!F[k];
  if(!RELIEVES[o.relieve.tipo]) o.relieve.tipo='plano'; o.relieve.intensidad=clamp(+o.relieve.intensidad,0,1); o.relieve.geometria=!!o.relieve.geometria;
  for(const k in o.visual) o.visual[k]=clamp(+o.visual[k],0,1);
  if(!TRANSICIONES[o.trans.tipo]) o.trans.tipo='gradual'; o.trans.ancho=clamp(+o.trans.ancho,0,30);
  return o;
}
const iguales=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
/* un sector neutro no cambia ni un glifo del pasto de hoy */
function esNeutro(s){ return s.terreno==='pradera'&&iguales(s.pasto,DEF.pasto)&&iguales(s.flores,DEF.flores)&&s.relieve.tipo==='plano'
  &&iguales(s.visual,DEF.visual)&&!s.sem; }

/* ================================================================== EL MUNDO DE SECTORES ==== */
const M=T.mundo={sectores:[],v:0,hist:[],fav:{}};
let _id=1;
function tocar(){ M.v++; _cache.clear(); }
T.nuevoMundo=()=>{ M.sectores.length=0; M.hist.length=0; _id=1; tocar(); };
function apilar(){ M.hist.push(copia(M.sectores)); if(M.hist.length>60) M.hist.shift(); }
T.agregar=function(spec){ apilar(); const s=normalizar(spec); s.id=s.id||('S'+(_id++)); s.historial=[]; M.sectores.push(s); tocar(); return s.id; };
T.porId=id=>M.sectores.find(s=>s.id===id)||null;
T.quitar=function(id){ apilar(); const i=M.sectores.findIndex(s=>s.id===id); if(i<0) return false; M.sectores.splice(i,1); tocar(); return true; };
/* modifica un sector: guarda la configuración anterior para poder recuperarla */
T.actualizar=function(id,patch){
  const s=T.porId(id); if(!s) return false; apilar();
  const antes=copia(s); delete antes.historial; s.historial.push(antes); if(s.historial.length>30) s.historial.shift();
  const n=normalizar(Object.assign(copia(s),patch,{id:s.id}));
  for(const g of ['pasto','flores','relieve','visual','trans']) if(patch[g]) n[g]=normalizar(Object.assign(copia(s),{[g]:Object.assign({},s[g],patch[g])}))[g];
  n.historial=s.historial; Object.assign(s,n); tocar(); return true;
};
T.revertir=function(id){ const s=T.porId(id); if(!s||!s.historial.length) return false; apilar();
  const a=s.historial.pop(), h=s.historial; Object.assign(s,normalizar(a),{id:s.id,historial:h}); tocar(); return true; };
T.deshacer=function(){ if(!M.hist.length) return false; M.sectores=M.hist.pop(); T.mundo.sectores=M.sectores; tocar(); return true; };
/* regenerar SÓLO ese sector: otra semilla, y nada más cambia */
T.regenerar=function(id,sem){ const s=T.porId(id); if(!s) return false; apilar(); s.sem=sem===undefined?((s.sem||0)+1+((Math.random()*997)|0)):sem; tocar(); return true; };
T.copiarConfig=id=>{ const s=T.porId(id); if(!s) return null; const c=copia(s); for(const k of ['id','x','y','w','h','historial','nombre']) delete c[k]; return c; };
T.pegarConfig=function(id,cfg){ const s=T.porId(id); if(!s||!cfg) return false; const c=copia(cfg); for(const k of ['id','x','y','w','h','historial']) delete c[k]; return T.actualizar(id,c); };
T.mover=function(id,x,y){ const s=T.porId(id); if(!s) return false; apilar(); s.x=x; s.y=y; tocar(); return true; };
T.redimensionar=function(id,w,h){ const s=T.porId(id); if(!s) return false; apilar(); s.w=clamp(w,1,400); s.h=clamp(h,1,400); tocar(); return true; };
T.exportar=()=>JSON.stringify({formato:1,sectores:M.sectores.map(s=>{ const c=copia(s); return c; })});
T.importar=function(txt){ const d=typeof txt==='string'?JSON.parse(txt):txt; if(!d||d.formato!==1) throw new Error('formato desconocido');
  M.sectores.length=0; for(const s of d.sectores){ const n=normalizar(s); n.id=s.id; n.historial=s.historial||[]; M.sectores.push(n); }
  _id=1+M.sectores.reduce((m,s)=>Math.max(m,+(String(s.id).replace(/\D/g,''))||0),0); tocar(); };
/* preajustes favoritos: configuración sin posición ni tamaño */
T.guardarFavorito=function(nombre,cfg){ const c=copia(cfg); for(const k of ['id','x','y','w','h','historial','nombre']) delete c[k]; M.fav[nombre]=c; };
T.favorito=nombre=>M.fav[nombre]?copia(M.fav[nombre]):null;

/* ======================================================================== RELIEVE Y MEZCLA ==== */
const _cache=new Map();
function altura(s,wx,wy){
  const R=RELIEVES[s.relieve.tipo]; if(!R||!R.amp) return 0;
  const A=R.amp*(0.4+1.2*s.relieve.intensidad);
  let h=0, a=1, e=R.esc, tot=0;
  for(let i=0;i<R.oct;i++){ h+=(tex2(wx+s.sem*13+i*17,wy+s.sem*7-i*9,e)-0.5)*a; tot+=a; a*=0.5; e*=0.45; }
  h=h/tot*2;                                           // -1..1
  if(R.modo==='+') h=Math.max(0,h*1.4+0.1)-0.1; else if(R.modo==='-') h=Math.min(0,h*1.4-0.1)+0.1;
  return h*A;
}
/* peso de un sector en un punto: 1 adentro, 0 afuera, y la transición en medio */
function peso(s,wx,wy){
  const d=Math.min(wx-s.x,s.x+s.w-wx,wy-s.y,s.y+s.h-wy), a=s.trans.ancho;
  switch(s.trans.tipo){
    case 'definida': return d+(tex2(wx+3,wy+9,0.9)-0.5)*0.5>=0?1:0;
    case 'irregular': { if(a<0.02) return d>=0?1:0; const w=(tex2(wx+11,wy+5,2.4)-0.5)*a*1.5; return sm((d+w)/a+0.5); }
    case 'organica': { if(a<0.02) return d>=0?1:0; const w=(tex2(wx+11,wy+5,3.4)-0.5)*a*1.9+(tex2(wx+60,wy-8,1.1)-0.5)*a*0.7; return sm((d+w)/(a*1.1)+0.5); }
    default: return a<0.02?(d>=0?1:0):sm(d/a+0.5);
  }
}
function alcance(s){ return s.trans.ancho*(s.trans.tipo==='organica'?1.6:s.trans.tipo==='irregular'?1.2:1)+1.5; }
/* los sectores que tocan un metro (o su vecindad) */
function activos(){
  if(!M.vista) return M.sectores;
  return M.sectores.filter(s=>s.id!==M.vista.id).concat([M.vista]);
}
function candidatos(mx,my){
  let l=null;
  for(const s of activos()){ const m=alcance(s);
    if(mx+1<s.x-m||mx>s.x+s.w+m||my+1<s.y-m||my>s.y+s.h+m) continue;
    (l||(l=[])).push(s); }
  return l;
}

/* ================================================ PERFIL DE UNA CELDA: la mezcla de sectores ====
   Lo continuo (densidad, altura, tono, relieve...) se mezcla por peso, de abajo hacia arriba.
   Lo discreto (terreno, estado, colores de flor) lo decide UN solo sector por celda, con un dado
   de ruido coherente: así la frontera sale en manchones y no en una línea, y un terreno nunca queda
   con la vegetación de otro (la arena no hereda el pasto: hereda el pasto de la arena). */
const BASE_SEC=normalizar({});
function perfilBase(){ return armar([[BASE_SEC,1]],0.5,0,0,0); }
let _PB=null;
function armar(lista,q,wx,wy,hh){
  /* lista: [[sector,peso]] de abajo hacia arriba */
  let g=null, win=lista[0][0];
  for(let i=0;i<lista.length;i++){ const s=lista[i][0], w=lista[i][1];
    if(i===0||q<w) win=s; }
  const P={sec:win, terreno:win.terreno, sem:win.sem|0};
  const acc=(f)=>{ let v=f(lista[0][0]); for(let i=1;i<lista.length;i++) v=lerp(v,f(lista[i][0]),lista[i][1]); return v; };
  const TR=TERRENOS[win.terreno];
  let est=win.pasto.estado; if(est==='fresco'&&TR.estado) est=TR.estado;
  const pa={
    densidad:acc(s=>s.pasto.densidad), alto:acc(s=>s.pasto.alto), claridad:acc(s=>s.pasto.claridad), oscuridad:acc(s=>s.pasto.oscuridad),
    saturacion:acc(s=>s.pasto.saturacion), variacion:acc(s=>s.pasto.variacion), nieve:acc(s=>s.pasto.nieve),
    tono:win.pasto.tono, estado:est };
  if(est==='nieve-total') pa.nieve=Math.max(pa.nieve,0.93); else if(est==='nieve-parcial'&&win.pasto.estado==='fresco') pa.nieve=0.55;
  const vi={}; for(const k in DEF.visual) vi[k]=acc(s=>s.visual[k]);
  P.pasto=pa; P.visual=vi; P.flores=win.flores; P.TR=TR;
  P.rel=acc(s=>RELIEVES[s.relieve.tipo].amp?1:0);
  /* vegetación efectiva: densidad × lo que el terreno admite × la máscara del terreno */
  let veg=pa.densidad*TR.veg*acc(s=>TERRENOS[s.terreno].veg)/Math.max(0.0001,TR.veg);
  P.vegMax=TR.veg; P.mask=1;
  P.neutro=lista.every(e=>esNeutro(e[0]));
  return P;
}
/* ¿qué admite este punto para pasto? (se calcula por celda, con la máscara del terreno) */
const MASCARAS={
  pantano:(wx,wy,P)=>{ const ch=tex2(wx,wy,0.55); return ch>=0.50?1:0.16; },
  rocoso:(wx,wy)=>tex2(wx+90,wy,3.5)>0.62?1:0.06,
  inundado:(wx,wy)=>tex2(wx+40,wy+12,1.7)>0.62?1:0
};
/* el perfil de una celda concreta */
function perfilEn(wx,wy,cand){
  if(!cand){ return _PB||(_PB=perfilBase()); }
  const lista=[[BASE_SEC,1]];
  for(const s of cand){ const w=peso(s,wx,wy); if(w>0.001) lista.push([s,w]); }
  if(lista.length===1) return _PB||(_PB=perfilBase());
  const q=0.62*tex2(wx+31,wy-17,0.9)+0.38*hf(Math.floor(wx*CPM),Math.floor(wy*RPM),5);
  const P=armar(lista,q,wx,wy);
  /* relieve: suma ponderada de cada sector, con su pendiente hacia el este */
  let h0=0,hE=0,hW=0,geo=false;
  for(let i=1;i<lista.length;i++){ const s=lista[i][0], w=lista[i][1]; if(!RELIEVES[s.relieve.tipo].amp) continue;
    h0+=w*altura(s,wx,wy); hE+=w*altura(s,wx+0.5,wy); hW+=w*altura(s,wx-0.5,wy); if(s.relieve.geometria) geo=true; }
  P.h=h0; P.dh=hE-hW; P.geo=geo;
  const m=MASCARAS[P.TR.mascara]; P.mask=m?m(wx,wy,P):1;
  return P;
}

/* ============================================================ EL SUELO (terreno bajo el pasto) ==== */
let _g=0,_c=0;
const rgbc=(a,lz)=>packc(clamp(a[0]*lz,0,255),clamp(a[1]*lz,0,255),clamp(a[2]*lz,0,255));
function paleta(pal,t,lz){ const x=clamp(t,0,1)*3, i=Math.min(2,x|0), f=x-i, a=pal[i], b=pal[i+1];
  return rgbc([lerp(a[0],b[0],f),lerp(a[1],b[1],f),lerp(a[2],b[2],f)],lz); }
const gl=(ramp,d)=>ramp.charCodeAt(clamp(Math.round(d*(ramp.length-1)),0,ramp.length-1));
function celdaSuelo(P,wx,wy,cx,cyb,lz,t){
  const TR=P.TR, V=P.visual, hh=NV.hash3(cx,cyb,23);
  const tx=0.45+V.textura*1.1;                                   // cuánto contrasta la textura superficial
  let d=0.5, g=null, col=null, brillo=0;
  switch(TR.k){
    case 'terron': { const te=tex2(wx,wy,TR.esc); d=clamp(0.18+te*TR.terron*0.92+tex2(wx+4,wy,0.7)*0.26,0,1);
      if(TR.ceniza&&tex2(wx+20,wy+3,1.3)>1-TR.ceniza){ d=0.3+0.2*d; col=paleta([[60,58,56],[84,82,80],[110,108,104],[140,138,132]],d,lz); g=gl(".,:'-",d); } break; }
    case 'liso': { d=clamp(0.36+0.28*tex2(wx,wy,1.5)+0.16*tex2(wx+9,wy,0.35),0,1);
      if(TR.estela){ const u=Math.sin((wy*2.1+tex2(wx,wy,2.6)*3.2)*3.1416); if(u>0.74){ g=45; d=0.5+0.2*u; } } break; }
    case 'onda': { const O=TR, a=O.ang||0, u=(wx*Math.cos(a)+wy*Math.sin(a))/O.largo+tex2(wx,wy,0.8)*0.9, cr=0.5+0.5*Math.sin(u*6.28318);
      d=clamp(0.30+Math.pow(cr,1.5)*O.fuerza+tex2(wx+7,wy,0.3)*0.22,0,1); break; }
    case 'charco': { const ch=tex2(wx,wy,TR.esc);
      if(ch<TR.charco){ const w=TR.agua; d=clamp(0.5+ch*0.5,0,1); col=paleta(w,d*0.8+0.15*(0.5+0.5*Math.sin(t*0.9+wx*3+wy*2)),lz*1.05);
        g="~-=~".charCodeAt((hh>>3)%4); if((hh%11)===0){ g=126; col=paleta(w,0.95,lz*1.3); }
        if(TR.anillos&&(hh%29)===0){ g=111; col=paleta(w,0.9,lz*1.2); } }
      else { d=clamp(0.28+ch*0.46,0,1);
        if(TR.k==='charco'&&TR.n==='Barro'){ const gq=Math.abs(tex2(wx+1.3,wy,0.24)-0.5); if(gq<0.02){ g=124; d=0.1; } } }
      break; }
    case 'grieta': { const gq=Math.abs(tex2(wx+1.3,wy,0.5)-0.5), gq2=Math.abs(tex2(wx-2.7,wy+4,0.62)-0.5), th=TR.th*(0.6+0.8*V.textura);
      if(gq<th||gq2<th){ g="|/\\-".charCodeAt((hh>>4)%4); d=0.06; } else d=clamp(0.34+0.4*tex2(wx,wy,0.4),0,1); break; }
    case 'rocas': { const r=tex2(wx,wy,1.1);
      if(r>TR.thr){ const f=clamp((r-TR.thr)/0.18,0,1), cara=tex2(wx+13,wy,0.5); d=0.45+0.5*cara; g=gl(".°oOc0",0.3+0.7*f); col=paleta(TR.pal,0.35+0.6*cara*(0.6+0.4*f),lz); }
      else d=clamp(0.25+0.4*tex2(wx,wy,0.3),0,1); break; }
    case 'banda': { const u=Math.sin(((wy*1.6)+tex2(wx,wy,3.2)*2.6+tex2(wx*0.4,wy,1.2)*1.2)*3.1416/0.55*0.5);
      d=clamp(0.5+0.5*u,0,1); if(u>0.8){ g=61; } else if(u<-0.7){ g=95; } break; }
    case 'agua': { const o=0.5+0.5*Math.sin(wx*5.3+wy*3.1-t*1.2+tex2(wx,wy,1.2)*5), o2=tex2(wx+t*0.05,wy,0.7);
      d=clamp(0.25+0.4*o*o2+0.3*o2,0,1); g="~-=~.".charCodeAt(clamp(Math.round(d*4),0,4)); if(o>0.92&&(hh%5)===0){ g=126; d=1; } break; }
    case 'nieve': { const s=tex2(wx,wy,0.9), sh=tex2(wx+5,wy,2.2); d=clamp(0.55+0.45*s,0,1);
      if(sh<0.36){ g=44; col=paleta(TR.pal,0.12+0.2*sh,lz); } break; }
    case 'nievemix': { const cov=clamp((tex2(wx+7,wy,1.6)-0.30)*2.2,0,1);
      if((hh%1000)/1000<cov){ g=gl(' .°**',0.4+0.6*tex2(wx,wy,0.5)); col=paleta(TR.pal,0.75+0.25*tex2(wx,wy,0.5),lz); } else { d=0.25; col=paleta(TR.pal,0.1+0.15*tex2(wx,wy,0.6),lz); g=gl(TR.ramp,0.1); }
      break; }
    case 'hielo': { const l=Math.abs(tex2(wx,wy,0.7)-0.5)<0.018, l2=Math.abs(tex2(wx+6,wy-3,0.9)-0.5)<0.016;
      d=clamp(0.5+0.4*tex2(wx,wy,1.8),0,1);
      if(l||l2){ g="/\\-".charCodeAt((hh>>2)%3); col=paleta(TR.pal,0.95,lz*1.1); } else if((hh%9)===0){ g=176; } break; }
  }
  if(g===null) g=((hh>>7)%1000)/1000<TR.cov?gl(TR.ramp,clamp((d-0.5)*tx+0.5,0,1)):0;
  if(!g) return false;
  if(col===null) col=paleta(TR.pal,clamp(d+(tex2(wx+2,wy,0.18)-0.5)*0.35*tx,0,1),lz);
  if(TR.brasa&&hh%10000<TR.brasa*10000){ g=46; col=packc(150*lz+40,44*lz+14,16); }
  /* humedad visual: oscurece, enfría y deja brillos */
  if(V.humedad>0){ const hu=V.humedad, r=(col>>16)&255, gg=(col>>8)&255, b=col&255;
    col=packc(r*(1-0.30*hu),gg*(1-0.18*hu),b*(1-0.04*hu)+10*hu); if((hh%23)<hu*5){ g=96; col=packc(60+60*hu,90+70*hu,110+70*hu); } }
  _g=g; _c=col; return true;
}

/* ==================================================================== EL PASTO EXTENDIDO ====
   Densidad → perillas del pasto real. 0,5 es "normal" y da EXACTAMENTE las perillas actuales. */
const PUNTOS_COB=[[0,0.03],[0.1,0.40],[0.25,0.70],[0.5,0.965],[1,0.985]];
const PUNTOS_TRZ=[[0,0.02],[0.15,0.10],[0.5,0.30],[0.75,0.44],[1,0.62]];
function pw(p,x){ for(let i=1;i<p.length;i++) if(x<=p[i][0]){ const a=p[i-1],b=p[i]; return lerp(a[1],b[1],(x-a[0])/(b[0]-a[0])); } return p[p.length-1][1]; }
const cobDe=d=>pw(PUNTOS_COB,clamp(d,0,1)), trzDe=d=>pw(PUNTOS_TRZ,clamp(d,0,1));
/* la longitud de los trazos: 0,5 = la de hoy (×1). */
const lenMul=a=>a<=0.5?lerp(0.30,1,a/0.5):lerp(1,3.4,(a-0.5)/0.5);
const GLIFO_TRAZO=c=>c===124||c===47||c===92;
const RAMPA_NIEVE=[[110,128,144],[160,178,194],[210,224,234],[244,250,255]];

let _W=null;                   // contexto del envoltorio activo
function mediaTono(P){ return TONOS[P.pasto.tono].media; }
function tinte(col,P,lz,h){
  const pa=P.pasto, V=P.visual, TN=TONOS[pa.tono];
  let r=(col>>16)&255, g=(col>>8)&255, b=col&255;
  if(TN.rgb){ const L=0.3*r+0.59*g+0.11*b, k=0.35+0.65*Math.pow(Math.max(L,1)/78,0.9);
    r=lerp(r,TN.rgb[0]*k,0.93); g=lerp(g,TN.rgb[1]*k,0.93); b=lerp(b,TN.rgb[2]*k,0.93); }
  if(pa.variacion!==0.5){ const m=TN.media, f=pa.variacion*2; r=m[0]+(r-m[0])*f; g=m[1]+(g-m[1])*f; b=m[2]+(b-m[2])*f; }
  if(V.contraste!==0.5){ const f=0.4+V.contraste*1.2, L=0.3*r+0.59*g+0.11*b; r=L+(r-L)*1+(L-70)*(f-1)*0.01*r/Math.max(L,1)*0; const m=(f-1)*(0.3*r+0.59*g+0.11*b-70); r+=m; g+=m; b+=m; }
  if(pa.claridad>0){ const k=pa.claridad; r=r*(1+0.9*k)+36*k; g=g*(1+0.9*k)+40*k; b=b*(1+0.9*k)+34*k; }
  if(pa.oscuridad>0){ const k=1-pa.oscuridad*0.72; r*=k; g*=k; b*=k; }
  if(pa.saturacion!==0.5){ const L=0.3*r+0.59*g+0.11*b, s=pa.saturacion*2; r=L+(r-L)*s; g=L+(g-L)*s; b=L+(b-L)*s; }
  return [r,g,b];
}
const enteros=(r,g,b)=>packc(clamp(r,0,255),clamp(g,0,255),clamp(b,0,255));

/* ¿qué dibuja el pasto real en esta celda? lo transformamos sin tocarlo */
function envoltorio(c,r,ch,col){
  const W=_W;
  if(r!==W.rb){ if(W.skip) return; W.real(c,r,ch,W.lastCol===undefined?col:W.lastCol); return; }
  W.skip=false; W.lastCol=undefined;
  const k=c-W.base, cx=W.mx*CPM+k, cyb=W.my*RPM+W.sy, wx=W.mx+(k+0.5)/CPM, wy=W.my+(W.sy+0.5)/RPM;
  const P=perfilEn(wx,wy,W.cand), pa=P.pasto, trazo=GLIFO_TRAZO(ch);
  const h=hf(cx,cyb,88), h2=hf(cx,cyb,89);
  const hz=NV.hash3(cx,cyb,23);
  const veg=pa.densidad*P.TR.veg*P.mask;
  /* 1) espesor: la densidad de la celda contra la que se pidió a la franja */
  const cobC=cobDe(veg), keep=W.cob>0?cobC/W.cob:0;
  if(h>=keep){ if(trazo) W.skip=true; return; }
  const trzC=trzDe(veg);
  let stroke=trazo;
  if(trazo&&W.trz>0&&hf(cx,cyb,90)>=trzC/W.trz){ stroke=false; }
  if(trazo&&!stroke) W.skip=true;
  const lz=W.luz*(1+(W.lfSub||0));
  let lf=lz;
  /* luz de la celda: relieve del sector (pendiente hacia el este mira al oeste: penumbra) */
  if(P.h!==undefined){ const V=P.visual, g=3.2*(0.25+1.5*V.sombra); lf*=clamp(1-P.dh*g,0.55,1.5);
    lf*=1+P.h*V.profundidad*0.6; if(V.variacionLuz!==0.5) lf*=1+(tex2(wx+3,wy-4,4.5)-0.5)*(V.variacionLuz-0.5)*1.6; }
  const kLuz=lf/(W.luz||1);
  const base=tinte(col,P,lz,h2);
  let [rr,gg,bb]=base; rr*=kLuz; gg*=kLuz; bb*=kLuz;
  /* 2) estado de la vegetación */
  const st=pa.estado;
  let glyph=ch, L=1, lean=ch===47?1:ch===92?-1:0;
  if(trazo){ const lr=((hz>>8)%100)/100; L=lr<0.70?1:lr<0.94?2:3; }
  let mul=lenMul(pa.alto);
  if(st==='seco'){ rr=lerp(rr,150,0.55); gg=lerp(gg,132,0.55); bb=lerp(bb,74,0.55); mul*=0.85;
    if(stroke&&h2<0.30){ glyph=45; stroke=false; W.skip=true; } if(!trazo&&h2<0.12) return; }
  else if(st==='marchito'){ const L0=0.3*rr+0.59*gg+0.11*bb; rr=lerp(L0,rr,0.5)*1.05+16; gg=lerp(L0,gg,0.5)*0.95+8; bb=lerp(L0,bb,0.5)*0.7; mul*=0.8;
    if(h2<0.16) return; if(stroke&&h2<0.30){ glyph=96; stroke=false; W.skip=true; } }
  else if(st==='humedo'){ rr*=0.78; gg*=0.9; bb*=1.0; if(h2<0.10){ glyph=96; rr=rr*1.5+30; gg=gg*1.5+36; bb=bb*1.4+40; } }
  else if(st==='quemado'){ const ceniza=h2<0.30, f=0.5+0.9*h;
    if(ceniza){ rr=gg=bb=64*f*lf; bb=rr*1.0; } else { rr=24*f*lf; gg=21*f*lf; bb=19*f*lf; }
    mul=Math.min(mul,0.6); if(h2>0.78) return; if(stroke&&h2>0.55){ glyph=39; stroke=false; W.skip=true; } }
  else if(st==='nieve-parcial'||st==='nieve-total'){
    const cov=clamp(pa.nieve+(tex2(wx+7,wy-2,1.9)-0.5)*(st==='nieve-total'?0.2:0.9),0,1);
    if(h<cov*0.97+0.0){ glyph=" .°**,'".charCodeAt(clamp(Math.floor(h2*7.5),0,6)); if(glyph===32) glyph=46;
      const nv=paleta(RAMPA_NIEVE,0.45+0.55*h2*(0.6+0.4*lf),Math.min(1.2,0.55+0.55*lf)); _W.real(c,W.rb,glyph,nv); return; }
    mul=Math.min(mul,0.9); rr=lerp(rr,200,0.18); gg=lerp(gg,215,0.18); bb=lerp(bb,225,0.18);
  }
  /* humedad visual del sector: oscurece y da brillos al pasto */
  const hu=P.visual.humedad; if(hu>0){ rr*=1-0.22*hu; gg*=1-0.10*hu; bb*=1+0.05*hu; if(!stroke&&h2<hu*0.08){ glyph=96; rr+=50*hu; gg+=70*hu; bb+=80*hu; } }
  const color=enteros(rr,gg,bb);
  /* 3) forma: trazos de otra altura */
  if(stroke){
    const Ln=clamp(Math.round(L*mul+(mul>1?(h2-0.35)*mul*0.8:0)),1,10);
    if(mul<0.55&&h2<(0.55-mul)*1.8){ stroke=false; glyph="`',.".charCodeAt((hz>>6)%4); }
    else if(Ln>1||mul>1.05||mul<0.9){
      /* la mata larga: tallo recto abajo, doblado arriba, y la punta clara */
      let off=0, accum=lean, wind=-W.dP*(1+0.45*(h2-0.5));
      const dir=((hz>>5)&1)?1:-1, bend=(st==='marchito'?0.9:0.35)*(Ln>3?1:0.4);
      for(let j=0;j<Ln;j++){
        const u=Ln>1?j/(Ln-1):0;
        const l=accum+wind*u*u*(0.6+0.25*Ln)*0.6+dir*bend*u*u*1.2;
        const gc=l<-0.5?92:l>0.5?47:124, o=Math.round(off);
        const cc=(j===Ln-1&&Ln>1)?enteros(rr*1.22+10,gg*1.2+12,bb*1.1+8):(j===0&&Ln>3)?enteros(rr*0.78,gg*0.78,bb*0.8):color;
        W.real(c+o,W.rb-j,(j===0&&lean===0&&Ln===1)?ch:gc,cc);
        off+=clamp(l,-1.4,1.4)*0.6;
      }
      W.skip=true; W.alto=Ln; return;
    }
    W.lastCol=color; W.real(c,r,glyph,color); W.skip=false; return;       // misma longitud: deja pasar los trazos de arriba
  }
  W.real(c,r,glyph,color);
}

/* ========================================================================== LAS FLORES ====
   Mismo reparto que el pasto real (baldosas de TS metros, un grupo por baldosa con cierta probabilidad),
   pero con tamaño de baldosa, cantidad, colores y distribución a elección. Con la configuración por
   defecto reproduce las flores de hoy, posición por posición. */
function floresDelMetro(mx,my,cand,out){
  out.length=0;
  /* qué distribuciones hay cerca: se mira cada una que algún sector use (o la base) */
  const dist=new Set([DEF.flores.distribucion]);
  if(cand) for(const s of cand) dist.add(s.flores.distribucion);
  for(const dn of dist){
    const D=DISTRIBUCIONES[dn], TS=D.TS, tx=Math.floor(mx/TS), ty=Math.floor(my/TS);
    const hh=NV.hash3(tx+500,ty+500,9+(dn==='natural'?0:dn.length*11)), m=Math.max(D.rx,0.2*TS), span=Math.max(0.1,TS-2*m);
    const cx=tx*TS+m+((hh>>8)%100)/100*span, cy=ty*TS+Math.max(D.ry,0.2*TS)+((hh>>16)%100)/100*Math.max(0.1,TS-2*Math.max(D.ry,0.2*TS));
    /* el sector del centro del grupo decide cantidad y colores del grupo entero */
    const P=perfilEn(cx,cy,cand&&candidatos(cx,cy)), F=P.flores;
    if(F.distribucion!==dn) continue;
    if(!P.TR.flor||P.mask<0.5||F.cantidad<=0) continue;
    const est=P.pasto.estado; if(est==='quemado'||est==='nieve-total') continue;
    let p=D.p*F.cantidad*clamp(P.pasto.densidad*P.TR.veg*2,0,1);
    if(D.ruido) p*=clamp(tex2(cx,cy,6.5)*1.7-0.2,0,1.4);
    if((hh%100)/100>=p) continue;
    const n=Math.round((D.nmin+((hh>>3)%(D.nmax-D.nmin+1)))*Math.max(1,F.cantidad*0.8));
    const cols=[]; if(F.roja) cols.push('roja'); if(F.amarilla) cols.push('amarilla'); if(F.blanca) cols.push('blanca'); if(!cols.length) continue;
    const principal=cols[(hh>>20)%cols.length];
    for(let i=0;i<n;i++){
      const hi=NV.hash3(tx+500,ty+500,40+i+(dn==='natural'?0:dn.length*100));
      const fx=cx+(((hi%100)/100)-0.5)*2*D.rx, fy=cy+((((hi>>8)%100)/100)-0.5)*2*D.ry;
      if(Math.floor(fx)!==mx||Math.floor(fy)!==my) continue;
      const cn=(cols.length>1&&((hi>>4)%100)>=70)?cols[(hi>>12)%cols.length]:principal;
      out.push({c:Math.min(CPM-1,Math.floor((fx-mx)*CPM)), s:Math.min(RPM-1,Math.floor((fy-my)*RPM)),
                g:'@eo'.charCodeAt((hi>>16)%3), col:COLORES_FLOR[cn], P, h:(hi>>9)%100});
    }
  }
}
const _fl=[];

/* ======================================================================== DIBUJO ==== */
/* Un metro entero. o: {base, rb0, luz, calor, dPasto, t, calidad}
   base = columna donde empieza el metro; rb0 = fila de su primera franja.
   Dibuja: el suelo de cada celda, el pasto (el real, ajustado) y las flores. */
T.dibujarMetro=function(mx,my,o){
  const cand=candidatos(mx,my), cal=o.calidad===undefined?1:o.calidad, calor=o.calor||0, t=o.t||0;
  const Pc=perfilEn(mx+0.5,my+0.5,cand);
  const put0=PUT.get();
  /* con todo neutro: el pasto real, sin envoltorio, y sus flores */
  const todoNeutro=!cand||Pc.neutro&&(function(){ for(let k=0;k<5;k++){ const p=perfilEn(mx+k/4,my+0.5,cand); if(!p.neutro) return false; } return true; })();
  /* el suelo */
  for(let sy=0;sy<RPM;sy++){
    const rb=o.rb0+sy;
    let alza=0;
    for(let k=0;k<CPM;k++){
      const wx=mx+(k+0.5)/CPM, wy=my+(sy+0.5)/RPM, P=perfilEn(wx,wy,cand);
      if(P.geo&&!k&&o.alzar!==false) alza=Math.round(P.h*HPM*1.6);
      if(P.h!==undefined&&k===0&&sy===0) { /* solo para que el cálculo se haga una vez */ }
      let lz=o.luz; if(P.h!==undefined){ const V=P.visual; lz*=clamp(1-P.dh*3.2*(0.25+1.5*V.sombra),0.55,1.5)*(1+P.h*V.profundidad*0.6); }
      if(P.terreno!=='pradera'&&celdaSuelo(P,wx,wy,o.cx0===undefined?mx*CPM+k:o.cx0+k,my*RPM+sy,lz,t)) put0(o.base+k,rb-alza,_g,_c);
    }
  }
  if(todoNeutro){ pastoPreparar(mx,my,true);
    for(let sy=0;sy<RPM;sy++) pastoFranja(mx,my,sy,o.rb0+sy,o.base,false,o.luz,calor,o.dPasto||0,cal);
    return Pc; }
  pastoPreparar(mx,my,false);                                 // las flores las pone esta capa
  floresDelMetro(mx,my,cand,_fl);
  for(let sy=0;sy<RPM;sy++){
    const rb=o.rb0+sy;
    /* perillas del pasto real para esta franja: el máximo que pida alguna de sus celdas */
    let vmax=0, off=0, sample=null;
    for(let k=0;k<CPM;k+=3){ const wx=mx+(k+0.5)/CPM, wy=my+(sy+0.5)/RPM, P=perfilEn(wx,wy,cand); const v=P.pasto.densidad*P.TR.veg*P.mask; if(v>vmax){ vmax=v; sample=P; } }
    const Pm=sample||Pc, cfg=NV.pasto.cfg, c0=cfg.cobertura, t0=cfg.trazo, z0=cfg.zona;
    cfg.cobertura=cobDe(vmax); cfg.trazo=trzDe(vmax);
    const Ps=perfilEn(mx+0.5,my+(sy+0.5)/RPM,cand), sem=Ps.sem|0;
    _W={real:put0,mx,my,sy,base:o.base,rb,cand,luz:o.luz,cob:cfg.cobertura,trz:cfg.trazo,skip:false,dP:o.dPasto||0,lfSub:0};
    PUT.set(envoltorio);
    try{ if(vmax>0) pastoFranja(mx+(sem?sem*37:0),my+(sem?sem*53:0),sy,rb,o.base,false,o.luz,calor,o.dPasto||0,cal); }
    finally{ PUT.set(put0); cfg.cobertura=c0; cfg.trazo=t0; cfg.zona=z0; _W=null; }
    /* flores de esta franja */
    for(const f of _fl) if(f.s===sy){
      const P=f.P, st=P.pasto.estado; let rr=f.col[0], gg=f.col[1], bb=f.col[2];
      if(st==='seco'||st==='marchito'){ rr=rr*0.55+40; gg=gg*0.5+30; bb=bb*0.4+16; }
      const rise=P.pasto.alto>0.55?Math.round((P.pasto.alto-0.5)*2*3*(0.4+0.6*f.h/100)):0;
      const hid=P.pasto.alto>0.8&&f.h<22;       // entre el pasto muy largo algunas flores no se ven
      if(!hid) put0(o.base+f.c,rb-rise,f.g,packc(rr,gg,bb));
    }
  }
  return Pc;
};

/* ==================================================================== PRUEBAS Y UTILES ==== */
T.TERRENOS=TERRENOS; T.GRUPOS_TERRENO=GRUPOS_TERRENO; T.ESTADOS=ESTADOS; T.TONOS=TONOS; T.DISTRIBUCIONES=DISTRIBUCIONES;
T.CANTIDADES=CANTIDADES; T.RELIEVES=RELIEVES; T.TRANSICIONES=TRANSICIONES; T.DEF=DEF; T.normalizar=normalizar;
T.perfilEn=(wx,wy)=>perfilEn(wx,wy,candidatos(Math.floor(wx),Math.floor(wy)));
T.peso=peso; T.altura=altura; T.cobDe=cobDe; T.trzDe=trzDe; T.lenMul=lenMul; T.celdaSuelo=(P,wx,wy,cx,cy,lz,t)=>celdaSuelo(P,wx,wy,cx,cy,lz,t)?[_g,_c]:null;
T.floresDelMetro=(mx,my)=>{ const o=[]; floresDelMetro(mx,my,candidatos(mx,my),o); return o; };
T.copia=copia; T.esNeutro=esNeutro;

/* ---- lo que usa el juego ---- */
/* los datos del mundo → los sectores (los guarda NV.mundo; acá sólo se dibujan) */
T.sincronizar=function(arr){ M.sectores.length=0; M.hist.length=0;
  for(const d of (arr||[])){ const n=normalizar(d); n.id=d.id; n.historial=d.historial||[]; M.sectores.push(n); }
  _id=1+M.sectores.reduce((m,s)=>Math.max(m,+(String(s.id).replace(/\D/g,''))||0),0); M.v++; };
/* vista previa del Modo Dios: un sector provisional (o uno real movido o cambiado) que no se guarda */
T.vista=function(d){ if(!d){ if(M.vista){ M.vista=null; M.v++; } return; } const n=normalizar(d); n.id=d.id||'__vista'; M.vista=n; M.v++; };
T.hay=()=>M.sectores.length>0||!!M.vista;
T.toca=(mx,my)=>!!candidatos(mx,my);
T.version=()=>M.v;
T.sectorEn=function(wx,wy){ let r=null; for(const s of activos()) if(s.id!=='__vista'&&wx>=s.x&&wx<s.x+s.w&&wy>=s.y&&wy<s.y+s.h) r=s; return r; };
T.aDatos=s=>{ const c=copia(s); return c; };
NV.terreno=T;
/* lo que el mundo ya trae al abrir el juego */
if(NV.mundo&&NV.mundo.terrenoDatos) T.sincronizar(NV.mundo.terrenoDatos());
})();

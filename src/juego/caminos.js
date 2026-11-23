/* Nativa Online — MOTOR DE CAMINOS, TIERRA Y EMPEDRADOS.
   Estado: LABORATORIO. Todavía no lo llama dibujar.js ni ningún panel del mundo; se prueba solo en
   preview/caminos.html. Integrarlo al juego y al Modo Dios necesita la aprobación de Marcos.

   Es independiente del lienzo: no pinta, DEVUELVE. Para una casilla del mundo dice si el camino la
   cubre y, si la cubre, qué glifo y qué color lleva (NV.caminos.sal.g / .c). Quien pinte —el juego
   o el laboratorio— hace el put(). Así el mismo motor sirve a los dos y el Modo Dios no tiene que
   reconstruirlo para usarlo.

   TRES CAPAS, de lo barato a lo caro:
     1. TRAZADO   puntos de control (metros, y al sur) -> línea suave con meandro y ancho variable.
                  Se prepara una sola vez por camino y se guarda en un índice de rejilla de 4 m.
     2. CAMPO     para un punto del mundo: distancia al eje, posición a lo largo (s), ancho ahí y lado.
                  De ahí sale e = metros hasta el borde (negativo = adentro). Se le suma ruido de borde.
     3. SUPERFICIE glifo y color de la casilla según la familia: tierra o empedrado.

   TODO sale de la semilla y de coordenadas del mundo: nada depende del reloj ni de Math.random,
   así que mientras el jugador camina la textura no parpadea ni cambia. Las dos semillas están
   separadas a propósito: semTrazado manda sobre el recorrido, semTextura sobre la piel, y
   regenerar la textura no mueve el trazado.

   Las paletas están en color FINAL (lo que se ve con la luz del juego), como las del pasto; el
   parámetro lf (0,2..1,4) las modula. */
(function(NV){
'use strict';
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const sstep=(a,b,x)=>{ const t=clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); };
const hash3=NV.hash3;
const H=(x,y,z)=>hash3(x|0,y|0,z|0)/2147483648;                 // 0..1
const pack=(r,g,b)=>(clamp(r|0,0,255)<<16)|(clamp(g|0,0,255)<<8)|clamp(b|0,0,255);

/* ruido de valor, suave, de la red de hash: en METROS del mundo, no en celdas */
function vn(x,y,z){
  const xi=Math.floor(x), yi=Math.floor(y), xf=x-xi, yf=y-yi, u=xf*xf*(3-2*xf), v=yf*yf*(3-2*yf);
  const a=H(xi,yi,z), b=H(xi+1,yi,z), c=H(xi,yi+1,z), d=H(xi+1,yi+1,z);
  const t=a+(b-a)*u; return t+((c+(d-c)*u)-t)*v;
}
const tex=(x,y,e,z)=>0.66*vn(x/e,y/e,z)+0.34*vn(x/(e*0.42)+37.1,y/(e*0.42)+11.7,z+1);

/* ---------------------------------------------------------------- PARÁMETROS ----
   Cada familia tiene los suyos (valores propios) y declara cuáles le sirven: no hay controles
   que no hagan nada. etiqueta/min/max/paso son lo que el Modo Dios usa para dibujar el control. */
const PARAMS={
  ancho:         {etiqueta:'Anchura (m)',               min:0.6, max:6,   paso:0.1,  aplica:'todas'},
  variacionAncho:{etiqueta:'Variación de anchura',      min:0,   max:1,   paso:0.05, aplica:'todas'},
  bordes:        {etiqueta:'Irregularidad de los bordes',min:0,  max:1,   paso:0.05, aplica:'todas'},
  densidad:      {etiqueta:'Densidad de textura',       min:0.3, max:1.4, paso:0.05, aplica:'todas'},
  piedra:        {etiqueta:'Tamaño de las piedras (m)', min:0.1, max:1.3, paso:0.02, aplica:'todas'},
  variacionPiedra:{etiqueta:'Variación del tamaño',     min:0,   max:1,   paso:0.05, aplica:'todas'},
  separacion:    {etiqueta:'Separación entre piedras (m)',min:0.02,max:0.3,paso:0.01,aplica:['empedrado','empedrado-antiguo']},
  particulas:    {etiqueta:'Distribución de partículas',min:0,   max:1.5, paso:0.05, aplica:'todas'},
  tonos:         {etiqueta:'Variación de tonalidades',  min:0,   max:1,   paso:0.05, aplica:'todas'},
  desgaste:      {etiqueta:'Nivel de desgaste',         min:0,   max:1,   paso:0.05, aplica:'todas'},
  transicion:    {etiqueta:'Intensidad de las transiciones',min:0,max:1,  paso:0.05, aplica:'todas'},
  irregularidad: {etiqueta:'Nivel de irregularidad',    min:0,   max:1,   paso:0.05, aplica:'todas'},
  detalle:       {etiqueta:'Nivel de detalle',          min:0,   max:2,   paso:1,    aplica:'todas'}
};
/* piedra y variacionPiedra en la tierra son las piedritas incrustadas; en el empedrado, los adoquines */
const FAMILIAS={
  'tierra':           {nombre:'Tierra natural',  clase:'tierra',    antigua:false,
    def:{ancho:2.2,variacionAncho:0.35,bordes:0.55,densidad:0.9,piedra:0.18,variacionPiedra:0.5,particulas:0.6,
          tonos:0.55,desgaste:0.35,transicion:0.6,irregularidad:0.45,detalle:1}},
  'tierra-antigua':   {nombre:'Tierra antigua',  clase:'tierra',    antigua:true,
    def:{ancho:2.4,variacionAncho:0.4,bordes:0.7,densidad:1.0,piedra:0.28,variacionPiedra:0.6,particulas:0.8,
          tonos:0.65,desgaste:0.7,transicion:0.7,irregularidad:0.6,detalle:1}},
  'empedrado':        {nombre:'Empedrado rural', clase:'empedrado', antigua:false,
    def:{ancho:2.8,variacionAncho:0.2,bordes:0.35,densidad:0.8,piedra:0.85,variacionPiedra:0.45,separacion:0.12,
          particulas:0.35,tonos:0.5,desgaste:0.35,transicion:0.5,irregularidad:0.3,detalle:1}},
  'empedrado-antiguo':{nombre:'Empedrado antiguo',clase:'empedrado', antigua:true,
    def:{ancho:3.0,variacionAncho:0.3,bordes:0.5,densidad:0.9,piedra:1.0,variacionPiedra:0.75,separacion:0.16,
          particulas:0.6,tonos:0.7,desgaste:0.75,transicion:0.65,irregularidad:0.55,detalle:1}}
};
/* las tres variantes del laboratorio: lo que cambia es el nivel de detalle (cuántas capas se pintan)
   y, un poco, cuánta textura y cuántas partículas lleva */
const VARIANTES={
  natural:   {detalle:0, kDens:0.88, kPart:0.70},
  intermedia:{detalle:1, kDens:1.00, kPart:1.00},
  detallada: {detalle:2, kDens:1.10, kPart:1.25}
};
const aplica=(fam,k)=>{ const a=PARAMS[k].aplica; return a==='todas'||a.indexOf(fam)>=0; };
function parametrosDe(fam){
  const o={}; for(const k of Object.keys(PARAMS)) if(aplica(fam,k)) o[k]=Object.assign({def:FAMILIAS[fam].def[k]},PARAMS[k]);
  return o;
}
function variante(fam,nombre){
  const v=VARIANTES[nombre]; if(!v) throw new Error('variante desconocida: '+nombre);
  const p=Object.assign({},FAMILIAS[fam].def);
  p.detalle=v.detalle; p.densidad=clamp(p.densidad*v.kDens,PARAMS.densidad.min,PARAMS.densidad.max);
  p.particulas=clamp(p.particulas*v.kPart,0,PARAMS.particulas.max);
  return p;
}

/* ------------------------------------------------------------------- PALETAS ----
   [r,g,b] finales. Se interpolan entre escalones, así el tono cambia suave. */
const PAL={
  tierra:[[46,34,24],[78,58,38],[116,86,54],[152,114,70],[184,142,88],[206,170,116]],     // oscura -> ocre -> arena
  tierraSeca:[[96,74,50],[130,102,66],[164,132,84],[192,160,106],[210,182,130],[224,204,160]],
  piedraGris:[[70,76,82],[102,108,112],[138,142,144],[170,172,168],[196,196,188]],
  piedraParda:[[92,72,56],[124,98,72],[156,126,92],[184,152,112],[206,178,138]],
  piedraTierra:[[100,78,56],[132,104,72],[160,128,90],[186,152,108]],
  piedraOscura:[[38,42,48],[58,64,70],[82,88,94],[108,114,118]],
  junta:[[8,7,6],[16,13,10],[28,22,16]],
  tierraJunta:[[50,38,26],[76,58,38],[104,82,54]],
  musgo:[[22,44,40],[34,62,52],[54,86,66]]                                               // el verde del pasto, apagado
};
function lerpPal(pal,t,k){
  const n=pal.length-1, x=clamp(t,0,1)*n, i=Math.min(n-1,x|0), f=x-i, a=pal[i], b=pal[i+1];
  return pack((a[0]+(b[0]-a[0])*f)*k,(a[1]+(b[1]-a[1])*f)*k,(a[2]+(b[2]-a[2])*f)*k);
}
const ch=s=>s.charCodeAt(0);
/* regla 3 del diccionario: el extremo ralo ('.' ',') se comparte; el denso es de cada material.
   El empedrado usa '0' y '8' como extremo denso: ningún suelo los usa. */
const RAMPA_TIERRA=[32,ch('.'),ch(','),ch('-'),ch(':'),ch(';'),ch('_'),ch('=')];
/* la tierra elige un glifo de un grupito según cuán tupida está, no una raya fija: así no sale en hileras */
const POOL_RALO=[ch('.'),ch(','),ch('`'),ch("'"),ch('.'),ch(',')];
const POOL_MEDIO=[ch(':'),ch(';'),ch(','),ch('.'),ch(':'),ch('-')];
const POOL_TUPIDO=[ch('='),ch(';'),ch(':'),ch('-'),ch('_'),ch(';')];
const RAMPA_PIEDRA=[ch('.'),ch(':'),ch('o'),ch('0'),ch('8')];

/* ---------------------------------------------------------------- GEOMETRÍAS ----
   Constructores de puntos de control. Son funciones puras: mismos argumentos, mismos puntos. */
const G_RAMPA=0.35;                     // paso del muestreo del eje, en metros
function recto(a,b){ return [[a[0],a[1]],[b[0],b[1]]]; }
function curvo(a,b,curva){
  curva=curva===undefined?0.3:curva;
  const dx=b[0]-a[0], dy=b[1]-a[1], L=Math.hypot(dx,dy)||1, nx=-dy/L, ny=dx/L;
  const cx=(a[0]+b[0])/2+nx*curva*L*2, cy=(a[1]+b[1])/2+ny*curva*L*2, pts=[];
  for(let i=0;i<=6;i++){ const t=i/6, u=1-t;
    pts.push([u*u*a[0]+2*u*t*cx+t*t*b[0], u*u*a[1]+2*u*t*cy+t*t*b[1]]); }
  return pts;
}
function sinuoso(a,b,o){
  o=o||{}; const dx=b[0]-a[0], dy=b[1]-a[1], L=Math.hypot(dx,dy)||1, nx=-dy/L, ny=dx/L;
  const ondas=o.ondas===undefined?2.4:o.ondas, amp=(o.amp===undefined?0.10:o.amp)*L, sem=o.semilla|0;
  const n=Math.max(3,Math.ceil(L/2.6)), pts=[], fase=H(sem,1,7)*6.283;
  for(let i=0;i<=n;i++){ const t=i/n, tap=Math.min(1,t*5,(1-t)*5);
    const off=(Math.sin(t*ondas*6.283+fase)*0.8+(vn(t*7,0,sem+3)-0.5)*1.0)*amp*tap;
    pts.push([a[0]+dx*t+nx*off, a[1]+dy*t+ny*off]); }
  return pts;
}
/* sendero: el que se forma solo, con el paso. Un andar al azar que vuelve a la recta. */
function sendero(a,b,o){
  o=o||{}; const dx=b[0]-a[0], dy=b[1]-a[1], L=Math.hypot(dx,dy)||1, nx=-dy/L, ny=dx/L, sem=o.semilla|0;
  const n=Math.max(4,Math.ceil(L/1.8)), pts=[]; let off=0;
  for(let i=0;i<=n;i++){ const t=i/n, tap=Math.min(1,t*6,(1-t)*6);
    off=off*0.72+(H(sem,i,13)-0.5)*1.5*(o.amp===undefined?1:o.amp);
    pts.push([a[0]+dx*t+nx*off*tap, a[1]+dy*t+ny*off*tap]); }
  return pts;
}
const conectar=(a,b,o)=>sinuoso(a,b,Object.assign({amp:0.08,ondas:1.6},o||{}));

/* ------------------------------------------------------------------- PREPARAR ----
   De los puntos de control a la línea que se consulta. Se guarda en c._p y sólo se rehace
   cuando ese camino cambia (el resto de los caminos del mundo no se tocan). */
const CELDA_IDX=4, ALCANCE=2.9;       // alcance extra más allá del borde: ruido, transición y piedras sueltas
function anchoEn(c,u){
  const a=c.anchos, base=c.params.ancho; if(!a) return base;
  const i=Math.min(c.puntos.length-2,Math.max(0,u|0)), f=clamp(u-i,0,1);
  const w0=(a[i]==null?base:a[i]), w1=(a[i+1]==null?base:a[i+1]); return w0+(w1-w0)*f;
}
let PREP=0;                              // cuenta de preparaciones: invalida la memoria de piedras
function preparar(c){
  PREP++;
  const P=c.puntos, n=P.length, p=c.params, st=c.semTrazado|0;
  const X=[], Y=[], U=[], V=[];
  const get=i=>P[clamp(i,0,n-1)];
  for(let i=0;i<n-1;i++){
    const p0=get(i-1), p1=get(i), p2=get(i+1), p3=get(i+2), L=Math.hypot(p2[0]-p1[0],p2[1]-p1[1]);
    const k=Math.max(1,Math.ceil(L/G_RAMPA));
    for(let j=0;j<k;j++){
      const t=j/k, t2=t*t, t3=t2*t;
      X.push(0.5*((2*p1[0])+(-p0[0]+p2[0])*t+(2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*t2+(-p0[0]+3*p1[0]-3*p2[0]+p3[0])*t3));
      Y.push(0.5*((2*p1[1])+(-p0[1]+p2[1])*t+(2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*t2+(-p0[1]+3*p1[1]-3*p2[1]+p3[1])*t3));
      U.push(i+t); V.push(c.vs[i]+(c.vs[i+1]-c.vs[i])*t);
    }
  }
  X.push(P[n-1][0]); Y.push(P[n-1][1]); U.push(n-1); V.push(c.vs[n-1]);
  const N=X.length;
  let S=new Array(N); S[0]=0; for(let i=1;i<N;i++) S[i]=S[i-1]+Math.hypot(X[i]-X[i-1],Y[i]-Y[i-1]);
  /* meandro: el eje no es la línea perfecta; se corre de lado con ruido lento, y se calma en los extremos */
  const A=0.10+0.85*p.irregularidad, Ltot=S[N-1];
  const X2=X.slice(), Y2=Y.slice();
  for(let i=0;i<N;i++){
    const a=Math.max(0,i-1), b=Math.min(N-1,i+1), tx=X[b]-X[a], ty=Y[b]-Y[a], tl=Math.hypot(tx,ty)||1;
    const tap=sstep(0,2.2,S[i])*sstep(0,2.2,Ltot-S[i]);
    const off=((vn(V[i]/8.5,0.5,st+21)-0.5)*2+(vn(V[i]/2.6,3.5,st+22)-0.5)*0.7)*A*tap;
    X2[i]=X[i]-ty/tl*off; Y2[i]=Y[i]+tx/tl*off;
  }
  S=new Array(N); S[0]=0; for(let i=1;i<N;i++) S[i]=S[i-1]+Math.hypot(X2[i]-X2[i-1],Y2[i]-Y2[i-1]);
  /* ancho: el de los puntos (o el base) por una variación que pasa lenta; y el final del camino */
  const W=new Array(N), fin=c.fin||'redondo', Lf=S[N-1];
  for(let i=0;i<N;i++){
    const dev=(vn(V[i]/7.5,0.5,st+31)-0.5)*2+(vn(V[i]/2.4,2.5,st+32)-0.5)*0.5;
    let w=anchoEn(c,U[i])*clamp(1+p.variacionAncho*0.62*dev,0.4,1.75);
    const dEnd=Lf-S[i];
    if(fin==='afila') w*=0.12+0.88*sstep(0,4.2,dEnd);
    else if(fin==='plaza') w*=1+0.85*sstep(3.2,0,dEnd);
    W[i]=Math.max(0.25,w);
  }
  /* índice de rejilla: cada tramo se anota en todas las celdas de 4 m que su ancho alcanza */
  const grid=new Map(); let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  for(let i=0;i<N-1;i++){
    const r=Math.max(W[i],W[i+1])*0.5+ALCANCE+0.4;
    const ax=Math.min(X2[i],X2[i+1])-r, bx=Math.max(X2[i],X2[i+1])+r, ay=Math.min(Y2[i],Y2[i+1])-r, by=Math.max(Y2[i],Y2[i+1])+r;
    x0=Math.min(x0,ax); x1=Math.max(x1,bx); y0=Math.min(y0,ay); y1=Math.max(y1,by);
    for(let gy=Math.floor(ay/CELDA_IDX);gy<=Math.floor(by/CELDA_IDX);gy++)
      for(let gx=Math.floor(ax/CELDA_IDX);gx<=Math.floor(bx/CELDA_IDX);gx++){
        const k=gx*65536+gy; let l=grid.get(k); if(!l){ l=[]; grid.set(k,l); } l.push(i);
      }
  }
  c._p={X:X2,Y:Y2,S,W,V,grid,N,largo:Lf};
  c._caja=[x0,y0,x1,y1];
  return c;
}

/* -------------------------------------------------------------------- CAMPO ----
   Variables de salida del último campo() (para no crear objetos por casilla). */
let _d=0,_s=0,_w=0,_lat=0,_v=0;
function campo(c,wx,wy){
  const p=c._p, l=p.grid.get(Math.floor(wx/CELDA_IDX)*65536+Math.floor(wy/CELDA_IDX)); if(!l) return false;
  const X=p.X,Y=p.Y; let best=1e18,bi=0,bt=0;
  for(let q=0;q<l.length;q++){
    const i=l[q], ax=X[i], ay=Y[i], dx=X[i+1]-ax, dy=Y[i+1]-ay, l2=dx*dx+dy*dy;
    let t=l2>0?((wx-ax)*dx+(wy-ay)*dy)/l2:0; t=t<0?0:t>1?1:t;
    const ex=wx-(ax+dx*t), ey=wy-(ay+dy*t), d2=ex*ex+ey*ey;
    if(d2<best){ best=d2; bi=i; bt=t; }
  }
  const i=bi, dx=X[i+1]-X[i], dy=Y[i+1]-Y[i];
  _d=Math.sqrt(best); _s=p.S[i]+(p.S[i+1]-p.S[i])*bt; _v=p.V[i]+(p.V[i+1]-p.V[i])*bt; _w=p.W[i]+(p.W[i+1]-p.W[i])*bt;
  _lat=((dx*(wy-Y[i])-dy*(wx-X[i]))>0?1:-1)*_d;
  return true;
}

/* ------------------------------------------------------------------- LA RED ----
   Todos los caminos del mundo. Un índice de 16 m dice cuáles pueden tocar un punto: el resto ni
   se mira. Tocar un camino sólo rehace ese camino. */
const RED={caminos:new Map(), idx:new Map(), version:0};
const CH=16;
function indexar(c,quitar){
  const b=c._caja; if(!b) return;
  for(let gy=Math.floor(b[1]/CH);gy<=Math.floor(b[3]/CH);gy++)
    for(let gx=Math.floor(b[0]/CH);gx<=Math.floor(b[2]/CH);gx++){
      const k=gx*65536+gy; let l=RED.idx.get(k);
      if(quitar){ if(l){ const i=l.indexOf(c); if(i>=0) l.splice(i,1); if(!l.length) RED.idx.delete(k); } }
      else { if(!l){ l=[]; RED.idx.set(k,l); } l.push(c); }
    }
}
let _autoId=1;
function nuevo(o){
  const fam=o.familia||'tierra'; if(!FAMILIAS[fam]) throw new Error('familia desconocida: '+fam);
  if(!Array.isArray(o.puntos)||o.puntos.length<2) throw new Error('un camino necesita al menos dos puntos');
  const pts=o.puntos.map(q=>[+(+q[0]).toFixed(3),+(+q[1]).toFixed(3)]);
  /* vs: la coordenada ESTABLE de cada punto de control. Nace como metros de recorrido y ya no cambia, aunque se
     muevan, inserten o quiten puntos: el meandro, el ancho y la textura a lo largo del camino cuelgan de ella,
     y por eso editar un punto no corre la textura de todo lo que viene después. */
  let vs=o.vs&&o.vs.length===pts.length?o.vs.slice():null;
  if(!vs){ vs=[0]; for(let i=1;i<pts.length;i++) vs.push(vs[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1])); }
  const c={id:o.id||('camino-'+(_autoId++)), familia:fam, puntos:pts, vs,
    anchos:o.anchos?o.anchos.slice():null, params:Object.assign({},FAMILIAS[fam].def,o.params||{}),
    semTrazado:(o.semTrazado===undefined?o.semilla:o.semTrazado)|0, semTextura:(o.semTextura===undefined?o.semilla:o.semTextura)|0,
    fin:o.fin||'redondo', sectores:(o.sectores||[]).map(s=>Object.assign({},s)), _p:null, _caja:null};
  return preparar(c);
}
function agregar(c){ if(RED.caminos.has(c.id)) quitar(c.id); RED.caminos.set(c.id,c); indexar(c); RED.version++; return c; }
function quitar(id){ const c=RED.caminos.get(id); if(!c) return null; indexar(c,true); RED.caminos.delete(id); RED.version++; return c; }
function vaciar(){ RED.caminos.clear(); RED.idx.clear(); RED.version++; }
const unir=(a,b)=>!a?(b&&b.slice()):!b?a.slice():[Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[2],b[2]),Math.max(a[3],b[3])];
/* caja de los tramos del camino cuya coordenada estable cae en [va,vb], con el alcance de lo que pinta */
function cajaV(p,va,vb){
  let b=null;
  for(let i=0;i<p.N;i++){
    if(p.V[i]<va||p.V[i]>vb) continue;
    const r=p.W[i]*0.5+ALCANCE+0.4; b=unir(b,[p.X[i]-r,p.Y[i]-r,p.X[i]+r,p.Y[i]+r]);
  }
  return b;
}
/* Toda edición devuelve la caja que cambió. Si se pasa `rango` (va,vb en coordenada estable) sólo se
   cuenta esa parte del camino: mover un punto no ensucia el camino entero. Sin rango, todo el camino. */
function editar(c,f,rango){
  const enRed=RED.caminos.get(c.id)===c, antes=c._caja&&c._caja.slice(), p0=c._p;
  const r=rango?rango(c):null;
  if(enRed) indexar(c,true);
  f(c); preparar(c);
  if(enRed){ indexar(c); RED.version++; }
  if(!r) return unir(antes,c._caja);
  return unir(cajaV(p0,r[0],r[1]),cajaV(c._p,r[0],r[1]));
}
/* la zona que toca un punto de control i: el tramo de Catmull-Rom entre j y j+1 usa los puntos j-1..j+2, así que
   mover i cambia los tramos de i-2 a i+2 */
const rangoPunto=(i,ext)=>c=>{ const n=c.vs.length, a=i-(ext||2), b=i+(ext||2);
  return [a<0?-Infinity:c.vs[a], b>n-1?Infinity:c.vs[b]]; };
const E={
  moverPunto:(c,i,x,y)=>editar(c,q=>{ q.puntos[i]=[+x.toFixed(3),+y.toFixed(3)]; },rangoPunto(i)),
  /* insertar ANTES del índice i (entre i-1 e i): el punto nuevo hereda una coordenada estable intermedia */
  insertarPunto:(c,i,x,y,w)=>editar(c,q=>{
    const a=q.puntos[i-1], b=q.puntos[i], da=a?Math.hypot(x-a[0],y-a[1]):0, db=b?Math.hypot(x-b[0],y-b[1]):0;
    const va=q.vs[i-1], vb=q.vs[i], v=(a&&b)?va+(vb-va)*(da/Math.max(1e-6,da+db)):a?va+da:vb-db;
    q.puntos.splice(i,0,[+x.toFixed(3),+y.toFixed(3)]); q.vs.splice(i,0,v); if(q.anchos) q.anchos.splice(i,0,w==null?null:w); },rangoPunto(i)),
  quitarPunto:(c,i)=>{ if(c.puntos.length<=2) throw new Error('un camino necesita al menos dos puntos');
                       return editar(c,q=>{ q.puntos.splice(i,1); q.vs.splice(i,1); if(q.anchos) q.anchos.splice(i,1); },rangoPunto(i)); },
  fijarAncho:(c,i,w)=>editar(c,q=>{ if(!q.anchos) q.anchos=q.puntos.map(()=>null); q.anchos[i]=w; },rangoPunto(i)),
  cambiarFamilia:(c,fam,conservar)=>{ if(!FAMILIAS[fam]) throw new Error('familia desconocida: '+fam);
    return editar(c,q=>{ q.familia=fam; q.params=Object.assign({},FAMILIAS[fam].def,conservar?q.params:{});
      for(const k of Object.keys(q.params)) if(!aplica(fam,k)) delete q.params[k]; }); },
  fijarParametro:(c,k,v)=>{ if(!PARAMS[k]) throw new Error('parámetro desconocido: '+k);
    return editar(c,q=>{ q.params[k]=clamp(+v,PARAMS[k].min,PARAMS[k].max); }); },
  /* la textura cambia y el trazado no: sólo se toca semTextura */
  regenerarTextura:(c,sem)=>editar(c,q=>{ q.semTextura=sem===undefined?(hash3(q.semTextura|0,RED.version+1,77)&0xffff):sem|0; }),
  /* un tramo del camino (de s0 a s1 metros desde el comienzo) con otra familia: tierra que pasa a empedrado */
  sectorear:(c,s0,s1,fam,params)=>{ if(!FAMILIAS[fam]) throw new Error('familia desconocida: '+fam);
    const v0=Math.min(vDeS(c,s0),vDeS(c,s1)), v1=Math.max(vDeS(c,s0),vDeS(c,s1));
    return editar(c,q=>{ q.sectores=q.sectores.filter(s=>v1<=s.v0||v0>=s.v1);
      q.sectores.push({v0,v1,familia:fam,params:Object.assign({},params||{})});
      q.sectores.sort((a,b)=>a.v0-b.v0); },()=>[v0-1.5,v1+1.5]); },
  quitarSector:(c,s)=>{ const v=vDeS(c,s), t=c.sectores.find(q=>v>=q.v0&&v<=q.v1);
    return editar(c,q=>{ q.sectores=q.sectores.filter(x=>x!==t&&!(t&&x.v0===t.v0&&x.v1===t.v1)); },t?()=>[t.v0-1.5,t.v1+1.5]:null); },
  fijarFin:(c,fin)=>editar(c,q=>{ q.fin=fin; })
};
/* de metros de recorrido a coordenada estable (los sectores se guardan en esta última) */
function vDeS(c,s){
  const p=c._p; s=clamp(s,0,p.largo); let i=0; while(i<p.N-2&&p.S[i+1]<s) i++;
  return p.V[i]+(p.V[i+1]-p.V[i])*((s-p.S[i])/Math.max(1e-6,p.S[i+1]-p.S[i]));
}
/* un punto sobre el eje de un camino, a la fracción f de su largo (para nacer una bifurcación) */
function puntoEn(c,f){
  const p=c._p, s=clamp(f,0,1)*p.largo; let i=0; while(i<p.N-2&&p.S[i+1]<s) i++;
  const t=(s-p.S[i])/Math.max(1e-6,p.S[i+1]-p.S[i]), x=p.X[i]+(p.X[i+1]-p.X[i])*t, y=p.Y[i]+(p.Y[i+1]-p.Y[i])*t;
  const dx=p.X[i+1]-p.X[i], dy=p.Y[i+1]-p.Y[i], l=Math.hypot(dx,dy)||1;
  return {x,y,tx:dx/l,ty:dy/l,ancho:p.W[i]+(p.W[i+1]-p.W[i])*t,s};
}
/* una bifurcación: un camino nuevo que nace del eje de otro en la fracción f y va hacia el punto "hacia".
   Arranca con el ancho del padre y siguiendo su dirección, para que el empalme sea de a poco y no un clavo. */
function bifurcar(padre,f,hacia,o){
  o=o||{}; const q=puntoEn(padre,f), L=Math.hypot(hacia[0]-q.x,hacia[1]-q.y), a=Math.min(3.2,L*0.35);
  const med=[q.x+q.tx*a,q.y+q.ty*a];
  const pts=[[q.x,q.y],med].concat(sinuoso(med,hacia,{amp:o.amp===undefined?0.06:o.amp,ondas:1.2,semilla:o.semilla|0}).slice(1));
  return nuevo({familia:o.familia||padre.familia,puntos:pts,params:Object.assign({},padre.params,{ancho:o.ancho||padre.params.ancho*0.8},o.params||{}),
    anchos:[q.ancho*0.9],semTrazado:o.semilla|0,semTextura:padre.semTextura,fin:o.fin||'afila',id:o.id});
}

/* ----------------------------------------------------------------- SUPERFICIE ---- */
const sal={g:32,c:0};                           // glifo y color de la última casilla que se pintó
let _eB=0,_dB=0,_sB=0,_wB=0,_latB=0,_vB=0;
const smin=(a,b,k)=>{ const h=clamp(0.5+0.5*(b-a)/k,0,1); return b+(a-b)*h-k*h*(1-h); };

/* qué familia manda en la posición s del camino: los sectores cambian la familia con una mezcla por ruido */
let _fam=null,_par=null;
function familiaEn(c,wx,wy,v){
  _fam=FAMILIAS[c.familia]; _par=c.params;
  const S=c.sectores; if(!S.length) return;
  for(let i=0;i<S.length;i++){
    const q=S[i], ent=sstep(q.v0-0.9,q.v0+0.9,v), sal2=1-sstep(q.v1-0.9,q.v1+0.9,v), m=Math.min(ent,sal2);
    if(m<=0) continue;
    if(m>=1||vn(wx*4.1,wy*4.1,c.semTextura+90+i)<m){ _fam=FAMILIAS[q.familia]; _par=Object.assign({},FAMILIAS[q.familia].def,q.params); return; }
  }
}
/* luz y tono de una casilla */
const lum=(lf)=>clamp(lf,0.15,1.5);

/* ---- piedritas sueltas o incrustadas de la tierra: baldosas de 0.7 m con a lo sumo una piedra ---- */
function piedritaTierra(c,P,wx,wy,z,k,fuera){
  const T=0.7, tx=Math.floor(wx/T), ty=Math.floor(wy/T), h=hash3(tx,ty,z+201);
  const dens=clamp(P.particulas,0,1.6)*(fuera?0.55:1)*(0.30+0.9*vn(wx/5,wy/5,z+202));
  if(((h&1023)/1023)>0.34*dens) return false;
  const px=(tx+0.2+0.6*(((h>>10)&255)/255))*T, py=(ty+0.2+0.6*(((h>>18)&255)/255))*T;
  const r=P.piedra*0.5*Math.max(0.28,1+P.variacionPiedra*(((h>>4)&255)/255-0.5)*2.4)*(fuera?0.7:1);
  const dx=wx-px, dy=wy-py, d=Math.hypot(dx,dy*1.0); if(d>r) return false;
  /* las incrustadas (antigua) sólo muestran la parte de arriba */
  if(_fam.antigua&&!fuera){ const ang=((h>>6)&255)/255*6.283, enterrada=0.25+0.45*(((h>>14)&255)/255);
    if((dx*Math.cos(ang)+dy*Math.sin(ang))/r>1-2*enterrada) return false; }
  const lit=(dx*-0.6+dy*-0.8)/(d+1e-3), sh=clamp(0.55+0.34*lit-0.25*(d/r),0,1);
  sal.g=sh>0.62?ch('o'):sh>0.36?ch('\u00b0'):ch(',');
  const tono=((h>>2)&255)/255;
  sal.c=lerpPal(PAL.piedraTierra,0.25+0.55*sh+0.2*tono*P.tonos,lum(k));
  return true;
}

/* ================================================================== TIERRA ====
   Capas por nivel de detalle:
     0  manchas de tono y de densidad, centro compactado, piedritas
     1  + huellas de carros (roderas) rotas, canalitos de erosión, zonas secas y oscuras
     2  + grietas finas de secado, borde elevado (labio), destellos de granos, matas que invaden */
function tierra(c,wx,wy,cx,cy,k,e){
  const P=_par, z=c.semTextura|0, det=P.detalle|0, antigua=_fam.antigua;
  const w=_w, lat01=clamp(Math.abs(_lat)/(0.5*w),0,1);
  const m1=tex(wx,wy,1.5,z+3), m2=tex(wx,wy,0.45,z+7), m3=tex(wx,wy,6.5,z+11);
  /* zona seca/oscura: las manchas grandes mandan entre ocre claro y tierra oscura */
  let seca=sstep(0.38,0.64,m3);
  /* compactación: el centro y los tramos transitados */
  const tramo=vn(_v/3.4,0.5,z+13);
  const compact=clamp(sstep(1.0,0.05,lat01)*(0.55+0.55*tramo)*(0.55+0.6*P.desgaste),0,1);
  let tono=0.28+0.30*m1+0.30*(m3-0.5)*(0.6+P.tonos*1.8)+0.34*(H(cx,cy,5)-0.5)*P.tonos*0.55+0.22*compact-0.16*sstep(0.55,1,lat01)+0.06*(m2-0.5);
  let q=(0.30+0.46*m2+0.26*(1-compact)+0.12*(m1-0.5)+(H(cx,cy,4)-0.5)*0.62)*P.densidad;
  /* roderas (detalle ≥1): dos surcos a ambos lados del eje, cortados por manchas */
  let rodera=0;
  if(det>=1){
    const dist=Math.abs(Math.abs(_lat)-0.27*w), ancho=0.10+0.05*w;
    if(dist<ancho){ const roto=sstep(0.34,0.56,vn(_v/1.9,_lat/0.2,z+17)); rodera=(1-dist/ancho)*roto*(0.35+0.75*P.irregularidad)*(w>1.2?1:0.4); }
    /* canalitos de erosión, largos en el sentido del camino */
    const er=vn(_v/2.4,_lat/0.16,z+19), canal=sstep(0.70,0.80,er)*sstep(0.30,0.55,P.irregularidad+0.25*seca+0.15);
    if(canal>0){ q+=0.34*canal; tono-=0.18*canal; }
  }
  if(rodera>0){ q+=0.38*rodera; tono-=0.20*rodera; }
  /* labio del borde (detalle 2): una línea un poco levantada y más oscura donde empieza el camino */
  let labio=0;
  if(det>=2&&e>-0.30){ labio=sstep(-0.30,-0.06,e)*(0.5+0.5*vn(wx*2,wy*2,z+23)); tono-=0.22*labio; q+=0.22*labio; }
  /* grietas finas de secado (detalle 2; más en lo antiguo y en lo seco) */
  if(det>=2){
    const gk=vn(wx*1.3,wy*1.7,z+29);
    if(Math.abs(gk-0.5)<0.016*(0.6+seca+(antigua?0.8:0))&&compact>0.2){
      sal.g=((H(cx,cy,3)*3)|0)===0?ch('/'):((H(cx,cy,3)*3)|0)===1?ch('\\'):ch('-');
      sal.c=lerpPal(PAL.tierra,0.10+0.16*tono,lum(k)); return true;
    }
  }
  /* piedritas, sueltas o incrustadas */
  if(piedritaTierra(c,P,wx,wy,z,k,false)) return true;
  /* destellos de granos claros */
  if(det>=2&&H(cx,cy,9)<0.020*P.densidad){ sal.g=ch('.'); sal.c=lerpPal(PAL.tierraSeca,0.78+0.2*H(cx,cy,10),lum(k)); return true; }
  /* el glifo por densidad; el color por tono, entre tierra oscura y ocre/arena */
  const pool=q<0.38?POOL_RALO:q<0.62?POOL_MEDIO:POOL_TUPIDO;
  sal.g=pool[(H(cx,cy,6)*pool.length)|0];
  const pal=seca>0.5?PAL.tierraSeca:PAL.tierra;
  sal.c=lerpPal(pal,clamp(tono+0.16*(seca-0.4)+(antigua?0.10:0),0,1),lum(k*(1.0+0.28*H(cx,cy,12)*P.tonos+0.10)));
  return true;
}

/* ============================================================== EMPEDRADO ====
   Adoquines irregulares por diagrama de potencia: una rejilla jitterizada de sitios, cada uno con
   su propio radio (tamaño). Cada casilla pertenece al sitio más cercano en el sentido ponderado; la
   diferencia con el segundo da la junta. No hay mosaico: la rejilla se desplaza con ruido y cada
   piedra tiene su forma, su altura, su tono y su desgaste. */
const ST={ci:0,cj:0,sx:0,sy:0,rad:1,alto:0,hh:0,depth:0,dist:0,jx:0,jy:0,hj:0,dx:0,dy:0};
function piedras(wx,wy,T,vt,z){
  const ci=Math.floor(wx/T), cj=Math.floor(wy/T);
  let f1=1e9,f2=1e9;
  for(let j=-1;j<=1;j++) for(let i=-1;i<=1;i++){
    const gi=ci+i, gj=cj+j, h=hash3(gi,gj,z);
    const sx=(gi+0.16+0.68*((h&1023)/1023))*T, sy=(gj+0.16+0.68*(((h>>10)&1023)/1023))*T;
    const rad=T*0.5*(1+vt*(((h>>20)&511)/511-0.5)*1.5);
    const dx=wx-sx, dy=wy-sy, dd=Math.sqrt(dx*dx+dy*dy)-rad;
    if(dd<f1){ f2=f1; ST.jx=ST.sx; ST.jy=ST.sy; ST.hj=ST.alto;
      f1=dd; ST.ci=gi; ST.cj=gj; ST.sx=sx; ST.sy=sy; ST.rad=rad; ST.alto=((h>>3)&255)/255; ST.hh=h; ST.dx=dx; ST.dy=dy; ST.dist=Math.sqrt(dx*dx+dy*dy);
    } else if(dd<f2){ f2=dd; ST.jx=sx; ST.jy=sy; ST.hj=((h>>3)&255)/255; }
  }
  ST.depth=(f2-f1)*0.5;                           // metros hasta la junta, hacia adentro de la piedra
}
/* ¿pertenece esta piedra al camino? Se decide por el sitio, no por la casilla, y se recuerda.
   Así el borde del camino sigue el contorno de las piedras, que es lo que se ve en un empedrado de verdad. */
const _sitio=new Map(); let _sitioV=-1;
let _lista=null;                                 // los caminos que se consultan ahora (los fija celda / celdaRed)
function enLista(x,y){ let m=1e9; for(let i=0;i<_lista.length;i++){ const q=eBorde(_lista[i],x,y); if(q<m) m=q; } return m; }
function sitioEn(sx,sy,z){
  if(_sitioV!==PREP||_sitio.size>40000){ _sitio.clear(); _sitioV=PREP; }
  const key=Math.round(sx*50)*131071+Math.round(sy*50)+z*7919;
  let v=_sitio.get(key); if(v!==undefined) return v;
  v=enLista(sx,sy);                               // metros del sitio al borde del camino (con ruido de borde)
  _sitio.set(key,v); return v;
}
function empedrado(c,wx,wy,cx,cy,k,e){
  const P=_par, z=c.semTextura|0, det=P.detalle|0, antigua=_fam.antigua, desg=P.desgaste;
  const T=Math.max(0.12,P.piedra), sep=P.separacion;
  piedras(wx,wy,T,P.variacionPiedra,z+50);
  const rad=ST.rad, eS=sitioEn(ST.sx,ST.sy,z+(c.familia.length<<9));
  const tr=0.12+0.55*P.transicion;
  const enCamino=eS<rad*0.35;
  const profundidad=ST.depth-sep*0.5;              // >0 adentro de la piedra, <0 en la junta
  const lit=(ST.dx*-0.6+ST.dy*-0.8)/(ST.dist+1e-3);
  /* piedras sueltas fuera del camino (la transición): pequeñas y sin juntas visibles */
  if(!enCamino){
    if(eS<rad*0.35+tr*1.4&&H(ST.ci,ST.cj,z+61)<0.5*P.particulas*(1-clamp((eS-rad*0.35)/(tr*1.4),0,1))&&ST.dist<rad*0.55){
      const sh=clamp(0.5+0.35*lit-0.3*ST.dist/(rad*0.55),0,1);
      sal.g=sh>0.6?ch('o'):sh>0.3?ch(':'):ch(',');
      sal.c=lerpPal(PAL.piedraTierra,0.25+0.5*sh,lum(k)); return true;
    }
    /* tierra acumulada contra el borde: sólo en la franja pegada al camino */
    if(e<tr&&e>-0.25&&H(cx,cy,71)<0.55*P.transicion*(1-clamp(e/tr,0,1))){
      sal.g=RAMPA_TIERRA[1+((H(cx,cy,72)*3)|0)]; sal.c=lerpPal(PAL.tierraJunta,0.2+0.6*H(cx,cy,73),lum(k)); return true;
    }
    return false;
  }
  /* ---- junta: tierra oscura; en lo antiguo, con tierra acumulada más clara y a veces una mata ---- */
  if(profundidad<=0){
    const ac=det>=1?clamp((0.30+desg*(antigua?0.9:0.5)+0.3*P.particulas)*P.densidad,0,1):0;
    if(det>=2&&H(cx,cy,81)<0.10*desg*P.particulas*(0.4+0.8*tex(wx,wy,1.1,z+83))){
      sal.g=H(cx,cy,82)<0.5?ch('"'):ch(','); sal.c=lerpPal(PAL.musgo,0.2+0.7*H(cx,cy,84),lum(k)); return true;
    }
    if(H(cx,cy,85)<ac*0.62){
      sal.g=RAMPA_TIERRA[2+((H(cx,cy,86)*3)|0)]; sal.c=lerpPal(PAL.tierraJunta,0.25+0.7*H(cx,cy,87)*(0.5+ac),lum(k));
    } else { sal.g=H(cx,cy,88)<0.4?32:ch(H(cx,cy,89)<0.5?'.':','); sal.c=lerpPal(PAL.junta,H(cx,cy,90),lum(k)); }
    return true;
  }
  /* ---- cuerpo de la piedra ---- */
  const dome=sstep(0,1,profundidad/(0.55*rad+0.01));
  /* el relieve: el borde que mira a la luz se aclara si la piedra es más alta que su vecina, y el contrario se oscurece */
  let lip=0;
  if(det>=1&&profundidad<0.12){
    const bx=ST.jx-ST.sx, by=ST.jy-ST.sy, bl=Math.hypot(bx,by)||1, hacia=(bx*-0.6+by*-0.8)/bl, rel=ST.alto-ST.hj;
    lip=(rel>0?hacia:-Math.abs(hacia)*0.6)*Math.abs(rel)*(1-profundidad/0.12)*(0.6+0.8*P.irregularidad);
  }
  /* zona de tono: manchones de piedra clara u oscura en el empedrado antiguo */
  const zona=tex(wx,wy,5.5,z+95);
  const ton=H(ST.ci,ST.cj,z+91), tonA=H(ST.ci,ST.cj,z+92);
  let pal=ton<0.5?PAL.piedraGris:ton<0.82?PAL.piedraParda:PAL.piedraOscura;
  if(det>=1&&antigua&&zona>0.62&&ton<0.7) pal=PAL.piedraOscura;
  let sh=0.40+0.30*dome+0.40*lit*(1-0.40*dome)+lip*(det>=2?1.5:1.1)+(tonA-0.5)*0.35*P.tonos*(det>=1?1:0.4)+(det>=1?(zona-0.5)*0.30*P.tonos:0);
  sh+=(H(cx,cy,103)-0.5)*0.30*P.densidad;            // grano de la piedra: ninguna cara es lisa
  if(H(cx,cy,104)<0.10*P.densidad*P.densidad){ sal.g=H(cx,cy,105)<0.5?ch('.'):ch(':'); sal.c=lerpPal(pal,clamp(0.15+sh*0.6,0,1),lum(k*0.8)); return true; }   // motitas: picaduras y granos
  sh=0.52+(sh-0.52)*(1-0.42*desg);                  // lo gastado pierde contraste
  /* grieta fina dentro de la piedra (detalle 2 o lo antiguo muy gastado) */
  if((det>=2||(antigua&&det>=1))&&H(ST.ci,ST.cj,z+97)<0.26*(0.35+desg)){
    const ang=H(ST.ci,ST.cj,z+98)*3.1416, off=(H(ST.ci,ST.cj,z+99)-0.5)*rad*0.7;
    const dl=ST.dx*Math.cos(ang)+ST.dy*Math.sin(ang)-off;
    if(Math.abs(dl)<0.032&&ST.dist<rad*0.92){
      const a=ang%3.1416; sal.g=(a<0.5||a>2.6)?ch('-'):a<1.4?ch('\\'):ch('/');   // la grieta corre a lo largo
      sal.c=lerpPal(PAL.junta,0.8,lum(k)); return true;
    }
  }
  let gi=clamp(Math.round(sh*4.6-0.2),0,4);
  if(desg>0.55&&gi>=3&&H(cx,cy,101)<(desg-0.45)) gi--;       // lo muy gastado se alisa: menos '8' y '0'
  sal.g=RAMPA_PIEDRA[gi];
  sal.c=lerpPal(pal,clamp(0.12+sh*0.95,0,1),lum(k*(0.88+0.12*H(cx,cy,102))));
  return true;
}

/* ================================================================== CELDA ====
   La casilla (wx,wy) en metros del mundo; (cx,cy) su índice de celda (para el grano fino, que es
   estable mientras el zoom no cambie); lf la luz. Devuelve true si el camino pinta esa casilla
   (glifo y color en sal.g, sal.c) y false si no: ahí queda el pasto. */
const ampBorde=P=>0.04+0.85*P.bordes;
function bordeRuido(c,wx,wy){
  /* la silueta gruesa del borde es del TRAZADO; sólo el temblor fino es de la textura. Regenerar la textura
     deja el camino con la misma forma */
  const z=c.semTextura|0, t=c.semTrazado|0;
  return 0.62*(vn(wx/2.3,wy/2.3,t+41)*2-1)+0.28*(vn(wx/0.7,wy/0.7,t+42)*2-1)+0.10*(vn(wx/0.22,wy/0.22,z+43)*2-1);
}
function eBorde(c,wx,wy){
  if(!campo(c,wx,wy)) return 9;
  return _d-_w*0.5-bordeRuido(c,wx,wy)*ampBorde(c.params);
}
function celdaRed(wx,wy,k,cx,cy,lista){
  if(!lista){ lista=RED.idx.get(Math.floor(wx/CH)*65536+Math.floor(wy/CH)); if(!lista) return false; }
  let mejor=null,e1=1e9,e2=1e9;
  for(let i=0;i<lista.length;i++){
    const c=lista[i], b=c._caja; if(wx<b[0]||wx>b[2]||wy<b[1]||wy>b[3]) continue;
    if(!campo(c,wx,wy)) continue;
    const e=_d-_w*0.5-bordeRuido(c,wx,wy)*ampBorde(c.params);
    if(e<e1){ e2=e1; e1=e; mejor=c; _eB=e; _dB=_d; _sB=_s; _vB=_v; _wB=_w; _latB=_lat; } else if(e<e2) e2=e;
  }
  if(!mejor) return false;
  /* dos caminos que se juntan: el borde se funde con un mínimo suave, así el empalme se ensancha de a poco */
  let e=e2<9?smin(e1,e2,0.55):e1;
  _d=_dB; _s=_sB; _v=_vB; _w=_wB; _lat=_latB;
  _lista=lista;
  return superficie(mejor,wx,wy,k,cx,cy,e);
}
function celda(c,wx,wy,k,cx,cy){
  const b=c._caja; if(wx<b[0]||wx>b[2]||wy<b[1]||wy>b[3]) return false;
  if(!campo(c,wx,wy)) return false;
  const e=_d-_w*0.5-bordeRuido(c,wx,wy)*ampBorde(c.params);
  _lista=[c];
  return superficie(c,wx,wy,k,cx,cy,e);
}
function superficie(c,wx,wy,k,cx,cy,e){
  familiaEn(c,wx,wy,_v);
  const P=_par, tr=0.12+0.55*P.transicion;
  if(_fam.clase==='empedrado'){
    /* el empedrado decide por piedra, así que se pregunta cerca del camino: hasta el alcance de las sueltas */
    if(e>tr*1.4+0.9) return false;
    const eCampo=e;
    return empedrado(c,wx,wy,cx,cy,k,eCampo);
  }
  /* tierra: afuera, piedras sueltas y migas; en la franja de transición el camino se deshilacha en el pasto */
  if(e>0){
    if(e>tr+1.1) return false;
    if(e>tr){ if(P.particulas>0&&piedritaTierra(c,P,wx,wy,c.semTextura|0,k,true)) return true; return false; }
    const keep=Math.pow(1-e/tr,1.25);
    if(H(cx,cy,61)>=keep*0.96) return piedritaTierra(c,P,wx,wy,c.semTextura|0,k,true);
    sal.g=RAMPA_TIERRA[1+((H(cx,cy,62)*3)|0)];
    sal.c=lerpPal(PAL.tierra,0.18+0.38*H(cx,cy,63),lum(k*(0.8+0.2*keep)));
    return true;
  }
  /* adentro cerca del borde, a veces el pasto invade: sólo con transición y detalle */
  if(P.transicion>0&&e>-0.8){
    const inv=(P.transicion*0.42+(_fam.antigua?0.16:0))*sstep(-0.8,-0.05,e)*sstep(0.50,0.74,tex(wx,wy,0.9,(c.semTextura|0)+40));
    if(H(cx,cy,64)<inv*(P.detalle>=1?1:0.6)) return false;
  }
  return tierra(c,wx,wy,cx,cy,k,e);
}

/* --------------------------------------------------------------------- DATOS ----
   Lo que el Modo Dios guardará (más adelante, dentro de `rasgos` del mundo editable: ver
   docs/DISENO.md; ese formato hay que ampliarlo al integrar, no ahora). */
function aDatos(c){
  return {id:c.id,tipo:'camino',puntos:c.puntos.map(q=>[q[0],q[1]]),
    camino:{familia:c.familia,params:Object.assign({},c.params),vs:c.vs.slice(),anchos:c.anchos?c.anchos.slice():null,
      semTrazado:c.semTrazado,semTextura:c.semTextura,fin:c.fin,sectores:c.sectores.map(s=>Object.assign({},s))}};
}
function deDatos(d){
  const q=d.camino||{};
  return nuevo({id:d.id,familia:q.familia,puntos:d.puntos,vs:q.vs,params:q.params,anchos:q.anchos,semTrazado:q.semTrazado,
    semTextura:q.semTextura,fin:q.fin,sectores:q.sectores});
}

NV.caminos={FAMILIAS,PARAMS,VARIANTES,PAL,sal,red:RED,
  parametrosDe,variante,nuevo,preparar,agregar,quitar,vaciar,editar:E,puntoEn,bifurcar,
  recto,curvo,sinuoso,sendero,conectar,
  vDeS,campo:(c,x,y)=>campo(c,x,y)?{d:_d,s:_s,v:_v,w:_w,lat:_lat}:null,
  celda,celdaRed,aDatos,deDatos,_tex:tex,_vn:vn};

/* Alta en el registro: estado 'pendiente' = todavía no lo usa el juego. */
if(NV.motores) NV.motores.registrar({id:'caminos',nombre:'Caminos, tierra y empedrados',estado:'pendiente',
  archivo:'src/juego/caminos.js',preview:'preview/caminos.html',prueba:'pruebas/caminos.js',
  caras:{generar:o=>NV.caminos.nuevo(o), dibujar:celdaRed,
         editor:{parametros:PARAMS,familias:Object.keys(FAMILIAS).reduce((a,f)=>{ a[f]={nombre:FAMILIAS[f].nombre,parametros:parametrosDe(f)}; return a; },{}),
                 herramientas:['trazar','ancho','familia','regenerar-textura','borrar','bifurcar','sector']}}});
})(window.NV);

/* Nativa Online — SUB-MUNDOS: el Umbral del Modo Dios y el interior de cueva que hay del otro lado.
   Un UMBRAL es un objeto del mundo {k:'umbral', r:{nombre, mundo, dir, cueva}}: se coloca en el Modo Dios (botón "Umbral"), pregunta cómo
   se llama el sub-mapa y de qué mundo es, y trae una cueva aleatoria que se puede editar (clic sobre él). La receta de la cueva VIVE EN EL
   OBJETO: viaja con el archivo del mundo y no hay otro lugar donde guardarla. En el juego es invisible; sólo el Modo Dios lo muestra.

   Cruzarlo (umbrales.js hace la cuenta) deja al personaje en el interior: el mapa de la cueva con la boca OBLIGATORIA, que lleva atado el
   umbral de vuelta. Pisarlo otra vez devuelve a quien camina a la casilla de afuera, frente a la entrada. Una cueva por umbral; el id del
   sub-mundo sale de donde está el umbral ('sub:x,y').

   ADENTRO el juego sigue siendo el mismo: el personaje camina por casillas de un metro con el mismo movimiento, las mismas rutas por toque y la
   misma cámara. Lo único que cambia es qué responden NV.sueloEn / NV.solidoEn / NV.alturaEn (se cambian por las de la cueva al entrar y se
   devuelven al salir; afuera no cuestan nada) y quién dibuja el cuadro (dibujarEscena, que llama a NV.cuevas.pintar con la linterna).
   La boca se dibuja con un embudo de luz del día que entra; el resto de la luz la pone el motor de cuevas.

   El listado de sub-mundos del Modo Dios (botón "mundos") sale de los umbrales colocados: nombre, tipo y el cuadrante (panel) donde está.
   Pruebas: pruebas/subescenas.js. Ver docs/DISENO.md ("Sub-mundos"). */
(function(NV){
'use strict';
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const DIRS={norte:[0,-1],este:[1,0],sur:[0,1],oeste:[-1,0],noreste:[0.7071,-0.7071],noroeste:[-0.7071,-0.7071]};
const DIR_TXT=[['norte','hacia el norte'],['noreste','hacia el noreste'],['este','hacia el este'],['sur','hacia el sur'],['oeste','hacia el oeste'],['noroeste','hacia el noroeste']];
const ID='umbral:umbral';
const MUNDOS=[['cueva','cueva']];                     // más adelante: casa, sótano, ruina…
const TIPOS_ALEA=['galeria','camara','caverna','cuevaAgua'];
const MATS_ALEA=['caliza','caliza','caliza','basalto','arenisca'];
const $e=id=>document.getElementById(id);
const azar=()=>(NV.azarEditor||Math.random)();
const idDe=o=>'sub:'+o.x+','+o.y;
const rumboDeVec=(dx,dy)=>Math.abs(dy)>=Math.abs(dx)?(dy<0?'norte':'sur'):(dx>0?'este':'oeste');

let ESC=null;                    // el sub-mundo en el que se está (null = el mundo de siempre)
let ORIG=null;                   // las funciones del mundo de afuera, mientras se está adentro
let SUBS=new Map();              // id -> {id,nombre,mundo,x,y,spec,dentro?,listo}
let vSync=-1;
const J={mapa:'mundo',x:0,y:0,sobre:null};
let PEND=null;

/* ------------------------------------------------------------------ LA RECETA ---- */
function limpiar(s){
  s=s||{};
  const cueva=NV.cuevas.limpiar(Object.assign({},s.cueva||{},{salidas:1}));
  return {nombre:String(s.nombre==null?'':s.nombre).slice(0,40)||'Sin nombre', mundo:'cueva', dir:DIRS[s.dir]?s.dir:'norte', cueva};
}
const aObjeto=spec=>{ const r=limpiar(spec); return {k:'umbral',h:1,s:r.cueva.sem,r}; };
const deObjeto=o=>({id:ID,spec:limpiar(o.r)});

/* ¿se puede recorrer la cueva por casillas de un metro, desde su boca? Cuenta las casillas alcanzables y las compara con todas las libres. */
const CAM_CACHE=new Map();
function caminable(spec){
  const sp=NV.cuevas.limpiar(spec), clave=JSON.stringify(sp);
  if(CAM_CACHE.has(clave)) return CAM_CACHE.get(clave);
  const S=NV.cuevas.crear(sp), B=S.g.box, bocas=NV.cuevas.entradas(S);
  const x0=Math.floor(B.umin), x1=Math.ceil(B.umax), z0=Math.floor(B.zmin), z1=Math.ceil(B.zmax), W=x1-x0, H=z1-z0;
  const L=new Uint8Array(W*H); let libres=0;
  for(let j=0;j<H;j++) for(let i=0;i<W;i++) if(NV.cuevas.libre(S,x0+i+0.5,z0+j+0.5)){ L[j*W+i]=1; libres++; }
  let res={ok:false,celdas:0,libres,total:libres};
  if(bocas.length&&libres){
    const e=bocas[0]; let sx=-1,sz=-1,bd=1e9;
    for(let j=0;j<H;j++) for(let i=0;i<W;i++) if(L[j*W+i]){ const d=Math.hypot(x0+i+0.5-(e.x-e.dx*1.2),z0+j+0.5-(e.z-e.dz*1.2)); if(d<bd){ bd=d; sx=i; sz=j; } }
    if(bd<4){
      const V=new Uint8Array(W*H), cola=[sz*W+sx]; V[cola[0]]=1; let n=0;
      for(let q=0;q<cola.length;q++){
        const k=cola[q], i=k%W, j=(k/W)|0; n++;
        for(const [a,b] of [[1,0],[-1,0],[0,1],[0,-1]]){ const ii=i+a, jj=j+b; if(ii<0||jj<0||ii>=W||jj>=H) continue; const kk=jj*W+ii; if(L[kk]&&!V[kk]){ V[kk]=1; cola.push(kk); } }
      }
      res={ok:n>=24&&n>=libres*0.6,celdas:n,libres,total:libres};
    }
  }
  if(CAM_CACHE.size>30) CAM_CACHE.clear();
  CAM_CACHE.set(clave,res); return res;
}
/* una cueva al azar que se pueda recorrer de punta a punta caminando de a un metro */
function cuevaAleatoria(){
  let mejor=null;
  for(let i=0;i<12;i++){
    const tipo=TIPOS_ALEA[(azar()*TIPOS_ALEA.length)|0], base=NV.cuevas.nuevo(tipo);
    const sp=NV.cuevas.limpiar(Object.assign({},base,{salidas:1,mat:MATS_ALEA[(azar()*MATS_ALEA.length)|0],edad:Math.round(azar()*60)/100,
      estado:{musgo:Math.round(azar()*50)/100,humedad:Math.round((0.2+azar()*0.5)*100)/100,charcos:Math.round(azar()*40)/100,cristales:Math.round(azar()*45)/100,derrumbe:Math.round(azar()*30)/100}}));
    const c=caminable(sp);
    if(c.ok) return sp;
    if(!mejor||c.celdas>mejor.c.celdas) mejor={sp,c};
  }
  return mejor.sp;
}

/* ------------------------------------------------------------------ EL REGISTRO DE UMBRALES ---- */
/* Se reconstruye desde los objetos del mundo (cada vez que el mundo cambia). La cueva de cada uno se arma sólo al hacer falta. */
function sincronizar(){
  NV.umbrales.importar({version:1,mapas:[],umbrales:[]});
  NV.umbrales.registrarMapa('mundo',{nombre:'Mundo',tipo:'mundo'});
  SUBS=new Map();
  for(const o of (NV.mundo&&NV.mundo.objetosDe?NV.mundo.objetosDe('umbral'):[])){
    const spec=limpiar(o.r), id=idDe(o), d=DIRS[spec.dir];
    NV.umbrales.registrarMapa(id,{nombre:spec.nombre,tipo:'cueva',cueva:spec.cueva});
    NV.umbrales.registrar({id:id+':fuera',mapa:'mundo',x:o.x+0.5,y:o.y+0.5,dx:d[0],dy:d[1],radio:0.9,tipo:'entrada'});
    SUBS.set(id,{id,nombre:spec.nombre,mundo:spec.mundo,x:o.x,y:o.y,spec,listo:false});
  }
  vSync=NV.mundo.version();
}
function asegurar(){
  if(vSync===NV.mundo.version()) return;
  sincronizar();
  if(ESC&&SUBS.has(ESC.id)) materializar(ESC.id);
}
/* el mundo cambió mientras se estaba adentro (se editó la cueva con el Modo Dios): se rehace el interior en el lugar */
function refrescarEscena(){
  if(!ESC) return;
  asegurar();
  const s=SUBS.get(ESC.id);
  if(!s){ const a=ESC.afuera||{x:me.x,y:me.y}; salirAlMundo({x:a.x+0.5,y:a.y+0.5,dx:0,dy:1}); return; }
  ESC.S=NV.cuevas.crear(s.spec.cueva); ESC.spec=s.spec; ESC.nombre=s.nombre; ESC.dentro=s.dentro;
  const p=NV.umbrales.puede(s.dentro); if(p.ok) ESC.afuera={x:Math.floor(p.destino.x),y:Math.floor(p.destino.y)};
  if(!NV.sueloEn(me.x,me.y)||NV.solidoEn(me.x,me.y)){ const c=casillaCerca(me.x+0.5,me.y+0.5); if(c){ me.x=c.x; me.y=c.y; NV.desdeX=undefined; NV.desdeY=undefined; } }
  nombreEnPantalla(s.nombre); if(typeof programarCuadro==='function') programarCuadro();
}
function salirAfuera(){
  if(!ESC) return false; asegurar();
  const p=NV.umbrales.puede(ESC.dentro); if(!p.ok) return false;
  return cruzar(Object.assign({mapa:'mundo'},p.destino));
}
function editarEsta(){
  if(!ESC||!NV.creador) return;
  const o=NV.mundo.objetosDe('umbral').find(q=>idDe(q)===ESC.id), r=o&&NV.entradaDeObjeto(o);
  if(r) NV.creador.abrir(r.motor,r.entrada,o);
}
/* arma el interior (sus bocas) y ata la boca obligatoria con el umbral de afuera; recién entonces el umbral se puede cruzar */
function materializar(id){
  const s=SUBS.get(id); if(!s) return null; if(s.listo) return s;
  const S=NV.cuevas.crear(s.spec.cueva);
  NV.umbrales.desdeCueva(id,S,{nombre:s.nombre});
  const e=NV.cuevas.entradas(S)[0];
  s.dentro=id+':'+e.id;
  /* el umbral de la boca se apoya sobre UNA casilla libre (la más cercana a la boca): así siempre hay una casilla que se puede pisar */
  let mejor=null, bd=1e9;
  for(let dz=-5;dz<=5;dz++) for(let dx=-5;dx<=5;dx++){
    const cx=Math.floor(e.x)+dx, cz=Math.floor(e.z)+dz; if(!NV.cuevas.libre(S,cx+0.5,cz+0.5)) continue;
    const d=Math.hypot(cx+0.5-(e.x-e.dx*0.4),cz+0.5-(e.z-e.dz*0.4)); if(d<bd){ bd=d; mejor={x:cx,z:cz}; }
  }
  if(mejor) NV.umbrales.editar(s.dentro,{x:mejor.x+0.5,y:mejor.z+0.5,radio:0.9});
  NV.umbrales.vincular(id+':fuera',s.dentro);
  s.listo=true; return s;
}
const subDeUmbral=uid=>{ const k=String(uid).split(':fuera')[0]; return SUBS.get(k)||null; };

/* ------------------------------------------------------------------ MOVERSE POR DENTRO ---- */
const dentroSuelo=(x,y)=>{
  const B=ESC.S.g.box, px=x+0.5, pz=y+0.5;
  if(px<B.umin-2||px>B.umax+2||pz<B.zmin-2||pz>B.zmax+2) return null;
  const s=NV.cuevas.suelo(ESC.S,px,pz);
  return s.aire?(s.honda?'P':s.agua?'a':'d'):'M';
};
const dentroSolido=(x,y)=>!NV.cuevas.suelo(ESC.S,x+0.5,y+0.5).libre;
const dentroAltura=(x,y)=>{ const s=NV.cuevas.suelo(ESC.S,x,y); return s.aire?clamp(s.y,-1.5,3):0; };
function cambiarFunciones(adentro){
  if(adentro&&!ORIG){ ORIG={s:NV.sueloEn,so:NV.solidoEn,a:NV.alturaEn}; NV.sueloEn=dentroSuelo; NV.solidoEn=dentroSolido; NV.alturaEn=dentroAltura; }
  else if(!adentro&&ORIG){ NV.sueloEn=ORIG.s; NV.solidoEn=ORIG.so; NV.alturaEn=ORIG.a; ORIG=null; }
}
/* la casilla libre más cercana a un punto (en metros del mapa actual) */
function casillaCerca(x,y){
  const cx=Math.floor(x), cy=Math.floor(y); let mejor=null, bd=1e9;
  for(let r=0;r<=5&&!mejor;r++) for(let j=-r;j<=r;j++) for(let i=-r;i<=r;i++){
    if(Math.max(Math.abs(i),Math.abs(j))!==r) continue;
    const px=cx+i, py=cy+j; if(!NV.sueloEn(px,py)||NV.solidoEn(px,py)) continue;
    const d=Math.hypot(px+0.5-x,py+0.5-y); if(d<bd){ bd=d; mejor={x:px,y:py}; }
  }
  return mejor;
}
function recolocar(c,dx,dy){
  me.x=c.x; me.y=c.y; facing=rumboDeVec(dx,dy);
  NV.desdeX=undefined; NV.desdeY=undefined; NV.ultimoPaso=0; NV.destino=null;
  NV.camXf=undefined; NV.camYf=undefined; NV.camAlz=undefined; NV.camLibre=null;
  J.sobre=null;
  if(typeof dejarDeCaminar==='function') dejarDeCaminar();
  if(typeof detenerRuta==='function') detenerRuta();
}
function nombreEnPantalla(t){
  const w=$e('wname'); if(w) w.textContent=t;
  const d=$e('dios'); if(d&&d.classList) d.classList.toggle('subMode',!!ESC);       // el Modo Dios cambia de panel según dónde se esté
  const n=$e('subNombre'); if(n) n.textContent=ESC?ESC.nombre:'';
}

function entrarEscena(r){
  const s=subDeUmbral(r.destino.umbral)||SUBS.get(r.mapa); if(!s) return false;
  const S=NV.cuevas.crear(s.spec.cueva);
  const previo=ESC; ESC={id:s.id,nombre:s.nombre,S,spec:s.spec,dentro:s.dentro,afuera:null};
  cambiarFunciones(true);
  const c=casillaCerca(r.x,r.y);
  if(!c){ ESC=previo; if(!previo) cambiarFunciones(false); return false; }
  const p=NV.umbrales.puede(s.dentro); if(p.ok) ESC.afuera={x:Math.floor(p.destino.x),y:Math.floor(p.destino.y)};
  NV.escena=ESC; recolocar(c,r.dx,r.dy); nombreEnPantalla(s.nombre);
  return true;
}
function salirAlMundo(r){
  ESC=null; NV.escena=null; cambiarFunciones(false);
  const c=casillaCerca(r.x,r.y)||{x:Math.floor(r.x),y:Math.floor(r.y)};
  recolocar(c,r.dx,r.dy);
  const p=NV.panelDe(me.x,me.y); if(p) world=p; nombreEnPantalla(p?p.nombre:''); NV.olvidarObjetos();
  return true;
}
function cruzar(r){
  const ok=r.mapa==='mundo'?salirAlMundo(r):entrarEscena(r);
  if(typeof programarCuadro==='function') programarCuadro();
  return ok;
}
/* se llama después de cada paso: ¿se pisó un umbral? */
function alPisar(){
  asegurar();
  J.mapa=ESC?ESC.id:'mundo'; J.x=me.x+0.5; J.y=me.y+0.5;
  const u=NV.umbrales.detectar(J.mapa,J.x,J.y);
  if(u&&u.id.endsWith(':fuera')) materializar(u.id.slice(0,-6));
  const r=NV.umbrales.paso(J);
  if(!r) return null;
  if(!r.ok){ if(typeof bubble==='function') bubble(r.mensaje); return r; }
  return cruzar(r)?r:null;
}
/* ¿el paso a (nx,ny) está frenado por un umbral que no se puede cruzar? devuelve la frase o null */
function bloquea(nx,ny){
  if(!SUBS.size&&!ESC) return null;
  asegurar();
  const mapa=ESC?ESC.id:'mundo', u=NV.umbrales.detectar(mapa,nx+0.5,ny+0.5);
  if(!u) return null;
  if(u.id.endsWith(':fuera')) materializar(u.id.slice(0,-6));
  const p=NV.umbrales.puede(u.id); return p.ok?null:p.mensaje;
}

/* ------------------------------------------------------------------ DIBUJAR EL INTERIOR ---- */
const DIA=[170,198,240];
const putG=(c,r,g,col)=>put(c,r,typeof g==='string'?g.charCodeAt(0):g,col);
const pk=(r,g,b)=>(clamp(r|0,0,255)<<16)|(clamp(g|0,0,255)<<8)|clamp(b|0,0,255);
const H2=(a,b)=>{ let h=Math.imul(a|0,374761393)^Math.imul(b|0,668265263); h=Math.imul(h^(h>>>13),1274126177); return ((h^(h>>>16))>>>0)/4294967296; };
/* el embudo de luz del día que entra por la boca: se abre hacia afuera y se apaga con la distancia; nunca tapa lo que ya dibujó la cueva */
function luzDeBocas(){
  const LARGO=9, o=ordR, l=layer; ordR=-1; layer=0;
  try{
    for(const e of NV.cuevas.entradas(ESC.S)){
      const wMax=e.r*(0.9+0.22*LARGO)+0.5, pts=[[0,-e.r],[0,e.r],[LARGO,-wMax],[LARGO,wMax]], px=-e.dz, pz=e.dx;
      let c0=1e9,c1=-1e9,r0=1e9,r1=-1e9;
      for(const [s,a] of pts){ const X=e.x+e.dx*s+px*a, Z=e.z+e.dz*s+pz*a, c=(X-camX)*CPM, r=(Z-camY)*RPM+RPM/2-1.5; c0=Math.min(c0,c); c1=Math.max(c1,c); r0=Math.min(r0,r); r1=Math.max(r1,r); }
      for(let r=Math.max(0,Math.floor(r0)-1);r<=Math.min(rowsN-1,Math.ceil(r1)+1);r++) for(let c=Math.max(0,Math.floor(c0)-1);c<=Math.min(cols-1,Math.ceil(c1)+1);c++){
        const X=camX+(c+0.5)/CPM, Z=camY+(r-RPM/2+1.5)/RPM, rx=X-e.x, rz=Z-e.z, s=rx*e.dx+rz*e.dz, a=rx*px+rz*pz;
        if(s<-0.2||s>LARGO) continue;
        const w=e.r*(0.9+0.22*Math.max(0,s)); if(Math.abs(a)>w) continue;
        const borde=1-Math.abs(a)/w, k=Math.pow(1-Math.max(0,s)/LARGO,1.5)*(0.30+0.70*borde)*(0.8+0.4*H2(c,r));
        if(k<0.07) continue;
        put(c,r,(k>0.62?':':k>0.38?'-':k>0.2?'.':'`').charCodeAt(0),pk(DIA[0]*k*1.15,DIA[1]*k*1.1,DIA[2]*k));
      }
    }
  } finally { ordR=o; layer=l; }
}
function dibujarEscena(){
  const t0=performance.now();
  const dtS=relojAmbiente(), dtC=dtS>0?dtS:1/30;
  const colsM=Math.ceil(cols/CPM), rowsM=Math.ceil(rowsN/RPM), pp=NV.posDibujo(Date.now());
  let dX=pp.x-colsM/2+0.5, dY=pp.y-rowsM/2+0.5;
  if(NV.camLibre){ dX+=NV.camLibre.x; dY+=NV.camLibre.y; }
  if(NV.camXf===undefined||NV.camDirecta){ NV.camXf=dX; NV.camYf=dY; }
  const sigue=1-Math.exp(-dtC/0.07);
  NV.camXf+=(dX-NV.camXf)*sigue; NV.camYf+=(dY-NV.camYf)*sigue;
  if(Math.abs(dX-NV.camXf)<0.01) NV.camXf=dX; if(Math.abs(dY-NV.camYf)<0.01) NV.camYf=dY;
  camX=Math.floor(NV.camXf); camY=Math.floor(NV.camYf);
  NV.desplaceX=-(NV.camXf-camX)*CPM*cw; NV.desplaceY=-(NV.camYf-camY)*RPM*chh;
  NV.camAlz=0; NV.liftFila=0; NV.camQuieta=NV.camXf===dX&&NV.camYf===dY;
  fbG.fill(0); fbL.fill(0); fbO.fill(0); if(pickOn) fbP.fill(0);
  NV.aguaSombra=null; liftR=0; alzaR=0; usaCol=false;
  const S=ESC.S, P=NV.cuevas.proyeccion(S,{CPM,HPM,RPM});
  const bc=P.c0+Math.round((P.u0-camX)*CPM), br=Math.round(-camY*RPM+RPM/2-1.5);
  const cx=pp.x+0.5, cz=pp.y+0.5, t=performance.now()/1000;
  const luz={x:cx,z:cz,y:NV.cuevas.suelo(S,cx,cz).y+1.25,rad:7.5,r:1,g:0.78,b:0.5,i:1.1+0.07*Math.sin(t*6.3)};
  layer=0; ordR=0;
  NV.cuevas.pintar(S,{put:putG,bc,br,cols,rows:rowsN,rmin:0,CPM,HPM,RPM,t,oscuridad:0.45,memoria:0.15,luces:[luz]});
  luzDeBocas();
  ordR=60000; layer=3; alzaR=Math.round(NV.alturaEn(cx,cz)*HPM);
  drawPlayer(1);
  alzaR=0; ordR=65535; layer=0;
  flush();
  const st=$('st2'); if(st) st.textContent=ESC.nombre+' · mirando al '+facing;
  const dt=performance.now()-t0; lastMs=lastMs*0.7+dt*0.3;
}

/* ------------------------------------------------------------------ EL UMBRAL EN EL MODO DIOS ---- */
const ORO=[214,168,64];
function dibujarUmbral(tr){
  if(!(NV.editor&&NV.editor.activo)) return;
  const o=ordR, a=alzaR, l=layer; ordR=60000; layer=3;
  try{
    const bc=(tr.x-camX)*CPM+Math.floor(CPM/2), br=(tr.y-camY)*RPM+RPM-1-Math.round(RPM/2);
    alzaR=Math.round(NV.alturaEn(tr.x+0.5,tr.y+0.5)*HPM);
    const col=pk(ORO[0],ORO[1],ORO[2]), rx=0.9*CPM, ry=0.9*RPM;
    for(let k=0;k<28;k++){ const an=k/28*Math.PI*2; put(bc+Math.round(Math.cos(an)*rx),br+Math.round(Math.sin(an)*ry),(k%7===0?'*':'.').charCodeAt(0),col); }
    put(bc,br,'U'.charCodeAt(0),col);
    const nom=String((tr.r&&tr.r.nombre)||'').slice(0,18), c0=bc-Math.floor(nom.length/2);
    for(let i=0;i<nom.length;i++) put(c0+i,br-Math.round(ry)-2,nom.charCodeAt(i),col);
  } finally { ordR=o; alzaR=a; layer=l; }
}
function previa(spec){
  const sp=limpiar(spec), z=0.5, CPMp=13*z, HPMp=6.8*z, RPMp=4*z, S=NV.cuevas.crear(sp.cueva);
  const m=NV.cuevas.marco(S,{CPM:CPMp,HPM:HPMp,RPM:RPMp,detalle:1}), c=caminable(sp.cueva);
  return {mw:m.cols/CPMp,mh:m.rows/RPMp,z,S:{W:m.cols/CPMp},
    detalle:'sub-mapa «'+sp.nombre+'» · '+(c.ok?'se recorre entera':'tiene tramos angostos: no se llega a todos lados'),
    items:[{x:0,y:0,pintar:ctx=>NV.cuevas.pintar(S,{put:(cc,r,g,col)=>ctx.put(cc,r,typeof g==='string'?g.charCodeAt(0):g,col),bc:m.bc,br:m.br,cols:m.cols,rows:m.rows,
      CPM:CPMp,HPM:HPMp,RPM:RPMp,detalle:1,t:0,oscuridad:0.35,memoria:0.12})}]};
}
const CAMPOS=()=>{
  const C=NV.cuevas, mats=C.MATS.map(m=>[m,C.MATERIALES[m].nombre]), tipos=C.TIPOS_ID.map(t=>[t,C.TIPOS[t].nombre]);
  const rng=(ruta,etq,min,max,paso,grupo)=>({ruta,etq,tipo:'rng',min,max,paso,grupo});
  return [
    {ruta:'nombre',etq:'Nombre',tipo:'txt',grupo:'Sub-mapa'},
    {ruta:'dir',etq:'Se entra',tipo:'sel',opciones:DIR_TXT,grupo:'Sub-mapa'},
    {ruta:'cueva.tipo',etq:'Cueva',tipo:'sel',opciones:tipos,grupo:'Cueva',alCambiar:sp=>{ for(const k of ['largo','ancho','alto','corte']) delete sp.cueva[k]; }},
    {ruta:'cueva.mat',etq:'Roca',tipo:'sel',opciones:mats,grupo:'Cueva'},
    rng('cueva.escala','Escala',0.6,1.6,0.1,'Cueva'),
    rng('cueva.edad','Desgaste',0,1,0.05,'Cueva'),
    rng('cueva.estado.musgo','Musgo',0,1,0.05,'Estado'), rng('cueva.estado.humedad','Humedad',0,1,0.05,'Estado'),
    rng('cueva.estado.charcos','Charcos',0,1,0.05,'Estado'), rng('cueva.estado.cristales','Cristales',0,1,0.05,'Estado'),
    rng('cueva.estado.derrumbe','Derrumbe',0,1,0.05,'Estado')];
};
const resumen=o=>'Umbral «'+((o.r&&o.r.nombre)||'Sin nombre')+'»';

/* la pregunta al colocar: cómo se llama el sub-mapa y de qué mundo es */
function nombrePorDefecto(x,y){ const p=NV.panelDe?NV.panelDe(x,y):null; return ((p&&p.nombre)||'Mundo')+' '+x+','+y; }
function preguntar(x,y,entrada,dir){
  PEND={x,y,entrada,dir:DIRS[dir]?dir:'norte'};
  $e('umbNombre').value=nombrePorDefecto(x,y);
  const sel=$e('umbMundo'); sel.innerHTML=''; for(const [v,t] of MUNDOS){ const o=document.createElement('option'); o.value=v; o.textContent=t; sel.appendChild(o); }
  $e('umbralAsk').classList.add('show');
  setTimeout(()=>{ const i=$e('umbNombre'); if(i){ i.focus(); i.select(); } },0);
}
function cerrarPregunta(){ PEND=null; const p=$e('umbralAsk'); if(p) p.classList.remove('show'); }
function confirmarPregunta(){
  if(!PEND) return;
  const {x,y,dir}=PEND, nombre=($e('umbNombre').value||'').trim()||nombrePorDefecto(x,y);
  const o=aObjeto({nombre,mundo:$e('umbMundo').value,dir,cueva:cuevaAleatoria()});
  cerrarPregunta();
  NV.editor.hacer({t:'objeto+',x,y,objeto:o},'Umbral «'+nombre+'» colocado.\nClic sobre él para editar la cueva.');
}

/* el listado: el mundo y sus sub-mundos, con su nombre y el cuadrante (panel) donde están */
function lista(){
  asegurar();
  return Array.from(SUBS.values()).map(s=>{
    const L=NV.LADO, pi=Math.floor(s.x/L), pj=Math.floor(s.y/L), p=NV.panelDe?NV.panelDe(s.x,s.y):null;
    return {id:s.id,nombre:s.nombre,mundo:s.mundo,x:s.x,y:s.y,pi,pj,cuadrante:pi+':'+pj,panel:(p&&p.nombre)||''};
  });
}
function pintarLista(){
  const caja=$e('mundosLista'); if(!caja) return;
  caja.innerHTML='';
  const fila=(cls,t1,t2,al)=>{ const d=document.createElement('div'); d.className='mfila '+cls; const a=document.createElement('b'), b=document.createElement('span'); a.textContent=t1; b.textContent=t2; d.append(a,b); if(al) d.addEventListener('click',al); caja.appendChild(d); };
  const p=(typeof world!=='undefined'&&world)?world:null;
  fila('mundo','Mundo principal',(ESC?'estás en un sub-mundo':'estás acá'+(p?' · '+p.nombre:'')),null);
  const L=lista();
  if(!L.length){ const d=document.createElement('div'); d.className='mvacio'; d.textContent='Todavía no hay sub-mundos. Colocá un Umbral desde la paleta de Objetos.'; caja.appendChild(d); }
  for(const s of L) fila('sub',s.nombre,s.mundo+' · cuadrante '+s.cuadrante+(s.panel?' · '+s.panel:'')+' · casilla '+s.x+','+s.y+((ESC&&ESC.id===s.id)?' · estás adentro':''),()=>{
    NV.camLibre={x:s.x-me.x,y:s.y-me.y}; if(NV.editor) NV.editor.decir('Vista sobre «'+s.nombre+'».'); if(typeof programarCuadro==='function') programarCuadro();
  });
}
function abrirLista(){ const p=$e('mundos'); if(!p) return; pintarLista(); p.classList.add('show'); }
function cerrarLista(){ const p=$e('mundos'); if(p) p.classList.remove('show'); }
const listaAbierta=()=>{ const p=$e('mundos'); return !!p&&p.classList.contains('show'); };

function iniciar(){
  const b=id=>$e(id), parar=p=>{ for(const ev of ['keydown','keyup']) p.addEventListener(ev,e=>e.stopPropagation()); };
  const ask=b('umbralAsk');
  if(ask){
    parar(ask);
    ask.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); confirmarPregunta(); } else if(e.key==='Escape') cerrarPregunta(); });
    b('umbSeguir').addEventListener('click',confirmarPregunta);
    b('umbCancelar').addEventListener('click',cerrarPregunta);
  }
  const mp=b('mundos');
  if(mp){ parar(mp); b('mundosCerrar').addEventListener('click',cerrarLista); }
  if(b('subEditar')) b('subEditar').addEventListener('click',editarEsta);
  if(b('subSalir')) b('subSalir').addEventListener('click',salirAfuera);
  if(b('diosMundos')) b('diosMundos').addEventListener('click',()=>{ listaAbierta()?cerrarLista():abrirLista(); });
}

/* ------------------------------------------------------------------ REGISTRO ---- */
if(NV.motores) NV.motores.registrar({id:'subescenas',nombre:'Sub-mundos (Umbral + interior de cueva)',estado:'integrado',
  archivo:'src/juego/subescenas.js',prueba:'pruebas/subescenas.js',
  caras:{
    objetos:{
      catalogo:()=>[{id:ID,nombre:'Umbral',etiqueta:'Umbral',k:'umbral',disenar:true,alColocar:true,encaja:o=>o.k==='umbral'}],
      crear:()=>({k:'umbral',h:1,s:1,r:{nombre:'',mundo:'cueva',dir:'norte'}}),      // la vista previa del cursor: sólo el aro; la cueva se arma al colocar
      variar:o=>Object.assign({},o)
    },
    creador:{
      titulo:()=>'Editar el sub-mapa',
      campos:CAMPOS,
      nuevo:()=>limpiar({cueva:cuevaAleatoria()}),
      variar:spec=>{ const sp=limpiar(spec); return limpiar(Object.assign({},sp,{cueva:NV.cuevas.variar(sp.cueva)})); },
      aObjeto, deObjeto, idDe:()=>ID, previa, resumen
    }
  }});
if(NV.mundo&&NV.mundo.alCambiar) NV.mundo.alCambiar(()=>{ if(ESC) refrescarEscena(); if(listaAbierta()) pintarLista(); });
NV.dibujarUmbral=dibujarUmbral;
NV.subescenas={limpiar,aObjeto,deObjeto,caminable,cuevaAleatoria,sincronizar,materializar,lista,alPisar,bloquea,dibujarEscena,preguntar,salirAfuera,editarEsta,abrirLista,cerrarLista,iniciar,
  dentro:()=>ESC,idDe,DIRS,previa,nombrePorDefecto,
  /* para pruebas */
  _confirmar:confirmarPregunta,_pend:()=>PEND,_cruzar:cruzar};
NV.escena=null;
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',iniciar); else setTimeout(iniciar,0);
})(window.NV);

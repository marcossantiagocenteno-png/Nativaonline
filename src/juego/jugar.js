/* Nativa Online — juego: estado, movimiento, mapa y arranque.
   Reglas en docs/DISENO.md. Sin dependencias ni compilación:
   los módulos se cargan en orden y comparten el objeto global NV. */

/* ---------- estado ---------- */
let world=null, me={x:50,y:62}, facing='norte';
let cv,ctx,dpr=1,cw=6,chh=9,cols=0,rowsN=0,camX=0,camY=0;
let fontSize=11, animOn=true, frame=0, animTimer=null, animMs=120, animMsBase=120;
let fbG=null,fbC=null,fbL=null, db=null,userNs=null,docRef=null;
let layer=0, calidad=1, pend=false, lastMs=16;
const patch=makeNoise(mulberry(41099));
const gustN=makeNoise(mulberry(7717));

/* ---------- movimiento ---------- */
function move(dx,dy){
  facing=dy<0?'norte':dy>0?'sur':dx>0?'este':'oeste';
  const nx=me.x+dx,ny=me.y+dy;
  const gq=NV.sueloEn(nx,ny);
  if(!gq){ bubble('Más allá no hay nada todavía: el mundo termina acá.'); return; }
  if(NV.solidoEn(nx,ny)){
    bubble(gq==='M'?'Pared de roca: por acá no se pasa.'
         : gq==='R'?'Un muro caído te corta el paso.'
         : gq==='P'?'El agua es honda. No se cruza.'
         : 'Algo sólido te corta el paso.');
    return; }
  if(gq==='A') bubble('El agua te llega a los tobillos y arrastra.');
  else if(gq==='a') bubble('Pisás el arroyo; apenas te moja las botas.');
  me.x=nx; me.y=ny;
  /* Cuánto se lleva andado y cuándo fue el último paso. La animación de
     caminar avanza por DISTANCIA y no por reloj: atada al reloj, las piernas
     van a su ritmo mientras el personaje patina por el pasto. */
  NV.andado=(NV.andado||0)+1; NV.ultimoPaso=Date.now();
  hide(); animarSuave(); drawMap(); guardar();
}
function look(){
  let n=0,near=null;
  for(const tr of NV.objetosEn(me.x-8,me.y-8,me.x+8,me.y+8)){
    if(tr.k!=='arbol') continue;
    const d=Math.abs(tr.x-me.x)+Math.abs(tr.y-me.y);
    if(d<=6){ n++; if(!near||d<near.d) near={t:tr,d}; }
  }
  const g=NV.sueloEn(me.x,me.y)||'g';
  const suelo='Pisás '+((MAT[g]||MAT.g).n)+'.';
  const arb = n? ('Hay '+n+' '+(n===1?'árbol':'árboles')+' a menos de seis metros'+
                 (near&&near.t.k==='arbol'?'; el más cercano es un '+((SPECIES[near.t.sp]||SPECIES.encino).n)+' de unos '+Math.round(near.t.h)+' metros.':'.'))
              : 'Alrededor solo hay pasto; las sombras vienen de lejos.';
  bubble('<b>Mirás alrededor</b>\n'+esc(suelo+' '+arb+' '+NV.cieloEnPalabras()));
}
function bubble(h){ const b=$('bubble'); b.innerHTML=h.indexOf('<b>')===0?h:esc(h); b.classList.add('show');
  clearTimeout(bubble._t); bubble._t=setTimeout(hide,5200); }
function hide(){ $('bubble').classList.remove('show'); }
function requestDraw(){
  if(pend) return;
  pend=true;
  requestAnimationFrame(()=>{ pend=false; draw(); });
}

/* ---------- movimiento suave ----------
   Mientras la cámara persigue al jugador o el zoom se está acercando a su
   destino, se redibuja seguido. Cuando los dos llegan, el lazo se apaga solo y
   el juego vuelve a su latido lento. */
let lazo=null, ultCuadro=0;
function animarSuave(){
  if(lazo!==null) return;
  const paso=t=>{
    const zoomando=NV.acercarZoom();
    if(t-ultCuadro>26){ ultCuadro=t; draw(); }
    if(zoomando || !NV.camQuieta) lazo=requestAnimationFrame(paso);
    else { lazo=null; draw(); }
  };
  lazo=requestAnimationFrame(paso);
}
/* ---------- guardado ----------
   Vive en el navegador de quien juega: vuelve donde dejó, en ese dispositivo.
   Puede faltar o fallar, así que todo va envuelto y el juego sigue igual. */
const CLAVE='nativa.guardado.v1';
let ultGuardado=0, guardadoPendiente=false;
function guardar(forzar){
  const ahora=Date.now();
  if(!forzar && ahora-ultGuardado<1500){ guardadoPendiente=true; return; }
  ultGuardado=ahora; guardadoPendiente=false;
  try{
    localStorage.setItem(CLAVE, JSON.stringify({
      semilla:NV.CONFIG.seed, x:me.x, y:me.y, mirando:facing,
      zoom:NV.metrosVista(), mapa:mapOn, ts:ahora
    }));
  }catch(e){}
}
function cargarGuardado(){
  let d=null;
  try{ d=JSON.parse(localStorage.getItem(CLAVE)||'null'); }catch(e){}
  if(!d||d.semilla!==NV.CONFIG.seed) return null;
  if(!NV.sueloEn(d.x,d.y)) return null;
  if(NV.solidoEn(d.x,d.y)) return null;
  return d;
}
function olvidarGuardado(){ try{ localStorage.removeItem(CLAVE); }catch(e){} }

/* ---------- caminar sostenido ----------
   Mantener la flecha apretada camina sin parar, con un paso por cada 130 ms.
   El teclado repite solo, pero con una pausa larga al principio y a un ritmo
   que no controlamos; así el paso es parejo y el pulgar también sirve. */
const PASO_MS=130;
let rumbo=null, pasoTimer=null;
function empezarACaminar(dx,dy){
  detenerRuta();                       // el mando manual manda sobre el toque
  rumbo={dx,dy};
  move(dx,dy);
  if(pasoTimer) clearInterval(pasoTimer);
  pasoTimer=setInterval(()=>{ if(rumbo) move(rumbo.dx,rumbo.dy); }, PASO_MS);
}
function dejarDeCaminar(dx,dy){
  if(!rumbo) return;
  if(dx!==undefined && (rumbo.dx!==dx||rumbo.dy!==dy)) return;  // soltó otra tecla
  rumbo=null;
  if(pasoTimer){ clearInterval(pasoTimer); pasoTimer=null; }
}

/* ---------- ir a donde se toca ----------
   Un toque en la pantalla manda caminar hasta ahí. El camino se busca con A*
   sobre la grilla de metros, en cuatro direcciones, como camina el personaje.
   Pisar el sendero cuesta menos, así que si hay un camino cerca lo toma solo:
   no hay que programar "seguir el sendero", sale de que andar por tierra
   pisada es más barato que abrirse paso entre el pasto. */
const COSTE={ d:0.55, g:0.95, G:1.45, k:1.05, s:1.15, N:1.5, D:1.3, a:1.9, A:2.8,
              h:1.25, n:1.60, b:1.75, y:1.20, K:1.45, l:1.9 };
/* tierra pisada < hierba corta < arena de mar < guijarral < arena < pasto seco
   < duna < pasto alto < canto de mar < nieve < pasto nevado < barro < agua
   somera < corriente. Son costes de andar, no de distancia.
   El barro cuesta casi como el agua: es lo que se hunde. El canto de mar
   cuesta más que el guijarral de río porque la piedra es más grande y rueda. */
let ruta=null, destino=null;

function buscarCamino(ax,ay,bx,by,tope){
  if(NV.solidoEn(bx,by)) return null;
  const clave=(x,y)=>x+','+y;
  const abierto=[{x:ax,y:ay,g:0,f:Math.abs(bx-ax)+Math.abs(by-ay)}];
  const costeDe=new Map([[clave(ax,ay),0]]);
  const padre=new Map();
  let visto=0, mejor=null, mejorH=Infinity;
  while(abierto.length && visto<(tope||6000)){
    let i=0; for(let k=1;k<abierto.length;k++) if(abierto[k].f<abierto[i].f) i=k;
    const n=abierto.splice(i,1)[0]; visto++;
    const h=Math.abs(bx-n.x)+Math.abs(by-n.y);
    if(h<mejorH){ mejorH=h; mejor=n; }
    if(n.x===bx&&n.y===by){ mejor=n; break; }
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const x=n.x+dx, y=n.y+dy, k=clave(x,y);
      const suelo=NV.sueloEn(x,y);
      if(!suelo || NV.solidoEn(x,y)) continue;
      const g=n.g+(COSTE[suelo]||1);
      if(costeDe.has(k) && costeDe.get(k)<=g) continue;
      costeDe.set(k,g); padre.set(k,n);
      abierto.push({x,y,g,f:g+Math.abs(bx-x)+Math.abs(by-y)});
    }
  }
  if(!mejor) return null;
  const pasos=[];
  let n=mejor;
  while(n && !(n.x===ax&&n.y===ay)){ pasos.push({x:n.x,y:n.y}); n=padre.get(clave(n.x,n.y)); }
  pasos.reverse();
  return pasos.length?pasos:null;
}

function irHacia(gx,gy){
  dejarDeCaminar();
  /* si cae sobre algo sólido, buscar la casilla pisable más cercana */
  if(NV.solidoEn(gx,gy)){
    let hallado=null;
    for(let r=1;r<=4&&!hallado;r++)
      for(let j=-r;j<=r&&!hallado;j++) for(let i=-r;i<=r;i++){
        if(Math.max(Math.abs(i),Math.abs(j))!==r) continue;
        if(NV.sueloEn(gx+i,gy+j)&&!NV.solidoEn(gx+i,gy+j)){ hallado={x:gx+i,y:gy+j}; break; }
      }
    if(!hallado){ bubble('Por ahí no se puede llegar.'); return; }
    gx=hallado.x; gy=hallado.y;
  }
  const camino=buscarCamino(me.x,me.y,gx,gy);
  if(!camino){ bubble('No encuentro cómo llegar hasta ahí.'); return; }
  ruta=camino; destino={x:gx,y:gy}; NV.destino=destino;
  if(pasoTimer) clearInterval(pasoTimer);
  pasoTimer=setInterval(seguirRuta, PASO_MS);
  seguirRuta();
}
function seguirRuta(){
  if(!ruta||!ruta.length){ detenerRuta(); return; }
  const p=ruta[0];
  const dx=Math.sign(p.x-me.x), dy=Math.sign(p.y-me.y);
  const antes=me.x+','+me.y;
  move(dx,dy);
  if(me.x+','+me.y===antes){ detenerRuta(); return; }   // algo cambió: parar
  ruta.shift();
  if(!ruta.length) detenerRuta();
}
function detenerRuta(){
  ruta=null; destino=null; NV.destino=null;
  if(pasoTimer){ clearInterval(pasoTimer); pasoTimer=null; }
}

/* ---------- cuadros de información ---------- */
const CUADROS={
  controles:{titulo:'Controles', cuerpo:
    '<dl>'+
    '<dt>Moverse</dt><dd>Las flechas o <b>W A S D</b>. Mantené apretado y camina sin parar.</dd>'+
    '<dt>Ir a un punto</dt><dd>Hacé clic o tocá la pantalla donde quieras llegar: el camino lo busca solo, rodeando lo que no se puede pisar.</dd>'+
    '<dt>Explorar</dt><dd><b>E</b> o la barra espaciadora. También haciendo clic sobre lo que tenés al lado.</dd>'+
    '<dt>Mapa</dt><dd><b>M</b> o el botón <i>mapa</i>.</dd>'+
    '<dt>Acercarse</dt><dd>Los números <b>1 2 3</b> de la barra, la rueda del mouse o el pellizco.</dd>'+
    '</dl>'}
};
function abrirCuadro(cual){
  const c=CUADROS[cual];
  if(!c) return;
  $('ctit').textContent=c.titulo;
  $('ccuerpo').innerHTML=c.cuerpo;
  $('cuadro').classList.add('show');
}
function cerrarCuadro(){ $('cuadro').classList.remove('show'); }

let ultSol=-9, ultTormenta=false;
function tictac(){
  const c=NV.actualizarCielo(Date.now());
  const m=$('relojM');
  if(m) m.style.left=(c.fase*100).toFixed(2)+'%';
  const sol=$('relojS');
  if(sol){ sol.style.left=(c.fase*100).toFixed(2)+'%'; sol.textContent=c.deNoche?'(':'*'; }
  if(world && Math.abs(c.fase-ultSol)>0.004){      // cada ~30 s reales
    ultSol=c.fase;
    NV.recalcularSombras();
  }
  /* Con tormenta el dibujo se acelera: un relámpago dura menos de un décimo
     de segundo y con el ritmo normal se perdería la mitad de los fogonazos. */
  const tor=!!(c.clima&&c.clima.tormenta);
  if(tor!==ultTormenta){
    ultTormenta=tor;
    animMs = tor ? Math.min(70, animMsBase) : animMsBase;
    restartAnim();
  }
  if(guardadoPendiente) guardar(true);            // nada se pierde por el freno
  const p=NV.panelDe(me.x,me.y);
  if(p&&p!==world){ world=p; $('wname').textContent=p.nombre; NV.olvidarObjetos(); }
  return c;
}
function restartAnim(){
  if(animTimer) clearInterval(animTimer);
  animTimer=null; if(!animOn) return;
  animTimer=setInterval(()=>{ if(!document.hidden){ frame++; tictac(); requestDraw(); } },animMs);
}

/* ---------- nube (solo lectura) ---------- */
function unwrap(s){
  if(!s) return null;
  if(typeof s.data==='function'){ try{ return s.data(); }catch(e){ return null; } }
  if(s.data&&typeof s.data==='object') return s.data;
  if(s.seed||s.w) return s;
  return null;
}
async function connect(){
  try{ userNs=await window.claude?.use?.('user'); }catch(e){}
  try{ db=await window.claude?.use?.('db'); }catch(e){ db=null; }
  if(!db) return;
  try{
    docRef=db.doc('world/main');
    const apply=d=>{
      if(!d) return;
      const cfg=Object.assign({},CONFIG,d);
      world=build(cfg);
      const c0=NV.panel(0,0); me={x:c0.inicio.x,y:c0.inicio.y};
      $('wname').textContent=world.name;
      draw();
    };
    apply(unwrap(await docRef.get()));
    if(docRef.onSnapshot) docRef.onSnapshot(s=>apply(unwrap(s)));
  }catch(e){}
}

/* ---------- mapa ---------- */
let mapOn=false;
let mapTimer=null;
function toggleMap(v){
  mapOn = v===undefined?!mapOn:v;
  if(mapTimer){ clearInterval(mapTimer); mapTimer=null; }
  if(mapOn) mapTimer=setInterval(drawMap,5000);
  $('map').classList.toggle('show',mapOn);
  $('bMap').classList.toggle('on',mapOn);
  if(mapOn) drawMap();
}
/* El mapa se resume: cada casilla del minimapa cubre varios metros.
   Las columnas son más que las filas porque el carácter es más alto que ancho:
   así el recuadro sale cuadrado. */
const MAPW=26, MAPH=16;
function drawMap(){
  if(!mapOn||!world) return;
  const P=world, L=NV.LADO;
  const lx=((me.x%L)+L)%L, ly=((me.y%L)+L)%L;
  const el=$('mapTx');
  const sx=L/MAPW, sy=L/MAPH;
  const px=Math.floor(lx/sx), py=Math.floor(ly/sy);
  let out='';
  for(let r=0;r<MAPH;r++){
    let line='';
    for(let c=0;c<MAPW;c++){
      if(c===px&&r===py){ line+='<b>X</b>'; continue; }
      let hay=' ';
      const y0=Math.floor(r*sy), y1=Math.min(L,Math.ceil((r+1)*sy));
      const x0=Math.floor(c*sx), x1=Math.min(L,Math.ceil((c+1)*sx));
      for(let y=y0;y<y1;y++){
        const row=P.mapG[y];
        for(let x=x0;x<x1;x++) if(row[x]!==' '){ hay=row[x]; break; }
        if(hay!==' ') break;
      }
      line += hay===' '?'\u00b7':hay;
    }
    out+=line+'\n';
  }
  el.innerHTML=out;
  const cab=$('mapCab');
  if(cab) cab.innerHTML = (NV.resumenCielo?NV.resumenCielo():'')+
    '<div class="mcoord">'+P.nombre+' &middot; '+P.coord+'</div>';
}


/* ---------- arranque ---------- */
function init(){
  cv=$('cv'); ctx=cv.getContext('2d');
  if(matchMedia('(pointer:coarse)').matches) document.body.classList.add('touch');

  tictac();
  const claro=NV.panel(0,0);
  me={x:claro.inicio.x, y:claro.inicio.y};
  world=claro;                                  // el panel donde está el jugador
  $('wname').textContent=claro.nombre;
  const sl=$('sello'); if(sl) sl.textContent='v'+(NV.VERSION||'?');
  const g=cargarGuardado();
  if(g){
    me={x:g.x,y:g.y}; facing=g.mirando||facing;
    if(typeof g.zoom==='number') NV.zoomAbsoluto(g.zoom);
    if(g.mapa) setTimeout(()=>toggleMap(true),60);
    const horas=(Date.now()-(g.ts||0))/3600000;
    setTimeout(()=>bubble(horas>1
      ? 'Volvés al bosque donde lo dejaste. Han pasado '+
        (horas<24?Math.round(horas)+' horas':Math.round(horas/24)+' días')+' acá afuera.'
      : 'Volvés donde lo dejaste.'), 400);
  }
  layout(); restartAnim(); connect();
  addEventListener('visibilitychange',()=>{ if(document.hidden) guardar(true); });
  addEventListener('pagehide',()=>guardar(true));

  addEventListener('resize',()=>{ clearTimeout(init._r); init._r=setTimeout(layout,140); });
  addEventListener('keydown',e=>{
    if(e.key==='Escape'){ cerrarCuadro(); $('info').classList.remove('show'); return; }
    const k=e.key.toLowerCase();
    const dir={arrowup:[0,-1],w:[0,-1],arrowdown:[0,1],s:[0,1],
               arrowleft:[-1,0],a:[-1,0],arrowright:[1,0],d:[1,0]}[k];
    if(dir){
      e.preventDefault();
      if(e.repeat) return;                       // el teclado ya repite; lo hacemos nosotros
      if(!rumbo||rumbo.dx!==dir[0]||rumbo.dy!==dir[1]) empezarACaminar(dir[0],dir[1]);
      return;
    }
    else if(k==='e'||k===' '){ look(); e.preventDefault(); }
    else if(k==='m'){ toggleMap(); e.preventDefault(); }

    else if(k==='r'&&e.shiftKey){ olvidarGuardado(); const c=NV.panel(0,0); me={x:c.inicio.x,y:c.inicio.y};
      bubble('Volvés al claro de partida.'); requestDraw(); e.preventDefault(); }
    else if(k==='+'||k==='='){ NV.zoomRelativo(0.90); animarSuave(); e.preventDefault(); }
    else if(k==='-'||k==='_'){ NV.zoomRelativo(1.11); animarSuave(); e.preventDefault(); }
  });
  addEventListener('keyup',e=>{
    const k=e.key.toLowerCase();
    const dir={arrowup:[0,-1],w:[0,-1],arrowdown:[0,1],s:[0,1],
               arrowleft:[-1,0],a:[-1,0],arrowright:[1,0],d:[1,0]}[k];
    if(dir) dejarDeCaminar(dir[0],dir[1]);
  });
  addEventListener('blur',()=>dejarDeCaminar());
  /* un toque corto manda caminar; arrastrar o pellizcar, no */
  let tocó=null;
  cv.addEventListener('pointerdown',e=>{ tocó={x:e.clientX,y:e.clientY,t:Date.now()}; });
  cv.addEventListener('pointerup',e=>{
    if(!tocó) return;
    const quieto=Math.abs(e.clientX-tocó.x)<12&&Math.abs(e.clientY-tocó.y)<12;
    const corto=Date.now()-tocó.t<600;
    tocó=null;
    if(!quieto||!corto) return;
    const r=cv.getBoundingClientRect();
    const col=Math.floor((e.clientX-r.left)/cw), fil=Math.floor((e.clientY-r.top)/chh);
    if(col<0||fil<0||col>=cols||fil>=rowsN) return;
    const gx=camX+Math.floor(col/CPM), gy=camY+Math.floor(fil/RPM);
    /* tocar lo que uno tiene al lado es mirarlo, no caminar hacia ello */
    if(Math.abs(gx-me.x)<=1 && Math.abs(gy-me.y)<=1) look();
    else irHacia(gx,gy);
  });
  cv.addEventListener('wheel',e=>{ e.preventDefault(); NV.zoomRelativo(e.deltaY<0?0.94:1.064); animarSuave(); },{passive:false});
  let pinch=0;
  cv.addEventListener('touchstart',e=>{
    if(e.touches.length===2) pinch=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,
                                              e.touches[0].clientY-e.touches[1].clientY);
  },{passive:true});
  cv.addEventListener('touchmove',e=>{
    if(e.touches.length!==2||!pinch) return;
    const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,
                       e.touches[0].clientY-e.touches[1].clientY);
    NV.zoomRelativo(pinch/d);          // el pellizco manda directo, sin escalones
    pinch=d; animarSuave();
    e.preventDefault();
  },{passive:false});
  cv.addEventListener('touchend',()=>{ pinch=0; },{passive:true});
  $('bAnim').addEventListener('click',()=>{ animOn=!animOn; $('bAnim').classList.toggle('on',animOn); restartAnim(); draw(); });
  $('bMap').addEventListener('click',()=>toggleMap());
  $('bInfo').addEventListener('click',()=>{
    const i=$('info'); i.classList.toggle('show');
    $('bInfo').classList.toggle('on', i.classList.contains('show'));
  });
  for(const caj of $('info').querySelectorAll('.icaj'))
    caj.addEventListener('click',()=>{
      $('info').classList.remove('show');          // la barra se repliega
      $('bInfo').classList.remove('on');
      abrirCuadro(caj.dataset.cuadro);
    });
  $('cx').addEventListener('click',cerrarCuadro);


}

init();
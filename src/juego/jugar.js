/* Nativa Online — juego: estado, movimiento, mapa y arranque.
   Reglas en docs/DISENO.md. Sin dependencias ni compilación:
   los módulos se cargan en orden y comparten el objeto global NV. */

/* ---------- estado ---------- */
let world=null, me={x:50,y:62}, facing='norte';
let cv,ctx,dpr=1,cw=6,chh=9,cols=0,rowsN=0,camX=0,camY=0;
let fontSize=11, animOn=true, frame=0, animTimer=null, animMs=120, animMsBase=120;
let fbG=null,fbC=null,fbL=null,fbO=null,fbP=null, db=null,userNs=null,docRef=null;
/* alza: altura del terreno. alzaR = filas que sube TODO lo que se escribe (un objeto
   parado en una loma); colAlza = filas que sube cada columna (el suelo, que cambia
   celda a celda); liftR = filas que baja la vista para seguir al jugador cuando
   sube. ordR = orden de pintado (la fila de metros): lo del sur tapa lo del norte
   aunque sea de otra capa, que es lo que hace que una loma tape lo que queda atrás. */
let alzaR=0, liftR=0, ordR=0, colAlza=null, usaCol=false;
let layer=0, calidad=1, pend=false, lastMs=16;
const patch=makeNoise(mulberry(41099));
const gustN=makeNoise(mulberry(7717));

/* ---------- movimiento ---------- */
/* Dónde está el personaje AHORA MISMO, entre la casilla de la que salió y a la
   que va. Camina de a un metro, pero dibujarlo saltando un metro entero son
   dieciocho columnas de un cuadro al otro: no camina, aparece más allá. */
NV.posDibujo=function(ahora){
  const pm=NV.pasoMs||PASO_MS;
  const tp=Math.max(0,Math.min(1,(ahora-(NV.ultimoPaso||0))/pm));
  const x0=(NV.desdeX===undefined?me.x:NV.desdeX);
  const y0=(NV.desdeY===undefined?me.y:NV.desdeY);
  return {x:x0+(me.x-x0)*tp, y:y0+(me.y-y0)*tp, tp:tp};
};

/* Hacia dónde mira. NO se saca del último paso: un camino en diagonal sale en
   escalera —este, norte, este, norte— y mirando sólo el último paso la
   dirección cambia cada 186 ms, así que el dibujo alterna entre el juego de
   poses del este y el del norte sin parar. Se mira el desplazamiento NETO de
   los últimos pasos, que en una escalera apunta en diagonal y se queda quieto
   en el eje que más manda. El empate va al norte-sur, que es el eje de la
   cámara. */
const PASOS_RUMBO=4;
let ultimos=[];
function rumboDe(dx,dy){
  const ahora=Date.now();
  /* tras una pausa se arranca de cero: si no, la dirección vieja pesa */
  if(ahora-(NV.ultimoPaso||0)>520) ultimos=[];
  ultimos.push([dx,dy]);
  if(ultimos.length>PASOS_RUMBO) ultimos.shift();
  /* Darse vuelta es deliberado: se cambia en el acto y se olvida lo anterior.
     Sin esto, volver sobre los pasos deja al personaje caminando de espaldas
     tres pasos hasta que la ventana se da vuelta. */
  const opuesto = (facing==='este'&&dx<0)||(facing==='oeste'&&dx>0)
               || (facing==='norte'&&dy>0)||(facing==='sur'&&dy<0);
  if(opuesto) ultimos=[[dx,dy]];
  let sx=0,sy=0;
  for(const [a,b] of ultimos){ sx+=a; sy+=b; }
  if(!sx&&!sy) return facing;
  /* Histéresis: cuesta más salir del eje en el que ya se está que quedarse.
     Sin ella, una escalera perfecta empata y la dirección oscila. */
  const ver=Math.abs(sy), hor=Math.abs(sx);
  const eraVertical = facing==='norte'||facing==='sur';
  const esVertical = eraVertical ? ver>=hor*0.75 : ver>hor*1.35;
  return esVertical ? (sy<0?'norte':'sur') : (sx>0?'este':'oeste');
}

function move(dx,dy,tIdeal){
  facing=rumboDe(dx,dy);
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
  /* De dónde viene y cuándo salió. El personaje se MUEVE POR CASILLAS de un
     metro, pero no se puede DIBUJAR saltando un metro entero: a este zoom son
     dieciocho columnas de golpe, y lo que se ve es que desaparece y reaparece
     más allá. Guardando de dónde viene, el dibujo lo interpola. */
  const ahora=Date.now();
  /* El paso nuevo sale de donde SE VE el personaje, no de la casilla a la que iba: si se cambia de
     dirección a mitad de paso no pega un salto. Y si el lazo de cuadros lo dispara en su instante
     exacto (tIdeal), empieza justo donde terminó el anterior: el avance es continuo, sin paradas. */
  const vis=NV.posDibujo(ahora);
  NV.desdeX=vis.x; NV.desdeY=vis.y;
  me.x=nx; me.y=ny;
  NV.andado=(NV.andado||0)+1; NV.pasoMs=PASO_MS;
  NV.ultimoPaso=(tIdeal&&tIdeal<=ahora&&ahora-tIdeal<PASO_MS)?tIdeal:ahora;
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
/* ---------- el lazo de cuadros ----------
   UN solo lugar pide cuadros. Cada cuadro: da los pasos que tocan (en su instante exacto), acerca el
   zoom, dibuja una vez, y pide el siguiente si algo se sigue moviendo. Antes había dos lazos que
   podían dibujar en el mismo cuadro (el del movimiento y el de la animación): ese cuadro costaba el
   doble y se notaba como un tirón. Sin tope de cuadros propio: dibuja a lo que dé el monitor. */
function requestDraw(){ programarCuadro(); }
function programarCuadro(){
  if(pend) return;
  pend=true;
  requestAnimationFrame(cuadro);
}
function cuadro(){
  pend=false;
  avanzarPasos(Date.now());
  const zoomando=NV.acercarZoom();
  draw();
  /* mientras el personaje está entre dos casillas, o la cámara no llegó, o hay pasos por dar,
     se sigue dibujando; cuando todo se aquieta, el lazo se apaga y queda el latido lento */
  const enPaso=Date.now()-(NV.ultimoPaso||0) < (NV.pasoMs||PASO_MS)+40;
  if(zoomando || !NV.camQuieta || enPaso || marcapasos) programarCuadro();
}
const animarSuave=programarCuadro;
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
/* Un metro cada 186 ms: antes eran 130, que son 7,7 metros por segundo y es
   velocidad de carrera. A esa velocidad las piernas nunca alcanzan al cuerpo y
   el personaje parece patinar. */
const PASO_MS=186;
let rumbo=null, marcapasos=null;
/* El ritmo de los pasos lo marca el lazo de cuadros, no un temporizador: un setInterval llega
   tarde o junto con el siguiente, y el personaje se frena o salta. El marcapasos guarda el instante
   EXACTO en que toca cada paso y se lo pasa a move(), que lo encadena con el anterior. */
function iniciarMarcapasos(fn){ marcapasos={fn, prox:Date.now()+PASO_MS}; }
function pararMarcapasos(){ marcapasos=null; }
function avanzarPasos(ahora){
  let n=0;
  while(marcapasos && ahora>=marcapasos.prox && n<2){
    const instante=marcapasos.prox, fn=marcapasos.fn;
    marcapasos.prox+=PASO_MS; n++;
    fn(instante);
  }
  /* si se atrasó mucho (pestaña dormida, cuadro larguísimo) no da una ráfaga de pasos de golpe */
  if(marcapasos && ahora-marcapasos.prox>PASO_MS) marcapasos.prox=ahora;
}
NV.pasoForzado=()=>{ if(marcapasos){ marcapasos.prox=0; avanzarPasos(Date.now()); } };   // para las pruebas
function empezarACaminar(dx,dy){
  detenerRuta();                       // el mando manual manda sobre el toque
  rumbo={dx,dy};
  move(dx,dy);
  iniciarMarcapasos(t=>{ if(rumbo) move(rumbo.dx,rumbo.dy,t); });
}
function dejarDeCaminar(dx,dy){
  if(!rumbo) return;
  if(dx!==undefined && (rumbo.dx!==dx||rumbo.dy!==dy)) return;  // soltó otra tecla
  rumbo=null;
  pararMarcapasos();
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
/* La cuesta también se paga: subir cuesta, bajar casi no. Es la altura en metros por cada
   metro andado (una loma fuerte da unos 0,25), multiplicada por esto; 2,5 hace que una loma
   de 2 m cueste como cinco pasos de más, y rodear por un paso bajo gane si queda cerca. */
const COSTE_SUBIDA=2.5, COSTE_BAJADA=0.6;
const alzaDe=(x,y)=>NV.alturaEn(x+0.5,y+0.5);
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
      const dh=alzaDe(x,y)-alzaDe(n.x,n.y);
      const g=n.g+(COSTE[suelo]||1)+(dh>0?dh*COSTE_SUBIDA:-dh*COSTE_BAJADA);
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
  iniciarMarcapasos(seguirRuta);
  seguirRuta();
}
function seguirRuta(tIdeal){
  if(!ruta||!ruta.length){ detenerRuta(); return; }
  const p=ruta.shift();                 // se saca antes de mover: move() pide un cuadro y el cuadro puede dar el paso siguiente
  const dx=Math.sign(p.x-me.x), dy=Math.sign(p.y-me.y);
  const antes=me.x+','+me.y;
  move(dx,dy,tIdeal);
  if(!ruta) return;
  if(me.x+','+me.y===antes){ detenerRuta(); return; }   // algo cambió: parar
  if(!ruta.length) detenerRuta();
}
function detenerRuta(){
  ruta=null; destino=null; NV.destino=null;
  pararMarcapasos();
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

function tictac(){
  if(guardadoPendiente) guardar(true);            // nada se pierde por el freno
  const p=NV.panelDe(me.x,me.y);
  if(p&&p!==world){ world=p; $('wname').textContent=p.nombre; NV.olvidarObjetos(); }
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
  if(cab) cab.innerHTML =
    '<div class="mcoord">'+P.nombre+' &middot; '+P.coord+'</div>';
}


/* ---------- arranque ---------- */
function init(){
  cv=$('cv'); ctx=cv.getContext('2d');
  if(NV.editor) NV.editor.arrancar();            // el mundo editado (borrador) se carga antes de generar el primer panel
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
  if(NV.editor) NV.editor.iniciar();
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
  /* Qué metro está bajo una celda de pantalla. Con altura, el suelo se dibuja corrido hacia
   arriba lo que sube el terreno y la vista baja lo que sube el jugador. Cada metro ocupa
   unas filas de pantalla (su franja, más la cara de la pendiente si el de al sur es más
   bajo); se busca el metro de más al sur cuya franja contiene la celda, porque en el
   dibujo lo del sur tapa lo del norte. */
NV.casillaEn=function(col,fil){
  const wx=camX+(col+0.5)/CPM, gx=camX+Math.floor(col/CPM), lift=NV.liftFila||0;
  const g0=camY+Math.floor((fil-lift)/RPM);
  const alza=y=>Math.round(NV.alturaEn(wx,y+0.5)*HPM);
  const tope=g0+Math.ceil((NV.ALTURA.max*HPM)/RPM)+1;
  for(let gy=tope;gy>=g0-1;gy--){
    const a=alza(gy), arriba=(gy-camY)*RPM-a+lift;
    const abajo=arriba+RPM-1+Math.max(0,a-alza(gy+1));
    /* wx,wy: el punto exacto del mundo bajo la celda (en metros, con fracción): lo usa el Modo Dios para trazar caminos */
    if(fil>=arriba&&fil<=abajo) return {x:gx,y:gy,wx:wx,wy:gy+Math.max(0,Math.min(1,(fil-arriba+0.5)/RPM))};
  }
  return {x:gx,y:g0,wx:wx,wy:g0+0.5};
};
/* un toque corto manda caminar; arrastrar o pellizcar, no */
  let tocó=null;
  cv.addEventListener('pointerdown',e=>{ tocó={x:e.clientX,y:e.clientY,t:Date.now()}; });
  cv.addEventListener('pointerup',e=>{
    if(!tocó) return;
    if(NV.editor&&NV.editor.activo){ tocó=null; return; }       // en Modo Dios los clics editan, no caminan
    const quieto=Math.abs(e.clientX-tocó.x)<12&&Math.abs(e.clientY-tocó.y)<12;
    const corto=Date.now()-tocó.t<600;
    tocó=null;
    if(!quieto||!corto) return;
    const r=cv.getBoundingClientRect();
    /* la celda que se ve bajo el dedo: el lienzo se corre unos píxeles con la cámara (desplaceX/Y) */
    const col=Math.floor((e.clientX-r.left-(NV.desplaceX||0))/cw), fil=Math.floor((e.clientY-r.top-(NV.desplaceY||0))/chh);
    if(col<0||fil<0||col>=cols||fil>=rowsN) return;
    const q=NV.casillaEn(col,fil), gx=q.x, gy=q.y;
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
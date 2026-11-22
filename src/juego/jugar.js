/* Nativa Online — juego: estado, movimiento, mapa y arranque.
   Reglas en docs/DISENO.md. Sin dependencias ni compilación:
   los módulos se cargan en orden y comparten el objeto global NV. */

/* ---------- estado ---------- */
let world=null, me={x:50,y:62}, facing='norte';
let cv,ctx,dpr=1,cw=6,chh=9,cols=0,rowsN=0,camX=0,camY=0;
let fontSize=11, animOn=true, frame=0, animTimer=null, animMs=120;
let fbG=null,fbC=null,fbL=null, db=null,userNs=null,docRef=null;
let layer=0, calidad=1, pend=false, lastMs=16;
const patch=makeNoise(mulberry(41099));
const gustN=makeNoise(mulberry(7717));

/* ---------- movimiento ---------- */
function move(dx,dy){
  facing=dy<0?'norte':dy>0?'sur':dx>0?'este':'oeste';
  const nx=me.x+dx,ny=me.y+dy;
  if(nx<0||ny<0||nx>=world.w||ny>=world.h){ bubble('El claro termina acá.'); return; }
  if(solidAt(nx,ny)){ bubble('Algo sólido te corta el paso.'); return; }
  const gq=groundAt(nx,ny);
  if(gq==='A') bubble('El agua te llega a los tobillos y arrastra para el sur.');
  else if(gq==='a') bubble('Pisás el arroyo; apenas te moja las botas.');
  me.x=nx; me.y=ny; hide(); requestDraw(); drawMap(); guardar();
}
function look(){
  let n=0,near=null;
  for(const tr of world.trees){
    const d=Math.abs(tr.x-me.x)+Math.abs(tr.y-me.y);
    if(d<=6){ n++; if(!near||d<near.d) near={t:tr,d}; }
  }
  const g=groundAt(me.x,me.y);
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
      semilla:world.cfg.seed, x:me.x, y:me.y, mirando:facing,
      zoom:zi, mapa:mapOn, ts:ahora
    }));
  }catch(e){}
}
function cargarGuardado(){
  let d=null;
  try{ d=JSON.parse(localStorage.getItem(CLAVE)||'null'); }catch(e){}
  if(!d||d.semilla!==world.cfg.seed) return null;
  if(!(d.x>=0&&d.y>=0&&d.x<world.w&&d.y<world.h)) return null;
  if(NV.solidAt(d.x,d.y)) return null;
  return d;
}
function olvidarGuardado(){ try{ localStorage.removeItem(CLAVE); }catch(e){} }

let ultSol=-9;
function tictac(){
  const c=NV.actualizarCielo(Date.now());
  const m=$('relojM');
  if(m) m.style.left=(c.fase*100).toFixed(2)+'%';
  if(world && Math.abs(c.fase-ultSol)>0.004){      // cada ~30 s reales
    ultSol=c.fase;
    NV.calcularSombras(world);
  }
  if(guardadoPendiente) guardar(true);            // nada se pierde por el freno
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
      me=NV.findSpawn(world);
      $('wname').textContent=world.name;
      draw();
    };
    apply(unwrap(await docRef.get()));
    if(docRef.onSnapshot) docRef.onSnapshot(s=>apply(unwrap(s)));
  }catch(e){}
}

/* ---------- mapa ---------- */
let mapOn=false;
function toggleMap(v){
  mapOn = v===undefined?!mapOn:v;
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
  const el=$('mapTx');
  const sx=world.w/MAPW, sy=world.h/MAPH;
  const px=Math.floor(me.x/sx), py=Math.floor(me.y/sy);
  let out='';
  for(let r=0;r<MAPH;r++){
    let line='';
    for(let c=0;c<MAPW;c++){
      if(c===px&&r===py){ line+='<b>X</b>'; continue; }
      let hay=false;
      const y0=Math.floor(r*sy), y1=Math.min(world.h,Math.ceil((r+1)*sy));
      const x0=Math.floor(c*sx), x1=Math.min(world.w,Math.ceil((c+1)*sx));
      for(let y=y0;y<y1&&!hay;y++){
        const row=world.mapG[y];
        for(let x=x0;x<x1;x++) if(row[x]==='T'){ hay=true; break; }
      }
      line += hay?'T':'\u00b7';
    }
    out+=line+'\n';
  }
  el.innerHTML=out;
}

/* ---------- leyenda ---------- */
function buildLegend(){
  const rows=[];
  rows.push(['— suelo —','','']);
  for(const k in MAT){
    const m=MAT[k];
    let gl=m.ramp.join(' ').trim();
    if(m.tip) gl+='   inclinada '+m.tip.join(' ');
    rows.push([m.n,gl,m.tip?'base recta, se curva al subir':'grado ralo, asterisco tupido']);
  }
  rows.push(['— objetos —','','']);
  rows.push(['piedra grande','c o O Q 0','cara este iluminada']);
  rows.push(['tronco caído', WOOD.caido.join(' '),'tendido de este a oeste']);
  rows.push(['tronco en pie', WOOD.tronco.join(' '),'H grueso, h medio, t fino']);
  rows.push(['ramas', WOOD.rama.join(' '),'']);
  rows.push(['— copas —','','']);
  for(const k in SPECIES){
    const e=SPECIES[k];
    rows.push([e.n, e.copa.join(' ').trim()+'   borde '+e.borde.join(' ').trim(),
      k==='pino'?'cónica, por pisos':k==='alamo'?'columnar, se mece mucho':'ancha y redonda']);
  }
  rows.push(['— reservado —','','']);
  for(const k in RESERVA) rows.push([k, RESERVA[k], 'fuera del mundo actual']);
  $('legend').innerHTML=rows.map(r=> r[1]===''
    ? '<div class="lgh">'+esc(r[0])+'</div>'
    : '<div class="lg"><b>'+esc(r[0])+'</b><code>'+esc(r[1])+'</code><i>'+esc(r[2])+'</i></div>').join('');
}

/* ---------- arranque ---------- */
function init(){
  cv=$('cv'); ctx=cv.getContext('2d');
  if(matchMedia('(pointer:coarse)').matches) document.body.classList.add('touch');
  applyLOD();
  for(const b of document.querySelectorAll('.zb')) b.classList.toggle('on',+b.dataset.z===zi);
  world=NV.build(CONFIG);
  tictac();
  NV.calcularSombras(world);
  $('wname').textContent=world.name;
  me=NV.findSpawn(world);
  const g=cargarGuardado();
  if(g){
    me={x:g.x,y:g.y}; facing=g.mirando||facing;
    if(typeof g.zoom==='number'){ zi=clamp(g.zoom,0,2); NV.applyLOD(); }
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
    if(document.querySelector('.modal.show')){ if(e.key==='Escape') closeModals(); return; }
    const k=e.key.toLowerCase();
    if(k==='arrowup'||k==='w'){ move(0,-1); e.preventDefault(); }
    else if(k==='arrowdown'||k==='s'){ move(0,1); e.preventDefault(); }
    else if(k==='arrowleft'||k==='a'){ move(-1,0); e.preventDefault(); }
    else if(k==='arrowright'||k==='d'){ move(1,0); e.preventDefault(); }
    else if(k==='e'||k===' '){ look(); e.preventDefault(); }
    else if(k==='m'){ toggleMap(); e.preventDefault(); }
    else if(k==='c'){ NV.toggleAstros(); e.preventDefault(); }
    else if(k==='r'&&e.shiftKey){ olvidarGuardado(); me=NV.findSpawn(world);
      bubble('Volvés al claro de partida.'); requestDraw(); e.preventDefault(); }
    else if(k==='+'||k==='='){ setZoom(1); e.preventDefault(); }
    else if(k==='-'||k==='_'){ setZoom(-1); e.preventDefault(); }
  });
  for(const b of $('pad').querySelectorAll('button[data-mv]'))
    b.addEventListener('click',()=>{
      const m=b.dataset.mv;
      if(m==='n') move(0,-1); else if(m==='s') move(0,1);
      else if(m==='w') move(-1,0); else if(m==='e') move(1,0); else look();
    });
  for(const b of document.querySelectorAll('.zb'))
    b.addEventListener('click',()=>setZoom(+b.dataset.z-zi));
  cv.addEventListener('wheel',e=>{ e.preventDefault(); setZoom(e.deltaY<0?1:-1); },{passive:false});
  let pinch=0;
  cv.addEventListener('touchstart',e=>{
    if(e.touches.length===2) pinch=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,
                                              e.touches[0].clientY-e.touches[1].clientY);
  },{passive:true});
  cv.addEventListener('touchmove',e=>{
    if(e.touches.length!==2||!pinch) return;
    const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,
                       e.touches[0].clientY-e.touches[1].clientY);
    if(Math.abs(d-pinch)>26){ setZoom(d>pinch?1:-1); pinch=d; }
    e.preventDefault();
  },{passive:false});
  cv.addEventListener('touchend',()=>{ pinch=0; },{passive:true});
  $('bAnim').addEventListener('click',()=>{ animOn=!animOn; $('bAnim').classList.toggle('on',animOn); restartAnim(); draw(); });
  $('bMap').addEventListener('click',()=>toggleMap());
  $('bAstros').addEventListener('click',()=>NV.toggleAstros());

  for(const b of document.querySelectorAll('[data-close]')) b.addEventListener('click',closeModals);
}
function closeModals(){ for(const m of document.querySelectorAll('.modal')) m.classList.remove('show'); }

init();
/* Nativa Online — LA PORTADA: la pantalla de entrada al juego.
   index.html sin parámetros abre esto. Con ?solitario o ?oficial no hace nada y el juego arranca como siempre.
   Tres caminos:
     · INVITADO        → recarga con ?oficial: entra al mundo oficial compartido como jugador temporal (sin permisos de administrador).
     · ADMINISTRADOR   → la contraseña se manda UNA vez a POST /entrar del servidor, que la comprueba. Si es válida devuelve una sesión firmada;
                         se guarda sólo en sessionStorage de esta pestaña (nunca la contraseña) y se recarga con ?oficial.
     · MODO SOLITARIO  → ?solitario: el juego de siempre, sin servidor.
   El servidor al que se conecta es NV.SERVIDOR_OFICIAL, o ws://<este equipo>:8787 si no hay. Para probar con otro (un teléfono contra tu PC):
   ?servidor=ws://192.168.1.20:8787 — sólo se acepta cuando la página NO viene por https (en la página publicada nadie puede mandar la
   contraseña a otro servidor con un enlace).
   El arte es de código: un bosque pelado de noche, neblina, luz fría de lila arriba, pétalos pálidos, y a veces un par de ojos en la
   oscuridad. Lo dibuja un lienzo; el marco y el título son SVG. Sin imágenes, sin librerías, sin tipografías externas. */
(function(NV){
  const P=NV.portada={activa:false};
  let busqueda; try{ busqueda=location.search||''; }catch(e){ return; }            // sin navegador (pruebas en Node): nada
  if(/[?&](solitario|oficial)(=|&|$)/.test(busqueda)) return;
  if(!NV.MARCADO_PORTADA||!document.body) return;
  P.activa=true;

  const CLAVE_SESION='nativa.sesion.v1';
  const $=id=>document.getElementById(id);
  const ORO='#c8a24a';

  /* ---------- a qué servidor ---------- */
  function parametro(n){ const m=new RegExp('[?&]'+n+'=([^&]*)').exec(busqueda); return m?decodeURIComponent(m[1]):''; }
  const segura=(()=>{ try{ return location.protocol==='https:'; }catch(e){ return false; } })();
  let url=(!segura&&parametro('servidor'))||NV.SERVIDOR_OFICIAL||'';
  const personalizado=!!(!segura&&parametro('servidor'));
  if(!url) url='ws://'+(location.hostname||'localhost')+':8787';
  url=url.replace(/^http/,'ws').replace(/\/+$/,'');
  const urlValida=/^wss?:\/\/[^\s/]+$/.test(url);
  const http=url.replace(/^ws/,'http');
  P.servidor=url;

  document.body.insertAdjacentHTML('afterbegin',NV.MARCADO_PORTADA);
  document.body.classList.add('conPortada');
  const msg=t=>{ $('ptMensaje').textContent=t||''; };

  /* ---------- estado del servidor ---------- */
  const estado={conexion:'comprobando',admin:null};
  function pintarEstado(){
    let t;
    if(!urlValida) t='La dirección del servidor no es válida.';
    else if(estado.conexion==='comprobando') t='Buscando el mundo oficial…';
    else if(estado.conexion==='en-linea') t='El mundo oficial responde.';
    else t='El mundo oficial no responde por ahora.';
    if(personalizado) t+='  ·  servidor: '+url.replace(/^wss?:\/\//,'');
    $('ptEstado').textContent=t;
    $('ptEstado').className=estado.conexion;
    const sinClave=estado.conexion==='en-linea'&&estado.admin===false;
    $('ptClaveOk').disabled=sinClave;
    if(sinClave&&$('ptClaveForm').classList.contains('abierto')) msg('Este servidor todavía no tiene configurada la clave de administrador (variable NATIVA_ADMIN_TOKEN, en el alojamiento del servidor).');
  }
  async function comprobar(){
    if(!urlValida){ estado.conexion='sin-conexion'; pintarEstado(); return; }
    const ac=new AbortController(), tm=setTimeout(()=>ac.abort(),4000);
    try{
      const r=await fetch(http+'/salud',{cache:'no-store',signal:ac.signal}); const j=await r.json();
      estado.conexion=r.ok&&j&&j.ok?'en-linea':'sin-conexion'; estado.admin=r.ok&&j?!!j.admin:null;
    }catch(e){ estado.conexion='sin-conexion'; estado.admin=null; }
    clearTimeout(tm); pintarEstado();
  }
  comprobar(); setInterval(()=>{ if(!document.hidden) comprobar(); },12000);

  /* ---------- los tres caminos ---------- */
  const destino=()=>'?oficial'+(personalizado?'='+encodeURIComponent(url):'');
  function irAlJuego(){ location.href=destino(); }
  const olvidarSesion=()=>{ try{ sessionStorage.removeItem(CLAVE_SESION); }catch(e){} };

  $('ptInvitado').addEventListener('click',()=>{ olvidarSesion(); irAlJuego(); });          // un invitado nunca arrastra una sesión de administrador

  const form=$('ptClaveForm'), campo=$('ptClave');
  function abrirAdmin(abrir){
    form.classList.toggle('abierto',abrir); $('ptAdmin').setAttribute('aria-expanded',abrir?'true':'false');
    $('ptAdmin').classList.toggle('on',abrir); msg('');
    if(abrir){ campo.focus(); pintarEstado(); } else campo.value='';
  }
  $('ptAdmin').addEventListener('click',()=>abrirAdmin(!form.classList.contains('abierto')));
  $('ptClaveVolver').addEventListener('click',()=>abrirAdmin(false));
  campo.addEventListener('keydown',e=>{ if(e.key==='Escape') abrirAdmin(false); });

  let enCurso=false;
  form.addEventListener('submit',async e=>{
    e.preventDefault(); if(enCurso) return;
    const clave=campo.value; campo.value='';                       // la contraseña no se queda en el campo
    if(!clave){ msg('Escribe la contraseña de administrador.'); campo.focus(); return; }
    if(!urlValida){ msg('La dirección del servidor no es válida.'); return; }
    enCurso=true; $('ptClaveOk').disabled=true; msg('Comprobando…');
    try{
      const r=await fetch(http+'/entrar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clave})});
      const j=await r.json().catch(()=>({}));
      if(r.ok&&j.sesion){
        try{ sessionStorage.setItem(CLAVE_SESION,JSON.stringify({s:j.sesion,u:url})); }catch(err){ msg('Este navegador no permite guardar la sesión. Prueba sin navegación privada.'); return; }
        msg('Bienvenido.'); irAlJuego(); return;
      }
      if(r.status===401) msg('Contraseña incorrecta.');
      else if(r.status===429){ const m=Math.max(1,Math.ceil((j.esperar||60)/60)); msg('Demasiados intentos. Espera '+m+(m===1?' minuto':' minutos')+' antes de volver a probar.'); }
      else if(r.status===503) msg('Este servidor todavía no tiene configurada la clave de administrador (variable NATIVA_ADMIN_TOKEN, en el alojamiento del servidor).');
      else if(r.status===403) msg('Este servidor no acepta conexiones desde esta página.');
      else msg('El servidor respondió con un error. Inténtalo de nuevo en un momento.');
    }catch(err){ msg('No se pudo contactar con el servidor.'); estado.conexion='sin-conexion'; pintarEstado(); }
    finally{ enCurso=false; $('ptClaveOk').disabled=(estado.conexion==='en-linea'&&estado.admin===false); if(form.classList.contains('abierto')) campo.focus(); }
  });

  /* ---------- el marco: línea fina, filete punteado y abanicos en las esquinas ---------- */
  function dibujarMarco(w,h){
    const m=Math.max(10,Math.round(Math.min(w,h)*0.02)), R=Math.max(34,Math.min(96,Math.min(w,h)*0.1));
    let g='';
    const rayos=[];
    for(let k=0;k<=8;k++){ const a=k*Math.PI/16, largo=R*(k%2?0.78:1), r0=R*0.26; rayos.push('M'+(Math.cos(a)*r0).toFixed(1)+' '+(Math.sin(a)*r0).toFixed(1)+'L'+(Math.cos(a)*largo).toFixed(1)+' '+(Math.sin(a)*largo).toFixed(1)); }
    const arco=r=>'M'+r.toFixed(1)+' 0A'+r.toFixed(1)+' '+r.toFixed(1)+' 0 0 1 0 '+r.toFixed(1);
    const abanico='<path d="'+rayos.join('')+'"/><path d="'+arco(R*0.2)+arco(R*0.34)+'" fill="none"/><path d="M0 0L'+(R*0.2).toFixed(1)+' 0M0 0L0 '+(R*0.2).toFixed(1)+'"/>';
    for(const [x,y,sx,sy] of [[m,m,1,1],[w-m,m,-1,1],[m,h-m,1,-1],[w-m,h-m,-1,-1]]) g+='<g transform="translate('+x+' '+y+') scale('+sx+' '+sy+')">'+abanico+'</g>';
    $('ptMarco').innerHTML='<svg width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'" xmlns="http://www.w3.org/2000/svg">'
      +'<rect x="'+m+'" y="'+m+'" width="'+(w-2*m)+'" height="'+(h-2*m)+'" fill="none" stroke="'+ORO+'" stroke-opacity=".8" stroke-width="1.2"/>'
      +'<rect x="'+(m+7)+'" y="'+(m+7)+'" width="'+(w-2*m-14)+'" height="'+(h-2*m-14)+'" fill="none" stroke="'+ORO+'" stroke-opacity=".5" stroke-width="1.6" stroke-linecap="round" stroke-dasharray="0.1 5"/>'
      +'<g stroke="'+ORO+'" stroke-opacity=".85" stroke-width="1.2" fill="none" stroke-linecap="round">'+g+'</g></svg>';
  }

  /* ---------- el arte de fondo ---------- */
  const lienzo=$('ptLienzo'), cx=lienzo.getContext('2d');
  const quieto=(()=>{ try{ return matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){ return false; } })();
  let W=0,H=0,dpr=1,capas=null,petalos=[],hierba=[],tamGlifo=14,ojos=null,t0=performance.now(),ultimo=0;
  const semilla=a=>()=>{ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return((t^t>>>14)>>>0)/4294967296; };
  const nuevo=(w,h)=>{ const c=document.createElement('canvas'); c.width=Math.max(1,Math.round(w*dpr)); c.height=Math.max(1,Math.round(h*dpr)); const x=c.getContext('2d'); x.scale(dpr,dpr); return {c,x}; };

  /* un árbol pelado: cada rama se parte en dos o tres, más corta y más fina, con algo de curva */
  function arbol(x,px,py,ang,largo,grueso,prof,rnd){
    const x2=px+Math.cos(ang)*largo, y2=py+Math.sin(ang)*largo;
    x.lineWidth=Math.max(0.6,grueso); x.beginPath(); x.moveTo(px,py);
    x.quadraticCurveTo((px+x2)/2+(rnd()-.5)*largo*.4,(py+y2)/2+(rnd()-.5)*largo*.3,x2,y2); x.stroke();
    if(prof<=0||largo<5) return;
    const n=prof>3?2:(rnd()<.45?3:2);
    for(let i=0;i<n;i++) arbol(x,x2,y2,ang+(rnd()-.5)*1.15+(i-(n-1)/2)*.12,largo*(.6+rnd()*.22),grueso*.7,prof-1,rnd);
  }
  function armar(){
    const rnd=semilla(11), B=Math.min(H,W*1.35);       // en pantallas angostas los árboles no se estiran a lo alto
    const lejos=nuevo(W,H), cerca=nuevo(W,H), fondo=nuevo(W,H), v=nuevo(W,H);
    /* cielo: azul-negro con el resplandor lila arriba al centro */
    let g=fondo.x.createLinearGradient(0,0,0,H); g.addColorStop(0,'#0d0a1c'); g.addColorStop(.6,'#0a0b16'); g.addColorStop(1,'#070a10');
    fondo.x.fillStyle=g; fondo.x.fillRect(0,0,W,H);
    const gx=W*.5, gy=H*(W<H?.27:.3), gr=Math.max(W,H)*(W<H?.62:.55);
    g=fondo.x.createRadialGradient(gx,gy,0,gx,gy,gr); g.addColorStop(0,'rgba(176,148,224,.82)'); g.addColorStop(.3,'rgba(118,94,178,.46)'); g.addColorStop(.7,'rgba(38,32,76,.2)'); g.addColorStop(1,'rgba(8,7,16,0)');
    fondo.x.fillStyle=g; fondo.x.fillRect(0,0,W,H);
    /* árboles de fondo (finos, azulados, casi perdidos en la bruma) y de plano medio */
    lejos.x.lineCap='round'; lejos.x.strokeStyle='rgba(44,38,84,.62)';
    const nl=Math.max(7,Math.round(W/150));
    for(let i=0;i<nl;i++){ const px=W*(i+.2+rnd()*.6)/nl; arbol(lejos.x,px,H*.86,-Math.PI/2+(rnd()-.5)*.25,B*(.2+rnd()*.1),2.4+rnd()*1.8,7,rnd); }
    lejos.x.strokeStyle='rgba(20,17,42,.88)';
    const nm=Math.max(4,Math.round(W/260));
    for(let i=0;i<nm;i++){ const px=W*(i+.1+rnd()*.8)/nm; arbol(lejos.x,px,H*.95,-Math.PI/2+(rnd()-.5)*.3,B*(.3+rnd()*.14),5+rnd()*3.5,7,rnd); }
    /* troncos grandes de los bordes: casi negros, con las ramas cerrándose arriba como un arco */
    cerca.x.lineCap='round'; cerca.x.strokeStyle='#05040a';
    const gr0=Math.max(16,Math.min(64,W*.045));
    arbol(cerca.x,W*.02,H*1.02,-Math.PI/2+.16,B*.46,gr0,8,rnd); arbol(cerca.x,-W*.02,H*.7,-Math.PI/2+.5,B*.4,gr0*.8,8,rnd);
    arbol(cerca.x,W*.98,H*1.02,-Math.PI/2-.16,B*.46,gr0,8,rnd); arbol(cerca.x,W*1.03,H*.7,-Math.PI/2-.5,B*.4,gr0*.8,8,rnd);
    arbol(cerca.x,W*.17,H*1.04,-Math.PI/2+.1,B*.3,gr0*.5,7,rnd); arbol(cerca.x,W*.84,H*1.04,-Math.PI/2-.1,B*.3,gr0*.5,7,rnd);
    /* vineta */
    g=v.x.createRadialGradient(W/2,H*.46,Math.min(W,H)*.25,W/2,H*.5,Math.hypot(W,H)*.6); g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(.65,'rgba(0,0,0,.45)'); g.addColorStop(1,'rgba(0,0,0,.92)');
    v.x.fillStyle=g; v.x.fillRect(0,0,W,H);
    capas={fondo:fondo.c,lejos:lejos.c,cerca:cerca.c,vineta:v.c};
    /* pétalos y hierba de glifos */
    tamGlifo=Math.max(12,Math.min(18,W/72));
    petalos=[]; const np=Math.round(Math.max(26,Math.min(70,W*H/16000)));
    for(let i=0;i<np;i++) petalos.push({x:rnd()*W,y:H*(.35+rnd()*.65),vy:-(2+rnd()*7),vx:(rnd()-.3)*5,fase:rnd()*6.28,ch:['·','·','˙','.','•','*'][Math.floor(rnd()*6)],a:.35+rnd()*.5,z:.7+rnd()*.8});
    hierba=[]; const paso=tamGlifo*.62, filas=Math.max(3,Math.round(H*.05/tamGlifo));
    for(let f=0;f<filas;f++) for(let x=0;x<W+paso;x+=paso) if(rnd()<.8) hierba.push({x:x+rnd()*paso*.6,y:H-tamGlifo*.2-f*tamGlifo*.8,ch:['"',"'",',',';','`','"'][Math.floor(rnd()*6)],f:rnd()*6.28,a:(.2+.35*(1-f/filas))*(.6+rnd()*.5)});
  }
  /* niebla: manchas anchas y suaves que derivan despacio de lado a lado */
  const nieblas=[{y:.46,r:.36,v:5,o:0,a:.11,c:'150,138,196'},{y:.62,r:.3,v:-4,o:.4,a:.1,c:'132,126,178'},{y:.78,r:.42,v:6,o:.7,a:.12,c:'118,120,170'},{y:.36,r:.3,v:-3,o:.2,a:.07,c:'176,150,214'},{y:.9,r:.5,v:-5,o:.9,a:.12,c:'100,108,150'}];
  function pintarNiebla(t,desde,hasta){
    for(let i=desde;i<hasta;i++){ const n=nieblas[i], r=Math.max(W,H)*n.r*(W<H?.9:1), pos=((n.o*(W+2*r)+t*n.v*(W/900)*10)%(W+2*r)+(W+2*r))%(W+2*r)-r;
      const g=cx.createRadialGradient(pos,H*n.y,0,pos,H*n.y,r); g.addColorStop(0,'rgba('+n.c+','+n.a+')'); g.addColorStop(1,'rgba('+n.c+',0)'); cx.fillStyle=g; cx.fillRect(pos-r,H*n.y-r,2*r,2*r); }
  }
  /* un par de ojos pálidos que se abre en la oscuridad, mira un rato, parpadea y se apaga; luego tarda en volver */
  function pintarOjos(t){
    if(!ojos||t>ojos.fin){ const e=W<H?{x:.78,y:.66}:{x:.8,y:.7}; const r=semilla(Math.floor(t*10)+3)(); ojos={ini:t+7+r*9,fin:t+7+r*9+5.5,x:e.x*W+(r-.5)*W*.05,y:e.y*H+(r-.5)*H*.04}; }
    if(t<ojos.ini) return;
    const u=t-ojos.ini; let a=Math.min(1,u/1.4)*Math.min(1,(5.5-u)/1.2); if(u>2.6&&u<2.75) a=0;           // el parpadeo
    if(a<=0) return;
    const s=Math.max(.7,Math.min(1.5,W/900)), sep=11*s;
    cx.save(); cx.shadowColor='rgba(190,214,170,'+(.9*a)+')'; cx.shadowBlur=10*s; cx.fillStyle='rgba(214,230,190,'+(.9*a)+')';
    for(const d of [-1,1]){ cx.beginPath(); cx.ellipse(ojos.x+d*sep,ojos.y,4.2*s,1.9*s,d*.28,0,6.283); cx.fill(); }
    cx.restore();
  }
  function cuadro(t){
    cx.setTransform(1,0,0,1,0,0); cx.clearRect(0,0,lienzo.width,lienzo.height); cx.scale(dpr,dpr);
    cx.drawImage(capas.fondo,0,0,W,H);
    pintarNiebla(t,3,4);
    cx.drawImage(capas.lejos,0,0,W,H);
    pintarNiebla(t,0,3);
    if(!quieto) pintarOjos(t);
    cx.drawImage(capas.cerca,0,0,W,H);
    pintarNiebla(t,4,5);
    cx.font=tamGlifo+'px ui-monospace,Menlo,Consolas,"DejaVu Sans Mono",monospace'; cx.textBaseline='alphabetic'; cx.textAlign='left';
    for(const h of hierba){ cx.fillStyle='rgba(120,128,170,'+h.a+')'; cx.fillText(h.ch,h.x+Math.sin(t*.9+h.f)*1.6,h.y); }
    for(const p of petalos){
      const x=((p.x+p.vx*t+Math.sin(t*.5+p.fase)*14)%(W+40)+W+40)%(W+40)-20, y=((p.y+p.vy*t)%(H*.75)+H*.75)%(H*.75)+H*.25;
      cx.fillStyle='rgba(236,232,250,'+(p.a*(.55+.45*Math.sin(t*1.3+p.fase)))+')'; cx.font=(tamGlifo*p.z)+'px ui-monospace,Menlo,Consolas,monospace'; cx.fillText(p.ch,x,y);
    }
    cx.drawImage(capas['vineta'],0,0,W,H);
  }
  function medir(){
    const w=Math.max(1,window.innerWidth), h=Math.max(1,window.innerHeight);
    if(w===W&&h===H&&capas) return;
    W=w; H=h; dpr=Math.min(window.devicePixelRatio||1,1.5);
    lienzo.width=Math.round(W*dpr); lienzo.height=Math.round(H*dpr); lienzo.style.width=W+'px'; lienzo.style.height=H+'px';
    armar(); dibujarMarco(W,H); cuadro((performance.now()-t0)/1000);
  }
  function lazo(ahora){
    requestAnimationFrame(lazo);
    if(document.hidden||ahora-ultimo<33) return; ultimo=ahora;                  // unos 30 cuadros por segundo bastan para niebla y pétalos
    cuadro((ahora-t0)/1000);
  }
  let aj=null; window.addEventListener('resize',()=>{ clearTimeout(aj); aj=setTimeout(medir,120); });
  window.addEventListener('orientationchange',()=>setTimeout(medir,250));
  medir();
  if(!quieto) requestAnimationFrame(lazo);
  P.cuadro=()=>cuadro((performance.now()-t0)/1000);
})(window.NV);

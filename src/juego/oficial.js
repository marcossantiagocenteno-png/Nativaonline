/* Nativa Online — MODO OFICIAL: el cliente del mundo único y persistente.
   Se activa SÓLO con ?oficial en el enlace (opcional: ?oficial=wss://servidor). Sin eso este módulo no hace nada y el juego es el
   modo solitario de siempre: el mundo vive en el navegador, con su borrador, sin servidor.

   En modo oficial la fuente de verdad es el servidor (servidor/red.js):
     · al entrar se baja el mundo oficial; el borrador local NO se lee ni se escribe;
     · el Modo Dios sigue siendo el mismo, pero cada cambio pasa por NV.oficial.editar(): se aplica acá en el acto (para que se sienta
       inmediato) y se manda al servidor, que lo valida, lo guarda y lo reparte. Si lo rechaza, se vuelve a bajar el mundo oficial;
     · lo que hacen los demás llega solo y se aplica en orden; si falta algo, o la huella no coincide con la del servidor, se pide el mundo entero;
     · sin conexión (o sin clave de administrador) el Modo Dios queda en SOLO LECTURA: nada se guarda para mandarlo después;
     · se guarda una réplica del último estado oficial para abrir rápido y para ver el mundo sin conexión. No es una fuente de verdad:
       al conectar el servidor comprueba su huella y, si no coincide, manda el mundo de nuevo.
   La clave de administrador se escribe en el panel del Modo Dios (nunca viaja en el enlace ni está en el código). Se comprueba contra el
   servidor y sólo se recuerda en este dispositivo si el servidor la acepta. Protocolo: ver servidor/red.js. */
(function(NV){
  const O=NV.oficial={activo:false,estado:'apagado',rol:null,seq:0,url:null,listo:false,divergencias:0,resincronizaciones:0,reconexiones:0};
  let par=null; try{ par=/[?&]oficial(?:=([^&]*))?(?:&|$)/.exec(location.search||''); }catch(e){}
  if(!par) return;                                    // modo solitario: nada de esto existe

  const CLAVE_ID='nativa.identidad.v1', CLAVE_ADMIN='nativa.admin.v1', CLAVE_CACHE='nativa.oficial.v1';
  const leer=k=>{ try{ return localStorage.getItem(k); }catch(e){ return null; } };
  const escribir=(k,v)=>{ try{ localStorage.setItem(k,v); return true; }catch(e){ return false; } };
  const borrar=k=>{ try{ localStorage.removeItem(k); }catch(e){} };
  const $o=id=>document.getElementById(id);

  /* ---------- a dónde se conecta ---------- */
  let url=par[1]?decodeURIComponent(par[1]):(NV.SERVIDOR_OFICIAL||'');
  if(!url) url='ws://'+(location.hostname||'localhost')+':8787';
  url=url.replace(/^http/,'ws').replace(/\/+$/,'');
  const urlValida=/^wss?:\/\/[^\s/]+$/.test(url);
  O.activo=true; O.url=url; O.http=url.replace(/^ws/,'http');

  let ws=null, seq=0, lastSeq=-1, lastHuella=null, baseValida=false, forzarCompleto=false, perdidos=0;
  let claveAdmin=leer(CLAVE_ADMIN)||'', claveProbando='';
  let nSig=1; const pend=new Set();
  let retardo=500, tRec=null, tVer=null, tCache=null, latido=null, lastRx=0, pausado=false, primera=null, importando=null;

  function identidad(){
    let t=leer(CLAVE_ID);
    if(!t||t.length<16){ const a=new Uint8Array(24); crypto.getRandomValues(a); t=Array.from(a,x=>x.toString(16).padStart(2,'0')).join(''); escribir(CLAVE_ID,t); }
    return t;
  }
  const tokenActual=()=>claveProbando||claveAdmin||identidad();
  const huellaLocal=()=>NV.huella(NV.mundo.exportar());
  const mundoVacio=()=>({formato:NV.mundo.FORMATO,semilla:NV.CONFIG.seed,paneles:{},rasgos:[],caminos:[],terreno:[]});

  /* ---------- avisos e interfaz ---------- */
  function aviso(t){
    if(O.listo&&NV.editor&&NV.editor.decir) NV.editor.decir(t);
    else { const e=$o('toast'); if(e){ e.textContent=t.replace(/<[^>]*>/g,''); e.classList.add('show'); setTimeout(()=>e.classList.remove('show'),3500); } }
  }
  const PALABRA={conectando:'conectando…','en-linea':'en línea','sin-conexion':'sin conexión',rechazado:'no disponible'};
  O.puedeEditar=()=>O.estado==='en-linea'&&O.rol==='admin'&&!!ws&&ws.readyState===1;
  O.motivoSoloLectura=()=>{
    if(O.estado==='rechazado') return 'El mundo oficial no está disponible desde este navegador: solo lectura.';
    if(O.estado==='conectando') return 'Conectando con el mundo oficial… por ahora solo lectura.';
    if(O.estado!=='en-linea') return 'Sin conexión con el mundo oficial: el Modo Dios queda en solo lectura.';
    return 'Solo un administrador puede editar el mundo oficial. Pon la clave de administrador en el panel del Modo Dios.';
  };
  function actualizarUI(){
    const de=$o('ofEstado'); if(de){
      de.textContent='mundo oficial'+(O.estado==='en-linea'?(O.rol==='admin'?' · administrador':' · solo lectura'):' · '+(PALABRA[O.estado]||'')+' · solo lectura');
    }
    const p=$o('diosOficial'), l=$o('ofLinea'); const dios=$o('dios');
    if(p) p.style.display='block';
    if(dios) dios.classList.toggle('soloLectura',!O.puedeEditar());
    if(l){
      let t='Mundo oficial · '+(PALABRA[O.estado]||'')+(O.estado==='en-linea'?' · '+(O.rol==='admin'?'administrador':'jugador'):'');
      if(O.estado==='en-linea') t+=' · versión '+seq+(lastHuella?' · código '+lastHuella.slice(0,8):'');
      if(!O.puedeEditar()) t+='\nsolo lectura';
      l.textContent=t;
    }
    const admin=O.estado==='en-linea'&&O.rol==='admin';
    for(const id of ['ofCopia','ofImportar']){ const b=$o(id); if(b) b.style.display=admin?'':'none'; }
    const ol=$o('ofClaveOlvidar'); if(ol) ol.style.display=claveAdmin?'':'none';
  }

  /* ---------- el mundo que se muestra ---------- */
  function cargarMundo(m){ try{ NV.mundo.cargar(m); return true; }catch(e){ console.warn('mundo oficial no cargado: '+e.message); return false; } }
  function refrescar(){
    if(!O.listo) return;
    if(typeof tictac==='function') tictac();
    NV.olvidarObjetos();
    if(NV.editor&&NV.editor.refrescar) NV.editor.refrescar();
    if(typeof programarCuadro==='function') programarCuadro();
  }

  /* ---------- réplica local del último estado oficial ---------- */
  function leerReplica(){
    let c=null; try{ c=JSON.parse(leer(CLAVE_CACHE)||'null'); }catch(e){}
    if(!c||c.semilla!==NV.CONFIG.seed||!Number.isInteger(c.seq)||typeof c.huella!=='string') return false;
    if(!cargarMundo(c.mundo)) return false;
    if(huellaLocal()!==c.huella){ cargarMundo(mundoVacio()); return false; }      // dañada: no se usa
    seq=c.seq; lastSeq=c.seq; lastHuella=c.huella; baseValida=true; return true;
  }
  function guardarReplicaLuego(){
    clearTimeout(tCache);
    tCache=setTimeout(()=>{
      if(O.estado!=='en-linea'||pend.size||lastSeq!==seq||!lastHuella) return;
      escribir(CLAVE_CACHE,JSON.stringify({semilla:NV.CONFIG.seed,seq,huella:lastHuella,mundo:NV.mundo.exportar()}));
    },1500);
  }
  /* comprobación de integridad: con todo asentado, el mundo de acá tiene que tener la huella que dice el servidor */
  function verificarLuego(){
    clearTimeout(tVer);
    tVer=setTimeout(()=>{
      if(O.estado!=='en-linea'||pend.size||lastSeq!==seq||!lastHuella) return;
      if(huellaLocal()!==lastHuella){ O.divergencias++; console.warn('el mundo local no coincide con el oficial: se baja de nuevo'); resync(); }
    },500);
  }

  /* ---------- la conexión ---------- */
  const enviar=m=>{ if(!ws||ws.readyState!==1) return false; ws.send(JSON.stringify(m)); return true; };
  function programar(){
    clearTimeout(tRec); if(pausado||O.estado==='rechazado') return;
    const t=forzarCompleto?50:retardo+Math.random()*retardo*0.3; retardo=Math.min(retardo*2,10000);
    tRec=setTimeout(conectar,t);
  }
  function conectar(){
    clearTimeout(tRec); if(pausado||O.estado==='rechazado') return;
    if(ws&&ws.readyState<=1) return;
    if(!urlValida){ rechazar('La dirección del servidor oficial no es válida.'); return; }
    if(O.estado!=='en-linea') O.estado=baseValida||O.reconexiones?'sin-conexion':'conectando';
    let s; try{ s=new WebSocket(url); }catch(e){ rechazar('Este navegador no puede abrir esa conexión (¿página segura con servidor sin cifrar?).'); return; }
    ws=s; O.ws=s; actualizarUI();
    s.onopen=()=>{
      lastRx=Date.now();
      const h={t:'hola',v:1,token:tokenActual()};
      if(baseValida&&!forzarCompleto){ h.desde=seq; h.huella=huellaLocal(); }
      forzarCompleto=false; enviar(h);
    };
    s.onmessage=ev=>{ lastRx=Date.now(); let m; try{ m=JSON.parse(ev.data); }catch(e){ return; } try{ recibir(m); }catch(e){ console.warn('mensaje del servidor: '+e.message); resync(); } };
    s.onerror=()=>{};
    s.onclose=()=>{
      if(ws!==s) return;
      ws=null; clearInterval(latido); perdidos=pend.size; pend.clear();
      if(NV.jugadores) NV.jugadores.desconectado();     // los demás jugadores dejan de verse: al volver se estrena personaje
      if(O.estado!=='rechazado'){ O.estado='sin-conexion'; O.reconexiones++; }
      actualizarUI(); programar();
    };
  }
  function rechazar(t){ O.estado='rechazado'; O.motivoRechazo=t; clearTimeout(tRec); if(ws){ try{ ws.close(); }catch(e){} } actualizarUI(); aviso(t); alPrimera(); }
  function alPrimera(){ if(primera){ const f=primera; primera=null; f(); } }
  /* volver a bajar el mundo oficial entero (un cambio rechazado, un salto de versiones, una huella que no coincide) */
  function resync(){
    O.resincronizaciones++;
    if(ws&&ws.readyState===1){ enviar({t:'resync'}); return; }       // pide el mundo entero sin cortar la conexión (el personaje sigue siendo el mismo)
    forzarCompleto=true; if(ws&&ws.readyState===0){ try{ ws.close(4000,'resync'); }catch(e){} } else conectar();
  }
  function reiniciarConexion(){ if(ws&&ws.readyState<=1){ try{ ws.close(4001,'otra identidad'); }catch(e){} } else conectar(); }
  function arrancarLatido(){
    clearInterval(latido);
    latido=setInterval(()=>{ if(!ws||ws.readyState!==1) return; if(Date.now()-lastRx>30000){ try{ ws.close(); }catch(e){} return; } enviar({t:'ping',ts:Date.now()}); },10000);
  }

  function recibir(m){
    switch(m.t){
      case 'bienvenida': {
        if(m.semilla!==NV.CONFIG.seed){ rechazar('Este navegador y el servidor no usan el mismo mundo base.'); return; }
        if(claveProbando){
          const ok=m.rol==='admin'; const k=claveProbando; claveProbando='';
          if(ok){ claveAdmin=k; escribir(CLAVE_ADMIN,k); aviso('Clave de administrador aceptada en este dispositivo.'); }
          else { aviso('Esa no es una clave de administrador.'); reiniciarConexion(); return; }
        }
        const rolAntes=O.rol; O.rol=m.rol; O.id=m.id;
        if(NV.jugadores) NV.jugadores.bienvenida(m);          // su personaje temporal y los jugadores que ya estaban
        let cambio=false;
        if(m.modo==='completo'){
          if(!cargarMundo(m.mundo)){ rechazar('No pude cargar el mundo oficial en este navegador.'); return; }
          cambio=true; seq=m.seq;
          if(O.listo&&NV.editor&&NV.editor.vaciarPilas) NV.editor.vaciarPilas();
          if(perdidos&&O.listo) aviso('Un cambio no llegó a confirmarse: se recuperó el estado oficial.');
        } else {
          for(const x of m.ops){ if(x.seq!==seq+1){ resync(); return; } NV.mundo.editar(x.op); seq=x.seq; cambio=true; }
          if(seq!==m.seq){ resync(); return; }
        }
        perdidos=0; baseValida=true; lastSeq=m.seq; lastHuella=m.huella; O.seq=seq;
        O.estado='en-linea'; retardo=500; arrancarLatido();
        if(cambio||rolAntes!==m.rol) refrescar();
        actualizarUI(); guardarReplicaLuego(); verificarLuego(); alPrimera();
        return; }
      case 'op': {
        if(m.seq<=seq) return;
        if(m.seq!==seq+1){ resync(); return; }
        NV.mundo.editar(m.op); seq=m.seq; O.seq=seq; lastSeq=seq; lastHuella=m.huella;
        refrescar(); actualizarUI(); verificarLuego(); guardarReplicaLuego(); return; }
      case 'ok': {
        pend.delete(m.n);
        if(!m.sinCambio){ if(m.seq===seq+1) seq=m.seq; else if(m.seq>seq+1){ resync(); return; } }
        O.seq=seq; if(m.seq===seq){ lastSeq=seq; lastHuella=m.huella; }
        actualizarUI(); verificarLuego(); guardarReplicaLuego(); return; }
      case 'mundo': {
        if(!cargarMundo(m.mundo)){ resync(); return; }
        if(O.estado!=='en-linea'){ O.estado='en-linea'; retardo=500; arrancarLatido(); }
        seq=m.seq; O.seq=seq; lastSeq=seq; lastHuella=m.huella; baseValida=true; pend.clear();
        if(NV.editor&&NV.editor.vaciarPilas) NV.editor.vaciarPilas();
        refrescar(); actualizarUI(); guardarReplicaLuego(); alPrimera();
        if(m.motivo==='restaurar') aviso('El administrador restauró una versión anterior del mundo.');
        else if(m.motivo==='importar') aviso('El mundo oficial fue reemplazado por una copia importada.');
        return; }
      case 'error': {
        if(m.n!==undefined) pend.delete(m.n);
        if(m.codigo==='version'||m.codigo==='token'){
          if(claveProbando){ claveProbando=''; aviso('Esa clave no sirve.'); reiniciarConexion(); }
          else rechazar('El servidor no aceptó esta conexión ('+m.codigo+').');
          return;
        }
        if(m.n!==undefined){
          aviso(m.codigo==='permiso'?m.motivo:'El servidor no aceptó el cambio ('+(m.motivo||m.codigo)+'). Se restaura el mundo oficial.');
          resync();
        }
        return; }
      default: if(NV.jugadores) NV.jugadores.recibir(m); return;     // presencia (j+, j-, mov, pos); pong y lo que venga después
    }
  }

  /* ---------- editar (lo único que usa el Modo Dios para cambiar el mundo) ---------- */
  O.editar=function(op){
    if(!O.puedeEditar()){ aviso(O.motivoSoloLectura()); return null; }
    const inv=NV.mundo.editar(op);                 // se ve en el acto; el servidor tiene la última palabra
    if(!inv) return inv;
    const n=nSig++; pend.add(n); enviar({t:'editar',n,op});
    return inv;
  };

  /* ---------- copia completa e importación (sólo administradores) ---------- */
  const cabecera=()=>({Authorization:'Bearer '+claveAdmin});
  O.copia=async function(){
    if(O.rol!=='admin'||!claveAdmin){ aviso('Para bajar la copia completa hace falta la clave de administrador.'); return false; }
    try{
      const r=await fetch(O.http+'/copia',{headers:cabecera()});
      if(!r.ok) throw new Error('el servidor respondió '+r.status);
      const t=await r.text(), j=JSON.parse(t);
      const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([t],{type:'application/json'}));
      a.download='nativa-copia-v'+j.seq+'.json'; document.body.appendChild(a); a.click(); a.remove();
      aviso('<b>Copia completa bajada</b>\nTiene todo el mundo oficial y su historial de la versión '+j.seq+'.'); return true;
    }catch(e){ aviso('No pude bajar la copia: '+e.message); return false; }
  };
  O.importar=async function(texto){
    if(O.rol!=='admin'||!claveAdmin){ aviso('Para importar hace falta la clave de administrador.'); return false; }
    try{
      const r=await fetch(O.http+'/importar',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},cabecera()),body:texto});
      const j=await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(j.error||('el servidor respondió '+r.status));
      return true;
    }catch(e){ aviso('No se importó nada: '+e.message); return false; }
  };

  /* ---------- panel del Modo Dios ---------- */
  function iniciarUI(){
    const b=id=>$o(id);
    const inp=b('ofClaveTxt'), form=b('ofClaveForm');
    if(inp){ for(const ev of ['keydown','keyup','keypress']) inp.addEventListener(ev,e=>{ e.stopPropagation(); if(ev==='keydown'&&e.key==='Enter'){ e.preventDefault(); entrarClave(); } }); }   // escribir la clave no mueve al personaje ni abre nada
    function entrarClave(){
      const v=(inp.value||'').trim(); if(v.length<16){ aviso('La clave de administrador tiene al menos 16 caracteres.'); return; }
      inp.value=''; form.style.display='none'; claveProbando=v; reiniciarConexion();
    }
    if(b('ofClave')) b('ofClave').addEventListener('click',()=>{ const ver=form.style.display==='block'; form.style.display=ver?'none':'block'; if(!ver) inp.focus(); });
    if(b('ofClaveOk')) b('ofClaveOk').addEventListener('click',entrarClave);
    if(b('ofClaveOlvidar')) b('ofClaveOlvidar').addEventListener('click',()=>{ claveAdmin=''; claveProbando=''; borrar(CLAVE_ADMIN); aviso('Clave olvidada en este dispositivo.'); form.style.display='none'; reiniciarConexion(); });
    if(b('ofCopia')) b('ofCopia').addEventListener('click',()=>O.copia());
    const arch=b('ofArchivo'), bi=b('ofImportar');
    if(bi) bi.addEventListener('click',()=>{
      if(importando){ const t=importando.texto; clearTimeout(importando.t); importando=null; bi.textContent='importar'; O.importar(t).then(ok=>{ if(ok) aviso('Copia importada: el mundo oficial es ahora el de la copia (se hizo un respaldo del anterior).'); }); return; }
      if(arch) arch.click();
    });
    if(arch) arch.addEventListener('change',()=>{
      const f=arch.files&&arch.files[0]; arch.value=''; if(!f) return;
      const rd=new FileReader();
      rd.onload=()=>{ importando={texto:String(rd.result),t:setTimeout(()=>{ importando=null; bi.textContent='importar'; },15000)};
        bi.textContent='confirmar importación';
        aviso('<b>Importar «'+f.name+'»</b>\nReemplaza TODO el mundo oficial por esa copia. Antes se hace un respaldo del actual.\nPulsa «confirmar importación» en 15 segundos para seguir; si no, no pasa nada.'); };
      rd.readAsText(f);
    });
    actualizarUI();
  }
  iniciarUI();

  /* ---------- arranque: el mundo oficial se baja ANTES de generar el primer panel ---------- */
  O.arrancar=function(seguir){
    if(!leerReplica()) cargarMundo(mundoVacio());     // nunca el borrador ni mundo-datos.js: lo único que cuenta es lo que diga el servidor
    const t=$o('toast'); if(t){ t.textContent='Conectando con el mundo oficial…'; t.classList.add('show'); }
    const salir=()=>{ if(O.listo) return; O.listo=true; if(t) t.classList.remove('show'); seguir(); if(NV.jugadores) NV.jugadores.alIniciar(); actualizarUI(); };
    primera=salir; setTimeout(()=>{ if(primera){ primera=null; salir(); } },4500);
    O.estado=baseValida?'sin-conexion':'conectando';
    conectar();
  };
  /* para pruebas y mantenimiento: cortar la conexión sin que se reconecte, y volver a abrirla */
  O.pausar=function(){ pausado=true; clearTimeout(tRec); if(ws){ try{ ws.close(); }catch(e){} } };
  O.reanudar=function(){ pausado=false; retardo=500; conectar(); };
  O.huella=huellaLocal; O.enviar=enviar;
  O.pendientes=()=>pend.size;
})(window.NV);

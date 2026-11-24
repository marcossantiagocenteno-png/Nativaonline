/* Nativa Online — JUGADORES: los demás, en el mundo oficial.
   Sólo hace algo con ?oficial (si no, NV.jugadores existe pero no está activo y no cambia nada: modo solitario intacto).

   El personaje propio se mueve en el acto (anticipa); cada paso se manda al servidor, que lo valida con la colisión del juego y corrige lo que
   no valga (servidor/presencia.js). Los demás jugadores son personajes comunes de NV.personajes, creados con NV.nuevoPersonaje y movidos con
   NV.avanzarPersonaje: el motor de personajes, las animaciones y el dibujo son los de siempre, sin tocarlos.
   Los pasos ajenos llegan con la red a tirones; se encolan y se dan al ritmo del juego (un metro cada 186 ms) para que se vean fluidos.
   Es temporal: cada conexión estrena personaje (id y nombre nuevos) y no hay progreso individual guardado. */
(function(NV){
  const J=NV.jugadores={activo:false,yo:null,remotos:new Map(),alPaso(){},alIniciar(){},bienvenida(){},recibir(){},desconectado(){}};
  if(!(NV.oficial&&NV.oficial.activo)) return;
  J.activo=true;

  const PASO_MS=186;                           // el mismo de jugar.js
  let epoca=0, mia=null, dentro=false, pendiente=null, bucle=false;
  const aviso=t=>{ if(typeof bubble==='function') bubble(t); };
  const enviar=m=>NV.oficial.enviar&&NV.oficial.enviar(m);

  /* ---------- el personaje propio ---------- */
  /* poner a quien juega donde dice el servidor (al entrar, o cuando lo corrige) */
  function colocarMe(p,mensaje){
    me.x=p.x; me.y=p.y; if(p.mirando) facing=p.mirando;
    NV.desdeX=undefined; NV.desdeY=undefined;
    mia={x:p.x,y:p.y}; if(p.e!==undefined) epoca=p.e;
    if(typeof detenerRuta==='function') detenerRuta();
    if(typeof dejarDeCaminar==='function') dejarDeCaminar();
    NV.camDirecta=true; if(typeof programarCuadro==='function') programarCuadro(); setTimeout(()=>{ NV.camDirecta=false; if(typeof programarCuadro==='function') programarCuadro(); },120);
    if(mensaje) aviso(mensaje);
  }
  /* lo llama move() de jugar.js después de cada paso (y después de pisar un umbral) */
  J.alPaso=function(){
    if(!J.activo||!mia||!NV.oficial.listo) return;
    if(NV.escena){ if(!dentro){ dentro=true; enviar({t:'escena',dentro:true}); } return; }
    if(dentro){ dentro=false; mia={x:me.x,y:me.y}; enviar({t:'escena',dentro:false,x:me.x,y:me.y}); return; }
    const dx=me.x-mia.x, dy=me.y-mia.y;
    if(!dx&&!dy) return;
    if(Math.abs(dx)+Math.abs(dy)===1){ mia={x:me.x,y:me.y}; enviar({t:'mover',x:me.x,y:me.y,e:epoca}); }
  };
  /* lo que no es un paso (Mayús+R, salir de una cueva por un botón…) se detecta aparte */
  setInterval(()=>{
    if(!J.activo||!mia||!NV.oficial.listo||typeof me==='undefined') return;
    if(!NV.escena&&dentro){ dentro=false; mia={x:me.x,y:me.y}; enviar({t:'escena',dentro:false,x:me.x,y:me.y}); return; }
    if(NV.escena&&!dentro){ dentro=true; enviar({t:'escena',dentro:true}); return; }
    if(!NV.escena&&(me.x!==mia.x||me.y!==mia.y)){ mia={x:me.x,y:me.y}; enviar({t:'reaparecer'}); }     // un salto que no es un paso: lo decide el servidor
  },300);

  /* ---------- los demás ---------- */
  function agregar(j){
    quitar(j.id);
    const p=NV.nuevoPersonaje({arte:null,nombre:j.nombre,alto:1.75,x:j.x,y:j.y,mirando:j.mirando||'sur',pasoMs:PASO_MS});
    p._remoto=j.id; p._cola=[]; NV.personajes.push(p); J.remotos.set(j.id,p); if(typeof programarCuadro==='function') programarCuadro();
  }
  function quitar(id){
    const p=J.remotos.get(id); if(!p) return;
    const i=NV.personajes.indexOf(p); if(i>=0) NV.personajes.splice(i,1);
    J.remotos.delete(id); if(typeof programarCuadro==='function') programarCuadro();
  }
  function limpiar(){ for(const id of Array.from(J.remotos.keys())) quitar(id); }
  function teletransportar(p,x,y,mirando){ p._cola.length=0; p.x=x; p.y=y; p.desdeX=undefined; p.desdeY=undefined; p.ultimoPaso=0; if(mirando) p.mirando=mirando; }

  /* un lazo propio, sólo mientras alguien se mueve: da los pasos encolados al ritmo del juego y pide cuadros */
  function lazo(){
    bucle=false; const ahora=Date.now(); let vivo=false;
    for(const p of J.remotos.values()){
      if(p._cola.length){
        p.pasoMs=p._cola.length>=3?110:PASO_MS;                    // si se atrasó, apura un poco para alcanzar
        if(ahora-(p.ultimoPaso||0)>=p.pasoMs-8){
          const s=p._cola.shift(), dx=s.x-p.x, dy=s.y-p.y;
          if(Math.abs(dx)+Math.abs(dy)===1) NV.avanzarPersonaje(p,dx,dy,ahora); else teletransportar(p,s.x,s.y,s.mirando);
        }
      }
      if(p._cola.length||ahora-(p.ultimoPaso||0)<p.pasoMs+60) vivo=true;
    }
    if(typeof programarCuadro==='function') programarCuadro();
    if(vivo) despertar();
  }
  function despertar(){ if(!bucle){ bucle=true; requestAnimationFrame(lazo); } }

  /* ---------- lo que llega del servidor ---------- */
  J.bienvenida=function(m){
    limpiar(); J.yo=m.yo||null; dentro=false;
    for(const j of (m.jugadores||[])) agregar(j);
    if(J.yo){ if(NV.oficial.listo) colocarMe(J.yo); else pendiente=J.yo; }
  };
  J.alIniciar=function(){ if(pendiente){ const p=pendiente; pendiente=null; colocarMe(p); } };
  J.desconectado=function(){ limpiar(); J.yo=null; dentro=false; };
  J.recibir=function(m){
    switch(m.t){
      case 'j+': if(m.j&&(!J.yo||m.j.id!==J.yo.id)) agregar(m.j); break;
      case 'j-': quitar(m.id); break;
      case 'mov': {
        const p=J.remotos.get(m.id); if(!p) break;
        p.mirando=m.mirando||p.mirando;
        if(m.salto) teletransportar(p,m.x,m.y,m.mirando); else p._cola.push({x:m.x,y:m.y,mirando:m.mirando});
        despertar(); break; }
      case 'pos':
        colocarMe(m,m.motivo==='obra'?'El suelo cambió bajo tus pies: te llevaron a un lugar libre.'
                  :m.motivo==='escena'||m.motivo==='inicio'?null
                  :'Algo te frenó en el camino.');
        break;
    }
  };
})(window.NV);

/* Nativa Online — PRESENCIA: quién está en el mundo oficial y dónde.
   El servidor es la autoridad sobre las posiciones. El cliente se mueve en el acto (anticipa) y manda cada paso; acá se valida con el MISMO
   código de colisión del juego (NV.sueloEn / NV.solidoEn, cargado por servidor/cargar-mundo.js: no hay una segunda implementación) y
   se corrige cualquier posición inválida.

   Un jugador es temporal: nace al conectarse y desaparece al desconectarse. Su `id` interno es al azar y no tiene nada que ver con su nombre
   visible ni con la identidad del dispositivo (identidad.js); al reconectarse se estrena otro. No hay progreso que recuperar.

   Reglas de un paso (todas del servidor, ninguna del cliente):
     · un metro en una de las cuatro direcciones (el personaje no camina en diagonal);
     · la casilla de destino existe y no es sólida (agua honda, roca, objetos);
     · ritmo: el juego da un paso cada PASO_MS (186 ms, igual que jugar.js; pruebas/presencia.js vigila que sigan iguales). Se deja un margen
       de 20 % y una ráfaga corta (4 pasos) por los tirones de la red; más rápido que eso se rechaza.
   Cada corrección sube la `epoca` del jugador. Los pasos que ya venían en camino con la época vieja se descartan sin responder: así una corrección
   no se pisa a sí misma con avisos atrasados.
   Los jugadores se pueden superponer al caminar (no se bloquean entre sí); sólo al NACER o al ser reubicados se busca una casilla desocupada.
   Dentro de una cueva el jugador sale de la vista de los demás (las cuevas compartidas son de una etapa posterior). */
'use strict';
const crypto=require('crypto');

const PASO_MS=186;                 // = PASO_MS de src/juego/jugar.js
const DIRS=['norte','sur','este','oeste'];
const ALFABETO='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function crearPresencia(op){
  const NV=op.NV, ahora=op.ahora||Date.now, azar=op.aleatorio||Math.random;
  const pasoMs=op.pasoMs||PASO_MS, margen=0.8, rafaga=4, radioMax=op.radioMax||40;
  const J=new Map(), nombres=new Set();

  /* la misma regla que usa move() en src/juego/jugar.js para dejar pisar una casilla */
  const libre=(x,y)=>!!NV.sueloEn(x,y)&&!NV.solidoEn(x,y);
  const ocupada=(x,y,salvo)=>{ for(const j of J.values()) if(j.id!==salvo&&!j.oculto&&j.x===x&&j.y===y) return true; return false; };
  const agua=(x,y)=>{ const g=NV.sueloEn(x,y); return g==='A'||g==='a'; };
  const pick=a=>a[Math.min(a.length-1,Math.floor(azar()*a.length))];
  const publica=j=>({id:j.id,nombre:j.nombre,x:j.x,y:j.y,mirando:j.mirando});

  /* la casilla libre y desocupada más cercana a (x0,y0): anillo por anillo, al azar dentro de cada anillo; primero sin agua somera */
  function cercana(x0,y0,salvo){
    for(const evitarAgua of [true,false]){
      for(let r=0;r<=radioMax;r++){
        const c=[];
        for(let dy=-r;dy<=r;dy++) for(let dx=-r;dx<=r;dx++){
          if(Math.max(Math.abs(dx),Math.abs(dy))!==r) continue;
          const x=x0+dx, y=y0+dy;
          if(libre(x,y)&&!ocupada(x,y,salvo)&&!(evitarAgua&&agua(x,y))) c.push({x,y});
        }
        if(c.length) return pick(c);
      }
    }
    return null;
  }
  const inicio=()=>NV.panel(0,0).inicio;
  function idNuevo(){ let id; do{ id='j'+crypto.randomBytes(6).toString('hex'); }while(J.has(id)); return id; }
  function nombreNuevo(){
    let n,i=0; do{ let s=''; for(let k=0;k<4;k++) s+=ALFABETO[Math.floor(azar()*ALFABETO.length)]; n='Viajero-'+s; }while(nombres.has(n)&&++i<200);
    return n;
  }

  /* `perfil` (opcional) es un personaje permanente (servidor/personajes.js): conserva su nombre y reaparece donde estaba. Sin perfil, nace temporal como siempre.
     Si su casilla ya no es libre (hubo obras) o está ocupada, se busca la más cercana; si su nombre ya lo lleva alguien conectado, estrena uno al azar. */
  function entrar(perfil){
    const o=inicio(); let c=null, mirando='sur', nombre=null;
    if(perfil&&Number.isInteger(perfil.x)&&Number.isInteger(perfil.y)){
      c=libre(perfil.x,perfil.y)&&!ocupada(perfil.x,perfil.y,null)?{x:perfil.x,y:perfil.y}:cercana(perfil.x,perfil.y,null);
      if(DIRS.includes(perfil.mirando)) mirando=perfil.mirando;
    }
    if(!c) c=cercana(o.x,o.y,null)||{x:o.x,y:o.y};
    if(perfil&&typeof perfil.nombre==='string'&&perfil.nombre&&!nombres.has(perfil.nombre)) nombre=perfil.nombre;
    const j={id:idNuevo(),nombre:nombre||nombreNuevo(),x:c.x,y:c.y,mirando,epoca:0,oculto:false,fichas:rafaga,tFichas:ahora(),tReaparecer:0};
    J.set(j.id,j); nombres.add(j.nombre); return j;
  }
  function salir(id){ const j=J.get(id); if(!j) return null; J.delete(id); nombres.delete(j.nombre); return j; }
  const lista=salvo=>Array.from(J.values()).filter(j=>j.id!==salvo&&!j.oculto).map(publica);
  const get=id=>J.get(id)||null;

  /* un paso pedido por el cliente. Devuelve:
       {ok:true, j}                      aceptado: hay que avisar a los demás
       {ignorado:true}                   venía de una época vieja (ya hubo una corrección): se descarta sin responder
       {rechazo:motivo, j}               no se acepta: hay que mandarle a ese cliente su posición verdadera (j.epoca ya subió) */
  function mover(id,x,y,epoca,t){
    const j=J.get(id); if(!j||j.oculto) return {ignorado:true};
    t=t===undefined?ahora():t;
    if(epoca!==j.epoca) return {ignorado:true};
    const rechazar=motivo=>{ j.epoca++; return {rechazo:motivo,j}; };
    if(!Number.isInteger(x)||!Number.isInteger(y)) return rechazar('formato');
    const dx=x-j.x, dy=y-j.y;
    if(Math.abs(dx)+Math.abs(dy)!==1) return rechazar('lejos');
    if(!libre(x,y)) return rechazar('solido');
    j.fichas=Math.min(rafaga,j.fichas+(t-j.tFichas)/(pasoMs*margen)); j.tFichas=t;
    if(j.fichas<1) return rechazar('rapido');
    j.fichas-=1;
    j.x=x; j.y=y; j.mirando=dy<0?'norte':dy>0?'sur':dx>0?'este':'oeste';
    return {ok:true,j};
  }

  /* entra o sale de una cueva. Adentro desaparece de la vista de los demás; al salir vuelve cerca de donde estaba */
  function escena(id,dentro,x,y){
    const j=J.get(id); if(!j) return null;
    if(dentro){ if(j.oculto) return null; j.oculto=true; j.epoca++; return {oculto:true,j}; }
    if(!j.oculto) return null;
    let c=null;
    if(Number.isInteger(x)&&Number.isInteger(y)&&libre(x,y)&&Math.max(Math.abs(x-j.x),Math.abs(y-j.y))<=6) c={x,y};
    const corregido=!c; if(!c) c=cercana(j.x,j.y,id)||{x:j.x,y:j.y};
    j.x=c.x; j.y=c.y; j.oculto=false; j.epoca++;
    return {vuelve:true,corregido,j};
  }

  /* volver cerca del punto de partida (el cliente lo pide, p. ej. Mayús+R). Tope de uno cada 2 s. */
  function reaparecer(id,t){
    const j=J.get(id); if(!j||j.oculto) return null;
    t=t===undefined?ahora():t; if(t-j.tReaparecer<2000) return {ignorado:true};
    j.tReaparecer=t;
    const o=inicio(), c=cercana(o.x,o.y,id)||{x:j.x,y:j.y};
    j.x=c.x; j.y=c.y; j.epoca++; return {ok:true,j};
  }

  /* el mundo cambió (un administrador construyó, restauró o importó): a quien quedó dentro de un obstáculo se lo corre a la casilla libre
     más cercana. Devuelve los que se movieron (con la época ya subida) para avisar a todos. */
  function revisar(){
    const movidos=[];
    for(const j of J.values()){
      if(libre(j.x,j.y)) continue;
      const c=cercana(j.x,j.y,j.id); if(!c) continue;
      j.x=c.x; j.y=c.y; j.epoca++; movidos.push(j);
    }
    return movidos;
  }
  return {entrar,salir,lista,get,mover,escena,reaparecer,revisar,publica,cantidad:()=>J.size,libre,PASO_MS:pasoMs};
}
module.exports={crearPresencia,PASO_MS};

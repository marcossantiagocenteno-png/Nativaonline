/* Nativa Online — UMBRALES. Pasar de un mapa a otro. LABORATORIO: todavía no está cableado al juego.
   Un umbral es un punto de un mapa (la boca de una cueva por fuera, su salida por dentro, una puerta, una escalera) que, al cruzarlo,
   deja a quien camina en otro mapa. Umbrales no dibuja nada y no sabe cómo es ningún interior: sólo sabe QUÉ puntos hay, a QUÉ mapa
   lleva cada uno y SI se puede cruzar. Por eso un interior nuevo (una cueva, una casa, un sótano) se agrega sin rehacer nada: se
   registra su mapa, se le eligen sus bocas y se atan a las de afuera.

   LA REGLA. Un umbral que no tiene su mapa elegido no se puede cruzar: quien camina no entra. Tampoco se cruza si el mapa elegido
   no existe (todavía no se registró), si ese mapa no tiene puertas o si la puerta elegida ya no está. En todos esos casos el umbral
   funciona como un tope: `bloqueaPaso` lo dice y el movimiento se detiene antes del círculo.

   CONVENCIONES.
   · Cada mapa tiene sus propios metros: x al este, y hacia el sur (la z de una cueva es esa misma y).
   · `dx,dy` es la dirección en que se cruza: hacia donde camina quien sale de ESE mapa por ESE punto. Al aparecer en el destino, quien
     llega queda justo delante de la puerta de destino, mirando hacia adentro de su mapa (−dx,−dy), fuera del círculo: no vuelve a
     disparar el umbral que lo trajo.
   · Un umbral puede apuntar a una puerta concreta (`destino:{mapa,umbral}`) o sólo a un mapa (`destino:{mapa}`; entra por la primera
     puerta que tenga ese mapa).
   · `vincular(a,b)` ata dos umbrales en los dos sentidos: lo normal para una cueva (la boca de afuera y la salida de adentro).
   · Nunca se muestran números a quien juega: `mensaje(motivo)` devuelve una frase.

   El estado vive acá (mapas y umbrales) y se guarda/lee con `exportar`/`importar` (JSON puro). Pruebas: pruebas/umbrales.js. */
(function(NV){
'use strict';
const MAPAS=new Map(), UMB=new Map(), OYE={cruzar:[],bloquear:[]};
const MENSAJES={
  'sin-destino':'El paso no lleva a ningún lado todavía.',
  'mapa-inexistente':'Del otro lado todavía no hay nada.',
  'sin-puertas':'El lugar al que lleva no tiene por dónde entrar.',
  'puerta-inexistente':'La puerta de ese lugar ya no está.',
  'cerrado':'El paso está cerrado.'
};
const mensaje=m=>MENSAJES[m]||'No se puede pasar.';
const num=(v,d)=>(typeof v==='number'&&isFinite(v))?v:d;
function norm(d){
  if(!d||typeof d.id!=='string'||!d.id) throw new Error('umbral sin id');
  if(typeof d.mapa!=='string'||!d.mapa) throw new Error('umbral '+d.id+': falta el mapa al que pertenece');
  let dx=num(d.dx,0), dy=num(d.dy,1); const n=Math.hypot(dx,dy)||1; dx/=n; dy/=n;
  let dest=null; if(d.destino&&typeof d.destino.mapa==='string'&&d.destino.mapa) dest={mapa:d.destino.mapa,umbral:typeof d.destino.umbral==='string'&&d.destino.umbral?d.destino.umbral:null};
  return {id:d.id,mapa:d.mapa,x:num(d.x,0),y:num(d.y,0),dx,dy,radio:Math.max(0.3,Math.min(4,num(d.radio,0.9))),
    tipo:d.tipo==='salida'||d.tipo==='paso'?d.tipo:'entrada',abierto:d.abierto!==false,destino:dest,nota:typeof d.nota==='string'?d.nota:''};
}
const copia=u=>u&&{id:u.id,mapa:u.mapa,x:u.x,y:u.y,dx:u.dx,dy:u.dy,radio:u.radio,tipo:u.tipo,abierto:u.abierto,destino:u.destino&&{mapa:u.destino.mapa,umbral:u.destino.umbral},nota:u.nota};
function emitir(k,e){ for(const f of OYE[k].slice()) { try{ f(e); }catch(err){ /* un oyente que falla no frena a los demás */ } } }

/* ------------------------------------------------------------------ MAPAS ----
   Un mapa es sólo un nombre y su clase ('mundo', 'cueva', ...). Lo que contiene lo sabe quien lo dibuja. */
function registrarMapa(id,def){
  if(typeof id!=='string'||!id) throw new Error('mapa sin id');
  def=def||{}; const m={id,nombre:def.nombre||id,tipo:def.tipo||'mapa'}; if(def.cueva) m.cueva=JSON.parse(JSON.stringify(def.cueva));
  MAPAS.set(id,m); return Object.assign({},m);
}
const mapa=id=>MAPAS.has(id)?Object.assign({},MAPAS.get(id)):null;
const mapas=()=>Array.from(MAPAS.values()).map(m=>Object.assign({},m));
function quitarMapa(id){ MAPAS.delete(id); for(const u of Array.from(UMB.values())) if(u.mapa===id) UMB.delete(u.id); }

/* ------------------------------------------------------------------ UMBRALES ---- */
function registrar(def){ const u=norm(def); UMB.set(u.id,u); return copia(u); }
const obtener=id=>copia(UMB.get(id));
const lista=m=>Array.from(UMB.values()).filter(u=>m==null||u.mapa===m).map(copia);
function quitar(id){ const u=UMB.get(id); if(!u) return false; UMB.delete(id); return true; }
function editar(id,cambios){ const u=UMB.get(id); if(!u) throw new Error('umbral desconocido: '+id); const n=norm(Object.assign({},u,cambios||{},{id})); UMB.set(id,n); return copia(n); }
/* elegir el mapa al que lleva (y, si se quiere, por qué puerta); null lo deja sin destino: quien camina ya no entra */
function elegirMapa(id,mapaDestino,umbralDestino){
  const u=UMB.get(id); if(!u) throw new Error('umbral desconocido: '+id);
  u.destino=mapaDestino?{mapa:mapaDestino,umbral:umbralDestino||null}:null; return copia(u);
}
function vincular(a,b){
  const A=UMB.get(a), B=UMB.get(b); if(!A||!B) throw new Error('umbral desconocido: '+(!A?a:b));
  if(A.mapa===B.mapa) throw new Error('vincular: los dos umbrales están en el mismo mapa ('+A.mapa+')');
  A.destino={mapa:B.mapa,umbral:B.id}; B.destino={mapa:A.mapa,umbral:A.id}; return [copia(A),copia(B)];
}
function desvincular(id,ambos){ const u=UMB.get(id); if(!u) return false; const d=u.destino; u.destino=null;
  if(ambos&&d&&d.umbral){ const o=UMB.get(d.umbral); if(o&&o.destino&&o.destino.umbral===id) o.destino=null; } return true; }
function abrir(id,v){ const u=UMB.get(id); if(!u) throw new Error('umbral desconocido: '+id); u.abierto=v!==false; return copia(u); }

/* ------------------------------------------------------------------ CRUZAR ---- */
/* ¿lleva a algún lado? {ok:true,destino:{mapa,umbral,x,y,dx,dy}} o {ok:false,motivo,mensaje}. No mueve a nadie. */
function puede(id){
  const u=UMB.get(id); if(!u) return {ok:false,motivo:'puerta-inexistente',mensaje:mensaje('puerta-inexistente')};
  const no=m=>({ok:false,motivo:m,mensaje:mensaje(m)});
  if(!u.abierto) return no('cerrado');
  if(!u.destino) return no('sin-destino');
  if(!MAPAS.has(u.destino.mapa)) return no('mapa-inexistente');
  let T;
  if(u.destino.umbral){ T=UMB.get(u.destino.umbral); if(!T||T.mapa!==u.destino.mapa) return no('puerta-inexistente'); }
  else { for(const q of UMB.values()) if(q.mapa===u.destino.mapa){ T=q; break; } if(!T) return no('sin-puertas'); }
  const d=T.radio+0.8;
  return {ok:true,destino:{mapa:T.mapa,umbral:T.id,x:T.x-T.dx*d,y:T.y-T.dy*d,dx:-T.dx,dy:-T.dy}};
}
/* el umbral que contiene el punto (el más cercano si hay varios) */
function detectar(mapaId,x,y){
  let best=null, bd=1e9;
  for(const u of UMB.values()){ if(u.mapa!==mapaId) continue; const d=Math.hypot(x-u.x,y-u.y); if(d<=u.radio&&d<bd){ best=u; bd=d; } }
  return copia(best);
}
/* ¿hay que frenar a quien camina en este punto? Verdadero dentro del círculo de un umbral que no se puede cruzar. */
function bloqueaPaso(mapaId,x,y){ const u=detectar(mapaId,x,y); return !!u&&!puede(u.id).ok; }
/* cruza el umbral con quien camina: j={mapa,x,y,...}. Si se puede, lo deja en el destino; si no, lo deja donde estaba. */
function cruzar(id,j){
  const r=puede(id), u=UMB.get(id);
  if(!r.ok){ const out={ok:false,motivo:r.motivo,mensaje:r.mensaje,umbral:id};
    if(u){ out.rebote={x:u.x-u.dx*(u.radio+0.4),y:u.y-u.dy*(u.radio+0.4)}; }
    emitir('bloquear',out); return out; }
  const D=r.destino, desde=j&&j.mapa;
  if(j){ j.mapa=D.mapa; j.x=D.x; j.y=D.y; j.dx=D.dx; j.dy=D.dy; j.sobre=D.umbral; }
  const out={ok:true,umbral:id,desde:desde==null?u.mapa:desde,destino:D,mapa:D.mapa,x:D.x,y:D.y,dx:D.dx,dy:D.dy};
  emitir('cruzar',out); return out;
}
/* se llama en cada paso de quien camina: si entró en un umbral nuevo, lo cruza (o lo frena). Devuelve null si no pasó nada. */
function paso(j){
  const u=detectar(j.mapa,j.x,j.y);
  if(!u){ j.sobre=null; return null; }
  if(j.sobre===u.id) return null;          // sigue parado donde ya estaba: no vuelve a disparar
  j.sobre=u.id; return cruzar(u.id,j);
}
const alCruzar=f=>{ OYE.cruzar.push(f); return ()=>{ const i=OYE.cruzar.indexOf(f); if(i>=0) OYE.cruzar.splice(i,1); }; };
const alBloquear=f=>{ OYE.bloquear.push(f); return ()=>{ const i=OYE.bloquear.indexOf(f); if(i>=0) OYE.bloquear.splice(i,1); }; };

/* ------------------------------------------------------------------ CUEVAS ----
   Registra el interior de una cueva como un mapa y sus bocas como umbrales de salida (todavía sin destino: hasta que se las ate a
   la boca de afuera, nadie sale por ahí). La z de la cueva y la y de los umbrales son el mismo eje (hacia el sur). */
function desdeCueva(mapaId,S,opt){
  opt=opt||{}; if(!NV.cuevas) throw new Error('desdeCueva: falta el motor de cuevas');
  registrarMapa(mapaId,{nombre:opt.nombre||S.nombre,tipo:'cueva',cueva:S.spec});
  return NV.cuevas.entradas(S).map(e=>registrar({id:mapaId+':'+e.id,mapa:mapaId,tipo:'salida',x:e.x+e.dx*0.3,y:e.z+e.dz*0.3,dx:e.dx,dy:e.dz,radio:Math.min(1.0,e.r*0.6),nota:opt.nota||''}));
}

/* ------------------------------------------------------------------ GUARDADO ---- */
const exportar=()=>JSON.parse(JSON.stringify({version:1,mapas:Array.from(MAPAS.values()),umbrales:Array.from(UMB.values())}));
function importar(d){
  if(!d||d.version!==1) throw new Error('archivo de umbrales no reconocido');
  MAPAS.clear(); UMB.clear(); for(const m of d.mapas||[]) registrarMapa(m.id,m); for(const u of d.umbrales||[]) registrar(u);
  return {mapas:MAPAS.size,umbrales:UMB.size};
}
function reiniciar(){ MAPAS.clear(); UMB.clear(); OYE.cruzar.length=0; OYE.bloquear.length=0; }
const aObjeto=id=>{ const u=obtener(id); if(!u) throw new Error('umbral desconocido: '+id); return {k:'umbral',u}; };
const deObjeto=o=>{ if(!o||o.k!=='umbral'||!o.u) throw new Error('no es un umbral'); return registrar(o.u); };

NV.umbrales={registrarMapa,mapa,mapas,quitarMapa,registrar,obtener,lista,quitar,editar,elegirMapa,vincular,desvincular,abrir,
  puede,detectar,bloqueaPaso,cruzar,paso,alCruzar,alBloquear,desdeCueva,exportar,importar,reiniciar,aObjeto,deObjeto,mensaje,MOTIVOS:Object.keys(MENSAJES)};
})(window.NV);

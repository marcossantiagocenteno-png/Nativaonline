/* Nativa Online — A QUÉ SERVIDOR SE CONECTA EL JUEGO (una sola regla, la usan la portada y el modo oficial).

   ┌─ CONFIGURACIÓN PENDIENTE ─────────────────────────────────────────────────────────────────────────────────────────────────────┐
   │  NV.SERVIDOR_OFICIAL  = dirección del servidor oficial (wss://…). Hoy está VACÍA a propósito: todavía no se eligió alojamiento  │
   │  ni se desplegó el servidor. Mientras esté vacía, una página publicada (https o cualquier equipo que no sea el propio PC)       │
   │  NO intenta conectarse a ninguna dirección: la portada avisa que el servidor oficial todavía no está disponible.               │
   │  Se rellena UNA vez, aquí, cuando el servidor se publique (y esa dirección tiene que ser wss://).                              │
   └────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

   Reglas (NV.destino.elegir):
     1. Un servidor pedido en el enlace (?servidor=… en la portada, ?oficial=… en el juego) sólo se acepta si la página está en un entorno
        de PRUEBA —abierta como archivo (file:), en localhost o en una red privada— Y el servidor pedido también es localhost o de red
        privada. En una página pública (https o no) el parámetro se ignora: un enlace no puede mandar a nadie a un servidor ajeno.
     2. Si no, se usa NV.SERVIDOR_OFICIAL.
     3. Si tampoco hay, y la página está en un entorno de prueba, se usa el servidor del propio equipo (puerto 8787).
     4. Si nada de eso, el servidor oficial está PENDIENTE: no hay dirección y no se conecta a nada.
   Una página https sólo acepta direcciones wss:// (el navegador bloquearía ws://). */
(function(NV){
  if(NV.SERVIDOR_OFICIAL===undefined) NV.SERVIDOR_OFICIAL='';            // ← PENDIENTE (ver arriba)
  const D=NV.destino={};

  /* ¿es una dirección de este equipo o de una red privada? Sólo literales y «localhost»: un nombre cualquiera podría apuntar a Internet. */
  D.esLocal=function(host){
    host=String(host||'').toLowerCase().replace(/^\[|\]$/g,'');
    if(host==='localhost'||host.endsWith('.localhost')) return true;
    const m=/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
    if(m){
      const o=m.slice(1).map(Number); if(o.some(x=>x>255)) return false;
      return o[0]===127||o[0]===10||(o[0]===172&&o[1]>=16&&o[1]<=31)||(o[0]===192&&o[1]===168)||(o[0]===169&&o[1]===254);
    }
    if(host.indexOf(':')>=0&&/^[0-9a-f:.]+$/.test(host)) return host==='::1'||/^f[cd][0-9a-f]{2}:/.test(host)||/^fe[89ab][0-9a-f]:/.test(host);
    return false;
  };
  const hostDe=u=>{ const m=/^wss?:\/\/(\[[^\]]+\]|[^/:\s]+)/.exec(u); return m?m[1]:''; };
  const normal=u=>String(u||'').trim().replace(/^http/,'ws').replace(/\/+$/,'');

  /* pedido: lo que traiga el enlace ('' si nada). loc: {protocol, hostname} (por defecto, la página actual).
     → {url, http, valida, personalizado, pendiente, origen:'enlace'|'oficial'|'local'|'pendiente', ignorado} */
  D.elegir=function(pedido,loc){
    if(!loc){ try{ loc={protocol:location.protocol,hostname:location.hostname}; }catch(e){ loc={protocol:'',hostname:''}; } }
    const proto=loc.protocol||'', host=String(loc.hostname||'').toLowerCase().replace(/^\[|\]$/g,'');
    const segura=proto==='https:';
    const prueba=proto==='file:'||D.esLocal(host);                       // ¿página de prueba (archivo, este equipo o red privada)?
    let url='', origen='pendiente', ignorado=false;
    const ped=normal(pedido);
    if(ped){
      if(prueba&&D.esLocal(hostDe(ped))){ url=ped; origen='enlace'; } else ignorado=true;
    }
    if(!url&&NV.SERVIDOR_OFICIAL){ url=normal(NV.SERVIDOR_OFICIAL); origen='oficial'; }
    if(!url&&prueba){ const h=(!host||proto==='file:')?'localhost':(host.indexOf(':')>=0?'['+host+']':host); url=(segura?'wss':'ws')+'://'+h+':8787'; origen='local'; }
    const pendiente=!url;
    const valida=!pendiente&&/^wss?:\/\/[^\s/]+$/.test(url)&&!(segura&&!/^wss:/.test(url));
    return {url,http:url.replace(/^ws/,'http'),valida,personalizado:origen==='enlace',pendiente,origen,ignorado};
  };
  D.MENSAJE_PENDIENTE='El servidor oficial todavía no está disponible. Mientras tanto puedes jugar en Modo solitario.';
})(window.NV);

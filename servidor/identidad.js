/* Nativa Online — IDENTIDAD Y PERMISOS del servidor.
   Hoy: una identidad temporal de prueba. El cliente guarda un token al azar y lo manda al conectarse; el servidor lo convierte en
   {usuarioId, rol}. Un token que está en la lista de administradores (variable NATIVA_ADMIN_TOKEN, nunca en el repositorio) da rol 'admin'.
   Mañana: cuentas y personajes. Lo único que cambia es esta función (autenticar): el resto del servidor sólo conoce {usuarioId, rol}
   y pregunta puede(rol, accion). No hay ningún atajo provisional que obligue a rehacer eso después.
   Los tokens nunca se guardan ni se escriben en ningún registro: sólo su huella. */
'use strict';
const crypto=require('crypto');
const sha=t=>crypto.createHash('sha256').update(String(t)).digest();
const iguales=(a,b)=>crypto.timingSafeEqual(a,b);

const PERMISOS={
  jugador:new Set(['ver','jugar']),
  admin:new Set(['ver','jugar','editar','restaurar','importar','copia','historial'])
};
const puede=(rol,accion)=>!!(PERMISOS[rol]&&PERMISOS[rol].has(accion));

function crearIdentidad(op){
  const admins=((op&&op.adminTokens)||[]).filter(t=>typeof t==='string'&&t.length>=16).map(sha);
  return {
    /* devuelve {usuarioId, rol} o null si el token no sirve */
    autenticar(token){
      if(typeof token!=='string'||token.length<16||token.length>200) return null;
      const h=sha(token), id=h.toString('hex').slice(0,12);
      return {usuarioId:id,rol:admins.some(a=>iguales(a,h))?'admin':'jugador'};
    },
    hayAdmins:admins.length>0
  };
}
module.exports={crearIdentidad,puede,PERMISOS};

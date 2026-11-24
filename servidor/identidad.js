/* Nativa Online — IDENTIDAD Y PERMISOS del servidor.
   Hay dos maneras de llegar al servidor:
     · INVITADO: el cliente guarda un token al azar y lo manda en `hola`. Eso es una identidad temporal y SIEMPRE da rol 'jugador'.
       Ningún token, por largo o parecido a una contraseña que sea, da permisos de administrador.
     · ADMINISTRADOR: la contraseña (variable NATIVA_ADMIN_TOKEN, nunca en el repositorio) se comprueba una sola vez en POST /entrar
       (entrar()), que devuelve una SESIÓN firmada (servidor/sesiones.js). La sesión es lo único que da rol 'admin'.
   Mañana: cuentas y personajes. Lo único que cambia es este archivo: el resto del servidor sólo conoce {usuarioId, rol}
   y pregunta puede(rol, accion). Los tokens y contraseñas nunca se guardan ni se escriben en ningún registro. */
'use strict';
const crypto=require('crypto');
const {crearSesiones}=require('./sesiones.js');
const sha=t=>crypto.createHash('sha256').update(String(t)).digest();
const iguales=(a,b)=>crypto.timingSafeEqual(a,b);

const MIN_CLAVE_ADMIN=16;
const PERMISOS={
  jugador:new Set(['ver','jugar']),
  admin:new Set(['ver','jugar','editar','restaurar','importar','copia','historial'])
};
const puede=(rol,accion)=>!!(PERMISOS[rol]&&PERMISOS[rol].has(accion));

function crearIdentidad(op){
  op=op||{};
  const claves=(op.adminTokens||[]).filter(t=>typeof t==='string'&&t.length>=MIN_CLAVE_ADMIN);
  const admins=claves.map(sha);
  const claveSesion=op.claveSesion||crypto.randomBytes(32).toString('hex');   // sin clave propia: una al azar por arranque (las sesiones no sobreviven)
  const ses=crearSesiones({claveSesion,adminClaves:claves,ahora:op.ahora,vigenciaMs:op.vigenciaMs,archivoRevocadas:op.archivoRevocadas});
  return {
    /* identidad de INVITADO: {usuarioId, rol:'jugador'} o null si el token no sirve */
    autenticar(token){
      if(typeof token!=='string'||token.length<16||token.length>200) return null;
      return {usuarioId:sha(token).toString('hex').slice(0,12),rol:'jugador'};
    },
    /* la contraseña de administrador → una sesión nueva, o null. Compara contra todas, sin cortar al primer acierto. */
    entrar(clave){
      if(typeof clave!=='string'||clave.length<MIN_CLAVE_ADMIN||clave.length>200) return null;
      const h=sha(clave); let bien=false;
      for(const a of admins) if(iguales(a,h)) bien=true;
      return bien?ses.emitir():null;
    },
    verificarSesion:s=>ses.verificar(s),
    revocarSesion:s=>ses.revocar(s),
    hayAdmins:admins.length>0
  };
}
module.exports={crearIdentidad,puede,PERMISOS,MIN_CLAVE_ADMIN};

#!/usr/bin/env node
/* Nativa Online — arranca el servidor del mundo oficial.
   Variables de entorno:
     PORT                 puerto (por defecto 8787)
     NATIVA_DATOS         carpeta de los datos del mundo (por defecto ../datos, que git ignora). En un alojamiento: el volumen persistente
                          (también guarda las sesiones cerradas, sesiones-revocadas.json: tiene que sobrevivir a los reinicios).
     NATIVA_ADMIN_TOKEN   la contraseña de administrador (una o varias separadas por coma, mínimo 16 caracteres). NUNCA va en el repositorio.
                          Se comprueba una sola vez, en POST /entrar; el navegador nunca la guarda: recibe una sesión firmada.
     NATIVA_SESION_CLAVE  la clave con que se FIRMAN las sesiones de administrador (mínimo 32 caracteres, distinta de la contraseña). NUNCA va en el
                          repositorio. Sin ella en desarrollo se usa una al azar por arranque (las sesiones no sobreviven a un reinicio);
                          con NODE_ENV=production el servidor se niega a arrancar sin ella. Cambiarla cierra todas las sesiones.
     NATIVA_CONFIAR_PROXY 1 SÓLO si hay exactamente un proxy delante que añade al final de X-Forwarded-For la dirección real y el servidor no es alcanzable sin él
                          (ver docs/DISENO.md, «Condiciones para NATIVA_CONFIAR_PROXY»). Apagada por defecto: sin ella X-Forwarded-For se ignora.
     NATIVA_ORIGENES      los orígenes de página que pueden conectarse, separados por coma (p. ej. https://marcossantiagocenteno-png.github.io: esquema y
                          dominio, sin ruta). Vacío = cualquiera: SÓLO para desarrollo. Con NODE_ENV=production el servidor se niega a arrancar sin esto.
     NODE_ENV=production  modo publicado: exige NATIVA_ORIGENES y NATIVA_ADMIN_TOKEN, y no acepta conexiones web sin origen.
   Se apaga limpio con Ctrl+C o SIGTERM. */
'use strict';
const {iniciarServidor}=require('./red.js');
const lista=v=>(v||'').split(',').map(s=>s.trim()).filter(Boolean);
(async()=>{
  const adminTokens=lista(process.env.NATIVA_ADMIN_TOKEN), origenes=lista(process.env.NATIVA_ORIGENES);
  const produccion=process.env.NODE_ENV==='production';
  if(produccion&&!origenes.length){ console.error('No se arranca en producción sin NATIVA_ORIGENES: aceptar conexiones desde cualquier página no es una configuración válida para un servidor publicado.\nPonelo con el origen de la página, por ejemplo NATIVA_ORIGENES=https://marcossantiagocenteno-png.github.io'); process.exit(1); }
  if(produccion&&!adminTokens.length){ console.error('No se arranca en producción sin NATIVA_ADMIN_TOKEN (nadie podría administrar el mundo).'); process.exit(1); }
  const claveSesion=process.env.NATIVA_SESION_CLAVE||'';
  const cortas=adminTokens.filter(t=>t.length<16);
  if(cortas.length){ console.error('NATIVA_ADMIN_TOKEN tiene una contraseña de menos de 16 caracteres: se rechaza (un servidor público necesita una larga).'); process.exit(1); }
  if(claveSesion&&claveSesion.length<32){ console.error('NATIVA_SESION_CLAVE tiene que tener al menos 32 caracteres.'); process.exit(1); }
  if(claveSesion&&adminTokens.some(t=>claveSesion===t||claveSesion.includes(t))){ console.error('NATIVA_SESION_CLAVE no puede ser (ni contener) la contraseña de administrador: son dos secretos distintos.'); process.exit(1); }
  if(produccion&&!claveSesion){ console.error('No se arranca en producción sin NATIVA_SESION_CLAVE (la clave con que se firman las sesiones de administrador; mínimo 32 caracteres, distinta de la contraseña).'); process.exit(1); }
  if(!claveSesion) console.log('AVISO: no hay NATIVA_SESION_CLAVE; se usa una al azar y las sesiones de administrador se pierden al reiniciar (déjalo así sólo en desarrollo).');
  if(!adminTokens.length) console.log('AVISO: no hay NATIVA_ADMIN_TOKEN; nadie podrá entrar como administrador ni editar el mundo oficial.');
  if(!origenes.length) console.log('AVISO: no hay NATIVA_ORIGENES; se aceptan conexiones desde cualquier página (déjalo así sólo en desarrollo).');
  const s=await iniciarServidor({puerto:+process.env.PORT||8787,dir:process.env.NATIVA_DATOS,adminTokens,claveSesion:claveSesion||undefined,confiarProxy:process.env.NATIVA_CONFIAR_PROXY==='1',origenes:origenes.length?origenes:null,permitirSinOrigen:!produccion,log:t=>console.log(new Date().toISOString().slice(11,19)+' '+t)});
  const apagar=async()=>{ console.log('apagando…'); try{ await s.cerrar(); }catch(e){ console.log('error al cerrar: '+e.message); } process.exit(0); };
  process.on('SIGINT',apagar); process.on('SIGTERM',apagar);
})().catch(e=>{ console.error('No se pudo iniciar: '+e.message); process.exit(1); });

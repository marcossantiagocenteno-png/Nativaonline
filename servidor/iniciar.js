#!/usr/bin/env node
/* Nativa Online — arranca el servidor del mundo oficial.
   Variables de entorno:
     PORT                 puerto (por defecto 8787)
     NATIVA_DATOS         carpeta de los datos del mundo (por defecto ../datos, que git ignora). En un alojamiento: el volumen persistente.
     NATIVA_ADMIN_TOKEN   la clave de administrador (una o varias separadas por coma, mínimo 16 caracteres). NUNCA va en el repositorio.
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
  if(!adminTokens.length) console.log('AVISO: no hay NATIVA_ADMIN_TOKEN; nadie podrá editar el mundo oficial.');
  if(!origenes.length) console.log('AVISO: no hay NATIVA_ORIGENES; se aceptan conexiones desde cualquier página (déjalo así sólo en desarrollo).');
  const s=await iniciarServidor({puerto:+process.env.PORT||8787,dir:process.env.NATIVA_DATOS,adminTokens,origenes:origenes.length?origenes:null,permitirSinOrigen:!produccion,log:t=>console.log(new Date().toISOString().slice(11,19)+' '+t)});
  const apagar=async()=>{ console.log('apagando…'); try{ await s.cerrar(); }catch(e){ console.log('error al cerrar: '+e.message); } process.exit(0); };
  process.on('SIGINT',apagar); process.on('SIGTERM',apagar);
})().catch(e=>{ console.error('No se pudo iniciar: '+e.message); process.exit(1); });

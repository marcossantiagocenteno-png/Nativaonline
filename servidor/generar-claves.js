#!/usr/bin/env node
/* Nativa Online — genera dos secretos al azar para pegarlos en las variables de entorno del servidor.
   No guarda nada ni los escribe en ningún archivo: sólo los muestra por pantalla. Cada vez da valores nuevos.
     NATIVA_ADMIN_TOKEN   = la contraseña con que entras como administrador
     NATIVA_SESION_CLAVE  = la clave con que el servidor firma las sesiones (distinta de la contraseña) */
'use strict';
const c=require('crypto');
console.log('NATIVA_ADMIN_TOKEN='+c.randomBytes(18).toString('base64url'));
console.log('NATIVA_SESION_CLAVE='+c.randomBytes(48).toString('base64url'));

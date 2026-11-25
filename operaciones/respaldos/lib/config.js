/* Nativa Online — respaldos: configuración. TODO sale de variables de entorno (en la VM, de /etc/nativa-respaldo/respaldo.env, modo 600).
   Aquí no hay ni una credencial. Variables:
     NATIVA_DATOS                    carpeta de datos del servidor (sólo se lee)
     NATIVA_CODIGO                   raíz del repositorio desplegado (por defecto, el de estos scripts)
     NATIVA_RESPALDO_ESTADO          dónde se anota qué se hizo (por defecto /var/lib/nativa-respaldo)
     NATIVA_RESPALDO_TRABAJO         carpeta de trabajo temporal (por defecto /var/tmp)
     NATIVA_RESPALDO_DESTINO         «b2» o «carpeta:/ruta»
     NATIVA_RESPALDO_DESTINATARIOS   claves PÚBLICAS age de la copia real, separadas por comas (maestra y de reserva)
     NATIVA_RESPALDO_VERIFICADOR     clave PÚBLICA age del canario (opcional; sin ella no hay canario)
     B2_ID_ESCRITURA / B2_CLAVE_ESCRITURA   clave de aplicación de B2 de SÓLO escritura
     B2_CUBO_SEIS_HORAS / B2_CUBO_DIARIO / B2_CUBO_SEMANAL
     NATIVA_ALERTA_URL / NATIVA_LATIDO_URL  opcionales
     NATIVA_RESPALDO_MEMORIA_MB      tope de memoria del proceso que audita (por defecto 384)
     NATIVA_RESPALDO_RESERVA_MB      espacio que el respaldo deja SIEMPRE libre en el disco de trabajo (por defecto 512 si es el mismo disco que
                                     los datos, 64 si es otro); si no cabe 4× los datos + esa reserva, el respaldo no empieza */
'use strict';
const path=require('path');

function cargarConfig(env){
  env=env||process.env;
  const lista=s=>String(s||'').split(',').map(x=>x.trim()).filter(Boolean);
  const datos=env.NATIVA_DATOS;
  if(!datos) throw new Error('falta NATIVA_DATOS');
  return {
    datos:path.resolve(datos),
    codigo:path.resolve(env.NATIVA_CODIGO||path.join(__dirname,'..','..','..')),
    estado:path.resolve(env.NATIVA_RESPALDO_ESTADO||'/var/lib/nativa-respaldo'),
    trabajo:path.resolve(env.NATIVA_RESPALDO_TRABAJO||'/var/tmp'),
    destinatarios:lista(env.NATIVA_RESPALDO_DESTINATARIOS),
    verificador:lista(env.NATIVA_RESPALDO_VERIFICADOR),
    alertaUrl:env.NATIVA_ALERTA_URL||'', latidoUrl:env.NATIVA_LATIDO_URL||'',
    memoriaMB:+env.NATIVA_RESPALDO_MEMORIA_MB||384,
    reservaMB:env.NATIVA_RESPALDO_RESERVA_MB!==undefined&&env.NATIVA_RESPALDO_RESERVA_MB!==''&&Number.isFinite(+env.NATIVA_RESPALDO_RESERVA_MB)?+env.NATIVA_RESPALDO_RESERVA_MB:undefined
  };
}
module.exports={cargarConfig};

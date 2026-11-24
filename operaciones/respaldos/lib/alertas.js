/* Nativa Online — respaldos: alertas. Nunca lanza: una alerta que falla no debe tapar el fallo que quería contar.
   Tres salidas: el registro (journal), el archivo estado/alerta.json y, si se configura, un aviso HTTP (NATIVA_ALERTA_URL, por ejemplo un tema
   de ntfy.sh, sin verificar) y un latido al terminar bien (NATIVA_LATIDO_URL, estilo healthchecks.io, sin verificar).
   La alerta que de verdad no depende de esta máquina es la vigilancia externa (vigilar.js en GitHub Actions). */
'use strict';
const path=require('path');
const {escribirAtomico,log}=require('./comun.js');

async function alertar(cfg,mensaje,detalle){
  log('error','ALERTA: '+mensaje,{detalle});
  try{ escribirAtomico(path.join(cfg.estado,'alerta.json'),JSON.stringify({ts:new Date().toISOString(),mensaje,detalle:detalle||null},null,1)); }catch(e){}
  if(cfg.alertaUrl){
    try{ await fetch(cfg.alertaUrl,{method:'POST',body:'Nativa Online · respaldos: '+mensaje,signal:AbortSignal.timeout(10000)}); }catch(e){ log('aviso','no pude enviar el aviso HTTP: '+e.message); }
  }
}
async function latido(cfg){
  if(!cfg.latidoUrl) return;
  try{ await fetch(cfg.latidoUrl,{signal:AbortSignal.timeout(10000)}); }catch(e){ log('aviso','no pude enviar el latido: '+e.message); }
}
module.exports={alertar,latido};

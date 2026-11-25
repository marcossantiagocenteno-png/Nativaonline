/* Nativa Online — PARADA POR ARCHIVO (opcional).
   Windows no manda SIGTERM: parar un proceso desde otro es matarlo sin que cierre el almacén. Con NATIVA_ARCHIVO_PARADA=<ruta>, el servidor
   mira cada segundo si ese archivo existe; si aparece, se apaga por el mismo camino que Ctrl+C (cierra el almacén y suelta el candado).
   Sin la variable no hace nada. Un archivo que ya estaba al arrancar es un resto de una parada anterior: se borra y se sigue. */
'use strict';
const fs=require('fs');

function vigilarParada(archivo,alParar,cadaMs){
  if(!archivo) return {detener(){}};
  try{ fs.unlinkSync(archivo); }catch(e){}
  let hecho=false;
  const t=setInterval(()=>{
    if(hecho) return;
    let hay=false; try{ hay=fs.existsSync(archivo); }catch(e){}
    if(hay){ hecho=true; clearInterval(t); alParar(); }
  },cadaMs||1000);
  return {detener(){ hecho=true; clearInterval(t); }};
}
module.exports={vigilarParada};

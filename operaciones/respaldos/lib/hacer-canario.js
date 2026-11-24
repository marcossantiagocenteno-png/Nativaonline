/* Crea un mundo SINTÉTICO (30 ediciones fijas) con el código desplegado, en una carpeta nueva. Es el «canario»: pasa por el mismo camino
   que un respaldo real (copia, auditoría, paquete, cifrado), pero no contiene nada del mundo oficial. Sirve para ensayar la restauración
   de punta a punta desde fuera de Oracle con una clave que sólo puede abrir canarios.
   Uso: node hacer-canario.js <raíz del repositorio> <carpeta nueva> */
'use strict';
const path=require('path');
const [,,codigo,dir]=process.argv;
(async()=>{
  const {abrirMundoOficial}=require(path.join(path.resolve(codigo),'servidor','mundo-oficial.js'));
  const M=await abrirMundoOficial({dir:path.resolve(dir),cadaN:10});
  for(let i=0;i<30;i++) await M.aplicar({t:'suelo',x:40+(i%10),y:40+((i/10)|0),m:i%2?'d':'g'},'canario');
  await M.cerrar();
})().catch(e=>{ console.error('canario: '+e.message); process.exit(1); });

/* Escribe sin parar en un mundo oficial (como jugadores editando) hasta que aparezca el archivo de parada. Uso: node escritor.js <carpeta> <archivo-parada> [pausa-ms] */
const fs=require('fs'), path=require('path');
const {abrirMundoOficial}=require('../../servidor/mundo-oficial.js');
(async()=>{
  const [,,dir,parada,pausa]=process.argv, M=await abrirMundoOficial({dir,cadaN:25}); let i=0;
  fs.writeFileSync(parada+'.listo','1');
  while(!fs.existsSync(parada)){ await M.aplicar({t:'suelo',x:30+i%40,y:30+((i/40|0)%40),m:i%3?'d':'g'},'jugador'+(i%4)); i++; await new Promise(r=>setTimeout(r,+pausa||5)); }
  await M.cerrar(); console.log('escritas',i);
})().catch(e=>{ console.error(e); process.exit(1); });

/* Corre la auditoría en un proceso aparte (memoria acotada, con tiempo máximo) y devuelve su resultado.
   Un proceso aparte también garantiza que el código que abre la copia es sólo el indicado, sin mezclar módulos entre corridas. */
'use strict';
const fs=require('fs'), path=require('path'), os=require('os');
const {ejecutar}=require('./comun.js');

function verificarEnHijo({dir,codigo,vivo,esperado,memoriaMB,timeoutMs}){
  const salida=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'nv-verif-')),'r.json');
  const args=['--max-old-space-size='+(memoriaMB||384),path.join(__dirname,'..','verificar-copia.js'),'--dir',dir,'--codigo',codigo,'--salida',salida];
  if(vivo) args.push('--vivo',vivo);
  if(esperado&&esperado.seq!=null) args.push('--esperado-seq',String(esperado.seq));
  if(esperado&&esperado.huella) args.push('--esperado-huella',esperado.huella);
  const r=ejecutar(process.execPath,args,{tolerar:true,timeout:timeoutMs||30*60*1000});
  let res; try{ res=JSON.parse(fs.readFileSync(salida,'utf8')); }catch(e){ res={ok:false,problemas:['la auditoría no dejó resultado (¿sin memoria o tiempo agotado?): '+String(r.stderr||r.error||'').slice(0,300)]}; }
  try{ fs.rmSync(path.dirname(salida),{recursive:true,force:true}); }catch(e){}
  return res;
}
module.exports={verificarEnHijo};

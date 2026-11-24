/* Nativa Online — respaldos: la auditoría de una copia.
   Abre la copia con EL MISMO CÓDIGO del servidor (servidor/mundo-oficial.js), rehace todo el diario desde cada instantánea y compara
   todas las huellas (auditar()). Además exige que abrirla NO la modifique: si el servidor tuvo que «reparar» algo al abrir (renglón
   cortado, instantánea sin renglón), la copia no era consistente en sí misma y no vale.
   Una copia que no pasa esto NUNCA se sube como válida. */
'use strict';
const fs=require('fs'), path=require('path');
const {listarArbol,igualesArboles}=require('./comun.js');
const {huellaVivaEn}=require('./copia.js');

async function verificarCarpeta({dir,codigo,vivo,esperado}){
  const problemas=[], r={ok:false,problemas,seq:null,huella:null,versiones:null,instantaneas:null,vivoCoincide:null,ms:0};
  const t0=Date.now(), falla=m=>{ problemas.push(m); r.ms=Date.now()-t0; return r; };
  let meta; try{ meta=JSON.parse(fs.readFileSync(path.join(dir,'meta.json'),'utf8')); }catch(e){ return falla('meta.json falta o no se puede leer'); }
  const dsn=path.join(dir,'instantaneas');
  if(!fs.existsSync(dsn)||!fs.readdirSync(dsn).some(n=>/^\d{9}\.json$/.test(n))) return falla('la copia no trae ninguna instantánea');
  const antes=listarArbol(dir);
  let M;
  try{
    const {abrirMundoOficial}=require(path.join(codigo,'servidor','mundo-oficial.js'));
    M=await abrirMundoOficial({dir,semilla:meta.semilla});
  }catch(e){ return falla('la copia no abre: '+e.message); }
  try{
    const au=await M.auditar();
    if(!au.ok) problemas.push('la auditoría encontró problemas: '+au.problemas.slice(0,3).join(' | '));
    r.versiones=au.versiones; r.instantaneas=au.instantaneas;
    if(M.reparado()) problemas.push('el diario de la copia terminaba en un renglón cortado');
    r.seq=M.seq(); r.huella=M.huella();
    const ent=await M.alm.diario(0,Infinity);
    if(ent.length&&ent[0].seq!==1) problemas.push('el diario no empieza en la versión 1 (empieza en '+ent[0].seq+')');
    if(ent.length&&ent[ent.length-1].seq!==ent.length) problemas.push('el diario tiene huecos: '+ent.length+' renglones y llega a la versión '+ent[ent.length-1].seq);
    if(esperado){
      if(esperado.seq!=null&&esperado.seq!==r.seq) problemas.push('versión '+r.seq+' en vez de la '+esperado.seq+' que dice el manifiesto');
      if(esperado.huella&&esperado.huella!==r.huella) problemas.push('la huella no coincide con la del manifiesto');
    }
    if(vivo){
      const h=huellaVivaEn(vivo,r.seq);
      r.vivoCoincide=h!==null&&h===r.huella;
      if(h===null) problemas.push('no pude confirmar la huella de la versión '+r.seq+' en el mundo original');
      else if(h!==r.huella) problemas.push('la huella de la copia no es la del mundo original en la versión '+r.seq);
    }
  }catch(e){ problemas.push('error al auditar: '+e.message); }
  finally{ try{ await M.cerrar(); }catch(e){} }
  const dif=igualesArboles(antes,listarArbol(dir));
  if(dif.length) problemas.push('abrir la copia la modificó (no era consistente): '+dif.slice(0,3).join(', '));
  r.ok=problemas.length===0; r.ms=Date.now()-t0;
  return r;
}
module.exports={verificarCarpeta};

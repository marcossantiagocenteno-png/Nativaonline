/* Nativa Online — respaldos: la auditoría de una copia.
   Abre la copia con EL MISMO CÓDIGO del servidor (servidor/mundo-oficial.js), rehace todo el diario desde cada instantánea y compara
   todas las huellas (auditar()). Además exige que abrirla NO la modifique: si el servidor tuvo que «reparar» algo al abrir (renglón
   cortado, instantánea sin renglón), la copia no era consistente en sí misma y no vale.
   Una copia que no pasa esto NUNCA se sube como válida. */
'use strict';
const fs=require('fs'), path=require('path');
const {listarArbol,igualesArboles}=require('./comun.js');
const {huellaVivaEn}=require('./copia.js');

/* ¿el diario empieza en la versión 1 y llega sin huecos? Antes se pedía TODO el diario de una vez (el almacén lo clona entero con JSON:
   una segunda copia completa en memoria). Ahora se pide por tramos de PAGINA versiones: se mira lo mismo, con la misma redacción de los
   problemas, pero sólo hay un tramo clonado a la vez. El último tramo va hasta Infinity para no dejar ninguna entrada fuera. */
const PAGINA=5000;
async function revisarContinuidad(alm,ultimoSeq,pagina){
  const pag=pagina||PAGINA, problemas=[]; let total=0, primero=null, ultimo=null;
  const tope=Number.isFinite(ultimoSeq)&&ultimoSeq>0?ultimoSeq:0;
  for(let desde=0;;desde+=pag){
    const ultimaPagina=desde+pag>=tope, ent=await alm.diario(desde,ultimaPagina?Infinity:desde+pag);
    if(ent.length){ if(primero===null) primero=ent[0].seq; ultimo=ent[ent.length-1].seq; total+=ent.length; }
    if(ultimaPagina) break;
  }
  if(total&&primero!==1) problemas.push('el diario no empieza en la versión 1 (empieza en '+primero+')');
  if(total&&ultimo!==total) problemas.push('el diario tiene huecos: '+total+' renglones y llega a la versión '+ultimo);
  return problemas;
}

async function verificarCarpeta({dir,codigo,vivo,esperado}){
  const problemas=[], r={ok:false,problemas,seq:null,huella:null,versiones:null,instantaneas:null,vivoCoincide:null,personajes:null,ms:0};
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
    for(const m of await revisarContinuidad(M.alm,r.seq)) problemas.push(m);
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
  /* los personajes permanentes: se auditan con el código DE LA COPIA (servidor/personajes.js); sólo se lee, nada se modifica */
  try{
    let P=null; try{ P=require(path.join(codigo,'servidor','personajes.js')); }catch(e){ if(!/personajes\.js/.test(String(e.message))) throw e; }
    const hay=fs.existsSync(path.join(dir,'personajes'))&&fs.readdirSync(path.join(dir,'personajes')).some(n=>/\.json$/.test(n));
    if(P){ const vp=P.verificarCarpeta(dir); r.personajes=vp.cantidad; for(const m of vp.problemas.slice(0,5)) problemas.push('personajes: '+m); if(vp.problemas.length>5) problemas.push('personajes: …y '+(vp.problemas.length-5)+' más'); }
    else if(hay) problemas.push('la copia trae personajes pero el código que viaja con ella no sabe auditarlos');
  }catch(e){ problemas.push('error al auditar los personajes: '+e.message); }
  const dif=igualesArboles(antes,listarArbol(dir));
  if(dif.length) problemas.push('abrir la copia la modificó (no era consistente): '+dif.slice(0,3).join(', '));
  r.ok=problemas.length===0; r.ms=Date.now()-t0;
  return r;
}
module.exports={verificarCarpeta,revisarContinuidad};

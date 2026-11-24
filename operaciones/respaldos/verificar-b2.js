#!/usr/bin/env node
/* Nativa Online — comprueba, contra el B2 REAL, que la configuración hace exactamente lo que el diseño espera. Se corre UNA vez al configurar
   (y de nuevo tras cualquier cambio en los buckets o las claves). Hasta que no pase limpio, no se confía en el sistema de respaldos.
   Qué comprueba:
     1. Los tres buckets existen, con Object Lock en modo COMPLIANCE y retención por defecto de los días esperados (needs B2_CLAVE_ADMIN o una
        clave con readBuckets+readBucketRetentions; si no, queda como «no verificado», no como bien).
     2. Reglas de ciclo de vida: ocultar tras N días y borrar tras M días, con ocultar ≥ retención (si no, B2 intentaría borrar lo bloqueado).
     3. La clave de ESCRITURA puede subir y NO puede listar, leer ni borrar.
     4. La clave de LECTURA puede listar y leer y NO puede subir ni borrar.
     5. Un archivo subido queda con retención Compliance y NO se puede borrar ni con la clave de lectura ni con la de escritura.
   La subida de prueba va al bucket de 6 horas bajo «_verificacion/» (queda bloqueada por la retención de ese bucket: 2 días, no cuesta nada).
   Lo que NO se puede comprobar en minutos: que las reglas de ciclo de vida borren de verdad al vencer la retención. Se anota la fecha y se revisa
   a mano pasado el plazo (ver docs/RESPALDOS.md).
   Variables: NATIVA_B2_API (opcional, para pruebas) · B2_ID_ESCRITURA/B2_CLAVE_ESCRITURA · B2_ID_LECTURA/B2_CLAVE_LECTURA · B2_ID_ADMIN/B2_CLAVE_ADMIN (opcional)
              B2_CUBO_SEIS_HORAS/B2_CUBO_DIARIO/B2_CUBO_SEMANAL · RETENCION_SEIS_HORAS_DIAS (2) _DIARIO (7) _SEMANAL (28) */
'use strict';
const {B2,ErrorB2}=require('./lib/b2.js');
const {CUBOS_POR_DEFECTO}=require('./lib/destinos.js');

async function verificarB2(env){
  env=env||process.env;
  const cubos={seisHoras:env.B2_CUBO_SEIS_HORAS||CUBOS_POR_DEFECTO.seisHoras,diario:env.B2_CUBO_DIARIO||CUBOS_POR_DEFECTO.diario,semanal:env.B2_CUBO_SEMANAL||CUBOS_POR_DEFECTO.semanal};
  const dias={seisHoras:+env.RETENCION_SEIS_HORAS_DIAS||2,diario:+env.RETENCION_DIARIO_DIAS||7,semanal:+env.RETENCION_SEMANAL_DIAS||28};
  const res=[]; const R=(ok,que,detalle)=>res.push({ok,que,detalle:detalle||''});
  const NV=(que,detalle)=>res.push({ok:null,que,detalle:detalle||'no verificado'});
  const hacer=(id,clave)=>id&&clave?new B2({id,clave}):null;
  const esc=hacer(env.B2_ID_ESCRITURA,env.B2_CLAVE_ESCRITURA), lec=hacer(env.B2_ID_LECTURA,env.B2_CLAVE_LECTURA), adm=hacer(env.B2_ID_ADMIN,env.B2_CLAVE_ADMIN);
  if(!esc||!lec){ R(false,'faltan claves','hacen falta B2_ID/CLAVE_ESCRITURA y B2_ID/CLAVE_LECTURA'); return {ok:false,res}; }
  const intentar=async f=>{ try{ await f(); return null; }catch(e){ return e; } };
  const negado=e=>e instanceof ErrorB2&&(e.estado===401||e.estado===403);

  for(const [n,c] of [['escritura',esc],['lectura',lec]]){
    const e=await intentar(()=>c.autorizar()); if(e){ R(false,'la clave de '+n+' autoriza',e.message); return {ok:false,res}; }
    R(true,'la clave de '+n+' autoriza'); const cap=(c.permitido&&c.permitido.capabilities)||[];
    const nombres=(c.permitido.buckets||[]).map(b=>b.name).sort().join(',');
    R(!c.permitido.buckets||c.permitido.buckets.length===3&&nombres===Object.values(cubos).sort().join(','),'la clave de '+n+' está limitada a los tres buckets',nombres||'(sin límite de bucket)');
    // lista BLANCA: cualquier capacidad que no esté aquí es «de más» (así se detecta también un permiso que no previmos).
    // listBuckets sólo muestra nombres de buckets; no se exige, pero se tolera por si la consola de B2 lo agrega a las claves de sólo escritura.
    const permitidas=n==='escritura'?['writeFiles','listBuckets']:['listFiles','readFiles','readFileRetentions','listBuckets','readBucketRetentions'];
    const demas=cap.filter(p=>!permitidas.includes(p)); R(!demas.length,'la clave de '+n+' no tiene capacidades de más',demas.length?'tiene de más: '+demas.join(','):'capacidades: '+cap.join(','));
    if(n==='escritura') R(cap.includes('writeFiles'),'la clave de escritura puede escribir');
    else R(cap.includes('listFiles')&&cap.includes('readFiles'),'la clave de lectura puede listar y leer');
  }

  // 3 y 5 — pruebas de comportamiento
  const nombre='_verificacion/'+new Date().toISOString().replace(/[:.]/g,'')+'.txt', cuerpo=Buffer.from('prueba de verificar-b2 '+nombre);
  let sub=null; { let e=await intentar(async()=>{ sub=await esc.subir(cubos.seisHoras,nombre,cuerpo,'text/plain'); }); R(!e,'la clave de escritura SUBE',e?e.message:nombre); }
  let e;
  e=await intentar(()=>esc.listar(cubos.seisHoras,'')); R(negado(e),'la clave de escritura NO puede listar',e?e.message:'¡pudo listar!');
  if(sub){
    e=await intentar(()=>esc.descargar(cubos.seisHoras,nombre)); R(negado(e),'la clave de escritura NO puede leer',e?e.message:'¡pudo leer!');
    e=await intentar(()=>esc.borrar(nombre,sub.id)); R(negado(e),'la clave de escritura NO puede borrar',e?e.message:'¡pudo borrar!');
    let l=[]; e=await intentar(async()=>{ l=await lec.listar(cubos.seisHoras,'_verificacion/'); }); R(!e&&l.some(x=>x.nombre===nombre),'la clave de lectura LISTA lo subido',e?e.message:'');
    let b=null; e=await intentar(async()=>{ b=await lec.descargar(cubos.seisHoras,nombre); }); R(!e&&b&&b.equals(cuerpo),'la clave de lectura LEE el contenido exacto',e?e.message:'');
    e=await intentar(()=>lec.subir(cubos.seisHoras,nombre+'.2',cuerpo,'text/plain')); R(negado(e),'la clave de lectura NO puede subir',e?e.message:'¡pudo subir!');
    e=await intentar(()=>lec.borrar(nombre,sub.id)); R(negado(e),'la clave de lectura NO puede borrar',e?e.message:'¡pudo borrar!');
    let inf=null; e=await intentar(async()=>{ inf=await lec.info(sub.id); });
    if(!e&&inf&&inf.fileRetention&&inf.fileRetention.value){ const v=inf.fileRetention.value; R(v.mode==='compliance','el archivo subido queda en retención COMPLIANCE',JSON.stringify(v)); const d=(v.retainUntilTimestamp-Date.now())/864e5; R(Math.abs(d-dias.seisHoras)<0.5,'la retención aplicada es de ~'+dias.seisHoras+' días',d.toFixed(2)+' días'); }
    else NV('retención del archivo subido','la clave de lectura no ve fileRetention (¿falta readFileRetentions?): confirmar en la consola de B2');
    if(adm){ e=await intentar(()=>adm.borrar(nombre,sub.id)); R(negado(e),'ni la clave de administración puede borrar un archivo bloqueado',e?e.message:'¡pudo borrar! el Object Lock no está en Compliance'); }
    else NV('borrado con clave de administración','sin B2_CLAVE_ADMIN no se probó; en la consola de B2 intenta borrar _verificacion/… y debe negarse');
  }

  // 1 y 2 — configuración de buckets
  const lector=adm||lec; let lb=null;
  e=await intentar(async()=>{ lb=await lector.cubos(); });
  if(e||!lb){ NV('configuración de los buckets','no se pudo leer b2_list_buckets con la clave '+(adm?'de administración':'de lectura')+': '+(e?e.message:'sin datos')+'. Revisa Object Lock y ciclo de vida en la consola'); }
  else for(const [nivel,nom] of Object.entries(cubos)){
    const b=(lb.buckets||[]).find(x=>x.bucketName===nom); if(!b){ R(false,'existe el bucket '+nom); continue; } R(true,'existe el bucket '+nom);
    R(b.bucketType==='allPrivate','el bucket '+nom+' es privado',b.bucketType);
    const lock=b.fileLockConfiguration&&b.fileLockConfiguration.value;
    if(!lock) NV('Object Lock de '+nom,'no visible (falta readBucketRetentions): confirmar en la consola');
    else{
      R(lock.isFileLockEnabled===true,'Object Lock activo en '+nom);
      const d=lock.defaultRetention||{}; R(d.mode==='compliance','retención por defecto de '+nom+' en modo COMPLIANCE',d.mode||'(ninguna)');
      const dd=d.period&&d.period.unit==='days'?d.period.duration:(d.period&&d.period.unit==='years'?d.period.duration*365:null);
      R(dd===dias[nivel],'retención por defecto de '+nom+' = '+dias[nivel]+' días',String(dd));
    }
    const reglas=b.lifecycleRules||[];
    if(!reglas.length) R(false,'reglas de ciclo de vida de '+nom,'no hay ninguna: nada se limpiaría y el costo crecería sin parar');
    else{
      // TODAS las reglas deben respetar la retención: una sola regla corta (por ejemplo de un prefijo) bastaría para intentar borrar antes de tiempo
      for(const r of reglas){ const pre=r.fileNamePrefix||'(todo el bucket)';
        R(r.daysFromUploadingToHiding==null||r.daysFromUploadingToHiding>=dias[nivel],'ciclo de vida de '+nom+' ['+pre+']: ocultar tras ≥ retención ('+dias[nivel]+' d)','ocultar '+r.daysFromUploadingToHiding+' d, borrar '+r.daysFromHidingToDeleting+' d después');
        R(r.daysFromHidingToDeleting==null||r.daysFromHidingToDeleting>=1,'ciclo de vida de '+nom+' ['+pre+']: borra tras ocultar'); }
      R(reglas.some(x=>!x.fileNamePrefix&&x.daysFromUploadingToHiding!=null&&x.daysFromHidingToDeleting!=null),'ciclo de vida de '+nom+': hay una regla para todo el bucket que de verdad limpia');
    }
  }
  return {ok:res.every(x=>x.ok!==false),completo:res.every(x=>x.ok!==null),res,archivoDePrueba:nombre};
}
module.exports={verificarB2};
if(require.main===module) verificarB2(process.env).then(r=>{
  for(const x of r.res) console.log((x.ok===true?'  bien      ':x.ok===false?'  FALLA     ':'  sin ver   ')+x.que+(x.detalle?'  — '+x.detalle:''));
  console.log(r.ok?(r.completo?'\nTODO COMO SE ESPERABA.':'\nNada falló, pero hay puntos «sin ver»: confírmalos a mano antes de confiar.'):'\nHAY FALLAS: no se confía en el sistema hasta corregirlas.');
  process.exit(r.ok?0:1);
},e=>{ console.error('verificar-b2: '+e.message); process.exit(1); });

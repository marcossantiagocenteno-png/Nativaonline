/* Nativa Online — EL MUNDO OFICIAL: la única fuente de verdad de lo que se construye con el Modo Dios.
   Junta tres cosas: el mundo cargado sin pantalla (servidor/cargar-mundo.js, el mismo código que el cliente), el almacén de datos
   (servidor/almacen.js, fuera del código) y las reglas de qué se acepta.
   · Un mundo nuevo nace de la generación base actual (la semilla), SIN ediciones: versión 0.
   · Toda edición pasa por aplicar(): se valida, se aplica entera o no se aplica, se anota en el diario con su inversa y la huella del
     mundo resultante. Un lote que falla a la mitad se deshace completo.
   · Cada versión (número de secuencia) se puede reconstruir y restaurar. Restaurar NO borra la historia: crea una versión nueva.
   · Al abrir, el servidor rehace el diario desde la última instantánea y comprueba la huella de cada paso. Si no coincide
     (por ejemplo, porque una actualización del código cambió lo que hace una operación) NO arranca: nada se sobrescribe en silencio.
   · copiaCompleta() es el archivo de respaldo que se baja; importarCopia() lo vuelve a poner con comprobaciones.
   Pruebas: pruebas/almacen.js */
'use strict';
const {cargarMundo}=require('./cargar-mundo.js');
const {abrirAlmacen,DIR_POR_DEFECTO}=require('./almacen.js');
const copia=o=>JSON.parse(JSON.stringify(o));
const FORMATO_COPIA='nativa-copia-1';

async function abrirMundoOficial(op){
  op=op||{};
  const cadaN=op.cadaN||100, reloj=op.reloj||Date.now;
  const NV=cargarMundo({semilla:op.semilla});
  const alm=await abrirAlmacen({dir:op.dir||DIR_POR_DEFECTO()});
  try{
    await alm.iniciar({semilla:NV.CONFIG.seed});
    const huellaDe=N=>N.huella(N.mundo.exportar());
    let huella='', seq=0;

    /* ---- abrir: génesis o rehacer el diario ---- */
    const ultima=await alm.instantaneaHasta(Infinity);
    if(!ultima){
      huella=huellaDe(NV);
      await alm.guardarInstantanea({seq:0,ts:reloj(),motivo:'inicio: mundo base generado desde la semilla, sin ediciones',semilla:NV.CONFIG.seed,huella,mundo:NV.mundo.exportar()});
    } else {
      NV.mundo.cargar(ultima.mundo); NV.olvidarObjetos();
      huella=huellaDe(NV);
      if(huella!==ultima.huella) throw new Error('la instantánea '+ultima.seq+' no da la huella que guardó: el código actual no la reproduce igual (o el archivo se alteró). No se abre.');
      seq=ultima.seq;
      for(const e of await alm.diario(ultima.seq,Infinity)){
        if(e.t!=='op') throw new Error('el cambio '+e.seq+' ('+e.t+') debería tener su instantánea y no la tiene');
        NV.mundo.editar(copia(e.op)); seq=e.seq; huella=huellaDe(NV);
        if(huella!==e.h) throw new Error('al rehacer el cambio '+e.seq+' el mundo no queda como cuando se guardó: una actualización del código cambió el resultado. No se abre; hay que revisarlo (el diario y las instantáneas están intactos).');
      }
      NV.olvidarObjetos();
      /* se cortó entre guardar una versión nueva y anotarla: se anota ahora, sin perder nada */
      let dj=await alm.ultimaSeqDiario();
      while(dj<ultima.seq){ dj++; await alm.registrar({seq:dj,ts:reloj(),autor:'sistema',t:'recuperado',motivo:'versión '+dj+' encontrada sin su renglón en el diario',h:ultima.huella}); }
    }
    seq=await alm.ultimaSeq();

    /* una sola cosa a la vez: mientras una edición espera al disco, otra no puede tomar su mismo número de versión */
    let cola=Promise.resolve();
    const enSerie=f=>{ const p=cola.then(f); cola=p.catch(()=>{}); return p; };

    /* ---- aplicar una edición ---- */
    function ejecutar(o,invs){
      if(o&&o.t==='lote'){ if(!Array.isArray(o.ops)) throw new Error('lote sin operaciones'); for(const s of o.ops) ejecutar(s,invs); return; }
      const inv=NV.mundo.editar(copia(o)); if(inv) invs.push(inv);
    }
    const deshacer=invs=>{ for(let i=invs.length-1;i>=0;i--) NV.mundo.editar(copia(invs[i])); NV.olvidarObjetos(); };
    const aplicar=(o,autor)=>enSerie(()=>aplicar_(o,autor));
    async function aplicar_(o,autor){
      if(!o||typeof o.t!=='string') throw new Error('operación inválida');
      const invs=[];
      try{ ejecutar(o,invs); }catch(e){ try{ deshacer(invs); }catch(x){} throw e; }      // o entra entera o no entra
      if(!invs.length) return {seq,huella,sinCambio:true};
      NV.olvidarObjetos();
      const h=huellaDe(NV), inv=invs.length===1?invs[0]:{t:'lote',ops:invs.slice().reverse()}, sig=seq+1;
      try{ await alm.registrar({seq:sig,ts:reloj(),autor:autor||'desconocido',t:'op',op:copia(o),inv:copia(inv),h}); }
      catch(e){ deshacer(invs); throw e; }
      seq=sig; huella=h;
      if(seq%cadaN===0) await alm.guardarInstantanea({seq,ts:reloj(),motivo:'cada '+cadaN+' cambios',semilla:NV.CONFIG.seed,huella,mundo:NV.mundo.exportar()});
      return {seq,huella,inv:copia(inv)};
    }

    /* ---- reconstruir cualquier versión en un mundo aparte ---- */
    async function reconstruir(n){
      if(!Number.isInteger(n)||n<0||n>seq) throw new Error('no existe la versión '+n+' (hay de la 0 a la '+seq+')');
      const s=await alm.instantaneaHasta(n), W=cargarMundo({semilla:op.semilla});
      W.mundo.cargar(s.mundo); let h=W.huella(W.mundo.exportar());
      if(h!==s.huella) throw new Error('la instantánea '+s.seq+' no da su huella');
      for(const e of await alm.diario(s.seq,n)){
        if(e.t!=='op') throw new Error('el cambio '+e.seq+' ('+e.t+') no tiene instantánea');
        W.mundo.editar(copia(e.op)); h=W.huella(W.mundo.exportar());
        if(h!==e.h) throw new Error('al rehacer el cambio '+e.seq+' la huella no coincide');
      }
      return {mundo:W.mundo.exportar(),huella:h,seq:n};
    }

    /* poner un mundo entero (restaurar o importar): versión nueva con su instantánea y su renglón */
    async function reemplazar(mundo,hRes,t,motivo,extra,autor){
      NV.mundo.cargar(copia(mundo)); NV.olvidarObjetos();
      const h=huellaDe(NV); if(hRes&&h!==hRes) throw new Error('el mundo cargado no da la huella esperada');
      const sig=seq+1;
      await alm.guardarInstantanea({seq:sig,ts:reloj(),motivo,semilla:NV.CONFIG.seed,huella:h,mundo:NV.mundo.exportar()});
      await alm.registrar(Object.assign({seq:sig,ts:reloj(),autor:autor||'desconocido',t,motivo,h},extra||{}));
      seq=sig; huella=h; return {seq,huella,completo:true};
    }
    const restaurar=(n,autor)=>enSerie(()=>restaurar_(n,autor));
    async function restaurar_(n,autor){
      const v=await reconstruir(n); await alm.respaldar('antes-de-restaurar-'+n);
      try{ return await reemplazar(v.mundo,v.huella,'restaurar','restaurar la versión '+n,{desde:n},autor); }
      catch(e){ const a=await reconstruir(seq).catch(()=>null); if(a){ NV.mundo.cargar(a.mundo); NV.olvidarObjetos(); huella=huellaDe(NV); } throw e; }
    }

    /* ---- copia completa ---- */
    const copiaCompleta=()=>enSerie(copiaCompleta_);
    async function copiaCompleta_(){
      const historial=await alm.diario(0,Infinity), mundo=NV.mundo.exportar();
      return {formato:FORMATO_COPIA,creada:reloj(),semilla:NV.CONFIG.seed,seq,huella:NV.huella(mundo),mundo,historial};
    }
    const importarCopia=(c,autor)=>enSerie(()=>importarCopia_(c,autor));
    async function importarCopia_(c,autor){
      if(!c||c.formato!==FORMATO_COPIA) throw new Error('no es una copia de seguridad de Nativa Online');
      if(c.semilla!==NV.CONFIG.seed) throw new Error('la copia es del mundo de la semilla "'+c.semilla+'" y este servidor usa "'+NV.CONFIG.seed+'"');
      if(NV.huella(c.mundo)!==c.huella) throw new Error('la copia está alterada o incompleta: su contenido no da su huella. No se importa.');
      const P=cargarMundo({semilla:op.semilla}); P.mundo.cargar(copia(c.mundo));          // lo valida el mismo código que valida las ediciones
      const rec=P.mundo.exportar(), cambia=P.huella(rec)!==c.huella;
      await alm.respaldar('antes-de-importar');
      const r=await reemplazar(rec,null,'importar','importar una copia de seguridad (versión '+c.seq+')',{origen:{seq:c.seq,huella:c.huella}},autor);
      return Object.assign(r,{migrada:cambia});
    }

    /* ---- auditoría completa: se rehace todo el diario desde cada instantánea y se comparan todas las huellas ---- */
    async function auditar(){
      const problemas=[], v=await alm.verificar(); problemas.push(...v.problemas);
      const snaps=await alm.instantaneas();
      for(let i=0;i<snaps.length;i++){
        const s=await alm.instantaneaHasta(snaps[i].seq), W=cargarMundo({semilla:op.semilla}), hasta=i+1<snaps.length?snaps[i+1].seq:seq;
        try{ W.mundo.cargar(s.mundo); if(W.huella(W.mundo.exportar())!==s.huella) problemas.push('la instantánea '+s.seq+' no da su huella'); }catch(e){ problemas.push('la instantánea '+s.seq+': '+e.message); continue; }
        for(const e of await alm.diario(s.seq,hasta)){
          if(e.t!=='op'){ if(e.seq!==hasta) problemas.push('el cambio '+e.seq+' ('+e.t+') no tiene instantánea'); continue; }
          try{ W.mundo.editar(copia(e.op)); }catch(x){ problemas.push('el cambio '+e.seq+' ya no se puede aplicar: '+x.message); break; }
          if(W.huella(W.mundo.exportar())!==e.h){ problemas.push('el cambio '+e.seq+' ya no da la misma huella'); break; }
        }
      }
      return {ok:!problemas.length,problemas,versiones:seq,instantaneas:snaps.length};
    }

    /* consultas para la red: se hacen DENTRO de la cola, así nunca se lee el mundo a mitad de una edición */
    const estado=()=>enSerie(async()=>({seq,huella,semilla:NV.CONFIG.seed,mundo:NV.mundo.exportar()}));
    async function huellaEn_(n){ if(n===seq) return huella; if(n<0||n>seq) return null;
      const e=(await alm.diario(n-1,n))[0]; if(e) return e.h; const s=await alm.instantaneaHasta(n); return s&&s.seq===n?s.huella:null; }
    /* lo que le falta a quien tiene el mundo en la versión `desde` con la huella `hDesde`: las operaciones, si todas son ediciones comunes
       y su huella coincide; si no (restauraciones, importaciones, huella distinta), null: hay que mandarle el mundo entero */
    const operacionesDesde=(desde,hDesde)=>enSerie(async()=>{
      if(!Number.isInteger(desde)||desde<0||desde>seq) return null;
      if(hDesde!==undefined&&(await huellaEn_(desde))!==hDesde) return null;
      const es=await alm.diario(desde,seq); if(es.some(e=>e.t!=='op')) return null;
      return {seq,huella,ops:es.map(e=>({seq:e.seq,op:e.op,autor:e.autor,h:e.h}))};
    });
    /* restaurar o importar y devolver, en el mismo turno de la cola, el mundo entero que quedó: así nadie recibe una edición posterior antes que el mundo nuevo */
    const conEstado=f=>enSerie(async()=>{ const r=await f(); return {r,estado:{seq,huella,semilla:NV.CONFIG.seed,mundo:NV.mundo.exportar()}}; });
    const restaurarConEstado=(n,a)=>conEstado(()=>restaurar_(n,a)), importarConEstado=(c,a)=>conEstado(()=>importarCopia_(c,a));
    return {NV,alm,estado,operacionesDesde,restaurarConEstado,importarConEstado,aplicar,reconstruir,restaurar,copiaCompleta,importarCopia,auditar,
      seq:()=>seq, huella:()=>huella, reparado:()=>alm.reparado, historial:o=>alm.historial(o), respaldar:m=>alm.respaldar(m),
      instantanea:motivo=>enSerie(async()=>{ await alm.guardarInstantanea({seq,ts:reloj(),motivo:motivo||'a pedido',semilla:NV.CONFIG.seed,huella,mundo:NV.mundo.exportar()}); return seq; }),
      cerrar:()=>alm.cerrar()};
  }catch(e){ await alm.cerrar(); throw e; }
}
module.exports={abrirMundoOficial,FORMATO_COPIA};

#!/usr/bin/env node
/* Nativa Online — respaldo automático del mundo oficial. Lo dispara el temporizador de systemd (cada 6 h); se puede correr a mano.
     node respaldar.js --auto            hace lo que toque ahora: copia de 6 h; además la diaria y la semanal si aún no se hicieron en su periodo
     node respaldar.js --nivel seis-horas,diario,semanal,canario [--forzar] [--ahora 2026-11-24T12:00:00Z]

   Garantías (probadas en pruebas/respaldos.js):
     · sólo LEE la carpeta de datos: no abre el almacén, no toma su candado, no toca al servidor ni a los jugadores conectados;
     · una copia que no pasa la auditoría (código del servidor, todas las huellas, huella del mundo original) NO se sube nunca;
     · el respaldo está cifrado con claves públicas: esta máquina no puede descifrar lo que sube;
     · no lleva contraseñas, tokens ni claves de sesión (lista de nombres permitidos + escaneo);
     · repetirlo no duplica ni daña: cada nivel anota su periodo (estado.json) y un periodo hecho no se rehace sin --forzar;
     · si falla o si no se puede subir, queda alerta (registro, estado/alerta.json y aviso HTTP opcional) y sale con código 1.
   Código de salida: 0 bien (o nada que hacer) · 1 falló. */
'use strict';
const fs=require('fs'), path=require('path');
const {cargarConfig}=require('./lib/config.js');
const {destinoDesdeEntorno}=require('./lib/destinos.js');
const {construirPaquete}=require('./lib/paquete.js');
const {alertar,latido}=require('./lib/alertas.js');
const {escribirAtomico,tomarCandado,log,dia,seisHoras,semanaISO,ejecutar}=require('./lib/comun.js');

const PREFIJO={seisHoras:'seis-horas',diario:'diario',semanal:'semanal',canario:'canario'};
const NOMBRE_NIVEL={'seis-horas':'seisHoras',seisHoras:'seisHoras',diario:'diario',semanal:'semanal',canario:'canario'};

const leerEstado=cfg=>{ try{ return JSON.parse(fs.readFileSync(path.join(cfg.estado,'estado.json'),'utf8')); }catch(e){ return {slots:{},historial:[]}; } };
const guardarEstado=(cfg,e)=>escribirAtomico(path.join(cfg.estado,'estado.json'),JSON.stringify(e,null,1));
const slotDe=(n,ahora)=>n==='seisHoras'?seisHoras(ahora):n==='diario'?dia(ahora):n==='semanal'?semanaISO(ahora):dia(ahora);

function barrerRestos(cfg){          // restos de una corrida que murió a medias (no se tocan los de la última hora)
  try{ for(const n of fs.readdirSync(cfg.trabajo)) if(/^respaldo-/.test(n)){ const p=path.join(cfg.trabajo,n); if(Date.now()-fs.statSync(p).mtimeMs>3*3600e3) fs.rmSync(p,{recursive:true,force:true}); } }catch(e){}
}

async function subirNivel(destino,nivelDestino,prefijo,paquete,etiqueta,slot){
  const nombre=prefijo+'/'+paquete.nombre;
  const lado=Object.assign({},paquete.lado,{nivel:etiqueta,slot,archivo:nombre+'.tar.gz.age'});
  await destino.subir(nivelDestino,nombre+'.tar.gz.age',paquete.age);       // primero el paquete…
  await destino.subirTexto(nivelDestino,nombre+'.json',JSON.stringify(lado,null,1));   // …y su ficha al final: la ficha es la marca de «listo»
  return nombre;
}

async function principal(argv){
  const val=k=>{ const i=argv.indexOf(k); return i>=0?argv[i+1]:undefined; };
  const cfg=cargarConfig(), ahora=val('--ahora')?new Date(val('--ahora')):new Date(), forzar=argv.includes('--forzar');
  if(isNaN(ahora)) throw new Error('--ahora no es una fecha');
  const cand=tomarCandado(path.join(cfg.estado,'respaldar.lock'));
  if(!cand){ log('info','ya hay un respaldo en curso: este se omite'); return 0; }
  const t0=Date.now();
  try{
    barrerRestos(cfg);
    const estado=leerEstado(cfg);
    let pedidos=(val('--nivel')?val('--nivel').split(',').map(s=>NOMBRE_NIVEL[s.trim()]).filter(Boolean):['seisHoras','diario','semanal','canario']);
    if(val('--nivel')&&!pedidos.length) throw new Error('--nivel no reconocido');
    if(!pedidos.includes('canario')||!cfg.verificador.length) { if(pedidos.includes('canario')&&!cfg.verificador.length) log('aviso','sin NATIVA_RESPALDO_VERIFICADOR: no hay canario'); pedidos=pedidos.filter(n=>n!=='canario'); }
    const pendientes=pedidos.filter(n=>forzar||estado.slots[n]!==slotDe(n,ahora));
    if(!pendientes.length){ log('info','nada que hacer: todos los niveles de este periodo ya están hechos'); return 0; }
    const destino=destinoDesdeEntorno(process.env,'escritura');
    if(!cfg.destinatarios.length) throw new Error('falta NATIVA_RESPALDO_DESTINATARIOS (claves públicas age)');
    const reales=pendientes.filter(n=>n!=='canario'), hecho=[]; let seq=null, huella=null;
    if(reales.length){
      const p=await construirPaquete({origen:cfg.datos,vivo:cfg.datos,codigo:cfg.codigo,trabajo:cfg.trabajo,destinatarios:cfg.destinatarios,etiqueta:'real',
        respaldos:reales.includes('diario')||reales.includes('semanal'),ahora,memoriaMB:cfg.memoriaMB});
      try{
        for(const n of reales){
          await subirNivel(destino,n,PREFIJO[n],p,PREFIJO[n],slotDe(n,ahora));
          estado.slots[n]=slotDe(n,ahora); guardarEstado(cfg,estado); hecho.push(PREFIJO[n]);     // se anota cada nivel apenas sube
        }
        seq=p.seq; huella=p.huella;
      }finally{ p.limpiar(); }
    }
    if(pendientes.includes('canario')){
      const work=fs.mkdtempSync(path.join(cfg.trabajo,'respaldo-canario-')), dir=path.join(work,'mundo');
      try{
        ejecutar(process.execPath,[path.join(__dirname,'lib','hacer-canario.js'),cfg.codigo,dir]);
        const p=await construirPaquete({origen:dir,vivo:dir,codigo:cfg.codigo,trabajo:cfg.trabajo,destinatarios:cfg.verificador,etiqueta:'canario',respaldos:false,ahora,memoriaMB:cfg.memoriaMB});
        try{ await subirNivel(destino,'seisHoras','canario',p,'canario',slotDe('canario',ahora)); estado.slots.canario=slotDe('canario',ahora); guardarEstado(cfg,estado); hecho.push('canario'); }
        finally{ p.limpiar(); }
      }finally{ fs.rmSync(work,{recursive:true,force:true}); }
    }
    estado.historial=(estado.historial||[]).concat([{ts:new Date().toISOString(),niveles:hecho,seq,huella,ms:Date.now()-t0}]).slice(-30);
    guardarEstado(cfg,estado);
    escribirAtomico(path.join(cfg.estado,'ultimo.json'),JSON.stringify({ok:true,ts:new Date().toISOString(),niveles:hecho,seq,huella,ms:Date.now()-t0},null,1));
    try{ fs.rmSync(path.join(cfg.estado,'alerta.json'),{force:true}); }catch(e){}
    log('info','respaldo listo',{niveles:hecho,seq,huella});
    await latido(cfg);
    return 0;
  }catch(e){
    try{ escribirAtomico(path.join(cfg.estado,'ultimo.json'),JSON.stringify({ok:false,ts:new Date().toISOString(),motivo:e.message},null,1)); }catch(x){}
    await alertar(cfg,'el respaldo falló: '+e.message.slice(0,300));
    return 1;
  }finally{ cand.liberar(); }
}
if(require.main===module) principal(process.argv.slice(2)).then(c=>process.exit(c),e=>{ console.error('respaldar: '+e.message); process.exit(1); });
module.exports={principal};

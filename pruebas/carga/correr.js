#!/usr/bin/env node
/* Arnés de carga — corre UN escenario completo y escribe un informe JSON.
     1. prepara un mundo con --ediciones ediciones (se guarda en caché en la carpeta temporal y se copia en cada corrida: el servidor nunca toca la caché);
     2. arranca el servidor real (servidor/iniciar.js, sin modificarlo), opcionalmente bajo una cuota de CPU (--cuota, % de un núcleo, cgroup v1);
     3. entra el enjambre de --jugadores jugadores simulados (jugadores.js) y, opcionalmente, un administrador que edita --ediciones-por-min veces;
     4. tras --calentamiento segundos empieza a medir; si pide --respaldo-a S, lanza respaldar.js (con nice) S segundos después de empezar a medir;
     5. mide hasta cumplir --duracion y, si hay respaldo, hasta que termine + --despues segundos (tope --tope);
     6. imprime el informe (JSON) por la salida estándar y un resumen legible por la de error. --salida <archivo> también lo guarda.
   Todo lo que está bajo «medido» es medición de ESTA máquina en ESTA corrida; «entorno» dice cuál es. Nada de aquí es una garantía para otra.
   Uso: node pruebas/carga/correr.js [--jugadores 25] [--ediciones 3000] [--duracion 40] [--calentamiento 8] [--perfil mixto|agrupado|disperso]
            [--sesion-media 240] [--ediciones-por-min 6] [--respaldo-a 10] [--nice 19] [--cuota 12.5] [--semilla 1] [--cadaN 100] [--nivel seis-horas] [--respaldar <ruta de otro respaldar.js: sirve para comparar versiones; NATIVA_CODIGO apunta siempre a este repositorio>] [--salida f.json] [--conservar] */
'use strict';
const fs=require('fs'), os=require('os'), path=require('path'), net=require('net'), cp=require('child_process');
const {percentiles,media,maximo}=require('./util.js'), {generarMundo}=require('./mundo.js'), {Enjambre}=require('./jugadores.js'), {Monitor}=require('./monitor.js');
const RAIZ=path.resolve(__dirname,'..','..'), dormir=ms=>new Promise(r=>setTimeout(r,ms));
const ADMIN_TOKEN='clave-de-prueba-de-carga-0001', SESION_CLAVE='clave-de-sesion-de-prueba-de-carga-000000001';

function opciones(argv){
  const v=(k,def)=>{ const i=argv.indexOf('--'+k); return i>=0?argv[i+1]:def; };
  const o={jugadores:+v('jugadores',25),ediciones:+v('ediciones',3000),duracion:+v('duracion',40),calentamiento:+v('calentamiento',8),perfil:v('perfil','mixto'),sesionMedia:+v('sesion-media',240),
    edicionesPorMin:+v('ediciones-por-min',6),respaldoA:v('respaldo-a')===undefined?null:+v('respaldo-a'),nice:+v('nice',19),cuota:v('cuota')===undefined?null:+v('cuota'),semilla:+v('semilla',1),cadaN:+v('cadaN',100),
    despues:+v('despues',10),tope:+v('tope',900),salida:v('salida'),conservar:argv.includes('--conservar'),nivel:v('nivel','seis-horas'),respaldar:v('respaldar')||path.join(RAIZ,'operaciones','respaldos','respaldar.js')};
  for(const k of ['jugadores','ediciones','duracion','calentamiento','sesionMedia','edicionesPorMin','nice','semilla','cadaN','despues','tope']) if(!Number.isFinite(o[k])||o[k]<0) throw new Error('--'+k+' no es un número válido');
  if(argv.includes('--ayuda')||argv.includes('-h')){ console.error(fs.readFileSync(__filename,'utf8').split('*/')[0].replace(/^[^]*?\/\* /,'')); process.exit(0); }
  return o;
}
const puertoLibre=()=>new Promise(r=>{ const s=net.createServer(); s.listen(0,'127.0.0.1',()=>{ const p=s.address().port; s.close(()=>r(p)); }); });
function entorno(o,cgroup){
  let modelo='?'; try{ modelo=/model name\s*:\s*(.+)/.exec(fs.readFileSync('/proc/cpuinfo','utf8'))[1]; }catch(e){}
  return {cpu:modelo,nucleos:os.cpus().length,ramMB:Math.round(os.totalmem()/1048576),node:process.version,so:os.platform()+' '+os.release(),cuotaCpuPct:o.cuota,cuotaActiva:!!cgroup,
    nota:'Medido en esta máquina, que NO es una máquina de Oracle. Los jugadores simulados corren en la misma máquina que el servidor y le restan CPU.'};
}
async function mundoEnCache(o){
  const cache=path.join(os.tmpdir(),'nv-carga-mundos','e'+o.ediciones+'-c'+o.cadaN+'-s'+o.semilla), listo=path.join(cache,'.listo');
  if(!fs.existsSync(listo)){ fs.rmSync(cache,{recursive:true,force:true}); fs.mkdirSync(cache,{recursive:true}); const mundo=path.join(cache,'mundo'); fs.mkdirSync(mundo);
    console.error('generando el mundo de '+o.ediciones+' ediciones (se guarda en caché)…'); const g=await generarMundo({dir:mundo,ediciones:o.ediciones,cadaN:o.cadaN,semilla:o.semilla}); fs.writeFileSync(listo,JSON.stringify(g)); }
  return {dir:path.join(cache,'mundo'),info:JSON.parse(fs.readFileSync(listo,'utf8'))};
}
const tamanoDir=d=>{ let t=0; (function r(x){ for(const e of fs.readdirSync(x,{withFileTypes:true})){ const q=path.join(x,e.name); e.isDirectory()?r(q):t+=fs.statSync(q).size; } })(d); return t; };
function crearCgroup(pct){
  const base='/sys/fs/cgroup/cpu', dir=path.join(base,'nv-carga-'+process.pid);
  try{ fs.mkdirSync(dir); fs.writeFileSync(dir+'/cpu.cfs_period_us','100000'); fs.writeFileSync(dir+'/cpu.cfs_quota_us',String(Math.round(pct*1000))); return dir; }
  catch(e){ throw new Error('no puedo crear la cuota de CPU en '+dir+' ('+e.code+'): --cuota necesita cgroup v1 con permiso de escritura; sin él, no se emula (no se finge)'); }
}
const fase=(t,ini,fin)=>ini===null?'solo':(t<ini?'antes':(t<=fin?'respaldo':'despues'));

async function correr(o){
  const t00=Date.now(), trabajo=fs.mkdtempSync(path.join(os.tmpdir(),'nv-carga-corrida-')), limpiar=[];
  let srv=null, enj=null, mon=null, cgroup=null, rb=null;
  try{
    const cache=await mundoEnCache(o), vivo=path.join(trabajo,'mundo'); fs.cpSync(cache.dir,vivo,{recursive:true});
    const edadAntes=tamanoDir(vivo);
    if(o.cuota!==null) cgroup=crearCgroup(o.cuota);
    const puerto=await puertoLibre(), env=Object.assign({},process.env,{NATIVA_DATOS:vivo,PORT:String(puerto),NATIVA_HOST:'127.0.0.1',NATIVA_ADMIN_TOKEN:ADMIN_TOKEN,NATIVA_SESION_CLAVE:SESION_CLAVE});
    const logSrv=fs.openSync(path.join(trabajo,'servidor.log'),'w');
    const cmd=(cgroup?'echo $$ > '+cgroup+'/cgroup.procs; ':'')+'exec node '+JSON.stringify(path.join(RAIZ,'servidor','iniciar.js'));
    srv=cp.spawn('sh',['-c',cmd],{env,stdio:['ignore',logSrv,logSrv]});
    for(let i=0;i<100&&!/escuchando/.test(fs.readFileSync(path.join(trabajo,'servidor.log'),'utf8'));i++){ if(srv.exitCode!==null) break; await dormir(100); }
    if(!/escuchando/.test(fs.readFileSync(path.join(trabajo,'servidor.log'),'utf8'))) throw new Error('el servidor no arrancó: '+fs.readFileSync(path.join(trabajo,'servidor.log'),'utf8').slice(-300));
    let sesion=null;
    if(o.edicionesPorMin>0){ const r=await fetch('http://127.0.0.1:'+puerto+'/entrar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clave:ADMIN_TOKEN})}); if(!r.ok) throw new Error('no pude entrar como administrador: '+r.status); sesion=(await r.json()).sesion; }
    mon=new Monitor({pidServidor:srv.pid,cada:500,cgroup}); mon.iniciar();
    enj=new Enjambre({puerto,jugadores:o.jugadores,semilla:o.semilla,perfil:o.perfil,sesionMediaS:o.sesionMedia,editor:sesion?{sesion,porMin:o.edicionesPorMin}:null});
    await enj.iniciar(); await dormir(o.calentamiento*1000);
    /* ——— empieza la medición ——— */
    const tIni=Date.now(); Object.keys(enj.m).forEach(k=>{ enj.m[k]=enj.m[k].filter(()=>false); }); const c0=JSON.parse(JSON.stringify(enj.c)); let tRespIni=null, tRespFin=null, respaldo=null;
    const lanzarRespaldo=()=>{
      const estado=path.join(trabajo,'est'), work=path.join(trabajo,'trab'), dest=path.join(trabajo,'dest'); for(const d of [estado,work,dest]) fs.mkdirSync(d);
      const k=path.join(trabajo,'k.txt'), g=cp.spawnSync('age-keygen',['-o',k],{encoding:'utf8'}); if(g.status!==0) throw new Error('hace falta age-keygen para probar respaldos');
      const pub=(g.stderr+g.stdout).match(/age1[a-z0-9]+/)[0];
      const e=Object.assign({},process.env,{NATIVA_CODIGO:RAIZ,NATIVA_DATOS:vivo,NATIVA_RESPALDO_ESTADO:estado,NATIVA_RESPALDO_TRABAJO:work,NATIVA_RESPALDO_DESTINO:'carpeta:'+dest,NATIVA_RESPALDO_DESTINATARIOS:pub});
      const sh=(cgroup?'echo $$ > '+cgroup+'/cgroup.procs; ':'')+'exec nice -n '+o.nice+' node '+JSON.stringify(path.resolve(o.respaldar))+' --nivel '+o.nivel;
      const salida=fs.openSync(path.join(trabajo,'respaldo.log'),'w'); tRespIni=Date.now();
      rb=cp.spawn('sh',['-c',sh],{env:e,stdio:['ignore',salida,salida]}); mon.marcarRespaldo(rb.pid);
      respaldo=new Promise(r=>rb.on('exit',code=>{ tRespFin=Date.now(); mon.soltarRespaldo(); r({code,dest}); }));
    };
    let finRespaldo=null;
    if(o.respaldoA!==null){ await dormir(o.respaldoA*1000); lanzarRespaldo(); respaldo.then(r=>{ finRespaldo=r; }); }
    const minimo=tIni+o.duracion*1000, tope=tIni+o.tope*1000;
    while(Date.now()<tope){ await dormir(250); const t=Date.now(); if(t<minimo) continue; if(o.respaldoA===null) break; if(finRespaldo&&t>=tRespFin+o.despues*1000) break; }
    const tFin=Date.now(), respaldoTerminado=o.respaldoA===null?null:!!finRespaldo;
    /* ——— informe ——— */
    mon.detener(); const serie=mon.serie.filter(p=>p.t>=tIni&&p.srvCpuPct!==null), F=t=>fase(t,tRespIni,tRespFin===null?tFin:tRespFin), fases=o.respaldoA===null?['solo']:['antes','respaldo','despues'];
    const porFase=ph=>{ const s=serie.filter(p=>F(p.t)===ph), val=k=>enj.m[k].filter(x=>F(x[0])===ph).map(x=>x[1]);
      return {segundos:s.length?+((s[s.length-1].t-s[0].t)/1000+.5).toFixed(1):0,servidor:{cpuPctMedia:media(s.map(p=>p.srvCpuPct)),cpuPctMax:maximo(s.map(p=>p.srvCpuPct)),rssMBMax:maximo(s.map(p=>p.srvRssMB))},
        respaldo:ph==='respaldo'?{cpuPctMedia:media(s.map(p=>p.respCpuPct)),rssMBMax:maximo(s.map(p=>p.respRssMB))}:undefined,
        latenciaMov_ms:percentiles(val('lat')),rttPing_ms:percentiles(val('rtt')),entradaMundoCompleto_ms:percentiles(val('entrada')),ackEdicion_ms:percentiles(val('ack'))}; };
    const dc=k=>enj.c[k]-c0[k], errores=Object.assign({},enj.c.errores);
    const res={config:o,entorno:entorno(o,cgroup),
      mundo:{ediciones:cache.info.seq,bytesEnDisco:edadAntes,generacionSeg:cache.info.segundos},
      medido:{duracionSeg:+((tFin-tIni)/1000).toFixed(1),fases:Object.fromEntries(fases.map(f=>[f,porFase(f)])),
        jugadores:{pedidos:o.jugadores,conectadosAlFinal:enj.c.conectados,entradas:dc('entradas'),rotaciones:dc('rotaciones'),caidosInesperados:dc('caidos'),rechazosDePosicion:dc('rechazos'),erroresDelServidor:errores,pasosEnviados:dc('pasos'),edicionesDelAdmin:dc('ediciones')},
        trafico:{mensajesPorSeg:+(dc('recibidos')/((tFin-tIni)/1000)).toFixed(0),KBporSeg:+(dc('bytes')/1024/((tFin-tIni)/1000)).toFixed(0)}}};
    if(cgroup){ const u=serie[serie.length-1], p=serie[0]; if(u&&p&&u.frenos!==undefined) res.medido.cuota={frenosEnLaMedicion:u.frenos-p.frenos,msFrenado:u.frenoMs-p.frenoMs}; }
    if(o.respaldoA!==null){
      const r=finRespaldo, log=fs.readFileSync(path.join(trabajo,'respaldo.log'),'utf8'), d=path.join(trabajo,'dest'); let archivos=[];
      (function rec(x){ if(!fs.existsSync(x)) return; for(const e of fs.readdirSync(x,{withFileTypes:true})){ const q=path.join(x,e.name); e.isDirectory()?rec(q):archivos.push({nombre:path.relative(d,q),bytes:fs.statSync(q).size}); } })(d);
      res.medido.respaldo={terminoDentroDeLaMedicion:respaldoTerminado,codigoSalida:r?r.code:null,segundos:tRespFin?+((tRespFin-tRespIni)/1000).toFixed(1):null,inicioAlSegundo:+((tRespIni-tIni)/1000).toFixed(1),picoRamSumadaMB:+mon.picoRespaldo.rssSumado.toFixed(0),picoRamPorProcesoMB:Object.fromEntries(Object.entries(mon.picoRespaldo.porProceso).map(([k,v])=>[k,Math.round(v)])),
        cpuPctMediaDuranteElRespaldo:(res.medido.fases.respaldo&&res.medido.fases.respaldo.respaldo)?res.medido.fases.respaldo.respaldo.cpuPctMedia:null,archivosEnDestino:archivos,registro:log.trim().split('\n').slice(-3).map(l=>l.slice(0,200))};
    }
    res.medido.servidorAlFinal={log:fs.readFileSync(path.join(trabajo,'servidor.log'),'utf8').split('\n').filter(l=>/error|ERROR|excep/i.test(l)).slice(0,5)};
    res.duracionTotalCorridaSeg=+((Date.now()-t00)/1000).toFixed(1);
    return res;
  } finally{
    if(enj) enj.detener(); if(mon) mon.detener();
    for(const p of [rb,srv]) if(p&&p.exitCode===null){ try{ for(const x of require('./util.js').descendientes(p.pid)) try{ process.kill(x,'SIGKILL'); }catch(e){} }catch(e){} }
    await dormir(300); if(cgroup){ try{ fs.rmdirSync(cgroup); }catch(e){} }
    if(o.conservar) console.error('carpeta de trabajo conservada: '+trabajo); else fs.rmSync(trabajo,{recursive:true,force:true});
  }
}
function resumen(r){
  const L=[], f=r.medido.fases; L.push('— '+r.config.jugadores+' jugadores · mundo de '+r.mundo.ediciones+' ediciones ('+(r.mundo.bytesEnDisco/1048576).toFixed(1)+' MB) · '+r.medido.duracionSeg+' s medidos'+(r.entorno.cuotaActiva?' · cuota '+r.config.cuota+' % de un núcleo':''));
  for(const [n,x] of Object.entries(f)) L.push('  ['+n+'] '+x.segundos+' s · CPU servidor media '+x.servidor.cpuPctMedia+' % (máx '+x.servidor.cpuPctMax+') · RAM servidor máx '+x.servidor.rssMBMax+' MB · mov p50/p95/p99/máx '+[x.latenciaMov_ms.p50,x.latenciaMov_ms.p95,x.latenciaMov_ms.p99,x.latenciaMov_ms.max].join('/')+' ms (n='+x.latenciaMov_ms.n+') · ping p95 '+x.rttPing_ms.p95+' ms'+(x.ackEdicion_ms.n?' · edición del admin p95 '+x.ackEdicion_ms.p95+' ms':''));
  const j=r.medido.jugadores; L.push('  jugadores: conectados al final '+j.conectadosAlFinal+'/'+j.pedidos+' · caídos inesperados '+j.caidosInesperados+' · rechazos de posición '+j.rechazosDePosicion+' · errores del servidor '+JSON.stringify(j.erroresDelServidor)+' · entradas '+j.entradas);
  if(r.medido.cuota) L.push('  cuota: '+r.medido.cuota.frenosEnLaMedicion+' frenos, '+r.medido.cuota.msFrenado+' ms frenado');
  const b=r.medido.respaldo; if(b) L.push('  respaldo: salida '+b.codigoSalida+' en '+b.segundos+' s (arrancó al s '+b.inicioAlSegundo+') · RAM pico sumada '+b.picoRamSumadaMB+' MB '+JSON.stringify(b.picoRamPorProcesoMB)+' · archivos en destino '+b.archivosEnDestino.length+(b.terminoDentroDeLaMedicion?'':' · NO terminó dentro del tope'));
  return L.join('\n');
}
module.exports={correr,opciones,resumen};
if(require.main===module){
  (async()=>{ const o=opciones(process.argv.slice(2)); const r=await correr(o); console.error(resumen(r)); const j=JSON.stringify(r,null,1); if(o.salida) fs.writeFileSync(o.salida,j+'\n'); console.log(j); process.exit(0); })().catch(e=>{ console.error('correr: '+e.message); process.exit(1); });
}

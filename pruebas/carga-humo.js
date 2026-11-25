// Prueba de humo del arnés de carga (pruebas/carga/): no mide rendimiento, comprueba que el arnés FUNCIONA y que es reproducible.
// Mundo chico, pocos jugadores, pocos segundos. Los números de rendimiento salen de correr.js a propósito, no de aquí.
const fs=require('fs'), os=require('os'), path=require('path');
const C=path.join(__dirname,'carga');
const {generarMundo}=require(path.join(C,'mundo.js')), {prng,percentiles}=require(path.join(C,'util.js')), {correr,opciones}=require(path.join(C,'correr.js'));
let bien=0,mal=0; const ok=(c,t)=>{ if(c) bien++; else { mal++; console.log('MAL:',t); } };
const tmp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'nv-humo-carga-')); const creadas=[];
(async()=>{
  const t0=Date.now();
  // reproducibilidad del generador y del azar
  const a=tmp(), b=tmp(), c=tmp(); creadas.push(a,b,c);
  const ra=await generarMundo({dir:a,ediciones:120,cadaN:50,semilla:7}), rb=await generarMundo({dir:b,ediciones:120,cadaN:50,semilla:7}), rc=await generarMundo({dir:c,ediciones:120,cadaN:50,semilla:8});
  ok(ra.seq===120&&ra.huella===rb.huella,'la misma semilla y las mismas ediciones dan el mismo mundo (misma huella)');
  ok(ra.huella!==rc.huella,'otra semilla da otro mundo');
  const sinReloj=d=>fs.readFileSync(path.join(d,'diario.ndjson'),'utf8').trim().split('\n').map(l=>{ const e=JSON.parse(l); delete e.ts; delete e.c; return JSON.stringify(e); }).join('\n');
  ok(sinReloj(a)===sinReloj(b)&&sinReloj(a)!==sinReloj(c),'y el mismo diario, renglón por renglón, operaciones y huellas incluidas (sólo se ignora la hora del reloj, «ts», y la suma del renglón, que la incluye)');
  const p1=prng(5), p2=prng(5), s1=Array.from({length:50},p1), s2=Array.from({length:50},p2);
  ok(JSON.stringify(s1)===JSON.stringify(s2)&&s1.every(x=>x>=0&&x<1),'el generador de azar es reproducible y queda en [0,1)');
  const pc=percentiles([5,1,3,2,4,10,9,8,7,6]); ok(pc.n===10&&pc.p50===6&&pc.max===10,'percentiles: n, mediana y máximo');
  // argumentos
  let e=null; try{ opciones(['--jugadores','abc']); }catch(x){ e=x; } ok(e&&/--jugadores/.test(e.message),'un argumento numérico inválido se rechaza con su nombre');
  e=null; try{ opciones(['--jugadores','-3']); }catch(x){ e=x; } ok(e!==null,'un número negativo se rechaza');
  // corrida real, mínima, con respaldo en paralelo
  const r=await correr(opciones(['--jugadores','6','--ediciones','150','--cadaN','50','--duracion','8','--calentamiento','3','--respaldo-a','3','--despues','2','--ediciones-por-min','30','--sesion-media','2','--semilla','3']));
  const m=r.medido, f=m.fases;
  ok(r.config.jugadores===6&&r.mundo.ediciones===150&&r.entorno.nucleos>=1&&/NO es una máquina de Oracle/.test(r.entorno.nota),'el informe trae configuración, tamaño del mundo y entorno (con la advertencia de que no es Oracle)');
  ok(['antes','respaldo','despues'].every(k=>f[k]),'con respaldo, el informe separa las fases antes / respaldo / después');
  const lat=Object.values(f).reduce((n,x)=>n+x.latenciaMov_ms.n,0); ok(lat>20,'los jugadores caminan de verdad: hay '+lat+' muestras de latencia de movimiento');
  ok(m.jugadores.pasosEnviados>50&&m.jugadores.caidosInesperados===0&&Object.keys(m.jugadores.erroresDelServidor).length===0,'sin caídas ni errores del servidor ('+m.jugadores.pasosEnviados+' pasos enviados)');
  ok(m.jugadores.edicionesDelAdmin>=1&&Object.values(f).reduce((n,x)=>n+x.ackEdicion_ms.n,0)>=1,'el administrador simulado edita y recibe confirmaciones');
  ok(m.jugadores.rotaciones>=1&&m.jugadores.entradas>=1,'las sesiones rotan: salen y entran jugadores nuevos con el mundo completo ('+m.jugadores.rotaciones+' salidas)');
  ok(m.respaldo&&m.respaldo.terminoDentroDeLaMedicion&&m.respaldo.codigoSalida===0&&m.respaldo.archivosEnDestino.length>=2&&m.respaldo.picoRamSumadaMB>0,'el respaldo concurrente termina con código 0, deja paquete y ficha en el destino y se midió su RAM ('+m.respaldo.picoRamSumadaMB+' MB)');
  ok(f.antes.servidor.rssMBMax>0&&f.respaldo.respaldo&&f.respaldo.respaldo.rssMBMax>0,'el monitor midió RAM del servidor y del respaldo por separado');
  ok(!fs.existsSync(path.join(os.tmpdir(),'nv-carga-corrida-'+process.pid)),'la corrida no deja nada suyo en el disco (sólo la caché de mundos)');
  for(const d of creadas) fs.rmSync(d,{recursive:true,force:true});
  console.log('carga-humo: '+bien+' bien, '+mal+' mal ('+Math.round((Date.now()-t0)/1000)+' s)'); process.exit(mal?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });

// Etapa 8: NATIVA_HOST. Detrás de un proxy en la misma máquina el servidor tiene que escuchar sólo en 127.0.0.1 (condición 3 de NATIVA_CONFIAR_PROXY).
const fs=require('fs'), cp=require('child_process'), os=require('os'), path=require('path'), net=require('net'), http=require('http');
const raiz=path.resolve(__dirname,'..'); let bien=0,mal=0; const ok=(c,t)=>{ if(c) bien++; else { mal++; console.log('MAL:',t); } };
const pedir=(host,puerto)=>new Promise(r=>{ const q=http.get({host,port:puerto,path:'/salud',timeout:2000},res=>{ let t=''; res.on('data',d=>t+=d); res.on('end',()=>r({ok:res.statusCode===200,cuerpo:t})); }); q.on('error',e=>r({ok:false,error:e.code})); q.on('timeout',()=>{ q.destroy(); r({ok:false,error:'TIMEOUT'}); }); });
const libre=()=>new Promise(r=>{ const s=net.createServer(); s.listen(0,'127.0.0.1',()=>{ const p=s.address().port; s.close(()=>r(p)); }); });
const ip4=Object.values(os.networkInterfaces()).flat().filter(i=>i&&i.family==='IPv4'&&!i.internal).map(i=>i.address)[0];
const arrancar=async(env,esperar)=>{ const puerto=await libre(), dir=fs.mkdtempSync(path.join(os.tmpdir(),'nativa-host-'));
  const h=cp.spawn(process.execPath,[path.join(raiz,'servidor/iniciar.js')],{env:Object.assign({PATH:process.env.PATH,NATIVA_DATOS:dir,PORT:String(puerto)},env)}); let salida=''; h.stdout.on('data',d=>salida+=d); h.stderr.on('data',d=>salida+=d);
  for(let i=0;i<100&&!/escuchando en/.test(salida);i++) await new Promise(r=>setTimeout(r,50)); if(!/escuchando en/.test(salida)&&env.NATIVA_HOST!=='::1') console.log('  (el servidor no llegó a escuchar) env:',JSON.stringify(env),'salida:',salida.slice(-250)); return {h,puerto,salida:()=>salida,parar:()=>new Promise(r=>{ if(h.exitCode!==null||h.signalCode!==null) return r(); h.on('close',r); h.kill('SIGTERM'); })}; };
(async()=>{ process.on("exit",c=>{ if(!global.__fin) console.log("la prueba terminó sin llegar al final (pendiente de una espera), código",c); });
  /* valores no válidos: se rechazan al arrancar */
  for(const malo of ['evil.example.com','127.0.0.1;rm','0.0.0.0/0','999.1.1.1']){ const r=cp.spawnSync(process.execPath,[path.join(raiz,'servidor/iniciar.js')],{env:{PATH:process.env.PATH,NATIVA_DATOS:fs.mkdtempSync(path.join(os.tmpdir(),'nativa-host-')),PORT:'0',NATIVA_HOST:malo},encoding:'utf8',timeout:15000});
    ok(r.status===1&&/NATIVA_HOST/.test(r.stderr),'NATIVA_HOST «'+malo+'» se rechaza al arrancar'); }
  /* 127.0.0.1: responde por loopback y NO por la dirección de red de la máquina */
  let s=await arrancar({NATIVA_HOST:'127.0.0.1'});
  ok(/escuchando en 127\.0\.0\.1:/.test(s.salida()),'con NATIVA_HOST=127.0.0.1 lo dice al arrancar');
  ok((await pedir('127.0.0.1',s.puerto)).ok,'con NATIVA_HOST=127.0.0.1 /salud responde por 127.0.0.1');
  if(ip4){ const x=await pedir(ip4,s.puerto); ok(!x.ok&&x.error==='ECONNREFUSED','con NATIVA_HOST=127.0.0.1 NO se alcanza por '+ip4+' ('+(x.error||'respondió')+')'); } else console.log('  (sin interfaz de red externa: se omite la prueba de acceso por la dirección de la máquina)');
  await s.parar();
  /* por defecto: todas las interfaces (comportamiento de siempre) */
  s=await arrancar({}); ok(/escuchando en 0\.0\.0\.0:/.test(s.salida()),'sin NATIVA_HOST escucha en todas las interfaces, como antes');
  if(ip4) ok((await pedir(ip4,s.puerto)).ok,'sin NATIVA_HOST sí se alcanza por la dirección de la máquina ('+ip4+')'); await s.parar();
  /* aviso: confiar en el proxy sin cerrar el servidor */
  s=await arrancar({NATIVA_CONFIAR_PROXY:'1'}); ok(/AVISO: NATIVA_CONFIAR_PROXY=1 sin NATIVA_HOST=127\.0\.0\.1/.test(s.salida()),'NATIVA_CONFIAR_PROXY=1 sin NATIVA_HOST avisa de la condición 3'); await s.parar();
  s=await arrancar({NATIVA_CONFIAR_PROXY:'1',NATIVA_HOST:'127.0.0.1'}); ok(!/AVISO: NATIVA_CONFIAR_PROXY/.test(s.salida())&&/confía en el proxy/.test(s.salida()),'con NATIVA_HOST=127.0.0.1 y proxy no hay aviso'); await s.parar();
  s=await arrancar({NATIVA_HOST:'localhost'}); ok((await pedir('127.0.0.1',s.puerto)).ok||(await pedir('::1',s.puerto)).ok,'NATIVA_HOST=localhost se acepta'); await s.parar();
  s=await arrancar({NATIVA_HOST:'::1'}); ok(/escuchando en ::1:/.test(s.salida())||/No se pudo iniciar/.test(s.salida()),'NATIVA_HOST=::1 se acepta (o falla sólo si el equipo no tiene IPv6)'); await s.parar().catch(()=>{});
  console.log('host: '+bien+' bien, '+mal+' mal'); global.__fin=1; process.exit(mal?1:0);
})();

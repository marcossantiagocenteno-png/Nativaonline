// Servidor en Windows: herramienta operaciones/windows/nativa.js, parada por archivo y lectura del tar de Windows.
// NO arranca el servidor real: el supervisor se prueba con un «servidor» de mentira que usa el mismo servidor/parada.js.
// Lo que NO se puede probar desde Linux: schtasks, powercfg, taskkill, tar.exe ni age.exe reales. Eso se comprueba en el PC (docs/WINDOWS.md).
const fs=require('fs'), cp=require('child_process'), os=require('os'), path=require('path');
const raiz=path.resolve(__dirname,'..'); let bien=0,mal=0; const ok=(c,t)=>{ if(c) bien++; else { mal++; console.log('MAL:',t); } };
const dormir=ms=>new Promise(r=>setTimeout(r,ms));
const NATIVA=path.join(raiz,'operaciones/windows/nativa.js');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'nativa-win-')); process.on('exit',()=>{ try{ fs.rmSync(tmp,{recursive:true,force:true}); }catch(e){} });
const corrAsync=(args,env)=>new Promise(res=>{ const h=cp.spawn(process.execPath,[NATIVA].concat(args),{env:Object.assign({PATH:process.env.PATH},env)}); let o='',e=''; h.stdout.on('data',d=>o+=d); h.stderr.on('data',d=>e+=d); h.on('exit',c=>res({status:c,stdout:o,stderr:e})); });
const correr=(args,env)=>cp.spawnSync(process.execPath,[NATIVA].concat(args),{encoding:'utf8',env:Object.assign({PATH:process.env.PATH},env)});

(async()=>{
  process.on('exit',c=>{ if(!global.__fin) console.log('la prueba terminó sin llegar al final, código',c); });
  const N=require(NATIVA);

  /* ---- configuración ---- */
  const e=N.leerEnv('# comentario\r\nA=1\r\n  B = dos palabras \r\n# C=3\r\nD="entre comillas"\r\n');
  ok(e.A==='1'&&e.B==='dos palabras'&&e.D==='entre comillas'&&!('C' in e),'leerEnv: CRLF, espacios, comillas y comentarios');
  ok(N.problemasCfg(null).length===1,'sin juego.env: un problema');
  const T='x'.repeat(16), K='y'.repeat(32);
  ok(N.problemasCfg({NATIVA_ADMIN_TOKEN:T,NATIVA_SESION_CLAVE:K}).length===0,'configuración válida: sin problemas');
  ok(N.problemasCfg({NATIVA_ADMIN_TOKEN:'corta',NATIVA_SESION_CLAVE:K}).some(p=>/16/.test(p)),'contraseña corta se rechaza');
  ok(N.problemasCfg({NATIVA_ADMIN_TOKEN:T,NATIVA_SESION_CLAVE:'corta'}).some(p=>/32/.test(p)),'clave de firma corta se rechaza');
  ok(N.problemasCfg({NATIVA_ADMIN_TOKEN:K,NATIVA_SESION_CLAVE:K}).some(p=>/ni contener/.test(p)),'clave de firma igual a la contraseña se rechaza');
  process.env.NATIVA_CONFIAR_PROXY='1'; process.env.NATIVA_HOST='0.0.0.0'; process.env.NODE_ENV='development';
  const env=N.entornoServidor({NATIVA_ADMIN_TOKEN:T,NATIVA_SESION_CLAVE:K});
  ok(env.NODE_ENV==='production'&&env.NATIVA_HOST==='127.0.0.1','el entorno del servidor siempre es producción y sólo loopback, aunque el entorno heredado diga otra cosa');
  ok(env.NATIVA_CONFIAR_PROXY===undefined,'NATIVA_CONFIAR_PROXY no se hereda: sólo si juego.env lo pide');
  ok(N.entornoServidor({NATIVA_ADMIN_TOKEN:T,NATIVA_SESION_CLAVE:K,NATIVA_CONFIAR_PROXY:'1'}).NATIVA_CONFIAR_PROXY==='1','NATIVA_CONFIAR_PROXY=1 en juego.env sí pasa');
  ok(env.NATIVA_ORIGENES==='https://marcossantiagocenteno-png.github.io'&&env.PORT==='8787','origen oficial y puerto 8787 por defecto');
  delete process.env.NATIVA_CONFIAR_PROXY; delete process.env.NATIVA_HOST; delete process.env.NODE_ENV;

  /* ---- claves: crea, no muestra, no pisa ---- */
  const priv=path.join(tmp,'privado'), E1={NATIVA_PRIVADO:priv};
  let r=correr(['claves'],E1); const txt=fs.readFileSync(path.join(priv,'juego.env'),'utf8'), cfg=N.leerEnv(txt);
  ok(r.status===0&&cfg.NATIVA_ADMIN_TOKEN&&cfg.NATIVA_SESION_CLAVE,'«claves» crea privado\\juego.env');
  ok(!r.stdout.includes(cfg.NATIVA_ADMIN_TOKEN)&&!r.stdout.includes(cfg.NATIVA_SESION_CLAVE)&&!r.stderr.includes(cfg.NATIVA_ADMIN_TOKEN),'«claves» no imprime ningún secreto');
  ok(N.problemasCfg(cfg).length===0&&cfg.NATIVA_ADMIN_TOKEN.length>=32&&cfg.NATIVA_SESION_CLAVE.length===64,'las claves generadas cumplen los mínimos del servidor');
  r=correr(['claves'],E1); ok(r.status===0&&/no se toca/.test(r.stdout)&&fs.readFileSync(path.join(priv,'juego.env'),'utf8')===txt,'«claves» no pisa un juego.env existente');
  ok(!/NATIVA_CONFIAR_PROXY=1/.test(txt.split('\n').filter(l=>!/^\s*#/.test(l)).join('\n')),'juego.env nuevo no activa NATIVA_CONFIAR_PROXY');
  ok(/^privado\/$/m.test(fs.readFileSync(path.join(raiz,'.gitignore'),'utf8')),'privado/ está en .gitignore');

  /* ---- tareas / energía: por defecto sólo muestran ---- */
  r=correr(['tareas'],E1); ok(r.status===0&&/schtasks \/Create \/TN Nativa Online - Servidor/.test(r.stdout)&&/\/SC HOURLY \/MO 6/.test(r.stdout)&&/Sólo se mostró/.test(r.stdout),'«tareas» sin --aplicar sólo muestra (servidor al iniciar sesión, respaldo cada 6 h)');
  r=correr(['energia'],E1); ok(r.status===0&&/powercfg/.test(r.stdout)&&/Sólo se mostró/.test(r.stdout),'«energia» sin --aplicar sólo muestra');
  r=correr(['respaldar'],E1); ok(r.status===1&&/NATIVA_RESPALDO_CARPETA/.test(r.stderr),'«respaldar» sin carpeta de destino se niega y dice qué falta');
  r=correr(['verificar'],E1); ok(/Node\.js ≥ 20/.test(r.stdout)&&/privado\\juego\.env válido/.test(r.stdout),'«verificar» informa sin instalar nada');

  /* ---- parada por archivo (servidor/parada.js) ---- */
  const {vigilarParada}=require(path.join(raiz,'servidor/parada.js'));
  const flag=path.join(tmp,'flag'); let veces=0;
  fs.writeFileSync(flag,'resto'); const v=vigilarParada(flag,()=>veces++,50);
  ok(!fs.existsSync(flag),'un archivo de parada que ya existía al arrancar se borra');
  await dormir(200); ok(veces===0,'sin archivo nuevo, no se apaga');
  fs.writeFileSync(flag,'x'); await dormir(300); ok(veces===1,'con el archivo, se apaga una sola vez'); await dormir(200); ok(veces===1,'y no se repite'); v.detener();
  vigilarParada('',()=>veces++,50); await dormir(150); ok(veces===1,'sin NATIVA_ARCHIVO_PARADA no hace nada');

  /* ---- supervisor con un servidor de mentira: se cae una vez, se vuelve a encender, y se apaga limpio con «parar» ---- */
  const falso=path.join(tmp,'falso.js'), marcas=path.join(tmp,'arranques.txt');
  fs.writeFileSync(falso,`const fs=require('fs'),path=require('path');
fs.appendFileSync(${JSON.stringify(marcas)},JSON.stringify({host:process.env.NATIVA_HOST,prod:process.env.NODE_ENV,proxy:process.env.NATIVA_CONFIAR_PROXY||null,tieneToken:(process.env.NATIVA_ADMIN_TOKEN||'').length,archivo:process.env.NATIVA_ARCHIVO_PARADA})+'\\n');
const n=fs.readFileSync(${JSON.stringify(marcas)},'utf8').trim().split('\\n').length;
if(n===1){ setTimeout(()=>process.exit(1),100); }                       // la primera vez se cae
else { require(${JSON.stringify(path.join(raiz,'servidor/parada.js'))}).vigilarParada(process.env.NATIVA_ARCHIVO_PARADA,()=>process.exit(0),100); setInterval(()=>{},1000); }
`);
  const E2={NATIVA_PRIVADO:priv,NATIVA_SERVIDOR_JS:falso}, PID2=path.join(priv,'supervisor.pid'), PARADA2=path.join(priv,'parar.ahora');
  const sup=cp.spawn(process.execPath,[NATIVA,'supervisar'],{env:Object.assign({PATH:process.env.PATH},E2),stdio:'ignore'}); let salioSup=null; sup.on('exit',c=>salioSup=c);
  for(let i=0;i<120&&!(fs.existsSync(marcas)&&fs.readFileSync(marcas,'utf8').trim().split('\n').length>=2);i++) await dormir(100);
  const ar=(fs.existsSync(marcas)?fs.readFileSync(marcas,'utf8').trim().split('\n'):[]).map(l=>JSON.parse(l));
  ok(ar.length===2,'el supervisor vuelve a encender el servidor tras una caída ('+ar.length+' arranques)');
  ok(ar.every(a=>a.host==='127.0.0.1'&&a.prod==='production'&&a.proxy===null&&a.tieneToken>=16&&a.archivo===PARADA2),'cada arranque: loopback, producción, sin proxy de confianza, con contraseña y con archivo de parada');
  ok(fs.existsSync(PID2)&&+fs.readFileSync(PID2,'utf8')===sup.pid,'el supervisor anota su pid');
  r=await corrAsync(['estado'],E2); ok(/Supervisor: encendido/.test(r.stdout),'«estado» ve el supervisor encendido');
  r=await corrAsync(['parar'],E2); await dormir(300);
  ok(r.status===0&&/Apagado limpio/.test(r.stdout),'«parar» apaga limpio: '+r.stdout.trim());
  ok(salioSup===0&&!fs.existsSync(PID2)&&!fs.existsSync(PARADA2),'el supervisor sale con 0 y no deja pid ni archivo de parada');
  ok(fs.readFileSync(marcas,'utf8').trim().split('\n').length===2,'tras la parada no se vuelve a encender');
  const log=fs.readFileSync(path.join(priv,'registros','servidor.log'),'utf8');
  ok((log.match(/arranque \d/g)||[]).length===2&&/terminó con código 1/.test(log)&&/terminó con código 0/.test(log),'el registro anota arranques y códigos de salida');
  ok(!log.includes(cfg.NATIVA_ADMIN_TOKEN)&&!log.includes(cfg.NATIVA_SESION_CLAVE),'el registro no contiene secretos');
  r=await corrAsync(['parar'],E2); ok(/No estaba encendido/.test(r.stdout),'«parar» con el servidor apagado no falla');
  /* sin configuración válida no enciende */
  r=correr(['iniciar'],{NATIVA_PRIVADO:path.join(tmp,'vacio')}); ok(r.status===1&&/No se puede encender/.test(r.stderr),'«iniciar» sin juego.env se niega');

  /* ---- tar de Windows (bsdtar) frente a GNU: el mismo nombre ---- */
  const {nombreDeLinea}=require(path.join(raiz,'operaciones/respaldos/lib/paquete.js'));
  const gnu=['-rw-r--r-- 0/0 1234 2026-11-25 08:41 datos/diario.ndjson','drwxr-xr-x 0/0 0 2026-11-25 08:41 datos/instantaneas/','-rw-r--r-- 0/0 12 2026-11-25 08:41 codigo/src/a b.js'];
  const bsd=['-rw-rw-rw-  0 0      0          1234 Nov 25 08:41 datos/diario.ndjson','drwxrwxrwx  0 0      0             0 Nov 25 08:41 datos/instantaneas/','-rw-rw-rw-  0 0      0            12 Nov 25  2026 codigo/src/a b.js','lrwxrwxrwx  0 0      0             0 Nov 25 08:41 datos/x -> /etc/passwd'];
  ok(nombreDeLinea(gnu[0])==='datos/diario.ndjson'&&nombreDeLinea(gnu[1])==='datos/instantaneas/'&&nombreDeLinea(gnu[2])==='codigo/src/a b.js','nombreDeLinea: formato GNU, como antes (incluye nombres con espacios)');
  ok(nombreDeLinea(bsd[0])==='datos/diario.ndjson'&&nombreDeLinea(bsd[1])==='datos/instantaneas/'&&nombreDeLinea(bsd[2])==='codigo/src/a b.js','nombreDeLinea: formato bsdtar (Windows)');
  ok(nombreDeLinea(bsd[3])==='datos/x'&&bsd[3][0]==='l','nombreDeLinea: un enlace sigue distinguiéndose (primera letra «l») y se le quita el destino');
  ok(nombreDeLinea('-rw-r--r-- 0/0 5 2026-11-25 08:41 datos/Nov 25 08:41 raro')==='datos/Nov 25 08:41 raro','un nombre que parece fecha no confunde al lector GNU');

  /* ---- revisarContenido con la salida REAL del tar.exe de Windows: fecha en español («nov. 25 10:23») y líneas terminadas en \r\n ---- */
  {
    const {revisarContenido}=require(path.join(raiz,'operaciones/respaldos/lib/paquete.js'));
    const falso=(detallado,simple)=>{ const d=fs.mkdtempSync(path.join(os.tmpdir(),'nv-tarfalso-')); fs.writeFileSync(path.join(d,'tar'),'#!/bin/sh\nfor a in "$@"; do case "$a" in -tvzf) cat \''+path.join(d,'det')+'\'; exit 0;; -tzf) cat \''+path.join(d,'sim')+'\'; exit 0;; esac; done\nexit 1\n',{mode:0o755});
      fs.writeFileSync(path.join(d,'det'),detallado.join('\r\n')+'\r\n'); fs.writeFileSync(path.join(d,'sim'),simple.join('\r\n')+'\r\n'); return d; };
    const conTar=(d,f)=>{ const antes=process.env.PATH; process.env.PATH=d+path.delimiter+antes; try{ return f(); } finally{ process.env.PATH=antes; } };
    const bien1=['manifiesto.json','datos/','datos/personajes/','datos/personajes/0123456789ab.json','codigo/src/a b.js'];
    const det=['-rw-rw-rw-  0 0      0          1234 nov. 25 10:23 manifiesto.json','drwxrwxrwx  0 0      0             0 nov. 25 10:23 datos/','drwxrwxrwx  0 0      0             0 nov. 25 10:23 datos/personajes/',
      '-rw-rw-rw-  0 0      0           300 nov. 25 10:23 datos/personajes/0123456789ab.json','-rw-rw-rw-  0 0      0            12 nov. 25 10:23 codigo/src/a b.js'];
    let d=falso(det,bien1); ok(conTar(d,()=>revisarContenido('x.tgz')).length===0,'tar de Windows en español con \\r\\n: el contenido correcto se acepta');
    const det2=det.slice(); det2[4]='lrwxrwxrwx  0 0      0             0 nov. 25 10:23 codigo/src/a b.js -> /etc/passwd';
    d=falso(det2,bien1); ok(conTar(d,()=>revisarContenido('x.tgz')).length===1,'un enlace simbólico se rechaza con ese mismo formato');
    d=falso(det.concat(det[4]),bien1.concat('../fuera.js')); ok(conTar(d,()=>revisarContenido('x.tgz')).some(m=>/peligrosa/.test(m)),'una ruta con «..» se rechaza');
    d=falso(det.concat(det[4]),bien1.concat('otro/archivo.txt')); ok(conTar(d,()=>revisarContenido('x.tgz')).some(m=>/fuera de lugar/.test(m)),'una entrada fuera de manifiesto, datos y codigo se rechaza');
    d=falso(det,bien1.concat('sobra')); ok(conTar(d,()=>revisarContenido('x.tgz')).some(m=>/no es consistente/.test(m)),'si los dos listados no coinciden en número, se rechaza (ante la duda, no)');
  }

  console.log('windows: '+bien+' bien, '+mal+' mal'); global.__fin=1; process.exit(mal?1:0);
})();

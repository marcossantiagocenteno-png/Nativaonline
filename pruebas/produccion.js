// Seguridad de la etapa 4: la clave de administrador no está en ningún archivo del juego, y el servidor publicado exige la lista de orígenes.
const fs=require('fs'), cp=require('child_process'), os=require('os'), path=require('path');
let bien=0,mal=0; const ok=(c,t)=>{ if(c) bien++; else { mal++; console.log('MAL:',t); } };
const raiz=path.resolve(__dirname,'..');
const archivos=cp.execSync('git ls-files',{cwd:raiz}).toString().split('\n').filter(Boolean);

/* nada de lo que se publica (juego, documentos, servidor) puede traer una clave: ni la variable con un valor, ni un Bearer escrito a mano */
const publicos=archivos.filter(f=>!/^pruebas\//.test(f)&&/\.(js|html|css|md|json|sh)$/.test(f)&&!/package-lock/.test(f));
const asignaciones=publicos.filter(f=>/NATIVA_ADMIN_TOKEN\s*(=['"]?|=\s*['"]|:\s*['"])[A-Za-z0-9]/.test(fs.readFileSync(path.join(raiz,f),'utf8')));
ok(!asignaciones.length,'ningún archivo publicado asigna un valor a NATIVA_ADMIN_TOKEN: '+asignaciones.join(', '));
const bearer=publicos.filter(f=>/Bearer\s+['"][A-Za-z0-9]/.test(fs.readFileSync(path.join(raiz,f),'utf8')));
ok(!bearer.length,'ningún archivo publicado trae una clave escrita en un Bearer: '+bearer.join(', '));
const cliente=archivos.filter(f=>/^src\//.test(f)||f==='index.html');
/* el navegador sólo puede nombrar la variable para decirle al administrador dónde configurarla (mensaje «sin clave»), nunca darle un valor */
ok(!cliente.some(f=>fs.readFileSync(path.join(raiz,f),'utf8').split('\n').some(l=>/NATIVA_ADMIN_TOKEN/.test(l)&&!/msg\(['"]/.test(l))),'el código que baja el navegador (src/, index.html) nombra la variable de la clave sólo en el mensaje de «sin clave»');
const of=fs.readFileSync(path.join(raiz,'src/juego/oficial.js'),'utf8');
ok(!/[?&]token=|[?&]clave=|location\.search[^;]*clave/.test(of),'el cliente no manda ni lee la clave por el enlace');
ok(!archivos.some(f=>/^datos\//.test(f)||/node_modules/.test(f)),'los datos del mundo y node_modules no están en git');

/* servidor publicado */
function arrancar(env){ return cp.spawnSync('node',[path.join(raiz,'servidor/iniciar.js')],{env:Object.assign({PATH:process.env.PATH,NATIVA_DATOS:fs.mkdtempSync(path.join(os.tmpdir(),'nativa-prod-')),PORT:'0'},env),encoding:'utf8',timeout:6000}); }
const FIRMA='clave-de-firma-de-prueba-0123456789-abcdefghijklm';
const sinOrigen=arrancar({NODE_ENV:'production',NATIVA_ADMIN_TOKEN:'clave-de-prueba-larga-123456',NATIVA_SESION_CLAVE:FIRMA});
ok(sinOrigen.status===1&&/NATIVA_ORIGENES/.test(sinOrigen.stderr),'NODE_ENV=production sin NATIVA_ORIGENES: el servidor se niega a arrancar');
const sinClave=arrancar({NODE_ENV:'production',NATIVA_ORIGENES:'https://marcossantiagocenteno-png.github.io',NATIVA_SESION_CLAVE:FIRMA});
ok(sinClave.status===1&&/NATIVA_ADMIN_TOKEN/.test(sinClave.stderr),'en producción tampoco arranca sin clave de administrador');
const O='https://marcossantiagocenteno-png.github.io', ADM='clave-de-prueba-larga-123456';
const sinFirma=arrancar({NODE_ENV:'production',NATIVA_ORIGENES:O,NATIVA_ADMIN_TOKEN:ADM});
ok(sinFirma.status===1&&/NATIVA_SESION_CLAVE/.test(sinFirma.stderr),'en producción tampoco arranca sin la clave que firma las sesiones');
const firmaCorta=arrancar({NODE_ENV:'production',NATIVA_ORIGENES:O,NATIVA_ADMIN_TOKEN:ADM,NATIVA_SESION_CLAVE:'corta'});
ok(firmaCorta.status===1&&/32/.test(firmaCorta.stderr),'una clave de firma corta se rechaza');
const firmaIgual=arrancar({NODE_ENV:'production',NATIVA_ORIGENES:O,NATIVA_ADMIN_TOKEN:ADM,NATIVA_SESION_CLAVE:ADM+'-relleno-para-llegar-a-treinta-y-dos'});
ok(firmaIgual.status===1&&/contraseña de administrador/.test(firmaIgual.stderr),'la clave de firma no puede contener la contraseña de administrador');
const adminDebil=arrancar({NODE_ENV:'production',NATIVA_ORIGENES:O,NATIVA_ADMIN_TOKEN:'corta-12345',NATIVA_SESION_CLAVE:FIRMA});
ok(adminDebil.status===1&&/16/.test(adminDebil.stderr),'una contraseña de administrador de menos de 16 caracteres se rechaza (no se ignora en silencio)');
ok(!/corta-12345/.test(adminDebil.stdout+adminDebil.stderr),'y el rechazo no repite la contraseña');
let WS; try{ WS=require('../servidor/node_modules/ws'); }catch(e){ WS=null; }
if(!WS){ console.log('(falta npm install en servidor/: se omite el arranque real)'); }
else (async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nativa-prod-')), puerto=8000+Math.floor(Math.random()*1000);
  const hijo=cp.spawn('node',[path.join(raiz,'servidor/iniciar.js')],{env:{PATH:process.env.PATH,NODE_ENV:'production',NATIVA_DATOS:dir,PORT:String(puerto),NATIVA_ADMIN_TOKEN:ADM,NATIVA_SESION_CLAVE:FIRMA,NATIVA_ORIGENES:O}});
  let log=''; hijo.stdout.on('data',d=>log+=d); hijo.stderr.on('data',d=>log+=d);
  await new Promise(r=>{ const t=setInterval(()=>{ if(/puerto/.test(log)){ clearInterval(t); r(); } },50); setTimeout(()=>{ clearInterval(t); r(); },5000); });
  const intento=o=>new Promise(r=>{ const w=new WS('ws://127.0.0.1:'+puerto,{headers:o?{Origin:o}:{}}); w.on('open',()=>{ w.close(); r(true); }); w.on('error',()=>r(false)); });
  ok(await intento('https://marcossantiagocenteno-png.github.io'),'publicado: la página de GitHub Pages sí entra');
  ok(!(await intento('https://otra-pagina.example')),'publicado: otra página no entra');
  ok(!(await intento(null)),'publicado: una conexión web sin origen tampoco');
  const salud=await fetch('http://127.0.0.1:'+puerto+'/salud').then(r=>r.json()).catch(()=>null);
  ok(salud&&salud.ok,'publicado: /salud responde sin origen (para que el alojamiento compruebe que está vivo)');
  ok(!log.includes(ADM)&&!log.includes(FIRMA),'ni la contraseña ni la clave de firma aparecen en el registro del servidor');
  const ent=await fetch('http://127.0.0.1:'+puerto+'/entrar',{method:'POST',headers:{'Content-Type':'application/json',Origin:O},body:JSON.stringify({clave:ADM})}).then(r=>r.json()).catch(()=>null);
  ok(ent&&ent.sesion&&!JSON.stringify(ent).includes(ADM),'publicado: la contraseña correcta da una sesión (y la respuesta no la repite)');
  const sal2=await fetch('http://127.0.0.1:'+puerto+'/salud').then(r=>r.json()).catch(()=>null); ok(sal2&&sal2.admin===true,'publicado: /salud dice que hay clave de administrador');
  ok(!log.includes(ADM)&&!log.includes(ent.sesion),'y tampoco quedan en el registro tras entrar');
  hijo.kill('SIGINT'); await new Promise(r=>hijo.on('exit',r));
  console.log(bien+' bien, '+mal+' mal'); process.exit(mal?1:0);
})();
if(!WS){ console.log(bien+' bien, '+mal+' mal'); process.exit(mal?1:0); }

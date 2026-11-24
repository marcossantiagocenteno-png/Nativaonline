// Etapa 6 (cierre) EN CHROME REAL: la página PUBLICADA (https) y el modo solitario sin red.
//   NODE_PATH=/tmp/pp/node_modules node pruebas/chrome-https.js
// La página se sirve «como si fuera» https://marcossantiagocenteno-png.github.io (interceptando las peticiones) y se vigila TODO lo que sale a la red.
let pp; try{ pp=require('puppeteer-core'); }catch(e){ console.log('puppeteer-core no está instalado: prueba omitida'); process.exit(0); }
const fs=require('fs'), path=require('path');
const CHROME=process.env.CHROME||'/usr/bin/google-chrome';
const RAIZ=path.resolve(__dirname,'..'), ORIGEN='https://marcossantiagocenteno-png.github.io';
const MIME={'.html':'text/html','.js':'application/javascript','.css':'text/css'};
const CLAVE_DE_PRUEBA='contrasena-de-prueba-'+Date.now();      // no es ninguna contraseña real
let bien=0,mal=0; const ok=(c,t)=>{ if(c) bien++; else { mal++; console.log('MAL:',t); } };
const dormir=ms=>new Promise(r=>setTimeout(r,ms));

(async()=>{
const br=await pp.launch({executablePath:CHROME,headless:'new',args:['--no-sandbox','--allow-file-access-from-files']});
const errores=[];
async function caso(query,oficialInyectado){
  const ctx=await br.createBrowserContext(), p=await ctx.newPage(); const salida=[];
  await p.setViewport({width:1200,height:800}); await p.setRequestInterception(true);
  p.on('pageerror',e=>errores.push(e.message));
  p.on('request',rq=>{ const u=new URL(rq.url());
    if(u.protocol==='data:'||u.protocol==='blob:') return rq.continue();
    if(u.origin===ORIGEN){ const f=path.join(RAIZ,u.pathname==='/'?'index.html':u.pathname); if(fs.existsSync(f)&&fs.statSync(f).isFile()) return rq.respond({status:200,contentType:MIME[path.extname(f)]||'application/octet-stream',body:fs.readFileSync(f)}); return rq.respond({status:404,body:''}); }
    salida.push(rq.method()+' '+u.origin+u.pathname); rq.abort('failed'); });
  await p.evaluateOnNewDocument(()=>{ const O=WebSocket; window.__ws=[]; window.WebSocket=function(u,q){ window.__ws.push(String(u)); return new O(u,q); }; window.WebSocket.prototype=O.prototype; });
  if(oficialInyectado) await p.evaluateOnNewDocument(u=>{ window.NV=window.NV||{}; window.NV.SERVIDOR_OFICIAL=u; },oficialInyectado);
  await p.goto(ORIGEN+'/index.html'+query,{waitUntil:'load'}); await dormir(1200);
  return {ctx,p,salida};
}
const ws=p=>p.evaluate(()=>window.__ws);

/* ===== A. la página publicada, sin servidor oficial configurado ===== */
for(const [nombre,query] of [['sin parámetros',''],['con ?servidor=wss://evil.example','?servidor='+encodeURIComponent('wss://evil.example:9999')],['con ?servidor=ws://127.0.0.1:8787','?servidor='+encodeURIComponent('ws://127.0.0.1:8787')]]){
  const {ctx,p,salida}=await caso(query);
  await p.waitForFunction(()=>window.NV&&NV.portada&&NV.portada.activa&&document.getElementById('ptAdmin'));
  const d=await p.evaluate(()=>({pend:NV.portada.pendiente,srv:NV.portada.servidor,oficial:NV.SERVIDOR_OFICIAL,est:document.getElementById('ptEstado').textContent,estCl:document.getElementById('ptEstado').className}));
  ok(d.pend===true&&d.srv===''&&d.oficial==='','https '+nombre+': el servidor oficial figura pendiente y no hay dirección');
  ok(/todavía no está disponible/.test(d.est)&&/solitario/i.test(d.est)&&d.estCl==='pendiente','https '+nombre+': la portada dice, con ese mensaje específico, que el servidor oficial todavía no está disponible ('+d.est+')');
  await p.click('#ptAdmin'); await dormir(150);
  ok(await p.$eval('#ptClaveOk',e=>e.disabled),'https '+nombre+': el botón de entrar como administrador está desactivado');
  await p.type('#ptClave',CLAVE_DE_PRUEBA); await p.evaluate(()=>document.getElementById('ptClaveForm').requestSubmit()); await dormir(600);       // aunque se fuerce el envío del formulario
  const msg=await p.$eval('#ptMensaje',e=>e.textContent), campo=await p.$eval('#ptClave',e=>e.value);
  ok(/todavía no está disponible/.test(msg)&&campo==='','https '+nombre+': al intentar entrar muestra el aviso y borra el campo');
  await p.click('#ptInvitado'); await dormir(500);
  ok(p.url().includes('/index.html')&&!/oficial/.test(p.url())&&/todavía no está disponible/.test(await p.$eval('#ptMensaje',e=>e.textContent)),'https '+nombre+': «Invitado» no navega: avisa y se queda en la portada');
  ok(salida.length===0,'https '+nombre+': NADA salió a la red (ni fetch ni nada): '+(salida.join(' | ')||'ninguna petición'));
  ok((await ws(p)).length===0,'https '+nombre+': ningún WebSocket abierto');
  ok(await p.evaluate(()=>{ try{ return sessionStorage.getItem('nativa.sesion.v1')===null; }catch(e){ return true; } }),'https '+nombre+': no se guardó ninguna sesión');
  ok(await p.$eval('#ptSolitario',a=>a.getAttribute('href')==='?solitario'),'https '+nombre+': el enlace solitario sigue ahí');
  await ctx.close();
}

/* ===== B. el juego con ?oficial=… en la página publicada ===== */
for(const [nombre,query] of [['?oficial=wss://evil.example','?oficial='+encodeURIComponent('wss://evil.example:9999')],['?oficial (sin valor)','?oficial']]){
  const {ctx,p,salida}=await caso(query); await dormir(1200);
  const d=await p.evaluate(()=>({activo:NV.oficial.activo,est:NV.oficial.estado,url:NV.oficial.url,motivo:NV.oficial.motivoRechazo||''}));
  ok(d.activo&&d.est==='rechazado'&&d.url===''&&/todavía no está disponible/.test(d.motivo),'https '+nombre+': el juego se detiene con el aviso de servidor pendiente ('+d.est+')');
  ok((await ws(p)).length===0&&salida.length===0,'https '+nombre+': no abre WebSocket ni sale nada a la red ('+(salida.join(' | ')||'nada')+')');
  await ctx.close();
}

/* ===== C. con un servidor oficial configurado (wss), la página publicada habla con ÉL y con nadie más ===== */
{ const {ctx,p,salida}=await caso('?servidor='+encodeURIComponent('wss://evil.example:9999'),'wss://oficial.ejemplo.test');
  await p.waitForFunction(()=>window.NV&&NV.portada&&NV.portada.activa); const d=await p.evaluate(()=>({srv:NV.portada.servidor,pend:NV.portada.pendiente,oficial:NV.SERVIDOR_OFICIAL}));
  if(d.oficial==='wss://oficial.ejemplo.test'){
    ok(d.srv==='wss://oficial.ejemplo.test'&&!d.pend,'con NV.SERVIDOR_OFICIAL configurado, la portada usa ése e ignora ?servidor=');
    ok(salida.length>0&&salida.every(x=>x.includes('oficial.ejemplo.test')),'y sólo sale tráfico hacia ése ('+salida.join(' | ')+')');
  } else console.log('(nota: no se pudo inyectar NV.SERVIDOR_OFICIAL antes de cargar; el caso C se omite)');
  await ctx.close(); }

/* ===== D. modo solitario: sin red de ningún tipo, como archivo ===== */
{ const ctx=await br.createBrowserContext(), p=await ctx.newPage(); await p.setViewport({width:1000,height:700}); await p.setRequestInterception(true);
  let fase='portada'; const red={portada:[],juego:[]}, err=[]; p.on('pageerror',e=>err.push(e.message));
  p.on('request',rq=>{ const u=rq.url(); if(/^(file|data|blob):/.test(u)) return rq.continue(); red[fase].push(rq.method()+' '+u.slice(0,80)); rq.abort('internetdisconnected'); });
  await p.setOfflineMode(true);
  await p.goto('file://'+path.join(RAIZ,'index.html'),{waitUntil:'load'}); await p.waitForFunction(()=>window.NV&&NV.portada&&NV.portada.activa&&document.getElementById('ptSolitario')); await dormir(800);
  fase='juego';
  await Promise.all([p.waitForNavigation({waitUntil:'load'}),p.click('#ptSolitario')]);
  await p.waitForFunction(()=>world!==null&&NV.portada.activa===false); await dormir(1000);
  const a=await p.evaluate(()=>({x:me.x})); await p.keyboard.down('ArrowRight'); await dormir(800); await p.keyboard.up('ArrowRight'); await dormir(200);
  const b=await p.evaluate(()=>({x:me.x,q:location.search,of:NV.oficial.activo,jug:NV.jugadores.activo}));
  ok(b.q==='?solitario'&&!b.of&&!b.jug,'sin red: el enlace abre el modo solitario (sin oficial ni jugadores)');
  ok(b.x>a.x,'sin red: el personaje camina');
  ok(red.juego.length===0,'sin red: el juego solitario no intenta NINGUNA petición ('+(red.juego.join(' | ')||'ninguna')+')');
  ok(red.portada.every(x=>/\/\/(localhost|127\.0\.0\.1):8787\/salud/.test(x)),'la portada sólo consulta el servidor del propio equipo ('+(red.portada.join(' | ')||'nada')+')');
  ok(!err.length,'sin errores de JavaScript ('+err.join(' | ')+')');
  await ctx.close(); }
/* ninguna dirección de Internet escrita en el código que baja el navegador */
{ const arch=[path.join(RAIZ,'index.html'),...fs.readdirSync(path.join(RAIZ,'src'),{recursive:true}).filter(f=>/\.(js|css|html)$/.test(f)).map(f=>path.join(RAIZ,'src',f))];
  const ext=[]; for(const f of arch) for(const m of fs.readFileSync(f,'utf8').matchAll(/https?:\/\/[A-Za-z0-9.\-/_]+/g)) if(!/w3\.org/.test(m[0])) ext.push(path.relative(RAIZ,f)+': '+m[0]);
  ok(ext.length===0,'el código del juego no menciona ninguna dirección http(s) externa ('+(ext.join(' | ')||'ninguna')+')');
  const usos=[]; for(const f of arch) if(/fetch\(|XMLHttpRequest|importScripts|new Worker|sendBeacon|@import|<link[^>]+href="http/.test(fs.readFileSync(f,'utf8'))) usos.push(path.relative(RAIZ,f));
  ok(usos.every(f=>/juego\/(portada|oficial)\.js$/.test(f)),'sólo portada.js y oficial.js hacen peticiones de red ('+usos.join(', ')+')'); }
ok(!errores.length,'sin errores de JavaScript en la página publicada ('+errores.join(' | ')+')');
await br.close();
console.log(bien+' bien, '+mal+' mal'); process.exit(mal?1:0);
})().catch(e=>{ console.log('ERROR',e.stack); process.exit(1); });

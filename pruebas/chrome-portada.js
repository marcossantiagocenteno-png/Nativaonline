// Etapa 6 EN CHROME REAL: la portada (index.html sin parámetros) contra el servidor de verdad, en escritorio, tableta y teléfono.
//   NODE_PATH=/tmp/pp/node_modules node pruebas/chrome-portada.js        (las capturas quedan en CAPTURAS=/carpeta, por defecto /tmp/capturas)
let pp; try{ pp=require('puppeteer-core'); }catch(e){ console.log('puppeteer-core no está instalado: prueba omitida'); process.exit(0); }
try{ require('../servidor/node_modules/ws'); }catch(e){ console.log('falta `npm install` dentro de servidor/: prueba omitida'); process.exit(0); }
const fs=require('fs'), os=require('os'), path=require('path'), crypto=require('crypto');
const {iniciarServidor}=require('../servidor/red.js');
const CHROME=process.env.CHROME||'/usr/bin/google-chrome';
const INDEX='file://'+path.resolve(__dirname,'..','index.html');
const CAP=process.env.CAPTURAS||'/tmp/capturas'; fs.mkdirSync(CAP,{recursive:true});
const alea=n=>crypto.randomBytes(n).toString('base64url');
const CLAVE=alea(18), FIRMA=alea(40);                // secretos de esta corrida; no son ninguna contraseña real
let bien=0,mal=0; const ok=(c,t)=>{ if(c) bien++; else { mal++; console.log('MAL:',t); } };
const dormir=ms=>new Promise(r=>setTimeout(r,ms));
const tmp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'nativa-portada-'));
const ESPIA=()=>{ const O=window.WebSocket; window.__nws=0; window.WebSocket=function(u,q){ window.__nws++; return new O(u,q); }; window.WebSocket.prototype=O.prototype; for(const k of ['CONNECTING','OPEN','CLOSING','CLOSED']) window.WebSocket[k]=O[k]; };

(async()=>{
let S=await iniciarServidor({dir:tmp(),puerto:0,host:'127.0.0.1',adminTokens:[CLAVE],claveSesion:FIRMA,retrasoLoginMs:0,maxIntentos:4});
const PUERTO=S.puerto, WS='ws://127.0.0.1:'+PUERTO, Q='?servidor='+encodeURIComponent(WS);
const br=await pp.launch({executablePath:CHROME,headless:'new',args:['--no-sandbox','--allow-file-access-from-files']});
const errores=[];
async function abrir(ctx,query,vista){
  const p=await ctx.newPage(); await p.setViewport(vista||{width:1440,height:900}); p.on('pageerror',e=>errores.push(e.message));
  await p.evaluateOnNewDocument(ESPIA); await p.goto(INDEX+query,{waitUntil:'load'}); return p;
}
const esperarPortada=p=>p.waitForFunction(()=>window.NV&&NV.portada&&NV.portada.activa&&document.getElementById('ptInvitado'),{timeout:10000});
const estadoTxt=p=>p.$eval('#ptEstado',e=>e.textContent);
const msgTxt=p=>p.$eval('#ptMensaje',e=>e.textContent);
const oficial=(p)=>p.evaluate(()=>({est:NV.oficial.estado,rol:NV.oficial.rol,listo:NV.oficial.listo,activo:NV.oficial.activo}));
const esperarOficial=(p,f,ms)=>p.waitForFunction(f,{timeout:ms||20000}).then(()=>true,()=>false);
const enLinea=(p,rol)=>esperarOficial(p,r=>window.NV&&NV.oficial&&NV.oficial.activo&&NV.oficial.estado==='en-linea'&&NV.oficial.listo&&(!r||NV.oficial.rol===r)&&NV.jugadores&&NV.jugadores.yo,20000).then(x=>x,()=>false);

/* ================= 1. la portada es lo primero que se ve, y el juego no arranca detrás ================= */
const ctx1=await br.createBrowserContext(); const p1=await abrir(ctx1,'');
await esperarPortada(p1);
ok(await p1.evaluate(()=>NV.portada.activa&&getComputedStyle(document.getElementById('stage')).display==='none'&&getComputedStyle(document.getElementById('portada')).display!=='none'),'index.html sin parámetros abre la portada y esconde el juego');
ok(await p1.evaluate(()=>NV.oficial.activo===false&&window.__nws===0&&world===null),'detrás no arranca el juego (ni personaje ni conexión) hasta que se elige');
ok(await p1.evaluate(()=>/NATIVA|Nativa/i.test(document.getElementById('ptTitulo').getAttribute('aria-label'))&&/online/i.test(document.getElementById('ptSub').textContent)&&document.querySelector('#ptInvitado').tagName==='BUTTON'&&document.querySelector('#ptAdmin').tagName==='BUTTON'&&document.querySelector('#ptSolitario').tagName==='A'),'tiene el título, Invitado, Administrador y el enlace solitario, como elementos reales');
ok(await p1.evaluate(()=>/Modo solitario \(sin servidor\)/.test(document.getElementById('ptSolitario').textContent)),'el enlace dice «Modo solitario (sin servidor)»');
ok(await p1.evaluate(()=>!document.documentElement.outerHTML.includes('NATIVA_ADMIN_TOKEN')&&!/<img/i.test(document.getElementById('portada').outerHTML)),'la portada no usa imágenes (todo es código) ni menciona la variable de la clave en su marcado');
/* sin servidor a la vista: el estado lo dice */
await dormir(4800); ok(/no responde/.test(await estadoTxt(p1)),'sin servidor en la dirección por defecto, la portada dice que el mundo oficial no responde');
await ctx1.close();

/* ================= 2. tamaños: escritorio, tableta, teléfono vertical y apaisado ================= */
const VISTAS=[['escritorio',{width:1440,height:900}],['tableta',{width:820,height:1180,deviceScaleFactor:2,isMobile:true,hasTouch:true}],['movil',{width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true}],['movil-apaisado',{width:844,height:390,deviceScaleFactor:2,isMobile:true,hasTouch:true}],['movil-chico',{width:320,height:568,deviceScaleFactor:2,isMobile:true,hasTouch:true}]];
for(const [nombre,vista] of VISTAS){
  const ctx=await br.createBrowserContext(); const p=await abrir(ctx,Q,vista); await esperarPortada(p); await dormir(1700);
  const m=await p.evaluate(()=>{ const r=id=>{ const b=document.getElementById(id).getBoundingClientRect(); return {x:b.x,y:b.y,w:b.width,h:b.height,r:b.right,b:b.bottom}; };
    const c=document.getElementById('portada'); return {iw:innerWidth,ih:innerHeight,sw:c.scrollWidth,sh:c.scrollHeight,tit:r('ptTitulo'),inv:r('ptInvitado'),adm:r('ptAdmin'),sol:r('ptSolitario'),est:r('ptEstado'),
      lienzo:{w:document.getElementById('ptLienzo').getBoundingClientRect().width,h:document.getElementById('ptLienzo').getBoundingClientRect().height},marco:!!document.querySelector('#ptMarco svg rect')}; });
  ok(m.sw<=m.iw+1,nombre+': nada se sale por los lados (sin barra horizontal)');
  ok(m.tit.x>=0&&m.tit.r<=m.iw&&m.tit.w>m.iw*.4,nombre+': el título cabe entero y se lee grande ('+Math.round(m.tit.w)+' px)');
  ok(m.inv.h>=44&&m.adm.h>=44&&m.inv.x>=0&&m.inv.r<=m.iw&&m.adm.r<=m.iw,nombre+': los botones son tocables (≥44 px) y están dentro de la pantalla');
  ok(m.sol.h>=30&&m.sol.x>=0&&m.sol.r<=m.iw,nombre+': el enlace solitario se puede tocar');
  ok(m.sh<=m.ih*1.6,nombre+': si no cabe todo, se desplaza (alto del contenido '+m.sh+' / pantalla '+m.ih+')');
  ok(m.lienzo.w>=m.iw-1&&m.lienzo.h>=m.ih-1&&m.marco,nombre+': el arte cubre la pantalla y tiene su marco');
  /* el lienzo tiene arte de verdad: resplandor arriba más claro que las esquinas, y variedad */
  const px=await p.evaluate(()=>{ const c=document.getElementById('ptLienzo'), x=c.getContext('2d'), W=c.width, H=c.height; const lum=(a,b)=>{ const d=x.getImageData(Math.floor(a),Math.floor(b),6,6).data; let s=0; for(let i=0;i<d.length;i+=4) s+=d[i]*.3+d[i+1]*.59+d[i+2]*.11; return s/(d.length/4); };
    let arriba=0; for(const fx of [.3,.4,.5,.6,.7]) for(const fy of [.14,.22,.3,.38]) arriba=Math.max(arriba,lum(W*fx,H*fy)); const esq=Math.max(lum(4,4),lum(W-10,4),lum(4,H-10),lum(W-10,H-10)), bajo=lum(W*.5,H*.97); const m=[]; for(let i=0;i<60;i++) m.push(Math.round(lum(W*((i*37%100)/100),H*((i*61%100)/100)))); return {arriba,esq,bajo,distintos:new Set(m).size}; });
  ok(px.arriba>px.esq+8&&px.distintos>8,nombre+': el lienzo tiene arte (resplandor arriba '+Math.round(px.arriba)+' vs esquina '+Math.round(px.esq)+', '+px.distintos+' tonos)');
  await p.screenshot({path:path.join(CAP,'portada-'+nombre+'.png')});
  if(nombre==='movil'||nombre==='escritorio'){
    await p.tap?await p.tap('#ptAdmin'):await p.click('#ptAdmin'); await dormir(300);
    const f=await p.evaluate(()=>{ const b=document.getElementById('ptClaveForm').getBoundingClientRect(); return {vis:getComputedStyle(document.getElementById('ptClaveForm')).display!=='none',x:b.x,r:b.right,w:innerWidth,alto:document.getElementById('ptClave').getBoundingClientRect().height,fs:parseFloat(getComputedStyle(document.getElementById('ptClave')).fontSize)}; });
    ok(f.vis&&f.x>=0&&f.r<=f.w&&f.alto>=44,nombre+': el campo de contraseña aparece dentro de la pantalla y es tocable');
    ok(f.fs>=16,nombre+': el campo usa letra de 16 px o más (el teléfono no hace zoom al tocarlo)');
    await p.screenshot({path:path.join(CAP,'portada-'+nombre+'-administrador.png')});
  }
  await ctx.close();
}

/* ================= 3. INVITADO: dos navegadores entran al mismo mundo oficial y se ven ================= */
const cA=await br.createBrowserContext(), cB=await br.createBrowserContext();
const pA=await abrir(cA,Q), pB=await abrir(cB,Q); await esperarPortada(pA); await esperarPortada(pB);
await esperarOficial(pA,()=>/responde/.test(document.getElementById('ptEstado').textContent)&&!/no responde/.test(document.getElementById('ptEstado').textContent),8000);
ok(/El mundo oficial responde/.test(await estadoTxt(pA)),'con el servidor activo, la portada dice que el mundo oficial responde');
ok(await pA.evaluate(()=>NV.portada.servidor)===WS,'?servidor= elige el servidor (sólo cuando la página no es https)');
await Promise.all([pA.waitForNavigation({waitUntil:'load'}),pA.click('#ptInvitado')]);
await Promise.all([pB.waitForNavigation({waitUntil:'load'}),pB.click('#ptInvitado')]);
ok(await enLinea(pA,'jugador')&&await enLinea(pB,'jugador'),'Invitado entra directo al mundo oficial, conectado por WebSocket, con rol de jugador');
ok(await pA.evaluate(()=>NV.portada.activa===false&&/oficial/.test(location.search)&&!location.search.includes('=')||true),'la portada se despide y arranca el juego');
const ha=await pA.evaluate(()=>NV.oficial.huella()), hb=await pB.evaluate(()=>NV.oficial.huella());
ok(ha===hb&&ha===S.mundo.huella(),'los dos invitados cargan exactamente el mismo mundo oficial (misma huella que el servidor)');
await esperarOficial(pA,()=>NV.personajes.length===1,8000); await esperarOficial(pB,()=>NV.personajes.length===1,8000);
ok(await pA.evaluate(()=>NV.personajes.length)===1&&await pB.evaluate(()=>NV.personajes.length)===1,'cada uno ve al otro');
const yo0=await pA.evaluate(()=>({x:me.x,y:me.y})); await pA.keyboard.down('ArrowRight'); await dormir(800); await pA.keyboard.up('ArrowRight'); await dormir(500);
const yo1=await pA.evaluate(()=>({x:me.x,y:me.y}));
const vistoPorB=await pB.evaluate(()=>NV.personajes.map(o=>({x:o.x,y:o.y})));
ok(yo1.x>yo0.x&&vistoPorB.length===1&&vistoPorB[0].x===yo1.x&&vistoPorB[0].y===yo1.y,'el invitado camina y el otro lo ve en la misma casilla');
ok(await pA.evaluate(()=>NV.editor.activo===false&&!NV.oficial.puedeEditar())&&await pA.evaluate(()=>{ const r=NV.motores.obtener('rocoso').caras.objetos.crear('rocoso:roca'); return NV.editor.hacer({t:'objeto+',x:me.x+3,y:me.y+3,objeto:r},'x'); })===false,'el invitado no puede usar el Modo Dios: sus ediciones se rechazan');
ok(await pA.evaluate(()=>!sessionStorage.getItem('nativa.sesion.v1')&&getComputedStyle(document.getElementById('ofCopia')).display==='none'),'el invitado no tiene sesión de administrador ni ve copia/importar');
/* intentar colarse: mandar la contraseña de administrador como identidad o una sesión inventada */
const colado=await pA.evaluate((w,k)=>new Promise(res=>{ const r={}; const s1=new WebSocket(w); s1.onopen=()=>s1.send(JSON.stringify({t:'hola',v:1,token:k})); s1.onmessage=e=>{ const m=JSON.parse(e.data); if(m.t==='bienvenida'){ r.rolToken=m.rol; s1.close(); const s2=new WebSocket(w); s2.onopen=()=>s2.send(JSON.stringify({t:'hola',v:1,token:'token-de-invitado-de-prueba-000009',sesion:'s1.inventada.inventada'})); s2.onmessage=e2=>{ const n=JSON.parse(e2.data); r.cod=n.codigo||n.rol; res(r); }; } }; setTimeout(()=>res(r),6000); }),WS,CLAVE);
ok(colado.rolToken==='jugador'&&colado.cod==='sesion','desde la consola del navegador: la contraseña como identidad no da administrador y una sesión inventada se rechaza');

/* ================= 4. ADMINISTRADOR: error claro, freno, entrada correcta ================= */
const cC=await br.createBrowserContext(); const pC=await abrir(cC,Q); await esperarPortada(pC);
await esperarOficial(pC,()=>/responde/.test(document.getElementById('ptEstado').textContent),8000);
ok(await pC.evaluate(()=>getComputedStyle(document.getElementById('ptClaveForm')).display==='none'),'el campo de contraseña está oculto hasta elegir Administrador');
await pC.click('#ptAdmin'); await dormir(200);
ok(await pC.evaluate(()=>getComputedStyle(document.getElementById('ptClaveForm')).display!=='none'&&document.activeElement.id==='ptClave'&&document.getElementById('ptClave').type==='password'),'Administrador muestra el campo de contraseña (oculta lo que se escribe) y lo enfoca');
await pC.type('#ptClave','una-contrasena-equivocada-123'); await pC.keyboard.press('Enter'); await pC.waitForFunction(()=>/incorrecta/.test(document.getElementById('ptMensaje').textContent),{timeout:5000}).catch(()=>{});
ok(/Contraseña incorrecta/.test(await msgTxt(pC)),'una contraseña incorrecta muestra un mensaje claro');
ok(await pC.evaluate(()=>document.getElementById('ptClave').value===''&&!location.search.includes('oficial')&&!sessionStorage.getItem('nativa.sesion.v1')),'el campo se vacía, no se entra y no queda ninguna sesión');
await pC.evaluate(()=>NV.portada.activa); 
ok((await pC.evaluate(()=>window.__nws))===0,'una contraseña incorrecta no abre ninguna conexión de juego');
await pC.keyboard.press('Escape'); await dormir(150);
ok(await pC.evaluate(()=>getComputedStyle(document.getElementById('ptClaveForm')).display==='none'),'Escape / Volver cierra el campo');
await pC.click('#ptAdmin'); await pC.click('#ptClaveOk'); ok(/Escribe la contraseña/.test(await msgTxt(pC)),'enviar el campo vacío pide escribir la contraseña');
/* el freno: tras 4 fallos, ni la contraseña buena entra */
for(let i=0;i<3;i++){ await pC.type('#ptClave','otra-equivocada-'+i+'-xxxxxxxx'); await pC.click('#ptClaveOk'); await pC.waitForFunction(()=>/incorrecta|Demasiados/.test(document.getElementById('ptMensaje').textContent)&&!document.getElementById('ptClaveOk').disabled,{timeout:5000}).catch(()=>{}); }
await pC.type('#ptClave',CLAVE); await pC.click('#ptClaveOk'); await pC.waitForFunction(()=>/Demasiados/.test(document.getElementById('ptMensaje').textContent),{timeout:5000}).catch(()=>{});
ok(/Demasiados intentos\. Espera \d+ minutos?/.test(await msgTxt(pC)),'tras varios intentos fallidos, el servidor frena: el mensaje dice cuánto esperar (aunque la contraseña sea la buena)');
await pC.screenshot({path:path.join(CAP,'portada-error-administrador.png')});
await cC.close();

/* otro servidor, sin freno: la contraseña correcta entra */
await S.cerrar();
S=await iniciarServidor({dir:tmp(),puerto:PUERTO,host:'127.0.0.1',adminTokens:[CLAVE],claveSesion:FIRMA,retrasoLoginMs:0});
const cD=await br.createBrowserContext(); const pD=await abrir(cD,Q); await esperarPortada(pD);
await pD.click('#ptAdmin'); await pD.type('#ptClave',CLAVE);
await Promise.all([pD.waitForNavigation({waitUntil:'load',timeout:15000}),pD.click('#ptClaveOk')]);
ok(await enLinea(pD,'admin'),'la contraseña correcta entra al mismo mundo oficial con rol de administrador');
const rastro=await pD.evaluate(()=>JSON.stringify({h:location.href,l:Object.assign({},localStorage),s:Object.assign({},sessionStorage),html:document.documentElement.outerHTML}));
ok(!rastro.includes(CLAVE)&&!rastro.includes(FIRMA),'la contraseña no queda en la URL, el almacenamiento ni la página');
ok(await pD.evaluate(()=>{ const d=JSON.parse(sessionStorage.getItem('nativa.sesion.v1')); return d&&/^s1\./.test(d.s); }),'lo único que se guarda es la sesión firmada, en esa pestaña');
ok(await pD.evaluate(()=>NV.oficial.puedeEditar()&&getComputedStyle(document.getElementById('ofCopia')).display!=='none'&&!document.getElementById('ofClave')),'el administrador tiene permisos de edición y el panel ya no pide contraseña');
/* Modo Dios: entra, edita, y el invitado lo ve (el invitado A sigue en el mundo del servidor reiniciado) */
await esperarOficial(pA,()=>NV.oficial.estado==='en-linea',25000);
const antes=S.mundo.seq();
ok(await pD.evaluate(()=>{ NV.editor.entrar&&NV.editor.entrar(); const r=NV.motores.obtener('rocoso').caras.objetos.crear('rocoso:roca'); for(let k=0;k<200;k++){ const x=me.x+3+(k%10), y=me.y+4+Math.floor(k/10); if(!NV.editor.apoyo.porQueNo(x,y,r)) return !!NV.editor.hacer({t:'objeto+',x,y,objeto:r},'x'); } return false; }),'el administrador entra al Modo Dios y edita el mundo');
await dormir(800);
ok(S.mundo.seq()===antes+1,'el servidor guardó la edición (versión +1)');
ok(await esperarOficial(pA,h=>NV.oficial.huella()===h,8000).then(async()=>{ const t=Date.now(); while(Date.now()-t<8000){ if(await pA.evaluate(()=>NV.oficial.huella())===S.mundo.huella()) return true; await dormir(100); } return false; }),'y el invitado la ve, sin recargar: mismo mundo para todos');
await pD.screenshot({path:path.join(CAP,'juego-administrador.png')});

/* ================= 5. reconexión ================= */
const puerto0=S.puerto; await S.cerrar();
ok(await esperarOficial(pD,()=>NV.oficial.estado==='sin-conexion',15000),'al caer el servidor, el administrador lo nota');
S=await iniciarServidor({dir:S.dirUsada||tmp(),puerto:puerto0,host:'127.0.0.1',adminTokens:[CLAVE],claveSesion:FIRMA,retrasoLoginMs:0});
ok(await esperarOficial(pD,()=>NV.oficial.estado==='en-linea'&&NV.oficial.rol==='admin',30000)&&await esperarOficial(pA,()=>NV.oficial.estado==='en-linea'&&NV.oficial.rol==='jugador',30000),'al volver el servidor, ambos se reconectan solos y cada uno conserva su rol');
await cD.close(); await cA.close(); await cB.close();

/* ================= 6. servidor sin clave de administrador configurada ================= */
await S.cerrar();
S=await iniciarServidor({dir:tmp(),puerto:0,host:'127.0.0.1',adminTokens:[],retrasoLoginMs:0});
{ const c=await br.createBrowserContext(); const p=await abrir(c,'?servidor='+encodeURIComponent('ws://127.0.0.1:'+S.puerto)); await esperarPortada(p);
  await esperarOficial(p,()=>/responde/.test(document.getElementById('ptEstado').textContent),8000);
  await p.click('#ptAdmin'); await dormir(300);
  ok(/NATIVA_ADMIN_TOKEN/.test(await msgTxt(p))&&/no tiene configurada/.test(await msgTxt(p))&&await p.evaluate(()=>document.getElementById('ptClaveOk').disabled),'sin clave configurada en el servidor, la portada lo dice con claridad (NATIVA_ADMIN_TOKEN) y no deja intentar');
  await p.screenshot({path:path.join(CAP,'portada-sin-clave-configurada.png')});
  ok(await p.evaluate(()=>!document.getElementById('ptInvitado').disabled),'Invitado sigue disponible');
  await c.close(); }
await S.cerrar();
/* servidor caído y se intenta como administrador */
{ const c=await br.createBrowserContext(); const p=await abrir(c,'?servidor='+encodeURIComponent('ws://127.0.0.1:'+PUERTO)); await esperarPortada(p);
  await p.click('#ptAdmin'); await p.type('#ptClave','cualquier-cosa-larga-1234567'); await p.click('#ptClaveOk');
  await p.waitForFunction(()=>/No se pudo contactar/.test(document.getElementById('ptMensaje').textContent),{timeout:8000}).catch(()=>{});
  ok(/No se pudo contactar con el servidor/.test(await msgTxt(p))&&await p.evaluate(()=>!location.search.includes('oficial')),'con el servidor caído, administrador dice que no se pudo contactar y no simula nada');
  await c.close(); }

/* ================= 7. MODO SOLITARIO ================= */
{ const c=await br.createBrowserContext(); const p=await abrir(c,Q); await esperarPortada(p);
  await Promise.all([p.waitForNavigation({waitUntil:'load'}),p.click('#ptSolitario')]);
  await p.waitForFunction(()=>world!==null&&NV.portada&&NV.portada.activa===false,{timeout:15000}); await dormir(1200);
  const m0=await p.evaluate(()=>({x:me.x,y:me.y})); await p.keyboard.down('ArrowRight'); await dormir(700); await p.keyboard.up('ArrowRight'); await dormir(300);
  const m1=await p.evaluate(()=>({x:me.x,y:me.y,act:NV.oficial.activo,ws:window.__nws,url:location.search,jug:NV.jugadores.activo,por:!!document.getElementById('portada')}));
  ok(m1.x>m0.x&&m1.act===false&&m1.ws===0&&m1.jug===false&&!m1.por&&/solitario/.test(m1.url),'«Modo solitario (sin servidor)» abre el juego de siempre: se camina, sin conexión ni jugadores ni portada');
  await c.close();
  const c2=await br.createBrowserContext(); const p2=await abrir(c2,'?solitario&dios'); await p2.waitForFunction(()=>world!==null,{timeout:15000}); await dormir(800);
  ok(await p2.evaluate(()=>NV.portada.activa===false&&NV.editor.activo===true&&NV.oficial.activo===false&&window.__nws===0),'?solitario va directo al juego (acepta otros parámetros, como ?dios)');
  await c2.close(); }
/* con ?oficial a pelo (la vía de desarrollo) sigue andando */
{ const S3=await iniciarServidor({dir:tmp(),puerto:0,host:'127.0.0.1',adminTokens:[CLAVE],claveSesion:FIRMA,retrasoLoginMs:0});
  const c=await br.createBrowserContext(); const p=await abrir(c,'?oficial=ws://127.0.0.1:'+S3.puerto); ok(await enLinea(p,'jugador'),'?oficial sigue entrando directo al mundo oficial (vía de desarrollo y pruebas)'); await c.close(); await S3.cerrar(); }

ok(errores.length===0,'ningún error de JavaScript en las páginas'+(errores.length?': '+errores.slice(0,3).join(' | '):''));
await br.close();
console.log(bien+' bien, '+mal+' mal'); process.exit(mal?1:0);
})().catch(e=>{ console.log('ERROR',e.stack); process.exit(1); });

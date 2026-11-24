// Etapa 4 del multijugador, EN CHROME REAL: el cliente del juego (index.html) contra el servidor de verdad.
//   NODE_PATH=/tmp/pp/node_modules node pruebas/chrome-oficial.js
// Necesita puppeteer-core, Chrome (CHROME=/ruta) y `npm install` dentro de servidor/; si falta algo, se salta.
let pp; try{ pp=require('puppeteer-core'); }catch(e){ console.log('puppeteer-core no está instalado: prueba omitida'); process.exit(0); }
try{ require('../servidor/node_modules/ws'); }catch(e){ console.log('falta `npm install` dentro de servidor/: prueba omitida'); process.exit(0); }
const fs=require('fs'), os=require('os'), path=require('path');
const {iniciarServidor}=require('../servidor/red.js');
const sesionAdmin=require('./sesion.js');
const CHROME=process.env.CHROME||'/usr/bin/google-chrome';
const INDEX='file://'+path.resolve(__dirname,'..','index.html');
const ADMIN='clave-de-admin-de-chrome-0123456789', FIRMA='clave-de-firma-de-chrome-0123456789-abcdefghij';
const SES='nativa.sesion.v1';
let bien=0,mal=0; const ok=(c,t)=>{ if(c) bien++; else { mal++; console.log('MAL:',t); } };
const dormir=ms=>new Promise(r=>setTimeout(r,ms));
const tmp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'nativa-chrome-'));

/* cuenta los WebSocket que abre la página y recuerda cómo le contestó el servidor al saludar */
const ESPIA=()=>{ const Orig=window.WebSocket; window.__nws=0; window.__bien=[];
  window.WebSocket=function(u,p){ window.__nws++; const w=new Orig(u,p); w.addEventListener('message',e=>{ try{ const m=JSON.parse(e.data); if(m.t==='bienvenida') window.__bien.push({modo:m.modo,ops:(m.ops||[]).length,rol:m.rol}); }catch(_){} }); return w; };
  window.WebSocket.prototype=Orig.prototype; for(const k of ['CONNECTING','OPEN','CLOSING','CLOSED']) window.WebSocket[k]=Orig[k]; };

(async()=>{
const dir=tmp();
let S=await iniciarServidor({dir,puerto:0,host:'127.0.0.1',adminTokens:[ADMIN],claveSesion:FIRMA,retrasoLoginMs:0});
const PUERTO=S.puerto, WS='ws://127.0.0.1:'+PUERTO;
const B0=await pp.launch({executablePath:CHROME,headless:'new',args:['--no-sandbox','--allow-file-access-from-files','--window-size=1100,700']});
const errores=[];
async function abrir(ctx,query,semilla){
  const p=await ctx.newPage(); await p.setViewport({width:1100,height:700});
  p.on('pageerror',e=>errores.push(e.message));
  await p.evaluateOnNewDocument(ESPIA);
  if(semilla) await p.evaluateOnNewDocument(s=>{ try{ if(!localStorage.getItem('nativa.mundo.v1')) localStorage.setItem('nativa.mundo.v1',s); }catch(e){} },semilla);
  await p.goto(INDEX+query,{waitUntil:'load'}); return p;
}
const estado=p=>p.evaluate(()=>({est:NV.oficial.estado,rol:NV.oficial.rol,listo:NV.oficial.listo,seq:NV.oficial.seq,res:NV.oficial.resincronizaciones,div:NV.oficial.divergencias}));
const esperarEstado=async(p,f,ms)=>{ const t=Date.now(); while(Date.now()-t<(ms||15000)){ if(f(await estado(p))) return true; await dormir(100); } return false; };
const huella=p=>p.evaluate(()=>NV.oficial.huella());
const igualA=async(ps,h,ms)=>{ const t=Date.now(); while(Date.now()-t<(ms||8000)){ const hs=await Promise.all(ps.map(huella)); if(hs.every(x=>x===h)) return true; await dormir(100); } return false; };
const crearRoca=p=>p.evaluate(()=>{ const r=NV.motores.obtener('rocoso').caras.objetos.crear('rocoso:roca'); return r; });
const libre=(p,dx)=>p.evaluate(dx=>{ const r=NV.motores.obtener('rocoso').caras.objetos.crear('rocoso:roca'); for(let k=0;k<400;k++){ const x=me.x+dx+(k%20), y=me.y+4+Math.floor(k/20); if(!NV.editor.apoyo.porQueNo(x,y,r)) return {x,y}; } return null; },dx);
const hayObjeto=(p,x,y)=>p.evaluate((x,y)=>NV.objetosEn(x,y,x,y).some(o=>o.x===x&&o.y===y),x,y);
const borrador=p=>p.evaluate(()=>localStorage.getItem('nativa.mundo.v1'));

/* ================= 1. modo solitario intacto ================= */
const ctxS=await B0.createBrowserContext(); const pS=await abrir(ctxS,'?dios&solitario'); await dormir(1500);
ok(await pS.evaluate(()=>NV.oficial&&NV.oficial.activo===false&&window.__nws===0),'solitario: el modo oficial está apagado y no se abre ninguna conexión');
const ps=await libre(pS,0);
ok(await pS.evaluate(p=>{ const r=NV.motores.obtener('rocoso').caras.objetos.crear('rocoso:roca'); return NV.editor.hacer({t:'objeto+',x:p.x,y:p.y,objeto:r},'x'); },ps),'solitario: el Modo Dios edita como siempre');
await dormir(900); const bor=await borrador(pS);
ok(!!bor&&JSON.parse(bor).semilla,'solitario: el borrador local se guarda como siempre');
ok(await pS.evaluate(()=>!document.getElementById('ofEstado').textContent&&getComputedStyle(document.getElementById('diosOficial')).display==='none'),'solitario: ni rastro del modo oficial en pantalla');
await pS.reload({waitUntil:'load'}); await dormir(1200);
ok(await hayObjeto(pS,ps.x,ps.y),'solitario: al recargar, el borrador vuelve');
await ctxS.close();

/* ================= 2. dos clientes reales: administrador y jugador ================= */
const ctxA=await B0.createBrowserContext(), ctxB=await B0.createBrowserContext();
/* B ya trae un borrador local con una roca: en modo oficial NO debe verse ni tocarse */
const pA=await abrir(ctxA,'?oficial='+WS+'&dios');
const pB=await abrir(ctxB,'?oficial='+WS+'&dios',bor);
ok(await esperarEstado(pA,e=>e.est==='en-linea'&&e.listo)&&await esperarEstado(pB,e=>e.est==='en-linea'&&e.listo),'los dos clientes se conectan al mundo oficial');
ok((await estado(pA)).rol==='jugador'&&(await estado(pB)).rol==='jugador','sin sesión, los dos son jugadores');
ok(await igualA([pA,pB],S.mundo.huella()),'los dos cargan el mismo mundo que el servidor');
ok(!(await hayObjeto(pB,ps.x,ps.y))&&(await borrador(pB))===bor,'el borrador local de B ni se lee ni se escribe en modo oficial');
ok(await pA.evaluate(()=>getComputedStyle(document.getElementById('diosOficial')).display==='block'&&/solo lectura/.test(document.getElementById('ofLinea').textContent)&&/código [0-9a-f]{8}/.test(document.getElementById('ofLinea').textContent)),'el panel del Modo Dios muestra el estado, la versión y el código del mundo');
ok(await pA.evaluate(()=>/solo lectura/.test(document.getElementById('ofEstado').textContent)&&!/\d/.test(document.getElementById('ofEstado').textContent)),'el estado visible para todos no lleva números ni códigos');

/* un jugador no puede editar */
const antes=S.mundo.seq(), h0=await huella(pB), lb=await libre(pB,0);
ok(await pB.evaluate(p=>{ const r=NV.motores.obtener('rocoso').caras.objetos.crear('rocoso:roca'); return NV.editor.hacer({t:'objeto+',x:p.x,y:p.y,objeto:r},'x'); },lb)===false,'un jugador intenta editar: el Modo Dios no lo deja');
await dormir(400);
ok(S.mundo.seq()===antes&&await huella(pB)===h0&&!(await hayObjeto(pB,lb.x,lb.y)),'y no cambia nada, ni en su pantalla ni en el servidor');

/* una sesión falsa guardada en el navegador no da permisos y se descarta */
await pA.evaluate((w,k)=>{ sessionStorage.setItem(k,JSON.stringify({s:'s1.falsa.falsa',u:w})); localStorage.setItem('nativa.admin.v1','una-contraseña-vieja-guardada-por-una-version-anterior'); },WS,SES);
await pA.reload({waitUntil:'load'});
ok(await esperarEstado(pA,e=>e.est==='en-linea'&&e.listo&&e.rol==='jugador',20000)&&!(await pA.evaluate(k=>sessionStorage.getItem(k),SES)),'una sesión falsa no da permisos: el servidor la rechaza, el navegador la descarta y sigue como jugador');
ok(!(await pA.evaluate(()=>localStorage.getItem('nativa.admin.v1'))),'y la contraseña que una versión anterior dejó guardada en el navegador se borra');
/* una sesión auténtica pero de OTRO servidor no se manda a éste */
const sA=await sesionAdmin(PUERTO,ADMIN);
await pA.evaluate((s,k)=>sessionStorage.setItem(k,JSON.stringify({s,u:'ws://127.0.0.1:9'})),sA,SES); await pA.reload({waitUntil:'load'});
ok(await esperarEstado(pA,e=>e.est==='en-linea'&&e.listo)&&(await estado(pA)).rol==='jugador'&&(await pA.evaluate(()=>window.__bien[0].rol))==='jugador','una sesión emitida para otra dirección no se envía a este servidor: sigue como jugador');
/* la sesión legítima de este servidor da el rol de administrador */
await pA.evaluate((s,w,k)=>sessionStorage.setItem(k,JSON.stringify({s,u:w})),sA,WS,SES);
const pos0=await pA.evaluate(()=>({x:me.x,y:me.y}));
await pA.reload({waitUntil:'load'});
ok(await esperarEstado(pA,e=>e.est==='en-linea'&&e.listo&&e.rol==='admin',20000),'con su sesión, el administrador entra con rol de administrador');
ok(await pA.evaluate(()=>/administrador/.test(document.getElementById('ofLinea').textContent)&&!/solo lectura/.test(document.getElementById('ofLinea').textContent)&&getComputedStyle(document.getElementById('ofCopia')).display!=='none'&&getComputedStyle(document.getElementById('ofSalir')).display!=='none'&&!document.getElementById('ofClave')),'el panel pasa a modo edición (copia, importar, cerrar sesión) y ya no tiene campo de contraseña');
ok(await pB.evaluate(()=>getComputedStyle(document.getElementById('ofCopia')).display==='none'&&getComputedStyle(document.getElementById('ofImportar')).display==='none'&&getComputedStyle(document.getElementById('ofSalir')).display==='none'),'el jugador no ve copia, importar ni cerrar sesión');
const rastro=await pA.evaluate(()=>JSON.stringify({h:location.href,l:Object.assign({},localStorage),html:document.documentElement.outerHTML}));
ok(!rastro.includes(ADMIN)&&!rastro.includes(FIRMA),'ni la contraseña ni la clave de firma están en el enlace, el almacenamiento ni la página');
ok(!(await pA.evaluate(()=>localStorage.getItem('nativa.admin.v1'))),'la contraseña no queda en el dispositivo');

/* el administrador edita; el otro cliente lo ve */
const copia0=await pA.evaluate(async k=>{ const r=await fetch(NV.oficial.http+'/copia',{headers:{Authorization:'Bearer '+k}}); return r.ok?await r.text():null; },sA);
ok(!!copia0&&JSON.parse(copia0).huella===S.mundo.huella(),'desde la página (origen file://) se puede pedir la copia completa con la sesión');
const la=await libre(pA,2);
const seq1=S.mundo.seq();
const r1=await pA.evaluate(p=>{ const r=NV.motores.obtener('rocoso').caras.objetos.crear('rocoso:roca'); return !!NV.editor.hacer({t:'objeto+',x:p.x,y:p.y,objeto:r},'x'); },la);
ok(r1&&await hayObjeto(pA,la.x,la.y),'el administrador edita y lo ve de inmediato');
ok(await igualA([pA,pB],S.mundo.huella())&&S.mundo.seq()===seq1+1&&await hayObjeto(pB,la.x,la.y),'el servidor lo guardó (versión +1) y el jugador lo ve idéntico, sin recargar');
for(const [t,op] of [['suelo',{t:'suelo',x:me0(la,3).x,y:me0(la,3).y,m:'d'}],['altura',{t:'altura',x:la.x+4,y:la.y+4,d:2}]]) await pA.evaluate(o=>NV.editor.hacer(o,null),op);
function me0(l,d){ return {x:l.x+d,y:l.y+d}; }
ok(await igualA([pA,pB],S.mundo.huella())&&S.mundo.seq()===seq1+3,'varias ediciones más: los dos clientes y el servidor siguen idénticos');
/* deshacer también pasa por el servidor */
await pA.evaluate(()=>NV.editor.deshacer()); await dormir(300);
ok(await igualA([pA,pB],S.mundo.huella())&&S.mundo.seq()===seq1+4,'deshacer del administrador también va al servidor y le llega al otro');
const eA=await estado(pA), eB=await estado(pB); ok(eA.div===0&&eB.div===0&&eA.res===0&&eB.res===0,'sin divergencias ni resincronizaciones forzadas');
ok(!!(await borrador(pA))===false||(await borrador(pA))===null,'el administrador tampoco escribió borrador local');

/* ================= 3. reconexión: B se cae, A sigue editando, B vuelve y se pone al día ================= */
await pB.evaluate(()=>NV.oficial.pausar()); await esperarEstado(pB,e=>e.est==='sin-conexion');
const lc=await libre(pA,6), seq2=S.mundo.seq();
for(let i=0;i<3;i++) await pA.evaluate((x,y)=>NV.editor.hacer({t:'suelo',x:x,y:y,m:'g'},null),lc.x+i,lc.y);
await dormir(300);
ok(S.mundo.seq()===seq2+3&&await huella(pB)!==S.mundo.huella(),'mientras B está desconectado, el mundo sigue cambiando');
await pB.evaluate(()=>NV.oficial.reanudar());
ok(await esperarEstado(pB,e=>e.est==='en-linea')&&await igualA([pA,pB],S.mundo.huella()),'B reconecta y recupera exactamente el estado oficial');
const bs=await pB.evaluate(()=>window.__bien);
ok(bs[bs.length-1].modo==='incremental'&&bs[bs.length-1].ops===3,'y lo hace de forma incremental: sólo recibe las 3 ediciones que le faltaban');

/* ================= 4. sin conexión: solo lectura, y nada se guarda para después ================= */
await dormir(2200);   // la réplica se guarda con un pequeño retraso, cuando todo se asentó
const hSinCon=await huella(pA), repl=await pA.evaluate(()=>localStorage.getItem('nativa.oficial.v1'));
ok(!!repl&&JSON.parse(repl).semilla,'cada cliente guarda una réplica del último estado oficial (no es el borrador)');
await S.cerrar();
ok(await esperarEstado(pA,e=>e.est==='sin-conexion')&&await esperarEstado(pB,e=>e.est==='sin-conexion'),'al caer el servidor, los dos clientes lo notan');
const ls=await libre(pA,8);
ok(await pA.evaluate(p=>{ const r=NV.motores.obtener('rocoso').caras.objetos.crear('rocoso:roca'); return NV.editor.hacer({t:'objeto+',x:p.x,y:p.y,objeto:r},'x'); },ls)===false,'sin conexión, ni el administrador puede editar: solo lectura');
ok(await huella(pA)===hSinCon&&await pA.evaluate(()=>NV.oficial.pendientes()===0&&document.getElementById('dios').classList.contains('soloLectura')&&/solo lectura/.test(document.getElementById('ofLinea').textContent)),'no cambió nada, no queda nada pendiente y el panel lo dice');
ok(await pA.evaluate(()=>{ NV.editor.deshacer(); return true; })&&await huella(pA)===hSinCon,'ni siquiera deshacer funciona sin conexión');

/* ================= 5. el servidor se reinicia: los cambios sobreviven y los clientes vuelven solos ================= */
const hGuardada=S.mundo.huella(), sGuardada=S.mundo.seq();
S=await iniciarServidor({dir,puerto:PUERTO,host:'127.0.0.1',adminTokens:[ADMIN],claveSesion:FIRMA,retrasoLoginMs:0});
ok(S.mundo.huella()===hGuardada&&S.mundo.seq()===sGuardada,'el servidor reiniciado tiene todo lo que se había construido (versión y huella)');
ok(await esperarEstado(pA,e=>e.est==='en-linea',25000)&&await esperarEstado(pB,e=>e.est==='en-linea',25000),'los clientes se reconectan solos');
ok(await igualA([pA,pB],hGuardada),'y quedan idénticos al mundo reiniciado');
ok((await estado(pA)).rol==='admin'&&(await estado(pA)).res===0,'A sigue siendo administrador (su sesión sigue vigente: la clave de firma no cambió) sin resincronizaciones forzadas');
const lr=await libre(pA,0); ok(await pA.evaluate(p=>!!NV.editor.hacer({t:'suelo',x:p.x+9,y:p.y+9,m:'d'},null),lr)&&await igualA([pA,pB],S.mundo.huella()),'tras reiniciar, el administrador vuelve a poder editar y B lo ve');

/* ================= 6. restaurar e importar: llegan a todos ================= */
const hV=(await S.mundo.reconstruir(3)).huella;
const W=require('../servidor/node_modules/ws'); const raw=new W(WS); await new Promise(r=>raw.on('open',r));
raw.send(JSON.stringify({t:'hola',v:1,token:'token-de-invitado-de-prueba-000000',sesion:await sesionAdmin(PUERTO,ADMIN)})); await dormir(300);
await pA.evaluate(()=>{ NV.editor.hacer({t:'suelo',x:me.x+20,y:me.y+20,m:'d'},null); });
raw.send(JSON.stringify({t:'restaurar',n:1,version:3})); 
ok(await igualA([pA,pB],hV),'restaurar la versión 3 desde otro administrador: los dos clientes reciben ese mundo');
ok(await pA.evaluate(()=>NV.editor.pilas().deshacer===0),'y lo deshecho que tenía el editor se descarta (ya no vale)'); raw.close();
const pI=S.mundo.seq();
const fcopia=path.join(tmp(),'copia-vieja.json'); fs.writeFileSync(fcopia,copia0);
const [chooser]=await Promise.all([pA.waitForFileChooser(),pA.click('#ofImportar')]); await chooser.accept([fcopia]); await dormir(500);
ok(await pA.evaluate(()=>document.getElementById('ofImportar').textContent==='confirmar importación'),'importar pide confirmación antes de tocar nada');
ok(S.mundo.seq()===pI,'mientras no se confirma, el servidor no cambia');
await pA.click('#ofImportar');
ok(await igualA([pA,pB],JSON.parse(copia0).huella),'al confirmar, la copia vieja reemplaza el mundo oficial y llega a todos');
ok(S.mundo.seq()===pI+1,'y queda como una versión nueva del historial (nada se borra)');
const au=await S.mundo.auditar(); ok(au.ok,'la auditoría del historial completo sigue dando todo en orden ('+au.versiones+' versiones)');
const bajada=await pA.evaluate(async()=>{ let blob=null,nombre=null; const c=URL.createObjectURL; URL.createObjectURL=b=>{ blob=b; return 'blob:x'; }; const k=HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click=function(){ nombre=this.download; }; const r=await NV.oficial.copia(); URL.createObjectURL=c; HTMLAnchorElement.prototype.click=k; return {r,nombre,texto:blob&&await blob.text()}; });
ok(bajada.r&&/^nativa-copia-v\d+\.json$/.test(bajada.nombre)&&JSON.parse(bajada.texto).huella===S.mundo.huella(),'el botón de copia baja la copia completa del mundo oficial');

/* ================= 6b. cerrar sesión ================= */
{ const ctxE=await B0.createBrowserContext(); const sE=await sesionAdmin(PUERTO,ADMIN);
  const pE=await ctxE.newPage(); await pE.setViewport({width:1100,height:700}); pE.on('pageerror',e=>errores.push(e.message));
  await pE.evaluateOnNewDocument((s,w,k)=>{ if(!sessionStorage.getItem(k)&&location.search) sessionStorage.setItem(k,JSON.stringify({s,u:w})); },sE,WS,SES);
  await pE.goto(INDEX+'?oficial='+WS+'&dios',{waitUntil:'load'});
  ok(await esperarEstado(pE,e=>e.est==='en-linea'&&e.listo&&e.rol==='admin',20000),'otra pestaña de administrador entra con su sesión');
  await Promise.all([pE.waitForNavigation({waitUntil:'load'}),pE.click('#ofSalir')]);
  await pE.waitForFunction(()=>window.NV&&NV.portada&&NV.portada.activa,{timeout:10000});
  ok(await pE.evaluate(k=>!sessionStorage.getItem(k)&&!!document.getElementById('ptInvitado'),SES),'«cerrar sesión» vuelve a la portada y borra la sesión de esa pestaña');
  const r=await fetch('http://127.0.0.1:'+PUERTO+'/copia',{headers:{Authorization:'Bearer '+sE}}); ok(r.status===401,'y el servidor revocó esa sesión: ya no sirve para nada');
  await ctxE.close(); }

/* ================= 7. sin conexión desde el principio ================= */
await dormir(2200);   // que la réplica alcance el último estado
const hUlt=S.mundo.huella(); await pA.close(); await S.cerrar();
const t0=Date.now(); const pA2=await abrir(ctxA,'?oficial='+WS); await pA2.waitForFunction(()=>window.NV&&NV.oficial&&NV.oficial.listo,{timeout:15000});
ok(Date.now()-t0<9000,'con el servidor caído, la página arranca igual (a los pocos segundos, no se queda colgada)');
const e2=await estado(pA2); ok(e2.est!=='en-linea'&&await huella(pA2)===hUlt,'abre con la réplica del último mundo oficial, verificada por su huella');
ok(await pA2.evaluate(()=>{ const r=NV.motores.obtener('rocoso').caras.objetos.crear('rocoso:roca'); return NV.editor.hacer({t:'suelo',x:me.x+3,y:me.y+3,m:'d'},null); })===false,'y en solo lectura: sin servidor nadie edita');
const ctxC=await B0.createBrowserContext(); const pC=await abrir(ctxC,'?oficial='+WS); await pC.waitForFunction(()=>window.NV&&NV.oficial&&NV.oficial.listo,{timeout:15000});
ok(await pC.evaluate(()=>NV.mundo.vacio()&&NV.oficial.estado!=='en-linea'),'sin réplica ni servidor: mundo base sin construcciones, solo lectura (nunca un mundo inventado)');

/* ================= 8. orígenes: con la lista puesta, una página de otro origen no entra ================= */
const dir2=tmp(); const S2=await iniciarServidor({dir:dir2,puerto:0,host:'127.0.0.1',adminTokens:[ADMIN],retrasoLoginMs:0,origenes:['https://marcossantiagocenteno-png.github.io']});
const ctxD=await B0.createBrowserContext(); const pD=await abrir(ctxD,'?oficial=ws://127.0.0.1:'+S2.puerto); await pD.waitForFunction(()=>window.NV&&NV.oficial&&NV.oficial.listo,{timeout:15000}); await dormir(1500);
ok(S2.clientes()===0&&(await estado(pD)).est!=='en-linea','servidor con lista de orígenes: una página que no es la permitida no entra');
await S2.cerrar();

ok(errores.length===0,'ningún error de JavaScript en las páginas'+(errores.length?': '+errores.slice(0,3).join(' | '):''));
await B0.close();
console.log(bien+' bien, '+mal+' mal'); process.exit(mal?1:0);
})().catch(e=>{ console.log('ERROR',e.stack); process.exit(1); });

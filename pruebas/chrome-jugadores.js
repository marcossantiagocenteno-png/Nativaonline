// Etapa 5 EN CHROME REAL: varios navegadores independientes (cada uno con su almacenamiento) se ven caminar por el mundo oficial.
//   NODE_PATH=/tmp/pp/node_modules node pruebas/chrome-jugadores.js
let pp; try{ pp=require('puppeteer-core'); }catch(e){ console.log('puppeteer-core no está instalado: prueba omitida'); process.exit(0); }
try{ require('../servidor/node_modules/ws'); }catch(e){ console.log('falta `npm install` dentro de servidor/: prueba omitida'); process.exit(0); }
const fs=require('fs'), os=require('os'), path=require('path');
const {iniciarServidor}=require('../servidor/red.js');
const CHROME=process.env.CHROME||'/usr/bin/google-chrome';
const INDEX='file://'+path.resolve(__dirname,'..','index.html');
const ADMIN='clave-de-admin-de-chrome-0123456789';
let bien=0,mal=0; const ok=(c,t)=>{ if(c) bien++; else { mal++; console.log('MAL:',t); } };
const dormir=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nativa-cj-'));
let S=await iniciarServidor({dir,puerto:0,host:'127.0.0.1',adminTokens:[ADMIN]}); const PUERTO=S.puerto, WS='ws://127.0.0.1:'+PUERTO;
const br=await pp.launch({executablePath:CHROME,headless:'new',args:['--no-sandbox','--allow-file-access-from-files','--window-size=1000,650']});
const errores=[];
async function abrir(ctx,query,admin){
  const p=await ctx.newPage(); await p.setViewport({width:1000,height:650}); p.on('pageerror',e=>errores.push(e.message));
  await p.evaluateOnNewDocument(()=>{ const O=WebSocket; window.__nws=0; window.WebSocket=function(u,q){ window.__nws++; return new O(u,q); }; window.WebSocket.prototype=O.prototype; for(const k of ['CONNECTING','OPEN','CLOSING','CLOSED']) window.WebSocket[k]=O[k]; });
  if(admin) await p.evaluateOnNewDocument(k=>{ try{ localStorage.setItem('nativa.admin.v1',k); }catch(e){} },ADMIN);
  await p.goto(INDEX+query,{waitUntil:'load'}); return p;
}
const listo=(p,n)=>p.waitForFunction(n=>window.NV&&NV.jugadores&&NV.jugadores.yo&&NV.oficial.estado==='en-linea'&&NV.oficial.listo&&NV.personajes.length===n,{timeout:15000},n).then(()=>true,()=>false);
const yo=p=>p.evaluate(()=>({id:NV.jugadores.yo.id,nombre:NV.jugadores.yo.nombre,x:me.x,y:me.y,mirando:facing}));
const otros=p=>p.evaluate(()=>NV.personajes.map(o=>({id:o._remoto,nombre:o.nombre,x:o.x,y:o.y,mirando:o.mirando})).sort((a,b)=>a.id<b.id?-1:1));
const verdad=()=>S.presencia.lista('nadie').sort((a,b)=>a.id<b.id?-1:1);
const coincide=async(ps)=>{ const t=Date.now(); while(Date.now()-t<8000){ const v=verdad(); let bien=true; for(const p of ps){ const m=await yo(p), o=await otros(p); const esperado=v.filter(j=>j.id!==m.id); const sv=S.presencia.get(m.id);
    if(!sv||sv.x!==m.x||sv.y!==m.y||o.length!==esperado.length||!esperado.every((j,i)=>o[i].id===j.id&&o[i].x===j.x&&o[i].y===j.y&&o[i].mirando===j.mirando&&o[i].nombre===j.nombre)){ bien=false; break; } } if(bien) return true; await dormir(150); } return false; };
const caminar=async(p,tecla,ms)=>{ await p.keyboard.down(tecla); await dormir(ms); await p.keyboard.up(tecla); };

/* ===== solitario: no hay jugadores ni conexiones ===== */
const ctxS=await br.createBrowserContext(); const pS=await abrir(ctxS,'');
await dormir(1200); const m0=await pS.evaluate(()=>({x:me.x,y:me.y}));
await caminar(pS,'ArrowRight',700); await dormir(200); const m1=await pS.evaluate(()=>({x:me.x,y:me.y,act:NV.jugadores.activo,n:NV.personajes.length,ws:window.__nws}));
ok(m1.x>m0.x&&m1.act===false&&m1.n===0&&m1.ws===0,'modo solitario: se camina como siempre, no hay jugadores ni conexiones');
await ctxS.close();

/* ===== tres navegadores independientes ===== */
const cA=await br.createBrowserContext(), cB=await br.createBrowserContext(), cC=await br.createBrowserContext();
const pA=await abrir(cA,'?oficial='+WS,true), pB=await abrir(cB,'?oficial='+WS), pC=await abrir(cC,'?oficial='+WS);
ok(await listo(pA,2)&&await listo(pB,2)&&await listo(pC,2),'tres navegadores independientes entran y cada uno ve a los otros dos');
const ya=await yo(pA), yb=await yo(pB), yc=await yo(pC);
ok(new Set([ya.id,yb.id,yc.id]).size===3&&new Set([ya.nombre,yb.nombre,yc.nombre]).size===3&&[ya,yb,yc].every(j=>/^Viajero-/.test(j.nombre)),'cada uno tiene su personaje temporal, con id y nombre distintos');
ok(new Set([ya,yb,yc].map(j=>j.x+','+j.y)).size===3,'nacieron en tres casillas distintas');
ok(await coincide([pA,pB,pC]),'las tres pantallas muestran exactamente las posiciones que tiene el servidor');
ok(await pA.evaluate(()=>NV.oficial.rol)==='admin'&&await pB.evaluate(()=>NV.oficial.rol)==='jugador','A es administrador (clave guardada en su dispositivo) y B, invitado');
ok(await pB.evaluate(()=>localStorage.getItem('nativa.guardado.v1'))===null,'el invitado no guarda progreso individual');

/* ===== caminar de verdad (teclado), todos a la vez ===== */
const muestras=[]; const muestreo=(async()=>{ for(let i=0;i<14;i++){ const o=await pA.evaluate(id=>{ const p=NV.personajes.find(q=>q._remoto===id); const q=NV.posPersonaje(p,Date.now()); return {x:q.x,y:q.y}; },yb.id); muestras.push(o); await dormir(100); } })();
await Promise.all([caminar(pA,'ArrowLeft',1300),caminar(pB,'ArrowRight',1300),caminar(pC,'ArrowDown',1300),muestreo]); await dormir(500);
const ya2=await yo(pA), yb2=await yo(pB), yc2=await yo(pC);
ok(ya2.x<ya.x&&yb2.x>yb.x&&yc2.y>yc.y,'los tres caminan a la vez, cada uno hacia su lado');
ok(await coincide([pA,pB,pC]),'al terminar, las tres pantallas siguen coincidiendo con el servidor');
const oA=await otros(pA), oB=await otros(pB);
ok(oA.find(o=>o.id===yb2.id).mirando==='este'&&oB.find(o=>o.id===ya2.id).mirando==='oeste'&&(await otros(pA)).find(o=>o.id===yc2.id).mirando==='sur','cada uno ve hacia dónde mira el otro: este, oeste y sur');
ok(muestras.some(m=>Math.abs(m.x-Math.round(m.x))>0.05),'el paso ajeno se ve entre casillas (interpolado por el motor de personajes), no a saltos');
const ePasos=await pA.evaluate(()=>NV.jugadores.yo&&NV.oficial.resincronizaciones); ok(ePasos===0,'sin resincronizaciones forzadas');

/* ===== lo que el servidor no acepta ===== */
const antes=await yo(pB), sv0=S.presencia.get(antes.id);
await pA.evaluate(p=>NV.editor.hacer({t:'suelo',x:p.x+1,y:p.y,m:'P'},null),antes);
await dormir(500);
await pB.evaluate(()=>{ me.x+=1; NV.jugadores.alPaso(); });                     // un cliente tramposo: se anticipa un paso al agua honda
await dormir(500);
const des=await yo(pB); ok(des.x===antes.x&&des.y===antes.y&&S.presencia.get(antes.id).x===antes.x,'un paso hacia agua honda anticipado por el cliente: el servidor lo corrige y el personaje vuelve a su sitio');
await pB.evaluate(()=>{ for(let i=0;i<14;i++){ me.x-=1; NV.jugadores.alPaso(); } });                   // 14 metros en un instante
await dormir(700);
const rap=await yo(pB), svr=S.presencia.get(antes.id);
ok(rap.x===svr.x&&rap.y===svr.y&&antes.x-rap.x<=5,'14 metros en un instante: el servidor sólo deja pasar la ráfaga permitida y corrige el resto ('+(antes.x-rap.x)+' m)');
ok(await coincide([pA,pB,pC]),'y las tres pantallas coinciden con el servidor');
await pB.evaluate(()=>{ me.x+=40; NV.jugadores.alPaso(); }); await dormir(500);
const tel=await yo(pB); ok(tel.x===svr.x&&tel.y===svr.y,'un teletransporte de 40 metros no vale: el servidor lo manda de vuelta a donde estaba');
await dormir(2100);

/* ===== el administrador construye sobre un jugador ===== */
await coincide([pA,pB,pC]); const yb3=await yo(pB);
await pA.evaluate(p=>{ const r=NV.motores.obtener('rocoso').caras.objetos.crear('rocoso:roca'); return NV.editor.hacer({t:'objeto+',x:p.x,y:p.y,objeto:r},null); },yb3);
await dormir(900);
const yb4=await yo(pB); ok((yb4.x!==yb3.x||yb4.y!==yb3.y)&&Math.max(Math.abs(yb4.x-yb3.x),Math.abs(yb4.y-yb3.y))<=3,'el administrador pone una roca encima de B: B es movido a una casilla libre cercana');
ok(await pB.evaluate(p=>!NV.solidoEn(me.x,me.y)&&NV.objetosEn(p.x,p.y,p.x,p.y).some(o=>o.x===p.x&&o.y===p.y),yb3),'y la roca se ve en la pantalla de B (la edición del Modo Dios se sigue sincronizando)');
ok(await coincide([pA,pB,pC]),'A y C ven a B en su lugar nuevo, igual que el servidor');
ok(await pB.evaluate(()=>NV.oficial.divergencias===0),'sin divergencias del mundo');

/* ===== desconexiones ===== */
const idC=(await yo(pC)).id, nombreC=(await yo(pC)).nombre; await pC.close();
ok(await listo(pA,1)&&await listo(pB,1),'C cierra su navegador: desaparece de las pantallas de A y de B');
ok(!S.presencia.get(idC)&&S.presencia.cantidad()===2,'y el servidor ya no lo tiene');
const pC2=await abrir(cC,'?oficial='+WS); ok(await listo(pC2,2)&&await listo(pA,2),'C vuelve a entrar y todos se ven otra vez');
const yc3=await yo(pC2); ok(yc3.id!==idC,'C recibe un id nuevo al reconectar'+(yc3.nombre===nombreC?' (el nombre coincidió por azar)':' y un nombre nuevo'));
ok(await coincide([pA,pB,pC2]),'las tres pantallas siguen coincidiendo con el servidor');
/* cortar sólo la conexión de B (como una caída de red) y volverla a abrir */
const idB=(await yo(pB)).id; await pB.evaluate(()=>NV.oficial.pausar());
ok(await listo(pA,1),'B pierde la conexión: desaparece para los demás'); ok(await pB.evaluate(()=>NV.personajes.length===0&&NV.oficial.estado!=='en-linea'),'y B deja de ver a los demás (sin fantasmas)');
await pB.evaluate(()=>NV.oficial.reanudar()); ok(await listo(pB,2)&&await listo(pA,2),'B reconecta y vuelve a verse con todos');
ok((await yo(pB)).id!==idB&&await coincide([pA,pB,pC2]),'con personaje nuevo y todo coincidiendo con el servidor');

/* ===== el servidor se cae y vuelve ===== */
await S.cerrar();
await pA.waitForFunction(()=>NV.oficial.estado!=='en-linea',{timeout:10000});
ok(await pA.evaluate(()=>NV.personajes.length===0),'sin servidor, no quedan jugadores fantasma en la pantalla');
S=await iniciarServidor({dir,puerto:PUERTO,host:'127.0.0.1',adminTokens:[ADMIN]});
ok(await listo(pA,2)&&await listo(pB,2)&&await listo(pC2,2),'al volver el servidor, los tres se reconectan solos y se ven');
ok(await coincide([pA,pB,pC2])&&S.presencia.cantidad()===3,'y todo coincide, con tres jugadores (los viejos ya no existen)');
ok(errores.length===0,'ningún error de JavaScript'+(errores.length?': '+errores.slice(0,3).join(' | '):''));
await br.close(); await S.cerrar();
console.log(bien+' bien, '+mal+' mal'); process.exit(mal?1:0);
})().catch(e=>{ console.log('ERROR',e.stack); process.exit(1); });

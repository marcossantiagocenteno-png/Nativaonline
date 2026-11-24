#!/usr/bin/env node
/* Nativa Online — comprobaciones DESPUÉS de desplegar (o contra un servidor local en pruebas). Sólo mira desde fuera, no cambia nada.
     node verificar-despliegue.js --url https://NOMBRE.duckdns.org --origen https://marcossantiagocenteno-png.github.io [--ip IP_PUBLICA_VM] [--json]
     node verificar-despliegue.js --local --url http://127.0.0.1:8787 --origen https://… [--sin-origen-prohibido]     (pruebas: sin TLS)
   Comprueba: /salud (versión, huella, administrador configurado) · certificado (vigente, nombre correcto, días que le quedan) · http→https ·
   WSS con el origen permitido abre · WSS con un origen ajeno y SIN origen se rechazan · HTTP con origen ajeno se rechaza ·
   el puerto del juego (8787) NO se alcanza desde fuera (con --ip).
   Lo que NO comprueba: la condición 2 del proxy (X-Forwarded-For): para eso está probar-proxy.js. Código de salida: 0 todo bien · 1 algo falla. */
'use strict';
const http=require('http'), https=require('https'), tls=require('tls'), net=require('net'), path=require('path');
let WebSocket; try{ WebSocket=require(path.join(__dirname,'..','..','servidor','node_modules','ws')); }catch(e){ WebSocket=null; }
const a=process.argv.slice(2), val=k=>{ const i=a.indexOf(k); return i>=0?a[i+1]:undefined; }, tiene=k=>a.includes(k);

function pedir(url,{origen,metodo}={}){
  return new Promise(ok=>{ const u=new URL(url), mod=u.protocol==='https:'?https:http;
    const q=mod.request(u,{method:metodo||'GET',headers:origen?{Origin:origen}:{},timeout:15000},res=>{ let t=''; res.on('data',d=>t+=d); res.on('end',()=>ok({estado:res.statusCode,cabeceras:res.headers,cuerpo:t})); });
    q.on('error',e=>ok({error:e.code||e.message})); q.on('timeout',()=>{ q.destroy(); ok({error:'TIEMPO'}); }); q.end(); });
}
function ws(url,origen){
  return new Promise(ok=>{ if(!WebSocket) return ok({error:'no está instalado ws (npm ci --omit=dev en servidor/)'});
    const c=new WebSocket(url,origen?{origin:origen,handshakeTimeout:15000}:{handshakeTimeout:15000}); let fin=false; const f=r=>{ if(!fin){ fin=true; try{ c.terminate(); }catch(e){} ok(r); } };
    c.on('open',()=>f({abierto:true})); c.on('unexpected-response',(rq,res)=>f({abierto:false,estado:res.statusCode})); c.on('error',e=>f({abierto:false,error:e.message})); });
}
const tcp=(host,puerto,ms)=>new Promise(ok=>{ const s=net.connect({host,port:puerto}); const t=setTimeout(()=>{ s.destroy(); ok('TIEMPO'); },ms); s.on('connect',()=>{ clearTimeout(t); s.destroy(); ok('CONECTA'); }); s.on('error',e=>{ clearTimeout(t); ok(e.code||'ERROR'); }); });
const cert=(host,puerto)=>new Promise(ok=>{ const s=tls.connect({host,port:puerto||443,servername:host,timeout:15000},()=>{ const c=s.getPeerCertificate(); const r={autorizado:s.authorized,error:s.authorizationError||null,vence:c&&c.valid_to?new Date(c.valid_to):null,sujeto:c&&c.subject?c.subject.CN:null}; s.end(); ok(r); }); s.on('error',e=>ok({error:e.code||e.message})); s.on('timeout',()=>{ s.destroy(); ok({error:'TIEMPO'}); }); });

async function verificar({url,origen,ip,local,puertoJuego}){
  const res=[]; const R=(ok,que,detalle)=>res.push({ok,que,detalle:detalle||''}); const NA=(que,detalle)=>res.push({ok:null,que,detalle:detalle||'no aplica'});
  const u=new URL(url), base=u.origin, wsBase=base.replace(/^http/,'ws'), seguro=u.protocol==='https:';
  const falso='https://pagina-ajena.example';
  /* /salud */
  const s=await pedir(base+'/salud'); let j=null; try{ j=JSON.parse(s.cuerpo); }catch(e){}
  R(s.estado===200&&j&&j.ok===true,'GET /salud responde bien',s.error||('estado '+s.estado));
  if(j){ R(typeof j.version==='number'||typeof j.version==='string','/salud informa la versión del protocolo',String(j.version)); R(typeof j.huella==='string'&&j.huella.length===64,'/salud trae la huella del mundo (64 caracteres)'); R(j.admin===true,'hay un administrador configurado (admin: true)',String(j.admin)); R(Number.isInteger(j.seq),'/salud trae la versión del mundo',String(j.seq)); }
  /* TLS */
  if(seguro&&!local){
    const c=await cert(u.hostname,+u.port||443);
    if(c.error) R(false,'el certificado HTTPS se puede comprobar',c.error);
    else{ R(c.autorizado===true,'el certificado es válido y de confianza para '+u.hostname,c.error||''); const d=c.vence?Math.floor((c.vence-Date.now())/864e5):-1; R(d>=14,'al certificado le quedan al menos 14 días',d+' días'); }
    const h=await pedir('http://'+u.hostname+(u.port&&u.port!=='443'?':80':'')+'/',{}); R(h.estado>=300&&h.estado<400&&/^https:/.test(String(h.cabeceras&&h.cabeceras.location)),'http:// redirige a https://',h.error||('estado '+h.estado+' → '+(h.cabeceras&&h.cabeceras.location)));
  } else NA('certificado y redirección a HTTPS','prueba local sin TLS');
  /* orígenes: HTTP */
  const hx=await pedir(base+'/salud',{origen:falso}); R(hx.estado===403,'HTTP con un origen ajeno se rechaza (403)',hx.error||('estado '+hx.estado));
  const hp=await pedir(base+'/salud',{origen}); R(hp.estado===200&&hp.cabeceras['access-control-allow-origin']===origen,'HTTP con el origen permitido responde y lo declara (CORS)',hp.error||('estado '+hp.estado+' · allow-origin '+(hp.cabeceras&&hp.cabeceras['access-control-allow-origin'])));
  /* WebSocket */
  const w1=await ws(wsBase+'/',origen); R(w1.abierto===true,(seguro?'WSS':'WS')+' con el origen permitido abre',w1.error||('estado '+w1.estado));
  const w2=await ws(wsBase+'/',falso); R(w2.abierto===false&&(w2.estado===403||!!w2.error),'WebSocket con un origen ajeno se rechaza',w2.abierto?'¡abrió!':String(w2.estado||w2.error));
  if(tiene('--sin-origen-prohibido')) NA('WebSocket sin origen se rechaza','servidor local de desarrollo: acepta conexiones sin origen');
  else { const w3=await ws(wsBase+'/',null); R(w3.abierto===false,'WebSocket SIN origen se rechaza (producción)',w3.abierto?'¡abrió!':String(w3.estado||w3.error)); }
  /* puerto del juego desde fuera */
  if(ip){ const r=await tcp(ip,puertoJuego||8787,6000); R(r!=='CONECTA','el puerto '+(puertoJuego||8787)+' del juego NO se alcanza desde fuera ('+ip+')',r); } else NA('puerto del juego cerrado desde fuera','falta --ip (la dirección pública de la VM)');
  return {ok:res.every(x=>x.ok!==false),completo:res.every(x=>x.ok!==null),res};
}
module.exports={verificar,pedir,ws,tcp};
if(require.main===module){
  const url=val('--url'); if(!url){ console.error('uso: verificar-despliegue.js --url https://dominio --origen https://origen-de-la-pagina [--ip IP] [--local] [--json]'); process.exit(2); }
  verificar({url,origen:val('--origen'),ip:val('--ip'),local:tiene('--local'),puertoJuego:+val('--puerto-juego')||8787}).then(r=>{
    if(tiene('--json')) console.log(JSON.stringify(r,null,1)); else{ for(const x of r.res) console.log((x.ok===true?'  bien     ':x.ok===false?'  FALLA    ':'  no aplica ')+x.que+(x.detalle?'  — '+x.detalle:'')); console.log(r.ok?'\nTodo lo comprobado está bien.'+(r.completo?'':' (hay puntos «no aplica»)'):'\nHAY FALLAS.'); }
    process.exit(r.ok?0:1);
  });
}

// Etapa 6 (cierre): A QUÉ SERVIDOR se conecta el juego. Sin NV.SERVIDOR_OFICIAL (pendiente) una página pública no se conecta a nada,
// y ningún parámetro de la URL puede mandar a una página pública hacia un servidor ajeno.
const fs=require('fs'), path=require('path');
const NV=require('./cargar.js')();
let bien=0,mal=0; const ok=(c,t)=>{ if(c) bien++; else { mal++; console.log('MAL:',t); } };
const E=(pedido,proto,host,oficial)=>{ const v=NV.SERVIDOR_OFICIAL; NV.SERVIDOR_OFICIAL=oficial||''; try{ return NV.destino.elegir(pedido,{protocol:proto,hostname:host}); } finally{ NV.SERVIDOR_OFICIAL=v; } };
const PAGES='marcossantiagocenteno-png.github.io';

/* ---- pendiente ---- */
ok(NV.SERVIDOR_OFICIAL==='wss://marcos.taild7968f.ts.net','NV.SERVIDOR_OFICIAL es la dirección del servidor oficial (Tailscale Funnel) y es wss://');
const fuente=fs.readFileSync(path.join(__dirname,'../src/juego/destino.js'),'utf8');
ok(/NV\.SERVIDOR_OFICIAL===undefined\)\s*NV\.SERVIDOR_OFICIAL='wss:\/\/marcos\.taild7968f\.ts\.net'/.test(fuente),'y la dirección está escrita una sola vez, en destino.js');
{ const r=E('','https:',PAGES); ok(r.pendiente&&r.url===''&&!r.valida&&r.origen==='pendiente','página publicada (https), sin configurar: pendiente, sin dirección'); }
{ const r=E('','http:','ejemplo.com'); ok(r.pendiente&&r.url==='','una página pública sin https tampoco inventa una dirección'); }
{ const r=E('','https:','127.0.0.1.evil.example'); ok(r.pendiente,'un nombre que sólo parece local no cuenta como local'); }

/* ---- páginas públicas: los parámetros no sirven ---- */
for(const pedido of ['wss://evil.example:9999','ws://evil.example','wss://'+PAGES,'ws://127.0.0.1:8787','wss://localhost:8787','wss://10.0.0.5','ws://192.168.1.20:8787','wss://evil.example@127.0.0.1']){
  const r=E(pedido,'https:',PAGES);
  ok(r.pendiente&&r.url===''&&r.ignorado&&!r.personalizado,'https público: «'+pedido+'» se ignora y no hay conexión');
  const q=E(pedido,'http:','ejemplo.com'); ok(q.pendiente&&q.ignorado&&!q.personalizado,'http público: «'+pedido+'» se ignora');
}
{ const r=E('wss://evil.example','https:',PAGES,'wss://oficial.ejemplo'); ok(r.url==='wss://oficial.ejemplo'&&r.origen==='oficial'&&r.ignorado,'con servidor oficial configurado, el pedido ajeno se ignora y se usa el oficial'); }
{ const r=E('','https:',PAGES,'ws://oficial.ejemplo'); ok(r.url==='ws://oficial.ejemplo'&&!r.valida,'una página https no acepta un oficial ws:// sin cifrar (el navegador lo bloquearía)'); }
{ const r=E('','https:',PAGES,'wss://oficial.ejemplo'); ok(r.valida&&!r.pendiente&&!r.personalizado,'con oficial wss:// configurado, la página publicada se conecta a él'); }

/* ---- entornos de prueba ---- */
{ const r=E('','file:',''); ok(r.url==='ws://localhost:8787'&&r.origen==='local'&&r.valida,'archivo local sin nada: el servidor de este equipo'); }
{ const r=E('ws://192.168.1.20:8787','file:',''); ok(r.personalizado&&r.url==='ws://192.168.1.20:8787','archivo local + servidor de red privada: se acepta'); }
{ const r=E('wss://evil.example','file:',''); ok(!r.personalizado&&r.ignorado&&r.url==='ws://localhost:8787','archivo local + servidor público: se ignora'); }
{ const r=E('','http:','localhost'); ok(r.url==='ws://localhost:8787'&&r.origen==='local','localhost sin nada: su propio puerto 8787'); }
{ const r=E('ws://10.1.2.3:9000','http:','localhost'); ok(r.personalizado&&r.url==='ws://10.1.2.3:9000','localhost + servidor privado: se acepta'); }
{ const r=E('','http:','192.168.0.7'); ok(r.url==='ws://192.168.0.7:8787','página en red privada: su propio servidor'); }
{ const r=E('','http:','::1'); ok(r.url==='ws://[::1]:8787'&&r.valida,'IPv6 local: dirección con corchetes'); }
{ const r=E('http://localhost:8787/','http:','localhost'); ok(r.url==='ws://localhost:8787'&&r.http==='http://localhost:8787','http:// se traduce a ws:// y se quita la barra final'); }
{ const r=E('ws://evil.example@127.0.0.1:1','http:','localhost'); ok(!r.valida||!r.personalizado,'una dirección con usuario@ no se acepta como local'); }
{ const r=E('','https:','localhost'); ok(r.url==='wss://localhost:8787'&&r.valida,'https en localhost: wss'); }

/* ---- qué es «local» ---- */
const L=NV.destino.esLocal;
ok(['localhost','LOCALHOST','a.localhost','127.0.0.1','127.9.9.9','10.0.0.1','172.16.0.1','172.31.255.255','192.168.1.1','169.254.1.1','::1','[::1]','fd12:3456::1','fc00::1','fe80::1'].every(L),'se reconocen como locales: localhost, 127/8, 10/8, 172.16/12, 192.168/16, 169.254/16, ::1, fc00::/7, fe80::/10');
ok(!['','evil.example','localhost.evil.example','172.15.0.1','172.32.0.1','192.169.1.1','11.0.0.1','8.8.8.8','256.0.0.1','10.0.0','2001:db8::1','2606:4700::1','mipc','mipc.local','0.0.0.0'].some(L),'no son locales: nombres, públicas, fuera de rango (incl. 172.15/172.32), 0.0.0.0, .local');

/* ---- los dos módulos usan la misma regla ---- */
for(const f of ['portada','oficial']){ const s=fs.readFileSync(path.join(__dirname,'../src/juego/'+f+'.js'),'utf8'); ok(/NV\.destino\.elegir\(/.test(s)&&!/ws:\/\/'\+\(location\.hostname/.test(s),f+'.js decide el servidor con NV.destino.elegir y ya no arma ws://<hostname>:8787 por su cuenta'); }
const mods=new Function('window',fs.readFileSync(path.join(__dirname,'../src/modulos.js'),'utf8')+';return window;')({});
ok(mods.NV_MODULOS.indexOf('juego/destino')>=0&&mods.NV_MODULOS.indexOf('juego/destino')<mods.NV_MODULOS.indexOf('juego/portada')&&mods.NV_MODULOS_SOLO_CLIENTE.includes('juego/destino'),'destino.js se carga antes de la portada y está en la lista de sólo cliente');
console.log(bien+' bien, '+mal+' mal'); process.exit(mal?1:0);

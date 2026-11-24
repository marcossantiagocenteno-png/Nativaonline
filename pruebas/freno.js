// Etapa 6 (cierre): el freno de intentos cuenta por BLOQUE de red (IPv4 completa, IPv6 por /64) y sigue ignorando X-Forwarded-For
// salvo que se pida confiar en el proxy (NATIVA_CONFIAR_PROXY=1, que nunca se activa por defecto).
let WebSocket; try{ WebSocket=require('../servidor/node_modules/ws'); }catch(e){ console.log('OMITIDA: falta `npm install` dentro de servidor/'); process.exit(0); }
const fs=require('fs'), os=require('os'), path=require('path'), http=require('http'), crypto=require('crypto');
const {iniciarServidor}=require('../servidor/red.js');
const {bloqueDeRed,crearFreno}=require('../servidor/sesiones.js');
let bien=0,mal=0; const ok=(c,t)=>{ if(c) bien++; else { mal++; console.log('MAL:',t); } };
const alea=n=>crypto.randomBytes(n).toString('base64url');
const CLAVE=alea(18), FIRMA=alea(40);

/* ---- el bloque ---- */
const b=bloqueDeRed;
ok(b('1.2.3.4')==='1.2.3.4'&&b('1.2.3.5')!=='1.2.3.4','IPv4: cada dirección cuenta aparte');
ok(b('::ffff:1.2.3.4')==='1.2.3.4'&&b('::FFFF:10.0.0.9')==='10.0.0.9','una IPv4 escrita como IPv6 cuenta como la IPv4');
ok(b('2001:db8:1:2:aaaa:bbbb:cccc:dddd')===b('2001:db8:1:2::9')&&b('2001:DB8:1:2:0:0:0:1')===b('2001:db8:1:2:ffff:ffff:ffff:ffff'),'IPv6: todo el /64 es un solo bloque, se escriba como se escriba');
ok(b('2001:db8:1:2::1')!==b('2001:db8:1:3::1')&&b('2001:db8:1:2::1')!==b('2001:db8:2:2::1'),'IPv6: otro /64 (aunque sea vecino) es otro bloque');
ok(b('fe80::1%eth0')===b('fe80::2')&&b('::1')===b('::2'),'IPv6: el identificador de zona se ignora; ::1 es un bloque');
ok(b('2001:db8::')==='2001:0db8:0000:0000::/64','IPv6: «::» al final se expande bien');
ok(b('?')==='?'&&b(undefined)==='?'&&b('x'.repeat(500)).length<=64,'lo que no es una dirección se cuenta tal cual, sin crecer sin límite');

/* ---- el freno con la rotación típica de un atacante IPv6 ---- */
{ let t=1000; const f=crearFreno({maxFallos:5,ventanaMs:60000,ahora:()=>t});
  const ataque=Array.from({length:50},(_,i)=>'2001:db8:aaaa:1:'+(i+1).toString(16)+':'+(i*7).toString(16)+'::'+(i+1).toString(16));
  let pasaron=0; for(const ip of ataque){ const k=bloqueDeRed(ip); if(f.consultar(k).ok){ pasaron++; f.fallo(k); } }
  ok(pasaron===5,'50 direcciones distintas del mismo /64 no pasan de 5 intentos ('+pasaron+')');
  ok(f.consultar(bloqueDeRed('2001:db8:bbbb:1::1')).ok,'otro /64 no queda castigado');
  t+=61000; ok(f.consultar(bloqueDeRed(ataque[3])).ok,'pasada la ventana se vuelve a poder'); }

/* ---- el servidor: X-Forwarded-For con y sin confianza ---- */
const pedir=(puerto,cab)=>new Promise(r=>{ const cuerpo=JSON.stringify({clave:alea(20)});
  const q=http.request({host:'127.0.0.1',port:puerto,path:'/entrar',method:'POST',headers:Object.assign({'Content-Type':'application/json','Content-Length':Buffer.byteLength(cuerpo)},cab||{})},res=>{ res.resume(); res.on('end',()=>r(res.statusCode)); });
  q.on('error',()=>r(0)); q.end(cuerpo); });
const arrancar=o=>iniciarServidor(Object.assign({dir:fs.mkdtempSync(path.join(os.tmpdir(),'nativa-fr-')),puerto:0,host:'127.0.0.1',adminTokens:[CLAVE],claveSesion:FIRMA,retrasoLoginMs:0,maxIntentos:3},o||{}));
(async()=>{
  /* por defecto NO se confía: la cabecera no cambia nada */
  { const S=await arrancar(); const r=[];
    for(let i=0;i<6;i++) r.push(await pedir(S.puerto,{'X-Forwarded-For':'2001:db8:'+i+'::'+i}));
    ok(r.slice(0,3).every(x=>x===401)&&r.slice(3).every(x=>x===429),'sin NATIVA_CONFIAR_PROXY, rotar X-Forwarded-For (IPv6) no esquiva el freno: '+r.join(','));
    await S.cerrar(); }
  /* con confianza: se lee el ÚLTIMO elemento; lo que el visitante escriba antes no cuenta */
  { const S=await arrancar({confiarProxy:true}); const r=[];
    for(let i=0;i<6;i++) r.push(await pedir(S.puerto,{'X-Forwarded-For':'203.0.113.'+(i+1)+', 2001:db8:77:5:'+(i+1)+':'+(i+9)+'::'+(i+3)}));
    ok(r.slice(0,3).every(x=>x===401)&&r.slice(3).every(x=>x===429),'con proxy de confianza, 6 direcciones del mismo /64 (y falsas al principio de la cabecera) comparten tres intentos: '+r.join(','));
    ok(await pedir(S.puerto,{'X-Forwarded-For':'2001:db8:78:5::1'})===401,'otro /64 no queda castigado');
    ok(await pedir(S.puerto,{'X-Forwarded-For':'::ffff:198.51.100.4'})===401&&await pedir(S.puerto,{'X-Forwarded-For':'198.51.100.4'})===401&&await pedir(S.puerto,{'X-Forwarded-For':'198.51.100.4'})===401&&await pedir(S.puerto,{'X-Forwarded-For':'::ffff:198.51.100.4'})===429,'una IPv4 y su forma ::ffff: comparten la cuenta');
    await S.cerrar(); }
  /* la opción nunca se activa sola */
  const ini=fs.readFileSync(path.join(__dirname,'../servidor/iniciar.js'),'utf8');
  ok(/confiarProxy:process\.env\.NATIVA_CONFIAR_PROXY==='1'/.test(ini),'iniciar.js sólo la activa con NATIVA_CONFIAR_PROXY=1 exacto');
  ok(!['red.js','iniciar.js','identidad.js','sesiones.js'].some(f=>/confiarProxy\s*[:=]\s*(true|1)\b|op\.confiarProxy\s*=\s*true/.test(fs.readFileSync(path.join(__dirname,'../servidor/'+f),'utf8'))),'ningún archivo del servidor la fija a verdadero');
  console.log(bien+' bien, '+mal+' mal'); process.exit(mal?1:0);
})().catch(e=>{ console.log('ERROR',e.stack); process.exit(1); });

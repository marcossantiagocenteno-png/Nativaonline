// Etapa 6: el ACCESO. Quién puede ser administrador y quién no: contraseña verificada sólo en el servidor, sesiones firmadas con clave propia,
// token crudo sin poder, sesiones falsificadas / alteradas / vencidas / revocadas / de otra contraseña, freno de intentos y registros limpios.
let WebSocket; try{ WebSocket=require('../servidor/node_modules/ws'); }catch(e){ console.log('OMITIDA: falta `npm install` dentro de servidor/'); process.exit(0); }
const fs=require('fs'), os=require('os'), path=require('path'), http=require('http'), crypto=require('crypto');
const {iniciarServidor}=require('../servidor/red.js');
const {crearSesiones}=require('../servidor/sesiones.js');
let bien=0,mal=0; const ok=(c,t)=>{ if(c) bien++; else { mal++; console.log('MAL:',t); } };
const tmp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'nativa-acc-'));
const dormir=ms=>new Promise(r=>setTimeout(r,ms));
/* secretos de prueba: se fabrican en cada corrida, no son ninguna contraseña real */
const alea=n=>crypto.randomBytes(n).toString('base64url');
const CLAVE=alea(18), CLAVE2=alea(18), FIRMA=alea(40), FIRMA2=alea(40), INV='token-de-invitado-de-prueba-000001';
const registro=[];

function pedir(puerto,metodo,ruta,{bearer,cuerpo,cabeceras}={}){
  return new Promise(r=>{ const h=Object.assign({},cabeceras||{}); if(bearer) h.Authorization='Bearer '+bearer;
    let b=null; if(cuerpo!==undefined){ b=typeof cuerpo==='string'?cuerpo:JSON.stringify(cuerpo); h['Content-Type']='application/json'; h['Content-Length']=Buffer.byteLength(b); }
    const q=http.request({host:'127.0.0.1',port:puerto,path:ruta,method:metodo,headers:h},res=>{ const t=[]; res.on('data',x=>t.push(x)); res.on('end',()=>{ const s=Buffer.concat(t).toString(); let j=null; try{ j=JSON.parse(s); }catch(e){} r({estado:res.statusCode,json:j,texto:s,cabeceras:res.headers}); }); });
    q.on('error',e=>r({error:e.message})); if(b) q.write(b); q.end(); });
}
const entrar=(puerto,clave,cab)=>pedir(puerto,'POST','/entrar',{cuerpo:{clave},cabeceras:cab});
/* un cliente mínimo: dice hola y espera la respuesta */
function hola(puerto,datos){
  return new Promise((res,rej)=>{
    const ws=new WebSocket('ws://127.0.0.1:'+puerto); const C={ws,msgs:[],cerrado:null};
    ws.on('message',d=>{ C.msgs.push(JSON.parse(d.toString())); });
    ws.on('close',c=>{ C.cerrado=c; }); ws.on('error',e=>rej(e));
    ws.on('open',()=>{ C.enviar=m=>ws.send(JSON.stringify(m)); C.enviar(Object.assign({t:'hola',v:1},datos)); res(C); });
  });
}
const esperar=async(f,ms)=>{ const t=Date.now(); while(Date.now()-t<(ms||2500)){ if(f()) return true; await dormir(10); } return f(); };
const rolDe=C=>{ const b=C.msgs.find(m=>m.t==='bienvenida'); return b?b.rol:null; };
const codigoDe=C=>{ const e=C.msgs.find(m=>m.t==='error'); return e?e.codigo:null; };
const arrancar=(o)=>iniciarServidor(Object.assign({dir:tmp(),puerto:0,host:'127.0.0.1',adminTokens:[CLAVE],claveSesion:FIRMA,retrasoLoginMs:0,log:t=>registro.push(t)},o||{}));
const b64j=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const partes=s=>s.split('.');

(async()=>{
/* ---- la clave de administrador no está configurada: se dice claro y no se simula nada ---- */
{ const S=await arrancar({adminTokens:[]});
  const sa=await pedir(S.puerto,'GET','/salud'); ok(sa.json.admin===false,'/salud avisa (sólo sí o no) que no hay clave de administrador configurada');
  const r=await entrar(S.puerto,CLAVE); ok(r.estado===503&&r.json.error==='sin-clave'&&/NATIVA_ADMIN_TOKEN/.test(r.json.motivo)&&!r.json.sesion,'sin clave configurada, /entrar responde 503 y dice qué variable falta; no inventa ninguna sesión');
  await S.cerrar(); }

const S=await arrancar(); const P=S.puerto;
ok((await pedir(P,'GET','/salud')).json.admin===true,'/salud avisa que sí hay clave configurada');
ok(!JSON.stringify((await pedir(P,'GET','/salud')).json).includes(CLAVE),'/salud no revela nada de la clave');

/* ---- la contraseña se comprueba en el servidor ---- */
const mala=await entrar(P,'una-clave-incorrecta-pero-larga-123'); ok(mala.estado===401&&mala.json.error==='clave-incorrecta'&&!mala.json.sesion,'una contraseña incorrecta se rechaza con 401');
const corta=await entrar(P,'corta'); ok(corta.estado===401,'una contraseña demasiado corta también (no hay atajos por longitud)');
const rara=await pedir(P,'POST','/entrar',{cuerpo:'no es json'}); ok(rara.estado===401,'un cuerpo que no es JSON no entra');
const obj=await pedir(P,'POST','/entrar',{cuerpo:{clave:{'$ne':1}}}); ok(obj.estado===401,'una clave que no es texto no entra');
const buena=await entrar(P,CLAVE); ok(buena.estado===200&&buena.json.ok&&buena.json.rol==='admin'&&/^s1\.[\w-]+\.[\w-]+$/.test(buena.json.sesion)&&buena.json.vence>Date.now(),'la contraseña correcta da una sesión firmada con vencimiento');
const SES=buena.json.sesion;
ok(!SES.includes(CLAVE)&&!Buffer.from(partes(SES)[1],'base64url').toString().includes(CLAVE),'la sesión no contiene la contraseña');

/* ---- la sesión da administrador; el token crudo no ---- */
const A=await hola(P,{token:INV,sesion:SES}); await esperar(()=>rolDe(A));
ok(rolDe(A)==='admin','con la sesión, el servidor lo reconoce como administrador');
A.enviar({t:'editar',n:1,op:{t:'suelo',x:5,y:5,m:'d'}}); await esperar(()=>A.msgs.some(m=>m.t==='ok'));
ok(A.msgs.some(m=>m.t==='ok'&&m.n===1)&&S.mundo.seq()===1,'y puede editar el mundo oficial');
const crudo=await hola(P,{token:CLAVE}); await esperar(()=>rolDe(crudo)||crudo.cerrado!==null);
ok(rolDe(crudo)==='jugador','la contraseña mandada como token en `hola` NO da administrador: es un invitado más');
crudo.enviar({t:'editar',n:2,op:{t:'suelo',x:6,y:6,m:'d'}}); await esperar(()=>codigoDe(crudo)==='permiso');
ok(codigoDe(crudo)==='permiso'&&S.mundo.seq()===1,'y no puede editar');
ok((await pedir(P,'GET','/copia',{bearer:CLAVE})).estado===401&&(await pedir(P,'GET','/copia',{bearer:INV})).estado===401,'la contraseña (o un token de invitado) como Bearer no baja la copia');
ok((await pedir(P,'GET','/copia',{bearer:SES})).estado===200,'la sesión sí');
ok((await pedir(P,'POST','/importar',{bearer:CLAVE,cuerpo:'{}'})).estado===401,'ni importa');
const comoToken=await hola(P,{token:SES.slice(0,200)}); await esperar(()=>rolDe(comoToken)||comoToken.cerrado!==null);
ok(rolDe(comoToken)!=='admin','una sesión mandada en el campo `token` no sirve de nada');
const sinNada=await hola(P,{}); await esperar(()=>sinNada.cerrado!==null); ok(sinNada.cerrado===4003,'sin token ni sesión no se entra');

/* ---- falsificar, alterar, reutilizar ---- */
const [pre,cuerpo,firma]=partes(SES), datos=JSON.parse(Buffer.from(cuerpo,'base64url').toString());
const intentos={
  'datos alterados con la firma original':'s1.'+b64j(Object.assign({},datos,{u:'ffffffffffff'}))+'.'+firma,
  'vencimiento alargado con la firma original':'s1.'+b64j(Object.assign({},datos,{e:datos.e+1e10}))+'.'+firma,
  'sin firma':'s1.'+cuerpo+'.',
  'firma vacía de relleno':'s1.'+cuerpo+'.'+'A'.repeat(firma.length),
  'firma de otra sesión':'s1.'+cuerpo+'.'+partes((await entrar(P,CLAVE)).json.sesion)[2],
  'versión inventada':'s2.'+cuerpo+'.'+firma,
  'algoritmo "none"':'s1.'+cuerpo+'.none',
  'basura':'hola',
  'un objeto':{a:1},
  'muy larga':'s1.'+'x'.repeat(5000)+'.'+firma
};
for(const [k,v] of Object.entries(intentos)){ const C=await hola(P,{token:INV,sesion:v}); await esperar(()=>C.cerrado!==null); ok(codigoDe(C)==='sesion'&&C.cerrado===4004&&!rolDe(C),'sesión rechazada: '+k); }
/* una sesión armada por alguien que NO conoce la clave de firma (la mejor suposición: la propia contraseña, o una clave cualquiera) */
const ajena=crearSesiones({claveSesion:alea(40),adminClaves:[CLAVE]}).emitir().sesion;
const conPass=(()=>{ const c=b64j(Object.assign({},datos)); return 's1.'+c+'.'+crypto.createHmac('sha256',CLAVE).update('s1.'+c).digest('base64url'); })();
for(const [k,v] of Object.entries({'firmada con otra clave':ajena,'firmada con la contraseña de administrador':conPass})){ const C=await hola(P,{token:INV,sesion:v}); await esperar(()=>C.cerrado!==null); ok(codigoDe(C)==='sesion'&&!rolDe(C),'sesión rechazada: '+k); }
/* una sesión válida ajena no deja de ser el ID de su dueña: no hay forma de elegir otro usuarioId */
ok(rolDe(A)==='admin'&&A.msgs.find(m=>m.t==='bienvenida').id===datos.u,'el id de administrador sale de la sesión firmada, no de lo que mande el cliente');

/* ---- claves de firma y contraseña: secretos distintos ---- */
let e1=null; try{ await iniciarServidor({dir:tmp(),puerto:0,adminTokens:[CLAVE],claveSesion:alea(10)+CLAVE+alea(10)}); }catch(e){ e1=e; } ok(e1&&/no puede ser/.test(e1.message),'la clave de firma no puede ser (ni contener) la contraseña de administrador');
let e2=null; try{ await iniciarServidor({dir:tmp(),puerto:0,adminTokens:[CLAVE],claveSesion:'corta'}); }catch(e){ e2=e; } ok(e2&&/al menos 32/.test(e2.message),'ni ser corta');

/* ---- cerrar sesión: se revoca y corta la conexión ---- */
const B=await entrar(P,CLAVE); const SB=B.json.sesion;
const HB=await hola(P,{token:INV,sesion:SB}); await esperar(()=>rolDe(HB));
ok((await pedir(P,'POST','/salir',{bearer:SB})).estado===200,'POST /salir responde');
await esperar(()=>HB.cerrado!==null); ok(HB.cerrado===4005,'cerrar sesión corta la conexión de administrador abierta');
const reuso=await hola(P,{token:INV,sesion:SB}); await esperar(()=>reuso.cerrado!==null); ok(codigoDe(reuso)==='sesion','una sesión cerrada no se puede reutilizar');
ok((await pedir(P,'GET','/copia',{bearer:SB})).estado===401,'ni para la copia');
ok(rolDe(A)==='admin'&&(await pedir(P,'GET','/copia',{bearer:SES})).estado===200,'las otras sesiones siguen valiendo');
const sinSesion=await pedir(P,'POST','/salir',{bearer:'basura'}); ok(sinSesion.estado===200,'cerrar una sesión inexistente no revela nada');

/* ---- reinicio del servidor ---- */
const dirR=tmp();
let SR=await iniciarServidor({dir:dirR,puerto:0,host:'127.0.0.1',adminTokens:[CLAVE],claveSesion:FIRMA,retrasoLoginMs:0});
const sR=(await entrar(SR.puerto,CLAVE)).json.sesion; await SR.cerrar();
SR=await iniciarServidor({dir:dirR,puerto:0,host:'127.0.0.1',adminTokens:[CLAVE],claveSesion:FIRMA,retrasoLoginMs:0});
let C=await hola(SR.puerto,{token:INV,sesion:sR}); await esperar(()=>rolDe(C)||C.cerrado!==null); ok(rolDe(C)==='admin','con la misma clave de firma, la sesión sobrevive a un reinicio'); C.ws.close(); await SR.cerrar();
SR=await iniciarServidor({dir:dirR,puerto:0,host:'127.0.0.1',adminTokens:[CLAVE],claveSesion:FIRMA2,retrasoLoginMs:0});
C=await hola(SR.puerto,{token:INV,sesion:sR}); await esperar(()=>C.cerrado!==null); ok(codigoDe(C)==='sesion','cambiar la clave de firma cierra todas las sesiones'); await SR.cerrar();
SR=await iniciarServidor({dir:dirR,puerto:0,host:'127.0.0.1',adminTokens:[CLAVE2],claveSesion:FIRMA,retrasoLoginMs:0});
C=await hola(SR.puerto,{token:INV,sesion:sR}); await esperar(()=>C.cerrado!==null); ok(codigoDe(C)==='sesion','cambiar la contraseña de administrador cierra las sesiones anteriores'); 
ok((await entrar(SR.puerto,CLAVE)).estado===401&&(await entrar(SR.puerto,CLAVE2)).estado===200,'y la contraseña vieja ya no entra'); await SR.cerrar();

/* ---- vencimiento ---- */
{ const SV=await arrancar({vigenciaSesionMs:900});
  const sv=(await entrar(SV.puerto,CLAVE)).json.sesion;
  const V=await hola(SV.puerto,{token:INV,sesion:sv}); await esperar(()=>rolDe(V));
  await dormir(1000);
  V.enviar({t:'editar',n:1,op:{t:'suelo',x:7,y:7,m:'d'}}); await esperar(()=>codigoDe(V)==='sesion');
  ok(rolDe(V)==='admin'&&codigoDe(V)==='sesion'&&SV.mundo.seq()===0,'una sesión que vence con la conexión abierta ya no puede editar');
  const V2=await hola(SV.puerto,{token:INV,sesion:sv}); await esperar(()=>V2.cerrado!==null); ok(codigoDe(V2)==='sesion','y una vencida no entra');
  ok((await pedir(SV.puerto,'GET','/copia',{bearer:sv})).estado===401,'ni baja la copia');
  await SV.cerrar(); }

/* ---- freno de intentos ---- */
{ const SF=await arrancar({maxIntentos:5});
  const r=[]; for(let i=0;i<5;i++) r.push((await entrar(SF.puerto,alea(20))).estado);
  ok(r.every(x=>x===401),'los cinco primeros intentos fallidos responden 401');
  const seis=await entrar(SF.puerto,alea(20)); ok(seis.estado===429&&seis.json.esperar>0&&seis.cabeceras['retry-after'],'el sexto se frena (429) y dice cuánto esperar');
  const buenaEnFreno=await entrar(SF.puerto,CLAVE); ok(buenaEnFreno.estado===429&&!buenaEnFreno.json.sesion,'mientras dura el freno ni la contraseña correcta entra: adivinar no sirve');
  /* la dirección sale de la conexión; X-Forwarded-For sólo cuenta si se pidió confiar en el proxy */
  const falsa=await entrar(SF.puerto,alea(20),{'X-Forwarded-For':'203.0.113.'+(1+Math.floor(Math.random()*200))}); ok(falsa.estado===429,'cambiar X-Forwarded-For no esquiva el freno (sin proxy de confianza)');
  await SF.cerrar();
  const SP=await arrancar({maxIntentos:3,confiarProxy:true});
  for(let i=0;i<3;i++) await entrar(SP.puerto,alea(20),{'X-Forwarded-For':'198.51.100.7'});
  ok((await entrar(SP.puerto,alea(20),{'X-Forwarded-For':'198.51.100.7'})).estado===429,'tras un proxy de confianza se frena a la dirección real');
  ok((await entrar(SP.puerto,CLAVE,{'X-Forwarded-For':'198.51.100.99'})).estado===200,'y otra dirección no queda castigada');
  await SP.cerrar();
  /* mil peticiones a la vez no caben en cinco intentos */
  const SC=await arrancar({maxIntentos:5,retrasoLoginMs:150});
  const tanda=await Promise.all(Array.from({length:30},()=>entrar(SC.puerto,alea(20))));
  const n401=tanda.filter(x=>x.estado===401).length, n429=tanda.filter(x=>x.estado===429).length;
  ok(n401<=5&&n401+n429===30,'30 intentos simultáneos: no pasan de cinco ('+n401+' comprobados, '+n429+' frenados)');
  await SC.cerrar();
  /* un acierto limpia la cuenta */
  const SA=await arrancar({maxIntentos:3});
  await entrar(SA.puerto,alea(20)); await entrar(SA.puerto,alea(20)); ok((await entrar(SA.puerto,CLAVE)).estado===200,'una entrada correcta antes del límite funciona');
  await entrar(SA.puerto,alea(20)); await entrar(SA.puerto,alea(20)); ok((await entrar(SA.puerto,alea(20))).estado===401,'y la cuenta de fallos empieza de nuevo'); await SA.cerrar(); }

/* ---- tamaño y orígenes ---- */
ok((await pedir(P,'POST','/entrar',{cuerpo:'{"clave":"'+'x'.repeat(5000)+'"}'})).estado===413,'un cuerpo enorme se corta con 413');
{ const SO=await arrancar({origenes:['https://marcossantiagocenteno-png.github.io']});
  ok((await entrar(SO.puerto,CLAVE,{Origin:'https://sitio-malo.example'})).estado===403,'/entrar desde una página de otro origen se rechaza');
  const ok1=await entrar(SO.puerto,CLAVE,{Origin:'https://marcossantiagocenteno-png.github.io'}); ok(ok1.estado===200&&ok1.cabeceras['access-control-allow-origin']==='https://marcossantiagocenteno-png.github.io','y desde el origen permitido entra, con CORS sólo para ese origen');
  const pre=await pedir(SO.puerto,'OPTIONS','/entrar',{cabeceras:{Origin:'https://marcossantiagocenteno-png.github.io'}}); ok(pre.estado===204&&/POST/.test(pre.cabeceras['access-control-allow-methods']),'el navegador puede hacer la petición previa (CORS) de /entrar');
  await SO.cerrar(); }

A.ws.close(); await S.cerrar();
/* ---- nada secreto en los registros ---- */
const todo=registro.join('\n');
ok(registro.length>5&&![CLAVE,CLAVE2,FIRMA,FIRMA2,SES,SB,sR].some(t=>todo.includes(t)),'ni contraseñas, ni claves de firma, ni sesiones aparecen en el registro del servidor ('+registro.length+' líneas)');
ok(/intento de administrador fallido/.test(todo),'los intentos fallidos sí se anotan, sin datos');

console.log(bien+' bien, '+mal+' mal'); process.exit(mal?1:0);
})().catch(e=>{ console.log('ERROR',e.stack); process.exit(1); });

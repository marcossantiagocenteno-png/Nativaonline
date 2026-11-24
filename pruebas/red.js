// Etapa 3 del multijugador: el servidor de red (ws). Clientes SIN pantalla, cada uno con su propio mundo, aplican lo que reciben
// y se comparan con el servidor por huella. Si falta `npm install` en servidor/, la prueba se omite (el juego no depende de ws).
let WebSocket; try{ WebSocket=require('../servidor/node_modules/ws'); }catch(e){ console.log('OMITIDA: falta `npm install` dentro de servidor/ (ws no está instalado). El juego no la necesita.'); process.exit(0); }
const fs=require('fs'), os=require('os'), path=require('path'), http=require('http');
const {iniciarServidor}=require('../servidor/red.js');
const {cargarMundo}=require('../servidor/cargar-mundo.js');
let bien=0,mal=0; const ok=(c,t)=>{ if(c) bien++; else { mal++; console.log('MAL:',t); } };
const tmp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'nativa-red-'));
const dormir=ms=>new Promise(r=>setTimeout(r,ms));
const ADMIN='clave-de-admin-de-prueba-0123456789', ADMIN2='otra-clave-de-admin-de-prueba-abcdef', JUG='token-de-jugador-de-prueba-111111', JUG2='token-de-jugador-de-prueba-222222';
const ORIGEN='https://marcos.github.io';
const registro=[];

/* un cliente de prueba: tiene su propio mundo, lo mantiene con lo que le llega y avisa si ve un salto en las versiones */
function conectar(puerto,o){
  o=o||{};
  return new Promise((res,rej)=>{
    const headers={}; if(o.origin!==null) headers.Origin=o.origin||ORIGEN;
    const ws=new WebSocket('ws://127.0.0.1:'+puerto,{headers});
    const C={ws,msgs:[],espera:[],W:o.W||cargarMundo(),seq:o.seq||0,saltos:0,cerrado:null,rol:null};
    const huella=()=>C.W.huella(C.W.mundo.exportar());
    C.huella=huella;
    ws.on('message',d=>{
      const m=JSON.parse(d.toString()); C.msgs.push(m);
      if(m.t==='bienvenida'){ C.rol=m.rol; if(m.modo==='completo'){ C.W.mundo.cargar(m.mundo); C.W.olvidarObjetos(); } else for(const x of m.ops){ C.W.mundo.editar(x.op); } C.seq=m.seq; C.modo=m.modo; }
      else if(m.t==='op'){ if(m.seq!==C.seq+1){ C.saltos++; } else { C.W.mundo.editar(m.op); C.W.olvidarObjetos(); C.seq=m.seq; } }
      else if(m.t==='mundo'){ C.W.mundo.cargar(m.mundo); C.W.olvidarObjetos(); C.seq=m.seq; }
      else if(m.t==='ok'&&m.seq>C.seq) C.seq=m.seq;
      for(const e of C.espera.slice()) if(e.f(m)){ C.espera.splice(C.espera.indexOf(e),1); e.r(m); }
    });
    ws.on('close',(codigo)=>{ C.cerrado=codigo; for(const e of C.espera) e.r(null); });
    ws.on('error',e=>{ if(!C.abierto) rej(e); });
    ws.on('open',()=>{ C.abierto=true;
      C.enviar=m=>ws.send(JSON.stringify(m));
      C.editar=(n,op)=>{ C.W.mundo.editar(JSON.parse(JSON.stringify(op))); C.W.olvidarObjetos(); C.enviar({t:'editar',n,op}); };   // optimista, como el cliente real
      C.esperar=(f,ms)=>{ const ya=C.msgs.find(f); if(ya) return Promise.resolve(ya); return new Promise(r=>{ const e={f,r}; C.espera.push(e); setTimeout(()=>{ const i=C.espera.indexOf(e); if(i>=0){ C.espera.splice(i,1); r(undefined); } },ms||3000); }); };
      if(o.token!==null){ C.enviar({t:'hola',v:o.v||1,token:o.token||JUG,desde:o.desde,huella:o.huella}); }
      res(C);
    });
  });
}
async function entrar(puerto,o){ const C=await conectar(puerto,o); await C.esperar(m=>m.t==='bienvenida'||m.t==='error'); return C; }
const hasta=async(f,ms)=>{ const t=Date.now(); while(Date.now()-t<(ms||3000)){ if(f()) return true; await dormir(10); } return f(); };
const rechazado=(puerto,origin)=>new Promise(r=>{ const h={}; if(origin) h.Origin=origin; const ws=new WebSocket('ws://127.0.0.1:'+puerto,{headers:h}); ws.on('open',()=>{ ws.close(); r(false); }); ws.on('error',()=>r(true)); });
function pedir(puerto,metodo,ruta,{token,origin,cuerpo}={}){
  return new Promise(r=>{ const h={}; if(token) h.Authorization='Bearer '+token; if(origin) h.Origin=origin; if(cuerpo) h['Content-Type']='application/json';
    const q=http.request({host:'127.0.0.1',port:puerto,path:ruta,method:metodo,headers:h},res=>{ const t=[]; res.on('data',x=>t.push(x)); res.on('end',()=>{ const s=Buffer.concat(t).toString(); let j=null; try{ j=JSON.parse(s); }catch(e){} r({estado:res.statusCode,cabeceras:res.headers,json:j,texto:s}); }); });
    q.on('error',e=>r({error:e.message})); if(cuerpo) q.write(typeof cuerpo==='string'?cuerpo:JSON.stringify(cuerpo)); q.end(); });
}

(async()=>{
const dir=tmp();
let S=await iniciarServidor({dir,puerto:0,host:'127.0.0.1',adminTokens:[ADMIN,ADMIN2],origenes:[ORIGEN],latido:100,log:t=>registro.push(t)});
const P=()=>S.puerto;

/* ---- salud y orígenes ---- */
const salud=await pedir(P(),'GET','/salud');
ok(salud.estado===200&&salud.json.ok&&salud.json.seq===0&&salud.json.semilla,'GET /salud responde');
ok(await rechazado(P(),'https://sitio-malo.example'),'una página de otro origen no puede conectarse');
ok(await rechazado(P(),null),'sin origen tampoco, si el servidor tiene lista de orígenes y no lo permite');
ok((await pedir(P(),'GET','/salud',{origin:'https://sitio-malo.example'})).estado===403,'ni leer /salud desde otro origen');
const pre=await pedir(P(),'OPTIONS','/copia',{origin:ORIGEN}); ok(pre.estado===204&&pre.cabeceras['access-control-allow-origin']===ORIGEN&&/authorization/.test(pre.cabeceras['access-control-allow-headers']),'CORS: el origen permitido puede pedir /copia con Authorization');

/* ---- A: dos clientes, el mismo mundo ---- */
const A=await entrar(P(),{token:ADMIN}), B=await entrar(P(),{token:JUG});
ok(A.rol==='admin'&&B.rol==='jugador','el rol sale de la identidad: administrador y jugador');
const bA=A.msgs.find(m=>m.t==='bienvenida'), bB=B.msgs.find(m=>m.t==='bienvenida');
ok(bA.modo==='completo'&&bA.seq===0&&bA.huella===bB.huella&&A.huella()===bA.huella&&B.huella()===bB.huella,'los dos entran al mismo mundo (versión 0) y la huella que calcula cada uno es la del servidor');
ok(!JSON.stringify(A.msgs).includes(ADMIN)&&bA.id!==ADMIN,'el servidor nunca devuelve el token');

/* ---- identidad inválida, versión, orden ---- */
const X=await entrar(P(),{token:'corto'}); await hasta(()=>X.cerrado!==null);
ok(X.msgs.some(m=>m.t==='error'&&m.codigo==='token')&&X.cerrado===4003,'un token inválido se rechaza y se corta');
const V=await entrar(P(),{token:JUG,v:99}); await hasta(()=>V.cerrado!==null);
ok(V.msgs.some(m=>m.codigo==='version')&&V.cerrado===4002,'otra versión del protocolo se rechaza');
const N=await conectar(P(),{token:null}); N.enviar({t:'editar',n:1,op:{t:'suelo',x:1,y:1,m:'d'}}); const rN=await N.esperar(m=>m.t==='error');
ok(rN&&rN.codigo==='orden','editar sin saludar primero se rechaza'); N.ws.close();

/* ---- B/D: A edita, B lo ve y queda igual ---- */
A.editar(7,{t:'suelo',x:60,y:60,m:'d'});
const okA=await A.esperar(m=>m.t==='ok'&&m.n===7), opB=await B.esperar(m=>m.t==='op');
ok(okA&&okA.seq===1&&opB&&opB.seq===1&&opB.autor===bA.id,'el administrador edita: recibe su ok y el otro recibe la edición con autor y versión');
ok(B.huella()===okA.huella&&A.huella()===okA.huella&&S.mundo.huella()===okA.huella,'la edición deja a los dos clientes y al servidor con la misma huella');
const roca=A.W.motores.obtener('rocoso').caras.objetos.crear('rocoso:roca'), boca=A.W.bocaCueva.aObjeto({tipo:'monticulo',cara:'suroeste',ancho:10,alto:4,boca:2.8,sem:9});
for(const [n,op] of [[8,{t:'objeto+',x:45,y:50,objeto:roca}],[9,{t:'objeto+',x:20,y:75,objeto:boca}],[10,{t:'altura',x:70,y:70,d:3}]]){ A.editar(n,op); await A.esperar(m=>m.t==='ok'&&m.n===n); }
await hasta(()=>B.seq===4); ok(B.seq===4&&B.huella()===S.mundo.huella(),'rocas, entradas de cueva y alturas viajan y B queda igual');

/* ---- permisos y rechazos ---- */
const antes=S.mundo.seq(), nB=B.msgs.length;
B.enviar({t:'editar',n:1,op:{t:'suelo',x:5,y:5,m:'d'}}); const eB=await B.esperar(m=>m.t==='error'&&m.n===1);
ok(eB&&eB.codigo==='permiso'&&S.mundo.seq()===antes,'un jugador no puede editar el mundo oficial: se rechaza y no cambia nada');
B.enviar({t:'restaurar',n:2,version:0}); ok((await B.esperar(m=>m.t==='error'&&m.n===2)).codigo==='permiso'&&S.mundo.seq()===antes,'ni restaurar versiones');
A.enviar({t:'editar',n:20,op:{t:'suelo',x:1,y:1,m:'¿'}}); const eA=await A.esperar(m=>m.t==='error'&&m.n===20);
ok(eA&&eA.codigo==='invalida'&&S.mundo.seq()===antes&&!B.msgs.slice(nB).some(m=>m.t==='op'),'una edición inválida del administrador se rechaza y NO se difunde');
A.enviar({t:'editar',n:21,op:{t:'suelo-',x:3,y:3}}); const sc=await A.esperar(m=>m.t==='ok'&&m.n===21);
ok(sc&&sc.sinCambio&&S.mundo.seq()===antes,'una edición que no cambia nada se confirma sin crear versión');
A.ws.send('esto no es json'); ok((await A.esperar(m=>m.t==='error'&&m.codigo==='formato'))!==undefined,'un mensaje que no es JSON se rechaza sin tirar la conexión');
A.enviar({t:'inventado',n:3}); ok((await A.esperar(m=>m.t==='error'&&m.n===3)).codigo==='desconocido','un mensaje desconocido se rechaza');

/* ---- ediciones simultáneas de dos administradores ---- */
const A2=await entrar(P(),{token:ADMIN2}), C3=await entrar(P(),{token:JUG2});
await hasta(()=>A2.seq===S.mundo.seq());
const lote=(n,x0)=>{ for(let i=0;i<15;i++) n.editar(100+i,{t:'suelo',x:x0+i,y:30,m:i%2?'d':'g'}); };
lote(A,10); lote(A2,40);
await hasta(()=>S.mundo.seq()===antes+30,5000);
ok(S.mundo.seq()===antes+30,'30 ediciones simultáneas de dos administradores se guardan todas ('+S.mundo.seq()+')');
await hasta(()=>B.seq===S.mundo.seq()&&C3.seq===S.mundo.seq()&&A.seq===S.mundo.seq()&&A2.seq===S.mundo.seq(),5000);
const H=S.mundo.huella();
ok([A,A2,B,C3].every(c=>c.huella()===H)&&[A,A2,B,C3].every(c=>c.saltos===0),'los cuatro clientes quedan con la misma huella que el servidor, sin saltos de versión');

/* ---- C: un cliente se desconecta y los demás siguen ---- */
const nCli=S.clientes(); B.ws.terminate(); await hasta(()=>S.clientes()===nCli-1);
ok(S.clientes()===nCli-1,'el servidor se da cuenta de que un cliente se fue');
A.editar(300,{t:'suelo',x:80,y:80,m:'d'}); ok((await A.esperar(m=>m.t==='ok'&&m.n===300))!==undefined&&A2.msgs.some(m=>m.t==='op'),'los demás siguen funcionando y recibiendo');
A.editar(301,{t:'suelo',x:81,y:80,m:'d'}); await A.esperar(m=>m.t==='ok'&&m.n===301); A.editar(302,{t:'altura',x:82,y:80,d:1}); await A.esperar(m=>m.t==='ok'&&m.n===302);

/* ---- reconexión: incremental si coincide, completo si no ---- */
const seqB=B.seq, hB=B.huella();
const B2=await entrar(P(),{token:JUG,W:B.W,seq:seqB,desde:seqB,huella:hB});
const bb=B2.msgs.find(m=>m.t==='bienvenida');
ok(bb.modo==='incremental'&&bb.ops.length===3&&B2.huella()===S.mundo.huella(),'reconectar con la versión y la huella correctas: sólo llegan las 3 ediciones que faltaban y queda igual');
const B3=await entrar(P(),{token:JUG,desde:seqB,huella:'0'.repeat(64)});
ok(B3.msgs.find(m=>m.t==='bienvenida').modo==='completo'&&B3.huella()===S.mundo.huella(),'si la huella no coincide (copia local dañada), se le manda el mundo entero');
const B4=await entrar(P(),{token:JUG,desde:99999,huella:hB}); ok(B4.msgs.find(m=>m.t==='bienvenida').modo==='completo','una versión que el servidor no tiene también recibe el mundo entero');
const B5=await entrar(P(),{token:JUG,desde:S.mundo.seq(),huella:S.mundo.huella()}); ok(B5.msgs.find(m=>m.t==='bienvenida').ops.length===0,'reconectar sin haber perdido nada: nada que mandar');
ok(S.clientes()>=7,'no hay entidades duplicadas: cada conexión es una sola entrada ('+S.clientes()+' conexiones)');

/* ---- restaurar: todos reciben el mundo entero ---- */
const huellaV3=(await S.mundo.reconstruir(3)).huella, antesR=S.mundo.seq();
A.enviar({t:'restaurar',n:400,version:3}); const okR=await A.esperar(m=>m.t==='ok'&&m.n===400);
const mR=await B2.esperar(m=>m.t==='mundo');
ok(okR&&mR&&mR.motivo==='restaurar'&&mR.huella===huellaV3&&mR.seq===antesR+1,'restaurar la versión 3: todos reciben el mundo entero de esa versión como versión nueva');
await hasta(()=>[A,A2,B2,B3,C3].every(c=>c.seq===antesR+1));
ok([A,A2,B2,B3,C3].every(c=>c.huella()===huellaV3),'y todos los clientes quedan idénticos');
A.enviar({t:'restaurar',n:401,version:99999}); ok((await A.esperar(m=>m.t==='error'&&m.n===401)).codigo==='invalida','restaurar una versión que no existe se rechaza');

/* ---- HTTP: copia completa e importación ---- */
ok((await pedir(P(),'GET','/copia')).estado===401&&(await pedir(P(),'GET','/copia',{token:JUG})).estado===401,'la copia completa exige la clave de administrador');
const cp=await pedir(P(),'GET','/copia',{token:ADMIN,origin:ORIGEN});
ok(cp.estado===200&&/attachment/.test(cp.cabeceras['content-disposition'])&&cp.json.huella===S.mundo.huella()&&A.W.huella(cp.json.mundo)===cp.json.huella,'GET /copia con la clave baja la copia completa y su huella es la del mundo oficial');
const dir2=tmp(); const S2=await iniciarServidor({dir:dir2,puerto:0,host:'127.0.0.1',adminTokens:[ADMIN],permitirSinOrigen:true});
const E2=await entrar(S2.puerto,{token:JUG,origin:null});
ok((await pedir(S2.puerto,'POST','/importar',{token:JUG,cuerpo:cp.json})).estado===401,'importar exige la clave de administrador');
const mala=JSON.parse(cp.texto); mala.mundo.paneles[Object.keys(mala.mundo.paneles)[0]].suelo.push([1,1,'d']);
ok((await pedir(S2.puerto,'POST','/importar',{token:ADMIN,cuerpo:mala})).estado===422&&S2.mundo.seq()===0,'una copia alterada se rechaza y no toca nada');
const imp=await pedir(S2.puerto,'POST','/importar',{token:ADMIN,cuerpo:cp.texto});
const mI=await E2.esperar(m=>m.t==='mundo');
ok(imp.estado===200&&imp.json.huella===cp.json.huella&&mI&&mI.motivo==='importar'&&E2.huella()===cp.json.huella,'importar la copia en otro servidor da el mismo mundo y los conectados lo reciben');
E2.ws.close(); await S2.cerrar();

/* ---- topes de tamaño y de ritmo ---- */
const G=await entrar(P(),{token:JUG}); G.ws.send(JSON.stringify({t:'ping',x:'x'.repeat(300*1024)})); await hasta(()=>G.cerrado!==null);
ok(G.cerrado===1009,'un mensaje de más de 256 KB corta la conexión');
const dir3=tmp(); const S3=await iniciarServidor({dir:dir3,puerto:0,host:'127.0.0.1',maxPorSegundo:20,adminTokens:[ADMIN]});
const R=await entrar(S3.puerto,{token:JUG,origin:null}); for(let i=0;i<60;i++) R.enviar({t:'ping',ts:i}); await hasta(()=>R.cerrado!==null);
ok(R.cerrado===1008&&R.msgs.some(m=>m.codigo==='ritmo'),'quien manda demasiados mensajes por segundo es cortado'); await S3.cerrar();
ok(A.cerrado===null&&A2.cerrado===null,'los latidos no cortan las conexiones vivas (el servidor lleva más de 20 latidos)');

/* ---- E: apagar todo y volver a entrar ---- */
const hFinal=S.mundo.huella(), sFinal=S.mundo.seq(), expFinal=JSON.stringify(S.mundo.NV.mundo.exportar());
await S.cerrar(); await hasta(()=>A.cerrado!==null);
ok(A.cerrado===1001,'al apagar el servidor los clientes reciben el cierre limpio');
S=await iniciarServidor({dir,puerto:0,host:'127.0.0.1',adminTokens:[ADMIN],origenes:[ORIGEN]});
const Z=await entrar(S.puerto,{token:JUG}); const bz=Z.msgs.find(m=>m.t==='bienvenida');
ok(bz.seq===sFinal&&bz.huella===hFinal&&Z.huella()===hFinal&&JSON.stringify(Z.W.mundo.exportar())===expFinal,'cerrar todo y volver a entrar: el mundo conserva todas sus modificaciones, versión y huella');
const au=await S.mundo.auditar(); ok(au.ok,'y la auditoría del historial completo da todo en orden ('+au.versiones+' versiones)');
Z.ws.close(); await S.cerrar();

/* ---- los tokens no se escriben en ningún registro ---- */
const todo=registro.join('\n'); ok(registro.length>5&&![ADMIN,ADMIN2,JUG,JUG2].some(t=>todo.includes(t)),'ningún token aparece en el registro del servidor ('+registro.length+' líneas)');

console.log(bien+' bien, '+mal+' mal'); process.exit(mal?1:0);
})().catch(e=>{ console.log('ERROR',e.stack); process.exit(1); });

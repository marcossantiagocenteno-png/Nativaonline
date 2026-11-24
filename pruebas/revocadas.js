// Etapa 6 (cierre): las sesiones CERRADAS siguen cerradas después de reiniciar el servidor.
// La lista de revocadas (id + vencimiento, nunca la sesión) vive en la carpeta de datos; las vencidas se podan; si el archivo se daña, por
// seguridad dejan de valer todas las sesiones emitidas antes.
let WebSocket; try{ WebSocket=require('../servidor/node_modules/ws'); }catch(e){ console.log('OMITIDA: falta `npm install` dentro de servidor/'); process.exit(0); }
const fs=require('fs'), os=require('os'), path=require('path'), http=require('http'), crypto=require('crypto');
const {iniciarServidor}=require('../servidor/red.js');
const {crearSesiones}=require('../servidor/sesiones.js');
let bien=0,mal=0; const ok=(c,t)=>{ if(c) bien++; else { mal++; console.log('MAL:',t); } };
const dormir=ms=>new Promise(r=>setTimeout(r,ms));
const alea=n=>crypto.randomBytes(n).toString('base64url');
const CLAVE=alea(18), FIRMA=alea(40), INV='token-de-invitado-de-prueba-000001';
const DIR=fs.mkdtempSync(path.join(os.tmpdir(),'nativa-rev-')), ARCH=path.join(DIR,'sesiones-revocadas.json');

function pedir(puerto,metodo,ruta,{bearer,cuerpo}={}){
  return new Promise(r=>{ const h={}; if(bearer) h.Authorization='Bearer '+bearer; let b=null;
    if(cuerpo!==undefined){ b=JSON.stringify(cuerpo); h['Content-Type']='application/json'; h['Content-Length']=Buffer.byteLength(b); }
    const q=http.request({host:'127.0.0.1',port:puerto,path:ruta,method:metodo,headers:h},res=>{ const t=[]; res.on('data',x=>t.push(x)); res.on('end',()=>{ let j=null; try{ j=JSON.parse(Buffer.concat(t).toString()); }catch(e){} r({estado:res.statusCode,json:j}); }); });
    q.on('error',e=>r({error:e.message})); if(b) q.write(b); q.end(); });
}
const entrar=p=>pedir(p,'POST','/entrar',{cuerpo:{clave:CLAVE}}).then(r=>r.json&&r.json.sesion);
const arrancar=()=>iniciarServidor({dir:DIR,puerto:0,host:'127.0.0.1',adminTokens:[CLAVE],claveSesion:FIRMA,retrasoLoginMs:0});
function hola(puerto,sesion){
  return new Promise((res,rej)=>{ const ws=new WebSocket('ws://127.0.0.1:'+puerto); const C={ws,msgs:[],cerrado:null};
    ws.on('message',d=>C.msgs.push(JSON.parse(d.toString()))); ws.on('close',c=>{ C.cerrado=c; }); ws.on('error',rej);
    ws.on('open',()=>{ ws.send(JSON.stringify({t:'hola',v:1,token:INV,sesion})); res(C); }); });
}
const rol=async(puerto,sesion)=>{ const C=await hola(puerto,sesion); const t=Date.now(); while(Date.now()-t<2000&&!C.msgs.length&&C.cerrado===null) await dormir(10); const b=C.msgs.find(m=>m.t==='bienvenida'); C.ws.close(); return b?b.rol:(C.msgs.find(m=>m.t==='error')||{}).codigo||'?'; };

(async()=>{
/* ---- servidor real: cerrar sesión, reiniciar, comprobar ---- */
let S=await arrancar();
const s1=await entrar(S.puerto), s2=await entrar(S.puerto), s3=await entrar(S.puerto);
ok(await rol(S.puerto,s1)==='admin'&&(await pedir(S.puerto,'GET','/copia',{bearer:s1})).estado===200,'antes de cerrar, la sesión es de administrador');
const a1=await pedir(S.puerto,'POST','/salir',{bearer:s1}); ok(a1.estado===200,'/salir responde 200');
ok(await rol(S.puerto,s1)==='sesion'&&(await pedir(S.puerto,'GET','/copia',{bearer:s1})).estado===401,'cerrada: ya no entra ni baja la copia');
ok(fs.existsSync(ARCH),'la revocación quedó escrita en la carpeta de datos');
const crudo=fs.readFileSync(ARCH,'utf8');
ok(!crudo.includes(s1)&&!crudo.includes(FIRMA)&&!crudo.includes(CLAVE)&&!crudo.includes(s1.split('.')[2]),'el archivo no guarda la sesión, ni su firma, ni la clave de firma, ni la contraseña');
const lista=JSON.parse(crudo); ok(lista.revocadas.length===1&&typeof lista.revocadas[0].e==='number','guarda sólo el identificador y el vencimiento (1 entrada)');
ok(fs.readdirSync(DIR).every(f=>!/\.tmp-/.test(f)),'no queda archivo temporal');
await S.cerrar();

for(let vuelta=1;vuelta<=3;vuelta++){
  S=await arrancar();
  ok(await rol(S.puerto,s1)==='sesion','reinicio '+vuelta+': la sesión cerrada NO recupera permisos (conexión)');
  ok((await pedir(S.puerto,'GET','/copia',{bearer:s1})).estado===401&&(await pedir(S.puerto,'POST','/importar',{bearer:s1,cuerpo:{}})).estado===401,'reinicio '+vuelta+': ni por HTTP (/copia, /importar)');
  ok(await rol(S.puerto,s2)==='admin','reinicio '+vuelta+': una sesión que no se cerró sigue valiendo');
  if(vuelta<3) await S.cerrar();
}
ok((await pedir(S.puerto,'POST','/salir',{bearer:s2})).estado===200&&await rol(S.puerto,s2)==='sesion','otra sesión se cierra después del reinicio');
ok(JSON.parse(fs.readFileSync(ARCH,'utf8')).revocadas.length===2,'y se suma a la lista (2 entradas)');
await S.cerrar(); S=await arrancar();
ok(await rol(S.puerto,s1)==='sesion'&&await rol(S.puerto,s2)==='sesion'&&await rol(S.puerto,s3)==='admin','tras otro reinicio: s1 y s2 cerradas, s3 vigente');
const nueva=await entrar(S.puerto); ok(nueva&&await rol(S.puerto,nueva)==='admin','y entrar con la contraseña da una sesión nueva válida');
ok(S.mundo.seq()===0,'el mundo no se tocó');
await S.cerrar();

/* ---- el archivo se daña: no se sabe qué estaba cerrado → se cierra todo lo anterior ---- */
{ const antes=await (async()=>{ const SA=await arrancar(); const x=await entrar(SA.puerto); await SA.cerrar(); return x; })();
  for(const [nombre,contenido] of [['basura','esto no es json {{{'],['cortado',fs.readFileSync(ARCH,'utf8').slice(0,20)],['formato ajeno','{"formato":"otro","revocadas":[]}'],['entradas inválidas','{"formato":"nativa-revocadas-1","desde":0,"revocadas":[{"j":5}]}']]){
    fs.writeFileSync(ARCH,contenido);
    await dormir(5);
    const SD=await arrancar();
    ok(await rol(SD.puerto,antes)==='sesion'&&await rol(SD.puerto,s1)==='sesion'&&await rol(SD.puerto,s3)==='sesion','archivo dañado ('+nombre+'): ninguna sesión anterior sigue valiendo');
    ok(fs.readdirSync(DIR).some(f=>/^sesiones-revocadas\.json\.danado-/.test(f)),'archivo dañado ('+nombre+'): el original se aparta en vez de perderse');
    const post=await entrar(SD.puerto); ok(await rol(SD.puerto,post)==='admin','archivo dañado ('+nombre+'): una sesión emitida después sí vale');
    await SD.cerrar();
    const SE=await arrancar(); ok(await rol(SE.puerto,post)==='admin'&&await rol(SE.puerto,antes)==='sesion','archivo dañado ('+nombre+'): y el corte se mantiene en el siguiente reinicio');
    await SE.cerrar();
  } }

/* ---- si la revocación no se puede guardar, se dice (y la sesión queda cerrada igual en memoria) ---- */
{ const SF=await arrancar(); const x=await entrar(SF.puerto), y=await entrar(SF.puerto);
  fs.rmSync(ARCH,{force:true}); fs.mkdirSync(ARCH);                 // el archivo pasa a ser una carpeta: renombrar encima falla
  const r=await pedir(SF.puerto,'POST','/salir',{bearer:x});
  ok(r.estado===500&&r.json&&r.json.error==='revocacion-no-guardada','si no se puede guardar, /salir no finge: responde 500');
  ok(await rol(SF.puerto,x)==='sesion','y aun así esa sesión queda cerrada mientras el servidor siga encendido');
  ok(await rol(SF.puerto,y)==='admin','las demás no se tocan');
  await SF.cerrar(); fs.rmSync(ARCH,{recursive:true,force:true}); }

/* ---- poda: lo vencido se descarta; lo vigente se conserva (reloj simulado) ---- */
{ let t=1e12; const ahora=()=>t; const f=path.join(DIR,'poda.json');
  const mk=()=>crearSesiones({claveSesion:FIRMA,adminClaves:[CLAVE],ahora,vigenciaMs:1000,archivoRevocadas:f});
  let A=mk(); const e1=A.emitir(); t+=400; const e2=A.emitir(); A.revocar(e1.sesion); A.revocar(e2.sesion);
  ok(JSON.parse(fs.readFileSync(f,'utf8')).revocadas.length===2,'poda: dos revocadas guardadas');
  t+=700;                                                                  // e1 venció (1000 ms), e2 no (vence a los 1400)
  A=mk(); ok(JSON.parse(fs.readFileSync(f,'utf8')).revocadas.length===1&&A.revocadasVigentes()===1,'poda: al arrancar se descarta lo vencido y se conserva lo vigente');
  ok(A.verificar(e2.sesion)===null&&A.verificar(e1.sesion)===null,'poda: la vencida ya no valía por vencida, la vigente sigue cerrada');
  t+=500; A.revocar(A.emitir().sesion);
  ok(JSON.parse(fs.readFileSync(f,'utf8')).revocadas.length===1,'poda: también se poda al revocar (sólo queda la nueva)'); }

/* ---- una sesión de fuera no sirve aunque el archivo exista ---- */
{ const otra=crearSesiones({claveSesion:alea(40),adminClaves:[CLAVE]}).emitir().sesion;
  const SG=await arrancar(); ok(await rol(SG.puerto,otra)==='sesion','sesión firmada con otra clave: rechazada'); await SG.cerrar(); }
fs.rmSync(DIR,{recursive:true,force:true});
console.log(bien+' bien, '+mal+' mal'); process.exit(mal?1:0);
})().catch(e=>{ console.log('ERROR',e.stack); process.exit(1); });

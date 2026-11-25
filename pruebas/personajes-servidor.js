// Personajes permanentes (servidor/personajes.js + su enganche en red.js y presencia.js). Todo contra carpetas temporales y el servidor en el bucle local.
// Cubre: lo que se guarda (identidad, ubicación, nivel, experiencia, inventario), que sobreviva a reconectar y a reiniciar el servidor, que ningún cliente
// pueda escribir el progreso, que un archivo dañado se aparte sin borrarse, y que lo anterior (jugadores temporales, administrador) siga igual.
let WebSocket; try{ WebSocket=require('../servidor/node_modules/ws'); }catch(e){ console.log('OMITIDA: falta `npm install` dentro de servidor/'); process.exit(0); }
const fs=require('fs'), os=require('os'), path=require('path'), crypto=require('crypto');
const raiz=path.resolve(__dirname,'..');
const {crearPersonajes,verificarCarpeta,validar}=require(path.join(raiz,'servidor','personajes.js'));
const {iniciarServidor}=require(path.join(raiz,'servidor','red.js'));
const sesionAdmin=require('./sesion.js');
let bien=0,mal=0; const ok=(c,t)=>{ if(process.env.PRUEBAS_VERBOSO) console.log((c?'bien: ':'MAL: ')+t); if(c) bien++; else { mal++; console.log('MAL:',t); } };
const dormir=ms=>new Promise(r=>setTimeout(r,ms));
const tmps=[]; const tmp=p=>{ const d=fs.mkdtempSync(path.join(os.tmpdir(),'nv-pj-'+(p||''))); tmps.push(d); return d; };
process.on('exit',()=>{ for(const d of tmps) try{ fs.rmSync(d,{recursive:true,force:true}); }catch(e){} });
const ADMIN='clave-de-admin-de-prueba-0123456789', FIRMA='firma-de-sesion-de-prueba-0123456789abcdef';
const tok=n=>'token-de-invitado-de-prueba-'+String(n).padStart(6,'0');
const idDe=t=>crypto.createHash('sha256').update(t).digest('hex').slice(0,12);
const leer=(d,id)=>JSON.parse(fs.readFileSync(path.join(d,'personajes',id+'.json'),'utf8'));
const archivos=d=>fs.readdirSync(path.join(d,'personajes')).sort();

function conectar(puerto,{token,sesion}){
  return new Promise((res,rej)=>{
    const ws=new WebSocket('ws://127.0.0.1:'+puerto), C={ws,msgs:[],yo:null,errores:[],cerrado:null};
    ws.on('message',d=>{ const m=JSON.parse(d.toString()); C.msgs.push(m); if(m.t==='bienvenida'){ C.yo=m.yo; C.rol=m.rol; res(C); } if(m.t==='error') C.errores.push(m); });
    ws.on('close',c=>{ C.cerrado=c; if(!C.yo) rej(new Error('cerrada antes de la bienvenida')); }); ws.on('error',e=>{ if(!C.yo) rej(e); });
    ws.on('open',()=>{ const h={t:'hola',v:1}; if(token!==undefined) h.token=token; if(sesion) h.sesion=sesion; ws.send(JSON.stringify(h)); });
    C.enviar=m=>ws.send(JSON.stringify(m));
  });
}
const cerrar=async C=>{ C.ws.close(); for(let i=0;i<40&&C.cerrado===null;i++) await dormir(25); await dormir(60); };

(async()=>{
  process.on('exit',c=>{ if(!global.__fin) console.log('la prueba terminó sin llegar al final, código',c); });

  /* ===================== A. el almacén, solo ===================== */
  {
    const D=tmp('a'); let t=1000; const ahora=()=>t++;
    let P=crearPersonajes({dir:D,ahora}); const id=idDe('x');
    ok(P.cantidad()===0&&fs.existsSync(path.join(D,'personajes')),'almacén nuevo: carpeta personajes/ creada y vacía');
    const r=P.crear(id,{nombre:'Viajero-ABCD',x:12,y:-7,mirando:'este'});
    ok(r.nivel===1&&r.experiencia===0&&Array.isArray(r.inventario)&&r.inventario.length===0&&r.x===12&&r.y===-7&&r.nombre==='Viajero-ABCD','personaje nuevo: identidad, ubicación y progreso inicial (nivel 1, experiencia 0, sin objetos)');
    ok(validar(leer(D,id),id)===null,'queda en disco al instante y válido (con su suma de control)');
    r.nivel=99; ok(P.obtener(id).nivel===1,'obtener() devuelve una copia: tocarla no cambia el personaje');
    const otra=P.crear(id,{nombre:'Otro',x:0,y:0}); ok(otra.nombre==='Viajero-ABCD'&&leer(D,id).x===12,'crear sobre un personaje que ya existe no lo pisa');
    ok(P.actualizar(id,{x:13,y:-7})===true&&P.pendientes()===1&&leer(D,id).x===12,'actualizar() marca pendiente y no escribe hasta guardarPendientes()');
    ok(P.actualizar(id,{x:13,y:-7})===false,'actualizar() con lo mismo no cambia nada');
    P.guardarPendientes(); ok(leer(D,id).x===13&&P.pendientes()===0,'guardarPendientes() escribe');
    ok(P.otorgarExperiencia(id,50)===50&&P.otorgarExperiencia(id,25)===75,'otorgarExperiencia suma');
    P.darObjeto(id,'piedra',3); P.darObjeto(id,'piedra',2); P.darObjeto(id,'pluma',1);
    ok(JSON.stringify(P.obtener(id).inventario)===JSON.stringify([{id:'piedra',cant:5},{id:'pluma',cant:1}]),'darObjeto junta cantidades del mismo objeto');
    ok(P.quitarObjeto(id,'piedra',2)===true&&P.obtener(id).inventario[0].cant===3&&P.quitarObjeto(id,'pluma',1)===true&&P.obtener(id).inventario.length===1,'quitarObjeto resta y retira el objeto al llegar a cero');
    ok(P.quitarObjeto(id,'piedra',9)===false&&P.quitarObjeto(id,'nada',1)===false&&P.obtener(id).inventario[0].cant===3,'quitar de más o lo que no hay: falso y no cambia nada');
    const rechaza=(f,t)=>{ let e=null; try{ f(); }catch(x){ e=x; } ok(!!e,t); };
    rechaza(()=>P.actualizar(id,{x:1.5}),'una coordenada no entera se rechaza');
    rechaza(()=>P.actualizar(id,{nivel:0}),'nivel 0 se rechaza'); rechaza(()=>P.actualizar(id,{nivel:1001}),'nivel sobre el tope se rechaza');
    rechaza(()=>P.actualizar(id,{experiencia:-1}),'experiencia negativa se rechaza');
    rechaza(()=>P.actualizar(id,{mirando:'arriba'}),'una dirección que no existe se rechaza');
    rechaza(()=>P.actualizar(id,{inventario:[{id:'a',cant:1},{id:'a',cant:2}]}),'un objeto repetido en el inventario se rechaza');
    rechaza(()=>P.actualizar(id,{inventario:[{id:'Mayúsculas raras',cant:1}]}),'un id de objeto raro se rechaza');
    rechaza(()=>P.actualizar(id,{inventario:[{id:'a',cant:10000}]}),'una cantidad sobre el tope se rechaza');
    rechaza(()=>P.actualizar(id,{c:'xxxx'}),'la suma de control no se puede editar');
    rechaza(()=>P.actualizar(id,{creado:1}),'las fechas no se pueden editar desde fuera');
    rechaza(()=>P.darObjeto(id,'ok',0),'dar 0 objetos se rechaza');
    rechaza(()=>P.otorgarExperiencia(id,-5),'otorgar experiencia negativa se rechaza');
    P.guardarPendientes();
    { const id2=idDe('lleno'); P.crear(id2,{nombre:'Lleno',x:0,y:0}); rechaza(()=>{ for(let i=0;i<201;i++) P.darObjeto(id2,'o'+i,1); },'más de 200 objetos distintos se rechaza'); P.guardarPendientes(); }
    P=crearPersonajes({dir:D,ahora});             // reabrir = lo que pasa al reiniciar
    ok(P.cantidad()===2&&P.obtener(id).experiencia===75&&P.obtener(id).inventario[0].id==='piedra','reabrir: sigue ahí (ubicación, experiencia e inventario)');
    ok(archivos(D).every(n=>/^[0-9a-f]{12}\.json$/.test(n)),'no quedan archivos temporales');
    ok(verificarCarpeta(D).ok&&verificarCarpeta(D).cantidad===2,'verificarCarpeta: bien');
    /* daños: se aparta, no se borra */
    const f=path.join(D,'personajes',id+'.json'), orig=fs.readFileSync(f,'utf8');
    fs.writeFileSync(f,orig.replace('"x":13','"x":14'));        // alterado a mano, con la suma vieja
    const v=verificarCarpeta(D); ok(!v.ok&&/suma de control/.test(v.problemas[0]),'verificarCarpeta detecta un archivo alterado');
    P=crearPersonajes({dir:D,ahora});
    ok(P.cantidad()===1&&P.apartados()===1&&archivos(D).some(n=>/\.json\.danado-\d+$/.test(n))&&!fs.existsSync(f),'un archivo alterado se aparta como .danado-<hora> y no se borra');
    ok(fs.readFileSync(path.join(D,'personajes',archivos(D).find(n=>/danado/.test(n))),'utf8').includes('"x":14'),'el contenido apartado se conserva tal cual');
    ok(verificarCarpeta(D).ok&&verificarCarpeta(D).apartados===1,'los apartados no hacen fallar la auditoría, pero se cuentan');
    const nuevo=P.crear(id,{nombre:'Viajero-ZZZZ',x:1,y:2}); ok(nuevo.nombre==='Viajero-ZZZZ'&&P.cantidad()===2,'el jugador estrena personaje y lo dañado queda aparte');
    fs.writeFileSync(path.join(D,'personajes',idDe('y')+'.json'),orig.slice(0,40));       // cortado a medias
    fs.writeFileSync(path.join(D,'personajes','desktop.ini'),'[x]'); fs.writeFileSync(path.join(D,'personajes',idDe('q')+'.json.tmp-1-2'),'{}');
    P=crearPersonajes({dir:D,ahora}); ok(P.apartados()===1&&P.cantidad()===2,'un archivo cortado se aparta; los temporales y archivos ajenos no estorban');
    ok(verificarCarpeta(path.join(D,'no-existe')).ok&&verificarCarpeta(path.join(D,'no-existe')).cantidad===0,'sin carpeta de personajes, verificarCarpeta no falla');
  }

  /* ===================== B. el servidor, con jugadores por la red ===================== */
  const D=tmp('s'), A=tok(1), IDA=idDe(A);
  const abrir=o=>iniciarServidor(Object.assign({dir:D,adminTokens:[ADMIN],claveSesion:FIRMA,guardadoCadaMs:150,retrasoLoginMs:0},o||{}));
  let s=await abrir();
  const pos=C=>{ const j=s.presencia.get(C.yo.id); return {x:j.x,y:j.y,mirando:j.mirando}; };
  const caminar=async(C,n)=>{ const dirs=[[1,0],[0,1],[-1,0],[0,-1]]; let hechos=0;
    for(let i=0;i<n*8&&hechos<n;i++){ const j0=s.presencia.get(C.yo.id), j={x:j0.x,y:j0.y,epoca:j0.epoca}; let d=null;
      for(let k=0;k<4&&!d;k++){ const c=dirs[(i+k)%4]; if(s.presencia.libre(j.x+c[0],j.y+c[1])) d=c; }
      if(!d) break; C.enviar({t:'mover',x:j.x+d[0],y:j.y+d[1],e:j.epoca}); await dormir(240); const k=s.presencia.get(C.yo.id); if(k.x!==j.x||k.y!==j.y) hechos++; } return hechos; };

  let a=await conectar(s.puerto,{token:A}); const nombreA=a.yo.nombre, p0={x:a.yo.x,y:a.yo.y};
  ok(fs.existsSync(path.join(D,'personajes',IDA+'.json'))&&leer(D,IDA).nombre===nombreA&&leer(D,IDA).x===p0.x&&leer(D,IDA).y===p0.y,'al conectarse un invitado nuevo, su personaje queda guardado (nombre y ubicación de nacimiento)');
  ok(a.rol==='jugador','un invitado sigue siendo «jugador»');
  const hechos=await caminar(a,5), fin=pos(a);
  ok(hechos===5&&(fin.x!==p0.x||fin.y!==p0.y),'camina (cinco pasos aceptados por el servidor)');
  await dormir(450);
  ok(leer(D,IDA).x===fin.x&&leer(D,IDA).y===fin.y,'el guardado periódico deja la posición en disco SIN esperar a desconectarse (sobrevive a una caída)');
  /* una segunda pestaña del mismo dispositivo: temporal, no toca el personaje */
  const antes2=fs.readFileSync(path.join(D,'personajes',IDA+'.json'),'utf8');
  const b2=await conectar(s.puerto,{token:A});
  ok(b2.yo.nombre!==nombreA&&archivos(D).length===1,'una segunda pestaña del mismo dispositivo es un jugador temporal (otro nombre, ningún archivo nuevo)');
  await caminar(b2,2); await dormir(400);
  ok(fs.readFileSync(path.join(D,'personajes',IDA+'.json'),'utf8')===antes2,'moverse con la pestaña temporal no cambia el personaje permanente');
  await cerrar(b2); ok(s.personajes.obtener(IDA).nombre===nombreA,'cerrar la pestaña temporal tampoco');
  /* reconectar */
  await cerrar(a);
  a=await conectar(s.puerto,{token:A});
  ok(a.yo.nombre===nombreA&&a.yo.x===fin.x&&a.yo.y===fin.y,'al reconectar: mismo nombre y reaparece donde estaba ('+a.yo.nombre+' en '+a.yo.x+','+a.yo.y+')');
  /* otro dispositivo */
  const b=await conectar(s.puerto,{token:tok(2)}); ok(b.yo.nombre!==nombreA&&archivos(D).length===2,'otro dispositivo: otro personaje');
  await cerrar(b);
  /* el administrador: sus permisos vienen de la sesión; su personaje, del dispositivo */
  await cerrar(a);
  const ses=await sesionAdmin(s.puerto,ADMIN);
  const ad=await conectar(s.puerto,{token:A,sesion:ses});
  ok(ad.rol==='admin'&&ad.yo.nombre===nombreA,'el administrador entra con su sesión y recibe el personaje de su dispositivo ('+ad.rol+', '+ad.yo.nombre+')');
  await cerrar(ad);
  const ad2=await conectar(s.puerto,{sesion:ses}); ok(ad2.rol==='admin'&&archivos(D).length===2,'un administrador sin dispositivo es temporal: no se crea archivo');
  await cerrar(ad2);
  const inv=await conectar(s.puerto,{token:'corto'}).then(()=>false,()=>true); ok(inv,'(un token inválido sigue rechazándose como antes)');
  /* el progreso NO se puede escribir desde la red */
  a=await conectar(s.puerto,{token:A});
  for(const m of [{t:'nivel',v:50},{t:'experiencia',v:999},{t:'inventario',v:[{id:'oro',cant:9}]},{t:'perfil',nivel:99,experiencia:1,inventario:[{id:'oro',cant:9}]},{t:'actualizar',x:0,y:0,nivel:99},{t:'darObjeto',id:'oro',cant:1}]) a.enviar(m);
  await dormir(300);
  ok(a.errores.filter(e=>e.codigo==='desconocido').length===6,'ningún mensaje del protocolo toca el progreso: los seis intentos reciben «desconocido»');
  const pj=leer(D,IDA); ok(pj.nivel===1&&pj.experiencia===0&&pj.inventario.length===0,'nivel, experiencia e inventario siguen intactos');
  await cerrar(a);
  /* progreso dado por el servidor + reinicio del servidor */
  s.personajes.otorgarExperiencia(IDA,120); s.personajes.darObjeto(IDA,'piedra',3); s.personajes.guardarPendientes();
  const guardado=leer(D,IDA);
  await s.cerrar(); s=await abrir();
  const g2=s.personajes.obtener(IDA);
  ok(g2&&g2.experiencia===120&&g2.inventario.length===1&&g2.inventario[0].cant===3&&g2.nombre===nombreA&&g2.x===guardado.x,'reiniciar el servidor: identidad, ubicación, experiencia e inventario siguen ahí');
  a=await conectar(s.puerto,{token:A}); ok(a.yo.nombre===nombreA&&a.yo.x===guardado.x&&a.yo.y===guardado.y,'y el jugador vuelve a su personaje tras el reinicio');
  /* cerrar el servidor guarda a los conectados */
  await caminar(a,3); const ultima=pos(a); await s.cerrar();
  ok(leer(D,IDA).x===ultima.x&&leer(D,IDA).y===ultima.y,'apagar el servidor con jugadores conectados guarda su última posición');
  s=await abrir();
  /* obras: si su casilla guardada ya es sólida, reaparece al lado */
  let solida=null; for(let r=0;r<=40&&!solida;r++) for(let dy=-r;dy<=r&&!solida;dy++) for(let dx=-r;dx<=r&&!solida;dx++) if(Math.max(Math.abs(dx),Math.abs(dy))===r&&!s.presencia.libre(dx,dy)) solida={x:dx,y:dy};
  if(solida){
    s.personajes.actualizar(IDA,{x:solida.x,y:solida.y}); s.personajes.guardar(IDA);
    const c=await conectar(s.puerto,{token:A});
    ok(s.presencia.libre(c.yo.x,c.yo.y)&&Math.max(Math.abs(c.yo.x-solida.x),Math.abs(c.yo.y-solida.y))<=8&&c.yo.nombre===nombreA,'si su casilla guardada ya no es transitable, reaparece en la libre más cercana y conserva su nombre');
    await cerrar(c);
  } else console.log('  (no encontré una casilla sólida cerca del origen: se omite la prueba de obras)');
  ok(archivos(D).every(n=>/^[0-9a-f]{12}\.json$/.test(n)),'tras todo esto no quedan temporales en personajes/');
  /* un fallo de guardado no tumba al servidor ni al jugador */
  fs.rmSync(path.join(D,'personajes'),{recursive:true,force:true}); fs.writeFileSync(path.join(D,'personajes'),'esto es un archivo, no una carpeta');
  const logs=[]; const s3=await iniciarServidor({dir:tmp('f'),adminTokens:[ADMIN],claveSesion:FIRMA,log:t=>logs.push(t)});
  fs.rmSync(path.join(s3.personajes.dir),{recursive:true,force:true}); fs.writeFileSync(s3.personajes.dir,'bloqueado');
  const f=await conectar(s3.puerto,{token:tok(9)}); ok(f.yo&&f.rol==='jugador'&&logs.some(l=>/no se pudo guardar el personaje/.test(l)),'si el disco no deja guardar, el jugador entra igual como temporal y queda anotado en el registro');
  await cerrar(f); await s3.cerrar(); await s.cerrar();

  /* ===================== C. personajes:false = como antes ===================== */
  const D4=tmp('n'); const s4=await iniciarServidor({dir:D4,adminTokens:[ADMIN],claveSesion:FIRMA,personajes:false});
  const n1=await conectar(s4.puerto,{token:A}); await cerrar(n1);
  ok(!fs.existsSync(path.join(D4,'personajes'))&&s4.personajes===null,'con personajes:false no se crea nada y todos los jugadores son temporales');
  await s4.cerrar();

  console.log('personajes-servidor: '+bien+' bien, '+mal+' mal'); global.__fin=1; process.exit(mal?1:0);
})();

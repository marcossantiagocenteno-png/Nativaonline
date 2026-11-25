/* Nativa Online — SERVIDOR DE RED del mundo oficial.
   Un proceso de Node con una sola dependencia (ws). Guarda el mundo oficial (servidor/mundo-oficial.js) y habla con los clientes por WebSocket
   y, para lo que es un archivo entero (copia de seguridad), por HTTP. El cliente sigue dibujando todo: acá sólo viaja el ESTADO.

   Protocolo v1 (JSON, un mensaje por trama de texto):
     cliente → servidor
       {t:'hola', v:1, token, sesion?, desde?, huella?}   token = identidad temporal de invitado (ver identidad.js): SIEMPRE rol 'jugador'.
                                                  sesion = la sesión de administrador que dio POST /entrar: es lo único que da rol 'admin'.
                                                  Si trae `desde` (la versión que tiene) y `huella` (la que calculó), el servidor manda sólo lo que falta.
       {t:'editar', n, op}                       una edición del Modo Dios. Sólo admin. `n` lo elige el cliente para reconocer la respuesta.
       {t:'restaurar', n, version}               sólo admin.
       {t:'ping', ts}
       {t:'mover', x, y, e}                      un paso del jugador (un metro, cuatro direcciones). `e` = la época que le dio el servidor.
       {t:'escena', dentro, x?, y?}              entra o sale de una cueva (adentro desaparece de la vista de los demás)
       {t:'reaparecer'}                          volver cerca del punto de partida
       {t:'resync'}                              pide el mundo entero otra vez (sin cortar la conexión)
     servidor → cliente
       {t:'bienvenida', v:1, id, rol, semilla, seq, huella, modo:'completo', mundo}   o   modo:'incremental', ops:[{seq,op,autor,h}]
       {t:'ok', n, seq, huella, sinCambio?}      la edición se aceptó, se guardó y es la versión `seq`
       {t:'op', seq, op, autor, huella}          alguien más editó: aplicarla con NV.mundo.editar (en orden; un salto de seq = pedir el mundo de nuevo)
       {t:'mundo', seq, huella, mundo, motivo}   reemplazo completo (restauración o importación)
       {t:'error', n?, codigo, motivo}           codigos: version, token, sesion, permiso, invalida, formato, desconocido, ritmo, orden
       {t:'pong', ts}
     presencia (ver servidor/presencia.js): `bienvenida` trae además yo:{id,nombre,x,y,mirando,e} y jugadores:[…]; después llegan
       {t:'j+', j:{id,nombre,x,y,mirando}} · {t:'j-', id} · {t:'mov', id, x, y, mirando, salto} (salto = teletransporte, sin animar el paso)
       {t:'pos', x, y, mirando, e, motivo}      sólo a quien se corrige: su posición verdadera y su época nueva (motivos: lejos, solido, rapido,
                                                formato, obra, inicio, escena)
   HTTP: GET /salud (dice también si hay clave de administrador configurada: sólo sí o no) · POST /entrar ({clave} → {sesion, vence}; con freno de intentos)
         · POST /salir (revoca la sesión) · GET /copia (admin, Authorization: Bearer <sesión>) · POST /importar (admin, cuerpo = la copia)
   Seguridad: sólo el servidor decide qué se acepta (los clientes no imponen nada); un rol sin permiso recibe 'permiso' y no cambia nada;
   mensajes con tope de tamaño, tope de ritmo por conexión, latidos que cierran conexiones muertas, lista opcional de orígenes. */
'use strict';
const http=require('http');
const {WebSocketServer}=require('ws');
const {abrirMundoOficial}=require('./mundo-oficial.js');
const {crearIdentidad,puede}=require('./identidad.js');
const {crearFreno,bloqueDeRed}=require('./sesiones.js');
const {crearPresencia}=require('./presencia.js');
const {crearPersonajes}=require('./personajes.js');
const VERSION=1;

async function iniciarServidor(op){
  op=op||{};
  const mo=await abrirMundoOficial({dir:op.dir,cadaN:op.cadaN});
  /* las sesiones cerradas se guardan junto a los datos del mundo (el volumen persistente): un reinicio no las revive */
  const archivoRevocadas=op.archivoRevocadas===undefined?require('path').join(mo.alm.dir,'sesiones-revocadas.json'):op.archivoRevocadas;
  const ident=op.identidad||crearIdentidad({adminTokens:op.adminTokens,claveSesion:op.claveSesion,ahora:op.ahora,vigenciaMs:op.vigenciaSesionMs,archivoRevocadas});
  const freno=crearFreno({maxFallos:op.maxIntentos,ventanaMs:op.ventanaIntentosMs,ahora:op.ahora});
  const retrasoLogin=op.retrasoLoginMs===undefined?400:op.retrasoLoginMs;
  /* de dónde viene una petición, para el freno de intentos. El intento se cuenta al BLOQUE de red (IPv4 completa, IPv6 por /64: ver bloqueDeRed).
     Por defecto se usa la dirección de la conexión y la cabecera X-Forwarded-For se IGNORA: cualquiera puede escribirla.
     NATIVA_CONFIAR_PROXY=1 (op.confiarProxy) hace que se lea el ÚLTIMO elemento de X-Forwarded-For. Sólo es correcto si se cumplen las tres
     condiciones de docs/DISENO.md («Condiciones para NATIVA_CONFIAR_PROXY»): un único proxy delante, que añade al final la dirección real
     de quien se conectó, y que el servidor no se pueda alcanzar sin pasar por él. Si no, el freno se esquiva o bloquea a todos por igual. */
  const ipDe=req=>{ let ip=req.socket.remoteAddress||'?'; if(op.confiarProxy){ const f=String(req.headers['x-forwarded-for']||'').split(',').map(x=>x.trim()).filter(Boolean); if(f.length) ip=f[f.length-1]; } return bloqueDeRed(ip); };
  const pausa=ms=>new Promise(r=>setTimeout(r,ms));
  const lim={mensaje:op.maxMensaje||256*1024, copia:op.maxCopia||32*1024*1024, clientes:op.maxClientes||200, porSegundo:op.maxPorSegundo||60, lento:8*1024*1024};
  const pres=op.presencia||crearPresencia({NV:mo.NV,aleatorio:op.aleatorio,ahora:op.ahora});
  const log=op.log||(()=>{}), clientes=new Set(), porJugador=new Map();
  /* personajes permanentes: uno por dispositivo (op.personajes===false los apaga: todos temporales, como antes) */
  const personajes=op.personajes===false?null:crearPersonajes({dir:mo.alm.dir,ahora:op.ahora,log});
  const conPersonaje=new Set();          // dispositivos que ya tienen una conexión con su personaje permanente: una segunda pestaña es temporal
  const guardarPosicion=c=>{
    if(!personajes||!c.pk||!c.pj) return;
    const j=pres.get(c.pj); if(!j) return;
    try{ personajes.actualizar(c.pk,{x:j.x,y:j.y,mirando:j.mirando}); }catch(e){ log('personaje '+c.pk+': '+e.message); }
  };
  let proximo=1, cerrando=false;
  const origenOk=o=>!op.origenes||(o?op.origenes.includes(o):!!op.permitirSinOrigen);

  const enviar=(c,m)=>{
    if(c.ws.readyState!==1) return;
    if(c.ws.bufferedAmount>lim.lento){ c.ws.terminate(); return; }          // un cliente que no lee no frena a los demás
    c.ws.send(JSON.stringify(m));
  };
  const error=(c,n,codigo,motivo)=>enviar(c,{t:'error',n,codigo,motivo:String(motivo||codigo).slice(0,300)});
  function difundir(m,salvo){
    for(const c of clientes){
      if(c===salvo) continue;
      if(c.estado==='entrando'){ c.cola.push(m); continue; }               // entra: se le guarda lo que pase mientras recibe el mundo
      if(c.estado!=='listo') continue;
      if(m.t==='op'&&m.seq<=c.seq) continue;
      enviar(c,m); if(m.seq>c.seq) c.seq=m.seq;
    }
  }
  const mensajeMundo=(e,motivo)=>({t:'mundo',seq:e.seq,huella:e.huella,mundo:e.mundo,motivo});
  /* presencia: mensajes que van a todos los que ya tienen personaje (menos el que los origina). Al que está entrando se le guardan hasta que
     reciba el mundo; el cliente aplica cada uno de forma idempotente, así que un repetido por el camino no hace daño. */
  function avisarJugadores(m,salvo){
    for(const c of clientes){
      if(c===salvo||!c.pj) continue;
      if(c.estado==='entrando'){ c.cola.push(m); continue; }
      if(c.estado==='listo') enviar(c,m);
    }
  }
  const mov=(j,salto)=>({t:'mov',id:j.id,x:j.x,y:j.y,mirando:j.mirando,salto:!!salto});
  /* un jugador corrido por el servidor: se le dice la verdad a él y a todos los demás */
  function corregido(j,motivo){
    const c=porJugador.get(j.id);
    if(c) enviar(c,{t:'pos',x:j.x,y:j.y,mirando:j.mirando,e:j.epoca,motivo});
    if(!j.oculto) avisarJugadores(mov(j,true),c);
  }
  /* el mundo cambió: quien quedó dentro de un obstáculo se mueve a la casilla libre más cercana, y todos lo saben */
  function revisarJugadores(){ for(const j of pres.revisar()){ corregido(j,'obra'); log('reubicado '+j.id+' ('+j.nombre+') tras un cambio del mundo'); } }
  /* entrega lo que se guardó mientras entraba */
  function vaciarCola(c){
    for(const q of c.cola){
      if(q.t==='op'||q.t==='mundo'){ if(q.seq>c.seq){ enviar(c,q); c.seq=q.seq; } }
      else enviar(c,q);
    }
    c.cola=[];
  }

  /* ---------------- HTTP ---------------- */
  const cabecerasCors=(req,res)=>{
    const o=req.headers.origin;
    if(o&&origenOk(o)){ res.setHeader('Access-Control-Allow-Origin',o); res.setHeader('Vary','Origin'); res.setHeader('Access-Control-Allow-Headers','authorization,content-type'); res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS'); }
  };
  const json=(res,code,o,extra)=>{ res.writeHead(code,Object.assign({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'},extra||{})); res.end(JSON.stringify(o)); };
  const sesionDe=req=>{ const m=/^Bearer\s+(.+)$/.exec(req.headers.authorization||''); return m?m[1]:null; };
  const adminDe=req=>{ const s=sesionDe(req); const id=s&&ident.verificarSesion(s); return id&&puede(id.rol,'copia')?id:null; };
  const cuerpoCorto=async(req,tope)=>{ const t=[]; let n=0; for await(const x of req){ n+=x.length; if(n>tope) return null; t.push(x); } return Buffer.concat(t).toString('utf8'); };
  const server=http.createServer(async(req,res)=>{
    cabecerasCors(req,res);
    try{
      const url=req.url.split('?')[0];
      if(req.method==='OPTIONS'){ res.writeHead(204); return res.end(); }
      if(req.headers.origin&&!origenOk(req.headers.origin)) return json(res,403,{error:'origen no permitido'});
      if(req.method==='GET'&&url==='/salud') return json(res,200,{ok:true,version:VERSION,seq:mo.seq(),huella:mo.huella(),clientes:clientes.size,semilla:mo.NV.CONFIG.seed,admin:ident.hayAdmins});
      if(req.method==='POST'&&url==='/entrar'){
        /* la contraseña de administrador se comprueba SÓLO acá, en el servidor. Nunca se registra ni se devuelve. */
        if(!ident.hayAdmins) return json(res,503,{error:'sin-clave',motivo:'El servidor no tiene configurada la clave de administrador (variable NATIVA_ADMIN_TOKEN).'});
        const ip=ipDe(req), f=freno.consultar(ip);
        if(!f.ok) return json(res,429,{error:'demasiados-intentos',esperar:Math.ceil(f.esperarMs/1000)},{'Retry-After':String(Math.ceil(f.esperarMs/1000))});
        const texto=await cuerpoCorto(req,2048); if(texto===null){ res.writeHead(413); return res.end(); }
        let clave=null; try{ const j=JSON.parse(texto); clave=j&&j.clave; }catch(e){}
        freno.fallo(ip);                                                            // el intento se cuenta ANTES de la demora: mil peticiones a la vez gastan los mismos cinco
        await pausa(retrasoLogin);                                                  // misma demora con acierto o con fallo
        const s=ident.entrar(clave);
        if(!s){ log('intento de administrador fallido'); return json(res,401,{error:'clave-incorrecta'}); }
        freno.acierto(ip); log('administrador entró (sesión '+s.id.slice(0,6)+')');
        return json(res,200,{ok:true,sesion:s.sesion,vence:s.vence,rol:'admin'});
      }
      if(req.method==='POST'&&url==='/salir'){
        const s=sesionDe(req), v=s&&ident.verificarSesion(s); let guardada=true;
        if(v){
          try{ ident.revocarSesion(s); }catch(e){ guardada=false; log('ERROR: la sesión se cerró en memoria pero no se pudo guardar la revocación ('+e.message+')'); }
          for(const c of clientes) if(c.sesionId===v.id){ try{ c.ws.close(4005,'sesión cerrada'); }catch(e){} }
        }
        return guardada?json(res,200,{ok:true}):json(res,500,{error:'revocacion-no-guardada'});
      }
      if(req.method==='GET'&&url==='/copia'){
        const id=adminDe(req); if(!id) return json(res,401,{error:'hace falta la clave de administrador'});
        const c=await mo.copiaCompleta();
        return json(res,200,c,{'Content-Disposition':'attachment; filename="nativa-copia-v'+c.seq+'.json"'});
      }
      if(req.method==='POST'&&url==='/importar'){
        const id=adminDe(req); if(!id) return json(res,401,{error:'hace falta la clave de administrador'});
        const texto=await cuerpoCorto(req,lim.copia); if(texto===null){ res.writeHead(413); return res.end(); }
        let copia; try{ copia=JSON.parse(texto); }catch(e){ return json(res,400,{error:'no es JSON'}); }
        let r; try{ r=await mo.importarConEstado(copia,id.usuarioId); }catch(e){ return json(res,422,{error:e.message}); }
        difundir(mensajeMundo(r.estado,'importar'),null); revisarJugadores();
        log('importó una copia → versión '+r.r.seq+' ('+id.usuarioId+')');
        return json(res,200,{ok:true,seq:r.r.seq,huella:r.r.huella,migrada:!!r.r.migrada});
      }
      json(res,404,{error:'no existe'});
    }catch(e){ json(res,500,{error:'error del servidor'}); log('error HTTP: '+e.message); }
  });

  /* ---------------- WebSocket ---------------- */
  const wss=new WebSocketServer({noServer:true,maxPayload:lim.mensaje});
  server.on('upgrade',(req,socket,head)=>{
    if(cerrando||!origenOk(req.headers.origin)){ socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return socket.destroy(); }
    wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req));
  });
  wss.on('connection',ws=>{
    if(clientes.size>=lim.clientes){ ws.close(1013,'lleno'); return; }
    const c={ws,id:proximo++,estado:'nuevo',usuarioId:null,rol:null,seq:0,cola:[],vivo:true,ventana:Date.now(),cuenta:0,cadena:Promise.resolve()};
    clientes.add(c);
    const reloj=setTimeout(()=>{ if(c.estado==='nuevo') ws.close(4001,'sin hola'); },op.tiempoHola||10000);
    ws.on('pong',()=>{ c.vivo=true; });
    ws.on('close',()=>{
      clearTimeout(reloj); clientes.delete(c);
      if(c.pk){ guardarPosicion(c); if(personajes){ try{ personajes.guardarPendientes(); }catch(e){} } conPersonaje.delete(c.pk); c.pk=null; }
      if(c.pj){ const j=pres.salir(c.pj); porJugador.delete(c.pj); if(j&&!j.oculto) avisarJugadores({t:'j-',id:j.id},c); }
      if(c.usuarioId) log('se fue '+c.usuarioId+(c.pj?' ('+c.pj+')':''));
    });
    ws.on('error',()=>{});
    ws.on('message',(data,esBinario)=>{
      if(esBinario){ ws.close(1003,'sólo texto'); return; }
      const ahora=Date.now(); if(ahora-c.ventana>1000){ c.ventana=ahora; c.cuenta=0; }
      if(++c.cuenta>lim.porSegundo){ error(c,undefined,'ritmo','demasiados mensajes'); ws.close(1008,'ritmo'); return; }
      let m; try{ m=JSON.parse(data.toString('utf8')); }catch(e){ error(c,undefined,'formato','no es JSON'); return; }
      if(!m||typeof m!=='object'||typeof m.t!=='string'){ error(c,undefined,'formato','mensaje sin tipo'); return; }
      c.cadena=c.cadena.then(()=>manejar(c,m)).catch(e=>{ error(c,m.n,'invalida',e.message); });     // los mensajes de un cliente se atienden en orden
    });
  });

  const vencida=c=>!!(c.vence&&(op.ahora||Date.now)()>=c.vence);
  async function manejar(c,m){
    if(m.t==='ping'){ enviar(c,{t:'pong',ts:m.ts}); return; }
    if(m.t==='hola'){
      if(c.estado!=='nuevo'){ error(c,undefined,'orden','ya saludaste'); return; }
      if(m.v!==VERSION){ error(c,undefined,'version','este servidor habla la versión '+VERSION); c.ws.close(4002,'versión'); return; }
      let id;
      if(m.sesion!==undefined){                    // administrador: la sesión firmada es lo único que cuenta
        id=ident.verificarSesion(m.sesion); if(!id){ error(c,undefined,'sesion','la sesión de administrador no es válida o venció'); c.ws.close(4004,'sesión'); return; }
        c.sesionId=id.id; c.vence=id.vence;
      } else { id=ident.autenticar(m.token); if(!id){ error(c,undefined,'token','identidad inválida'); c.ws.close(4003,'token'); return; } }   // invitado: siempre 'jugador'
      c.usuarioId=id.usuarioId; c.rol=id.rol; c.estado='entrando';
      let inc=null; if(m.desde!==undefined) inc=await mo.operacionesDesde(m.desde,m.huella);
      const base={t:'bienvenida',v:VERSION,id:c.usuarioId,rol:c.rol,semilla:mo.NV.CONFIG.seed};
      let e=null; if(!inc) e=await mo.estado();
      if(c.ws.readyState!==1) return;                                   // se fue mientras se le preparaba el mundo
      /* su personaje temporal: id nuevo, nombre nuevo, casilla libre y desocupada cerca del punto de partida */
      /* la clave del personaje es el DISPOSITIVO (su token), también para el administrador: su sesión da permisos, no identidad (cambia en cada sesión) */
      let pk=null;
      if(personajes){ const d=m.sesion!==undefined?ident.autenticar(m.token):id; if(d&&!conPersonaje.has(d.usuarioId)) pk=d.usuarioId; }
      const previo=pk?personajes.obtener(pk):null;
      const j=pres.entrar(previo); c.pj=j.id; porJugador.set(j.id,c);
      if(pk){
        try{ if(!previo) personajes.crear(pk,{nombre:j.nombre,x:j.x,y:j.y,mirando:j.mirando}); c.pk=pk; conPersonaje.add(pk); if(previo) guardarPosicion(c); }
        catch(e){ log('no se pudo guardar el personaje de '+pk+': '+e.message); c.pk=null; }       // un fallo de disco no le impide jugar: queda como temporal
      }
      base.yo={id:j.id,nombre:j.nombre,x:j.x,y:j.y,mirando:j.mirando,e:j.epoca}; base.jugadores=pres.lista(j.id);
      if(inc){ c.seq=inc.seq; enviar(c,Object.assign(base,{seq:inc.seq,huella:inc.huella,modo:'incremental',ops:inc.ops})); }
      else { c.seq=e.seq; enviar(c,Object.assign(base,{seq:e.seq,huella:e.huella,modo:'completo',mundo:e.mundo})); }
      c.estado='listo'; vaciarCola(c);
      avisarJugadores({t:'j+',j:pres.publica(j)},c);
      revisarJugadores();
      log('entró '+c.usuarioId+' ('+c.rol+', '+(inc?'incremental':'completo')+') como '+j.id+' «'+j.nombre+'»'); return;
    }
    if(c.estado!=='listo'){ error(c,m.n,'orden','primero hay que saludar'); return; }
    if(m.t==='editar'){
      if(!puede(c.rol,'editar')){ error(c,m.n,'permiso','sólo un administrador puede editar el mundo oficial'); return; }
      if(vencida(c)){ error(c,m.n,'sesion','la sesión de administrador venció: vuelve a entrar'); return; }
      let r; try{ r=await mo.aplicar(m.op,c.usuarioId); }catch(e){ error(c,m.n,'invalida',e.message); return; }
      if(r.sinCambio){ enviar(c,{t:'ok',n:m.n,seq:r.seq,huella:r.huella,sinCambio:true}); return; }
      c.seq=Math.max(c.seq,r.seq);
      enviar(c,{t:'ok',n:m.n,seq:r.seq,huella:r.huella});
      difundir({t:'op',seq:r.seq,op:m.op,autor:c.usuarioId,huella:r.huella},c);
      revisarJugadores();
      return;
    }
    if(m.t==='mover'){
      if(!puede(c.rol,'jugar')) return;
      const r=pres.mover(c.pj,m.x,m.y,m.e);
      if(r.ok) avisarJugadores(mov(r.j,false),c);
      else if(r.rechazo) enviar(c,{t:'pos',x:r.j.x,y:r.j.y,mirando:r.j.mirando,e:r.j.epoca,motivo:r.rechazo});
      return;
    }
    if(m.t==='escena'){
      const r=pres.escena(c.pj,!!m.dentro,m.x,m.y); if(!r) return;
      if(r.oculto) avisarJugadores({t:'j-',id:r.j.id},c);
      else { avisarJugadores({t:'j+',j:pres.publica(r.j)},c); if(r.corregido) enviar(c,{t:'pos',x:r.j.x,y:r.j.y,mirando:r.j.mirando,e:r.j.epoca,motivo:'escena'}); }
      return;
    }
    if(m.t==='reaparecer'){
      const r=pres.reaparecer(c.pj); if(!r||r.ignorado) return;
      corregido(r.j,'inicio'); return;
    }
    if(m.t==='resync'){            // el cliente perdió la cuenta de las versiones: se le manda el mundo entero (sin cortar la conexión ni cambiar su personaje)
      c.estado='entrando'; const e=await mo.estado();
      if(c.ws.readyState===1){ c.seq=e.seq; enviar(c,mensajeMundo(e,'resync')); }
      c.estado='listo'; vaciarCola(c); return;
    }
    if(m.t==='restaurar'){
      if(!puede(c.rol,'restaurar')){ error(c,m.n,'permiso','sólo un administrador puede restaurar versiones'); return; }
      if(vencida(c)){ error(c,m.n,'sesion','la sesión de administrador venció: vuelve a entrar'); return; }
      let r; try{ r=await mo.restaurarConEstado(m.version,c.usuarioId); }catch(e){ error(c,m.n,'invalida',e.message); return; }
      log('restauró la versión '+m.version+' → '+r.r.seq+' ('+c.usuarioId+')');
      enviar(c,{t:'ok',n:m.n,seq:r.r.seq,huella:r.r.huella});
      difundir(mensajeMundo(r.estado,'restaurar'),null); revisarJugadores();
      return;
    }
    error(c,m.n,'desconocido','mensaje desconocido: '+m.t.slice(0,40));
  }

  const guardado=personajes?setInterval(()=>{ for(const c of clientes) guardarPosicion(c); personajes.guardarPendientes(); },op.guardadoCadaMs||15000):null;
  const latido=setInterval(()=>{ for(const c of clientes){ if(!c.vivo){ c.ws.terminate(); continue; } c.vivo=false; try{ c.ws.ping(); }catch(e){} } },op.latido||20000);
  await new Promise((ok,no)=>{ server.once('error',no); server.listen(op.puerto||0,op.host||'0.0.0.0',ok); });
  const puerto=server.address().port;
  log('servidor del mundo oficial en el puerto '+puerto+' · versión '+mo.seq()+' · semilla '+mo.NV.CONFIG.seed);

  return {puerto,mundo:mo,presencia:pres,personajes,clientes:()=>clientes.size,
    async cerrar(){
      cerrando=true; clearInterval(latido); if(guardado) clearInterval(guardado);
      if(personajes){ for(const c of clientes) guardarPosicion(c); personajes.guardarPendientes(); }
      for(const c of clientes) try{ c.ws.close(1001,'el servidor se apaga'); }catch(e){}
      await new Promise(ok=>{ wss.close(()=>ok()); });
      await new Promise(ok=>{ server.close(()=>ok()); if(server.closeAllConnections) server.closeAllConnections(); });
      await mo.cerrar();
    }};
}
module.exports={iniciarServidor,VERSION};

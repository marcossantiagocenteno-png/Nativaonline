/* Nativa Online — SERVIDOR DE RED del mundo oficial.
   Un proceso de Node con una sola dependencia (ws). Guarda el mundo oficial (servidor/mundo-oficial.js) y habla con los clientes por WebSocket
   y, para lo que es un archivo entero (copia de seguridad), por HTTP. El cliente sigue dibujando todo: acá sólo viaja el ESTADO.

   Protocolo v1 (JSON, un mensaje por trama de texto):
     cliente → servidor
       {t:'hola', v:1, token, desde?, huella?}   token = identidad temporal de prueba (ver identidad.js). Si trae `desde` (la versión que tiene)
                                                  y `huella` (la que calculó), el servidor manda sólo lo que falta.
       {t:'editar', n, op}                       una edición del Modo Dios. Sólo admin. `n` lo elige el cliente para reconocer la respuesta.
       {t:'restaurar', n, version}               sólo admin.
       {t:'ping', ts}
     servidor → cliente
       {t:'bienvenida', v:1, id, rol, semilla, seq, huella, modo:'completo', mundo}   o   modo:'incremental', ops:[{seq,op,autor,h}]
       {t:'ok', n, seq, huella, sinCambio?}      la edición se aceptó, se guardó y es la versión `seq`
       {t:'op', seq, op, autor, huella}          alguien más editó: aplicarla con NV.mundo.editar (en orden; un salto de seq = pedir el mundo de nuevo)
       {t:'mundo', seq, huella, mundo, motivo}   reemplazo completo (restauración o importación)
       {t:'error', n?, codigo, motivo}           codigos: version, token, permiso, invalida, formato, desconocido, ritmo, orden
       {t:'pong', ts}
   HTTP: GET /salud · GET /copia (admin, Authorization: Bearer <token>) · POST /importar (admin, cuerpo = la copia)
   Seguridad: sólo el servidor decide qué se acepta (los clientes no imponen nada); un rol sin permiso recibe 'permiso' y no cambia nada;
   mensajes con tope de tamaño, tope de ritmo por conexión, latidos que cierran conexiones muertas, lista opcional de orígenes. */
'use strict';
const http=require('http');
const {WebSocketServer}=require('ws');
const {abrirMundoOficial}=require('./mundo-oficial.js');
const {crearIdentidad,puede}=require('./identidad.js');
const VERSION=1;

async function iniciarServidor(op){
  op=op||{};
  const mo=await abrirMundoOficial({dir:op.dir,cadaN:op.cadaN});
  const ident=op.identidad||crearIdentidad({adminTokens:op.adminTokens});
  const lim={mensaje:op.maxMensaje||256*1024, copia:op.maxCopia||32*1024*1024, clientes:op.maxClientes||200, porSegundo:op.maxPorSegundo||60, lento:8*1024*1024};
  const log=op.log||(()=>{}), clientes=new Set();
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

  /* ---------------- HTTP ---------------- */
  const cabecerasCors=(req,res)=>{
    const o=req.headers.origin;
    if(o&&origenOk(o)){ res.setHeader('Access-Control-Allow-Origin',o); res.setHeader('Vary','Origin'); res.setHeader('Access-Control-Allow-Headers','authorization,content-type'); res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS'); }
  };
  const json=(res,code,o,extra)=>{ res.writeHead(code,Object.assign({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'},extra||{})); res.end(JSON.stringify(o)); };
  const adminDe=req=>{ const m=/^Bearer\s+(.+)$/.exec(req.headers.authorization||''); const id=m&&ident.autenticar(m[1]); return id&&puede(id.rol,'copia')?id:null; };
  const server=http.createServer(async(req,res)=>{
    cabecerasCors(req,res);
    try{
      const url=req.url.split('?')[0];
      if(req.method==='OPTIONS'){ res.writeHead(204); return res.end(); }
      if(req.headers.origin&&!origenOk(req.headers.origin)) return json(res,403,{error:'origen no permitido'});
      if(req.method==='GET'&&url==='/salud') return json(res,200,{ok:true,version:VERSION,seq:mo.seq(),huella:mo.huella(),clientes:clientes.size,semilla:mo.NV.CONFIG.seed});
      if(req.method==='GET'&&url==='/copia'){
        const id=adminDe(req); if(!id) return json(res,401,{error:'hace falta la clave de administrador'});
        const c=await mo.copiaCompleta();
        return json(res,200,c,{'Content-Disposition':'attachment; filename="nativa-copia-v'+c.seq+'.json"'});
      }
      if(req.method==='POST'&&url==='/importar'){
        const id=adminDe(req); if(!id) return json(res,401,{error:'hace falta la clave de administrador'});
        const trozos=[]; let n=0;
        for await(const t of req){ n+=t.length; if(n>lim.copia){ res.writeHead(413); return res.end(); } trozos.push(t); }
        let copia; try{ copia=JSON.parse(Buffer.concat(trozos).toString('utf8')); }catch(e){ return json(res,400,{error:'no es JSON'}); }
        let r; try{ r=await mo.importarConEstado(copia,id.usuarioId); }catch(e){ return json(res,422,{error:e.message}); }
        difundir(mensajeMundo(r.estado,'importar'),null);
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
    ws.on('close',()=>{ clearTimeout(reloj); clientes.delete(c); if(c.usuarioId) log('se fue '+c.usuarioId); });
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

  async function manejar(c,m){
    if(m.t==='ping'){ enviar(c,{t:'pong',ts:m.ts}); return; }
    if(m.t==='hola'){
      if(c.estado!=='nuevo'){ error(c,undefined,'orden','ya saludaste'); return; }
      if(m.v!==VERSION){ error(c,undefined,'version','este servidor habla la versión '+VERSION); c.ws.close(4002,'versión'); return; }
      const id=ident.autenticar(m.token); if(!id){ error(c,undefined,'token','identidad inválida'); c.ws.close(4003,'token'); return; }
      c.usuarioId=id.usuarioId; c.rol=id.rol; c.estado='entrando';
      let inc=null; if(m.desde!==undefined) inc=await mo.operacionesDesde(m.desde,m.huella);
      const base={t:'bienvenida',v:VERSION,id:c.usuarioId,rol:c.rol,semilla:mo.NV.CONFIG.seed};
      if(inc){ c.seq=inc.seq; enviar(c,Object.assign(base,{seq:inc.seq,huella:inc.huella,modo:'incremental',ops:inc.ops})); }
      else { const e=await mo.estado(); c.seq=e.seq; enviar(c,Object.assign(base,{seq:e.seq,huella:e.huella,modo:'completo',mundo:e.mundo})); }
      c.estado='listo';
      for(const q of c.cola){ if(q.t==='mundo'){ if(q.seq>c.seq){ enviar(c,q); c.seq=q.seq; } } else if(q.seq>c.seq){ enviar(c,q); c.seq=q.seq; } }
      c.cola=[]; log('entró '+c.usuarioId+' ('+c.rol+', '+(inc?'incremental':'completo')+')'); return;
    }
    if(c.estado!=='listo'){ error(c,m.n,'orden','primero hay que saludar'); return; }
    if(m.t==='editar'){
      if(!puede(c.rol,'editar')){ error(c,m.n,'permiso','sólo un administrador puede editar el mundo oficial'); return; }
      let r; try{ r=await mo.aplicar(m.op,c.usuarioId); }catch(e){ error(c,m.n,'invalida',e.message); return; }
      if(r.sinCambio){ enviar(c,{t:'ok',n:m.n,seq:r.seq,huella:r.huella,sinCambio:true}); return; }
      c.seq=Math.max(c.seq,r.seq);
      enviar(c,{t:'ok',n:m.n,seq:r.seq,huella:r.huella});
      difundir({t:'op',seq:r.seq,op:m.op,autor:c.usuarioId,huella:r.huella},c);
      return;
    }
    if(m.t==='restaurar'){
      if(!puede(c.rol,'restaurar')){ error(c,m.n,'permiso','sólo un administrador puede restaurar versiones'); return; }
      let r; try{ r=await mo.restaurarConEstado(m.version,c.usuarioId); }catch(e){ error(c,m.n,'invalida',e.message); return; }
      log('restauró la versión '+m.version+' → '+r.r.seq+' ('+c.usuarioId+')');
      enviar(c,{t:'ok',n:m.n,seq:r.r.seq,huella:r.r.huella});
      difundir(mensajeMundo(r.estado,'restaurar'),null);
      return;
    }
    error(c,m.n,'desconocido','mensaje desconocido: '+m.t.slice(0,40));
  }

  const latido=setInterval(()=>{ for(const c of clientes){ if(!c.vivo){ c.ws.terminate(); continue; } c.vivo=false; try{ c.ws.ping(); }catch(e){} } },op.latido||20000);
  await new Promise((ok,no)=>{ server.once('error',no); server.listen(op.puerto||0,op.host||'0.0.0.0',ok); });
  const puerto=server.address().port;
  log('servidor del mundo oficial en el puerto '+puerto+' · versión '+mo.seq()+' · semilla '+mo.NV.CONFIG.seed);

  return {puerto,mundo:mo,clientes:()=>clientes.size,
    async cerrar(){
      cerrando=true; clearInterval(latido);
      for(const c of clientes) try{ c.ws.close(1001,'el servidor se apaga'); }catch(e){}
      await new Promise(ok=>{ wss.close(()=>ok()); });
      await new Promise(ok=>{ server.close(()=>ok()); if(server.closeAllConnections) server.closeAllConnections(); });
      await mo.cerrar();
    }};
}
module.exports={iniciarServidor,VERSION};

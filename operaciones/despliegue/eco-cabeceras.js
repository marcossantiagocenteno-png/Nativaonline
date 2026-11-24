/* Nativa Online — instrumentos para comprobar la CONDICIÓN 2 de NATIVA_CONFIAR_PROXY (docs/DISENO.md): ¿qué le llega al servidor en X-Forwarded-For?
   Dos usos de operaciones/despliegue/probar-proxy.js; aquí está la parte reutilizable y probada:
     · crearEco()                un servidor mínimo que anota las cabeceras de la primera petición que no sea /salud y las devuelve;
     · evaluar(recibida, falsa, ipEsperada)   el veredicto sobre lo que llegó.
   Reglas del veredicto (el freno usa el ÚLTIMO elemento):
     sin cabecera                     → FALLA (el proxy no informa de quién es el cliente: todos parecerían la misma persona)
     último elemento = el inventado   → FALLA (el proxy dejó pasar lo que escribió el cliente: el freno se puede esquivar)
     último elemento = ipEsperada     → BIEN (el proxy puso la dirección real al final; da igual si dejó o quitó lo anterior)
     último elemento distinto         → FALLA (otro proxy delante, o el proxy no pone la dirección real)
     sin ipEsperada                   → REVISAR (queda a juicio humano: ¿el último elemento es tu dirección pública?) */
'use strict';
const http=require('http');
const lista=h=>String(h||'').split(',').map(s=>s.trim()).filter(Boolean);
function evaluar(recibida,falsa,ipEsperada){
  const l=lista(recibida);
  if(!l.length) return {ok:false,veredicto:'FALLA',motivo:'no llegó X-Forwarded-For: el proxy no informa de quién se conecta; con NATIVA_CONFIAR_PROXY=1 todos los visitantes compartirían una sola cuenta de intentos.',elementos:l};
  const ultimo=l[l.length-1];
  if(ultimo===falsa) return {ok:false,veredicto:'FALLA',motivo:'el último elemento es el que inventó el cliente: el proxy no añade la dirección real, así que cualquiera puede esquivar el freno.',elementos:l};
  if(!ipEsperada) return {ok:null,veredicto:'REVISAR',motivo:'el último elemento es «'+ultimo+'»: comprueba que es TU dirección pública (la de quien envió la prueba). Si lo es, la condición 2 se cumple.',elementos:l,ultimo};
  if(ultimo===ipEsperada) return {ok:true,veredicto:'BIEN',motivo:'el último elemento es la dirección real del cliente'+(l.includes(falsa)?' y el valor inventado quedó antes (el proxy añade al final)':' (el proxy reemplazó lo que escribió el cliente)')+'.',elementos:l,ultimo};
  return {ok:false,veredicto:'FALLA',motivo:'el último elemento es «'+ultimo+'», no «'+ipEsperada+'»: hay otro proxy delante, o el proxy no pone la dirección real al final.',elementos:l,ultimo};
}
function crearEco({puerto,host}={}){
  const visto=[]; let resolver=null; const primera=new Promise(r=>{ resolver=r; });
  const srv=http.createServer((req,res)=>{
    const dato={metodo:req.method,url:req.url,xff:req.headers['x-forwarded-for']||null,remota:req.socket.remoteAddress,host:req.headers.host||null};
    res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify(dato));
    if(req.url!=='/salud'){ visto.push(dato); resolver(dato); }
  });
  return {srv,visto,primera,iniciar:()=>new Promise((ok,no)=>{ srv.once('error',no); srv.listen(puerto||0,host||'127.0.0.1',()=>ok(srv.address().port)); }),cerrar:()=>new Promise(r=>{ srv.close(()=>r()); if(srv.closeAllConnections) srv.closeAllConnections(); })};
}
module.exports={evaluar,crearEco,lista};

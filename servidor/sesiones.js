/* Nativa Online — SESIONES DE ADMINISTRADOR y FRENO DE INTENTOS.
   El administrador entra con su contraseña UNA vez (POST /entrar) y recibe una sesión firmada. Esa sesión es lo único que el
   servidor acepta como prueba de administrador: la contraseña nunca viaja por la conexión del juego ni se guarda en el navegador.

   La sesión es   s1.<datos en base64url>.<firma en base64url>   y la firma es HMAC-SHA256 con una CLAVE DE SESIÓN propia
   (NATIVA_SESION_CLAVE), distinta de la contraseña: quien conozca una no puede fabricar la otra.
   Los datos llevan: id de usuario al azar, rol, vencimiento, un identificador único (para poder revocarla) y una marca de la
   contraseña vigente: si se cambia la contraseña, todas las sesiones anteriores dejan de valer.
   Una sesión alterada, de otro servidor, vencida, revocada o de una contraseña anterior se rechaza. Nada se escribe en registros. */
'use strict';
const crypto=require('crypto');
const b64=b=>Buffer.from(b).toString('base64url');
const sha=t=>crypto.createHash('sha256').update(String(t)).digest();
const hmac=(clave,t)=>crypto.createHmac('sha256',clave).update(t).digest();
const iguales=(a,b)=>a.length===b.length&&crypto.timingSafeEqual(a,b);
const MIN_CLAVE_SESION=32;

function crearSesiones(op){
  const ahora=op.ahora||Date.now;
  const vigencia=op.vigenciaMs||12*3600*1000;
  const clave=op.claveSesion;
  if(typeof clave!=='string'||clave.length<MIN_CLAVE_SESION) throw new Error('la clave de sesión tiene que tener al menos '+MIN_CLAVE_SESION+' caracteres');
  /* la clave de sesión no puede ser una contraseña de administrador (ni contenerla): son secretos distintos */
  for(const a of (op.adminClaves||[])) if(clave===a||clave.includes(a)) throw new Error('la clave de sesión no puede ser (ni contener) la contraseña de administrador');
  const hashesAdmin=(op.adminClaves||[]).map(sha).sort(Buffer.compare);
  const marca=b64(hmac(clave,'marca|'+Buffer.concat(hashesAdmin).toString('hex'))).slice(0,16);   // cambia si cambia la contraseña
  const llave=hmac(clave,'firma-de-sesiones-v1');
  const revocadas=new Map();            // id único → vencimiento
  const limpiar=()=>{ const t=ahora(); for(const [k,e] of revocadas) if(e<t) revocadas.delete(k); };

  return {
    emitir(){
      const datos={u:crypto.randomBytes(6).toString('hex'),r:'admin',e:ahora()+vigencia,j:crypto.randomBytes(9).toString('hex'),k:marca};
      const cuerpo=b64(JSON.stringify(datos));
      return {sesion:'s1.'+cuerpo+'.'+b64(hmac(llave,'s1.'+cuerpo)),vence:datos.e,usuarioId:datos.u,id:datos.j};
    },
    /* devuelve {usuarioId, rol:'admin', id, vence} o null */
    verificar(s){
      if(typeof s!=='string'||s.length>600) return null;
      const p=s.split('.'); if(p.length!==3||p[0]!=='s1') return null;
      let firma; try{ firma=Buffer.from(p[2],'base64url'); }catch(e){ return null; }
      if(!iguales(firma,hmac(llave,'s1.'+p[1]))) return null;
      let d; try{ d=JSON.parse(Buffer.from(p[1],'base64url').toString('utf8')); }catch(e){ return null; }
      if(!d||d.r!=='admin'||typeof d.u!=='string'||typeof d.j!=='string'||typeof d.e!=='number') return null;
      if(d.k!==marca||d.e<=ahora()||revocadas.has(d.j)) return null;
      return {usuarioId:d.u,rol:'admin',id:d.j,vence:d.e};
    },
    revocar(s){ const v=this.verificar(s); if(!v) return null; limpiar(); revocadas.set(v.id,v.vence); return v; }
  };
}

/* Freno de intentos por origen de red: tras `maxFallos` fallos en `ventanaMs` se bloquea hasta que el más viejo salga de la ventana. */
function crearFreno(op){
  op=op||{}; const ahora=op.ahora||Date.now, max=op.maxFallos||5, ventana=op.ventanaMs||10*60*1000, tope=op.maxEntradas||5000;
  const fallos=new Map();
  const vivos=k=>{ const t=ahora(); const l=(fallos.get(k)||[]).filter(x=>t-x<ventana); if(l.length) fallos.set(k,l); else fallos.delete(k); return l; };
  return {
    /* {ok:true} o {ok:false, esperarMs} */
    consultar(k){ const l=vivos(k); if(l.length<max) return {ok:true}; return {ok:false,esperarMs:Math.max(1000,l[0]+ventana-ahora())}; },
    fallo(k){
      if(fallos.size>=tope&&!fallos.has(k)){ for(const x of fallos.keys()) vivos(x); if(fallos.size>=tope) fallos.delete(fallos.keys().next().value); }
      const l=vivos(k); l.push(ahora()); fallos.set(k,l);
    },
    acierto(k){ fallos.delete(k); }
  };
}
module.exports={crearSesiones,crearFreno,MIN_CLAVE_SESION};

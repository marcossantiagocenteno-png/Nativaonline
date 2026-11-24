/* Nativa Online — SESIONES DE ADMINISTRADOR y FRENO DE INTENTOS.
   El administrador entra con su contraseña UNA vez (POST /entrar) y recibe una sesión firmada. Esa sesión es lo único que el
   servidor acepta como prueba de administrador: la contraseña nunca viaja por la conexión del juego ni se guarda en el navegador.

   La sesión es   s1.<datos en base64url>.<firma en base64url>   y la firma es HMAC-SHA256 con una CLAVE DE SESIÓN propia
   (NATIVA_SESION_CLAVE), distinta de la contraseña: quien conozca una no puede fabricar la otra.
   Los datos llevan: id de usuario al azar, rol, vencimiento, un identificador único (para poder revocarla) y una marca de la
   contraseña vigente: si se cambia la contraseña, todas las sesiones anteriores dejan de valer.
   Una sesión alterada, de otro servidor, vencida, revocada o de una contraseña anterior se rechaza. Nada se escribe en registros.

   REVOCACIONES: la lista de sesiones cerradas (id y vencimiento, nunca la sesión entera) se guarda en un archivo de la carpeta de datos
   (`archivoRevocadas`) cada vez que cambia, con escritura atómica (archivo temporal + renombrar). Al arrancar se lee, y las entradas
   vencidas se descartan (una sesión vencida ya no vale por sí sola). Si el archivo existe pero está dañado no se puede saber qué
   estaba cerrado: se aparta como «.danado-<hora>» y, por seguridad, TODAS las sesiones emitidas antes de ese arranque dejan de valer
   (cada sesión lleva su hora de emisión `i`). Una sesión cerrada nunca recupera permisos por reiniciar el servidor. */
'use strict';
const crypto=require('crypto');
const fs=require('fs'), path=require('path'), net=require('net');
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
  const archivo=op.archivoRevocadas||null;
  let desde=0;                          // sesiones emitidas antes de este instante no valen (sólo si el archivo de revocadas se dañó)
  const limpiar=()=>{ const t=ahora(); for(const [k,e] of revocadas) if(e<=t) revocadas.delete(k); };
  const guardar=()=>{
    if(!archivo) return;
    const tmp=archivo+'.tmp-'+process.pid;
    const txt=JSON.stringify({formato:'nativa-revocadas-1',desde,revocadas:[...revocadas].map(([j,e])=>({j,e}))});
    const fd=fs.openSync(tmp,'w',0o600);
    try{ fs.writeSync(fd,txt); fs.fsyncSync(fd); } finally{ fs.closeSync(fd); }
    fs.renameSync(tmp,archivo);
    try{ const d=fs.openSync(path.dirname(archivo),'r'); try{ fs.fsyncSync(d); } finally{ fs.closeSync(d); } }catch(e){ /* algunos sistemas no sincronizan carpetas */ }
  };
  const cargar=()=>{
    if(!archivo) return;
    let txt; try{ txt=fs.readFileSync(archivo,'utf8'); }catch(e){ if(e.code==='ENOENT') return; throw e; }
    let d=null;
    try{
      d=JSON.parse(txt);
      if(!d||d.formato!=='nativa-revocadas-1'||!Array.isArray(d.revocadas)||typeof d.desde!=='number') d=null;
      else for(const r of d.revocadas) if(!r||typeof r.j!=='string'||typeof r.e!=='number') { d=null; break; }
    }catch(e){ d=null; }
    if(!d){
      fs.renameSync(archivo,archivo+'.danado-'+ahora());
      desde=ahora();                    // no se sabe qué estaba cerrado: se cierra todo lo emitido hasta ahora
      return;
    }
    desde=d.desde; for(const r of d.revocadas) revocadas.set(r.j,r.e);
  };
  cargar(); limpiar(); guardar();       // al arrancar: leer, podar vencidas y dejar el archivo en limpio (también si estaba dañado)

  return {
    emitir(){
      const datos={u:crypto.randomBytes(6).toString('hex'),r:'admin',i:ahora(),e:ahora()+vigencia,j:crypto.randomBytes(9).toString('hex'),k:marca};
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
      if(desde&&!(typeof d.i==='number'&&d.i>=desde)) return null;
      return {usuarioId:d.u,rol:'admin',id:d.j,vence:d.e};
    },
    /* si el archivo no se puede escribir, la revocación vale igual en memoria pero se avisa (lanza): no se debe creer cerrada una sesión que un reinicio revivirá */
    revocar(s){ const v=this.verificar(s); if(!v) return null; limpiar(); revocadas.set(v.id,v.vence); guardar(); return v; },
    revocadasVigentes:()=>{ limpiar(); return revocadas.size; }
  };
}

/* Bloque de red al que se le cuenta un intento. IPv4: la dirección completa. IPv6: el bloque /64 (los primeros 64 bits), porque quien tiene
   una red IPv6 propia dispone de millones de direcciones dentro de su /64 y, contando por dirección, nunca agotaría el límite.
   Una dirección IPv4 escrita como IPv6 («::ffff:1.2.3.4») cuenta como la IPv4. Lo que no es una dirección válida se cuenta tal cual. */
function bloqueDeRed(ip){
  let t=String(ip||'?').trim().toLowerCase(); const z=t.indexOf('%'); if(z>=0) t=t.slice(0,z);
  const m=/^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(t); if(m) t=m[1];
  const v=net.isIP(t); if(v===4) return t; if(v!==6) return String(ip||'?').slice(0,64);
  let cola=null; const mm=/^(.*:)(\d+\.\d+\.\d+\.\d+)$/.exec(t);          // IPv4 incrustada al final: pasa a dos grupos de 16 bits
  if(mm){ const q=mm[2].split('.').map(Number); t=mm[1]+((q[0]<<8)|q[1]).toString(16)+':'+((q[2]<<8)|q[3]).toString(16); }
  const [a,b]=t.split('::'); const izq=a?a.split(':'):[]; const der=b===undefined?[]:(b?b.split(':'):[]);
  const g=b===undefined?izq:izq.concat(Array(Math.max(0,8-izq.length-der.length)).fill('0'),der);
  return g.slice(0,4).map(x=>x.padStart(4,'0')).join(':')+'::/64';
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
module.exports={crearSesiones,crearFreno,bloqueDeRed,MIN_CLAVE_SESION};

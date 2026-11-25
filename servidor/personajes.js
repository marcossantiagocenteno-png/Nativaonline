/* Nativa Online — PERSONAJES PERMANENTES: lo que el servidor recuerda de cada jugador entre conexiones.
   Un personaje es de un DISPOSITIVO (la identidad de invitado que el navegador guarda: identidad.js → usuarioId, 12 hex). Quien borra los datos del
   navegador o entra desde otro aparato estrena personaje; todavía no hay cuentas (DISENO.md: etapa futura).

   Qué se guarda (un archivo por personaje, datos/personajes/<usuarioId>.json):
     · identidad: usuarioId, nombre (el que le tocó al nacer, ahora permanente), creado, visto
     · ubicación: x, y (metros), mirando
     · progreso: nivel, experiencia, inventario [{id, cant}]
   El progreso lo escribe SÓLO el servidor (otorgarExperiencia, darObjeto, quitarObjeto…). Ningún mensaje del protocolo llega hasta acá: un cliente no
   puede darse nada. Hoy el juego no tiene mecánicas que lo usen (DISENO.md: «no hay botín, no hay barras de experiencia»): los campos están
   listos, con valores iniciales (nivel 1, experiencia 0, inventario vacío), y NUNCA se muestran como número al jugador.

   Integridad: cada archivo lleva su suma de control (campo `c`); se escribe a un temporal, se fuerza a disco y se renombra (o queda entero o no
   queda). Un archivo que no pasa la validación NO se borra ni se arregla a ojo: se aparta como <id>.json.danado-<hora> y el jugador estrena personaje.
   Los respaldos copian esta carpeta, la cubren con el manifiesto y la auditan con verificarCarpeta (más abajo) en el mismo proceso hijo que audita el mundo. */
'use strict';
const fs=require('fs'), path=require('path'), crypto=require('crypto');

const FORMATO=1;
const RE_ID=/^[0-9a-f]{12}$/, RE_ARCHIVO=/^([0-9a-f]{12})\.json$/, RE_OBJETO=/^[a-z0-9_-]{1,32}$/;
const DIRS=['norte','sur','este','oeste'];
const TOPES={coord:1e6,nivel:1000,experiencia:2e9,casillas:200,cantidad:9999,nombre:40};
const CAMPOS_EDITABLES=['nombre','x','y','mirando','nivel','experiencia','inventario'];

const sumaDe=r=>{ const o=Object.assign({},r); delete o.c; return crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0,16); };
const entero=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
const copiar=o=>JSON.parse(JSON.stringify(o));

/* null si el registro es válido; si no, el motivo */
function validar(r,idEsperado){
  if(!r||typeof r!=='object'||Array.isArray(r)) return 'no es un registro';
  if(r.formato!==FORMATO) return 'formato desconocido ('+r.formato+')';
  if(!RE_ID.test(r.id||'')) return 'identidad inválida';
  if(idEsperado&&r.id!==idEsperado) return 'la identidad ('+r.id+') no es la del archivo ('+idEsperado+')';
  if(typeof r.nombre!=='string'||!r.nombre.length||r.nombre.length>TOPES.nombre||/[\u0000-\u001f\u007f]/.test(r.nombre)) return 'nombre inválido';
  if(!entero(r.x,-TOPES.coord,TOPES.coord)||!entero(r.y,-TOPES.coord,TOPES.coord)) return 'ubicación inválida';
  if(!DIRS.includes(r.mirando)) return 'dirección inválida';
  if(!entero(r.nivel,1,TOPES.nivel)) return 'nivel inválido';
  if(!entero(r.experiencia,0,TOPES.experiencia)) return 'experiencia inválida';
  if(!Array.isArray(r.inventario)||r.inventario.length>TOPES.casillas) return 'inventario inválido';
  const vistos=new Set();
  for(const it of r.inventario){
    if(!it||typeof it!=='object'||!RE_OBJETO.test(it.id||'')||!entero(it.cant,1,TOPES.cantidad)) return 'objeto inválido en el inventario';
    if(vistos.has(it.id)) return 'objeto repetido en el inventario ('+it.id+')'; vistos.add(it.id);
  }
  if(!Number.isFinite(r.creado)||!Number.isFinite(r.visto)) return 'fechas inválidas';
  if(typeof r.c!=='string'||r.c!==sumaDe(r)) return 'la suma de control no coincide (archivo alterado o cortado)';
  return null;
}

function escribirAtomico(ruta,texto){
  const tmp=ruta+'.tmp-'+process.pid+'-'+Date.now();
  const fd=fs.openSync(tmp,'w');
  try{ fs.writeSync(fd,texto); fs.fsyncSync(fd); } finally{ fs.closeSync(fd); }
  fs.renameSync(tmp,ruta);
}

/* Revisa una carpeta de datos SIN modificarla (la usa la auditoría de los respaldos). {ok, problemas, cantidad, apartados} */
function verificarCarpeta(dirDatos){
  const d=path.join(dirDatos,'personajes'), problemas=[]; let cantidad=0, apartados=0;
  let nombres; try{ nombres=fs.readdirSync(d); }catch(e){ return {ok:true,problemas,cantidad:0,apartados:0}; }       // sin carpeta: no hay personajes
  for(const n of nombres.sort()){
    if(/\.danado-\d+$/.test(n)){ apartados++; continue; }
    const m=RE_ARCHIVO.exec(n); if(!m) continue;                         // temporales y archivos ajenos no cuentan
    let r; try{ r=JSON.parse(fs.readFileSync(path.join(d,n),'utf8')); }catch(e){ problemas.push(n+': no se puede leer ('+e.message.slice(0,60)+')'); continue; }
    const v=validar(r,m[1]); if(v) problemas.push(n+': '+v); else cantidad++;
  }
  return {ok:problemas.length===0,problemas,cantidad,apartados};
}

function crearPersonajes(op){
  const dir=path.join(path.resolve(op.dir),'personajes'), ahora=op.ahora||Date.now, log=op.log||(()=>{});
  fs.mkdirSync(dir,{recursive:true});
  const registros=new Map(), sucios=new Set();
  let apartados=0;

  const ruta=id=>path.join(dir,id+'.json');
  const aparta=(n,motivo)=>{ try{ fs.renameSync(path.join(dir,n),path.join(dir,n+'.danado-'+Date.now())); apartados++; }catch(e){} log('personaje apartado '+n+': '+motivo); };
  /* al abrir: se leen todos (así un archivo dañado se aparta ya, no cuando el jugador vuelva y el respaldo ya haya fallado por eso) */
  for(const n of fs.readdirSync(dir).sort()){
    const m=RE_ARCHIVO.exec(n); if(!m) continue;
    let r=null, motivo=null;
    try{ r=JSON.parse(fs.readFileSync(path.join(dir,n),'utf8')); motivo=validar(r,m[1]); }catch(e){ motivo='no se puede leer: '+e.message.slice(0,60); }
    if(motivo) aparta(n,motivo); else registros.set(m[1],r);
  }

  const sellar=r=>{ r.c=sumaDe(r); return r; };
  function escribir(id){
    const r=registros.get(id); if(!r) return;
    sellar(r); const v=validar(r,id); if(v) throw new Error('personaje '+id+' inválido, no se guarda: '+v);
    escribirAtomico(ruta(id),JSON.stringify(r)+'\n'); sucios.delete(id);
  }
  const existe=id=>registros.has(id);

  return {
    existe,
    cantidad:()=>registros.size, apartados:()=>apartados, dir,
    obtener:id=>registros.has(id)?copiar(registros.get(id)):null,
    /* personaje nuevo (queda en disco al instante). Si ya existía, no lo pisa: devuelve el que había. */
    crear(id,perfil){
      if(!RE_ID.test(id||'')) throw new Error('identidad inválida');
      if(registros.has(id)) return copiar(registros.get(id));
      const t=ahora(), p=perfil||{};
      const r={formato:FORMATO,id,nombre:p.nombre,x:p.x,y:p.y,mirando:p.mirando||'sur',nivel:1,experiencia:0,inventario:[],creado:t,visto:t};
      sellar(r); const v=validar(r,id); if(v) throw new Error('no se puede crear el personaje: '+v);
      registros.set(id,r); escribir(id); return copiar(r);
    },
    /* cambia campos permitidos; devuelve true si algo cambió. Se guarda con guardarPendientes() (o guardar(id) al instante). */
    actualizar(id,parche){
      const r=registros.get(id); if(!r) return false;
      const nuevo=copiar(r); let cambio=false;
      for(const k of Object.keys(parche||{})){
        if(!CAMPOS_EDITABLES.includes(k)) throw new Error('campo no editable: '+k);
        if(JSON.stringify(nuevo[k])!==JSON.stringify(parche[k])){ nuevo[k]=copiar(parche[k]); cambio=true; }
      }
      if(!cambio) return false;
      nuevo.visto=ahora(); sellar(nuevo);
      const v=validar(nuevo,id); if(v) throw new Error('cambio rechazado: '+v);
      registros.set(id,nuevo); sucios.add(id); return true;
    },
    /* progreso: sólo el servidor lo llama (ningún mensaje del protocolo llega hasta acá) */
    otorgarExperiencia(id,n){
      const r=registros.get(id); if(!r||!entero(n,0,TOPES.experiencia)) throw new Error('experiencia inválida');
      this.actualizar(id,{experiencia:Math.min(TOPES.experiencia,r.experiencia+n)}); return this.obtener(id).experiencia;
    },
    darObjeto(id,objeto,cant){
      const r=registros.get(id); if(!r||!RE_OBJETO.test(objeto||'')||!entero(cant,1,TOPES.cantidad)) throw new Error('objeto inválido');
      const inv=copiar(r.inventario), it=inv.find(x=>x.id===objeto);
      if(it){ if(it.cant+cant>TOPES.cantidad) throw new Error('no cabe tanto de '+objeto); it.cant+=cant; }
      else { if(inv.length>=TOPES.casillas) throw new Error('el inventario está lleno'); inv.push({id:objeto,cant}); }
      this.actualizar(id,{inventario:inv}); return true;
    },
    quitarObjeto(id,objeto,cant){
      const r=registros.get(id); if(!r||!RE_OBJETO.test(objeto||'')||!entero(cant,1,TOPES.cantidad)) throw new Error('objeto inválido');
      const inv=copiar(r.inventario), i=inv.findIndex(x=>x.id===objeto);
      if(i<0||inv[i].cant<cant) return false;
      inv[i].cant-=cant; if(inv[i].cant===0) inv.splice(i,1);
      this.actualizar(id,{inventario:inv}); return true;
    },
    guardar(id){ escribir(id); },
    /* escribe lo pendiente; un fallo de disco de un personaje se anota y no frena a los demás ni al servidor */
    guardarPendientes(){
      let n=0; for(const id of Array.from(sucios)){ try{ escribir(id); n++; }catch(e){ log('no se pudo guardar el personaje '+id+': '+e.message); } }
      return n;
    },
    pendientes:()=>sucios.size
  };
}
module.exports={crearPersonajes,verificarCarpeta,validar,FORMATO,TOPES};

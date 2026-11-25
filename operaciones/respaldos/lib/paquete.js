/* Nativa Online — respaldos: arma UN paquete cifrado a partir de una carpeta de datos que puede estar en uso.
     copiar (orden seguro) → auditar con el código del servidor → [reintentar] → sumar el código y el manifiesto → escanear secretos →
     empaquetar → volver a abrir el paquete y comparar archivo por archivo → cifrar con age → sidecar.
   Si cualquier paso falla se lanza un error y NO queda nada subible. Lo único que sale de aquí es un .age ya verificado. */
'use strict';
const fs=require('fs'), path=require('path'), os=require('os');
const {ejecutar,escribirAtomico,hashArchivo,listarArbol,igualesArboles,log,espera,marca}=require('./comun.js');
const {copiarOrdenado}=require('./copia.js');
const {copiarCodigo,entorno}=require('./codigo.js');
const {verificarEnHijo}=require('./verificar-hijo.js');
const {escanear}=require('./secretos.js');
const {cifrar,inspeccionarCabecera}=require('./cifrado.js');

function tarCrear(salida,stage){
  const base=['-czf',salida,'-C',stage];
  const r=ejecutar('tar',['--sort=name','--owner=0','--group=0','--numeric-owner'].concat(base,['manifiesto.json','datos','codigo']),{tolerar:true});
  if(r.status!==0) ejecutar('tar',base.concat(['manifiesto.json','datos','codigo']));
}
/* el nombre de una línea de `tar -tv`. GNU tar (Linux): «permisos dueño/grupo tamaño fecha hora nombre».
   bsdtar (el tar.exe de Windows): «permisos enlaces dueño grupo tamaño mes día hora|año nombre». Se reconoce el de bsdtar por su forma
   (enlaces numéricos y mes en letras); cualquier otra cosa se lee como GNU, igual que antes. */
const PREFIJO_BSD=/^\S+\s+\d+\s+\S+\s+\S+\s+\d+\s+[A-Z][a-z]{2}\s+\d{1,2}\s+(?:\d{1,2}:\d{2}|\d{4})\s+/;
const PREFIJO_GNU=/^\S+\s+\S+\s+\S+\s+\S+\s+\S+\s+/;
const nombreDeLinea=l=>l.replace(PREFIJO_BSD.test(l)?PREFIJO_BSD:PREFIJO_GNU,'').replace(/ -> .*$/,'');

/* sólo archivos y carpetas normales, dentro de manifiesto.json / datos/ / codigo/; nada de rutas absolutas, «..» ni enlaces.
   Se leen DOS listados del mismo paquete, en el mismo orden: el detallado (`-tv`) sólo para la primera letra de cada línea (el tipo: «-» archivo,
   «d» carpeta, «l»/«h» enlace…) y el simple (`-t`) para los nombres. Así no importa cómo escriba la fecha cada tar (el tar.exe de Windows la escribe
   según el idioma: «nov. 25 10:23») ni si termina las líneas con \r\n. Si los dos listados no tienen el mismo número de entradas (un nombre con
   salto de línea, por ejemplo), se rechaza el paquete: ante la duda, no. */
const lineas=t=>String(t).split('\n').map(x=>x.replace(/\r$/,'')).filter(Boolean);
function revisarContenido(tgz){
  const tipos=lineas(ejecutar('tar',['-tvzf',tgz]).stdout), nombres=lineas(ejecutar('tar',['-tzf',tgz]).stdout), malos=[];
  if(tipos.length!==nombres.length) return ['el listado del paquete no es consistente ('+tipos.length+' entradas detalladas, '+nombres.length+' nombres)'];
  for(let i=0;i<nombres.length;i++){
    const tipo=tipos[i][0], nombre=nombres[i];
    if(tipo!=='-'&&tipo!=='d') malos.push('entrada que no es archivo ni carpeta: '+nombre.slice(0,80));
    else if(nombre.startsWith('/')||nombre.split('/').includes('..')) malos.push('ruta peligrosa: '+nombre);
    else if(!/^(manifiesto\.json|datos(\/.*)?|codigo(\/.*)?)$/.test(nombre.replace(/\/$/,''))) malos.push('fuera de lugar: '+nombre);
  }
  return malos;
}

/* ---- espacio en disco: el respaldo NO empieza si no cabe ----
   Una carpeta de trabajo en el mismo disco que los datos puede llenarlo: sin sitio, el servidor en marcha no podría escribir su diario ni
   sus instantáneas. Por eso se comprueba ANTES de crear nada. Lo que se necesita es, como mucho, la copia (1×) + el .tar.gz (1×, aunque no
   comprimiera) + el paquete reabierto para compararlo (1×) + el .age (1×) = 4× el tamaño de los datos, más el código y una reserva que se
   deja intacta (más grande si es el mismo disco que los datos: ahí vive el mundo en vivo). */
const ESPACIO_FACTOR=4, ESPACIO_CODIGO=16*1048576, RESERVA_MISMO_DISCO_MB=512, RESERVA_OTRO_DISCO_MB=64;
function tamanoCarpeta(dir,conRespaldos){
  let t=0;
  (function rec(d,esRaiz){
    let es; try{ es=fs.readdirSync(d,{withFileTypes:true}); }catch(e){ return; }
    for(const e of es){
      if(e.name==='.lock'||e.name.includes('.tmp-')) continue;
      if(esRaiz&&e.name==='respaldos'&&!conRespaldos) continue;
      const r=path.join(d,e.name);
      if(e.isDirectory()) rec(r,false); else if(e.isFile()){ try{ t+=fs.statSync(r).size; }catch(x){} }
    }
  })(dir,true);
  return t;
}
function ancestroExistente(p){ while(!fs.existsSync(p)){ const u=path.dirname(p); if(u===p) break; p=u; } return p; }
function mb(n){ return Math.ceil(n/1048576); }
/* Devuelve {ok,libre,necesario,...}. Si no se puede medir el disco no se bloquea el respaldo (sería peor perder todas las copias). */
function revisarEspacio(op){
  const base=ancestroExistente(op.trabajo);
  let libre;
  try{ if(op.libre) libre=op.libre(base); else { const s=fs.statfsSync(base); libre=s.bavail*s.bsize; } }
  catch(e){ log('aviso','no pude medir el espacio libre en '+base+'; se sigue sin esa comprobación',{error:e.message}); return {ok:true,medido:false}; }
  let mismoDisco=false; try{ mismoDisco=fs.statSync(op.origen).dev===fs.statSync(base).dev; }catch(e){}
  const reserva=(op.reservaMB!=null?op.reservaMB:(mismoDisco?RESERVA_MISMO_DISCO_MB:RESERVA_OTRO_DISCO_MB))*1048576;
  const datos=tamanoCarpeta(op.origen,!!op.respaldos), necesario=ESPACIO_FACTOR*datos+ESPACIO_CODIGO+reserva;
  return {ok:libre>=necesario,medido:true,libre,necesario,datos,reserva,mismoDisco,base};
}

async function construirPaquete(op){
  const {origen,vivo,codigo,destinatarios,etiqueta,respaldos,ahora,memoriaMB}=op, intentos=op.intentos||3;
  const esp=revisarEspacio(op);
  if(!esp.ok) throw new Error('no hay espacio para respaldar: en '+esp.base+' quedan '+mb(esp.libre)+' MB libres y hacen falta '+mb(esp.necesario)
    +' MB ('+ESPACIO_FACTOR+'× los '+mb(esp.datos)+' MB de datos + código + una reserva de '+mb(esp.reserva)+' MB'+(esp.mismoDisco?', porque es el mismo disco que el mundo en vivo':'')
    +'). NO se empieza: un disco lleno pondría en riesgo el mundo en marcha. No se creó nada.');
  fs.mkdirSync(op.trabajo,{recursive:true});
  const work=fs.mkdtempSync(path.join(op.trabajo,'respaldo-')), stage=path.join(work,'stage'); fs.mkdirSync(stage);
  try{
    let verif=null, copia=null; const fallos=[];
    for(let i=1;i<=intentos;i++){
      fs.rmSync(path.join(stage,'datos'),{recursive:true,force:true});
      copia=copiarOrdenado(origen,path.join(stage,'datos'),{respaldos});
      verif=verificarEnHijo({dir:path.join(stage,'datos'),codigo,vivo,memoriaMB});
      if(verif.ok){ verif.intentos=i; break; }
      fallos.push('intento '+i+': '+verif.problemas.join(' / ')); log('aviso','copia no válida, se reintenta',{intento:i,problemas:verif.problemas});
      if(i<intentos) await espera(2000*i);
    }
    if(!verif.ok) throw new Error('la copia no superó la auditoría tras '+intentos+' intentos — NO se sube nada. '+fallos.join(' | '));
    const cod=copiarCodigo(codigo,path.join(stage,'codigo'));
    /* restaurar audita con el código QUE VIAJA en el respaldo. Si hay personajes pero ese código no trae servidor/personajes.js (no está en git: falta el commit),
       la copia pasaría hoy y no se podría auditar mañana: se aborta ahora, a la vista, y no se sube nada. */
    if(copia.personajes>0&&fs.existsSync(path.join(codigo,'servidor','personajes.js'))&&!fs.existsSync(path.join(stage,'codigo','servidor','personajes.js')))
      throw new Error('el código que viaja en el respaldo no incluye servidor/personajes.js (¿falta el commit?): sin él, una restauración no podría auditar a los personajes. NO se sube nada.');
    const meta=JSON.parse(fs.readFileSync(path.join(stage,'datos','meta.json'),'utf8'));
    const man={
      formato:'nativa-respaldo-1',creado:ahora.toISOString(),etiqueta,semilla:meta.semilla,
      seq:verif.seq,huella:verif.huella,versiones:verif.versiones,instantaneas:verif.instantaneas,
      auditoria:{ok:true,ms:verif.ms,intentos:verif.intentos},vivoCoincide:verif.vivoCoincide===true,
      commit:cod.commit,arbolSucio:cod.arbolSucio,codigoDeGit:cod.git,entorno:entorno(codigo),
      omitidos:copia.omitidos,sinRespaldos:copia.sinRespaldos,personajes:verif.personajes||0,archivos:listarArbol(stage)
    };
    escribirAtomico(path.join(stage,'manifiesto.json'),JSON.stringify(man,null,1));
    const secretos=escanear(stage);
    if(secretos.length) throw new Error('el paquete llevaría secretos, se aborta: '+secretos.slice(0,3).join('; '));
    const tgz=path.join(work,'paquete.tar.gz'); tarCrear(tgz,stage);
    const malos=revisarContenido(tgz); if(malos.length) throw new Error('el paquete tiene contenido inesperado: '+malos.slice(0,3).join('; '));
    const chk=path.join(work,'chk'); fs.mkdirSync(chk); ejecutar('tar',['-xzf',tgz,'-C',chk,'--no-same-owner']);
    const arbol=listarArbol(chk); delete arbol['manifiesto.json'];
    const dif=igualesArboles(man.archivos,arbol); if(dif.length) throw new Error('el paquete reabierto no coincide con lo copiado: '+dif.slice(0,3).join(', '));
    const age=path.join(work,'paquete.tar.gz.age'); cifrar(tgz,age,destinatarios);
    const cab=inspeccionarCabecera(age);
    if(!cab.valido||cab.destinatarios!==destinatarios.length) throw new Error('el cifrado no quedó con los '+destinatarios.length+' destinatarios esperados');
    const nombre=marca(ahora)+'-seq'+man.seq+'-'+man.huella.slice(0,8);
    const lado={
      formato:'nativa-respaldo-meta-1',etiqueta,creado:man.creado,semilla:man.semilla,seq:man.seq,huella:man.huella,versiones:man.versiones,
      instantaneas:man.instantaneas,auditoria:'ok',auditoriaMs:verif.ms,vivoCoincide:man.vivoCoincide,commit:man.commit,arbolSucio:man.arbolSucio,
      node:man.entorno.node,arquitectura:man.entorno.arquitectura,cifrado:'age',destinatarios:cab.destinatarios,
      sinRespaldos:man.sinRespaldos,omitidos:man.omitidos,personajes:man.personajes||0,sha256:hashArchivo(age),tamano:fs.statSync(age).size
    };
    return {work,age,nombre,lado,seq:man.seq,huella:man.huella,limpiar(){ fs.rmSync(work,{recursive:true,force:true}); }};
  }catch(e){ fs.rmSync(work,{recursive:true,force:true}); throw e; }
}
module.exports={construirPaquete,revisarContenido,revisarEspacio,tamanoCarpeta,nombreDeLinea};

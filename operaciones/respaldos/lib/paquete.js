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
/* sólo archivos y carpetas normales, dentro de manifiesto.json / datos/ / codigo/; nada de rutas absolutas, «..» ni enlaces */
function revisarContenido(tgz){
  const lista=String(ejecutar('tar',['-tvzf',tgz]).stdout).split('\n').filter(Boolean), malos=[];
  for(const l of lista){
    const tipo=l[0], nombre=l.replace(/^\S+\s+\S+\s+\S+\s+\S+\s+\S+\s+/,'').replace(/ -> .*$/,'');
    if(tipo!=='-'&&tipo!=='d') malos.push('entrada que no es archivo ni carpeta: '+l.slice(0,80));
    else if(nombre.startsWith('/')||nombre.split('/').includes('..')) malos.push('ruta peligrosa: '+nombre);
    else if(!/^(manifiesto\.json|datos(\/.*)?|codigo(\/.*)?)$/.test(nombre.replace(/\/$/,''))) malos.push('fuera de lugar: '+nombre);
  }
  return malos;
}

async function construirPaquete(op){
  const {origen,vivo,codigo,destinatarios,etiqueta,respaldos,ahora,memoriaMB}=op, intentos=op.intentos||3;
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
    const meta=JSON.parse(fs.readFileSync(path.join(stage,'datos','meta.json'),'utf8'));
    const man={
      formato:'nativa-respaldo-1',creado:ahora.toISOString(),etiqueta,semilla:meta.semilla,
      seq:verif.seq,huella:verif.huella,versiones:verif.versiones,instantaneas:verif.instantaneas,
      auditoria:{ok:true,ms:verif.ms,intentos:verif.intentos},vivoCoincide:verif.vivoCoincide===true,
      commit:cod.commit,arbolSucio:cod.arbolSucio,codigoDeGit:cod.git,entorno:entorno(codigo),
      omitidos:copia.omitidos,sinRespaldos:copia.sinRespaldos,archivos:listarArbol(stage)
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
      sinRespaldos:man.sinRespaldos,omitidos:man.omitidos,sha256:hashArchivo(age),tamano:fs.statSync(age).size
    };
    return {work,age,nombre,lado,seq:man.seq,huella:man.huella,limpiar(){ fs.rmSync(work,{recursive:true,force:true}); }};
  }catch(e){ fs.rmSync(work,{recursive:true,force:true}); throw e; }
}
module.exports={construirPaquete,revisarContenido};

#!/usr/bin/env node
/* Nativa Online — restaurar (o sólo ensayar la restauración de) un respaldo. NUNCA escribe sobre un mundo en funcionamiento.
   Uso:
     node restaurar.js --archivo X.tar.gz.age --identidad clave.txt [--meta X.json] --datos <carpeta NUEVA o vacía> [--codigo-destino <carpeta nueva>]
     node restaurar.js --archivo X.tar.gz.age --identidad clave.txt [--meta X.json] --solo-verificar      (ensayo: no deja nada)
     node restaurar.js --plano X.tar.gz ...                                                          (si ya está descifrado)
   Pasos: comprueba la suma del .age contra su ficha → descifra → mira el contenido → compara cada archivo con el manifiesto →
   deja los datos en la carpeta nueva → abre el mundo con el CÓDIGO QUE VIAJA EN EL PROPIO RESPALDO (el del commit y el Node de entonces)
   → audita todo y compara la versión y la huella con las del manifiesto. Sale con código 0 sólo si todo coincide. */
'use strict';
const fs=require('fs'), path=require('path'), os=require('os');
const {ejecutar,hashArchivo,listarArbol,igualesArboles,vivo}=require('./lib/comun.js');
const {descifrar}=require('./lib/cifrado.js');
const {revisarContenido}=require('./lib/paquete.js');
const {verificarEnHijo}=require('./lib/verificar-hijo.js');

function carpetaLibre(d){
  d=path.resolve(d);
  if(process.env.NATIVA_DATOS&&(d===path.resolve(process.env.NATIVA_DATOS)||d.startsWith(path.resolve(process.env.NATIVA_DATOS)+path.sep))) throw new Error('esa carpeta es (o está dentro de) NATIVA_DATOS: no se restaura sobre el mundo en funcionamiento');
  if(fs.existsSync(d)){
    if(!fs.statSync(d).isDirectory()) throw new Error(d+' existe y no es una carpeta');
    const lock=path.join(d,'.lock'); if(fs.existsSync(lock)){ const pid=+fs.readFileSync(lock,'utf8'); if(pid&&vivo(pid)) throw new Error(d+' tiene un servidor en funcionamiento (pid '+pid+')'); }
    if(fs.readdirSync(d).length) throw new Error(d+' no está vacía: la restauración nunca pisa datos existentes');
  }
  return d;
}

async function restaurarPaquete(op){
  const work=fs.mkdtempSync(path.join(op.trabajo||os.tmpdir(),'nv-restaurar-')), informe={ok:false,pasos:[],problemas:[]};
  const paso=m=>informe.pasos.push(m);
  try{
    let datosDestino=null, codigoDestino=null;
    if(!op.soloVerificar){
      if(!op.datosDestino) throw new Error('falta --datos <carpeta nueva> (o --solo-verificar)');
      datosDestino=carpetaLibre(op.datosDestino); if(op.codigoDestino) codigoDestino=carpetaLibre(op.codigoDestino);
    }
    let tgz=op.plano;
    if(!tgz){
      if(op.meta){
        const m=JSON.parse(fs.readFileSync(op.meta,'utf8'));
        if(hashArchivo(op.archivo)!==m.sha256) throw new Error('la suma SHA-256 del .age no es la de su ficha: archivo dañado o cambiado');
        paso('suma SHA-256 del archivo cifrado coincide con su ficha'); informe.ficha=m;
      }
      tgz=path.join(work,'paquete.tar.gz'); descifrar(op.archivo,tgz,op.identidad); paso('descifrado');
    }
    const malos=revisarContenido(tgz); if(malos.length) throw new Error('contenido inesperado: '+malos.slice(0,3).join('; '));
    const x=path.join(work,'x'); fs.mkdirSync(x); ejecutar('tar',['-xzf',tgz,'-C',x,'--no-same-owner']); paso('desempaquetado');
    const man=JSON.parse(fs.readFileSync(path.join(x,'manifiesto.json'),'utf8'));
    const arbol=listarArbol(x); delete arbol['manifiesto.json'];
    const dif=igualesArboles(man.archivos,arbol); if(dif.length) throw new Error('el contenido no coincide con el manifiesto: '+dif.slice(0,3).join(', '));
    paso('cada archivo coincide con el manifiesto'); informe.manifiesto={seq:man.seq,huella:man.huella,commit:man.commit,node:man.entorno.node,arquitectura:man.entorno.arquitectura,creado:man.creado,etiqueta:man.etiqueta};
    let dirDatos=path.join(x,'datos'), codigoRaiz=path.join(x,'codigo');
    if(!op.soloVerificar){
      fs.mkdirSync(datosDestino,{recursive:true}); fs.cpSync(dirDatos,datosDestino,{recursive:true}); dirDatos=datosDestino;
      if(codigoDestino){ fs.mkdirSync(codigoDestino,{recursive:true}); fs.cpSync(codigoRaiz,codigoDestino,{recursive:true}); codigoRaiz=codigoDestino; }
      paso('datos dejados en '+datosDestino);
    }
    const v=verificarEnHijo({dir:dirDatos,codigo:codigoRaiz,esperado:{seq:man.seq,huella:man.huella},memoriaMB:op.memoriaMB});
    informe.auditoria=v; if(!v.ok) throw new Error('la restauración no pasa la auditoría: '+v.problemas.join(' / '));
    paso('auditoría completa pasada: versión '+v.seq+', huella igual a la del manifiesto');
    if(path.dirname(process.version)&&process.version.split('.')[0]!==String(man.entorno.node).split('.')[0]) informe.aviso='Node distinto: el respaldo se hizo con '+man.entorno.node+' y esta máquina usa '+process.version;
    informe.ok=true; return informe;
  }catch(e){ informe.problemas.push(e.message); return informe; }
  finally{ fs.rmSync(work,{recursive:true,force:true}); }
}

if(require.main===module){
  const a=process.argv.slice(2), val=k=>{ const i=a.indexOf(k); return i>=0?a[i+1]:undefined; };
  if(!val('--archivo')&&!val('--plano')){ console.error('uso: restaurar.js --archivo X.tar.gz.age --identidad clave.txt [--meta X.json] (--datos <carpeta nueva> [--codigo-destino <carpeta nueva>] | --solo-verificar)'); process.exit(2); }
  restaurarPaquete({archivo:val('--archivo'),plano:val('--plano'),identidad:val('--identidad'),meta:val('--meta'),datosDestino:val('--datos'),codigoDestino:val('--codigo-destino'),soloVerificar:a.includes('--solo-verificar')})
    .then(r=>{ console.log(JSON.stringify(r,null,1)); process.exit(r.ok?0:1); });
}
module.exports={restaurarPaquete};

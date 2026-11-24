/* Nativa Online — respaldos: cifrado con age (https://github.com/FiloSottile/age).
   La máquina de Oracle sólo conoce CLAVES PÚBLICAS: puede cifrar, no puede descifrar. Las claves privadas (maestra y de reserva) viven
   fuera de Oracle y fuera de GitHub. Sólo el «canario» (una copia sintética, sin datos reales) se cifra para una clave verificadora
   que sí está en GitHub, para poder ensayar la restauración de punta a punta sin exponer nada del mundo real. */
'use strict';
const fs=require('fs');
const {ejecutar}=require('./comun.js');

const RE_PUB=/^age1[a-z0-9]{50,}$/;
function validarDestinatarios(lista){
  if(!Array.isArray(lista)||!lista.length) throw new Error('no hay claves públicas de age para cifrar');
  for(const r of lista) if(!RE_PUB.test(r)) throw new Error('destinatario inválido (debe ser una clave pública age1…): '+String(r).slice(0,12)+'…');
}
function cifrar(entrada,salida,destinatarios){
  validarDestinatarios(destinatarios);
  const args=[]; for(const r of destinatarios) args.push('-r',r);
  ejecutar('age',args.concat(['-o',salida,entrada]));
}
function descifrar(entrada,salida,identidad){
  ejecutar('age',['--decrypt','-i',identidad,'-o',salida,entrada]);
}
/* Mira sólo la cabecera (sin descifrar): cuántos destinatarios tiene y de qué tipo. */
function inspeccionarCabecera(ruta){
  const fd=fs.openSync(ruta,'r'), b=Buffer.alloc(4096);
  let n; try{ n=fs.readSync(fd,b,0,b.length,0); } finally{ fs.closeSync(fd); }
  const lineas=b.subarray(0,n).toString('latin1').split('\n');
  if(lineas[0]!=='age-encryption.org/v1') return {valido:false,destinatarios:0,tipos:[]};
  const tipos=[]; let cerrada=false;
  for(const l of lineas.slice(1)){ if(l.startsWith('-> ')) tipos.push(l.slice(3).split(' ')[0]); else if(l.startsWith('---')){ cerrada=true; break; } }
  return {valido:cerrada,destinatarios:tipos.length,tipos};
}
module.exports={cifrar,descifrar,inspeccionarCabecera,validarDestinatarios};

#!/usr/bin/env node
/* Nativa Online — vigilancia EXTERNA de los respaldos. Corre fuera de Oracle (GitHub Actions, cada hora) con una clave de B2 de SÓLO LECTURA.
   Si la VM muere, se cuelga o deja de respaldar, esto es lo que se entera: un respaldo que no aparece es una alarma, no un silencio.
   No descifra nada ni necesita ninguna clave privada: mira las fichas (.json) y la cabecera de los .age.
   Revisa, por nivel: que haya uno reciente · que su ficha diga «auditoría ok» y traiga commit y Node · que lleve los destinatarios esperados ·
   que la suma SHA-256 del .age sea la de su ficha · que la versión (seq) no retroceda · que el tamaño no se desplome.
   Uso: node vigilar.js [--ahora ISO]     Código 0 = todo bien · 1 = hay alarma (el flujo falla y GitHub avisa por correo).
   Variables: NATIVA_RESPALDO_DESTINO, B2_ID_LECTURA, B2_CLAVE_LECTURA, B2_CUBO_*, NATIVA_RESPALDO_N_DESTINATARIOS (por defecto 2),
              NATIVA_VIGILAR_MAX_HORAS_SEIS (8), _DIARIO (30), _SEMANAL (200), _CANARIO (8) */
'use strict';
const os=require('os'), fs=require('fs'), path=require('path');
const {destinoDesdeEntorno}=require('./lib/destinos.js');
const {inspeccionarCabecera}=require('./lib/cifrado.js');
const {hashArchivo}=require('./lib/comun.js');

const H=3600e3;
async function vigilar(destino,env,ahora){
  const N=+env.NATIVA_RESPALDO_N_DESTINATARIOS||2;
  const reglas=[
    {nivel:'seisHoras',pref:'seis-horas',max:(+env.NATIVA_VIGILAR_MAX_HORAS_SEIS||8)*H,nombre:'copia de 6 horas',n:N},
    {nivel:'diario',pref:'diario',max:(+env.NATIVA_VIGILAR_MAX_HORAS_DIARIO||30)*H,nombre:'copia diaria',n:N},
    {nivel:'semanal',pref:'semanal',max:(+env.NATIVA_VIGILAR_MAX_HORAS_SEMANAL||200)*H,nombre:'copia semanal',n:N},
    {nivel:'seisHoras',pref:'canario',max:(+env.NATIVA_VIGILAR_MAX_HORAS_CANARIO||8)*H,nombre:'canario',n:1,opcional:env.NATIVA_VIGILAR_SIN_CANARIO==='1'}
  ];
  const problemas=[], resumen=[];
  for(const r of reglas){
    if(r.opcional) continue;
    let lista; try{ lista=(await destino.listar(r.nivel,r.pref+'/')).filter(f=>f.nombre.endsWith('.json')); }
    catch(e){ problemas.push(r.nombre+': no pude listar el destino ('+e.message.slice(0,150)+')'); continue; }
    if(!lista.length){ problemas.push(r.nombre+': no hay ninguna'); continue; }
    lista.sort((a,b)=>a.nombre<b.nombre?-1:1);
    const ult=lista[lista.length-1];
    let f; try{ f=JSON.parse((await destino.leer(r.nivel,ult.nombre)).toString()); }catch(e){ problemas.push(r.nombre+': la ficha '+ult.nombre+' no se puede leer'); continue; }
    const edad=ahora-new Date(f.creado).getTime();
    if(!(edad>=-3600e3)||edad>r.max) problemas.push(r.nombre+': la última tiene '+Math.round(edad/H)+' h (máximo '+Math.round(r.max/H)+' h) — el sistema dejó de respaldar');
    if(f.auditoria!=='ok') problemas.push(r.nombre+': la ficha no dice auditoría ok');
    if(!f.commit||!f.node) problemas.push(r.nombre+': la ficha no trae commit y versión de Node');
    if(r.pref!=='canario'&&f.vivoCoincide!==true) problemas.push(r.nombre+': no consta que la huella coincidiera con la del mundo original');
    if(f.destinatarios!==r.n) problemas.push(r.nombre+': cifrada para '+f.destinatarios+' claves, se esperaban '+r.n);
    const pa=ult.nombre.replace(/\.json$/,'.tar.gz.age');
    let cuerpo; try{ cuerpo=await destino.leer(r.nivel,pa); }catch(e){ problemas.push(r.nombre+': falta el archivo cifrado de la ficha '+ult.nombre); continue; }
    const tmp=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'nv-vig-')),'x.age'); fs.writeFileSync(tmp,cuerpo);
    try{
      if(hashArchivo(tmp)!==f.sha256) problemas.push(r.nombre+': la suma SHA-256 del archivo no es la de su ficha');
      const cab=inspeccionarCabecera(tmp);
      if(!cab.valido) problemas.push(r.nombre+': el archivo no tiene cabecera age válida');
      else if(cab.destinatarios!==r.n) problemas.push(r.nombre+': la cabecera tiene '+cab.destinatarios+' destinatarios, se esperaban '+r.n);
    }finally{ fs.rmSync(path.dirname(tmp),{recursive:true,force:true}); }
    if(lista.length>1&&r.pref!=='canario'){
      try{
        const ant=JSON.parse((await destino.leer(r.nivel,lista[lista.length-2].nombre)).toString());
        if(f.seq<ant.seq) problemas.push(r.nombre+': la versión del mundo RETROCEDIÓ ('+ant.seq+' → '+f.seq+'): posible pérdida de historial');
        if(ant.tamano>1e6&&f.tamano<ant.tamano*0.5) problemas.push(r.nombre+': el tamaño se redujo a menos de la mitad');
      }catch(e){}
    }
    resumen.push({nivel:r.pref,archivo:ult.nombre,horas:Math.round(edad/H*10)/10,seq:f.seq,huella:f.huella,commit:f.commit});
  }
  return {ok:!problemas.length,problemas,resumen,ts:new Date(ahora).toISOString()};
}
module.exports={vigilar};
if(require.main===module){
  const a=process.argv.slice(2), i=a.indexOf('--ahora'), ahora=i>=0?new Date(a[i+1]).getTime():Date.now();
  let destino; try{ destino=destinoDesdeEntorno(process.env,'lectura'); }catch(e){ console.log(JSON.stringify({ok:false,problemas:['configuración: '+e.message]})); process.exit(1); }
  vigilar(destino,process.env,ahora).then(r=>{ console.log(JSON.stringify(r,null,1)); process.exit(r.ok?0:1); },e=>{ console.log(JSON.stringify({ok:false,problemas:['error inesperado: '+e.message]})); process.exit(1); });
}

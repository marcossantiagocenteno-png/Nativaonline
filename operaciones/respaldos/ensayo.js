#!/usr/bin/env node
/* Nativa Online — ensayo de restauración, FUERA de Oracle y sin tocar el mundo oficial. Pensado para GitHub Actions (semanal) o para correrse a mano.
   Descarga el último CANARIO (un mundo sintético que pasó por el mismo camino que un respaldo real), lo descifra con la clave del VERIFICADOR
   y lo restaura con el código y el Node que viajan dentro del respaldo: abre el mundo, audita y compara huella con su manifiesto y su ficha.
   La clave del verificador SÓLO abre canarios: aunque se filtrara desde GitHub, no abre ningún respaldo del mundo real.
   Además, del último respaldo REAL baja el archivo cifrado y comprueba, SIN descifrar, su suma, su cabecera y sus destinatarios.
   La restauración completa del mundo real (con la clave maestra) la hace una persona, a mano, con operaciones/respaldos/restaurar.js.
   Variables: NATIVA_RESPALDO_DESTINO + B2_*_LECTURA · NATIVA_VERIFICADOR_IDENTIDAD (contenido de la clave AGE-SECRET-KEY-… del verificador) */
'use strict';
const os=require('os'), fs=require('fs'), path=require('path');
const {destinoDesdeEntorno}=require('./lib/destinos.js');
const {restaurarPaquete}=require('./restaurar.js');
const {vigilar}=require('./vigilar.js');

async function ensayar(destino,env){
  const out={ok:false,problemas:[],pasos:[]};
  const identidad=env.NATIVA_VERIFICADOR_IDENTIDAD; if(!identidad){ out.problemas.push('falta NATIVA_VERIFICADOR_IDENTIDAD'); return out; }
  const work=fs.mkdtempSync(path.join(os.tmpdir(),'nv-ensayo-'));
  try{
    const lista=(await destino.listar('seisHoras','canario/')).filter(f=>f.nombre.endsWith('.tar.gz.age')).sort((a,b)=>a.nombre<b.nombre?-1:1);
    if(!lista.length){ out.problemas.push('no hay canarios'); return out; }
    const ult=lista[lista.length-1].nombre, ficha=ult.replace(/\.tar\.gz\.age$/,'.json');
    const age=path.join(work,'c.tar.gz.age'), js=path.join(work,'c.json'), idf=path.join(work,'id.txt');
    await destino.bajar('seisHoras',ult,age); await destino.bajar('seisHoras',ficha,js); fs.writeFileSync(idf,identidad.trim()+'\n',{mode:0o600});
    const r=await restaurarPaquete({archivo:age,meta:js,identidad:idf,soloVerificar:true,trabajo:work});
    out.pasos=r.pasos; out.canario={archivo:ult,manifiesto:r.manifiesto||null};
    if(!r.ok){ out.problemas.push('el ensayo de restauración falló: '+r.problemas.join(' / ')); return out; }
    const f=JSON.parse(fs.readFileSync(js,'utf8'));
    if(r.manifiesto.huella!==f.huella||r.manifiesto.seq!==f.seq) out.problemas.push('la huella o la versión del manifiesto no coinciden con la ficha');
    out.ok=!out.problemas.length; return out;
  }catch(e){ out.problemas.push('error: '+e.message); return out; }
  finally{ fs.rmSync(work,{recursive:true,force:true}); }
}
module.exports={ensayar};
if(require.main===module){
  (async()=>{
    const destino=destinoDesdeEntorno(process.env,'lectura');
    const v=await vigilar(destino,process.env,Date.now()), e=await ensayar(destino,process.env);
    const res={ok:v.ok&&e.ok,vigilancia:v,ensayo:e}; console.log(JSON.stringify(res,null,1)); process.exit(res.ok?0:1);
  })().catch(x=>{ console.log(JSON.stringify({ok:false,problemas:[x.message]})); process.exit(1); });
}

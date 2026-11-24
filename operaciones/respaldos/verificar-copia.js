#!/usr/bin/env node
/* Audita una carpeta de datos copiada, sin modificarla (la abre con el código que se indique y exige que abrirla no cambie nada).
   Uso:  node verificar-copia.js --dir <carpeta> --codigo <raíz del repositorio> [--vivo <carpeta del mundo original>]
                                 [--esperado-seq N] [--esperado-huella H] [--salida resultado.json]
   Código de salida: 0 = pasa la auditoría · 1 = no. Se corre en un proceso aparte para acotar su memoria. */
'use strict';
const fs=require('fs'), path=require('path');
const {verificarCarpeta}=require('./lib/verificar.js');

const a=process.argv.slice(2), val=k=>{ const i=a.indexOf(k); return i>=0?a[i+1]:undefined; };
const dir=val('--dir'), codigo=val('--codigo');
if(!dir||!codigo){ console.error('uso: verificar-copia.js --dir <carpeta> --codigo <raíz> [--vivo <carpeta>] [--esperado-seq N] [--esperado-huella H] [--salida f.json]'); process.exit(2); }
const esperado=(val('--esperado-seq')||val('--esperado-huella'))?{seq:val('--esperado-seq')!==undefined?+val('--esperado-seq'):null,huella:val('--esperado-huella')}:null;
verificarCarpeta({dir:path.resolve(dir),codigo:path.resolve(codigo),vivo:val('--vivo')?path.resolve(val('--vivo')):null,esperado}).then(r=>{
  const j=JSON.stringify(r); if(val('--salida')) fs.writeFileSync(val('--salida'),j); else console.log(j);
  process.exit(r.ok?0:1);
}).catch(e=>{ const r={ok:false,problemas:['error inesperado: '+e.message]}; if(val('--salida')) fs.writeFileSync(val('--salida'),JSON.stringify(r)); else console.log(JSON.stringify(r)); process.exit(1); });

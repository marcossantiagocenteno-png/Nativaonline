/* Nativa Online — respaldos: un respaldo NUNCA lleva contraseñas, tokens de administrador, claves de sesión ni claves privadas.
   Dos defensas, una detrás de la otra:
     1) la copia sólo toma nombres permitidos (lib/copia.js, lib/codigo.js): un .env suelto ni se lee;
     2) este escaneo mira TODO lo que va a entrar al paquete y, si encuentra algo con forma de secreto o el valor exacto de alguno de los
        secretos que este proceso conoce, aborta el respaldo. */
'use strict';
const fs=require('fs'), path=require('path');

const PATRONES=[
  [/AGE-SECRET-KEY-1[A-Z0-9]{20,}/,'clave privada de age'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/,'clave privada PEM'],
  [/NATIVA_(ADMIN_TOKEN|SESION_CLAVE)[ \t]*[=:][ \t]*['"]?[A-Za-z0-9_\-+\/=.]{16,}/,'asignación de un secreto del servidor'],
  [/B2_CLAVE_[A-Z]+[ \t]*=[ \t]*['"]?[A-Za-z0-9_\-+\/=.]{16,}/,'clave de aplicación de B2']
];
const VARIABLES_SECRETAS=['NATIVA_ADMIN_TOKEN','NATIVA_SESION_CLAVE','B2_CLAVE_ESCRITURA','B2_CLAVE_LECTURA','B2_CLAVE_ADMIN'];

function escanear(dir,env){
  env=env||process.env;
  const valores=VARIABLES_SECRETAS.map(k=>env[k]).filter(v=>v&&v.length>=8), hallazgos=[];
  (function rec(rel){
    for(const e of fs.readdirSync(path.join(dir,rel),{withFileTypes:true})){
      const r=rel?rel+'/'+e.name:e.name;
      if(e.isDirectory()){ rec(r); continue; }
      if(!e.isFile()) continue;
      const abs=path.join(dir,r); if(fs.statSync(abs).size>200*1024*1024) continue;
      const t=fs.readFileSync(abs).toString('latin1');
      for(const [re,que] of PATRONES) if(re.test(t)) hallazgos.push(r+': '+que);
      for(const v of valores) if(t.includes(v)) hallazgos.push(r+': contiene el valor de un secreto conocido');
    }
  })('');
  return hallazgos;
}
module.exports={escanear,PATRONES};

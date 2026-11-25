#!/usr/bin/env node
/* Nativa Online — el servidor oficial en un PC con Windows.
   Una sola herramienta, en Node (ya instalado para el juego), sin dependencias:

     node operaciones/windows/nativa.js verificar      qué hay y qué falta (sólo LEE; no instala ni enciende nada)
     node operaciones/windows/nativa.js claves         crea privado\juego.env con claves nuevas (no pisa uno existente; no imprime secretos)
     node operaciones/windows/nativa.js iniciar        enciende el servidor en segundo plano (con reinicio automático si se cae)
     node operaciones/windows/nativa.js parar          lo apaga limpio (cierra el almacén); si no responde en 40 s, lo fuerza
     node operaciones/windows/nativa.js reiniciar      parar + iniciar
     node operaciones/windows/nativa.js estado         ¿está encendido?, ¿responde /salud?
     node operaciones/windows/nativa.js respaldar      un respaldo ahora (--auto: el que toque) con operaciones/respaldos/respaldar.js
     node operaciones/windows/nativa.js tareas         muestra las tareas programadas que crearía; con --aplicar las crea; con --quitar las borra
     node operaciones/windows/nativa.js energia        muestra los ajustes para que el PC no se duerma enchufado; con --aplicar los hace

   Todo lo privado vive en privado\ (dentro del proyecto, fuera de git): juego.env (claves), registros\, supervisor.pid, parar.ahora.
   El servidor escucha SÓLO en 127.0.0.1: desde Internet se llega por el túnel (docs/WINDOWS.md), nunca por un puerto abierto. */
'use strict';
const fs=require('fs'), path=require('path'), cp=require('child_process'), crypto=require('crypto'), http=require('http'), os=require('os');

const RAIZ=path.resolve(__dirname,'..','..');
const ES_WIN=process.platform==='win32';
const PRIVADO=path.resolve(process.env.NATIVA_PRIVADO||path.join(RAIZ,'privado'));
const ARCH_ENV=path.join(PRIVADO,'juego.env'), REG=path.join(PRIVADO,'registros'), PID=path.join(PRIVADO,'supervisor.pid'), PARADA=path.join(PRIVADO,'parar.ahora');
const ORIGEN_PAGINA='https://marcossantiagocenteno-png.github.io';
const TAREA_SERVIDOR='Nativa Online - Servidor', TAREA_RESPALDO='Nativa Online - Respaldo';

/* ---------- configuración ---------- */
function leerEnv(texto){
  const o={};
  for(const l of String(texto).split(/\r?\n/)){
    const m=/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(l); if(!m||/^\s*#/.test(l)) continue;
    o[m[1]]=m[2].replace(/^"(.*)"$/,'$1');
  }
  return o;
}
const cargarCfg=()=>{ try{ return leerEnv(fs.readFileSync(ARCH_ENV,'utf8')); }catch(e){ return null; } };
const datosDe=cfg=>path.resolve(cfg.NATIVA_DATOS||path.join(RAIZ,'datos'));

/* problemas de la configuración, sin mostrar nunca un valor secreto */
function problemasCfg(cfg){
  const p=[];
  if(!cfg) return ['no existe privado\\juego.env (se crea con «claves»)'];
  const t=cfg.NATIVA_ADMIN_TOKEN||'', k=cfg.NATIVA_SESION_CLAVE||'';
  if(t.length<16) p.push('NATIVA_ADMIN_TOKEN falta o tiene menos de 16 caracteres');
  if(k.length<32) p.push('NATIVA_SESION_CLAVE falta o tiene menos de 32 caracteres');
  if(t&&k&&(k===t||k.includes(t))) p.push('NATIVA_SESION_CLAVE no puede ser (ni contener) la contraseña de administrador');
  if(cfg.PORT&&!/^\d{2,5}$/.test(cfg.PORT)) p.push('PORT no es un número');
  return p;
}
/* el entorno del servidor: siempre producción, sólo loopback, sólo la página oficial; NATIVA_CONFIAR_PROXY sólo si el archivo lo pide */
function entornoServidor(cfg){
  const e=Object.assign({},process.env);
  for(const k of Object.keys(e)) if(/^NATIVA_/.test(k)) delete e[k];
  Object.assign(e,{NODE_ENV:'production',PORT:cfg.PORT||'8787',NATIVA_HOST:'127.0.0.1',NATIVA_DATOS:datosDe(cfg),NATIVA_ARCHIVO_PARADA:PARADA,
    NATIVA_ORIGENES:cfg.NATIVA_ORIGENES||ORIGEN_PAGINA});
  for(const k of ['NATIVA_ADMIN_TOKEN','NATIVA_SESION_CLAVE']) e[k]=cfg[k];      // (en bucle: el escáner de secretos de los respaldos no debe confundir este código con un valor)
  if(cfg.NATIVA_CONFIAR_PROXY==='1') e.NATIVA_CONFIAR_PROXY='1';
  return e;
}

/* ---------- utilidades ---------- */
const vivo=pid=>{ try{ process.kill(pid,0); return true; }catch(e){ return e.code==='EPERM'; } };
const leerPid=()=>{ try{ const n=+fs.readFileSync(PID,'utf8'); return n>0?n:0; }catch(e){ return 0; } };
const dormir=ms=>new Promise(r=>setTimeout(r,ms));
function abrirLog(nombre,max){
  fs.mkdirSync(REG,{recursive:true}); const f=path.join(REG,nombre);
  try{ if(fs.statSync(f).size>(max||5*1048576)) for(let i=3;i>=1;i--){ try{ fs.renameSync(i===1?f:f+'.'+(i-1),f+'.'+i); }catch(e){} } }catch(e){}
  return fs.openSync(f,'a');
}
const marca=()=>new Date().toISOString();
/* age y age-keygen se buscan también en <carpeta del proyecto>\..\herramientas\age (así no hay que tocar el PATH de Windows; vale también para la tarea programada) */
const HERRAMIENTAS=process.env.NATIVA_HERRAMIENTAS_AGE||path.join(RAIZ,'..','herramientas','age');
function conHerramientas(env){
  const e=Object.assign({},env||process.env); if(!fs.existsSync(HERRAMIENTAS)) return e;
  const k=Object.keys(e).find(x=>x.toLowerCase()==='path')||'PATH'; e[k]=HERRAMIENTAS+path.delimiter+(e[k]||''); return e;
}
function programa(cmd,args){ const r=cp.spawnSync(cmd,args||['--version'],{encoding:'utf8',windowsHide:true,timeout:15000,env:conHerramientas()}); return r.error||r.status!==0?null:String(r.stdout||r.stderr).trim().split(/\r?\n/)[0]; }
function salud(puerto){
  return new Promise(ok=>{
    const r=http.get({host:'127.0.0.1',port:puerto,path:'/salud',timeout:3000},res=>{ let b=''; res.on('data',d=>b+=d); res.on('end',()=>{ try{ ok(JSON.parse(b)); }catch(e){ ok(null); } }); });
    r.on('error',()=>ok(null)); r.on('timeout',()=>{ r.destroy(); ok(null); });
  });
}

/* ---------- supervisor: enciende el servidor y lo vuelve a encender si se cae ---------- */
async function supervisar(){
  const cfg=cargarCfg(), pr=problemasCfg(cfg);
  if(pr.length){ console.error('No se enciende: '+pr.join('; ')); return 1; }
  const previo=leerPid(); if(previo&&previo!==process.pid&&vivo(previo)){ console.error('Ya hay un supervisor (proceso '+previo+').'); return 1; }
  fs.mkdirSync(PRIVADO,{recursive:true}); fs.writeFileSync(PID,String(process.pid));
  process.on('exit',()=>{ try{ if(leerPid()===process.pid) fs.unlinkSync(PID); }catch(e){} });
  try{ fs.unlinkSync(PARADA); }catch(e){}                       // un resto de una parada anterior
  const servidor=process.env.NATIVA_SERVIDOR_JS||path.join(RAIZ,'servidor','iniciar.js');   // NATIVA_SERVIDOR_JS: sólo para las pruebas
  let espera=1500, n=0;
  for(;;){
    const fd=abrirLog('servidor.log'); fs.writeSync(fd,'\n=== '+marca()+' · arranque '+(++n)+' ===\n');
    const t0=Date.now();
    const salida=await new Promise(ok=>{
      const h=cp.spawn(process.execPath,[servidor],{env:entornoServidor(cfg),cwd:RAIZ,stdio:['ignore',fd,fd],windowsHide:true});
      h.on('error',e=>{ try{ fs.writeSync(fd,'no se pudo lanzar: '+e.message+'\n'); }catch(x){} ok(-1); });
      h.on('exit',c=>ok(c));
    });
    try{ fs.writeSync(fd,'=== '+marca()+' · el servidor terminó con código '+salida+' ===\n'); fs.closeSync(fd); }catch(e){}
    if(fs.existsSync(PARADA)){ try{ fs.unlinkSync(PARADA); }catch(e){} return 0; }       // lo pidió alguien: no se reinicia
    espera=Date.now()-t0>60000?3000:Math.min(espera*2,60000);   // si vivió más de un minuto, empieza de nuevo; si se cae enseguida, espera más cada vez
    for(let w=0;w<espera;w+=250){ await dormir(250); if(fs.existsSync(PARADA)){ try{ fs.unlinkSync(PARADA); }catch(e){} return 0; } }
  }
}

/* ---------- órdenes ---------- */
function iniciar(){
  const cfg=cargarCfg(), pr=problemasCfg(cfg);
  if(pr.length){ console.error('No se puede encender:\n  - '+pr.join('\n  - ')); return 1; }
  const p=leerPid(); if(p&&vivo(p)){ console.log('Ya está encendido (supervisor '+p+').'); return 0; }
  const h=cp.spawn(process.execPath,[__filename,'supervisar'],{detached:true,stdio:'ignore',windowsHide:true,env:process.env});
  h.unref(); console.log('Encendiendo… en unos segundos usa «estado». Registro: '+path.join(REG,'servidor.log')); return 0;
}
async function parar(){
  const p=leerPid(); if(!p||!vivo(p)){ console.log('No estaba encendido.'); try{ fs.unlinkSync(PID); }catch(e){} return 0; }
  fs.mkdirSync(PRIVADO,{recursive:true}); fs.writeFileSync(PARADA,marca());
  for(let i=0;i<160;i++){ await dormir(250); if(!vivo(p)) { console.log('Apagado limpio.'); return 0; } }
  console.log('No respondió en 40 s: se fuerza. (El almacén se repara solo al volver a abrir; el mundo no se pierde.)');
  try{ if(ES_WIN) cp.spawnSync('taskkill',['/PID',String(p),'/T','/F'],{windowsHide:true}); else process.kill(p,'SIGKILL'); }catch(e){}
  try{ fs.unlinkSync(PARADA); }catch(e){} return 0;
}
async function estado(){
  const cfg=cargarCfg()||{}, p=leerPid(), puerto=+(cfg.PORT||8787);
  console.log('Supervisor: '+(p&&vivo(p)?'encendido (proceso '+p+')':'apagado'));
  const s=await salud(puerto);
  console.log('Servidor en 127.0.0.1:'+puerto+': '+(s?'responde · versión del mundo '+s.seq+' · conectados '+s.clientes+' · hay administrador: '+(s.admin?'sí':'no'):'no responde'));
  return s?0:1;
}
function claves(){
  if(fs.existsSync(ARCH_ENV)){ console.log('Ya existe '+ARCH_ENV+': no se toca.'); return 0; }
  fs.mkdirSync(REG,{recursive:true});
  const admin=crypto.randomBytes(24).toString('base64url'), firma=crypto.randomBytes(32).toString('hex');
  const t=['# privado\\juego.env — SECRETO. Está fuera de git (privado/ en .gitignore). No lo copies a GitHub, al chat ni a un respaldo.',
    '# NATIVA_ADMIN_TOKEN es la contraseña con la que entras como administrador. Guárdala en tu gestor de contraseñas.',
    'NATIVA_ADMIN_TOKEN='+admin,'NATIVA_SESION_CLAVE='+firma,'',
    '# Puerto local (el servidor sólo escucha en 127.0.0.1). El túnel apunta a este puerto.','PORT=8787','',
    '# Dónde vive el mundo. Por defecto: la carpeta datos\\ del proyecto (la que ya usa el servidor). Descomenta para cambiarla.',
    '# NATIVA_DATOS=F:\\NATIVA ONLINE SERVER\\datos','',
    '# Orígenes de página permitidos (esquema y dominio, sin ruta).','NATIVA_ORIGENES='+ORIGEN_PAGINA,'',
    '# NATIVA_CONFIAR_PROXY=1  ← NO lo actives hasta comprobar con operaciones/despliegue/probar-proxy.js que el túnel cumple las tres condiciones.','',
    '# --- Respaldos (se llenan al activarlos; docs/WINDOWS.md §Respaldos) ---',
    '# NATIVA_RESPALDO_CARPETA=E:\\NativaRespaldos        (OTRO disco o unidad externa, nunca dentro de datos\\)',
    '# NATIVA_RESPALDO_DESTINATARIOS=age1publica_maestra,age1publica_reserva',
    '# NATIVA_RESPALDO_VERIFICADOR=age1publica_verificador',
    '# NATIVA_ALERTA_URL=https://ntfy.sh/un-tema-largo-y-secreto',''].join('\r\n');
  fs.writeFileSync(ARCH_ENV,t,{flag:'wx'});
  console.log('Creado '+ARCH_ENV+' con claves nuevas (no se muestran). Ábrelo tú para guardar la contraseña de administrador.'); return 0;
}
async function respaldar(args){
  const cfg=cargarCfg(), pr=problemasCfg(cfg); if(pr.length){ console.error(pr.join('; ')); return 1; }
  const falta=[]; if(!cfg.NATIVA_RESPALDO_CARPETA) falta.push('NATIVA_RESPALDO_CARPETA'); if(!cfg.NATIVA_RESPALDO_DESTINATARIOS) falta.push('NATIVA_RESPALDO_DESTINATARIOS');
  if(falta.length){ console.error('Faltan en privado\\juego.env: '+falta.join(', ')); return 1; }
  const datos=datosDe(cfg), destino=path.resolve(cfg.NATIVA_RESPALDO_CARPETA);
  if(destino===datos||destino.startsWith(datos+path.sep)){ console.error('La carpeta de respaldos no puede estar dentro de los datos del mundo.'); return 1; }
  fs.mkdirSync(destino,{recursive:true}); fs.mkdirSync(path.join(PRIVADO,'respaldo-estado'),{recursive:true}); fs.mkdirSync(path.join(PRIVADO,'trabajo'),{recursive:true});
  const e=Object.assign(conHerramientas(),{NATIVA_DATOS:datos,NATIVA_CODIGO:RAIZ,NATIVA_RESPALDO_ESTADO:path.join(PRIVADO,'respaldo-estado'),NATIVA_RESPALDO_TRABAJO:path.join(PRIVADO,'trabajo'),
    NATIVA_RESPALDO_DESTINO:'carpeta:'+destino,NATIVA_RESPALDO_DESTINATARIOS:cfg.NATIVA_RESPALDO_DESTINATARIOS,
    NATIVA_RESPALDO_VERIFICADOR:cfg.NATIVA_RESPALDO_VERIFICADOR||'',NATIVA_ALERTA_URL:cfg.NATIVA_ALERTA_URL||'',NATIVA_LATIDO_URL:cfg.NATIVA_LATIDO_URL||''});
  const fd=abrirLog('respaldo.log'); fs.writeSync(fd,'\n=== '+marca()+' · respaldo ===\n');
  const a=args.length?args:['--auto'];
  const r=cp.spawnSync(process.execPath,[path.join(RAIZ,'operaciones','respaldos','respaldar.js')].concat(a),{env:e,cwd:RAIZ,stdio:['ignore',fd,fd],windowsHide:true});
  fs.writeSync(fd,'=== '+marca()+' · código '+r.status+' ===\n'); fs.closeSync(fd);
  console.log(r.status===0?'Respaldo terminado (ver registros\\respaldo.log).':'EL RESPALDO FALLÓ (ver registros\\respaldo.log).'); return r.status===0?0:1;
}
function verificar(){
  const filas=[], fila=(ok,que,nota)=>filas.push([ok,que,nota||'']);
  const mayor=+process.versions.node.split('.')[0]; fila(mayor>=20,'Node.js ≥ 20','tiene '+process.version);
  fila(fs.existsSync(path.join(RAIZ,'servidor','node_modules','ws','package.json')),'dependencia ws instalada','si falta: en la carpeta servidor ejecutar «npm ci --omit=dev»');
  const cfg=cargarCfg(), pr=problemasCfg(cfg); fila(!pr.length,'privado\\juego.env válido',pr.join('; ')||'');
  const tar=programa('tar'); fila(!!tar&&(!ES_WIN||/bsdtar/i.test(tar)),'tar (el de Windows, bsdtar)',tar||'no se encuentra');
  const age=programa('age'), ageK=programa('age-keygen'); fila(!!age,'age (cifrado de respaldos)',age||'no instalado'); fila(!!ageK,'age-keygen (para crear las claves)',ageK||'no instalado');
  const ts=programa('tailscale',['version']); fila(!!ts,'Tailscale (túnel de acceso externo)',ts||'no instalado');
  fila(!!programa('git'),'git (el respaldo guarda el código que git sigue)','');
  const datos=datosDe(cfg||{}); fila(fs.existsSync(datos),'carpeta de datos del mundo',datos+(fs.existsSync(path.join(datos,'meta.json'))?' · ya tiene un mundo':' · se crea al primer arranque'));
  try{ const s=fs.statfsSync(fs.existsSync(datos)?datos:RAIZ); fila(s.bavail*s.bsize>2*1024**3,'espacio libre > 2 GB',(s.bavail*s.bsize/1024**3).toFixed(1)+' GB'); }catch(e){ fila(false,'espacio libre','no se pudo leer'); }
  fila(ES_WIN,'sistema Windows',process.platform+' (si no es Windows, las tareas programadas no aplican)');
  for(const [ok,q,n] of filas) console.log((ok?'  BIEN  ':'  FALTA ')+q+(n?'  — '+n:''));
  const mal=filas.filter(f=>!f[0]).length; console.log('\n'+(mal?mal+' punto(s) por resolver.':'Todo listo.')); return mal?1:0;
}
function comandos(aplicar,lista){
  for(const c of lista){
    console.log((aplicar?'> ':'  ')+c.join(' '));
    if(aplicar){ const r=cp.spawnSync(c[0],c.slice(1),{encoding:'utf8',windowsHide:true}); if(r.status!==0){ console.error('    falló: '+String(r.stderr||r.stdout||r.error).trim()); return 1; } }
  }
  if(!aplicar) console.log('\n(Sólo se mostró. Con --aplicar se ejecuta.)'); return 0;
}
function tareas(args){
  const aplicar=args.includes('--aplicar');
  if(args.includes('--quitar')) return comandos(aplicar,[['schtasks','/Delete','/TN',TAREA_SERVIDOR,'/F'],['schtasks','/Delete','/TN',TAREA_RESPALDO,'/F']]);
  const nodo='"'+process.execPath+'" "'+__filename+'" ';
  return comandos(aplicar,[
    ['schtasks','/Create','/TN',TAREA_SERVIDOR,'/TR',nodo+'iniciar','/SC','ONLOGON','/RL','LIMITED','/F'],
    ['schtasks','/Create','/TN',TAREA_RESPALDO,'/TR',nodo+'respaldar','/SC','HOURLY','/MO','6','/ST','00:07','/RL','LIMITED','/F']]);
}
function energia(args){
  return comandos(args.includes('--aplicar'),[['powercfg','/change','standby-timeout-ac','0'],['powercfg','/change','hibernate-timeout-ac','0']]);
}

async function main(argv){
  const [orden,...resto]=argv;
  switch(orden){
    case 'verificar': return verificar();
    case 'claves': return claves();
    case 'iniciar': return iniciar();
    case 'supervisar': return supervisar();
    case 'parar': return parar();
    case 'reiniciar': { const r=await parar(); await dormir(1500); return r||iniciar(); }
    case 'estado': return estado();
    case 'respaldar': return respaldar(resto);
    case 'tareas': return tareas(resto);
    case 'energia': return energia(resto);
    default: console.log(fs.readFileSync(__filename,'utf8').split('*/')[0].replace(/^#!.*\n\/\*/,'').trim()); return orden?1:0;
  }
}
module.exports={leerEnv,problemasCfg,entornoServidor,datosDe,supervisar,PRIVADO,PARADA,PID};
if(require.main===module) main(process.argv.slice(2)).then(c=>process.exit(c||0),e=>{ console.error('nativa: '+e.message); process.exit(1); });

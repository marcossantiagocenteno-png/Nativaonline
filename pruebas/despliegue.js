// Etapa 8.2: piezas de despliegue, probadas EN LOCAL y en simulación (no hay VM, ni DNS, ni cuentas): guion de instalación, verificación,
// experimento del proxy, publicar.sh y coherencia de los documentos. Ver docs/DESPLIEGUE.md («Lo que se probó y lo que no»).
const fs=require('fs'), os=require('os'), path=require('path'), http=require('http'), net=require('net'), {spawn,spawnSync}=require('child_process');
const raiz=path.resolve(__dirname,'..'); let bien=0,mal=0; const ok=(c,t)=>{ if(c) bien++; else { mal++; console.log('MAL:',t); } };
const tmp=p=>fs.mkdtempSync(path.join(os.tmpdir(),'nv-desp-'+(p||'')));
const {evaluar,crearEco}=require(path.join(raiz,'operaciones/despliegue/eco-cabeceras.js'));
const {verificar}=require(path.join(raiz,'operaciones/despliegue/verificar-despliegue.js'));
const sh=(cmd,args,o)=>spawnSync(cmd,args,Object.assign({encoding:'utf8',timeout:120000},o||{}));
const libre=()=>new Promise(r=>{ const s=net.createServer(); s.listen(0,'127.0.0.1',()=>{ const p=s.address().port; s.close(()=>r(p)); }); });
const ip4=Object.values(os.networkInterfaces()).flat().filter(i=>i&&i.family==='IPv4'&&!i.internal).map(i=>i.address)[0];
const git=(dir,...a)=>sh('git',['-c','user.name=prueba','-c','user.email=prueba@example.invalid','-c','commit.gpgsign=false'].concat(a),{cwd:dir});
const arbol=d=>{ const o={}; (function r(x,rel){ for(const e of fs.readdirSync(x,{withFileTypes:true})){ const q=path.join(x,e.name), k=rel?rel+'/'+e.name:e.name; if(k.startsWith('opt/nativa/.git')) continue; if(e.isDirectory()) r(q,k); else o[k]=require('crypto').createHash('sha256').update(fs.readFileSync(q)).digest('hex')+':'+(fs.statSync(q).mode&0o777).toString(8); } })(d,''); return o; };
const mismo=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

/* copia del árbol de trabajo (incluye lo aún sin commit) como repositorio git de prueba */
function repoDePrueba(){ const d=tmp('repo'); const f=sh('git',['ls-files','-co','--exclude-standard'],{cwd:raiz}).stdout.split('\n').filter(Boolean);
  for(const x of f){ if(!fs.existsSync(path.join(raiz,x))) continue; fs.mkdirSync(path.dirname(path.join(d,x)),{recursive:true}); fs.copyFileSync(path.join(raiz,x),path.join(d,x)); fs.chmodSync(path.join(d,x),fs.statSync(path.join(raiz,x)).mode); }
  git(d,'init','-q','-b','main'); git(d,'add','-A'); git(d,'commit','-q','-m','base'); return {dir:d,sha:git(d,'rev-parse','HEAD').stdout.trim()}; }

(async()=>{
  /* ===== 1. instalar.sh en simulación ===== */
  const R=repoDePrueba(), inst=path.join(raiz,'operaciones/despliegue/instalar.sh'), RAIZ=tmp('raiz');
  const correr=(args,env)=>sh('bash',[inst].concat(args),{env:Object.assign({PATH:process.env.PATH,HOME:process.env.HOME||'/tmp',NV_RAIZ:RAIZ},env||{})});
  const base=['--simular','--commit',R.sha,'--dominio','prueba.duckdns.org','--repo',R.dir];
  let r=correr(base); ok(r.status===0,'instalar --simular termina bien ('+(r.stderr||'').slice(-300)+')');
  ok(/\[simular\] .*useradd .*nativa-respaldo/.test(r.stdout)&&/\[simular\] .*npm ci --omit=dev/.test(r.stdout)&&/\[simular\] caddy validate/.test(r.stdout)&&/\[simular\] systemctl daemon-reload/.test(r.stdout),'muestra lo que haría en el sistema (usuarios, npm ci, caddy validate, systemd) sin hacerlo');
  const modo=f=>(fs.statSync(path.join(RAIZ,f)).mode&0o777).toString(8);
  ok(modo('etc/nativa/juego.env')==='600'&&modo('etc/nativa-respaldo/respaldo.env')==='600'&&modo('etc/nativa')==='700'&&modo('etc/nativa-respaldo')==='700','la configuración queda 600 y sus carpetas 700');
  ok(modo('var/lib/nativa')==='750','la carpeta de datos del mundo queda 750');
  const env=fs.readFileSync(path.join(RAIZ,'etc/nativa/juego.env'),'utf8');
  ok(!/^NATIVA_(ADMIN_TOKEN|SESION_CLAVE|ORIGENES)=/m.test(env)&&/^# NATIVA_ADMIN_TOKEN=</m.test(env),'juego.env sale SIN secretos y con las líneas comentadas (el servidor se negará a arrancar hasta que las rellenes)');
  for(const u of ['nativa-juego.service','nativa-respaldo.service','nativa-respaldo.timer','nativa-respaldo-fallo.service']) ok(fs.readFileSync(path.join(RAIZ,'etc/systemd/system',u),'utf8')===fs.readFileSync(path.join(raiz,'operaciones/systemd',u),'utf8'),'la unidad '+u+' instalada es la del commit');
  ok(modo('etc/caddy/Caddyfile')==='644','el Caddyfile queda 644 (lo lee el usuario de Caddy; el umask de juego.env no se le pega)'); const cf=fs.readFileSync(path.join(RAIZ,'etc/caddy/Caddyfile'),'utf8'); ok(/^prueba\.duckdns\.org \{/m.test(cf)&&!/__DOMINIO__/.test(cf)&&/reverse_proxy 127\.0\.0\.1:8787/.test(cf),'el Caddyfile lleva el dominio y reenvía a 127.0.0.1:8787');
  ok(git(path.join(RAIZ,'opt/nativa'),'rev-parse','HEAD').stdout.trim()===R.sha,'/opt/nativa queda exactamente en el commit pedido');
  /* repetir no cambia nada; no pisa la configuración propia */
  const antes=arbol(RAIZ); r=correr(base); const des=arbol(RAIZ); ok(r.status===0&&mismo(antes,des),'repetir el guion no cambia ningún archivo ('+Object.keys(des).filter(k=>antes[k]!==des[k]).concat(Object.keys(antes).filter(k=>!(k in des))).join(', ')+')');
  fs.writeFileSync(path.join(RAIZ,'etc/nativa/juego.env'),'# mía\nNATIVA_ORIGENES=https://ejemplo.invalid/ya-puesto\n'); r=correr(base); ok(fs.readFileSync(path.join(RAIZ,'etc/nativa/juego.env'),'utf8').startsWith('# mía'),'no pisa un juego.env que ya existe');
  fs.writeFileSync(path.join(RAIZ,'etc/caddy/Caddyfile'),'otro-dominio.example { respond "x" }\n'); r=correr(base); ok(fs.readdirSync(path.join(RAIZ,'etc/caddy')).some(f=>/^Caddyfile\.anterior-/.test(f)),'guarda copia de un Caddyfile anterior distinto');
  /* entradas inválidas */
  const mala=(args,env,t,re)=>{ const x=correr(args,env); ok(x.status!==0&&(!re||re.test(x.stderr)),t+' ('+x.status+')'); };
  mala(['--simular','--commit','main','--dominio','a.duckdns.org','--repo',R.dir],{},'una rama en lugar de un SHA se rechaza',/SHA completo/);
  mala(['--simular','--commit',R.sha.slice(0,10),'--dominio','a.duckdns.org','--repo',R.dir],{},'un SHA corto se rechaza',/SHA completo/);
  mala(['--simular','--commit',R.sha,'--dominio','no es un dominio;rm -rf /','--repo',R.dir],{},'un dominio con basura se rechaza',/dominio/);
  mala(['--simular','--commit',R.sha,'--repo',R.dir],{},'sin --dominio se rechaza',/dominio/);
  mala(['--simular','--commit','0'.repeat(40),'--dominio','a.duckdns.org','--repo',R.dir],{NV_RAIZ:tmp('r2')},'un commit que no existe se rechaza',/no está en/);
  mala(['--commit',R.sha,'--dominio','a.duckdns.org','--repo',R.dir],{},'NV_RAIZ sin --simular se rechaza (nunca toca el sistema por error)',/NV_RAIZ/);
  fs.appendFileSync(path.join(RAIZ,'opt/nativa/servidor/iniciar.js'),'\n// cambio local\n'); mala(base,{},'un /opt/nativa con cambios locales se rechaza',/cambios locales/); git(path.join(RAIZ,'opt/nativa'),'checkout','--','.');
  /* encender sólo con la configuración completa */
  fs.rmSync(path.join(RAIZ,'etc/nativa/juego.env'));
  correr(base);   // vuelve a crear la plantilla
  mala(base.concat(['--habilitar']),{},'--habilitar con la plantilla sin rellenar se rechaza',/NATIVA_ADMIN_TOKEN/);
  const llena=(a,s,o)=>`NATIVA_ADMIN_TOKEN=${a}\nNATIVA_SESION_CLAVE=${s}\nNATIVA_ORIGENES=${o}\n`;
  fs.writeFileSync(path.join(RAIZ,'etc/nativa/juego.env'),llena('corta','x'.repeat(40),'https://marcossantiagocenteno-png.github.io')); mala(base.concat(['--habilitar']),{},'una contraseña corta se rechaza',/NATIVA_ADMIN_TOKEN/);
  fs.writeFileSync(path.join(RAIZ,'etc/nativa/juego.env'),llena('a'.repeat(20),'<pon la clave aquí, 40 caracteres como mínimo>','https://marcossantiagocenteno-png.github.io')); mala(base.concat(['--habilitar']),{},'un marcador <así> sin reemplazar se rechaza',/NATIVA_SESION_CLAVE/);
  fs.writeFileSync(path.join(RAIZ,'etc/nativa/juego.env'),llena('a'.repeat(20),'b'.repeat(40),'https://marcossantiagocenteno-png.github.io')); r=correr(base.concat(['--habilitar']));
  ok(r.status===0&&/\[simular\] systemctl enable --now nativa-juego\.service/.test(r.stdout),'--habilitar con la configuración completa enciende el juego (en simulación)');
  mala(base.concat(['--habilitar-respaldos']),{},'--habilitar-respaldos con valores de ejemplo se rechaza',/respaldo\.env/);
  /* el propio guion no trae credenciales */
  const todo=['operaciones/despliegue/instalar.sh','operaciones/despliegue/verificar-despliegue.js','operaciones/despliegue/probar-proxy.js','operaciones/despliegue/eco-cabeceras.js','operaciones/publicacion/publicar.sh','docs/DESPLIEGUE.md','docs/PUBLICACION.md'].map(f=>fs.readFileSync(path.join(raiz,f),'utf8')).join('\n');
  ok(!/AGE-SECRET-KEY-1[A-Z0-9]{20,}/.test(todo)&&!/(NATIVA_ADMIN_TOKEN|NATIVA_SESION_CLAVE|B2_CLAVE_[A-Z]+)[ \t]*=[ \t]*['"]?[A-Za-z0-9_+\/=.-]{16,}/.test(todo),'scripts y documentos de despliegue no llevan credenciales');

  /* ===== 2. unidades: rutas coherentes con lo que instala el guion ===== */
  { const dir=path.join(raiz,'operaciones/systemd'); let bad=[];
    for(const f of fs.readdirSync(dir)) for(const l of fs.readFileSync(path.join(dir,f),'utf8').split('\n')){ const m=/ExecStart=.*?\/opt\/nativa\/(\S+)/.exec(l); if(m&&!fs.existsSync(path.join(raiz,m[1]))) bad.push(f+': '+m[1]); }
    ok(!bad.length,'cada ExecStart apunta a un archivo que existe en el repositorio ('+bad.join(', ')+')');
    const rutas=[...fs.readdirSync(dir).map(f=>fs.readFileSync(path.join(dir,f),'utf8')).join('\n').matchAll(/EnvironmentFile=(\S+)/g)].map(m=>m[1]).sort();
    ok(rutas.join()==='/etc/nativa-respaldo/respaldo.env,/etc/nativa-respaldo/respaldo.env,/etc/nativa/juego.env','los archivos de entorno de las unidades son los que crea el guion ('+rutas+')'); }

  /* ===== 3. verificar-despliegue contra un servidor local de producción (y contra uno mal configurado) ===== */
  const ORIGEN='https://marcossantiagocenteno-png.github.io';
  const levantar=async(env)=>{ const puerto=await libre(), dir=tmp('mundo'); const h=spawn(process.execPath,[path.join(raiz,'servidor/iniciar.js')],{env:Object.assign({PATH:process.env.PATH,NATIVA_DATOS:dir,PORT:String(puerto)},env)}); let sal=''; h.stdout.on('data',d=>sal+=d); h.stderr.on('data',d=>sal+=d);
    for(let i=0;i<120&&!/escuchando en/.test(sal);i++) await new Promise(r=>setTimeout(r,50)); return {puerto,h,sal:()=>sal,parar:()=>new Promise(r=>{ if(h.exitCode!==null) return r(); h.on('close',r); h.kill('SIGTERM'); })}; };
  { const s=await levantar({NODE_ENV:'production',NATIVA_ADMIN_TOKEN:'clave-de-prueba-larga-1234',NATIVA_SESION_CLAVE:'firma-de-prueba-0123456789-abcdefghijklmnop',NATIVA_ORIGENES:ORIGEN,NATIVA_HOST:'127.0.0.1'});
    const v=await verificar({url:'http://127.0.0.1:'+s.puerto,origen:ORIGEN,local:true,ip:ip4,puertoJuego:s.puerto}); ok(v.ok,'verificar-despliegue: un servidor de producción bien configurado pasa ('+v.res.filter(x=>x.ok===false).map(x=>x.que+' → '+x.detalle).join('; ')+')');
    ok(v.res.some(x=>x.ok===true&&/origen ajeno/.test(x.que))&&v.res.some(x=>x.ok===true&&/SIN origen/.test(x.que))&&v.res.some(x=>x.ok===true&&/abre/.test(x.que)),'verifica origen ajeno, ausencia de origen y la apertura del WebSocket');
    if(ip4) ok(v.res.some(x=>x.ok===true&&/NO se alcanza desde fuera/.test(x.que)),'con NATIVA_HOST=127.0.0.1 el puerto del juego no se alcanza por la dirección de la máquina'); await s.parar(); }
  { const s=await levantar({});   // desarrollo: sin orígenes, escucha en todas las interfaces
    const v=await verificar({url:'http://127.0.0.1:'+s.puerto,origen:ORIGEN,local:true,ip:ip4,puertoJuego:s.puerto}); ok(!v.ok,'verificar-despliegue: un servidor sin lista de orígenes NO pasa');
    ok(v.res.some(x=>x.ok===false&&/origen ajeno/.test(x.que)),'detecta que acepta un origen ajeno'); if(ip4) ok(v.res.some(x=>x.ok===false&&/NO se alcanza desde fuera/.test(x.que)),'detecta que el puerto del juego se alcanza desde fuera'); await s.parar(); }
  { const v=await verificar({url:'http://127.0.0.1:9',origen:ORIGEN,local:true}); ok(!v.ok,'verificar-despliegue: si no hay servidor, falla (no da por bueno el silencio)'); }

  /* ===== 4. experimento del proxy (condición 2) ===== */
  { const F='203.0.113.77', IP='198.51.100.20';
    ok(evaluar(null,F,IP).ok===false,'veredicto: sin X-Forwarded-For falla'); ok(evaluar(F,F,IP).ok===false,'veredicto: el proxy dejó intacto lo del cliente → falla');
    ok(evaluar(F+', '+IP,F,IP).ok===true,'veredicto: el proxy añadió la dirección real al final → bien'); ok(evaluar(IP,F,IP).ok===true,'veredicto: el proxy reemplazó la cabecera por la real → bien');
    ok(evaluar(F+', '+IP+', 10.0.0.9',F,IP).ok===false,'veredicto: otro proxy detrás (último elemento ajeno) → falla'); ok(evaluar(IP,F,undefined).ok===null&&evaluar(IP,F,undefined).veredicto==='REVISAR','veredicto: sin dirección esperada pide revisión humana'); }
  const proxy=(modo,destino)=>new Promise(res=>{ const srv=http.createServer((req,rs)=>{ const h=Object.assign({},req.headers); const entra=h['x-forwarded-for'], real=req.socket.remoteAddress.replace('::ffff:','');
      if(modo==='anexar') h['x-forwarded-for']=(entra?entra+', ':'')+real; else if(modo==='reemplazar') h['x-forwarded-for']=real; else if(modo==='ninguno') delete h['x-forwarded-for'];
      const q=http.request({host:'127.0.0.1',port:destino,path:req.url,method:req.method,headers:h},x=>{ x.resume(); x.on('end',()=>{ rs.writeHead(200); rs.end('ok'); }); }); q.on('error',()=>{ rs.writeHead(502); rs.end(); }); q.end(); });
    srv.listen(0,'127.0.0.1',()=>res({puerto:srv.address().port,cerrar:()=>new Promise(r=>{ srv.close(()=>r()); srv.closeAllConnections&&srv.closeAllConnections(); })})); });
  for(const [modo,esperado] of [['anexar',0],['reemplazar',0],['intacto',1],['ninguno',1]]){
    const pe=await libre(), eco=spawn(process.execPath,[path.join(raiz,'operaciones/despliegue/probar-proxy.js'),'eco','--puerto',String(pe),'--ip-esperada','127.0.0.1']); let sal=''; eco.stdout.on('data',d=>sal+=d); eco.stderr.on('data',d=>sal+=d);
    for(let i=0;i<100&&!/eco esperando/.test(sal);i++) await new Promise(r=>setTimeout(r,50));
    const px=await proxy(modo,pe), env=await new Promise(res=>{ const h=spawn(process.execPath,[path.join(raiz,'operaciones/despliegue/probar-proxy.js'),'enviar','http://127.0.0.1:'+px.puerto+'/prueba']); h.on('close',c=>res({status:c})); });   // asíncrono: el proxy simulado vive en ESTE proceso
    const cod=await new Promise(r=>{ if(eco.exitCode!==null) return r(eco.exitCode); eco.on('close',r); setTimeout(()=>{ eco.kill(); },15000); });
    ok(env.status===0&&cod===esperado,'proxy simulado «'+modo+'»: el experimento '+(esperado?'FALLA':'da BIEN')+' como debe (código '+cod+')'); await px.cerrar(); }
  { const pe=await libre(); const ocupado=net.createServer(); await new Promise(r=>ocupado.listen(pe,'127.0.0.1',r)); const r=sh(process.execPath,[path.join(raiz,'operaciones/despliegue/probar-proxy.js'),'eco','--puerto',String(pe)]); ok(r.status===2&&/sigue encendido el juego/.test(r.stderr),'el eco se niega a arrancar si el puerto del juego está ocupado (juego encendido)'); ocupado.close(); }

  /* ===== 5. publicar.sh contra un remoto local ===== */
  { const bare=tmp('bare'), w=tmp('trabajo'), pub=path.join(raiz,'operaciones/publicacion/publicar.sh');
    sh('git',['init','-q','--bare','-b','main',bare]); git(w,'init','-q','-b','main'); fs.mkdirSync(path.join(w,'src/juego'),{recursive:true}); fs.writeFileSync(path.join(w,'src/juego/destino.js'),'x'); fs.writeFileSync(path.join(w,'a.txt'),'1'); git(w,'add','-A'); git(w,'commit','-q','-m','uno'); git(w,'remote','add','origin',bare); git(w,'push','-q','origin','main');
    git(w,'checkout','-q','-b','multijugador'); fs.writeFileSync(path.join(w,'a.txt'),'2'); git(w,'commit','-qam','dos'); git(w,'push','-q','origin','multijugador'); const c2=git(w,'rev-parse','HEAD').stdout.trim();
    const mainAntes=sh('git',['--git-dir',bare,'rev-parse','main']).stdout.trim(); const P=(args,env)=>sh('bash',[pub].concat(args),{cwd:w,env:Object.assign({PATH:process.env.PATH,HOME:process.env.HOME||'/tmp',GIT_AUTHOR_NAME:'p',GIT_AUTHOR_EMAIL:'p@x',GIT_COMMITTER_NAME:'p',GIT_COMMITTER_EMAIL:'p@x'},env||{})});
    const remota=r=>sh('git',['--git-dir',bare,'rev-parse','--verify','--quiet','refs/heads/'+r]).stdout.trim();
    let x=P([c2]); ok(x.status===0&&/simulacro/.test(x.stdout)&&remota('publicado')==='','sin --si es un simulacro: no publica nada');
    x=P([c2,'--si']); ok(x.status===0&&remota('publicado')===c2,'con --si publica ese commit en «publicado»'); ok(sh('git',['--git-dir',bare,'rev-parse','main']).stdout.trim()===mainAntes,'main del remoto sigue idéntica');
    x=P([c2,'--si'],{NV_RAMA:'main'}); ok(x.status===1&&/jamás/.test(x.stderr),'se niega a publicar sobre main'); x=P([c2,'--si'],{NV_RAMA:'master'}); ok(x.status===1,'se niega a publicar sobre master');
    fs.writeFileSync(path.join(w,'a.txt'),'3'); git(w,'commit','-qam','tres'); const c3=git(w,'rev-parse','HEAD').stdout.trim();
    x=P([c3,'--si']); ok(x.status===1&&/no está en ninguna rama/.test(x.stderr)&&remota('publicado')===c2,'no publica un commit que no está subido'); git(w,'push','-q','origin','multijugador');
    fs.writeFileSync(path.join(w,'suelto.txt'),'x'); x=P([c3,'--si']); ok(x.status===1&&/cambios sin guardar/.test(x.stderr)&&remota('publicado')===c2,'no publica con el árbol sucio'); fs.rmSync(path.join(w,'suelto.txt'));
    x=P([c3,'--si']); ok(x.status===0&&remota('publicado')===c3,'un commit posterior se publica avanzando la rama (sin forzar)');
    x=P([c2,'--si']); ok(x.status===1&&/no fuerza/.test(x.stderr)&&remota('publicado')===c3,'volver a un commit anterior exigiría forzar y se niega');
    x=P(['deadbeef','--si']); ok(x.status===1&&/no existe/.test(x.stderr),'un commit inexistente se rechaza'); x=P([]); ok(x.status===2,'sin argumentos da el uso');
    ok(remota('main')===mainAntes,'main sigue idéntica al terminar'); }

  /* ===== 6. los documentos nombran archivos que existen ===== */
  { const falta=[]; for(const d of ['docs/DESPLIEGUE.md','docs/PUBLICACION.md','docs/RESPALDOS.md']){ const t=fs.readFileSync(path.join(raiz,d),'utf8');
      for(const m of t.matchAll(/`((?:operaciones|pruebas|servidor|docs|src)\/[A-Za-z0-9_.\/-]+\.(?:js|sh|md|yml|service|timer|ejemplo|plantilla))`/g)) if(!fs.existsSync(path.join(raiz,m[1]))&&!/\*/.test(m[1])) falta.push(d+' → '+m[1]); }
    ok(!falta.length,'cada archivo citado en los documentos de despliegue existe ('+[...new Set(falta)].join(', ')+')'); }

  console.log('despliegue: '+bien+' bien, '+mal+' mal'); process.exit(mal?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });

// Etapa 7: sistema de respaldos (operaciones/respaldos). Todo contra carpetas temporales y un B2 simulado: no toca servicios externos.
// Cubre las condiciones del encargo: historial completo, copia con el servidor escribiendo, copia mala nunca subida, alertas, ensayo sin tocar el
// mundo en uso, repetir sin dañar, secretos fuera, y que lo que se ensaya no necesita la clave maestra.
const fs=require('fs'), os=require('os'), path=require('path'), {spawn,spawnSync}=require('child_process');
const raiz=path.resolve(__dirname,'..'), OP=path.join(raiz,'operaciones','respaldos');
const {abrirMundoOficial}=require(path.join(raiz,'servidor','mundo-oficial.js'));
const {listarArbol,igualesArboles,hashArchivo}=require(path.join(OP,'lib','comun.js'));
const {inspeccionarCabecera}=require(path.join(OP,'lib','cifrado.js'));
const {restaurarPaquete}=require(path.join(OP,'restaurar.js'));
const {vigilar}=require(path.join(OP,'vigilar.js'));
const {ensayar}=require(path.join(OP,'ensayo.js'));
const {verificarB2}=require(path.join(OP,'verificar-b2.js'));
const {destinoCarpeta,destinoB2}=require(path.join(OP,'lib','destinos.js'));
const {crear:crearB2}=require('./ayudas/b2-falso.js');
let bien=0,mal=0; const ok=(c,t)=>{ if(c) bien++; else { mal++; console.log('MAL:',t); } };
const tmp=p=>fs.mkdtempSync(path.join(os.tmpdir(),'nv-resp-'+(p||'')));
const t0=Date.now();
const age=()=>{ const f=path.join(tmp('k'),'k.txt'); const r=spawnSync('age-keygen',['-o',f],{encoding:'utf8'}); return {id:f,pub:(r.stderr+r.stdout).match(/age1[a-z0-9]+/)[0]}; };
const mundo=async(dir,n,cadaN)=>{ const M=await abrirMundoOficial({dir,cadaN:cadaN||20}); for(let i=0;i<n;i++) await M.aplicar({t:'suelo',x:40+i%10,y:40+((i/10)|0),m:i%2?'d':'g'},'p'+(i%3)); await M.cerrar(); };
const sinLock=d=>{ const a=listarArbol(d); delete a['.lock']; return a; };
const arch=(d,p)=>{ const o=[]; (function r(x){ if(!fs.existsSync(x)) return; for(const e of fs.readdirSync(x,{withFileTypes:true})){ const q=path.join(x,e.name); e.isDirectory()?r(q):o.push(path.relative(d,q)); } })(d); return o.sort(); };

(async()=>{
  const M=age(), Rv=age(), V=age(), X=age();
  const datos=tmp('datos'), estado=tmp('estado'), dest=tmp('dest'), trabajo=tmp('trab');
  await mundo(datos,60);
  const base={PATH:process.env.PATH,HOME:process.env.HOME||'/tmp',NATIVA_DATOS:datos,NATIVA_CODIGO:raiz,NATIVA_RESPALDO_ESTADO:estado,NATIVA_RESPALDO_TRABAJO:trabajo,
    NATIVA_RESPALDO_DESTINO:'carpeta:'+dest,NATIVA_RESPALDO_DESTINATARIOS:M.pub+','+Rv.pub,NATIVA_RESPALDO_VERIFICADOR:V.pub};
  const correr=(args,env)=>spawnSync(process.execPath,[path.join(OP,'respaldar.js')].concat(args),{env:Object.assign({},base,env||{}),encoding:'utf8',timeout:240000});
  const subidos=(n,pref)=>arch(path.join(dest,n)).filter(f=>f.startsWith(pref+'/')&&f.endsWith('.tar.gz.age'));

  if(process.env.PRUEBAS_TIEMPOS) console.log('  [t='+Math.round((Date.now()-t0)/1000)+'s] antes de la sección 1');
  /* ===== 1. primera corrida: no modifica el mundo, sube los cuatro niveles, ficha completa ===== */
  const antes=listarArbol(datos);
  let r=correr(['--auto','--ahora','2026-11-24T12:30:00Z']);
  ok(r.status===0,'respaldo: sale bien ('+r.stderr.slice(-300)+')');
  ok(igualesArboles(antes,listarArbol(datos)).length===0,'el respaldo NO modifica ni un byte de la carpeta de datos');
  ok(subidos('seisHoras','seis-horas').length===1&&subidos('diario','diario').length===1&&subidos('semanal','semanal').length===1&&subidos('seisHoras','canario').length===1,'sube seis horas, diario, semanal y canario');
  const A=path.join(dest,'seisHoras',subidos('seisHoras','seis-horas')[0]), J=A.replace(/\.tar\.gz\.age$/,'.json'), ficha=JSON.parse(fs.readFileSync(J,'utf8'));
  ok(/^[0-9a-f]{40}$/.test(ficha.commit)&&ficha.node===process.version&&ficha.auditoria==='ok'&&ficha.vivoCoincide===true&&ficha.seq===60,'la ficha lleva commit, Node, auditoría ok, huella igual a la del mundo original y versión 60');
  ok(ficha.sha256===hashArchivo(A),'la ficha trae la suma SHA-256 del archivo cifrado');
  if(process.env.PRUEBAS_TIEMPOS) console.log('  [t='+Math.round((Date.now()-t0)/1000)+'s] antes de la sección 2');
  /* ===== 2. cifrado ===== */
  ok(inspeccionarCabecera(A).destinatarios===2,'cifrado para dos claves (maestra y reserva)');
  ok(!fs.readFileSync(A).includes('suelo')&&!fs.readFileSync(A).includes('nativa-respaldo'),'el archivo cifrado no deja ver texto del mundo');
  const dec=(id,f)=>spawnSync('age',['--decrypt','-i',id,'-o','/dev/null',f],{encoding:'utf8'}).status;
  ok(dec(M.id,A)===0&&dec(Rv.id,A)===0,'la maestra y la de reserva abren el respaldo real');
  ok(dec(V.id,A)!==0&&dec(X.id,A)!==0,'ni el verificador ni una clave ajena abren el respaldo real');
  const C=path.join(dest,'seisHoras',subidos('seisHoras','canario')[0]);
  ok(dec(V.id,C)===0&&dec(M.id,C)!==0&&inspeccionarCabecera(C).destinatarios===1,'el canario sólo lo abre el verificador');
  if(process.env.PRUEBAS_TIEMPOS) console.log('  [t='+Math.round((Date.now()-t0)/1000)+'s] antes de la sección 3');
  /* ===== 3. repetir no duplica ni daña ===== */
  const foto=listarArbol(dest); r=correr(['--auto','--ahora','2026-11-24T12:45:00Z']);
  ok(r.status===0&&igualesArboles(foto,listarArbol(dest)).length===0,'repetir en el mismo periodo no sube nada ni cambia nada');
  r=correr(['--auto','--forzar','--ahora','2026-11-24T12:30:00Z']);
  ok(r.status===1&&igualesArboles(foto,listarArbol(dest)).length===0&&fs.existsSync(path.join(estado,'alerta.json')),'forzar sobre el mismo nombre falla SIN pisar lo ya guardado y deja alerta');
  r=correr(['--nivel','seis-horas','--forzar','--ahora','2026-11-24T12:31:00Z']);
  ok(r.status===0&&subidos('seisHoras','seis-horas').length===2&&!fs.existsSync(path.join(estado,'alerta.json')),'una copia extra forzada se agrega aparte y borra la alerta vieja');
  r=correr(['--auto','--ahora','2026-11-24T18:10:00Z']);
  ok(r.status===0&&subidos('seisHoras','seis-horas').length===3&&subidos('diario','diario').length===1&&subidos('semanal','semanal').length===1,'seis horas después: otra de 6 h; la diaria y la semanal siguen siendo una');
  r=correr(['--auto','--ahora','2026-11-25T00:10:00Z']);
  ok(r.status===0&&subidos('diario','diario').length===2&&subidos('semanal','semanal').length===1,'al día siguiente: nueva diaria; la semanal sigue siendo la misma');
  r=correr(['--auto','--ahora','2026-11-30T00:10:00Z']);
  ok(r.status===0&&subidos('semanal','semanal').length===2,'la semana siguiente: nueva semanal');
  /* candado */
  const nAntes=subidos('seisHoras','seis-horas').length; fs.writeFileSync(path.join(estado,'respaldar.lock'),'99999999'); r=correr(['--nivel','seis-horas','--forzar','--ahora','2026-12-01T01:00:00Z']);
  ok(r.status===0&&subidos('seisHoras','seis-horas').length===nAntes+1,'un candado de un proceso muerto no bloquea');
  fs.writeFileSync(path.join(estado,'respaldar.lock'),String(process.pid)); const n4=subidos('seisHoras','seis-horas').length; r=correr(['--nivel','seis-horas','--forzar','--ahora','2026-12-01T02:00:00Z']);
  ok(r.status===0&&subidos('seisHoras','seis-horas').length===n4,'con un respaldo en curso (candado vivo) la segunda corrida se omite sin hacer nada'); fs.rmSync(path.join(estado,'respaldar.lock'));

  if(process.env.PRUEBAS_TIEMPOS) console.log('  [t='+Math.round((Date.now()-t0)/1000)+'s] antes de la sección 4');
  /* ===== 4. restauración: idéntica al mundo, sin tocar el que está en uso ===== */
  const rest=path.join(tmp('rest'),'datos'), cod=path.join(tmp('cod'),'codigo');
  let q=await restaurarPaquete({archivo:A,meta:J,identidad:M.id,datosDestino:rest,codigoDestino:cod});
  ok(q.ok&&q.auditoria.seq===60&&q.auditoria.versiones===60,'restaura: 60 de 60 versiones, auditoría completa');
  ok(igualesArboles(sinLock(datos),sinLock(rest)).length===0,'la carpeta restaurada es byte por byte la del mundo');
  ok(fs.existsSync(path.join(cod,'servidor','mundo-oficial.js')),'el código del commit viaja en el respaldo');
  q=await restaurarPaquete({archivo:A,meta:J,identidad:M.id,datosDestino:rest}); ok(!q.ok&&/no está vacía/.test(q.problemas.join()),'no restaura sobre una carpeta con datos');
  q=await restaurarPaquete({archivo:A,meta:J,identidad:M.id,datosDestino:datos}); ok(!q.ok,'no restaura sobre una carpeta con datos (el mundo oficial)');
  const vivoEnv=process.env.NATIVA_DATOS; process.env.NATIVA_DATOS=datos; q=await restaurarPaquete({archivo:A,meta:J,identidad:M.id,datosDestino:path.join(datos,'sub')}); process.env.NATIVA_DATOS=vivoEnv;
  ok(!q.ok&&/NATIVA_DATOS/.test(q.problemas.join()),'no restaura dentro de NATIVA_DATOS');
  q=await restaurarPaquete({archivo:A,meta:J,identidad:V.id,soloVerificar:true}); ok(!q.ok,'sin la clave correcta no hay restauración');
  const mala=path.join(tmp('mala'),'x.age'); const bufA=fs.readFileSync(A); bufA[bufA.length-10]^=1; fs.writeFileSync(mala,bufA);
  q=await restaurarPaquete({archivo:mala,meta:J,identidad:M.id,soloVerificar:true}); ok(!q.ok&&/SHA-256/.test(q.problemas.join()),'un archivo alterado se detecta antes de descifrar');
  ok(igualesArboles(antes,listarArbol(datos)).length===0,'ningún ensayo tocó el mundo en uso');

  if(process.env.PRUEBAS_TIEMPOS) console.log('  [t='+Math.round((Date.now()-t0)/1000)+'s] antes de la sección 5');
  /* ===== 5. copias malas: nunca se suben ===== */
  const malo=async(nombre,dañar,esperar)=>{
    const d=tmp('malo'); await mundo(d,40); dañar(d); const e=tmp('est'), dd=tmp('dest'), fotoD=listarArbol(d);
    const rr=spawnSync(process.execPath,[path.join(OP,'respaldar.js'),'--nivel','seis-horas','--ahora','2026-11-24T12:30:00Z'],{env:Object.assign({},base,{NATIVA_DATOS:d,NATIVA_RESPALDO_ESTADO:e,NATIVA_RESPALDO_DESTINO:'carpeta:'+dd}),encoding:'utf8',timeout:240000});
    ok(rr.status===1,nombre+': el respaldo falla (salida '+rr.status+')'); ok(arch(dd).length===0,nombre+': NO se sube nada');
    ok(fs.existsSync(path.join(e,'alerta.json'))&&JSON.parse(fs.readFileSync(path.join(e,'ultimo.json'),'utf8')).ok===false,nombre+': queda alerta y estado de fallo');
    ok(igualesArboles(fotoD,listarArbol(d)).length===0,nombre+': el original queda intacto');
    if(esperar) ok(esperar.test(fs.readFileSync(path.join(e,'alerta.json'),'utf8')),nombre+': la alerta dice por qué');
  };
  await malo('línea del diario alterada',d=>{ const p=path.join(d,'diario.ndjson'), t=fs.readFileSync(p,'utf8').split('\n'); t[10]=t[10].replace(/"x":(\d+)/,(m,n)=>'"x":'+(+n+1)); fs.writeFileSync(p,t.join('\n')); },/auditor|no superó|checksum|suma|huella|v[aá]lid/i);
  await malo('instantánea alterada',d=>{ const p=path.join(d,'instantaneas'); const f=fs.readdirSync(p).sort().pop(); const t=fs.readFileSync(path.join(p,f),'utf8'); fs.writeFileSync(path.join(p,f),t.replace(/"suelo"/,'"sueto"').replace(/(\d)/,m=>String((+m+1)%10))); });
  await malo('falta una línea intermedia del diario',d=>{ const p=path.join(d,'diario.ndjson'), t=fs.readFileSync(p,'utf8').split('\n'); t.splice(7,1); fs.writeFileSync(p,t.join('\n')); });
  await malo('diario vacío con instantáneas adelante',d=>{ fs.writeFileSync(path.join(d,'diario.ndjson'),''); });
  await malo('sin meta.json',d=>fs.rmSync(path.join(d,'meta.json')));

  if(process.env.PRUEBAS_TIEMPOS) console.log('  [t='+Math.round((Date.now()-t0)/1000)+'s] antes de la sección 6');
  /* ===== 6. renglón cortado a media escritura: se corta en el último salto de línea, sin tocar el original ===== */
  { const d=tmp('cola'); await mundo(d,40); fs.appendFileSync(path.join(d,'diario.ndjson'),'{"seq":41,"ts":1,"autor":"x","t":"op","op":{"t":"sue'); const fotoD=listarArbol(d), e=tmp('est'), dd=tmp('dest');
    const rr=spawnSync(process.execPath,[path.join(OP,'respaldar.js'),'--nivel','seis-horas','--ahora','2026-11-24T12:30:00Z'],{env:Object.assign({},base,{NATIVA_DATOS:d,NATIVA_RESPALDO_ESTADO:e,NATIVA_RESPALDO_DESTINO:'carpeta:'+dd}),encoding:'utf8',timeout:240000});
    ok(rr.status===0&&subidos2(dd).length===1,'renglón a medio escribir: el respaldo sale bien con la parte completa ('+rr.stderr.slice(-200)+')'); ok(igualesArboles(fotoD,listarArbol(d)).length===0,'renglón a medio escribir: el original no se toca');
    function subidos2(x){ return arch(x).filter(f=>f.endsWith('.tar.gz.age')); }
    const p=subidos2(dd)[0]; const qq=await restaurarPaquete({archivo:path.join(dd,p),identidad:M.id,soloVerificar:true}); ok(qq.ok&&qq.manifiesto.seq===40,'renglón a medio escribir: la copia restaura hasta la versión 40'); }

  if(process.env.PRUEBAS_TIEMPOS) console.log('  [t='+Math.round((Date.now()-t0)/1000)+'s] antes de la sección 7');
  /* ===== 7. secretos ===== */
  { const d=tmp('sec'); await mundo(d,30); fs.writeFileSync(path.join(d,'secreto.env'),'NATIVA_ADMIN_TOKEN=abcdEFGH1234567890zzzz\n'); fs.writeFileSync(path.join(d,'clave.pem'),'-----BEGIN PRIVATE KEY-----\nx\n');
    const e=tmp('est'), dd=tmp('dest'), env=Object.assign({},base,{NATIVA_DATOS:d,NATIVA_RESPALDO_ESTADO:e,NATIVA_RESPALDO_DESTINO:'carpeta:'+dd});
    let rr=spawnSync(process.execPath,[path.join(OP,'respaldar.js'),'--nivel','seis-horas','--ahora','2026-11-24T12:30:00Z'],{env,encoding:'utf8',timeout:240000});
    ok(rr.status===0,'archivos sueltos con secretos en la carpeta de datos: el respaldo sigue ('+rr.stderr.slice(-200)+')');
    const p=arch(dd).find(f=>f.endsWith('.tar.gz.age')), fj=JSON.parse(fs.readFileSync(path.join(dd,p.replace('.tar.gz.age','.json')),'utf8'));
    ok(fj.omitidos.includes('secreto.env')&&fj.omitidos.includes('clave.pem'),'los nombres desconocidos se omiten y se anotan en la ficha');
    const x=tmp('x'); const idf=M.id; const tgz=path.join(x,'p.tgz'); spawnSync('age',['--decrypt','-i',idf,'-o',tgz,path.join(dd,p)]); spawnSync('tar',['-xzf',tgz,'-C',x]);
    ok(!arch(x).some(f=>/secreto\.env|clave\.pem/.test(f))&&!arch(x).some(f=>/\.env$|\.pem$|\.key$/.test(f)),'ni el .env ni el .pem entraron al paquete');
    ok(!arch(x).filter(f=>f.startsWith('codigo/')).some(f=>/node_modules|\.git\//.test(f)),'el código del paquete no lleva node_modules ni .git');
    /* un secreto dentro de un archivo SÍ permitido aborta */
    const d2=tmp('sec2'); await mundo(d2,30); fs.writeFileSync(path.join(d2,'sesiones-revocadas.json'),JSON.stringify({formato:'nativa-revocadas-1',desde:0,revocadas:[],nota:'NATIVA_SESION_CLAVE=ZXCVBNM1234567890qwerty'}));
    const dd2=tmp('dest'), e2=tmp('est'); rr=spawnSync(process.execPath,[path.join(OP,'respaldar.js'),'--nivel','seis-horas','--ahora','2026-11-24T12:30:00Z'],{env:Object.assign({},env,{NATIVA_DATOS:d2,NATIVA_RESPALDO_DESTINO:'carpeta:'+dd2,NATIVA_RESPALDO_ESTADO:e2}),encoding:'utf8',timeout:240000});
    ok(rr.status===1&&arch(dd2).length===0&&/secretos/.test(fs.readFileSync(path.join(e2,'alerta.json'),'utf8')),'un secreto dentro de un archivo permitido aborta el respaldo');
    const d3=tmp('sec3'); await mundo(d3,30); fs.writeFileSync(path.join(d3,'sesiones-revocadas.json'),JSON.stringify({formato:'nativa-revocadas-1',desde:0,revocadas:[],nota:'valor-conocido-9876543210'}));
    const dd3=tmp('dest'), e3=tmp('est'); rr=spawnSync(process.execPath,[path.join(OP,'respaldar.js'),'--nivel','seis-horas','--ahora','2026-11-24T12:30:00Z'],{env:Object.assign({},env,{NATIVA_DATOS:d3,NATIVA_RESPALDO_DESTINO:'carpeta:'+dd3,NATIVA_RESPALDO_ESTADO:e3,NATIVA_ADMIN_TOKEN:'valor-conocido-9876543210'}),encoding:'utf8',timeout:240000});
    ok(rr.status===1&&arch(dd3).length===0,'si el valor EXACTO del token del servidor aparece en el paquete, aborta'); }

  if(process.env.PRUEBAS_TIEMPOS) console.log('  [t='+Math.round((Date.now()-t0)/1000)+'s] antes de la sección 8');
  /* ===== 8. con el servidor escribiendo sin parar ===== */
  { const live=tmp('vivo'), parada=path.join(tmp('stop'),'parar'); const w=spawn(process.execPath,[path.join(__dirname,'ayudas','escritor.js'),live,parada,'4'],{stdio:['ignore','pipe','inherit']}); let salida=''; w.stdout.on('data',d=>salida+=d);
    for(let i=0;i<200&&!fs.existsSync(parada+'.listo');i++) await new Promise(r=>setTimeout(r,50));
    const e=tmp('est'), dd=tmp('dest'), env=Object.assign({},base,{NATIVA_DATOS:live,NATIVA_RESPALDO_ESTADO:e,NATIVA_RESPALDO_DESTINO:'carpeta:'+dd}); const seqs=[]; let fallos=0;
    for(let i=0;i<8;i++){ const rr=spawnSync(process.execPath,[path.join(OP,'respaldar.js'),'--nivel','seis-horas','--forzar','--ahora','2026-11-24T1'+i+':00:00Z'],{env,encoding:'utf8',timeout:240000}); if(rr.status!==0){ fallos++; console.log(rr.stderr.slice(-400)); } }
    fs.writeFileSync(parada,'1'); await new Promise(r=>w.on('close',r)); const escritas=+/escritas (\d+)/.exec(salida)[1];
    ok(escritas>100,'el escritor siguió trabajando durante los respaldos ('+escritas+' ediciones)'); ok(fallos===0,'8 respaldos con el servidor escribiendo: ninguno falló ('+fallos+' fallos)');
    const lista=arch(dd).filter(f=>f.endsWith('.tar.gz.age')).sort(); ok(lista.length===8,'8 archivos subidos'); let prev=0, prefijos=0, historial=0;
    const vivoD=fs.readFileSync(path.join(live,'diario.ndjson'));
    for(const f of lista){ const qq=await restaurarPaquete({archivo:path.join(dd,f),identidad:M.id,soloVerificar:true}); if(!qq.ok){ ok(false,'restauración de '+f+': '+qq.problemas.join()); continue; }
      ok(qq.auditoria.seq>=prev&&qq.auditoria.versiones===qq.auditoria.seq,'cada copia restaura sin huecos (versión '+qq.auditoria.seq+')'); prev=qq.auditoria.seq; historial++;
      const x=tmp('pre'), tgz=path.join(x,'p.tgz'); spawnSync('age',['--decrypt','-i',M.id,'-o',tgz,path.join(dd,f)]); spawnSync('tar',['-xzf',tgz,'-C',x]); const dc=fs.readFileSync(path.join(x,'datos','diario.ndjson'));
      if(vivoD.subarray(0,dc.length).equals(dc)&&dc[dc.length-1]===10) prefijos++; }
    ok(prefijos===8,'el diario de cada copia es EXACTAMENTE el comienzo del diario vivo, terminado en salto de línea ('+prefijos+'/8)');
    ok(prev>0&&prev<=escritas+0&&historial===8,'las versiones crecen y nunca pasan de lo escrito');
    /* con el escritor parado, una copia final es el mundo entero */
    const rr=spawnSync(process.execPath,[path.join(OP,'respaldar.js'),'--nivel','diario','--forzar','--ahora','2026-11-24T23:00:00Z'],{env,encoding:'utf8',timeout:240000}); ok(rr.status===0,'copia final con el servidor parado');
    const fin=arch(dd).filter(f=>f.startsWith('diario/')&&f.endsWith('.tar.gz.age'))[0], rr2=path.join(tmp('fin'),'d'); const qq=await restaurarPaquete({archivo:path.join(dd,fin),identidad:M.id,datosDestino:rr2});
    ok(qq.ok&&qq.auditoria.seq===escritas&&igualesArboles(sinLock(live),sinLock(rr2)).length===0,'copia final: restauración idéntica byte por byte al mundo con todo su historial ('+escritas+' versiones)'); }

  if(process.env.PRUEBAS_TIEMPOS) console.log('  [t='+Math.round((Date.now()-t0)/1000)+'s] antes de la sección 9');
  /* ===== 9. vigilancia ===== */
  { const dst=destinoCarpeta(dest), ahora=Date.parse('2026-12-01T02:30:00Z'), env={NATIVA_RESPALDO_N_DESTINATARIOS:'2',NATIVA_VIGILAR_MAX_HORAS_CANARIO:'48'};
    let v=await vigilar(dst,env,ahora); ok(v.ok,'vigilar: todo en orden recién respaldado ('+v.problemas.join('; ')+')');
    v=await vigilar(dst,env,ahora+40*3600e3); ok(!v.ok&&/dejó de respaldar/.test(v.problemas.join()),'vigilar: 40 h sin respaldar da alarma');
    v=await vigilar(dst,{NATIVA_RESPALDO_N_DESTINATARIOS:'3'},ahora); ok(!v.ok&&/destinatarios|claves/.test(v.problemas.join()),'vigilar: detecta que no está cifrado para las claves esperadas');
    v=await vigilar(destinoCarpeta(tmp('vacio')),env,ahora); ok(!v.ok&&v.problemas.length>=3,'vigilar: un destino vacío es alarma, no silencio');
    const d2=tmp('d2'); fs.cpSync(dest,d2,{recursive:true}); const l=arch(path.join(d2,'seisHoras','seis-horas')).filter(f=>f.endsWith('.json')).sort(), ult=path.join(d2,'seisHoras','seis-horas',l[l.length-1]); const fj=JSON.parse(fs.readFileSync(ult,'utf8'));
    fs.writeFileSync(ult,JSON.stringify(Object.assign({},fj,{seq:3}))); v=await vigilar(destinoCarpeta(d2),env,ahora); ok(!v.ok&&/RETROCED/.test(v.problemas.join()),'vigilar: una versión que retrocede es alarma');
    fs.writeFileSync(ult,JSON.stringify(Object.assign({},fj,{auditoria:'no'}))); v=await vigilar(destinoCarpeta(d2),env,ahora); ok(!v.ok&&/auditor/.test(v.problemas.join()),'vigilar: una ficha sin auditoría ok es alarma');
    fs.writeFileSync(ult,JSON.stringify(fj)); const ag=ult.replace(/\.json$/,'.tar.gz.age'), bb=fs.readFileSync(ag); bb[bb.length-5]^=1; fs.writeFileSync(ag,bb); v=await vigilar(destinoCarpeta(d2),env,ahora); ok(!v.ok&&/SHA-256/.test(v.problemas.join()),'vigilar: un archivo cambiado es alarma');
    const d3=tmp('d3'); fs.cpSync(dest,d3,{recursive:true}); for(const f of arch(path.join(d3,'seisHoras','canario'))) fs.rmSync(path.join(d3,'seisHoras','canario',f)); v=await vigilar(destinoCarpeta(d3),env,ahora); ok(!v.ok&&/canario/.test(v.problemas.join()),'vigilar: que falte el canario es alarma');
    /* ensayo */
    let en=await ensayar(dst,{NATIVA_VERIFICADOR_IDENTIDAD:fs.readFileSync(V.id,'utf8').match(/AGE-SECRET-KEY-\S+/)[0]}); ok(en.ok,'ensayo: restaura el canario con la clave del verificador ('+en.problemas.join('; ')+')');
    en=await ensayar(dst,{NATIVA_VERIFICADOR_IDENTIDAD:fs.readFileSync(X.id,'utf8').match(/AGE-SECRET-KEY-\S+/)[0]}); ok(!en.ok,'ensayo: con una clave equivocada falla');
    en=await ensayar(dst,{NATIVA_VERIFICADOR_IDENTIDAD:fs.readFileSync(M.id,'utf8').match(/AGE-SECRET-KEY-\S+/)[0]}); ok(!en.ok,'ensayo: la clave maestra ni siquiera abre el canario (no hay razón para ponerla en GitHub)');
    const sp=spawnSync(process.execPath,[path.join(OP,'vigilar.js'),'--ahora','2026-12-01T02:30:00Z'],{env:{PATH:process.env.PATH,NATIVA_RESPALDO_DESTINO:'carpeta:'+dest},encoding:'utf8'}); ok(sp.status===1||sp.status===0,'vigilar.js corre como programa'); }

  if(process.env.PRUEBAS_TIEMPOS) console.log('  [t='+Math.round((Date.now()-t0)/1000)+'s] antes de la sección 10');
  /* ===== 10. Backblaze B2 (simulado) ===== */
  { const cubos={'nativa-seis-horas':{retencionDias:2,ciclo:[{fileNamePrefix:'',daysFromUploadingToHiding:3,daysFromHidingToDeleting:1}]},'nativa-diario':{retencionDias:7,ciclo:[{fileNamePrefix:'',daysFromUploadingToHiding:8,daysFromHidingToDeleting:1}]},'nativa-semanal':{retencionDias:28,ciclo:[{fileNamePrefix:'',daysFromUploadingToHiding:29,daysFromHidingToDeleting:1}]}};
    const nombres=Object.keys(cubos), claves={esc:{clave:'kesc',cap:['writeFiles'],cubos:nombres},lec:{clave:'klec',cap:['listFiles','readFiles','listBuckets','readFileRetentions'],cubos:nombres},adm:{clave:'kadm',cap:['listBuckets','readBucketRetentions','deleteFiles','readFiles','listFiles'],cubos:null}};
    const B=crearB2({claves,cubos,fallosSubida:n=>n<=2}); const api=await B.iniciar(); process.env.NATIVA_B2_API=api;
    const e=tmp('est'), env={NATIVA_RESPALDO_DESTINO:'b2',B2_ID_ESCRITURA:'esc',B2_CLAVE_ESCRITURA:'kesc',NATIVA_RESPALDO_ESTADO:e,NATIVA_B2_API:api};
    const rr=await new Promise(res=>{ const h=spawn(process.execPath,[path.join(OP,'respaldar.js'),'--auto','--ahora','2026-11-24T12:30:00Z'],{env:Object.assign({},base,env)}); let er=''; h.stderr.on('data',d=>er+=d); h.on('close',c=>res({status:c,stderr:er})); });   // asíncrono: el B2 simulado vive en ESTE proceso
    ok(rr.status===0,'B2: el respaldo sube con la clave de sólo escritura ('+rr.stderr.slice(-300)+')'); ok(B.intentos()>=6,'B2: reintentó con URL nuevo tras los 503 ('+B.intentos()+' intentos)');
    ok(B.archivos.filter(f=>f.bucket==='nativa-seis-horas'&&f.fileName.endsWith('.tar.gz.age')).length===2&&B.archivos.filter(f=>f.bucket==='nativa-diario').length===2&&B.archivos.filter(f=>f.bucket==='nativa-semanal').length===2,'B2: cada nivel va a su bucket (seis horas con el canario, diario, semanal)');
    ok(B.archivos.every(f=>f.retencion&&f.retencion.mode==='compliance'),'B2: todo queda con retención Compliance');
    const sub=B.archivos.find(f=>f.fileName.startsWith('seis-horas/')&&f.fileName.endsWith('.age')); ok(!!sub&&hashArchivo(path.join(dest,'seisHoras',subidos('seisHoras','seis-horas')[0]))!==null,'B2: archivo presente');
    { const antes=B.archivos.length, nm='seis-horas/'+sub.fileName.split('/')[1], e1=destinoB2({id:'esc',clave:'kesc'}); await e1.subirTexto('seisHoras','prueba-version.json','{"a":1}'); await e1.subirTexto('seisHoras','prueba-version.json','{"a":2}');
      ok(B.archivos.length===antes+2&&B.archivos.filter(f=>f.fileName==='prueba-version.json').length===2&&B.archivos.filter(f=>f.fileName==='prueba-version.json').every(f=>f.retencion),'B2: subir dos veces el mismo nombre agrega una versión y no reemplaza ni desbloquea la anterior (cada una con su retención)'); }
    const esc=destinoB2({id:'esc',clave:'kesc'}), lec=destinoB2({id:'lec',clave:'klec'});
    let ex=null; try{ await esc.listar('seisHoras',''); }catch(x){ ex=x; } ok(ex&&ex.estado===401,'B2: la clave de escritura no puede listar');
    ex=null; try{ await esc.cliente.borrar(sub.fileName,sub.fileId); }catch(x){ ex=x; } ok(ex&&ex.estado===401,'B2: la clave de escritura no puede borrar');
    ex=null; try{ await lec.subir('seisHoras','x/y.txt',__filename); }catch(x){ ex=x; } ok(ex&&ex.estado===401,'B2: la clave de lectura no puede subir');
    ok((await lec.listar('seisHoras','seis-horas/')).length>=2,'B2: la clave de lectura lista');
    const venv={NATIVA_VIGILAR_MAX_HORAS_CANARIO:'48',NATIVA_RESPALDO_DESTINO:'b2',B2_ID_LECTURA:'lec',B2_CLAVE_LECTURA:'klec',NATIVA_RESPALDO_N_DESTINATARIOS:'2'}; const vlec=require(path.join(OP,'lib','destinos.js')).destinoDesdeEntorno(venv,'lectura');
    const vv=await vigilar(vlec,venv,Date.parse('2026-11-24T14:00:00Z')); ok(vv.ok,'B2: la vigilancia con la clave de lectura pasa ('+vv.problemas.join('; ')+')');
    const ee=await ensayar(vlec,{NATIVA_VERIFICADOR_IDENTIDAD:fs.readFileSync(V.id,'utf8').match(/AGE-SECRET-KEY-\S+/)[0]}); ok(ee.ok,'B2: el ensayo descarga el canario y lo restaura ('+ee.problemas.join('; ')+')');
    /* verificar-b2 */
    const E={B2_ID_ESCRITURA:'esc',B2_CLAVE_ESCRITURA:'kesc',B2_ID_LECTURA:'lec',B2_CLAVE_LECTURA:'klec',B2_ID_ADMIN:'adm',B2_CLAVE_ADMIN:'kadm'};
    let vb=await verificarB2(E); ok(vb.ok&&vb.completo,'verificar-b2: configuración correcta pasa y queda completa ('+vb.res.filter(x=>x.ok!==true).map(x=>x.que).join('; ')+')');
    vb=await verificarB2({B2_ID_ESCRITURA:'esc',B2_CLAVE_ESCRITURA:'kesc',B2_ID_LECTURA:'lec',B2_CLAVE_LECTURA:'klec'}); ok(vb.ok&&!vb.completo&&vb.res.some(x=>x.ok===null),'verificar-b2: sin clave de administración marca lo no verificado, no lo da por bueno');
    claves.esc.cap.push('listFiles'); vb=await verificarB2(E); ok(!vb.ok&&vb.res.some(x=>x.ok===false&&/listar|de más/.test(x.que)),'verificar-b2: detecta una clave de escritura que también lista'); claves.esc.cap.pop();
    claves.esc.cap.push('deleteFiles'); vb=await verificarB2(E); ok(!vb.ok&&vb.res.some(x=>x.ok===false&&/borrar|de más/.test(x.que)),'verificar-b2: detecta una clave de escritura que puede borrar'); claves.esc.cap.pop();
    claves.esc.cap.push('listKeys'); vb=await verificarB2(E); ok(!vb.ok&&vb.res.some(x=>x.ok===false&&/de más/.test(x.que)&&/listKeys/.test(x.detalle)),'verificar-b2: detecta cualquier permiso no previsto en la clave de escritura'); claves.esc.cap.pop();
    claves.esc.cap.push('writeFileRetentions'); vb=await verificarB2(E); ok(!vb.ok&&vb.res.some(x=>x.ok===false&&/de más/.test(x.que)),'verificar-b2: la clave de escritura no puede fijar retenciones'); claves.esc.cap.pop();
    claves.lec.cap.push('writeFiles'); vb=await verificarB2(E); ok(!vb.ok&&vb.res.some(x=>x.ok===false&&/lectura.*de más/.test(x.que)),'verificar-b2: detecta una clave de lectura que también escribe'); claves.lec.cap.pop();
    { const orig=cubos['nativa-diario'].ciclo; cubos['nativa-diario'].ciclo=orig.concat([{fileNamePrefix:'diario/',daysFromUploadingToHiding:2,daysFromHidingToDeleting:1}]); vb=await verificarB2(E); ok(!vb.ok&&vb.res.some(x=>x.ok===false&&/\[diario\/\]/.test(x.que)),'verificar-b2: una regla de prefijo que oculta antes de la retención es falla aunque la general esté bien');
      cubos['nativa-diario'].ciclo=[{fileNamePrefix:'diario/',daysFromUploadingToHiding:8,daysFromHidingToDeleting:1}]; vb=await verificarB2(E); ok(!vb.ok&&vb.res.some(x=>x.ok===false&&/regla para todo el bucket/.test(x.que)),'verificar-b2: sin regla general el resto nunca se limpia'); cubos['nativa-diario'].ciclo=orig; }
    cubos['nativa-diario'].modo='governance'; vb=await verificarB2(E); ok(!vb.ok&&vb.res.some(x=>x.ok===false&&/COMPLIANCE/.test(x.que)),'verificar-b2: detecta Object Lock en Governance en vez de Compliance'); cubos['nativa-diario'].modo='compliance';
    cubos['nativa-semanal'].retencionDias=14; vb=await verificarB2(E); ok(!vb.ok&&vb.res.some(x=>x.ok===false&&/semanal/.test(x.que)),'verificar-b2: detecta una retención de otros días'); cubos['nativa-semanal'].retencionDias=28;
    cubos['nativa-seis-horas'].ciclo=[]; vb=await verificarB2(E); ok(!vb.ok&&vb.res.some(x=>x.ok===false&&/ciclo de vida/.test(x.que)),'verificar-b2: detecta que faltan reglas de ciclo de vida'); cubos['nativa-seis-horas'].ciclo=[{fileNamePrefix:'',daysFromUploadingToHiding:3,daysFromHidingToDeleting:1}];
    cubos['nativa-diario'].ciclo=[{fileNamePrefix:'',daysFromUploadingToHiding:3,daysFromHidingToDeleting:1}]; vb=await verificarB2(E); ok(!vb.ok&&vb.res.some(x=>x.ok===false&&/ocultar/.test(x.que)),'verificar-b2: detecta ocultar antes de que venza la retención');
    delete process.env.NATIVA_B2_API; await B.cerrar(); }

  if(process.env.PRUEBAS_TIEMPOS) console.log('  [t='+Math.round((Date.now()-t0)/1000)+'s] antes de la sección 11');
  /* ===== 11. archivos de despliegue y reglas del proyecto ===== */
  { const sv=n=>fs.readFileSync(path.join(raiz,'operaciones','systemd',n),'utf8'), s=sv('nativa-respaldo.service'), t=sv('nativa-respaldo.timer');
    ok(/Nice=19/.test(s)&&/IOSchedulingClass=idle/.test(s)&&/MemoryMax=/.test(s)&&/CPUWeight=/.test(s),'systemd: el respaldo corre con la prioridad más baja y con tope de memoria');
    ok(/ReadOnlyPaths=.*\/var\/lib\/nativa(\s|$)/m.test(s)&&/ProtectSystem=strict/.test(s)&&/NoNewPrivileges=yes/.test(s),'systemd: la carpeta de datos del juego es de sólo lectura para el respaldo');
    ok(/OnFailure=nativa-respaldo-fallo\.service/.test(s)&&/User=nativa-respaldo/.test(s),'systemd: un fallo dispara el aviso y corre con un usuario propio');
    ok((t.match(/OnCalendar=.*00,06,12,18/g)||[]).length===1&&/Persistent=true/.test(t),'systemd: cada 6 horas, y recupera las que se perdieron si la máquina estaba apagada');
    ok(!/NATIVA_ADMIN_TOKEN|NATIVA_SESION_CLAVE/.test(s+t+sv('nativa-respaldo-fallo.service')),'systemd: las unidades del respaldo no mencionan los secretos del juego');
    const wf=fs.readFileSync(path.join(raiz,'.github','workflows','vigilancia-respaldos.yml'),'utf8');
    ok(/vars\.RESPALDOS_ACTIVOS == 'true'/.test(wf)&&/schedule:/.test(wf)&&/B2_CLAVE_LECTURA/.test(wf),'workflow: apagado hasta activarlo, programado y con la clave de sólo lectura');
    const usados=[...wf.matchAll(/secrets\.([A-Z0-9_]+)/g)].map(m=>m[1]).filter((v,i,a)=>a.indexOf(v)===i).sort();
    ok(usados.join()==='B2_CLAVE_LECTURA,B2_ID_LECTURA,NATIVA_VERIFICADOR_IDENTIDAD','workflow: sólo usa tres secretos: clave de lectura de B2 y clave del verificador ('+usados+')'); ok(!/AGE-SECRET-KEY/.test(wf),'workflow: no lleva claves'); }
  { let fuga=[]; (function rec(d){ for(const e of fs.readdirSync(d,{withFileTypes:true})){ const p=path.join(d,e.name); if(e.isDirectory()) rec(p); else{ const t=fs.readFileSync(p,'utf8'); if(/AGE-SECRET-KEY-1[A-Z0-9]{20,}/.test(t)||/(NATIVA_ADMIN_TOKEN|NATIVA_SESION_CLAVE|B2_CLAVE_[A-Z]+)[ \t]*=[ \t]*['"]?[A-Za-z0-9_\-+\/=.]{16,}/.test(t)) fuga.push(path.relative(raiz,p)); } } })(path.join(raiz,'operaciones')); ok(fuga.length===0,'ningún archivo de operaciones/ lleva credenciales ('+fuga.join(',')+')'); }
  { const g=spawnSync('git',['status','--porcelain','--','servidor','src','docs/DISENO.md'],{cwd:raiz,encoding:'utf8'}); ok(g.status!==0||g.stdout.trim()==='','el respaldo no modificó servidor/, src/ ni el diseño ('+g.stdout.trim()+')'); }

  console.log('respaldos: '+bien+' bien, '+mal+' mal ('+Math.round((Date.now()-t0)/1000)+' s)'); process.exit(mal?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });

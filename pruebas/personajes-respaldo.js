// Los respaldos incluyen a los personajes permanentes: se copian, se auditan (con el código de la propia copia), se detecta un archivo dañado,
// se restauran idénticos, y un respaldo cuyo código no sabe auditarlos no se sube. Todo en carpetas temporales; el código se copia a un git temporal.
const fs=require('fs'), os=require('os'), path=require('path'), crypto=require('crypto'), {spawnSync}=require('child_process');
const raiz=path.resolve(__dirname,'..'), OP=path.join(raiz,'operaciones','respaldos');
const {abrirMundoOficial}=require(path.join(raiz,'servidor','mundo-oficial.js'));
const {crearPersonajes}=require(path.join(raiz,'servidor','personajes.js'));
const {listarArbol,igualesArboles}=require(path.join(OP,'lib','comun.js'));
const {restaurarPaquete}=require(path.join(OP,'restaurar.js'));
let bien=0,mal=0; const ok=(c,t)=>{ if(process.env.PRUEBAS_VERBOSO) console.log((c?'bien: ':'MAL: ')+t); if(c) bien++; else { mal++; console.log('MAL:',t); } };
const tmps=[]; const tmp=p=>{ const d=fs.mkdtempSync(path.join(os.tmpdir(),'nv-pjr-'+(p||''))); tmps.push(d); return d; };
process.on('exit',()=>{ for(const d of tmps) try{ fs.rmSync(d,{recursive:true,force:true}); }catch(e){} });
const idDe=t=>crypto.createHash('sha256').update(t).digest('hex').slice(0,12);
const age=()=>{ const f=path.join(tmp('k'),'k.txt'); const r=spawnSync('age-keygen',['-o',f],{encoding:'utf8'}); if(r.error||r.status!==0) return null; return {id:f,pub:(r.stderr+r.stdout).match(/age1[a-z0-9]+/)[0]}; };
const sh=(c,a,cwd)=>spawnSync(c,a,{cwd,encoding:'utf8'});
const arch=d=>{ const o=[]; (function r(x){ if(!fs.existsSync(x)) return; for(const e of fs.readdirSync(x,{withFileTypes:true})){ const q=path.join(x,e.name); e.isDirectory()?r(q):o.push(path.relative(d,q)); } })(d); return o.sort(); };

(async()=>{
  const M=age(); if(!M||spawnSync('git',['--version']).status!==0){ console.log('OMITIDA: faltan age/git'); process.exit(0); }
  const V=age();
  /* código: copia del proyecto (con lo que hay sin confirmar) en un git temporal, para que viaje en el respaldo igual que tras el commit real */
  const cod=tmp('cod'); sh('cp',['-r',raiz+'/.',cod]); fs.rmSync(path.join(cod,'.git'),{recursive:true,force:true});
  for(const n of ['node_modules']) fs.rmSync(path.join(cod,'servidor',n),{recursive:true,force:true});
  sh('git',['init','-q'],cod); sh('git',['-c','user.email=t@t','-c','user.name=t','add','-A'],cod); sh('git',['-c','user.email=t@t','-c','user.name=t','commit','-qm','t'],cod);

  const datos=tmp('datos'), estado=tmp('estado'), dest=tmp('dest'), trabajo=tmp('trab');
  const W=await abrirMundoOficial({dir:datos,cadaN:20}); for(let i=0;i<30;i++) await W.aplicar({t:'suelo',x:40+i%10,y:40+((i/10)|0),m:i%2?'d':'g'},'p'); await W.cerrar();
  const P=crearPersonajes({dir:datos}); const ids=['a','b','c'].map(idDe);
  ids.forEach((id,i)=>P.crear(id,{nombre:'Viajero-T'+i,x:50+i,y:50,mirando:'este'}));
  P.otorgarExperiencia(ids[0],340); P.darObjeto(ids[0],'piedra',4); P.darObjeto(ids[1],'pluma',1); P.actualizar(ids[2],{nivel:7}); P.guardarPendientes();
  fs.writeFileSync(path.join(datos,'personajes',idDe('z')+'.json.tmp-1-2'),'{}');            // un temporal a medias: no debe viajar
  const antesTodo=listarArbol(path.join(datos,'personajes'));

  const base={PATH:process.env.PATH,HOME:process.env.HOME||'/tmp',NATIVA_DATOS:datos,NATIVA_CODIGO:cod,NATIVA_RESPALDO_ESTADO:estado,NATIVA_RESPALDO_TRABAJO:trabajo,
    NATIVA_RESPALDO_DESTINO:'carpeta:'+dest,NATIVA_RESPALDO_DESTINATARIOS:M.pub,NATIVA_RESPALDO_VERIFICADOR:V.pub};
  const correr=(args,env)=>spawnSync(process.execPath,[path.join(OP,'respaldar.js')].concat(args),{env:Object.assign({},base,env||{}),encoding:'utf8',timeout:240000});
  let r=correr(['--nivel','seis-horas','--ahora','2026-11-24T12:30:00Z']);
  ok(r.status===0,'respaldo con personajes: sale bien ('+(r.stderr||'').slice(-300)+')');
  ok(listarArbol(path.join(datos,'personajes'))&&igualesArboles(antesTodo,listarArbol(path.join(datos,'personajes'))).length===0,'el respaldo no modifica ningún archivo de personajes');
  const A=arch(path.join(dest,'seisHoras')).find(f=>/seis-horas.*\.tar\.gz\.age$/.test(f)), Ap=path.join(dest,'seisHoras',A), Jp=Ap.replace(/\.tar\.gz\.age$/,'.json'), ficha=JSON.parse(fs.readFileSync(Jp,'utf8'));
  ok(ficha.auditoria==='ok'&&ficha.personajes===3,'la ficha anota 3 personajes y auditoría ok');
  /* restaurar */
  const rest=tmp('rest'), cdest=tmp('cdest'); fs.rmSync(rest,{recursive:true,force:true});
  const q=await restaurarPaquete({archivo:Ap,meta:Jp,identidad:M.id,datosDestino:rest,codigoDestino:cdest});
  ok(q.ok,'restaura: ok ('+(q.problemas||[]).join('; ')+')');
  const P2=crearPersonajes({dir:rest}); const e0=P2.obtener(ids[0]);
  ok(P2.cantidad()===3&&e0.experiencia===340&&e0.inventario[0].id==='piedra'&&e0.inventario[0].cant===4&&e0.nombre==='Viajero-T0'&&e0.x===50&&P2.obtener(ids[2]).nivel===7,'lo restaurado trae identidad, ubicación, nivel, experiencia e inventario');
  ok(arch(path.join(rest,'personajes')).filter(f=>/^[0-9a-f]{12}\.json$/.test(f)).length===3&&!arch(path.join(rest,'personajes')).some(f=>/\.tmp-/.test(f)),'la restauración trae los 3 archivos y ningún temporal');
  /* archivo dañado: la auditoría lo ve y el respaldo no se sube */
  const dest2=tmp('dest2'), f0=path.join(datos,'personajes',ids[1]+'.json'); const orig=fs.readFileSync(f0,'utf8');
  fs.writeFileSync(f0,orig.replace('"x":51','"x":99'));
  const base2=Object.assign({},base,{NATIVA_RESPALDO_DESTINO:'carpeta:'+dest2,NATIVA_RESPALDO_ESTADO:tmp('est2')});
  r=spawnSync(process.execPath,[path.join(OP,'respaldar.js'),'--nivel','seis-horas','--ahora','2026-11-24T13:30:00Z'],{env:base2,encoding:'utf8',timeout:240000});
  ok(r.status!==0&&!arch(dest2).some(f=>/\.tar\.gz\.age$/.test(f))&&/personajes/.test(r.stderr+r.stdout),'con un personaje dañado el respaldo falla, lo dice y NO sube nada');
  fs.writeFileSync(f0,orig);
  /* código sin personajes.js (aún sin commit): no se sube */
  const cod2=tmp('cod2'); sh('cp',['-r',cod+'/.',cod2]); fs.rmSync(path.join(cod2,'servidor','personajes.js'));
  sh('git',['rm','-q','--cached','servidor/personajes.js'],cod2);
  // el código real (con personajes.js en disco) pero sin commit: simulado quitándolo del índice
  const cod3=tmp('cod3'); sh('cp',['-r',cod+'/.',cod3]); sh('git',['rm','-q','--cached','servidor/personajes.js'],cod3);
  const dest3=tmp('dest3'); r=spawnSync(process.execPath,[path.join(OP,'respaldar.js'),'--nivel','seis-horas','--ahora','2026-11-24T14:30:00Z'],{env:Object.assign({},base,{NATIVA_CODIGO:cod3,NATIVA_RESPALDO_DESTINO:'carpeta:'+dest3,NATIVA_RESPALDO_ESTADO:tmp('est3')}),encoding:'utf8',timeout:240000});
  ok(r.status!==0&&!arch(dest3).some(f=>/\.tar\.gz\.age$/.test(f))&&/personajes\.js/.test(r.stderr+r.stdout),'si el código que viaja no incluye servidor/personajes.js (falta el commit), no se sube nada y lo dice');
  /* sin personajes (mundo viejo) sigue funcionando */
  const datosV=tmp('viejo'); const Wv=await abrirMundoOficial({dir:datosV,cadaN:20}); await Wv.aplicar({t:'suelo',x:40,y:40,m:'g'},'p'); await Wv.cerrar();
  const dest4=tmp('dest4'); r=spawnSync(process.execPath,[path.join(OP,'respaldar.js'),'--nivel','seis-horas','--ahora','2026-11-24T15:30:00Z'],{env:Object.assign({},base,{NATIVA_DATOS:datosV,NATIVA_RESPALDO_DESTINO:'carpeta:'+dest4,NATIVA_RESPALDO_ESTADO:tmp('est4')}),encoding:'utf8',timeout:240000});
  ok(r.status===0,'un mundo sin personajes se respalda como siempre ('+(r.stderr||'').slice(-200)+')');
  console.log('personajes-respaldo: '+bien+' bien, '+mal+' mal'); process.exit(mal?1:0);
})();

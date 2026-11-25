// Respaldos: uso de memoria, disco y flujo (cambios E, A, B, C y D de la etapa de optimización). Archivo APARTE de pruebas/respaldos.js a propósito:
// si algo se rompe se sabe qué cambio fue. La regla de todas estas pruebas es la EQUIVALENCIA: lo que salía antes tiene que seguir saliendo igual,
// byte a byte. Por eso aquí vive una copia de las versiones anteriores de las funciones («oráculo») contra la que se compara la nueva.
// Todo contra carpetas temporales y un B2 simulado: no toca servicios externos.
const fs=require('fs'), os=require('os'), path=require('path'), {spawnSync}=require('child_process');
const raiz=path.resolve(__dirname,'..'), OP=path.join(raiz,'operaciones','respaldos');
const {abrirMundoOficial}=require(path.join(raiz,'servidor','mundo-oficial.js'));
const {listarArbol,igualesArboles}=require(path.join(OP,'lib','comun.js'));
const {cargarConfig}=require(path.join(OP,'lib','config.js'));
const paquete=require(path.join(OP,'lib','paquete.js'));
const copia=require(path.join(OP,'lib','copia.js'));
let bien=0,mal=0; const ok=(c,t)=>{ if(c) bien++; else { mal++; console.log('MAL:',t); } };
const creadas=[]; const tmp=p=>{ const d=fs.mkdtempSync(path.join(os.tmpdir(),'nv-mem-'+(p||''))); creadas.push(d); return d; };
const limpiar=()=>{ for(const d of creadas){ try{ fs.rmSync(d,{recursive:true,force:true}); }catch(e){} } };
const t0=Date.now(), seccion=n=>{ if(process.env.PRUEBAS_TIEMPOS) console.log('  [t='+Math.round((Date.now()-t0)/1000)+'s] '+n); };
const age=()=>{ const f=path.join(tmp('k'),'k.txt'); const r=spawnSync('age-keygen',['-o',f],{encoding:'utf8'}); return {id:f,pub:(r.stderr+r.stdout).match(/age1[a-z0-9]+/)[0]}; };
const mundo=async(dir,n,cadaN)=>{ const M=await abrirMundoOficial({dir,cadaN:cadaN||20}); for(let i=0;i<n;i++) await M.aplicar({t:'suelo',x:40+i%10,y:40+((i/10)|0),m:i%2?'d':'g'},'p'+(i%3)); await M.cerrar(); };
const arch=(d)=>{ const o=[]; (function r(x){ if(!fs.existsSync(x)) return; for(const e of fs.readdirSync(x,{withFileTypes:true})){ const q=path.join(x,e.name); e.isDirectory()?r(q):o.push(path.relative(d,q)); } })(d); return o.sort(); };

(async()=>{
  const MB=1048576;

  /* ===== E. el respaldo no empieza si no cabe ===== */
  seccion('E');
  const datos=tmp('datos'); await mundo(datos,60);
  const tam=paquete.tamanoCarpeta(datos,false);
  const real=arch(datos).reduce((t,f)=>f==='.lock'||f.startsWith('respaldos/')||f.includes('.tmp-')?t:t+fs.statSync(path.join(datos,f)).size,0);
  ok(tam===real&&tam>0,'tamanoCarpeta suma el tamaño real de los archivos de datos (sin .lock ni temporales): '+tam+' vs '+real);
  fs.mkdirSync(path.join(datos,'respaldos'),{recursive:true}); fs.writeFileSync(path.join(datos,'respaldos','x.json'),'x'.repeat(1000));
  ok(paquete.tamanoCarpeta(datos,false)===tam&&paquete.tamanoCarpeta(datos,true)===tam+1000,'la carpeta respaldos/ sólo cuenta cuando el respaldo la incluye');
  fs.rmSync(path.join(datos,'respaldos'),{recursive:true});

  const trabajo=path.join(tmp('t'),'no','existe','todavia');
  const base={origen:datos,trabajo,reservaMB:10};
  const necesario=4*tam+16*MB+10*MB;
  let e=paquete.revisarEspacio(Object.assign({},base,{libre:()=>necesario}));
  ok(e.ok&&e.medido&&e.necesario===necesario&&e.datos===tam&&e.reserva===10*MB,'justo lo necesario (4× los datos + 16 MB de código + la reserva): cabe');
  e=paquete.revisarEspacio(Object.assign({},base,{libre:()=>necesario-1}));
  ok(!e.ok&&e.libre===necesario-1,'un byte menos: no cabe');
  e=paquete.revisarEspacio(Object.assign({},base,{libre:()=>0}));
  ok(!e.ok,'sin nada libre: no cabe');
  let consultada=null; paquete.revisarEspacio(Object.assign({},base,{libre:p=>{ consultada=p; return necesario; }}));
  ok(consultada&&fs.existsSync(consultada)&&path.resolve(trabajo).startsWith(path.resolve(consultada)),'si la carpeta de trabajo aún no existe, se mide el primer ancestro que sí existe ('+consultada+')');
  ok(!fs.existsSync(trabajo),'medir el espacio no crea nada');
  e=paquete.revisarEspacio(Object.assign({},base,{libre:()=>{ throw new Error('statfs no disponible'); }}));
  ok(e.ok&&e.medido===false,'si el disco no se puede medir NO se bloquea el respaldo (sería perder todas las copias)');
  const reales=paquete.revisarEspacio({origen:datos,trabajo:os.tmpdir()});
  ok(reales.medido&&reales.libre>0&&reales.necesario>4*tam,'con el disco real: mide un espacio libre positivo y un mínimo mayor que 4× los datos');
  ok(reales.mismoDisco===true&&reales.reserva===512*MB,'datos y trabajo en el mismo disco: la reserva por defecto es de 512 MB (ahí vive el mundo en vivo)');
  ok(paquete.revisarEspacio({origen:datos,trabajo:os.tmpdir(),reservaMB:7}).reserva===7*MB,'la reserva se puede fijar a mano');

  // construirPaquete: si no cabe, error claro y NADA creado, ni en el trabajo ni en los datos
  const K=age(), antes=listarArbol(datos);
  let msg=null;
  try{ await paquete.construirPaquete({origen:datos,vivo:datos,codigo:raiz,trabajo,destinatarios:[K.pub],etiqueta:'real',respaldos:false,ahora:new Date(),memoriaMB:384,reservaMB:10,libre:()=>1*MB}); }catch(x){ msg=x.message; }
  ok(msg&&/no hay espacio para respaldar/.test(msg)&&/NO se empieza/.test(msg)&&/No se creó nada/.test(msg),'sin espacio: construirPaquete se niega con un mensaje claro ('+(msg||'no falló').slice(0,120)+')');
  ok(!fs.existsSync(trabajo),'sin espacio: no se creó ni la carpeta de trabajo');
  ok(igualesArboles(antes,listarArbol(datos)).length===0,'sin espacio: la carpeta de datos queda exactamente igual');
  // con espacio: funciona como siempre y deja un paquete verificado
  const trab2=tmp('t2');
  const p=await paquete.construirPaquete({origen:datos,vivo:datos,codigo:raiz,trabajo:trab2,destinatarios:[K.pub],etiqueta:'real',respaldos:false,ahora:new Date(),memoriaMB:384,libre:()=>1e12});
  ok(p&&p.lado.auditoria==='ok'&&p.lado.vivoCoincide===true&&p.seq===60&&fs.existsSync(p.age),'con espacio de sobra: el paquete se construye y se audita como siempre');
  p.limpiar(); ok(arch(trab2).length===0,'limpiar() deja la carpeta de trabajo vacía');

  // configuración
  const c1=cargarConfig({NATIVA_DATOS:datos}), c2=cargarConfig({NATIVA_DATOS:datos,NATIVA_RESPALDO_RESERVA_MB:'900'}), c3=cargarConfig({NATIVA_DATOS:datos,NATIVA_RESPALDO_RESERVA_MB:'basura'}), c4=cargarConfig({NATIVA_DATOS:datos,NATIVA_RESPALDO_RESERVA_MB:'0'});
  ok(c1.reservaMB===undefined&&c2.reservaMB===900&&c3.reservaMB===undefined&&c4.reservaMB===0,'NATIVA_RESPALDO_RESERVA_MB: sin definir o inválida usa el valor por defecto; un número se respeta (incluido 0)');

  // de punta a punta con respaldar.js: reserva imposible → sale con 1, alerta, nada subido, trabajo y datos intactos
  const estado=tmp('estado'), dest=tmp('dest'), trabE=tmp('trabE');
  const env={PATH:process.env.PATH,HOME:process.env.HOME||'/tmp',NATIVA_DATOS:datos,NATIVA_CODIGO:raiz,NATIVA_RESPALDO_ESTADO:estado,NATIVA_RESPALDO_TRABAJO:trabE,NATIVA_RESPALDO_DESTINO:'carpeta:'+dest,NATIVA_RESPALDO_DESTINATARIOS:K.pub};
  const correr=extra=>spawnSync(process.execPath,[path.join(OP,'respaldar.js'),'--nivel','seis-horas','--ahora','2026-11-24T12:30:00Z'],{env:Object.assign({},env,extra||{}),encoding:'utf8',timeout:120000});
  let r=correr({NATIVA_RESPALDO_RESERVA_MB:'999999999'});
  let alerta=null; try{ alerta=JSON.parse(fs.readFileSync(path.join(estado,'alerta.json'),'utf8')); }catch(x){}
  ok(r.status===1&&alerta&&/no hay espacio para respaldar/.test(alerta.mensaje),'respaldar.js sin espacio: sale con 1 y deja la alerta ('+r.stderr.slice(-160).replace(/\n/g,' ')+')');
  ok(arch(dest).length===0&&arch(trabE).length===0&&igualesArboles(antes,listarArbol(datos)).length===0,'respaldar.js sin espacio: no sube nada, no deja restos y no toca los datos');
  r=correr({NATIVA_RESPALDO_RESERVA_MB:'0'});
  ok(r.status===0&&arch(dest).some(f=>f.endsWith('.tar.gz.age'))&&!fs.existsSync(path.join(estado,'alerta.json')),'respaldar.js con espacio: sube el respaldo y borra la alerta anterior ('+r.stderr.slice(-160).replace(/\n/g,' ')+')');

  /* ===== A y B. el diario por bloques: idéntico al de siempre, sin cargarlo entero ===== */
  seccion('A y B');
  const BLOQUE=1<<20;
  // — oráculo: las versiones ANTERIORES, copiadas tal cual —
  const RE_SNAP=/^\d{9}\.json$/, RE_COLA=/^diario\.cola-\d+\.txt$/, RE_REVOCADAS=/^sesiones-revocadas\.json(\.danado-.+)?$/;
  const oraculoDiario=(origen,dest)=>{ const fd=path.join(origen,'diario.ndjson'); if(fs.existsSync(fd)){ const buf=fs.readFileSync(fd), fin=buf.lastIndexOf(10); fs.writeFileSync(path.join(dest,'diario.ndjson'),fin>=0?buf.subarray(0,fin+1):Buffer.alloc(0)); } };
  function oraculoCopiarOrdenado(origen,dest,op){
    op=op||{}; fs.mkdirSync(path.join(dest,'instantaneas'),{recursive:true}); const omitidos=[]; const top=fs.readdirSync(origen);
    const cp=(rel)=>fs.copyFileSync(path.join(origen,rel),path.join(dest,rel));
    if(top.includes('meta.json')) cp('meta.json');
    const dSnap=path.join(origen,'instantaneas'); if(fs.existsSync(dSnap)) for(const n of fs.readdirSync(dSnap).sort()) if(RE_SNAP.test(n)) cp('instantaneas/'+n);
    for(const n of top){
      if(n==='.lock'||n.includes('.tmp-')||n==='meta.json'||n==='instantaneas'||n==='diario.ndjson') continue;
      if(RE_COLA.test(n)||RE_REVOCADAS.test(n)){ cp(n); continue; }
      if(n==='respaldos'){ if(op.respaldos){ try{ fs.cpSync(path.join(origen,n),path.join(dest,n),{recursive:true}); }catch(e){ if(e.code!=='ENOENT') throw e; } } continue; }
      omitidos.push(n);
    }
    oraculoDiario(origen,dest); return {omitidos,sinRespaldos:!op.respaldos};
  }
  function oraculoHuella(vivo,seq){
    const fd=path.join(vivo,'diario.ndjson');
    if(seq>0&&fs.existsSync(fd)){ for(const l of fs.readFileSync(fd,'utf8').split('\n')){ if(!l) continue; let e; try{ e=JSON.parse(l); }catch(x){ continue; } if(e&&e.seq===seq&&typeof e.h==='string') return e.h; } }
    const fs0=path.join(vivo,'instantaneas',String(seq).padStart(9,'0')+'.json');
    if(fs.existsSync(fs0)){ try{ return JSON.parse(fs.readFileSync(fs0,'utf8')).huella||null; }catch(e){} }
    return null;
  }
  const mismo=(a,b)=>fs.existsSync(a)===fs.existsSync(b)&&(!fs.existsSync(a)||Buffer.compare(fs.readFileSync(a),fs.readFileSync(b))===0);

  // — A: casos límite del corte, comparados byte a byte con el oráculo —
  const rep=(c,n)=>c.repeat(n);
  const renglon=i=>JSON.stringify({seq:i,h:rep('a',64),op:{t:'suelo',x:i,y:1,m:'ñ→é'},inv:null})+'\n';
  const casos={
    'vacío':Buffer.alloc(0),
    'sin ningún salto de línea':Buffer.from('{"seq":1,"h":"abc"'),
    'sólo un salto':Buffer.from('\n'),
    'un renglón completo':Buffer.from(renglon(1)),
    'renglones y un último a medias':Buffer.from(renglon(1)+renglon(2)+'{"seq":3,"h":"a'),
    'termina justo en salto de línea':Buffer.from(renglon(1)+renglon(2)),
    'renglones vacíos y CRLF':Buffer.from('\n\n'+renglon(1).replace(/\n$/,'\r\n')+'\n'),
    'el salto de línea cae justo en el último byte del bloque':Buffer.concat([Buffer.from(rep('x',BLOQUE-1)),Buffer.from('\n'),Buffer.from('cola')]),
    'el salto de línea cae justo en el primer byte del segundo bloque':Buffer.concat([Buffer.from(rep('x',BLOQUE)),Buffer.from('\ncola')]),
    'el único salto de línea está dos bloques atrás de un resto largo':Buffer.concat([Buffer.from(rep('y',100)),Buffer.from('\n'),Buffer.from(rep('z',2*BLOQUE+5))]),
    'tamaño exacto de un bloque con salto al final':Buffer.concat([Buffer.from(rep('w',BLOQUE-1)),Buffer.from('\n')]),
    'varios bloques de renglones con caracteres de varios bytes':Buffer.from(Array.from({length:20000},(_,i)=>renglon(i+1)).join('')+'cortado'),
    'bytes que no son UTF-8':Buffer.from([0xff,0xfe,10,0x80,10,0xc3])
  };
  let igualA=0; const malosA=[];
  for(const [nombre,contenido] of Object.entries(casos)){
    const o=tmp('A-o'), d1=tmp('A-d1'), d2=tmp('A-d2'); fs.writeFileSync(path.join(o,'diario.ndjson'),contenido);
    oraculoDiario(o,d1); copia.copiarDiarioCortado(path.join(o,'diario.ndjson'),path.join(d2,'diario.ndjson'));
    if(mismo(path.join(d1,'diario.ndjson'),path.join(d2,'diario.ndjson'))) igualA++; else malosA.push(nombre);
  }
  ok(malosA.length===0,'A: el diario copiado es idéntico byte a byte al de la versión anterior en los '+Object.keys(casos).length+' casos límite (fallan: '+malosA.join(', ')+')');
  { const d=tmp('A-ausente'); ok(copia.copiarDiarioCortado(path.join(d,'no-hay.ndjson'),path.join(d,'out.ndjson'))===false&&!fs.existsSync(path.join(d,'out.ndjson')),'A: si no hay diario no se crea nada (igual que antes)'); }
  { const o=tmp('A-t'), d=tmp('A-td'); fs.writeFileSync(path.join(o,'diario.ndjson'),renglon(1)+renglon(2)+'media'); copia.copiarDiarioCortado(path.join(o,'diario.ndjson'),path.join(d,'diario.ndjson'));
    ok(fs.readFileSync(path.join(d,'diario.ndjson'),'utf8')===renglon(1)+renglon(2)&&fs.readFileSync(path.join(o,'diario.ndjson'),'utf8')===renglon(1)+renglon(2)+'media','A: el renglón a medias no entra en la copia y el original queda intacto'); }

  // — A: la copia completa (meta, instantáneas, extras, respaldos/) idéntica a la anterior —
  const origenA=tmp('A-mundo'); await mundo(origenA,75,10);
  fs.writeFileSync(path.join(origenA,'diario.cola-3.txt'),'cola'); fs.writeFileSync(path.join(origenA,'sesiones-revocadas.json'),'{}'); fs.writeFileSync(path.join(origenA,'raro.bin'),'zzz');
  fs.mkdirSync(path.join(origenA,'respaldos'),{recursive:true}); fs.writeFileSync(path.join(origenA,'respaldos','r1.json'),'r1');
  fs.appendFileSync(path.join(origenA,'diario.ndjson'),'{"seq":76,"h":"corta');                       // renglón a medias al final, como si el servidor estuviera escribiendo
  for(const conResp of [false,true]){
    const d1=tmp('A-c1'), d2=tmp('A-c2'), r1=oraculoCopiarOrdenado(origenA,d1,{respaldos:conResp}), r2=copia.copiarOrdenado(origenA,d2,{respaldos:conResp});
    ok(igualesArboles(listarArbol(d1),listarArbol(d2)).length===0&&JSON.stringify(r1)===JSON.stringify(r2),'A: copiarOrdenado (respaldos='+conResp+'): mismo árbol de archivos con las mismas sumas y los mismos «omitidos» que la versión anterior');
  }

  // — A: con un escritor concurrente, cada copia es un prefijo del diario, termina en salto de línea y encadena las versiones —
  { const o=tmp('A-esc'), diario=path.join(o,'diario.ndjson'); fs.writeFileSync(diario,'');
    const escritor=require('child_process').spawn(process.execPath,['-e',`
      const fs=require('fs'); const fd=fs.openSync(${JSON.stringify(diario)},'a'); let i=0; const fin=Date.now()+2500;
      (function paso(){ if(Date.now()>fin){ fs.closeSync(fd); return; } for(let k=0;k<200;k++){ i++; const l=JSON.stringify({seq:i,h:'b'.repeat(64),op:{pad:'p'.repeat(150)}})+'\\n'; const m=l.length>>1; fs.writeSync(fd,l.slice(0,m)); fs.writeSync(fd,l.slice(m)); } setImmediate(paso); })();`],{stdio:'ignore'}); let terminado=false; escritor.on('exit',()=>{ terminado=true; });
    await new Promise(r=>setTimeout(r,150)); const copias=[]; const dd=tmp('A-esc-d');
    for(let i=0;i<25;i++){ const dst=path.join(dd,'c'+i+'.ndjson'); copia.copiarDiarioCortado(diario,dst); copias.push(dst); await new Promise(r=>setTimeout(r,60)); }
    while(!terminado) await new Promise(r=>setTimeout(r,50)); const final=fs.readFileSync(diario); let malas=0, vacias=0, crecio=0, ultimo=-1;
    for(const c of copias){ const b=fs.readFileSync(c); if(!b.length){ vacias++; continue; }
      const ent=b.toString('utf8').split('\n'), cola=ent.pop(); let seqOk=true, previo=0;
      for(const l of ent){ try{ const e=JSON.parse(l); if(e.seq!==previo+1) seqOk=false; previo=e.seq; }catch(x){ seqOk=false; } }
      if(cola!==''||!seqOk||Buffer.compare(final.subarray(0,b.length),b)!==0) malas++; if(previo>ultimo){ crecio++; ultimo=previo; } }
    ok(malas===0&&vacias<25&&crecio>=3,'A: con el servidor escribiendo a mitad de renglón, las 25 copias terminan en salto de línea, encadenan las versiones y son prefijo del diario final (malas '+malas+', vacías '+vacias+', versiones distintas '+crecio+')'); }

  // — B: la huella viva por renglones, idéntica a la anterior —
  const origenB=tmp('B-mundo'); await mundo(origenB,60,10);
  { let dif=[]; for(let s=0;s<=64;s++) if(copia.huellaVivaEn(origenB,s)!==oraculoHuella(origenB,s)) dif.push(s);
    ok(dif.length===0,'B: huellaVivaEn devuelve lo mismo que la versión anterior para las versiones 0 a 64, incluidas las que no existen (distintas: '+dif.join(',')+')');
    ok(copia.huellaVivaEn(origenB,60)!==null&&copia.huellaVivaEn(origenB,61)===null&&copia.huellaVivaEn(origenB,1)!==null,'B: encuentra la primera, la última y devuelve null pasada la última'); }
  { const o=tmp('B-corto'); fs.cpSync(origenB,o,{recursive:true}); const f=path.join(o,'diario.ndjson'); const t=fs.readFileSync(f,'utf8'); fs.writeFileSync(f,t.slice(0,t.length-30));       // último renglón a medias
    let dif=[]; for(let s=0;s<=62;s++) if(copia.huellaVivaEn(o,s)!==oraculoHuella(o,s)) dif.push(s); ok(dif.length===0,'B: con el último renglón del diario a medias da lo mismo que antes (distintas: '+dif.join(',')+')'); }
  { const o=tmp('B-sin-salto'); fs.cpSync(origenB,o,{recursive:true}); const f=path.join(o,'diario.ndjson'); const t=fs.readFileSync(f,'utf8'); fs.writeFileSync(f,t.replace(/\n$/,''));   // último renglón completo pero sin salto
    ok(copia.huellaVivaEn(o,60)===oraculoHuella(o,60)&&copia.huellaVivaEn(o,60)!==null,'B: el último renglón cuenta aunque no termine en salto de línea'); }
  { const o=tmp('B-sin-diario'); fs.cpSync(origenB,o,{recursive:true}); fs.rmSync(path.join(o,'diario.ndjson'));
    let dif=[]; for(let s=0;s<=62;s++) if(copia.huellaVivaEn(o,s)!==oraculoHuella(o,s)) dif.push(s); ok(dif.length===0,'B: sin diario recurre a la huella de la instantánea igual que antes (distintas: '+dif.join(',')+')'); }
  { const o=tmp('B-dup'), f=path.join(o,'diario.ndjson'); fs.writeFileSync(f,[{seq:1,h:'uno'},{seq:2,h:'dos-primero'},{seq:2,h:'dos-segundo'},{seq:3,h:7},{seq:4,h:'cuatro'}].map(e=>JSON.stringify(e)).join('\n')+'\nnada\n{"seq":5,"h":"cinco"}');
    ok(copia.huellaVivaEn(o,2)==='dos-primero'&&oraculoHuella(o,2)==='dos-primero'&&copia.huellaVivaEn(o,3)===oraculoHuella(o,3)&&copia.huellaVivaEn(o,5)==='cinco'&&copia.huellaVivaEn(o,4)==='cuatro','B: con versiones repetidas se queda con la PRIMERA, ignora h que no es texto y renglones basura, como antes'); }
  { // renglones que cruzan la frontera de un bloque, con caracteres de varios bytes
    const o=tmp('B-bloques'), f=path.join(o,'diario.ndjson'); const n=20000; fs.writeFileSync(f,Array.from({length:n},(_,i)=>JSON.stringify({seq:i+1,h:'h'+(i+1)+'ñé→',pad:'ü'.repeat(i%40)})+'\n').join(''));
    ok(fs.statSync(f).size>BLOQUE,'B (preparación): el diario de prueba ocupa más de un bloque ('+fs.statSync(f).size+' bytes)');
    let dif=0; for(const s of [1,2,500,9999,10000,15000,19999,20000,20001]) if(copia.huellaVivaEn(o,s)!==oraculoHuella(o,s)) dif++; ok(dif===0,'B: con renglones que cruzan fronteras de bloque da lo mismo que antes'); }

  // — memoria: el mismo trabajo, medido en un proceso aparte (pico de RAM) —
  // (se lee VmHWM de /proc: el pico de ESTE proceso. process.resourceUsage().maxRSS no sirve: se hereda del padre al hacer fork+exec)
  const pico=(codigo)=>{ const r=spawnSync(process.execPath,['-e',codigo+";process.stdout.write(String(Math.round(+/VmHWM:\\s+(\\d+)/.exec(require('fs').readFileSync('/proc/self/status','utf8'))[1]/1024)))"],{encoding:'utf8',timeout:120000}); return +r.stdout; };
  { const grande=tmp('mem'), f=path.join(grande,'diario.ndjson'), N=120*1048576;
    const fdw=fs.openSync(f,'w'); const bloque=Buffer.from(Array.from({length:5000},(_,i)=>JSON.stringify({seq:i,h:rep('c',64),op:{t:'suelo',x:i,y:2,m:'d'},inv:{t:'suelo',x:i,y:2,m:'g'}})+'\n').join('')); for(let w=0;w<N;w+=bloque.length) fs.writeSync(fdw,bloque); fs.closeSync(fdw);
    fs.appendFileSync(f,'{"seq":9,"h":"medio');
    const tam=fs.statSync(f).size, lib=JSON.stringify(path.join(OP,'lib','copia.js'));
    const nuevaA=pico(`const c=require(${lib}); c.copiarDiarioCortado(${JSON.stringify(f)},${JSON.stringify(path.join(grande,'copia.ndjson'))})`);
    const viejaA=pico(`const fs=require('fs'); const buf=fs.readFileSync(${JSON.stringify(f)}), fin=buf.lastIndexOf(10); fs.writeFileSync(${JSON.stringify(path.join(grande,'copia-v.ndjson'))},fin>=0?buf.subarray(0,fin+1):Buffer.alloc(0))`);
    ok(Buffer.compare(fs.readFileSync(path.join(grande,'copia.ndjson')),fs.readFileSync(path.join(grande,'copia-v.ndjson')))===0,'A (memoria): con un diario de '+Math.round(tam/MB)+' MB la copia nueva y la anterior son idénticas');
    ok(nuevaA<80&&viejaA>tam/MB,'A (memoria): copiar ese diario llega a '+nuevaA+' MB de RAM (la versión anterior: '+viejaA+' MB); el límite exigido es 80 MB');
    const nuevaB=pico(`const c=require(${lib}); c.huellaVivaEn(${JSON.stringify(grande)},1)`);
    const viejaB=pico(`const fs=require('fs'); (function(vivo,seq){ for(const l of fs.readFileSync(vivo+'/diario.ndjson','utf8').split('\\n')){ if(!l) continue; let e; try{ e=JSON.parse(l); }catch(x){ continue; } if(e&&e.seq===seq&&typeof e.h==='string') return e.h; } })(${JSON.stringify(grande)},-1)`);
    ok(nuevaB<80&&viejaB>2*nuevaB,'B (memoria): buscar una huella en ese diario llega a '+nuevaB+' MB de RAM (la versión anterior: '+viejaB+' MB); el límite exigido es 80 MB');
    console.log('  memoria medida (diario de '+Math.round(tam/MB)+' MB): A nueva '+nuevaA+' MB / anterior '+viejaA+' MB; B nueva '+nuevaB+' MB / anterior '+viejaB+' MB'); }

  /* ===== C. la continuidad del diario por tramos: los mismos veredictos, sin clonar todo el diario de una vez ===== */
  seccion('C');
  const verificar=require(path.join(OP,'lib','verificar.js'));
  const clon=o=>JSON.parse(JSON.stringify(o));
  const almFalso=ents=>({diario:async(d,h)=>ents.filter(e=>e.seq>d&&e.seq<=h).map(clon)});
  const oraculoCont=async alm=>{ const p=[], ent=await alm.diario(0,Infinity);
    if(ent.length&&ent[0].seq!==1) p.push('el diario no empieza en la versión 1 (empieza en '+ent[0].seq+')');
    if(ent.length&&ent[ent.length-1].seq!==ent.length) p.push('el diario tiene huecos: '+ent.length+' renglones y llega a la versión '+ent[ent.length-1].seq);
    return p; };
  const seqs=a=>a.map(seq=>({seq,h:'x'}));
  const rango=(a,b)=>Array.from({length:b-a+1},(_,i)=>a+i);
  const casosC={
    'vacío':[], 'una sola versión':rango(1,1), 'sano 1..10':rango(1,10), 'sano 1..5000 (una página justa)':rango(1,5000), 'sano 1..5001':rango(1,5001), 'sano 1..12345':rango(1,12345),
    'empieza en 2':rango(2,20), 'empieza en 9000':rango(9000,9010), 'hueco en medio':[...rango(1,50),...rango(52,60)], 'hueco justo en la frontera de página':[...rango(1,4999),...rango(5001,5010)],
    'termina corto (llega a 30 con 25 renglones)':[...rango(1,10),...rango(16,30)], 'empieza en 0':rango(0,9), 'empieza en 3 y con hueco':[3,4,5,9]
  };
  const dif=[];
  for(const [n,a] of Object.entries(casosC)) for(const pag of [3,7,5000]) for(const ult of [a.length?a[a.length-1]:0, undefined, (a.length?a[a.length-1]:0)+40, 5, 0]){
    const alm=almFalso(seqs(a)), x=JSON.stringify(await oraculoCont(alm)), y=JSON.stringify(await verificar.revisarContinuidad(alm,ult,pag));
    if(x!==y) dif.push(n+' pág '+pag+' tope '+ult+': '+x+' ≠ '+y);
  }
  ok(dif.length===0,'C: revisarContinuidad da los mismos problemas (mismas palabras) que la versión anterior en '+Object.keys(casosC).length+' diarios × 3 tamaños de página × 5 valores de tope (incluidos uno menor y otro mayor que la última versión) (distintos: '+dif.slice(0,2).join(' ; ')+')');
  { const alm=almFalso(seqs(rango(1,200))); let pedidos=0, maxTramo=0; const alm2={diario:async(d,h)=>{ pedidos++; const r=await alm.diario(d,h); maxTramo=Math.max(maxTramo,r.length); return r; }};
    await verificar.revisarContinuidad(alm2,200,50);
    ok(pedidos===4&&maxTramo<=50,'C: con 200 versiones y tramos de 50 pide 4 tramos y nunca trae más de 50 a la vez (pidió '+pedidos+', máximo '+maxTramo+')'); }
  { const ult=[]; const alm={diario:async(d,h)=>{ ult.push([d,h]); return []; }}; await verificar.revisarContinuidad(alm,120,50);
    ok(JSON.stringify(ult)===JSON.stringify([[0,50],[50,100],[100,Infinity]]),'C: los tramos cubren (0,50] (50,100] (100,∞): ninguna entrada queda fuera ('+JSON.stringify(ult)+')'); }
  // — de punta a punta con un mundo real: el veredicto de verificarCarpeta no cambia —
  { const vivoC=tmp('C-vivo'); await mundo(vivoC,40,10); const cop=tmp('C-copia'); copia.copiarOrdenado(vivoC,cop,{});
    const r=await verificar.verificarCarpeta({dir:cop,codigo:path.join(OP,'..','..'),vivo:vivoC});
    ok(r.ok&&r.seq===40&&r.problemas.length===0,'C: una copia sana sigue pasando la verificación completa (seq '+r.seq+', problemas: '+r.problemas.join(' | ')+')');
    const cop2=tmp('C-copia-mala'); copia.copiarOrdenado(vivoC,cop2,{}); const f=path.join(cop2,'diario.ndjson'); const ls=fs.readFileSync(f,'utf8').split('\n'); ls.splice(10,1); fs.writeFileSync(f,ls.join('\n'));
    const r2=await verificar.verificarCarpeta({dir:cop2,codigo:path.join(OP,'..','..')});
    ok(!r2.ok&&r2.problemas.length>0,'C: una copia con un renglón borrado del diario sigue rechazada ('+r2.problemas[0]+')'); }
  // — memoria: pico al revisar 300 000 versiones con almacén que clona como el real —
  { const lib=JSON.stringify(path.join(OP,'lib','verificar.js'));
    const base=`const N=300000, ents=Array.from({length:N},(_,i)=>({seq:i+1,h:'a'.repeat(64),op:{t:'suelo',x:i,y:1,m:'d'},inv:{t:'suelo',x:i,y:1,m:'g'},c:'0123456789abcdef'}));
      const clon=o=>JSON.parse(JSON.stringify(o)); const alm={diario:async(d,h)=>ents.filter(e=>e.seq>d&&e.seq<=h).map(clon)};`;
    const nueva=pico(base+`;(async()=>{ const v=require(${lib}); await v.revisarContinuidad(alm,N); const f=require('fs').readFileSync('/proc/self/status','utf8'); })().then(()=>{})`);
    const vieja=pico(base+`;(async()=>{ const ent=await alm.diario(0,Infinity); if(ent.length&&ent[0].seq!==1) throw 1; })()`);
    ok(nueva<vieja&&vieja-nueva>40,'C (memoria): revisar 300 000 versiones llega a '+nueva+' MB de RAM (la versión anterior: '+vieja+' MB)');
    console.log('  memoria medida (300 000 versiones): C nueva '+nueva+' MB / anterior '+vieja+' MB'); }

  /* ===== D. B2 en flujo: subir y bajar archivos sin cargarlos enteros, con los mismos resultados y las mismas garantías ===== */
  seccion('D');
  const {B2,ErrorB2}=require(path.join(OP,'lib','b2.js')), {destinoB2}=require(path.join(OP,'lib','destinos.js')), b2falso=require(path.join(raiz,'pruebas','ayudas','b2-falso.js')), crypto=require('crypto');
  const montar=async(opc)=>{ const nombres=['c1','c2'], f=b2falso.crear({claves:{esc:{clave:'kesc',cap:['writeFiles'],cubos:nombres},lec:{clave:'klec',cap:['listFiles','readFiles','listBuckets'],cubos:nombres}},cubos:{c1:{},c2:{}},fallosSubida:opc&&opc.fallosSubida}); const url=await f.iniciar(); return {f,url}; };
  const aleatorio=(ruta,n)=>{ const fd=fs.openSync(ruta,'w'); for(let w=0;w<n;){ const b=crypto.randomBytes(Math.min(1<<20,n-w)); fs.writeSync(fd,b); w+=b.length; } fs.closeSync(fd); };
  { const {f,url}=await montar(), esc=new B2({id:'esc',clave:'kesc',api:url}), lec=new B2({id:'lec',clave:'klec',api:url});
    const d=tmp('D'); const tamanos={'vacío':0,'1 byte':1,'un bloque justo (1 MiB)':MB,'3,5 MiB':3.5*MB|0,'25 MiB':25*MB};
    let dif=[]; let i=0;
    for(const [nom,n] of Object.entries(tamanos)){
      const ruta=path.join(d,'a'+i+++'.bin'); aleatorio(ruta,n); const bytes=fs.readFileSync(ruta);
      const viejo=await esc.subir('c1','viejo-'+nom,bytes,'application/octet-stream'), nuevo=await esc.subirArchivo('c1','nuevo-'+nom,ruta,'application/octet-stream');
      const gv=f.archivos.find(x=>x.fileName==='viejo-'+nom), gn=f.archivos.find(x=>x.fileName==='nuevo-'+nom);
      if(Buffer.compare(gv.data,gn.data)!==0||gv.sha1!==gn.sha1||viejo.sha1!==nuevo.sha1||JSON.stringify(Object.keys(viejo))!==JSON.stringify(Object.keys(nuevo))||f.lg.ultimaSubida.bytes!==n||f.lg.ultimaSubida.contentLength!==n||f.lg.ultimaSubida.transferEncoding) dif.push(nom+' (guardó '+f.lg.ultimaSubida.bytes+' B, Content-Length '+f.lg.ultimaSubida.contentLength+', TE '+f.lg.ultimaSubida.transferEncoding+')');
      const dv=await lec.descargar('c1','viejo-'+nom), ruta2=path.join(d,'bajado'+i+'.bin'); await lec.descargarA('c1','nuevo-'+nom,ruta2);
      if(Buffer.compare(fs.readFileSync(ruta2),bytes)!==0||Buffer.compare(dv,bytes)!==0) dif.push(nom+' (la descarga no es idéntica)');
    }
    ok(dif.length===0,'D: subir/bajar por flujo guarda y devuelve los mismos bytes, la misma suma y la misma forma de respuesta que por buffer en '+Object.keys(tamanos).length+' tamaños, con Content-Length y sin transferencia por trozos (fallan: '+dif.join(' ; ')+')');
    // la descarga se detiene si la suma no coincide, sin dejar nada
    const ruta=path.join(d,'bueno.bin'); aleatorio(ruta,2*MB); await esc.subirArchivo('c1','dañable',ruta,'application/octet-stream'); f.archivos.find(x=>x.fileName==='dañable').data[1000]^=0xff;
    const dest=path.join(d,'out','destino.bin'); fs.mkdirSync(path.dirname(dest),{recursive:true}); fs.writeFileSync(dest,'previo');
    let e1=null,e2=null; try{ await lec.descargar('c1','dañable'); }catch(e){ e1=e; } try{ await lec.descargarA('c1','dañable',dest); }catch(e){ e2=e; }
    ok(e1&&e2&&e1.message===e2.message&&/SHA-1/.test(e2.message),'D: una descarga alterada falla con el mismo mensaje que antes ('+(e2&&e2.message)+')');
    ok(fs.readFileSync(dest,'utf8')==='previo'&&fs.readdirSync(path.dirname(dest)).length===1,'D: tras una descarga que falla el archivo de destino sigue como estaba y no queda ningún temporal');
    let n1=null,n2=null; try{ await lec.descargar('c1','no-existe'); }catch(e){ n1=e; } try{ await lec.descargarA('c1','no-existe',path.join(d,'out','nada.bin')); }catch(e){ n2=e; }
    ok(n1 instanceof ErrorB2&&n2 instanceof ErrorB2&&n1.estado===404&&n2.estado===404&&n1.message===n2.message&&!fs.existsSync(path.join(d,'out','nada.bin'))&&fs.readdirSync(path.join(d,'out')).length===1,'D: un archivo que no existe da el mismo ErrorB2 404 y no crea nada');
    // una suma equivocada la rechaza B2 y no se reintenta (no puede quedar algo guardado mal)
    const antes=f.intentos(); let m=null; try{ await esc._subirCon('c1','torcido','0'.repeat(40),'x',()=>ruta,fs.statSync(ruta).size); }catch(e){ m=e; }
    ok(m instanceof ErrorB2&&m.estado===400&&f.intentos()-antes===1&&!f.archivos.some(x=>x.fileName==='torcido'),'D: si la suma no cuadra B2 lo rechaza (400), se intenta una sola vez y no se guarda nada');
    // la clave de escritura sigue sin poder leer ni listar (nada de esto cambia permisos)
    let neg=null; try{ await esc.descargarA('c1','nuevo-1 byte',path.join(d,'out','x.bin')); }catch(e){ neg=e; }
    ok(neg instanceof ErrorB2&&neg.estado===401&&!fs.existsSync(path.join(d,'out','x.bin')),'D: la clave de escritura sigue sin poder leer (401) y descargarA no deja archivo');
    await f.cerrar(); }
  { // reintentos: dos 503 seguidos y luego bien; cada intento vuelve a leer el archivo desde el principio
    const {f,url}=await montar({fallosSubida:n=>n<=2}), esc=new B2({id:'esc',clave:'kesc',api:url}); const d=tmp('D-reint'), ruta=path.join(d,'r.bin'); aleatorio(ruta,5*MB);
    const r=await esc.subirArchivo('c1','con-reintentos',ruta,'application/octet-stream');
    ok(f.intentos()===3&&f.archivos.length===1&&Buffer.compare(f.archivos[0].data,fs.readFileSync(ruta))===0&&r.sha1===f.archivos[0].sha1,'D: con dos 503 seguidos reintenta con cuerpo nuevo y acaba guardando el archivo completo (intentos '+f.intentos()+')');
    await f.cerrar(); }
  { // por la interfaz de destino, de punta a punta
    const {f,url}=await montar(), cubos={seisHoras:'c1',diario:'c2',semanal:'c2'}; process.env.NATIVA_B2_API=url;
    const dEsc=destinoB2({id:'esc',clave:'kesc',cubos}), dLec=destinoB2({id:'lec',clave:'klec',cubos}); delete process.env.NATIVA_B2_API;
    const d=tmp('D-dest'), ruta=path.join(d,'p.tar.gz.age'); aleatorio(ruta,7*MB);
    await dEsc.subir('seisHoras','p.tar.gz.age',ruta); await dEsc.subirTexto('seisHoras','p.json','{"a":1}');
    const sub=path.join(d,'carpeta-nueva','bajado.age'); await dLec.bajar('seisHoras','p.tar.gz.age',sub);
    const lista=await dLec.listar('seisHoras',''), leido=await dLec.leer('seisHoras','p.json');
    ok(Buffer.compare(fs.readFileSync(sub),fs.readFileSync(ruta))===0&&lista.map(x=>x.nombre).join()==='p.json,p.tar.gz.age'&&leido.toString()==='{"a":1}','D: destinoB2 sube, lista, lee y baja igual que antes (y bajar crea la carpeta si falta)');
    await f.cerrar(); }
  // — memoria: subir y bajar 30 y 150 MiB; el B2 simulado corre en OTRO proceso para medir sólo al cliente. Criterio: techo acotado que NO crece con el archivo —
  { const d=tmp('D-mem'), g30=path.join(d,'g30.age'), g150=path.join(d,'g150.age'); aleatorio(g150,150*MB); fs.writeFileSync(g30,fs.readFileSync(g150).subarray(0,30*MB));
    const srvJs=`const f=require(${JSON.stringify(path.join(raiz,'pruebas','ayudas','b2-falso.js'))}).crear({claves:{esc:{clave:'kesc',cap:['writeFiles','readFiles'],cubos:['c1']}},cubos:{c1:{}}}); f.iniciar().then(u=>console.log(u));`;
    const srv=require('child_process').spawn(process.execPath,['-e',srvJs],{stdio:['ignore','pipe','inherit']});
    const url=await new Promise(r=>srv.stdout.once('data',b=>r(String(b).trim())));
    const lib=JSON.stringify(path.join(OP,'lib','b2.js')), cab=`const {B2}=require(${lib}); const b=new B2({id:'esc',clave:'kesc',api:${JSON.stringify(url)}}); const fs=require('fs');`;
    const medida=js=>{ const r=spawnSync(process.execPath,['-e',cab+`(async()=>{ ${js}; process.stdout.write(String(Math.round(+/VmHWM:\\s+(\\d+)/.exec(fs.readFileSync('/proc/self/status','utf8'))[1]/1024))); })().catch(e=>{ console.error(e); process.exit(1); })`],{encoding:'utf8',timeout:240000}); if(r.status!==0) console.log(r.stderr.slice(0,400)); return +r.stdout; };
    const S=(g,n)=>medida(`await b.subirArchivo('c1','${n}',${JSON.stringify(g)},'application/octet-stream')`);
    const B=(n,o)=>medida(`await b.descargarA('c1','${n}',${JSON.stringify(o)})`);
    const sub30=S(g30,'n30.age'), sub150=S(g150,'n150.age'), baj30=B('n30.age',path.join(d,'b30.age')), baj150=B('n150.age',path.join(d,'b150.age'));
    const subVieja=medida(`await b.subir('c1','v.age',fs.readFileSync(${JSON.stringify(g150)}),'application/octet-stream')`);
    const bajVieja=medida(`fs.writeFileSync(${JSON.stringify(path.join(d,'bv.age'))},await b.descargar('c1','v.age'))`);
    srv.kill();
    ok(Buffer.compare(fs.readFileSync(path.join(d,'b150.age')),fs.readFileSync(g150))===0&&Buffer.compare(fs.readFileSync(path.join(d,'b30.age')),fs.readFileSync(g30))===0&&Buffer.compare(fs.readFileSync(path.join(d,'bv.age')),fs.readFileSync(g150))===0,'D (memoria): los archivos subidos y bajados por los dos caminos son idénticos al original');
    ok(sub150<130&&baj150<130&&sub150-sub30<40&&baj150-baj30<40&&subVieja>150&&bajVieja>150,'D (memoria): pico de RAM subiendo 30 / 150 MiB: '+sub30+' / '+sub150+' MB (antes, con 150 MiB: '+subVieja+' MB); bajando: '+baj30+' / '+baj150+' MB (antes '+bajVieja+' MB). Criterio: menos de 130 MB y sin crecer más de 40 MB al quintuplicar el archivo');
    console.log('  memoria medida (D): subida nueva 30 MiB '+sub30+' MB, 150 MiB '+sub150+' MB, anterior 150 MiB '+subVieja+' MB; descarga nueva 30 MiB '+baj30+' MB, 150 MiB '+baj150+' MB, anterior 150 MiB '+bajVieja+' MB'); }

  seccion('fin');
  console.log('respaldos-memoria: '+bien+' bien, '+mal+' mal ('+Math.round((Date.now()-t0)/1000)+' s)'); limpiar(); process.exit(mal?1:0);
})().catch(e=>{ console.error(e); limpiar(); process.exit(1); });

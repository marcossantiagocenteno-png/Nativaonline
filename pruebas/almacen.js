// Etapa 2 del multijugador: el almacén del mundo oficial (diario, instantáneas, historial, restauración, copia completa).
// Contrato del almacén (lo tiene que cumplir cualquier implementación, también la de SQLite que venga) + el mundo oficial encima.
const fs=require('fs'), os=require('os'), path=require('path'), crypto=require('crypto');
const {abrirAlmacen}=require('../servidor/almacen.js');
const {abrirMundoOficial}=require('../servidor/mundo-oficial.js');
const {cargarMundo}=require('../servidor/cargar-mundo.js');
let bien=0,mal=0; const ok=(c,t)=>{ if(c) bien++; else { mal++; console.log('MAL:',t); } };
const tmp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'nativa-'));
const falla=async f=>{ try{ await f(); return null; }catch(e){ return e.message; } };
const sha=t=>crypto.createHash('sha256').update(t).digest('hex');

(async()=>{
/* ===== la huella: igual en el navegador y en el servidor ===== */
const S0=cargarMundo();
ok(S0.sha256('abc')===sha('abc')&&S0.sha256('')===sha('')&&S0.sha256('ñandú 🌲 日本語')===sha('ñandú 🌲 日本語'),'sha256 escrito a mano da lo mismo que el de Node');
ok(S0.canonico({b:1,a:[{z:1,y:2}],c:undefined})==='{"a":[{"y":2,"z":1}],"b":1}','el JSON canónico ordena las claves');
ok(S0.huella({a:1,b:2})===S0.huella({b:2,a:1}),'la huella no depende del orden de las claves');

/* ===== contrato del almacén ===== */
let d=tmp(), a=await abrirAlmacen({dir:d});
ok((await a.iniciar({semilla:'s1'})).semilla==='s1'&&(await a.meta()).semilla==='s1','iniciar fija la semilla');
ok((await falla(()=>a.iniciar({semilla:'otra'})))!==null,'un almacén de una semilla no se abre con otra');
ok(/ya está abierto/.test(await falla(()=>abrirAlmacen({dir:d}))||''),'dos procesos no escriben el mismo almacén (candado)');
ok((await falla(()=>a.registrar({seq:5,ts:1,autor:'x',t:'op',op:{},h:'h'})))!==null,'el diario sólo acepta el cambio que sigue');
await a.registrar({seq:1,ts:1,autor:'x',t:'op',op:{t:'suelo',x:1,y:1,m:'d'},inv:{t:'suelo-',x:1,y:1},h:'h1'});
await a.registrar({seq:2,ts:2,autor:'x',t:'op',op:{t:'suelo',x:2,y:1,m:'d'},inv:{t:'suelo-',x:2,y:1},h:'h2'});
await a.guardarInstantanea({seq:0,ts:0,motivo:'inicio',semilla:'s1',huella:'h0',mundo:{a:1}});
await a.guardarInstantanea({seq:2,ts:2,motivo:'prueba',semilla:'s1',huella:'h2',mundo:{a:2}});
ok((await falla(()=>a.guardarInstantanea({seq:2,ts:3,motivo:'otra',semilla:'s1',huella:'distinta',mundo:{a:9}})))!==null,'una versión ya guardada no se cambia');
await a.guardarInstantanea({seq:2,ts:3,motivo:'igual',semilla:'s1',huella:'h2',mundo:{a:2}});
ok((await a.instantaneaHasta(1)).seq===0&&(await a.instantaneaHasta(99)).seq===2&&(await a.instantaneaHasta(99)).mundo.a===2,'la instantánea más cercana hacia atrás');
ok((await a.diario(0,2)).length===2&&(await a.diario(1,2)).length===1&&(await a.diario(2,9)).length===0,'el diario se lee por tramos');
const rb=await a.respaldar('prueba'); ok(fs.existsSync(path.join(rb,'diario.ndjson'))&&fs.readdirSync(path.join(rb,'instantaneas')).length===2,'un respaldo copia el diario y las instantáneas');
const rb2=await a.respaldar('prueba'); ok(rb!==rb2,'un respaldo nunca pisa a otro');
await a.cerrar();
a=await abrirAlmacen({dir:d});
ok((await a.ultimaSeq())===2&&(await a.diario(0,9)).length===2&&(await a.instantaneas()).length===2,'cerrar y abrir: todo sigue ahí');
ok((await a.verificar()).ok,'verificar: todo en orden');
await a.cerrar();
/* se cortó la luz a mitad de un renglón */
fs.appendFileSync(path.join(d,'diario.ndjson'),'{"seq":3,"ts":3,"autor":"x","t":"op","op":{"t":"su');
a=await abrirAlmacen({dir:d});
ok(a.reparado&&(await a.ultimaSeqDiario())===2&&fs.readdirSync(d).some(n=>n.startsWith('diario.cola-')),'un renglón a medias se repara solo y la cola queda guardada aparte');
await a.registrar({seq:3,ts:3,autor:'x',t:'op',op:{t:'suelo',x:3,y:1,m:'d'},inv:{t:'suelo-',x:3,y:1},h:'h3'});
ok((await a.diario(0,9)).length===3,'después de repararlo se sigue escribiendo');
await a.cerrar();
/* un renglón dañado en el medio no se repara solo */
const lineas=fs.readFileSync(path.join(d,'diario.ndjson'),'utf8').split('\n'); lineas[1]=lineas[1].replace('"x":2','"x":7');
fs.writeFileSync(path.join(d,'diario.ndjson'),lineas.join('\n'));
ok(/dañado en el renglón 2/.test(await falla(()=>abrirAlmacen({dir:d}))||''),'un renglón alterado en el medio: se niega a abrir y dice cuál es');
ok(!fs.existsSync(path.join(d,'.lock')),'y no deja el candado puesto');

/* ===== el mundo oficial ===== */
d=tmp(); let M=await abrirMundoOficial({dir:d,cadaN:5});
const baseVacio=cargarMundo(), hBase=baseVacio.huella(baseVacio.mundo.exportar());
ok(M.seq()===0&&M.huella()===hBase&&M.NV.mundo.vacio(),'un mundo nuevo nace de la generación base, sin ediciones (versión 0)');
const ins=await M.alm.instantaneas(); ok(ins.length===1&&ins[0].seq===0,'y guarda su versión 0');
const roca=M.NV.motores.obtener('rocoso').caras.objetos.crear('rocoso:roca');
const boca=M.NV.bocaCueva.aObjeto({tipo:'muro',cara:'sur',ancho:9,alto:4.4,boca:2.8,sem:77});
const huellas=[M.huella()], ops=[
  {t:'suelo',x:60,y:60,m:'d'},{t:'altura',x:70,y:70,d:3},{t:'objeto+',x:45,y:50,objeto:roca},{t:'objeto+',x:20,y:75,objeto:boca},
  {t:'rasgo+',rasgo:{id:'cam-1',tipo:'camino',puntos:[[10,10],[30,20],[50,20]],ancho:3,material:'d'}},{t:'suelo',x:61,y:60,m:'g'},
  {t:'lote',ops:[{t:'suelo',x:62,y:60,m:'d'},{t:'suelo',x:63,y:60,m:'d'}]},{t:'suelo-',x:60,y:60},{t:'altura',x:71,y:70,d:2},
  {t:'objeto-',x:45,y:50},{t:'suelo',x:64,y:60,m:'g'},{t:'suelo',x:65,y:60,m:'g'}];
let r=null; for(const o of ops){ r=await M.aplicar(o,'admin:prueba'); huellas.push(r.huella); }
ok(M.seq()===ops.length&&new Set(huellas).size===huellas.length,'cada edición sube la versión y cambia la huella ('+M.seq()+' versiones, todas distintas)');
ok((await M.aplicar({t:'suelo-',x:5,y:5},'admin:prueba')).sinCambio&&M.seq()===ops.length,'una edición que no cambia nada no crea versión');
/* rechazos: el mundo, la versión y el diario quedan como estaban */
const antes={seq:M.seq(),huella:M.huella(),n:(await M.alm.diario(0,999)).length};
ok(/material/.test(await falla(()=>M.aplicar({t:'suelo',x:1,y:1,m:'¿'},'a'))||''),'una edición inválida se rechaza');
ok((await falla(()=>M.aplicar({t:'lote',ops:[{t:'suelo',x:80,y:80,m:'d'},{t:'altura',x:81,y:80,d:1},{t:'suelo',x:82,y:80,m:'¿'}]},'a')))!==null,'un lote con una operación inválida se rechaza');
ok(M.seq()===antes.seq&&M.huella()===antes.huella&&(await M.alm.diario(0,999)).length===antes.n,'y no deja nada a medias: ni en el mundo, ni en la versión, ni en el diario');
ok(!M.NV.solidoEn(80,80)&&M.NV.sueloEn(80,80)===cargarMundo().sueloEn(80,80),'(la casilla del primer paso del lote volvió a como estaba)');
ok((await falla(()=>M.aplicar({t:'nada'},'a')))!==null&&(await falla(()=>M.aplicar(null,'a')))!==null,'una operación desconocida o vacía se rechaza');
/* instantáneas cada N */
ok((await M.alm.instantaneas()).map(s=>s.seq).join()==='0,5,10','se guarda una instantánea cada 5 cambios (0, 5, 10)');
/* cada versión se puede reconstruir y da su huella */
let todas=true; for(let n=0;n<=M.seq();n++){ const v=await M.reconstruir(n); if(v.huella!==huellas[n]) todas=false; }
ok(todas,'las '+(M.seq()+1)+' versiones se reconstruyen y cada una da la huella que tuvo');
ok((await falla(()=>M.reconstruir(999)))!==null,'una versión que no existe se rechaza');
/* cerrar y volver a abrir */
const hFinal=M.huella(), sFinal=M.seq(), expFinal=JSON.stringify(M.NV.mundo.exportar());
await M.cerrar(); M=await abrirMundoOficial({dir:d,cadaN:5});
ok(M.seq()===sFinal&&M.huella()===hFinal&&JSON.stringify(M.NV.mundo.exportar())===expFinal,'cerrar y volver a abrir: el mismo mundo, la misma versión, la misma huella');
const sold=M.NV.solidoEn(20+boca.occ[0][0],75+boca.occ[0][1]);
ok(sold&&!M.NV.solidoEn(20,75),'y la entrada de cueva sigue sólida con la boca libre');
/* restaurar */
const total=(await M.alm.diario(0,999)).length;
const rr=await M.restaurar(3,'admin:prueba');
ok(rr.completo&&rr.seq===sFinal+1&&rr.huella===huellas[3]&&M.huella()===huellas[3],'restaurar la versión 3 deja el mundo exacto de esa versión');
ok((await M.alm.diario(0,999)).length===total+1&&(await M.historial({limite:1}))[0].t==='restaurar'&&(await M.historial({limite:1}))[0].desde===3,'restaurar no borra la historia: agrega una versión nueva que lo dice');
const rr2=await M.restaurar(sFinal,'admin:prueba');
ok(rr2.huella===huellas[sFinal],'se puede volver a restaurar hacia adelante (a la última de antes)');
ok(fs.readdirSync(path.join(d,'respaldos')).filter(n=>/antes-de-restaurar/.test(n)).length===2,'antes de cada restauración se hizo un respaldo completo');
await M.aplicar({t:'suelo',x:90,y:90,m:'d'},'admin:prueba'); const hDesp=M.huella();
await M.cerrar(); M=await abrirMundoOficial({dir:d,cadaN:5});
ok(M.huella()===hDesp,'después de restaurar y seguir editando, cerrar y abrir da el mismo mundo');
/* copia completa */
const C=await M.copiaCompleta();
ok(C.formato==='nativa-copia-1'&&C.huella===M.huella()&&C.semilla===M.NV.CONFIG.seed&&C.historial.length>=M.seq()-0&&C.seq===M.seq(),'la copia completa trae el mundo, su huella y la historia');
const D2=tmp(); const N2=await abrirMundoOficial({dir:D2});
const ri=await N2.importarCopia(JSON.parse(JSON.stringify(C)),'admin:prueba');
ok(ri.huella===C.huella&&N2.huella()===C.huella&&!ri.migrada,'importar la copia en otro servidor da exactamente el mismo mundo');
ok(fs.readdirSync(path.join(D2,'respaldos')).some(n=>/antes-de-importar/.test(n)),'y antes de importar se respaldó lo que había');
const mala=JSON.parse(JSON.stringify(C)); mala.mundo.paneles[Object.keys(mala.mundo.paneles)[0]].suelo.push([1,1,'d']);
ok(/alterada/.test(await falla(()=>N2.importarCopia(mala,'a'))||'')&&N2.huella()===C.huella,'una copia alterada se rechaza y no toca el mundo');
ok(/semilla/.test(await falla(()=>N2.importarCopia(Object.assign(JSON.parse(JSON.stringify(C)),{semilla:'otra'}),'a'))||''),'una copia de otra semilla se rechaza');
ok((await falla(()=>N2.importarCopia({formato:'otro'},'a')))!==null,'algo que no es una copia se rechaza');
/* auditoría */
const au=await M.auditar(); ok(au.ok&&au.versiones===M.seq(),'la auditoría rehace todo el diario desde cada instantánea y todas las huellas coinciden ('+au.versiones+' versiones, '+au.instantaneas+' instantáneas)');
await M.cerrar(); await N2.cerrar();

/* ===== ediciones simultáneas ===== */
const dq=tmp(); let Mq=await abrirMundoOficial({dir:dq,cadaN:7});
const rs=await Promise.all(Array.from({length:25},(_,i)=>Mq.aplicar({t:'suelo',x:30+i,y:30,m:i%2?'d':'g'},'a'+i)));
const seqs=rs.map(r=>r.seq).sort((x,y)=>x-y);
ok(seqs.join()===Array.from({length:25},(_,i)=>i+1).join(),'25 ediciones llegadas a la vez reciben 25 versiones distintas y seguidas');
const mezcla=await Promise.allSettled([Mq.aplicar({t:'suelo',x:60,y:61,m:'d'},'a'),Mq.aplicar({t:'suelo',x:61,y:61,m:'¿'},'a'),Mq.aplicar({t:'suelo',x:62,y:61,m:'g'},'a')]);
ok(mezcla[0].status==='fulfilled'&&mezcla[1].status==='rejected'&&mezcla[2].status==='fulfilled'&&Mq.seq()===27,'una edición inválida en medio de otras no frena ni mezcla a las demás');
ok((await Mq.auditar()).ok,'y el diario completo se rehace con las mismas huellas'); const hq=Mq.huella(); await Mq.cerrar();
Mq=await abrirMundoOficial({dir:dq,cadaN:7}); ok(Mq.huella()===hq&&Mq.seq()===27,'abrir de nuevo da lo mismo'); await Mq.cerrar();

/* ===== una actualización de código que cambia el resultado NO se abre en silencio ===== */
const dc=tmp(); let Mc=await abrirMundoOficial({dir:dc,cadaN:1000}); await Mc.aplicar({t:'suelo',x:60,y:60,m:'d'},'a'); await Mc.aplicar({t:'altura',x:70,y:70,d:3},'a'); await Mc.cerrar();
const fj=path.join(dc,'diario.ndjson'), ls=fs.readFileSync(fj,'utf8').split('\n').filter(Boolean).map(l=>JSON.parse(l));
const suma=e=>{ const c=Object.assign({},e); delete c.c; return sha(JSON.stringify(c)).slice(0,16); };
ls[1].h='0'.repeat(64); delete ls[1].c; ls[1].c=suma(ls[1]); ls[0].c=undefined; { const e0=Object.assign({},ls[0]); delete e0.c; ls[0]=Object.assign({},e0,{c:suma(e0)}); }
fs.writeFileSync(fj,ls.map(e=>JSON.stringify(e)).join('\n')+'\n');
const dañado=await falla(()=>abrirMundoOficial({dir:dc,cadaN:1000}));
ok(/cambio 2/.test(dañado||'')&&/No se abre/.test(dañado||''),'si al rehacer el diario la huella no coincide (el código cambió el resultado), el servidor no arranca y dice qué cambio: '+(dañado||'').slice(0,60));
ok(!fs.existsSync(path.join(dc,'.lock')),'y no deja el almacén bloqueado');
ok(fs.readdirSync(path.join(dc,'instantaneas')).length===1&&fs.readFileSync(fj,'utf8').length>0,'ni toca el diario ni las instantáneas');

/* ===== se cortó entre guardar una versión y anotarla ===== */
const dr=tmp(); let Mr=await abrirMundoOficial({dir:dr}); await Mr.aplicar({t:'suelo',x:60,y:60,m:'d'},'a'); const exp=Mr.NV.mundo.exportar(), hh=Mr.NV.huella(exp), sg=Mr.seq()+1;
await Mr.alm.guardarInstantanea({seq:sg,ts:1,motivo:'restaurar (cortada)',semilla:Mr.NV.CONFIG.seed,huella:hh,mundo:exp}); await Mr.cerrar();
Mr=await abrirMundoOficial({dir:dr});
ok(Mr.seq()===sg&&(await Mr.historial({limite:1}))[0].t==='recuperado','una versión guardada sin su renglón en el diario se recupera y se anota');
await Mr.aplicar({t:'suelo',x:61,y:60,m:'g'},'a'); ok(Mr.seq()===sg+1,'y se sigue editando sin problema'); await Mr.cerrar();

/* ===== los datos viven fuera del código ===== */
ok(/^datos\/$/m.test(fs.readFileSync(path.join(__dirname,'..','.gitignore'),'utf8')),'./datos está en .gitignore: el mundo no entra al repositorio');
const {DIR_POR_DEFECTO}=require('../servidor/almacen.js'); ok(!DIR_POR_DEFECTO().startsWith(path.join(__dirname,'..','src')),'el almacén por defecto no está dentro de src/');
ok((await falla(()=>abrirAlmacen({dir:tmp(),tipo:'sqlite'}))||'').includes('sqlite'),'un almacén de otro tipo se pide por el mismo contrato (hoy sólo archivos)');

console.log(bien+' bien, '+mal+' mal'); process.exit(mal?1:0);
})().catch(e=>{ console.log('ERROR',e.stack); process.exit(1); });

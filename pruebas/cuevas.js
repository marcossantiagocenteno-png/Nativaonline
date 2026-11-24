/* Pruebas del motor de cuevas (laboratorio). */
const NV=require('./cargar.js')();
let bien=0,mal=0; const ok=(c,m)=>{ if(c) bien++; else { mal++; console.log('MAL:',m); } };
const CV=NV.cuevas, E=NV.entorno;
E.usar(E.simulado({viento:{valor:0},luz:{dx:1,dy:0.45,porMetro:0.8,amb:1}}));
const ctx=(S,o)=>{ const k=Object.assign({CPM:8,HPM:4.2,RPM:2.46,t:0,detalle:1},o), m=CV.marco(S,k); return Object.assign({bc:m.bc,br:m.br,cols:m.cols,rows:m.rows},k); };
function dibujar(S,o){ const g=new Map(), c=ctx(S,o); c.put=(x,y,gl,col)=>g.set(x+','+y,[gl,col]); CV.pintar(S,c); return g; }
const hash=g=>{ let h=0; for(const [k,v] of g) h=(Math.imul(h,31)+v[0].charCodeAt(0)+(v[1]&255)+k.length)|0; return h; };
const H=(sp,o)=>hash(dibujar(CV.crear(sp),o));
const brillo=g=>{ let s=0,n=0; for(const v of g.values()){ s+=((v[1]>>16)&255)+((v[1]>>8)&255)+(v[1]&255); n++; } return s/(n||1); };

ok(CV.TIPOS_ID.length>=6,'catálogo de cuevas ('+CV.TIPOS_ID.length+')');
for(const tipo of CV.TIPOS_ID){
  const sp={tipo,sem:5,estado:{musgo:0.4,cristales:0.5,charcos:0.3,derrumbe:0.3}}, S=CV.crear(sp), g=dibujar(S,{oscuridad:0.3});
  ok(g.size>800,tipo+': dibuja celdas ('+g.size+')');
  let raro=0; for(const v of g.values()){ const c=v[0].charCodeAt(0); if(c<32||c>126) if(c!==176) raro=c; }
  ok(!raro,tipo+': glifos imprimibles');
  ok(H(sp,{oscuridad:0.3})===H(sp,{oscuridad:0.3}),tipo+': determinista');
  ok(H(sp,{oscuridad:0.3})!==H(Object.assign({},sp,{sem:6}),{oscuridad:0.3}),tipo+': otra semilla, otra forma');
  const bo=CV.entradas(S); ok(bo.length===S.spec.salidas,tipo+': tiene '+S.spec.salidas+' bocas ('+bo.length+')');
  ok(bo.every(b=>CV.suelo(S,b.x,b.z).libre),tipo+': cada boca está en suelo libre');
  ok(bo.every(b=>Math.abs(Math.hypot(b.dx,b.dz)-1)<1e-6),tipo+': la dirección de cada boca es unitaria');
  ok(CV.luces(S).filter(l=>l.dia).length===bo.length,tipo+': una luz de día por boca');
  /* se puede ir de una boca a otra caminando por lo libre (rejilla de 0,4 m) */
  if(bo.length>=2){ const R=CV.rejilla(S,0.4), idx=(x,z)=>Math.floor((z-R.z0)/R.paso)*R.cols+Math.floor((x-R.x0)/R.paso); const seen=new Uint8Array(R.cols*R.rows), st=[idx(bo[0].x,bo[0].z)]; seen[st[0]]=1;
    while(st.length){ const i=st.pop(), x=i%R.cols, y=(i/R.cols)|0; for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ const nx=x+dx, ny=y+dy; if(nx<0||ny<0||nx>=R.cols||ny>=R.rows) continue; const j=ny*R.cols+nx; if(!seen[j]&&R.libre[j]){ seen[j]=1; st.push(j); } } }
    ok(bo.slice(1).every(b=>seen[idx(b.x,b.z)]),tipo+': las bocas se conectan caminando'); }
}
for(const mat of CV.MATS){ const sp={tipo:'galeria',mat,sem:3}; ok(dibujar(CV.crear(sp),{oscuridad:0.3}).size>800,'material '+mat+' dibuja'); }
ok(H({tipo:'galeria',mat:'caliza',sem:3},{oscuridad:0.3})!==H({tipo:'galeria',mat:'hielo',sem:3},{oscuridad:0.3}),'el material cambia el dibujo');

/* perillas: cada una hace lo suyo y sólo lo suyo */
const base={tipo:'caverna',sem:9,edad:0.2,estado:{}}, M0=CV.crear(base).g.meta;
ok(CV.crear(Object.assign({},base,{edad:0.95})).g.meta.espeleotemas>M0.espeleotemas,'edad: más espeleotemas');
ok(CV.crear(Object.assign({},base,{estado:{derrumbe:0.9}})).g.meta.bloques>M0.bloques,'derrumbe: aparecen bloques');
ok(CV.crear(Object.assign({},base,{estado:{cristales:0.9}})).g.meta.cristales>M0.cristales,'cristales: aparecen racimos');
ok(CV.crear(Object.assign({},base,{estado:{charcos:0.9}})).g.meta.charcos>M0.charcos,'charcos: aparecen charcos');
ok(CV.crear({tipo:'cuevaAgua',sem:2}).g.meta.charcos>=1,'la cueva con lago tiene su lago');
const A=CV.crear(base), B=CV.crear(Object.assign({},base,{estado:{musgo:0.8,humedad:0.9}}));
ok(A.g===B.g,'musgo y humedad reutilizan el sólido (sólo cambia el pintado)');
ok(H(base,{oscuridad:0.3})!==H(Object.assign({},base,{estado:{musgo:0.8}}),{oscuridad:0.3}),'el musgo cambia el dibujo');
const d1=CV.crear(Object.assign({},base,{estado:{derrumbe:0.6}})), d2=CV.crear(Object.assign({},base,{estado:{derrumbe:0.6},semD:12345}));
ok(d1.g.meta.area===d2.g.meta.area&&d1.g!==d2.g,'semD sortea el derrumbe sin mover el trazado');
ok(JSON.stringify(CV.entradas(d1))===JSON.stringify(CV.entradas(d2)),'el derrumbe no mueve las bocas');
const e0=CV.crear({tipo:'galeria',sem:4,largo:30}), e1=CV.crear({tipo:'galeria',sem:4,largo:44});
ok(e1.box.umax-e1.box.umin>e0.box.umax-e0.box.umin+10,'largo: la cueva crece');

/* luz: sin luz casi no se ve; las luces dinámicas alumbran lo suyo */
const S=CV.crear({tipo:'galeria',sem:4}), mid=S.g.bocas[0];
const oscuro=brillo(dibujar(S,{oscuridad:1,memoria:0})), claro=brillo(dibujar(S,{oscuridad:0}));
ok(claro>oscuro*1.5,'oscuridad 0 se ve mucho más que oscuridad 1 ('+Math.round(claro)+' vs '+Math.round(oscuro)+')');
const luz={x:mid.x+6,z:mid.z,y:1.3,rad:5,r:1,g:0.8,b:0.5,i:1.2};
ok(H({tipo:'galeria',sem:4},{oscuridad:1,memoria:0,luces:[luz]})!==H({tipo:'galeria',sem:4},{oscuridad:1,memoria:0}),'una luz propia (linterna) cambia lo que se ve');
const sinMem=dibujar(S,{oscuridad:1,memoria:0}), conMem=dibujar(S,{oscuridad:1,memoria:0.2});
ok(brillo(conMem)>brillo(sinMem),'memoria: se adivina algo sin luz');
/* la roca corta la luz: una luz en la otra punta de la galería no alumbra la pared de al lado de la boca a través de la roca */
let rx=null; for(let z=S.box.zmin+4;z<S.box.zmax-4&&!rx;z+=1) for(let x=S.box.umin+4;x<S.box.umax-4&&!rx;x+=1) if(S.g.QS(x,z)<-2.2&&S.g.QS(x,z+4)>0.5) rx=[x,z];
if(rx){ const dentro=brillo(dibujar(S,{oscuridad:1,memoria:0,luces:[{x:rx[0],z:rx[1]+4,y:1.3,rad:6,r:1,g:1,b:1,i:2}]})), roca=brillo(dibujar(S,{oscuridad:1,memoria:0,luces:[{x:rx[0],z:rx[1],y:1.3,rad:6,r:1,g:1,b:1,i:2}]})), nada=brillo(dibujar(S,{oscuridad:1,memoria:0}));
  ok(dentro>nada*1.01,'una luz dentro de la galería la alumbra'); ok(roca<nada+(dentro-nada)*0.35,'la roca corta la luz: una luz metida en la roca casi no alumbra la galería'); }
else ok(false,'no encontré un punto de roca junto a la galería para probar la línea de vista');

/* edición */
const ed=CV.editar({tipo:'galeria',sem:3},{edad:0.7}); ok(ed.tocado.forma&&!ed.tocado.pintado,'editar edad toca la forma');
ok(CV.editar({tipo:'galeria',sem:3},{estado:{musgo:0.5}}).tocado.pintado&&!CV.editar({tipo:'galeria',sem:3},{estado:{musgo:0.5}}).tocado.forma,'editar musgo sólo toca el pintado');
ok(CV.editar({tipo:'galeria',sem:3},{estado:{derrumbe:0.5}}).tocado.deterioro,'editar derrumbe toca el daño');
const rg=CV.regenerar({tipo:'galeria',sem:3},'forma'); ok(rg.sem!==3&&rg.semD===CV.limpiar({tipo:'galeria',sem:3}).semD,'regenerar forma sólo sortea la forma');
let err=0; try{ CV.regenerar({tipo:'galeria'},'nada'); }catch(e){ err=1; } ok(err,'regenerar rechaza una parte desconocida');
err=0; try{ CV.crear({tipo:'castillo'}); }catch(e){ err=1; } ok(err,'tipo desconocido falla con claridad');
err=0; try{ CV.crear({tipo:'galeria',mat:'oro'}); }catch(e){ err=1; } ok(err,'material desconocido falla con claridad');
const pl=CV.plantilla('camara',{edad:0.9}); ok(CV.nuevo('camara',3).edad===0.9&&CV.limpiar({tipo:'camara',sem:3}).edad!==0.9,'la plantilla vale para lo nuevo, no para lo ya hecho'); CV.plantilla('camara',null);
ok(CV.variar({tipo:'galeria',sem:3,edad:0.7}).edad===0.7,'variar conserva medidas y edad');
/* persistencia */
const sp=CV.limpiar({tipo:'bifurcacion',sem:8,estado:{cristales:0.4}}); ok(JSON.stringify(CV.deObjeto(JSON.parse(JSON.stringify(CV.aObjeto(sp)))))===JSON.stringify(sp),'la spec sobrevive a JSON');
ok(CV.paraPaleta.length===CV.TIPOS_ID.length&&CV.paraPaleta.every(p=>p.encaja(CV.aObjeto({tipo:p.id.split(':')[1]}))),'entradas de paleta');
/* consultas de suelo */
const Sg=CV.crear({tipo:'galeria',sem:4}), b0=Sg.g.bocas[0]; ok(CV.suelo(Sg,b0.x,b0.z).libre,'suelo libre en la boca'); ok(!CV.suelo(Sg,Sg.box.umin+0.5,Sg.box.zmin+0.5).libre,'roca no es libre');
const La=CV.crear({tipo:'cuevaAgua',sem:2}), lg=La.g.pozas[0]; ok(CV.suelo(La,lg.x,lg.z).honda&&!CV.suelo(La,lg.x,lg.z).libre,'el lago hondo no se pisa');
/* oclusión de la roca: el interior no se pinta fuera de su caja */
const gg=dibujar(Sg,{oscuridad:0.3}); let fuera=0; const mm=CV.marco(Sg,ctx(Sg,{})); for(const k of gg.keys()){ const [c,r]=k.split(',').map(Number); if(c<0||r<0||c>=mm.cols||r>=mm.rows) fuera++; } ok(!fuera,'nada se pinta fuera del marco');
/* recorte: sólo se hornean las bandas que se piden */
CV.reiniciarCache(); const Sr=CV.crear({tipo:'caverna',sem:3}), c2=ctx(Sr,{}); c2.rmin=0; c2.rows=30; const t0=Date.now(); CV.pintar(Sr,Object.assign({put(){}},c2,{rows:30}));
const bandasPocas=CV.estadisticas().bandas; CV.pintar(Sr,Object.assign({put(){}},ctx(Sr,{})));
ok(bandasPocas<CV.estadisticas().bandas,'las bandas se calculan sólo cuando se piden ('+bandasPocas+' → '+CV.estadisticas().bandas+')');
/* rendimiento */
CV.reiniciarCache(); const Sp=CV.crear({tipo:'caverna',sem:3,estado:{cristales:0.5,charcos:0.4,derrumbe:0.4}}); let t1=Date.now(); dibujar(Sp,{oscuridad:0.5}); const frio=Date.now()-t1; t1=Date.now(); dibujar(Sp,{oscuridad:0.5}); const tibio=Date.now()-t1;
ok(frio<4000,'caverna entera en frío ('+frio+' ms)'); ok(tibio<frio&&tibio<600,'caverna entera con la geometría ya hecha ('+tibio+' ms)');
ok(CV.crear({tipo:'caverna',sem:3,estado:{cristales:0.5,charcos:0.4,derrumbe:0.4}}).g===Sp.g,'la misma spec reutiliza el sólido');
console.log('cuevas — frío',frio,'ms, tibio',tibio,'ms');
console.log(mal?'FALLAN '+mal+' de '+(bien+mal):'todo bien '+bien+' ok'); process.exit(mal?1:0);

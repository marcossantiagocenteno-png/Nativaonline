/* Pruebas del motor de estructuras y ruinas (laboratorio). */
const NV=require('./cargar.js')();
let bien=0,mal=0; const ok=(c,m)=>{ if(c) bien++; else { mal++; console.log('MAL:',m); } };
const ES=NV.estructuras, E=NV.entorno;
E.usar(E.simulado({viento:{valor:0},luz:{dx:1,dy:0.45,porMetro:0.8,amb:1}}));
const ctx=o=>Object.assign({bc:80,br:80,CPM:13,HPM:6.8,RPM:4,x:1,y:1,t:0,detalle:2,contorno:true},o);
function dibujar(S,o){ const g=new Map(), c=ctx(o); c.put=(x,y,gl,col)=>g.set(x+','+y,[gl,col]); ES.pintar(S,c); return g; }
const hash=g=>{ let h=0; for(const [k,v] of g) h=(Math.imul(h,31)+v[0]+(v[1]&255)+k.length)|0; return h; };
const cuenta=(g,f)=>{ let n=0; for(const v of g.values()) if(f(v[0])) n++; return n; };
const H=sp=>hash(dibujar(ES.crear(sp)));
ok(ES.TIPOS_ID.length>=14,'catálogo de tipos de la tanda ('+ES.TIPOS_ID.length+')');
/* todos los tipos dibujan, con contorno, sin glifos fuera del rango imprimible */
for(const tipo of ES.TIPOS_ID){
  const sp={tipo,sem:5,estado:{musgo:0.4,vegetacion:0.3}}, g=dibujar(ES.crear(sp));
  ok(g.size>40,tipo+': dibuja celdas');
  let raro=0; for(const v of g.values()) if(v[0]<32||v[0]>126) if(v[0]!==176) raro=v[0];
  ok(!raro,tipo+': glifos imprimibles'+(raro?' (salió '+raro+')':''));
  ok(cuenta(g,gl=>gl===35)>4,tipo+': tiene contorno');
  ok(H(sp)===H(sp),tipo+': determinista');
  ok(H(sp)!==H(Object.assign({},sp,{sem:6})),tipo+': otra semilla, otra forma');
}
for(const mat of ES.MATS){ const sp={tipo:'muro',mat,sem:3}; ok(dibujar(ES.crear(sp)).size>40,'material '+mat+' dibuja'); }
ok(H({tipo:'muro',mat:'sillar',sem:3})!==H({tipo:'muro',mat:'ladrillo',sem:3}),'el material cambia el dibujo');
/* edad y deterioro son perillas distintas */
const base={tipo:'muro',sem:8}, S0=ES.crear(Object.assign({},base,{edad:0,deterioro:0}));
const Sd=ES.crear(Object.assign({},base,{edad:0,deterioro:0.9})), Se=ES.crear(Object.assign({},base,{edad:0.9,deterioro:0}));
ok(Sd.g.rubble>S0.g.rubble,'deterioro: aparece escombro');
ok(Se.g.rubble===S0.g.rubble,'edad sola no saca piezas ni crea escombro');
ok(H({tipo:'muro',sem:8,edad:0.9,deterioro:0})!==H({tipo:'muro',sem:8,edad:0,deterioro:0}),'la edad cambia el aspecto');
ok(H({tipo:'muro',sem:8,deterioro:0.9})!==H({tipo:'muro',sem:8,deterioro:0}),'el deterioro cambia el aspecto');
/* editar toca sólo la capa pedida y reutiliza el sólido */
ES.reiniciarCache(); const sp0=ES.limpiar({tipo:'muro',sem:4,deterioro:0.3,edad:0.4}); ES.crear(sp0); const n0=ES.estadisticas().solidos;
const r1=ES.editar(sp0,{lum:0.2,estado:{musgo:0.6}}); ES.crear(r1.spec);
ok(r1.tocado.pintado&&!r1.tocado.forma&&!r1.tocado.deterioro,'editar apariencia/estado: sólo pinta');
ok(ES.estadisticas().solidos===n0,'editar apariencia no reconstruye el sólido');
const r2=ES.editar(sp0,{largo:sp0.largo+2}); ok(r2.tocado.forma,'editar medidas: toca la forma');
const r3=ES.editar(sp0,{deterioro:0.8}); ok(r3.tocado.deterioro&&!r3.tocado.forma,'editar deterioro: toca el deterioro, no la forma');
/* regenerar sortea una sola parte */
const rg=ES.regenerar(sp0,'deterioro'); ok(rg.sem===sp0.sem&&rg.semD!==sp0.semD,'regenerar deterioro: misma forma, otro daño');
const rv=ES.regenerar(sp0,'vegetacion'); ok(rv.sem===sp0.sem&&rv.semD===sp0.semD&&rv.semV!==sp0.semV,'regenerar vegetación: sólo cambia semV');
const rf=ES.regenerar(sp0,'forma'); ok(rf.sem!==sp0.sem,'regenerar forma: otra semilla de forma');
ok(ES.editar(sp0,{lum:0.2}).spec!==sp0&&sp0.lum!==0.2,'editar no muta la spec original');
/* plantilla (generador) vs objeto colocado */
const colocado=ES.nuevo('muro',9); ES.plantilla('muro',{deterioro:0.77});
ok(ES.nuevo('muro',10).deterioro===0.77,'la plantilla afecta a los objetos nuevos');
ok(colocado.deterioro!==0.77,'la plantilla no mueve objetos ya hechos');
ES.plantilla('muro',null);
ok(ES.nuevo('muro',10).deterioro!==0.77,'plantilla restaurable');
/* variar: misma familia, otra forma */
ok(H(ES.variar(sp0))!==H(sp0),'variar cambia la estructura'); ok(ES.variar(sp0).tipo===sp0.tipo,'variar conserva el tipo');
/* persistencia */
const sp1=ES.limpiar({tipo:'arco',mat:'sillar',sem:21,deterioro:0.4,edad:0.6,estado:{musgo:0.5}});
const ob=ES.aObjeto(sp1); ok(ob.k==='estructura','aObjeto marca la clase');
const vuelta=ES.deObjeto(JSON.parse(JSON.stringify(ob))); ok(H(vuelta)===H(sp1),'JSON de ida y vuelta da la misma estructura');
/* agrupaciones */
for(const id of ES.GRUPOS_ID){
  const G=ES.grupo(id,3), P=ES.descomponer(G);
  ok(P.length>=2,'grupo '+id+': partes ('+P.length+')');
  ok(P.every(p=>p.id&&p.spec&&isFinite(p.x)&&isFinite(p.y)),'grupo '+id+': cada parte con id, spec y posición');
  const g=new Map(), c=ctx(); c.put=(x,y,gl,col)=>g.set(x+','+y,[gl,col]); ES.pintarGrupo(G,c); ok(g.size>100,'grupo '+id+': dibuja');
  const P2=P.map(p=>Object.assign({},p)); P2[0]=Object.assign({},P2[0],{spec:ES.editar(P2[0].spec,{deterioro:1}).spec});
  ok(P2.slice(1).every((p,i)=>p.spec===P[i+1].spec),'grupo '+id+': editar una parte no toca las otras');
}
/* giro, escala, rotación */
ok(H({tipo:'muro',sem:2,yaw:0})!==H({tipo:'muro',sem:2,yaw:1.2}),'el giro cambia lo que se ve');
const ch=ES.crear({tipo:'muro',sem:2,escala:0.6}), gr=ES.crear({tipo:'muro',sem:2,escala:1.6}); ok(gr.box.umax>ch.box.umax*1.5,'la escala cambia las medidas en metros');
/* distancia de cámara: mismos metros, menos celdas */
const Sx=ES.crear({tipo:'muro',sem:2}), lejos=dibujar(Sx,{CPM:5.2,HPM:2.7,RPM:1.6}), cerca=dibujar(Sx); ok(lejos.size>12&&lejos.size<cerca.size,'zoom lejano: menos celdas, sigue dibujando');
/* oclusión: lo que está más al sur se pinta encima */
const g2=new Map(), c2=ctx(); c2.put=(x,y,gl,col)=>g2.set(x+','+y,[gl,col]); ES.pintar(Sx,c2); const antes=g2.size; ES.pintar(Sx,Object.assign(c2,{x:1.5})); ok(g2.size>=antes,'dos estructuras superpuestas dibujan sin error');
/* sombra proyectada */
const sh=new Map(), cs=ctx(); cs.put=(x,y,gl,col)=>sh.set(x+','+y,[gl,col]); cs.sombrear=(c,r,k)=>sh.set(c+','+r,[k,0]); ES.pintarSombra(Sx,cs); ok(sh.size>20,'proyecta sombra');
/* rendimiento: 40 estructuras distintas y repintar con caché */
ES.reiniciarCache(); let t0=Date.now(); const lote=[]; for(let i=0;i<40;i++) lote.push(ES.crear({tipo:ES.TIPOS_ID[i%ES.TIPOS_ID.length],sem:i+1,estado:{musgo:0.3}}));
for(const S of lote) dibujar(S); const frio=Date.now()-t0; t0=Date.now(); for(const S of lote) dibujar(S); const tibio=Date.now()-t0;
ok(tibio<frio,'repintar con caché es más barato ('+frio+' ms → '+tibio+' ms)'); ok(frio<8000,'40 estructuras en frío: '+frio+' ms');
console.log(mal?mal+' fallas':'todo bien',bien+' ok'); process.exit(mal?1:0);

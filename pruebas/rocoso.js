/* Pruebas del motor de rocas y formaciones (laboratorio). */
const NV=require('./cargar.js')();
let bien=0,mal=0; const ok=(c,m)=>{ if(c) bien++; else { mal++; console.log('MAL:',m); } };
const R=NV.rocoso, E=NV.entorno;
E.usar(E.simulado({viento:{valor:0},luz:{dx:1,dy:0.45,porMetro:0.8,amb:1}}));
const ctx=o=>Object.assign({bc:60,br:60,CPM:13,HPM:6.8,RPM:4,x:1,y:1,t:0,detalle:2},o);
function dibujar(S,o){ const g=new Map(); const c=ctx(o); c.put=(x,y,gl,col)=>g.set(x+','+y,[gl,col]); (S.tipo==='formacion'?R.pintarFormacion:R.pintar)(S,c); return g; }
const hash=g=>{ let h=0; for(const [k,v] of g) h=(Math.imul(h,31)+v[0]+(v[1]&255)+k.length)|0; return h; };
const cuenta=(g,f)=>{ let n=0; for(const v of g.values()) if(f(v[0],v[1])) n++; return n; };
const OK=new Set(" .:;*,-'`_/\\|^=~oOaAeEcxXMlIHBU8&@0%#°".split('').map(c=>c.charCodeAt(0)).concat([35,176]));
/* todas las combinaciones dibujan y usan sólo glifos del diccionario */
for(const mat of R.MATS) for(const tam of R.TAMS){
  const S=R.crearRoca({mat,tam,forma:'angular',sem:4,estado:{musgo:0.5,liquen:0.5}}), g=dibujar(S);
  ok(g.size>(tam==='pequena'?12:60),mat+' '+tam+': dibuja celdas');
  let fuera=0; for(const v of g.values()) if(!OK.has(v[0])) fuera=v[0];
  ok(!fuera,mat+' '+tam+': glifos del diccionario'+(fuera?' (salió '+fuera+')':''));
  ok(cuenta(g,(gl)=>gl===35)>6,mat+' '+tam+': tiene contorno');
}
for(const forma of R.FORMAS){ const g=dibujar(R.crearRoca({mat:'granito',tam:'media',forma,sem:2})); ok(g.size>60,'forma '+forma+' dibuja'); }
/* determinismo y variación */
const a=R.crearRoca({mat:'caliza',tam:'grande',forma:'irregular',sem:9,estado:{musgo:0.4}});
ok(hash(dibujar(a))===hash(dibujar(R.crearRoca({mat:'caliza',tam:'grande',forma:'irregular',sem:9,estado:{musgo:0.4}}))),'misma receta, misma roca');
ok(hash(dibujar(a))!==hash(dibujar(R.crearRoca({mat:'caliza',tam:'grande',forma:'irregular',sem:10,estado:{musgo:0.4}}))),'otra semilla, otra roca');
const h1=hash(dibujar(R.crearRoca({mat:'granito',tam:'media',forma:'redondeada',sem:3}))), h2=hash(dibujar(R.crearRoca({mat:'basalto',tam:'media',forma:'redondeada',sem:3})));
ok(h1!==h2,'el material cambia el dibujo');
/* materiales con estructura propia */
const rampaDe=mat=>{ const S=R.crearRoca({mat,tam:'grande',forma:'estratificada',sem:5}), g=dibujar(S), s=new Set(); for(const v of g.values()) s.add(v[0]); return s; };
ok(rampaDe('arenisca').has(61),'arenisca: estratos con "=" (repisa)');
ok(rampaDe('pizarra').has(108)||rampaDe('pizarra').has(45),'pizarra: láminas finas');
const bas=R.crearRoca({mat:'basalto',tam:'grande',forma:'fracturada',sem:5}); ok(bas.juntas.length>=3,'basalto: juntas columnares');
const gra=R.crearRoca({mat:'granito',tam:'grande',forma:'fracturada',sem:5}); ok(gra.juntas.length>=2,'granito: juegos de juntas');
/* iluminación: otro sol, otra imagen, y la luz no la pone la roca */
const S1=R.crearRoca({mat:'granito',tam:'grande',forma:'angular',sem:6}), gi=hash(dibujar(S1));
E.usar(E.simulado({viento:{valor:0},luz:{dx:-1,dy:0.2,porMetro:1.5,amb:1}}));
ok(gi!==hash(dibujar(S1)),'cambia la luz, cambia la roca');
E.usar(E.simulado({viento:{valor:0},luz:{dx:1,dy:0.45,porMetro:0.8,amb:1}}));
ok(gi===hash(dibujar(S1)),'vuelve la luz, vuelve la imagen (caché estable)');
/* estados */
const tono=(g,fn)=>cuenta(g,(gl,c)=>fn((c>>16)&255,(c>>8)&255,c&255));
const seca=dibujar(R.crearRoca({mat:'granito',tam:'media',forma:'irregular',sem:8,estado:{}}));
const musg=dibujar(R.crearRoca({mat:'granito',tam:'media',forma:'irregular',sem:8,estado:{musgo:1}}));
ok(tono(musg,(r,g,b)=>g>r+12&&g>b+10)>tono(seca,(r,g,b)=>g>r+12&&g>b+10)+8,'el musgo pone celdas verdes');
const liq=dibujar(R.crearRoca({mat:'granito',tam:'media',forma:'redondeada',sem:8,estado:{liquen:1}}));
ok(tono(liq,(r,g,b)=>r>150&&g>130&&b<110)>0,'el líquen pone celdas amarillentas');
const ent0=dibujar(R.crearRoca({mat:'granito',tam:'media',forma:'redondeada',sem:8,estado:{}})), ent1=dibujar(R.crearRoca({mat:'granito',tam:'media',forma:'redondeada',sem:8,estado:{enterrada:0.9}}));
ok(cuenta(ent1,(gl)=>gl===44||gl===59)>cuenta(ent0,(gl)=>gl===44||gl===59),'enterrada: tierra al pie');
ok(R.crearRoca({mat:'granito',tam:'media',forma:'redondeada',sem:8,estado:{enterrada:0.9}}).hmax>0,'enterrada sigue teniendo altura');
/* contorno apagado y sin marco cuadrado */
const con=dibujar(S1), sin=dibujar(S1,{contorno:false});
ok(cuenta(con,gl=>gl===35)>0&&cuenta(sin,gl=>gl===35)===0,'el contorno se enciende y se apaga');
let filas=new Map(); for(const [k,v] of con) if(v[0]===35){ const [x,y]=k.split(',').map(Number); filas.set(y,(filas.get(y)||0)+1); }
ok(Math.max(...filas.values())<S1.box.umax*2*13,'el contorno no es un marco cuadrado');
/* sombra proyectada y contacto */
const sh=R.sombra(S1,ctx()); ok(sh&&sh.w>0&&Math.max(...sh.k)>0,'hay sombra proyectada');
/* el motor no modifica la caché de los demás ni usa índices negativos */
ok(typeof NV.ROCAS==='object'&&NV.ROCAS.pequena.length>0,'el motor de piedra del juego queda intacto');
/* perturbación en agua */
const pt=R.perturbacion(R.crearRoca({mat:'granito',tam:'media',forma:'redondeada',sem:1}),{CPM:13,RPM:4,bc:50,br:30});
ok(pt.length>6&&pt.every(p=>p.g===126||p.g===45),'la roca perturba la corriente (~ y -)');
/* formaciones: todas dibujan, determinista y por tramos */
for(const tipo of R.TIPOS){
  const F=R.crearFormacion({tipo,mat:'caliza',ancho:14,sem:3}), g=dibujar(F,{br:120});
  ok(g.size>400,'formación '+tipo+' dibuja');
  ok(cuenta(g,gl=>gl===35)>20,'formación '+tipo+' tiene contorno');
}
const F=R.crearFormacion({tipo:'acantilado',mat:'arenisca',ancho:20,sem:5}), g0=dibujar(F,{br:120}), h0=hash(g0);
ok(h0===hash(dibujar(R.crearFormacion({tipo:'acantilado',mat:'arenisca',ancho:20,sem:5}),{br:120})),'formación determinista');
const n=R.invalidarFormacion(F,3,6,13); ok(n>=1&&n<=3,'invalidar un sector toca pocos tramos ('+n+')');
ok(h0===hash(dibujar(F,{br:120})),'rehacer un tramo da lo mismo (el sólido es global)');
const alto=cuenta(g0,(gl)=>gl===61)>0; ok(alto,'acantilado de arenisca lleva estratos');
let planas=true; { const por=new Map(); for(const k of g0.keys()){ const [x,y]=k.split(',').map(Number); if(!por.has(y)) por.set(y,[]); por.get(y).push(x); } }
/* el acantilado no es una pared plana: su silueta superior varía */
{ const top=new Map(); for(const [k,v] of g0){ const [x,y]=k.split(',').map(Number); if(!top.has(x)||y<top.get(x)) top.set(x,y); } const ys=[...top.values()]; ok(Math.max(...ys)-Math.min(...ys)>=3,'la cima del acantilado tiene relieve'); }
/* agrupaciones */
for(const t of R.GRUPOS_ID){
  const G=R.grupo(t,4,{mat:'granito'}), G2=R.grupo(t,4,{mat:'granito'});
  ok(G.rocas.length>=2,'grupo '+t+' tiene rocas');
  ok(JSON.stringify(G)===JSON.stringify(G2),'grupo '+t+' determinista');
  const xs=G.rocas.map(r=>r.x); ok(new Set(xs.map(x=>x.toFixed(2))).size>=Math.min(xs.length,2),'grupo '+t+' no está en retícula');
}
const gm=R.grupo('bloques',3,{mat:'granito'}); ok(gm.rocas.some(r=>r.elev>0)||gm.rocas.length>=2,'bloques: se apilan o se agrupan');
const gp=R.grupo('rio',3,{mat:'basalto'}); ok(gp.rocas.some(r=>r.agua!=null),'río: alguna roca sumergida');
/* registro y conexiones */
const m=NV.motores.obtener('rocoso'); ok(m&&m.estado==='integrado'&&m.caras.objetos&&m.caras.creador,'registrado, con caras objetos y creador (Modo Dios)');
ok(E.conexiones().some(c=>c.id==='rocoso'&&c.luz&&c.contorno&&(!c.viento||!c.viento.length)),'declara luz, sombra y contorno; sin viento');
ok(R.catalogo().length>=R.TAMS.length*R.FORMAS.length,'catálogo completo');
/* errores claros */
let e1=0; try{ R.crearRoca({mat:'nada'}); }catch(e){ e1=1; } ok(e1,'material desconocido avisa');
console.log(bien+' bien, '+mal+' mal'); process.exit(mal?1:0);

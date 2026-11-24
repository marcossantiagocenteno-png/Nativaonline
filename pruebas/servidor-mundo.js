// Etapa 1 del multijugador: el servidor carga el mundo SIN pantalla con el mismo código que el cliente y decide igual.
// Paridad: el cliente completo (pruebas/cargar.js) y el mundo del servidor (servidor/cargar-mundo.js) reciben las mismas
// ediciones y tienen que dar la misma respuesta en cada casilla (suelo, sólido, altura) y el mismo mundo exportado.
const cliente=require('./cargar.js');
const {cargarMundo,clasificacion}=require('../servidor/cargar-mundo.js');
let bien=0,mal=0; const ok=(c,t)=>{ if(c) bien++; else { mal++; console.log('MAL:',t); } };

const cl=clasificacion();
ok(cl.ok,'cada módulo de NV_MODULOS está en la lista del servidor o en la del cliente, no en las dos'+(cl.ok?'':' '+JSON.stringify(cl)));

const C=cliente('module.exports={NV:window.NV};').NV;       // el cliente, con todos sus módulos
const t0=Date.now(); const S=cargarMundo(); const ms=Date.now()-t0;     // el servidor, sólo los del estado
ok(typeof S.sueloEn==='function'&&typeof S.solidoEn==='function'&&typeof S.alturaEn==='function'&&S.mundo&&S.mundo.editar,'el servidor tiene colisión, altura y ediciones');
/* algunos motores traen sus funciones de dibujo en el mismo archivo que su estado (rocas, árboles, topes, entradas): cargadas, pero sin lienzo nadie las llama */
ok(!S.escena&&!S.subescenas&&!S.nuevoPersonaje&&!S.personajes&&!S.dibujarUmbral&&!S.editor&&!S.creador&&!S.lienzo,'el servidor no trae la pantalla, ni los personajes, ni el editor, ni las escenas del cliente');
{ const r=require('child_process').spawnSync(process.execPath,['-e',"const {cargarMundo}=require('./servidor/cargar-mundo.js'); const N=cargarMundo(); console.log(typeof document+' '+typeof window+' '+N.solidoEn(0,0))"],{cwd:require('path').resolve(__dirname,'..'),encoding:'utf8'});
  ok(r.status===0&&/^undefined undefined /.test(r.stdout),'en un proceso limpio el servidor carga sin DOM ni window global: '+(r.stdout||r.stderr).trim()); }
ok(S.CONFIG.seed===C.CONFIG.seed&&S.LADO===C.LADO,'misma semilla y mismo tamaño de panel');
ok(ms<2000,'carga rápido ('+ms+' ms)');

const R=[-30,150];                                   // un margen por fuera del mundo: ahí las dos tienen que decir "nada"
function huellaMundo(N){
  let h=0, suelos=0, solidos=0;
  for(let y=R[0];y<=R[1];y++) for(let x=R[0];x<=R[1];x++){
    const s=N.sueloEn(x,y), so=N.solidoEn(x,y), a=N.alturaEn(x+0.5,y+0.5);
    h=(Math.imul(h,31)+(s?s.charCodeAt(0):0)*7+(so?5:3)+Math.round(a*100))|0;
    if(s) suelos++; if(so) solidos++;
  }
  return {h,suelos,solidos};
}
const igual=(a,b)=>a.h===b.h&&a.suelos===b.suelos&&a.solidos===b.solidos;

/* 1. sin ediciones */
let a=huellaMundo(C), b=huellaMundo(S);
ok(igual(a,b),'sin ediciones el servidor y el cliente deciden igual en '+((R[1]-R[0]+1)**2)+' casillas ('+a.suelos+' con suelo, '+a.solidos+' sólidas)');
ok(a.suelos>5000&&a.solidos>0,'la prueba mira un mundo de verdad (hay suelo y hay sólidos)');

/* 2. las mismas ediciones en los dos, de todos los tipos que cambian el estado */
const roca=C.motores.obtener('rocoso').caras.objetos.crear('rocoso:roca');
const form=C.motores.obtener('rocoso').caras.objetos.crear('rocoso:formacion');
const boca=C.bocaCueva.aObjeto({tipo:'muro',cara:'sur',ancho:9,alto:4.4,boca:2.8,sem:77});
const bocaLado=C.bocaCueva.aObjeto({tipo:'penasco',cara:'oeste',ancho:8,alto:4,boca:2.6,sem:5});
const tope=C.motores.obtener('tope').caras.objetos.crear('tope:tope');
const lago=C.aguas.aDatos(C.aguas.crear('lago',{id:'lago-1',poligono:[[24,26],[38,25],[40,34],[30,38],[23,33]],sem:3}));
const ops=[
  {t:'suelo',x:60,y:60,m:'d'},{t:'suelo',x:61,y:60,m:'d'},{t:'suelo',x:62,y:61,m:'g'},
  {t:'altura',x:70,y:70,d:3},{t:'altura',x:71,y:70,d:3},{t:'altura',x:70,y:71,d:-2},
  {t:'objeto+',x:40,y:60,objeto:{k:'roca',h:1}},
  {t:'objeto+',x:45,y:50,objeto:roca},{t:'objeto+',x:55,y:40,objeto:form},
  {t:'objeto+',x:20,y:75,objeto:boca},{t:'objeto+',x:80,y:30,objeto:bocaLado},
  {t:'objeto+',x:50,y:80,objeto:tope},
  {t:'agua',id:'lago-1',datos:lago},
  {t:'rasgo+',rasgo:{id:'cam-1',tipo:'camino',puntos:[[10,10],[30,20],[50,20]],ancho:3,material:'d'}},
  {t:'objeto-',x:40,y:60}
];
const copia=o=>JSON.parse(JSON.stringify(o));
const invsC=[], invsS=[]; let fallos=0;
for(const op of ops){ try{ invsC.push(C.mundo.editar(copia(op))); invsS.push(S.mundo.editar(copia(op))); }catch(e){ fallos++; console.log('falló',op.t,e.message); } }
C.olvidarObjetos(); S.olvidarObjetos();
ok(fallos===0,'las '+ops.length+' ediciones se aplican en los dos sin error');
ok(JSON.stringify(C.mundo.exportar())===JSON.stringify(S.mundo.exportar()),'el mundo editado exportado es idéntico byte a byte');
a=huellaMundo(C); b=huellaMundo(S);
ok(igual(a,b),'con ediciones el servidor y el cliente deciden igual en todas las casillas ('+a.suelos+' con suelo, '+a.solidos+' sólidas)');
const sin=huellaMundo(cargarMundo());
ok(!igual(sin,b)&&b.solidos>sin.solidos,'las ediciones cambian de verdad lo que decide el servidor (más sólidos: '+sin.solidos+' → '+b.solidos+')');
/* la entrada de cueva deja libre la casilla de afuera y sólida la masa, también en el servidor */
ok(S.solidoEn(20+boca.occ[0][0],75+boca.occ[0][1])&&!S.solidoEn(20,75),'en el servidor la entrada de cueva tiene masa sólida y la boca libre');
ok(S.solidoEn(50,80),'en el servidor el tope es sólido');

/* 3. de un mundo al otro: lo que exporta el servidor lo carga un cliente y decide igual (así arranca un cliente que se conecta) */
const C2=cliente('module.exports={NV:window.NV};').NV; C2.mundo.cargar(copia(S.mundo.exportar())); C2.olvidarObjetos();
ok(igual(huellaMundo(C2),b),'un cliente nuevo que carga el mundo del servidor decide igual');

/* 4. deshacer en el servidor devuelve el mundo de antes (las inversas viajan y se aplican igual) */
for(let i=invsS.length-1;i>=0;i--) if(invsS[i]) S.mundo.editar(copia(invsS[i]));
S.olvidarObjetos();
ok(igual(huellaMundo(S),huellaMundo(cargarMundo())),'deshacer todas las ediciones en el servidor devuelve el mundo original');

/* 5. cada llamada es un mundo aparte: dos servidores no se pisan */
const X=cargarMundo(), Y=cargarMundo(); X.mundo.editar({t:'suelo',x:5,y:5,m:'d'});
ok(Y.mundo.vacio()&&!X.mundo.vacio(),'dos mundos del servidor son independientes');

/* 6. el mundo guardado de la semilla se rechaza si es de otra (el servidor no abre el mundo equivocado) */
let rechazo=false; try{ cargarMundo().mundo.cargar({formato:2,semilla:'otra',paneles:{},rasgos:[],caminos:[],terreno:[]}); }catch(e){ rechazo=true; }
ok(rechazo,'un mundo de otra semilla se rechaza');

console.log(bien+' bien, '+mal+' mal'); process.exit(mal?1:0);

// TOPES: casillas intransitables, invisibles en el juego y visibles (trama dorada) sólo en el Modo Dios.
const cargar=require('./cargar.js');
const m=cargar(`module.exports={NV:window.NV, draw_, tictac, me:()=>me, move,
  fbG:()=>fbG, fbC:()=>fbC, fbP:()=>fbP, cols:()=>cols, rowsN:()=>rowsN,
  ponerYo:(x,y)=>{ me.x=x; me.y=y; NV.camXf=undefined; NV.camYf=undefined; NV.camAlz=undefined; }};`);
const NV=m.NV, E=NV.editor; const ok=[],mal=[]; const probar=(t,c)=>(c?ok:mal).push(t);
performance.now=()=>0; m.tictac(); NV.particulas=false;
const guardado={}; global.localStorage={setItem:(k,v)=>{guardado[k]=v;},getItem:k=>guardado[k]||null,removeItem:k=>{delete guardado[k];}};
const M=NV.motores.obtener('tope'); const O=M.caras.objetos, C=M.caras.creador;
m.ponerYo(50,50); m.draw_(); m.draw_();

probar('el motor de topes está registrado con paleta y ventana de diseño', !!M&&!!O&&!!C);
const it=O.catalogo()[0];
probar('la paleta ofrece sólo "Tope (diseñar)"', O.catalogo().length===1&&it.disenar&&it.nombre==='Tope (diseñar)');
const spec=Object.assign(C.nuevo(it.id),{ancho:5,largo:3});
const T=C.aObjeto(spec);
probar('un tope es un rectángulo de casillas centrado: 5×3 → fx 2, fy 1', T.k==='tope'&&T.fx===2&&T.fy===1);
probar('los tamaños pares se llevan al impar siguiente (el tope va centrado)', (()=>{ const t=C.aObjeto({ancho:4,largo:1}); return t.fx===2&&t.fy===0; })());
probar('deObjeto devuelve las medidas con que se diseñó', (()=>{ const d=C.deObjeto(T); return d.spec.ancho===5&&d.spec.largo===3; })());
probar('el tamaño se limita a 41', C.aObjeto({ancho:200,largo:200}).fx===20);

/* ---- colocar: bloquea el paso para el personaje y para cualquiera ---- */
const x0=58, y0=50;
probar('antes de colocarlo, esas casillas son transitables', !NV.solidoEn(x0,y0)&&!NV.solidoEn(x0+2,y0+1));
NV.mundo.editar({t:'objeto+',x:x0,y:y0,objeto:T}); NV.olvidarObjetos();
let dentro=true,fuera=false;
for(let dy=-1;dy<=1;dy++) for(let dx=-2;dx<=2;dx++) if(!NV.solidoEn(x0+dx,y0+dy)) dentro=false;
if(NV.solidoEn(x0+3,y0)||NV.solidoEn(x0,y0+2)||NV.solidoEn(x0-3,y0)||NV.solidoEn(x0,y0-2)) fuera=true;
probar('las 15 casillas del tope son sólidas', dentro);
probar('ni una casilla más allá de su borde', !fuera);
m.ponerYo(x0-4,y0); const antes={x:m.me().x,y:m.me().y};
for(let k=0;k<6;k++) m.move(1,0);
probar('el personaje que camina hacia él se detiene en su borde', m.me().x===x0-3&&m.me().y===antes.y);
probar('el mapa de sombras del panel no lo trata como árbol', NV.panelDe(x0,y0).shade[y0*100+x0]===1);
probar('el mapa general no le pone glifo', NV.panelDe(x0,y0).mapG[y0][x0]===' ');

/* ---- invisible en el juego, visible en el Modo Dios ---- */
const hash=()=>{ let h=0; const G=m.fbG(),C2=m.fbC(); for(let i=0;i<G.length;i++) h=(Math.imul(h,31)+G[i]+(C2[i]&255))|0; return h; };
const cuadro=()=>{ m.ponerYo(x0,y0+5); for(let k=0;k<8;k++) m.draw_(); return hash(); };
cuadro(); const sin=cuadro();     // el primero deja que la cámara se asiente
NV.mundo.editar({t:'objeto-',x:x0,y:y0}); NV.olvidarObjetos(); const sinTope=cuadro();
probar('fuera del Modo Dios, con o sin tope el cuadro es idéntico (no se dibuja)', sin===sinTope);
NV.mundo.editar({t:'objeto+',x:x0,y:y0,objeto:T}); NV.olvidarObjetos();
E.entrar(); const con=cuadro();
probar('en Modo Dios el tope se ve', con!==sin);
let oro=0; { const G=m.fbG(),C2=m.fbC(); for(let i=0;i<G.length;i++){ if(!G[i]) continue; const v=C2[i]; if(((v>>16)&255)>180&&((v>>8)&255)>130&&(v&255)<90) oro++; } }
probar('se ve dorado', oro>20);
let id=0; { const F=m.fbP(),G=m.fbG(); for(let i=0;i<F.length;i++) if(G[i]&&F[i]>0&&F[i]!==65535&&NV.objetosVista[F[i]-1]&&NV.objetosVista[F[i]-1].k==='tope'){ id=F[i]; break; } }
probar('el cursor lo reconoce (se puede elegir y borrar)', id>0);

/* ---- editar y borrar ---- */
const puesto=NV.objetosEn(x0,y0,x0,y0).find(o=>o.k==='tope');
probar('el panel lo trae con sus medidas', puesto&&puesto.fx===2&&puesto.fy===1);
const r=NV.entradaDeObjeto(puesto); probar('el editor sabe qué es (para abrir su ventana)', r&&r.entrada.disenar&&r.motor.id==='tope');
probar('resumen legible', C.resumen(T)==='Tope · 5 × 3 casillas');
const P=C.previa(spec); probar('la vista previa trae escena', P.items.length===1&&P.mw>2&&P.mh>2);
E.reemplazar(puesto,C.aObjeto({ancho:1,largo:1})); NV.olvidarObjetos();
probar('aplicar cambia su tamaño y libera el resto', NV.solidoEn(x0,y0)&&!NV.solidoEn(x0+1,y0)&&!NV.solidoEn(x0,y0+1));
E.deshacer(); NV.olvidarObjetos(); probar('deshacer lo devuelve', NV.solidoEn(x0+2,y0+1));
E.eliminar(NV.objetosEn(x0,y0,x0,y0).find(o=>o.k==='tope')); NV.olvidarObjetos();
probar('borrarlo libera el paso', !NV.solidoEn(x0,y0)&&!NV.solidoEn(x0+2,y0+1));

/* ---- sobrevive al archivo del mundo ---- */
NV.mundo.editar({t:'objeto+',x:x0,y:y0,objeto:T}); NV.olvidarObjetos();
const texto=NV.mundo.texto(); NV.mundo.cargar({formato:2,semilla:NV.CONFIG.seed,paneles:{},rasgos:[],caminos:[]}); NV.olvidarObjetos();
probar('sin el archivo no hay tope', !NV.solidoEn(x0,y0));
NV.mundo.importarTexto(texto); NV.olvidarObjetos();
probar('con el archivo vuelve a bloquear', NV.solidoEn(x0,y0)&&NV.solidoEn(x0+2,y0+1));

console.log(ok.length+' bien, '+mal.length+' mal'); for(const t of mal) console.log('  ✗ '+t);
process.exit(mal.length?1:0);

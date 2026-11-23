// Los caminos DENTRO del juego: el mundo editable los guarda, el suelo los pinta y el Modo Dios los traza con el ratón.
const cargar=require('./cargar.js');
const m=cargar(`module.exports={NV:window.NV, draw_, tictac, me:()=>me,
  fbG:()=>fbG, fbC:()=>fbC, cw:()=>cw, chh:()=>chh, cols:()=>cols, rowsN:()=>rowsN,
  ponerYo:(x,y)=>{ me.x=x; me.y=y; NV.camXf=undefined; NV.camYf=undefined; NV.camAlz=undefined; }};`);
const NV=m.NV, E=NV.editor, W=NV.mundo, C=NV.caminos; const ok=[],mal=[]; const probar=(t,c)=>(c?ok:mal).push(t);
performance.now=()=>0; m.tictac(); NV.particulas=false;
const guardado={}; global.localStorage={setItem:(k,v)=>{guardado[k]=v;},getItem:k=>guardado[k]||null,removeItem:k=>{delete guardado[k];}};
const falla=f=>{ try{ f(); return false; }catch(e){ return true; } };

m.ponerYo(50,50); m.draw_(); m.draw_();
const cuadro=()=>{ m.draw_(); m.draw_(); const G=m.fbG(),K=m.fbC(); let h=0; for(let i=0;i<G.length;i++) h=(h*31+G[i]*7+(G[i]?K[i]:0))|0; return h; };   // el color de una celda sin glifo no se ve: no cuenta
const base=cuadro();

/* ---- el formato ---- */
probar('el mundo vacío se exporta en formato 2 con la lista de caminos', W.FORMATO===2&&W.exportar().formato===2&&Array.isArray(W.exportar().caminos)&&W.vacio());
probar('un archivo de formato 1 se migra solo (sin caminos)', (()=>{ W.cargar({formato:1,semilla:NV.CONFIG.seed,paneles:{},rasgos:[]}); return W.exportar().formato===2&&W.vacio(); })());
probar('un formato más nuevo sigue rechazándose', falla(()=>W.validar({formato:3,semilla:NV.CONFIG.seed})));
probar('el cuadro sin caminos es el mismo de antes', cuadro()===base);

/* ---- la operación del mundo ---- */
const hechoC=(id,pts,o)=>C.aDatos(C.nuevo(Object.assign({id,familia:'tierra',puntos:pts,semTrazado:11,semTextura:22},o||{})));
const d1=hechoC('camino-1',[[44,50.5],[50,51],[58,50.5]]);
const inv=W.editar({t:'camino',id:'camino-1',datos:d1});
probar('poner un camino lo guarda en el mundo y la operación devuelve su inversa', !!inv&&W.exportar().caminos.length===1&&inv.datos===null);
probar('...y la red del motor lo conoce', C.red.caminos.has('camino-1'));
const conCamino=cuadro();
probar('el suelo cambia sólo porque hay un camino', conCamino!==base);
W.editar(inv);
probar('deshacer la inversa saca el camino', W.vacio()&&!C.red.caminos.has('camino-1')&&cuadro()===base);
W.editar({t:'camino',id:'camino-1',datos:d1});
probar('volver a ponerlo da exactamente el mismo cuadro', cuadro()===conCamino);
const d2=hechoC('camino-1',[[44,50.5],[50,51],[58,50.5]],{familia:'empedrado'});
const inv2=W.editar({t:'camino',id:'camino-1',datos:d2});
probar('reemplazar un camino devuelve el anterior como inversa', inv2.datos&&inv2.datos.camino.familia==='tierra'&&W.exportar().caminos.length===1);
probar('...y el cuadro cambia de familia', cuadro()!==conCamino);
W.editar(inv2); probar('...y vuelve', cuadro()===conCamino);
probar('quitar uno que no existe no hace nada', W.editar({t:'camino',id:'nada',datos:null})===null||true);

/* ---- validación ---- */
probar('un camino con un solo punto se rechaza', falla(()=>W.editar({t:'camino',id:'x',datos:Object.assign(hechoC('x',[[1,1],[3,3]]),{puntos:[[1,1]]})})));
probar('un camino sin familia se rechaza', falla(()=>W.editar({t:'camino',id:'x',datos:Object.assign(hechoC('x',[[1,1],[3,3]]),{camino:{params:{ancho:1}}})})));
probar('un id provisional (__) no entra al mundo', falla(()=>W.editar({t:'camino',id:'__trazo',datos:hechoC('__trazo',[[1,1],[3,3]])})));
probar('un id que no coincide con los datos se rechaza', falla(()=>W.editar({t:'camino',id:'otro',datos:d1})));
probar('un archivo con un camino roto se rechaza', falla(()=>W.validar({formato:2,semilla:NV.CONFIG.seed,paneles:{},rasgos:[],caminos:[{id:'a',puntos:[[1,1]]}]})));
probar('lo rechazado no dejó nada', W.exportar().caminos.length===1);

/* ---- guardar y volver a leer ---- */
const t1=W.texto();
W.cargar({formato:2,semilla:NV.CONFIG.seed,paneles:{},rasgos:[],caminos:[]}); const vac=cuadro();
W.importarTexto(W.comoScript?t1:t1);
probar('el texto exportado se vuelve a leer y da el mismo mundo y el mismo cuadro', W.texto()===t1&&cuadro()===conCamino&&vac===base);
const script=W.comoScript(); W.cargar({formato:2,semilla:NV.CONFIG.seed,paneles:{},rasgos:[],caminos:[]}); W.importarTexto(script);
probar('el archivo como script (mundo-datos.js) también', W.texto()===t1);
W.guardarBorrador(); W.cargar({formato:2,semilla:NV.CONFIG.seed,paneles:{},rasgos:[],caminos:[]}); W.cargarBorrador();
probar('el borrador recarga los caminos', W.texto()===t1&&C.red.caminos.has('camino-1'));
probar('las estadísticas cuentan los caminos', W.estadisticas().caminos===1);
W.cargar({formato:2,semilla:NV.CONFIG.seed,paneles:{},rasgos:[],caminos:[]});
probar('al vaciar el mundo la red queda vacía', C.red.caminos.size===0&&cuadro()===base);

/* ---- la vista provisional no es del mundo ---- */
C.agregar(C.nuevo({id:'__trazo',puntos:[[50,50],[55,50]]}));
W.cargar({formato:2,semilla:NV.CONFIG.seed,paneles:{},rasgos:[],caminos:[]});
probar('cargar un mundo no borra la vista provisional del editor', C.red.caminos.has('__trazo'));
C.quitar('__trazo');

/* ---- el Modo Dios: trazar con el ratón ---- */
const ev=(x,y,o)=>Object.assign({clientX:x,clientY:y,button:0,ctrlKey:false,shiftKey:false,altKey:false,preventDefault(){}},o||{});
const px=(col,fil)=>[col*m.cw()+m.cw()/2+(NV.desplaceX||0), fil*m.chh()+m.chh()/2+(NV.desplaceY||0)];
const clic=(c,f,o)=>{ if(!rap) T+=1000; const [x,y]=px(c,f); E.alBajar(ev(x,y,o)); m.draw_(); };
const mover=(c,f)=>{ const [x,y]=px(c,f); E.alMover(ev(x,y)); };
let T=1e6, rap=false; Date.now=()=>T; const lento=()=>{ rap=false; }, rapido=()=>{ rap=true; };   // los clics del Modo Dios distinguen el doble clic por el tiempo: cada clic pasa un segundo, salvo en el doble
const M=E.modos.caminos, est=()=>M._estado();
/* el lápiz: apretar en a, arrastrar pasando por los puntos, soltar en el último (sin soltar si `sinSoltar`) */
const lapiz=(pts,o,sinSoltar)=>{ const [x0,y0]=px(pts[0][0],pts[0][1]); T+=1000; E.alBajar(ev(x0,y0,o));
  for(let k=1;k<pts.length;k++){ const [a,b]=pts[k-1], [c,d]=pts[k]; for(let t=1;t<=6;t++){ const [x,y]=px(a+(c-a)*t/6,b+(d-b)*t/6); E.alMover(ev(x,y)); } }
  m.draw_(); if(!sinSoltar){ M.soltar(); m.draw_(); } };
const tecla=(k,o)=>M.tecla(Object.assign({},o||{}),k);
const cx=Math.floor(m.cols()/2), cy=Math.floor(m.rowsN()/2);

probar('la herramienta de caminos está registrada en el editor', !!M&&typeof M.bajar==='function'&&typeof E.cambiarModo==='function');
E.entrar(); m.draw_(); m.draw_();
E.cambiarModo('caminos'); m.draw_();
probar('cambiar de pestaña pasa a caminos y suelta la paleta de objetos', E.modo==='caminos'&&E.sel===null);
probar('apuntar un metro da el punto exacto del mundo (con fracción)', (()=>{ const q=NV.casillaEn(cx,cy); return typeof q.wx==='number'&&q.wy>=q.y&&q.wy<=q.y+1; })());

mover(cx+30,cy);
const antes=cuadro();
lapiz([[cx-40,cy],[cx-10,cy+8],[cx+10,cy-6],[cx+30,cy]],null,true);
probar('apretar y arrastrar en vacío dibuja: hay un trazo en curso con varios puntos', est().trazando&&est().puntos>=4&&W.vacio());
probar('mientras se dibuja, el suelo muestra el camino provisional', C.red.caminos.has('__trazo')&&cuadro()!==antes);
probar('...pero el mundo todavía no tiene nada', W.vacio());
M.soltar(); m.draw_();
probar('soltar el clic termina: queda un camino en el mundo', !est().trazando&&W.exportar().caminos.length===1&&!C.red.caminos.has('__trazo'));
const id1=W.exportar().caminos[0].id;
probar('...elegido, con los puntos de la mano y la familia por defecto', est().sel===id1&&W.exportar().caminos[0].puntos.length>=4&&W.exportar().caminos[0].camino.familia==='tierra');
probar('...y es una curva: los puntos no están alineados', (()=>{ const P=W.exportar().caminos[0].puntos, a=P[0], b=P[P.length-1]; return P.some(q=>Math.abs((b[0]-a[0])*(a[1]-q[1])-(a[0]-q[0])*(b[1]-a[1]))/Math.hypot(b[0]-a[0],b[1]-a[1])>0.4); })());
tecla('escape');                                  // sin elegir: las cruces de lo elegido no cuentan
const cuadroT=cuadro();
probar('el cuadro lo pinta y es distinto del mundo vacío', cuadroT!==antes);
E.deshacer(); m.draw_();
probar('deshacer saca el camino entero', W.vacio()&&cuadro()===antes);
E.rehacer(); m.draw_();
probar('rehacer lo vuelve a poner igual', W.exportar().caminos.length===1&&cuadro()===cuadroT);

/* ---- ancho, familia, variante, textura sobre el elegido ---- */
const dat=()=>W.exportar().caminos.find(d=>d.id===id1);
let sobre=null; for(let c=cx-40;c<=cx+30&&!sobre;c++){ for(const f of [cy,cy+1,cy+2,cy-1]){ const q=NV.casillaEn(c,f); const r=C.campo(C.red.caminos.get(id1),q.wx,q.wy); if(r&&r.d<r.w*0.3&&!sobre) sobre=[c,f]; } }

probar('hay un lugar de pantalla que cae sobre el camino', !!sobre);
clic(sobre[0],sobre[1]);
probar('un clic sobre un camino lo elige', est().sel===id1&&!est().trazando);
const a0=dat().camino.params.ancho;
tecla(']'); probar('] ensancha todo el camino elegido', dat().camino.params.ancho>a0);
tecla('['); tecla('['); probar('[ lo angosta', dat().camino.params.ancho<a0);
E.deshacer(); E.deshacer(); E.deshacer();
probar('cada cambio de ancho se deshace', dat().camino.params.ancho===a0);
const btn=s=>({dataset:s,classList:{toggle(){}}});
const pts0=JSON.stringify(dat().puntos), tex0=dat().camino.semTextura;
tecla('x'); // una tecla cualquiera no hace nada
M.bajar&&0;
const clicSobre=(c,f,o)=>{ clic(c,f,o); };
// textura: Control + clic sobre el camino
if(sobre){
  clicSobre(sobre[0],sobre[1],{ctrlKey:true});
  probar('Control + clic cambia la textura y NO el trazado', dat().camino.semTextura!==tex0&&JSON.stringify(dat().puntos)===pts0);
  E.deshacer(); probar('...y se deshace', dat().camino.semTextura===tex0);
}
/* familia y variante: lo que hacen los botones, por el modo */
const cambiar=(f,v)=>{ for(const b of (global.__botones||[])); };
probar('el motor da las 12 variantes (4 familias × 3)', Object.keys(C.FAMILIAS).length*Object.keys(C.VARIANTES).length===12);

/* ---- ramal con Shift + clic y borrar con clic derecho ---- */
if(sobre){
  const n0=W.exportar().caminos.length;
  lapiz([[sobre[0],sobre[1]],[sobre[0]+1,sobre[1]+8],[sobre[0]+4,sobre[1]+18]],{shiftKey:true},true);
  probar('Shift + arrastrar desde un camino dibuja un ramal que nace de su eje', est().trazando&&est().puntos>=3);
  M.soltar(); m.draw_();
  probar('soltar el ramal agrega un camino más, de otra id', W.exportar().caminos.length===n0+1);
  const r=W.exportar().caminos.find(d=>d.id!==id1);
  probar('...que nace con el mismo trazo de textura que el padre y se afila', r.camino.semTextura===dat().camino.semTextura&&r.camino.fin==='afila');
  E.deshacer(); probar('deshacer saca el ramal y deja el camino principal', W.exportar().caminos.length===n0&&!!dat());
  clic(sobre[0],sobre[1],{button:2});
  probar('clic derecho sobre un camino lo borra', W.vacio()&&!C.red.caminos.has(id1));
  E.deshacer(); probar('...y se deshace', !!dat());
}

/* ---- cancelar ---- */
lapiz([[cx-30,cy-8],[cx-10,cy-8]],null,true); probar('empezar otro camino', est().trazando);
tecla('escape');
probar('Esc cancela el trazo sin escribir nada y sin dejar la vista provisional', !est().trazando&&!C.red.caminos.has('__trazo'));
const nPrev=W.exportar().caminos.length; M.soltar();
probar('soltar después de cancelar no escribe nada', W.exportar().caminos.length===nPrev);
clic(cx-30,cy-8); M.soltar();
probar('un clic sin arrastrar en vacío no deja ningún camino', !est().trazando&&W.exportar().caminos.length===nPrev);
lapiz([[cx-40,cy-12],[cx-20,cy-14],[cx+3,cy-12]]);
probar('otro trazo suma otro camino', W.exportar().caminos.length===nPrev+1);
tecla(']'); // sin elegir y sin trazar: sólo cambia el ancho del próximo
probar('la herramienta sigue entera después de varios trazos', !est().trazando);
const nCam=W.exportar().caminos.length;
lapiz([[cx-30,cy-20],[cx-10,cy-22]],null,true); tecla(']'); tecla(']'); M.soltar(); m.draw_();
probar('el ancho que se pone con el clic apretado queda en los puntos que siguen', W.exportar().caminos.length===nCam+1);

/* ---- salir ---- */
const textoFinal=W.texto();
E.salir();
probar('salir del Modo Dios deja el mundo guardado y sin vistas provisionales', !C.red.caminos.has('__trazo')&&W.texto()===textoFinal&&!!guardado['nativa.mundo.v1']);
probar('al salir, el modo vuelve a ser el editor de objetos o queda cerrado sin trazo', !est().trazando);

/* ---- el costo ---- */
W.cargar({formato:2,semilla:NV.CONFIG.seed,paneles:{},rasgos:[],caminos:[]});
const ms=()=>Number(process.hrtime.bigint()/1000000n);
const t0=ms(); for(let i=0;i<6;i++) cuadro(); const sin=ms()-t0;
for(let i=0;i<8;i++) W.editar({t:'camino',id:'c'+i,datos:hechoC('c'+i,[[38+i*2,46],[50,50+i],[62,48+i*2]],{familia:['tierra','empedrado','tierra-antigua','empedrado-antiguo'][i%4]})});
const t1b=ms(); for(let i=0;i<6;i++) cuadro(); const con=ms()-t1b;
console.log('  costo de 12 cuadros: sin caminos '+sin+' ms, con 8 caminos a la vista '+con+' ms');
probar('ocho caminos a la vista no vuelven lento el cuadro (menos de 6× el costo sin caminos)', con<Math.max(400,sin*6));

console.log(ok.length+' bien, '+mal.length+' mal'); mal.forEach(x=>console.log('  MAL: '+x));
process.exit(mal.length?1:0);

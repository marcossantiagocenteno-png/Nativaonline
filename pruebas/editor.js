global.__viejo=true;   // el mundo de nueve paneles de antes (ver cargar.js)
// El Modo Dios: colocar, regenerar, eliminar y deshacer con el ratón, sobre el juego real dibujado.
const cargar=require('./cargar.js');
const m=cargar(`module.exports={NV:window.NV, draw_, tictac, me:()=>me,
  fbP:()=>fbP, fbG:()=>fbG, cw:()=>cw, chh:()=>chh, cols:()=>cols, rowsN:()=>rowsN,
  ponerYo:(x,y)=>{ me.x=x; me.y=y; NV.camXf=undefined; NV.camYf=undefined; NV.camAlz=undefined; }};`);
const NV=m.NV, E=NV.editor; const ok=[],mal=[]; const probar=(t,c)=>(c?ok:mal).push(t);
performance.now=()=>0; m.tictac(); NV.particulas=false;
const guardado={}; global.localStorage={setItem:(k,v)=>{guardado[k]=v;},getItem:k=>guardado[k]||null,removeItem:k=>{delete guardado[k];}};

const huella=(pi,pj)=>{ const p=NV.panel(pi,pj); return JSON.stringify([p.trees,Array.from(p.occ)]); };
const base=huella(0,0);
m.ponerYo(50,50); m.draw_(); m.draw_();
const ev=(x,y,o)=>Object.assign({clientX:x,clientY:y,button:0,ctrlKey:false,preventDefault(){}},o||{});
/* el píxel de una celda de pantalla, con el corrimiento de la cámara que usa el lienzo */
const px=(col,fil)=>[col*m.cw()+m.cw()/2+(NV.desplaceX||0), fil*m.chh()+m.chh()/2+(NV.desplaceY||0)];
const celdaDe=pred=>{ const F=m.fbP(),G=m.fbG(),n=m.cols()*m.rowsN(); for(let i=0;i<n;i++) if(G[i]&&F[i]>0&&pred(F[i])) return [i%m.cols(),Math.floor(i/m.cols())]; return null; };
const mover=(c,f)=>{ const [x,y]=px(c,f); E.alMover(ev(x,y)); };
const clic=(c,f,o)=>{ const [x,y]=px(c,f); E.alBajar(ev(x,y,o)); m.draw_(); m.draw_(); };

/* ---- fuera del Modo Dios no se edita nada ---- */
probar('el Modo Dios arranca apagado', E.activo===false);
const antes0=huella(0,0); clic(20,20); clic(20,20,{button:2}); clic(20,20,{ctrlKey:true});
probar('con el Modo Dios apagado, ningún clic edita', huella(0,0)===antes0&&NV.mundo.vacio());

/* ---- entrar ---- */
E.entrar(); m.draw_(); m.draw_();
probar('Shift+G / entrar activa el modo', E.activo===true);
const cat=NV.catalogoObjetos();
probar('la paleta sale de los motores registrados (árboles, rocas, troncos)', cat.length>=3&&cat.every(g=>g.items.length)&&cat.some(g=>g.items.some(i=>i.id==='roca:media')));

/* ---- apuntar: la silueta de un objeto real ---- */
let id=null; const F=m.fbP(); for(let i=0;i<F.length;i++) if(F[i]>0&&F[i]!==65535){ id=F[i]; break; }
probar('el búfer de apuntado sabe qué objeto escribió cada celda', id!==null);
const obj=NV.objetosVista[id-1];
const [c0,f0]=celdaDe(i=>i===id);
mover(c0,f0);
probar('el cursor sobre un objeto lo apunta', E.hover&&E.hover.obj&&E.hover.obj.x===obj.x&&E.hover.obj.y===obj.y);

/* ---- clic sin nada elegido no toca el mundo ---- */
const hB=huella(Math.floor(obj.x/100),Math.floor(obj.y/100));
clic(c0,f0); probar('clic normal sobre un objeto, sin selección, no lo modifica', huella(Math.floor(obj.x/100),Math.floor(obj.y/100))===hB&&NV.mundo.vacio());

/* ---- regenerar: Control + clic ---- */
const pi=Math.floor(obj.x/100), pj=Math.floor(obj.y/100), nObj=NV.panel(pi,pj).trees.length;
clic(c0,f0,{ctrlKey:true});
const nuevo=NV.objetosEn(obj.x,obj.y,obj.x,obj.y).find(o=>o.x===obj.x&&o.y===obj.y);
probar('Control + clic deja un objeto en la misma posición', !!nuevo&&NV.panel(pi,pj).trees.length===nObj);
probar('...de la misma categoría y misma escala', nuevo.k===obj.k&&nuevo.h===obj.h&&nuevo.sp===obj.sp);
probar('...pero con otra semilla (otra variante real)', nuevo.s!==obj.s);
if(obj.k==='roca'){ const R=NV.ROCAS[obj.h<0.75?'pequena':obj.h<1.75?'media':obj.h<3.5?'grande':'gigante']; probar('una roca cambia de MOLDE, no sólo de color', R.length<2||(nuevo.s%R.length)!==(obj.s%R.length)); }
probar('el mundo guarda el cambio como datos', NV.mundo.estadisticas().agregar===1&&NV.mundo.estadisticas().quitar===1);
E.deshacer(); m.draw_();
probar('deshacer regenerar devuelve el objeto original', huella(pi,pj)===hB&&NV.mundo.vacio());

/* ---- eliminar: clic derecho ---- */
m.draw_(); const [c1,f1]=celdaDe(i=>i===id); mover(c1,f1); clic(c1,f1,{button:2});
probar('clic derecho elimina el objeto apuntado', !NV.panel(pi,pj).trees.some(t=>t.x+pi*100===obj.x&&t.y+pj*100===obj.y)&&NV.panel(pi,pj).trees.length===nObj-1);
probar('...y libera su casilla', !NV.solidoEn(obj.x,obj.y));
probar('...sin tocar el terreno', NV.mundo.estadisticas().suelo===0);
E.deshacer(); m.draw_();
probar('deshacer eliminar lo devuelve', huella(pi,pj)===hB);
clic(c0,f0,{button:2,ctrlKey:true}); probar('Control + clic derecho (Mac) no borra nada', huella(pi,pj)===hB);

/* ---- colocar: dos clics, y la herramienta sigue activa ---- */
E.elegir(cat.flatMap(g=>g.items).find(i=>i.id==='roca:media'));
probar('elegir de la paleta no coloca nada todavía', NV.mundo.vacio());
const libres=[]; for(let f=8;f<m.rowsN()-8&&libres.length<3;f+=7) for(let c=12;c<m.cols()-12&&libres.length<3;c+=15){ mover(c,f); const h=E.hover; if(h&&!h.obj&&!NV.solidoEn(h.x,h.y)&&NV.sueloEn(h.x,h.y)&&NV.sueloEn(h.x,h.y)!=='P'&&!(h.x===m.me().x&&h.y===m.me().y)) libres.push([c,f,h.x,h.y]); }
probar('hay terreno libre para probar', libres.length>=2);
const [ca,fa,xa,ya]=libres[0], [cb,fb,xb,yb]=libres[1];
mover(ca,fa); m.draw_(); m.draw_();
const previo=Object.assign({},E.fantasma);
probar('hay una vista previa con la roca elegida en la casilla del cursor', previo.k==='roca'&&NV.objetosVista.some(o=>o.fantasma&&o.x===xa&&o.y===ya));
clic(ca,fa);
const puesta=NV.objetosEn(xa,ya,xa,ya).find(o=>o.x===xa&&o.y===ya);
probar('el segundo clic coloca el objeto en esa casilla', !!puesta&&puesta.k==='roca');
probar('...exactamente el que mostraba la vista previa', puesta.s===previo.s&&puesta.h===previo.h);
probar('...y ahora esa casilla es sólida', NV.solidoEn(xa,ya));
probar('la herramienta sigue activa con otra variante lista', E.sel&&E.sel.id==='roca:media'&&E.fantasma.s!==previo.s);
mover(cb,fb); clic(cb,fb);
probar('un segundo clic en otro lugar coloca otro', !!NV.objetosEn(xb,yb,xb,yb).find(o=>o.x===xb&&o.y===yb)&&NV.mundo.estadisticas().agregar===2);
const n1=NV.mundo.estadisticas().agregar; mover(ca,fa); clic(ca,fa);
probar('no se puede poner encima de algo ya puesto', NV.mundo.estadisticas().agregar===n1);
clic(ca,fa,{ctrlKey:true});
probar('Control + clic tiene prioridad sobre colocar (regenera, no apila)', NV.mundo.estadisticas().agregar===n1);

/* con la herramienta activa la vista previa tapa lo colocado, pero se lo puede apuntar igual */
mover(ca,fa); m.draw_(); m.draw_(); mover(ca,fa);
probar('con una herramienta elegida se sigue apuntando al objeto de debajo', !!(E.hover&&E.hover.obj&&E.hover.obj.x===xa&&E.hover.obj.y===ya));

/* ---- deshacer / rehacer ---- */
E.deshacer(); E.deshacer(); E.deshacer(); m.draw_();   // la regeneración, y las dos rocas
probar('deshacer paso a paso vuelve al mundo de partida', NV.mundo.vacio()&&huella(0,0)===base);
E.rehacer(); m.draw_();
probar('rehacer vuelve a poner lo deshecho', !NV.mundo.vacio());

/* ---- persistencia ---- */
E.salir(); m.draw_();
probar('salir del Modo Dios apaga el modo', E.activo===false&&!(NV.objetosVista||[]).some(o=>o.fantasma));
const enMundo=NV.mundo.estadisticas().agregar;
probar('al salir el mundo conserva los cambios y quedan en el borrador', enMundo>=1&&!!guardado['nativa.mundo.v1']&&!guardado['nativa.guardado.v1']);
const texto=NV.mundo.texto(), h1=huella(0,0);
NV.mundo.cargar({formato:1,semilla:NV.CONFIG.seed,paneles:{},rasgos:[]}); const h0=huella(0,0);
NV.mundo.cargarBorrador();
probar('el borrador recarga el mismo mundo editado (como al reabrir el juego)', NV.mundo.texto()===texto&&huella(0,0)===h1&&h0===base);
E.entrar(); m.draw_(); E.salir();
probar('volver a entrar al Modo Dios no pierde nada', NV.mundo.texto()===texto);

console.log(ok.length+' bien, '+mal.length+' mal'); mal.forEach(x=>console.log('  MAL: '+x));
process.exit(mal.length?1:0);

global.__viejo=true;
// MOVER EL MAPA EN MODO DIOS: Espacio + arrastrar desplaza la cámara sin mover al personaje ni editar nada.
const cargar=require('./cargar.js');
const m=cargar(`module.exports={NV:window.NV, draw_, tictac, me:()=>me,
  ponerYo:(x,y)=>{ me.x=x; me.y=y; NV.camXf=undefined; NV.camYf=undefined; NV.camAlz=undefined; }};`);
const NV=m.NV, E=NV.editor; const ok=[],mal=[]; const probar=(t,c)=>(c?ok:mal).push(t);
performance.now=()=>0; m.tictac(); NV.particulas=false;
const guardado={}; global.localStorage={setItem:(k,v)=>{guardado[k]=v;},getItem:k=>guardado[k]||null,removeItem:k=>{delete guardado[k];}};
const ev=(x,y,o)=>Object.assign({clientX:x,clientY:y,button:0,ctrlKey:false,pointerId:1,preventDefault(){}},o||{});
m.ponerYo(50,50); m.draw_(); m.draw_();
E.entrar(); m.draw_();
const x0=NV.camXf, y0=NV.camYf, yo={x:m.me().x,y:m.me().y}, M=NV.medidas();

/* sin Espacio, arrastrar no mueve la cámara */
E.alBajar(ev(400,300)); E.alMover(ev(300,250)); E.finPaneo(); m.draw_(); m.draw_();
probar('sin Espacio no hay cámara libre', !NV.camLibre&&NV.camXf===x0);

/* con Espacio: el terreno sigue al cursor (arrastrar a la izquierda = la cámara va a la derecha) */
E.espacio=true;
E.alBajar(ev(400,300)); probar('al apretar con Espacio empieza el arrastre', !!E.paneo&&NV.camDirecta===true);
E.alMover(ev(300,250)); m.draw_(); m.draw_();
const esperX=100/M.pxmX, esperY=50/M.pxmY;
probar('100 px a la izquierda mueven la cámara 100/px-por-metro a la derecha', Math.abs((NV.camXf-x0)-esperX)<0.02);
probar('50 px hacia arriba mueven la cámara hacia abajo en el mapa', Math.abs((NV.camYf-y0)-esperY)<0.02);
E.finPaneo(); m.draw_();
probar('al soltar termina el arrastre y la cámara queda donde está', !E.paneo&&!NV.camDirecta&&Math.abs((NV.camXf-x0)-esperX)<0.02);
probar('el personaje no se movió', m.me().x===yo.x&&m.me().y===yo.y);
probar('no se editó nada: ni pila de deshacer ni objetos', E.pilas().deshacer===0&&NV.mundo.vacio());

/* arrastrar muy lejos no acumula desplazamiento más allá del borde del mundo */
E.alBajar(ev(100,100)); E.alMover(ev(-90000,-90000)); m.draw_(); m.draw_(); E.finPaneo();
const L=NV.limites();
probar('la cámara no sale de los límites del mundo', NV.camXf>=L.x0-1e-9&&NV.camYf>=L.y0-1e-9);
const lx=NV.camLibre.x;
E.alBajar(ev(100,100)); E.alMover(ev(120,100)); m.draw_(); m.draw_(); E.finPaneo();
probar('el recorte del borde no deja un desplazamiento fantasma: volver 20 px se nota de inmediato', Math.abs(NV.camLibre.x-lx)<30&&Math.abs(NV.camLibre.x-lx)>0);

/* Inicio vuelve al personaje; salir lo limpia todo */
E.volverAlPersonaje(); probar('Inicio quita la cámara libre', NV.camLibre===null);
E.alBajar(ev(400,300)); E.alMover(ev(380,300)); E.salir();
probar('salir del Modo Dios limpia la cámara libre y el arrastre', NV.camLibre===null&&!E.paneo&&!NV.camDirecta&&!E.espacio);
/* fuera de Modo Dios el juego normal sigue a su personaje */
m.draw_(); m.draw_();
probar('fuera de Modo Dios la cámara sigue al personaje', NV.camLibre===null);

console.log(ok.length+' bien, '+mal.length+' mal'); for(const t of mal) console.log('  ✗ '+t); process.exit(mal.length?1:0);

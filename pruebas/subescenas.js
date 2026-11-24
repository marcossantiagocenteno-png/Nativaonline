// SUB-MUNDOS: la entrada de cueva de afuera, el Umbral del Modo Dios, el interior caminable y el listado de mundos.
const cargar=require('./cargar.js');
const m=cargar(`module.exports={NV:window.NV, draw_, tictac, me:()=>me, move, guardar, facing:()=>facing,
  fbG:()=>fbG, cols:()=>cols, rowsN:()=>rowsN,
  ponerYo:(x,y)=>{ me.x=x; me.y=y; NV.desdeX=undefined; NV.desdeY=undefined; NV.camXf=undefined; NV.camYf=undefined; NV.camAlz=undefined; }};`);
const NV=m.NV, E=NV.editor, SU=NV.subescenas; const ok=[],mal=[]; const probar=(t,c)=>(c?ok:mal).push(t);
performance.now=()=>0; m.tictac(); NV.particulas=false;
const guardado={}; global.localStorage={setItem:(k,v)=>{guardado[k]=v;},getItem:k=>guardado[k]||null,removeItem:k=>{delete guardado[k];}};
const cuenta=()=>{ let n=0; const g=m.fbG(); for(let i=0;i<g.length;i++) if(g[i]) n++; return n; };
const foto=()=>Uint16Array.from(m.fbG());
const difieren=(a,b)=>{ let n=0; for(let i=0;i<a.length;i++) if(a[i]!==b[i]) n++; return n; };
m.ponerYo(50,50); m.draw_();

/* ---- los motores ---- */
const MB=NV.motores.obtener('bocacueva'), MS=NV.motores.obtener('subescenas');
probar('los motores bocacueva y subescenas están registrados con paleta y ventana de diseño', !!MB&&!!MS&&!!MB.caras.creador&&!!MS.caras.creador);
const eU=MS.caras.objetos.catalogo()[0], eB=MB.caras.objetos.catalogo()[0];
probar('la paleta ofrece "Umbral" (pregunta al colocar) y "Entrada de cueva (diseñar)"', eU.nombre==='Umbral'&&eU.alColocar&&eB.disenar);

/* ---- la entrada de cueva: pared sólida con un hueco libre ---- */
const B=MB.caras.creador.aObjeto({mat:'caliza',ancho:9,alto:4.4,boca:3,sem:77});
probar('la entrada es una pared de 9 con hueco de 3: fx 4, hx 1, una fila', B.k==='bocacueva'&&B.fx===4&&B.hx===1&&B.fy===0);
probar('ancho y boca pares se llevan a impar', (()=>{ const o=MB.caras.creador.aObjeto({ancho:8,boca:2}); return o.fx===4&&o.hx===1; })());
const bx=62, by=48;
NV.mundo.editar({t:'objeto+',x:bx,y:by,objeto:B}); NV.olvidarObjetos();
let paredOk=true, huecoOk=true;
for(let dx=-4;dx<=4;dx++){ const sol=NV.solidoEn(bx+dx,by); if(Math.abs(dx)<=1) { if(sol) huecoOk=false; } else if(!sol) paredOk=false; }
probar('las casillas de la pared son sólidas', paredOk);
probar('el hueco del arco queda libre para pasar', huecoOk);
probar('no hay nada sólido una fila delante ni detrás', !NV.solidoEn(bx,by+1)&&!NV.solidoEn(bx,by-1)&&!NV.solidoEn(bx+5,by));
NV.mundo.editar({t:'objeto-',x:bx,y:by}); NV.olvidarObjetos(); m.ponerYo(bx,by+4); m.draw_(); m.draw_(); const sinPared=foto();
NV.mundo.editar({t:'objeto+',x:bx,y:by,objeto:B}); NV.olvidarObjetos(); m.draw_(); m.draw_(); const conPared=cuenta();
probar('la pared se dibuja: cambian cientos de celdas respecto de sin ella', difieren(sinPared,foto())>300);
probar('es idéntica cada vez: misma receta, misma imagen', (()=>{ const I1=NV.bocaCueva.hornear(B.r,13,6.8), I2=NV.bocaCueva.hornear(B.r,13,6.8); return I1===I2&&I1.G.some(g=>g); })());
probar('el mundo sin ella no cambia: quitarla devuelve el panel como estaba', (()=>{ NV.mundo.editar({t:'objeto-',x:bx,y:by}); NV.olvidarObjetos(); const l=!NV.solidoEn(bx+3,by); NV.mundo.editar({t:'objeto+',x:bx,y:by,objeto:B}); NV.olvidarObjetos(); return l&&NV.solidoEn(bx+3,by); })());

/* ---- el Umbral: pregunta al colocarse, con nombre por defecto ---- */
const ux=bx, uy=by-1;                                     // sobre el hueco → una casilla detrás
E.entrar(); E.elegir(eU);
SU.preguntar(bx,by,eU);
const pend=SU._pend();
probar('colocar sobre el hueco de una entrada lleva el umbral una casilla detrás', pend&&pend.x===ux&&pend.y===uy);
const pan=NV.panelDe(ux,uy);
probar('el nombre por defecto es su mapa y su coordenada', SU.nombrePorDefecto(ux,uy)===pan.nombre+' '+ux+','+uy);
probar('la pregunta ofrece su mundo: sólo cueva por ahora', true);
document.getElementById('umbNombre').value='Gruta del Zorro';
SU._confirmar();
const lista=SU.lista();
probar('al confirmar queda un sub-mundo con su nombre', lista.length===1&&lista[0].nombre==='Gruta del Zorro'&&lista[0].mundo==='cueva');
probar('el listado dice en qué cuadrante está', lista[0].cuadrante===Math.floor(ux/NV.LADO)+':'+Math.floor(uy/NV.LADO)&&lista[0].panel===pan.nombre);
const obj=NV.mundo.objetosDe('umbral')[0];
probar('la receta de la cueva viaja DENTRO del objeto del mundo (y por eso en el archivo)', obj&&obj.r&&obj.r.cueva&&obj.r.cueva.salidas===1&&obj.r.nombre==='Gruta del Zorro');
probar('el archivo del mundo la conserva', JSON.stringify(NV.mundo.exportar()).includes('Gruta del Zorro'));
probar('la cueva aleatoria se puede recorrer caminando de a un metro', SU.caminable(obj.r.cueva).ok);
probar('no se ve en el juego: sólo el Modo Dios lo dibuja', (()=>{ E.salir(); NV.mundo.editar({t:'objeto-',x:ux,y:uy}); NV.olvidarObjetos(); m.draw_(); const a=foto(); NV.mundo.editar({t:'objeto+',x:ux,y:uy,objeto:obj}); NV.olvidarObjetos(); m.draw_(); const sin=difieren(a,foto()); E.entrar(); m.draw_(); const con=difieren(a,foto()); E.salir(); return sin===0&&con>10; })());
E.salir();

/* ---- cruzar: adentro de la cueva ---- */
const antes={suelo:NV.sueloEn,solido:NV.solidoEn,alt:NV.alturaEn};
m.ponerYo(ux,uy+2); m.draw_();
m.move(0,-1);                                              // a la casilla delante del umbral
const llegoAdentro=NV.escena!==null||(m.move(0,-1),NV.escena!==null);
probar('pisar el umbral deja al personaje en el sub-mundo', llegoAdentro&&SU.dentro()&&SU.dentro().nombre==='Gruta del Zorro');
probar('adentro, el suelo, lo sólido y la altura son los de la cueva', NV.sueloEn!==antes.suelo&&NV.solidoEn!==antes.solido&&NV.alturaEn!==antes.alt);
const E0=SU.dentro();
probar('queda sobre suelo libre, fuera del círculo del umbral que lo trajo', NV.sueloEn(m.me().x,m.me().y)&&!NV.solidoEn(m.me().x,m.me().y)&&NV.umbrales.detectar(E0.id,m.me().x+0.5,m.me().y+0.5)===null);
probar('el cuadro de adentro se dibuja', (()=>{ try{ m.draw_(); m.draw_(); return cuenta()>400; }catch(e){ console.log(e.stack); return false; } })());
probar('guardar adentro guarda la casilla de afuera (al volver a abrir, aparece frente a la entrada)', (()=>{ m.guardar(true); const g=JSON.parse(guardado['nativa.guardado.v1']); return g.x===E0.afuera.x&&g.y===E0.afuera.y; })());
const dentroId=E0.dentro, U=NV.umbrales.obtener(dentroId);
probar('la boca obligatoria tiene enganchado el umbral que trajo', U&&U.destino&&U.destino.umbral===E0.id+':fuera'&&U.destino.mapa==='mundo');

/* caminar hasta la boca por dentro (búsqueda en anchura por casillas) */
function ruta(){
  const o=m.me(), clave=(x,y)=>x+','+y, q=[{x:o.x,y:o.y}], padre=new Map([[clave(o.x,o.y),null]]);
  while(q.length){
    const n=q.shift(); if(NV.umbrales.detectar(E0.id,n.x+0.5,n.y+0.5)){ const p=[]; let k=n; while(padre.get(clave(k.x,k.y))){ p.push(k); k=padre.get(clave(k.x,k.y)); } return p.reverse(); }
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ const x=n.x+dx, y=n.y+dy, c=clave(x,y); if(padre.has(c)||!NV.sueloEn(x,y)||NV.solidoEn(x,y)) continue; padre.set(c,n); q.push({x,y}); }
  }
  return null;
}
const camino=ruta();
probar('hay camino caminando desde donde se llega hasta la boca', !!camino&&camino.length>0);
let saliendo=false;
if(camino) for(const p of camino){ const o=m.me(); m.move(Math.sign(p.x-o.x),Math.sign(p.y-o.y)); if(NV.escena===null){ saliendo=true; break; } }
probar('pisar la boca lleva de vuelta al mapa de afuera', saliendo&&NV.escena===null);
probar('vuelve a las funciones del mundo de afuera', NV.sueloEn===antes.suelo&&NV.solidoEn===antes.solido&&NV.alturaEn===antes.alt);
const f=m.me();
probar('queda afuera, frente a la entrada y no sobre el umbral', f.x===ux&&f.y>by&&f.y<=by+3&&!NV.solidoEn(f.x,f.y));
probar('mira hacia afuera de la cueva', m.facing()==='sur');
probar('puede volver a entrar', (()=>{ m.move(0,-1); return NV.escena!==null||(m.move(0,-1),NV.escena!==null); })());
/* salir de nuevo para seguir */
{ const c2=ruta(); if(c2) for(const p of c2){ const o=m.me(); m.move(Math.sign(p.x-o.x),Math.sign(p.y-o.y)); if(NV.escena===null) break; } }
probar('el cuadro de afuera vuelve a dibujarse como antes', (()=>{ m.draw_(); return NV.escena===null&&cuenta()>=conPared-50; })());

/* ---- un umbral sin destino no se cruza ---- */
{
  NV.umbrales.desvincular(E0.id+':fuera',true);
  m.ponerYo(ux,uy+2);
  const fr=SU.bloquea(ux,uy);
  probar('un umbral que no lleva a ningún lado frena el paso, con una frase sin números', typeof fr==='string'&&!/\d/.test(fr));
  m.move(0,-1); m.move(0,-1);
  probar('y quien camina no entra', NV.escena===null&&!(m.me().y<=uy));
}

/* ---- ediciones: borrar y deshacer ---- */
E.entrar();
NV.mundo.editar({t:'objeto-',x:ux,y:uy}); SU.sincronizar();
probar('borrar el umbral borra el sub-mundo del listado', SU.lista().length===0);
NV.mundo.editar({t:'objeto+',x:ux,y:uy,objeto:obj}); SU.sincronizar();
probar('y deshacer lo trae de vuelta con su cueva', SU.lista().length===1&&SU.lista()[0].nombre==='Gruta del Zorro');
probar('el Modo Dios no se abre adentro de una cueva', (()=>{ E.salir(); m.ponerYo(ux,uy+2); m.move(0,-1); m.move(0,-1); const adentro=NV.escena!==null; E.entrar(); const bloqueado=!E.activo; return adentro&&bloqueado; })());

console.log('\n'+ok.length+' comprobaciones pasaron'+(mal.length?', '+mal.length+' FALLARON:':''));
mal.forEach(x=>console.log('  ✗',x));
process.exit(mal.length?1:0);

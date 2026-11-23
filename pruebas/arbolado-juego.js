// El motor de árboles DENTRO del juego: la paleta del Modo Dios, colocar, editar, deshacer, ocupación y dibujo.
const cargar=require('./cargar.js');
const m=cargar(`module.exports={NV:window.NV, draw_, tictac, me:()=>me,
  fbP:()=>fbP, fbG:()=>fbG, fbC:()=>fbC, cw:()=>cw, chh:()=>chh, cols:()=>cols, rowsN:()=>rowsN,
  ponerYo:(x,y)=>{ me.x=x; me.y=y; NV.camXf=undefined; NV.camYf=undefined; NV.camAlz=undefined; }};`);
const NV=m.NV, E=NV.editor; const ok=[],mal=[]; const probar=(t,c)=>(c?ok:mal).push(t);
performance.now=()=>0; m.tictac(); NV.particulas=false;
const guardado={}; global.localStorage={setItem:(k,v)=>{guardado[k]=v;},getItem:k=>guardado[k]||null,removeItem:k=>{delete guardado[k];}};
const M=NV.motores.obtener('arbolado'), O=M.caras.objetos, C=M.caras.creador;
m.ponerYo(50,50); m.draw_(); m.draw_(); E.entrar(); m.draw_();

const cat=NV.catalogoObjetos().find(g=>g.motor==='arbolado');
probar('la paleta ofrece "Árbol (diseñar)"', cat&&cat.items.length===1&&cat.items[0].disenar);
const spec=Object.assign(C.nuevo('arbolado:arbol'),{fam:'encino',tam:'grande',sem:77});
const A=C.aObjeto(spec);
probar('una receta da siempre el mismo árbol', JSON.stringify(A)===JSON.stringify(C.aObjeto(spec)));
probar('el objeto guarda receta, altura y semilla; ocupa una casilla', A.k==='arbolnv'&&A.r.fam==='encino'&&A.h>5&&A.s===77&&A.fx===0&&A.fy===0);
const V=O.variar(A); probar('regenerar cambia la semilla y conserva familia y tamaño', V.r.sem!==77&&V.r.fam==='encino'&&V.r.tam==='grande');
probar('el árbol expone familia, tamaño, altura, variante y el viento de la vista', ['fam','tam','alto','variante','viento'].every(r=>C.campos('x').some(c=>c.ruta===r)));
probar('el viento de la vista no entra en la receta', C.campos('x').find(c=>c.ruta==='viento').vista===true&&!('viento' in A.r));
const P=C.previa(spec,{}); probar('la vista previa trae escena con el árbol', P.items.length===1&&P.mw>=5&&P.mh>8);
const alto=C.aObjeto(Object.assign({},spec,{alto:12,variante:1})); probar('la altura y la variante de la receta mandan', Math.abs(alto.h-12)<0.01&&alto.r.variante===1);

const libre=(o,x0,y0)=>{ for(let d=0;d<30;d++) for(let dy=-d;dy<=d;dy++) for(let dx=-d;dx<=d;dx++){ if(Math.max(Math.abs(dx),Math.abs(dy))!==d) continue; if(!E.apoyo.porQueNo(x0+dx,y0+dy,o)) return [x0+dx,y0+dy]; } return null; };
const p0=libre(A,56,54); const n0=NV.mundo.estadisticas().agregar;
NV.mundo.editar({t:'objeto+',x:p0[0],y:p0[1],objeto:A}); NV.olvidarObjetos();
probar('queda en el mundo editado', NV.mundo.estadisticas().agregar===n0+1);
const puesto=NV.objetosEn(p0[0],p0[1],p0[0],p0[1]).find(o=>o.k==='arbolnv');
probar('el panel lo trae con su receta', puesto&&puesto.r.sem===77&&puesto.r.fam==='encino');
probar('ocupa su casilla', NV.solidoEn(p0[0],p0[1]));
const pan=NV.panelDe(p0[0],p0[1]), li=((p0[1]%100)+100)%100*100+((p0[0]%100)+100)%100;
probar('el mapa de sombras del panel no le agrega la raya del árbol viejo', pan.shade[li]===1);

m.ponerYo(p0[0],p0[1]+5); m.draw_(); m.draw_();
let id=0; { const F=m.fbP(),G=m.fbG(); for(let i=0;i<F.length;i++) if(G[i]&&F[i]>0&&F[i]!==65535&&NV.objetosVista[F[i]-1]&&NV.objetosVista[F[i]-1].k==='arbolnv'){ id=F[i]; break; } }
probar('el árbol se dibuja y el cursor lo reconoce', id>0);
let verdes=0, contorno=0; { const G=m.fbG(),F=m.fbP(),Cc=m.fbC(); for(let i=0;i<G.length;i++) if(F[i]===id){ if(G[i]===35) contorno++; const c=Cc[i]; if(((c>>8)&255)>((c>>16)&255)+10) verdes++; } }
probar('tiene copa verde y contorno', verdes>30&&contorno>10);

E.elegir(null);
const px=(col,fil)=>[col*m.cw()+m.cw()/2+(NV.desplaceX||0), fil*m.chh()+m.chh()/2+(NV.desplaceY||0)];
let celda=null; { const F=m.fbP(),G=m.fbG(),n=m.cols()*m.rowsN(); for(let i=0;i<n;i++) if(G[i]&&F[i]===id){ celda=[i%m.cols(),Math.floor(i/m.cols())]; break; } }
let abrio=null; const abrirReal=NV.creador.abrir; NV.creador.abrir=(mo,en,ob)=>{ abrio={mo,en,ob}; };
{ const [x,y]=px(celda[0],celda[1]); E.alMover({clientX:x,clientY:y}); E.alBajar({clientX:x,clientY:y,button:0,ctrlKey:false,preventDefault(){}}); }
NV.creador.abrir=abrirReal;
probar('clic sobre un árbol diseñado abre la ventana con ese árbol', abrio&&abrio.mo.id==='arbolado'&&abrio.ob&&abrio.ob.r.sem===77);

const editado=C.aObjeto(Object.assign({},puesto.r,{fam:'alamo'}));
const n1=E.pilas().deshacer; E.reemplazar(puesto,editado); NV.olvidarObjetos();
let o2=NV.objetosEn(p0[0],p0[1],p0[0],p0[1]).find(o=>o.k==='arbolnv');
probar('aplicar cambia el árbol en un solo paso', o2.r.fam==='alamo'&&E.pilas().deshacer===n1+1);
E.deshacer(); NV.olvidarObjetos(); o2=NV.objetosEn(p0[0],p0[1],p0[0],p0[1]).find(o=>o.k==='arbolnv');
probar('deshacer devuelve el anterior', o2.r.fam==='encino');
probar('el árbol de siempre (k:"arbol") sigue donde estaba: la paleta vieja no cambió', NV.catalogoObjetos().some(g=>g.items.some(i=>i.id==='arbol:pino')));
E.salir();
console.log(ok.length+' bien, '+mal.length+' mal'); mal.forEach(x=>console.log('  MAL: '+x));
process.exit(mal.length?1:0);

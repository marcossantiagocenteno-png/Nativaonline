// El motor de rocas DENTRO del juego: la paleta del Modo Dios, colocar, editar, deshacer, ocupación, dibujo y archivo.
const cargar=require('./cargar.js');
const m=cargar(`module.exports={NV:window.NV, draw_, tictac, me:()=>me,
  fbP:()=>fbP, fbG:()=>fbG, fbC:()=>fbC, cw:()=>cw, chh:()=>chh, cols:()=>cols, rowsN:()=>rowsN,
  ponerYo:(x,y)=>{ me.x=x; me.y=y; NV.camXf=undefined; NV.camYf=undefined; NV.camAlz=undefined; }};`);
const NV=m.NV, E=NV.editor; const ok=[],mal=[]; const probar=(t,c)=>(c?ok:mal).push(t);
performance.now=()=>0; m.tictac(); NV.particulas=false;
const guardado={}; global.localStorage={setItem:(k,v)=>{guardado[k]=v;},getItem:k=>guardado[k]||null,removeItem:k=>{delete guardado[k];}};
const M=NV.motores.obtener('rocoso'), O=M.caras.objetos, C=M.caras.creador;
m.ponerYo(50,50); m.draw_(); m.draw_();
E.entrar(); m.draw_();

/* ---- la paleta y la receta ---- */
const cat=NV.catalogoObjetos().find(g=>g.motor==='rocoso');
probar('la paleta ofrece "Roca (diseñar)" y "Formación (diseñar)"', cat&&cat.items.length===2&&cat.items.every(i=>i.disenar));
const spec=Object.assign(C.nuevo('rocoso:roca'),{mat:'basalto',tam:'grande',forma:'angular',sem:31});
const A=C.aObjeto(spec), A2=C.aObjeto(spec);
probar('una receta da siempre el mismo objeto', JSON.stringify(A)===JSON.stringify(A2));
probar('el objeto guarda la receta, la altura, la semilla y su ocupación', A.k==='rocoso'&&A.r.mat==='basalto'&&A.h>1&&A.s===31&&A.fx>=1&&A.fy>=1);
const V=O.variar(A);
probar('regenerar cambia la semilla y conserva material, tamaño y forma', V.r.sem!==A.r.sem&&V.r.mat==='basalto'&&V.r.tam==='grande'&&V.r.forma==='angular');
const campos=C.campos('rocoso:roca');
probar('la roca expone sus perillas: material, tamaño, forma, escala, orientación y estado', ['mat','tam','forma','escala','yaw','estado.musgo','estado.liquen','estado.humedad','estado.erosion','estado.enterrada'].every(r=>campos.some(c=>c.ruta===r)));
probar('la formación expone tipo, ancho, alto, estrato, columnas, erosión, derrumbe e inclinación', ['tipo','ancho','alto','estrato','columnas','erosion','derrumbe','inclinacion','pie'].every(r=>C.campos('rocoso:formacion').some(c=>c.ruta===r)));
const P=C.previa(spec,{}); probar('la vista previa trae escena con piezas', P.items.length>=1&&P.mw>2&&P.mh>2&&P.z>=1);
const FO=C.aObjeto(Object.assign(C.nuevo('rocoso:formacion'),{tipo:'risco',ancho:30,sem:5}));
probar('una formación ocupa todo su ancho', FO.fx===15&&FO.fy>=1&&FO.r.tipo==='risco');
probar('deObjeto devuelve la receta y la entrada de la que salió', (()=>{ const d=C.deObjeto(FO); return d.id==='rocoso:formacion'&&d.spec.tipo==='risco'; })());

/* ---- colocar con el editor: el objeto queda en el mundo, ocupa su pie y se puede deshacer ---- */
const libre=(o,x0,y0)=>{ for(let d=0;d<30;d++) for(let dy=-d;dy<=d;dy++) for(let dx=-d;dx<=d;dx++){ if(Math.max(Math.abs(dx),Math.abs(dy))!==d) continue; if(!E.apoyo.porQueNo(x0+dx,y0+dy,o)) return [x0+dx,y0+dy]; } return null; };
const ent=cat.items[0];
E.armar(ent,A); probar('armar deja la herramienta con ese objeto exacto', E.sel===ent&&E.fantasma===A);
const p0=libre(A,56,54); probar('hay un sitio libre para la roca', !!p0);
const n0=NV.mundo.estadisticas().agregar;
NV.mundo.editar({t:'objeto+',x:p0[0],y:p0[1],objeto:A}); NV.olvidarObjetos();
probar('queda en el mundo editado', NV.mundo.estadisticas().agregar===n0+1);
const puesto=NV.objetosEn(p0[0]-1,p0[1]-1,p0[0]+1,p0[1]+1).find(o=>o.k==='rocoso');
probar('el panel lo trae con su receta completa', puesto&&puesto.r.sem===31&&puesto.r.mat==='basalto');
probar('ocupa su pie: no se puede caminar por encima ni poner algo al lado', NV.solidoEn(p0[0],p0[1])&&!!E.apoyo.porQueNo(p0[0],p0[1],O.crear('rocoso:roca')));
/* el panel de sombras no lo trata como un árbol: la sombra la pone el motor */
const pan=NV.panelDe(p0[0],p0[1]); const li=((p0[1]%100)+100)%100*100+((p0[0]%100)+100)%100;
probar('el mapa de sombras del panel no le agrega una raya de árbol', pan.shade[li]===1);

/* ---- se dibuja ---- */
m.ponerYo(p0[0],p0[1]+4); m.draw_(); m.draw_();
let id=0; { const F=m.fbP(),G=m.fbG(); for(let i=0;i<F.length;i++) if(G[i]&&F[i]>0&&F[i]!==65535&&NV.objetosVista[F[i]-1]&&NV.objetosVista[F[i]-1].k==='rocoso'){ id=F[i]; break; } }
probar('la roca se dibuja en la pantalla y el cursor la reconoce (búfer de apuntado)', id>0);
const h1=(()=>{ let h=0; const G=m.fbG(),C2=m.fbC(); for(let i=0;i<G.length;i++) h=(Math.imul(h,31)+G[i]+(C2[i]&255))|0; return h; })();
m.draw_(); const h2=(()=>{ let h=0; const G=m.fbG(),C2=m.fbC(); for(let i=0;i<G.length;i++) h=(Math.imul(h,31)+G[i]+(C2[i]&255))|0; return h; })();
probar('el mismo cuadro sale idéntico dos veces', h1===h2);
let contorno=0; { const G=m.fbG(),F=m.fbP(); for(let i=0;i<G.length;i++) if(F[i]===id&&G[i]===35) contorno++; }
probar('lleva su contorno', contorno>4);

/* ---- clic sobre una roca puesta, sin nada elegido, abre la ventana de edición ---- */
E.elegir(null);
const px=(col,fil)=>[col*m.cw()+m.cw()/2+(NV.desplaceX||0), fil*m.chh()+m.chh()/2+(NV.desplaceY||0)];
let celda=null; { const F=m.fbP(),G=m.fbG(),n=m.cols()*m.rowsN(); for(let i=0;i<n;i++) if(G[i]&&F[i]===id){ celda=[i%m.cols(),Math.floor(i/m.cols())]; break; } }
let abrio=null; const abrirReal=NV.creador.abrir; NV.creador.abrir=(mo,en,ob)=>{ abrio={mo,en,ob}; };
{ const [x,y]=px(celda[0]+3,celda[1]+3); E.alMover({clientX:x,clientY:y}); E.alBajar({clientX:x,clientY:y,button:0,ctrlKey:false,preventDefault(){}}); }
NV.creador.abrir=abrirReal;
probar('clic sobre una roca diseñada abre la ventana con ese objeto', abrio&&abrio.mo.id==='rocoso'&&abrio.ob&&abrio.ob.k==='rocoso'&&abrio.ob.r.sem===31);

/* ---- aplicar una edición = un solo paso de deshacer; deshacer devuelve la anterior ---- */
const pilas0=E.pilas().deshacer;
const editada=C.aObjeto(Object.assign({},puesto.r,{mat:'pizarra',estado:Object.assign({},puesto.r.estado,{musgo:0.8})}));
const aplicado=E.reemplazar(puesto,editada); NV.olvidarObjetos();
let o2=NV.objetosEn(p0[0]-1,p0[1]-1,p0[0]+1,p0[1]+1).find(o=>o.k==='rocoso');
probar('aplicar cambia la roca en el mundo, en un solo paso', aplicado&&o2.r.mat==='pizarra'&&o2.r.estado.musgo===0.8&&E.pilas().deshacer===pilas0+1);
E.deshacer(); NV.olvidarObjetos();
o2=NV.objetosEn(p0[0]-1,p0[1]-1,p0[0]+1,p0[1]+1).find(o=>o.k==='rocoso');
probar('deshacer devuelve la roca anterior', o2&&o2.r.mat==='basalto'&&o2.r.estado.musgo===0);

/* ---- eliminar libera el pie ---- */
E.alBajar; { const o=NV.objetosEn(p0[0],p0[1],p0[0],p0[1]).find(q=>q.k==='rocoso'); E.hacer({t:'objeto-',x:o.x,y:o.y},'x'); }
probar('al eliminarla se libera el terreno', !NV.solidoEn(p0[0],p0[1]));
E.deshacer(); probar('y deshacer la devuelve', NV.solidoEn(p0[0],p0[1]));

/* ---- una formación ancha: el dibujo la busca aunque su centro esté lejos ---- */
const pf=libre(FO,50,36)||libre(FO,50,30);
if(pf){ NV.mundo.editar({t:'objeto+',x:pf[0],y:pf[1],objeto:FO}); NV.olvidarObjetos();
  probar('el mundo avisa cuánto llega a los lados un objeto ancho', NV.mundo.margenAncho()===15);
  m.ponerYo(pf[0],pf[1]+6); m.draw_(); m.draw_();
  let hay=false; { const F=m.fbP(),G=m.fbG(); for(let i=0;i<F.length;i++) if(G[i]&&F[i]>0&&F[i]!==65535&&NV.objetosVista[F[i]-1]&&NV.objetosVista[F[i]-1].r&&NV.objetosVista[F[i]-1].r.tipo){ hay=true; break; } }
  probar('la formación se dibuja', hay);
} else probar('hay sitio para una formación', false);

/* ---- archivo: lo editado se exporta y se vuelve a leer ---- */
const arch=NV.mundo.exportar();
probar('el archivo del mundo trae la receta de la roca', JSON.stringify(arch).indexOf('"mat":"basalto"')>0);
probar('el archivo se valida al leerlo', (()=>{ try{ return NV.mundo.validar(JSON.parse(JSON.stringify(arch))); }catch(e){ console.log(e.message); return false; } })());


/* ---- la paleta ya no ofrece el árbol ni la roca genéricos: sólo lo que se diseña ---- */
{ const todos=NV.catalogoObjetos().flatMap(g=>g.items);
  const gen=todos.filter(i=>i.k==='arbol'||i.k==='roca');
  probar('los árboles y rocas genéricos quedan fuera de la paleta (ocultos)', gen.length>=6&&gen.every(i=>i.oculto===true));
  probar('lo diseñable sigue a la vista', todos.filter(i=>i.disenar).length>=4&&todos.filter(i=>i.disenar).every(i=>!i.oculto));
  probar('un árbol genérico ya puesto (de otra sesión) sigue sabiéndose regenerar y borrar', !!NV.entradaDeObjeto({k:'arbol',sp:'pino',h:5,s:1})); }

/* ---- borrar lo de otra sesión: por la huella, aunque el clic no caiga en un pixel del objeto ---- */
{ const ob=C.aObjeto(Object.assign(C.nuevo('rocoso:formacion'),{tipo:'pared',ancho:9,sem:7}));
  const pg=libre(ob,50,60);
  NV.mundo.editar({t:'objeto+',x:pg[0],y:pg[1],objeto:ob}); NV.olvidarObjetos();
  NV.mundo.cargar(JSON.parse(JSON.stringify(NV.mundo.exportar()))); NV.olvidarObjetos();      // "se cerró el juego y se volvió a entrar"
  const borde=[pg[0]+ob.fx,pg[1]+ob.fy], esquina=[pg[0]-ob.fx,pg[1]-ob.fy];
  probar('la huella encuentra el objeto en cualquiera de sus casillas', [borde,esquina,[pg[0],pg[1]]].every(c=>{ const f=E.objetoEnHuella(c[0],c[1]); return f&&f.k==='rocoso'&&f.x===pg[0]&&f.y===pg[1]; }));
  probar('y no inventa objetos fuera de ella', !E.objetoEnHuella(pg[0]+ob.fx+2,pg[1]));
  { const ce=document.createElement; document.createElement=t=>Object.assign(ce(t),{append(){},appendChild(){},setAttribute(){}}); }   // el DOM de pruebas no sabe armar controles
  NV.creador.abrir(M,cat.items[1],E.objetoEnHuella(borde[0],borde[1])); probar('la ventana se abre sobre lo cargado del archivo', NV.creador.abierto());
  const borrado=NV.creador.borrar(); NV.olvidarObjetos();
  probar('el botón "borrar" de la ventana lo elimina y la cierra', borrado&&!NV.creador.abierto()&&!NV.solidoEn(pg[0],pg[1]));
  E.deshacer(); NV.olvidarObjetos(); probar('y se puede deshacer', NV.solidoEn(pg[0],pg[1]));
  const o3=E.objetoEnHuella(pg[0],pg[1]); E.eliminar(o3); NV.olvidarObjetos(); }

/* ---- formaciones más chicas y verticales (norte-sur, cara al este u oeste) ---- */
{ const chica=C.aObjeto(Object.assign(C.nuevo('rocoso:formacion'),{tipo:'pared',ancho:3,alto:2,fondo:2,sem:2}));
  probar('una formación puede medir 3 m de largo y 2 de alto', chica.fx<=2&&chica.h<4&&chica.r.ancho===3);
  const vE=C.aObjeto(Object.assign(C.nuevo('rocoso:formacion'),{tipo:'acantilado',ancho:20,orient:'este',sem:4}));
  const vO=C.aObjeto(Object.assign(C.nuevo('rocoso:formacion'),{tipo:'acantilado',ancho:20,orient:'oeste',sem:4}));
  probar('vertical: corre de norte a sur (fy = media longitud) y es angosta de este a oeste', vE.fy===10&&vE.fx<=8&&vO.fy===10&&vE.dy===10&&vE.fx<FO.fx);
  probar('horizontal: sigue ancho de este a oeste y sin dy', FO.fx===15&&FO.dy===undefined);
  const SE=NV.rocosoSolido(vE.r), SO=NV.rocosoSolido(vO.r);
  probar('el motor la arma con su marco girado', SE.vert&&SE.lado==='este'&&SO.vert&&SO.lado==='oeste'&&SE.largo===20&&SE.D===20);
  /* la cara mira a un lado: el material sale por el lado opuesto — el sólido está contra el lado de la cara */
  const medio=(S,v)=>{ let min=1e9,max=-1e9; for(let U=0;U<=S.W;U+=0.1) if(S.sdf(U,v,-S.largo/2)<0){ min=Math.min(min,U); max=Math.max(max,U); } return [min,max]; };
  const [a1,b1]=medio(SE,0.5), [a2,b2]=medio(SO,0.5);
  probar('la cara al este queda al este del cuerpo; la del oeste, al oeste', (b1-a1)>3&&(b2-a2)>3&&a1<1&&b1<SE.W-1&&b2>SO.W-1&&a2>1);
  const pv=libre(vE,62,56);
  NV.mundo.editar({t:'objeto+',x:pv[0],y:pv[1],objeto:vE}); NV.olvidarObjetos();
  const puestoV=NV.objetosEn(pv[0],pv[1],pv[0],pv[1]).find(o=>o.k==='rocoso'&&o.dy);
  probar('el panel entrega la fila desde la que se dibuja: su punta sur', puestoV&&puestoV.oy===puestoV.y+10);
  probar('el mundo avisa cuánto llega hacia el norte y el sur', NV.mundo.margenAlto()===10);
  probar('ocupa su largo de norte a sur', NV.solidoEn(pv[0],pv[1]-10)&&NV.solidoEn(pv[0],pv[1]+10)&&!NV.solidoEn(pv[0],pv[1]+11));
  /* se dibuja con el centro dentro de la pantalla y también cuando su centro quedó debajo del borde sur */
  const dibujada=()=>{ let hay=false; const F=m.fbP(),G=m.fbG(); for(let i=0;i<F.length;i++) if(G[i]&&F[i]>0&&F[i]!==65535){ const q=NV.objetosVista[F[i]-1]; if(q&&q.dy&&q.r&&q.r.orient==='este'){ hay=true; break; } } return hay; };
  m.ponerYo(pv[0]-5,pv[1]); for(let k=0;k<6;k++) m.draw_();
  probar('un muro vertical se dibuja', dibujada());
  m.ponerYo(pv[0]-5,pv[1]-26); for(let k=0;k<8;k++) m.draw_();
  probar('se sigue dibujando cuando su centro está más al sur de lo que se ve (su mitad norte aún se ve)', dibujada());
  const P2=C.previa(vE.r,{}); probar('la vista previa de un muro vertical entra entera (sin recorrer)', P2.items.length>=1&&P2.pan===0&&P2.vis===P2.S.W);
  probar('el resumen dice que es vertical', C.resumen(vE).indexOf('vertical al este')>0);
  const arch2=JSON.stringify(NV.mundo.exportar()); probar('el archivo guarda la orientación', arch2.indexOf('"orient":"este"')>0&&arch2.indexOf('"dy":10')>0);
  E.eliminar(puestoV); NV.olvidarObjetos(); }

/* ---- sin objetos anchos el mundo no mira de más (el juego sin ediciones no cambia) ---- */
E.salir();
console.log(ok.length+' bien, '+mal.length+' mal'); mal.forEach(x=>console.log('  MAL: '+x));
process.exit(mal.length?1:0);

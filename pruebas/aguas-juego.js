// Las aguas continentales DENTRO del juego: el mundo las guarda (con deshacer), el dibujo las pinta sobre el suelo, el
// personaje hace ondas sólo al pisarlas y el Modo Dios las maneja. Sin agua, el cuadro es idéntico al de siempre.
const cargar=require('./cargar.js');
const m=cargar(`module.exports={NV:window.NV, draw_, tictac, me:()=>me,
  fbG:()=>fbG, fbC:()=>fbC, fbL:()=>fbL, cols:()=>cols, rowsN:()=>rowsN, ponerYo:(x,y)=>{ me.x=x; me.y=y; NV.camXf=undefined; NV.camYf=undefined; NV.camAlz=undefined; }};`);
const NV=m.NV, W=NV.mundo, A=NV.aguas; let bien=0,mal=0; const ok=(c,t)=>{ if(c) bien++; else { mal++; console.log('MAL:',t); } };
performance.now=()=>0; m.tictac(); NV.particulas=false;
const guardado={}; global.localStorage={setItem:(k,v)=>{guardado[k]=v;},getItem:k=>guardado[k]||null,removeItem:k=>{delete guardado[k];}};
const falla=f=>{ try{ f(); return false; }catch(e){ return true; } };
m.ponerYo(70,70); m.draw_(); m.draw_();
const cuadro=()=>{ m.draw_(); m.draw_(); const G=m.fbG(),K=m.fbC(); let h=0; for(let i=0;i<G.length;i++) h=(h*31+G[i]*7+(G[i]?K[i]:0))|0; return h; };
const base=cuadro();

ok(!!A&&A.cuerpos().length===0,'el motor de aguas está en el juego y no hay agua de fábrica');
ok(Array.isArray(W.exportar().aguas||[])&&W.vacio(),'el mundo vacío no trae aguas');
const lago=A.aDatos(A.crear('lago',{id:'lago-1',poligono:[[44,46],[58,45],[60,54],[50,58],[43,53]],sem:3}));
const inv=W.editar({t:'agua',id:'lago-1',datos:lago});
ok(!!inv&&inv.datos===null&&W.exportar().aguas.length===1&&!W.vacio(),'poner un lago lo guarda y devuelve su inversa');
ok(A.cuerpos().length===1&&A.cuerpos()[0].id==='lago-1','el motor lo conoce');
const con=cuadro(); ok(con!==base,'el cuadro cambia sólo porque hay agua');
W.editar(inv); ok(W.vacio()&&A.cuerpos().length===0&&cuadro()===base,'deshacer saca el agua y el cuadro vuelve idéntico al de siempre');
W.editar({t:'agua',id:'lago-1',datos:lago}); ok(cuadro()===con,'volver a ponerlo da el mismo cuadro');
/* persistencia */
const txt=W.texto(); W.cargar({formato:W.FORMATO,semilla:NV.CONFIG.seed,paneles:{},rasgos:[],caminos:[]});
ok(A.cuerpos().length===0&&cuadro()===base,'cargar un mundo sin aguas las vacía');
W.importarTexto(txt); ok(cuadro()===con&&A.cuerpos().length===1,'exportar → importar devuelve el mismo mundo y el mismo cuadro');
ok(/"aguas"/.test(W.comoScript()),'el archivo del mundo trae las aguas');
ok(falla(()=>W.editar({t:'agua',id:'x',datos:{id:'x',tipo:'lago'}}))&&falla(()=>W.editar({t:'agua',id:'__v',datos:Object.assign({},lago,{id:'__v'})}))&&falla(()=>W.editar({t:'agua',id:'y',datos:Object.assign({},lago,{id:'otro'})})),'datos inválidos o con otro nombre se rechazan');
/* el agua se pinta sobre suelo, no sobre objetos: un cuerpo grande cubre celdas pero lo que está en capas altas queda */
const L=m.fbL(), G=m.fbG(); let altas=0; for(let i=0;i<L.length;i++) if(L[i]>0&&G[i]) altas++;
ok(altas>0,'las capas de objetos y personajes siguen ahí con agua dibujada ('+altas+' celdas)');
/* lluvia o viento del juego real: no revienta */
NV.tViento=100; ok(typeof cuadro()==='number','dibuja con el viento real del juego');
/* el personaje en el agua hace ondas; fuera, no */
m.ponerYo(70,70); NV.aguasActor=null; cuadro(); const L1=A.cuerpos()[0];
const n0=L1.golpes.length; cuadro(); ok(L1.golpes.length===n0,'fuera del agua no nacen ondas');
m.ponerYo(50,51); NV.posDibujo=null; NV.aguasActor=null; cuadro(); NV.tViento+=0.5; cuadro(); ok(L1.golpes.length>0,'al pararse en el agua nacen ondas');
/* caminar por el agua deja una estela que SE VE (glifos), no sólo un cambio de color de un par de celdas */
{ NV.tViento=100; m.ponerYo(46,51); NV.posDibujo=null; NV.aguasActor=null; cuadro(); let x=46;
  for(let f=0;f<90;f++){ NV.tViento+=1/30; x+=1.4/30; m.ponerYo(x,51); NV.posDibujo=null; m.draw_(); }
  const con=Uint16Array.from(m.fbG()); L1.golpes.length=0; NV.aguasActor.ult=NV.tViento+99; m.draw_();
  const sin=m.fbG(); let d=0; for(let i=0;i<con.length;i++) if(con[i]!==sin[i]) d++;
  ok(d>=120,'caminando por el agua se dibuja una estela de ondas ('+d+' glifos distintos)'); }
/* editar un cuerpo no pierde el estado de los demás */
const rio=A.aDatos(A.crear('rio',{id:'rio-1',curso:{puntos:[[10,10],[30,20],[40,40]],anchos:[4,5,4]},sem:5}));
W.editar({t:'agua',id:'rio-1',datos:rio}); ok(A.cuerpos().length===2,'un río junto al lago'); const mismo=A.cuerpos().find(c=>c.id==='lago-1');
W.editar({t:'agua',id:'rio-1',datos:Object.assign({},rio,{vel:2})}); ok(A.cuerpos().find(c=>c.id==='lago-1')===mismo,'cambiar el río no rehace el lago');
/* vista previa: se ve y no se guarda */
const sinVista=cuadro(); A.vista(Object.assign({},A.aDatos(A.crear('laguna',{id:'__vista',poligono:[[60,60],[70,60],[70,66],[60,66]]}))));
ok(A.cuerpos().length===3&&W.exportar().aguas.length===2,'la vista previa se dibuja pero no se guarda'); A.vista(null); ok(A.cuerpos().length===2,'se quita la vista previa');
/* el editor */
const E=NV.editor; ok(!!E.modos.aguas&&typeof E.modos.aguas.bajar==='function','el Modo Dios tiene la herramienta de aguas');
E.cambiarModo('aguas'); ok(E.modo==='aguas','se cambia a la pestaña'); ok(/Aguas|agua/i.test(E.modos.aguas.estado()),'el estado se describe');
E.modos.aguas._elegir('lago-1'); ok(E.modos.aguas._cambio('prof',6)&&W.aguasDatos().find(d=>d.id==='lago-1').prof===6,'cambiar un parámetro lo guarda');
E.deshacer(); ok(W.aguasDatos().find(d=>d.id==='lago-1').prof===lago.prof,'y se deshace');
ok(W.aguasDatos().find(d=>d.id==='rio-1').vel===2,'sin tocar los demás cuerpos');
ok(E.modos.aguas._cambio('ancho',9)===false,'un control que no es del tipo no hace nada'); const r2=W.aguasDatos().find(d=>d.id==='lago-1'); ok(r2.prof===lago.prof,'un parámetro que no es del tipo no toca el cuerpo');
E.modos.aguas._elegir('rio-1'); E.modos.aguas._cambio('ancho',9); const an=W.aguasDatos().find(d=>d.id==='rio-1').curso.anchos; ok(Math.abs(an.reduce((a,b)=>a+b,0)/an.length-9)<0.01,'cambiar el ancho del río conserva el recorrido ('+an.map(x=>x.toFixed(1)).join(',')+')');
const pts=W.aguasDatos().find(d=>d.id==='rio-1').curso.puntos; ok(pts.length===3&&pts[1][0]===30,'...sin rehacerlo');
E.modos.aguas._elegir('lago-1'); E.modos.aguas._tipoCambio('laguna'); ok(W.aguasDatos().find(d=>d.id==='lago-1').tipo==='laguna','un lago puede pasar a laguna');
E.modos.aguas._tipoCambio('rio'); ok(W.aguasDatos().find(d=>d.id==='lago-1').tipo==='laguna'&&E.modos.aguas._estado().sel===null,'pero no a río: se pasa a trazar uno nuevo');
E.cambiarModo('objetos');
console.log('aguas-juego: '+bien+' ok'+(mal?', '+mal+' MAL':'')); process.exit(mal?1:0);

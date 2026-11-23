// El terreno por sectores DENTRO del juego: el mundo lo guarda (con deshacer), el suelo lo pinta y el Modo Dios lo maneja.
const cargar=require('./cargar.js');
const m=cargar(`module.exports={NV:window.NV, draw_, tictac, me:()=>me,
  fbG:()=>fbG, fbC:()=>fbC, cw:()=>cw, chh:()=>chh, cols:()=>cols, rowsN:()=>rowsN, ponerYo:(x,y)=>{ me.x=x; me.y=y; NV.camXf=undefined; NV.camYf=undefined; NV.camAlz=undefined; }};`);
const NV=m.NV, W=NV.mundo, T=NV.terreno; const ok=[],mal=[]; const probar=(t,c)=>(c?ok:mal).push(t);
performance.now=()=>0; m.tictac(); NV.particulas=false;
const guardado={}; global.localStorage={setItem:(k,v)=>{guardado[k]=v;},getItem:k=>guardado[k]||null,removeItem:k=>{delete guardado[k];}};
const falla=f=>{ try{ f(); return false; }catch(e){ return true; } };
m.ponerYo(50,50); m.draw_(); m.draw_();
const cuadro=()=>{ m.draw_(); m.draw_(); const G=m.fbG(),K=m.fbC(); let h=0; for(let i=0;i<G.length;i++) h=(h*31+G[i]*7+(G[i]?K[i]:0))|0; return h; };
const base=cuadro();

probar('el mundo vacío exporta la lista de terreno vacía', Array.isArray(W.exportar().terreno)&&W.exportar().terreno.length===0&&W.vacio());
const mk=(id,o)=>{ const n=T.normalizar(Object.assign({x:44,y:46,w:12,h:8},o||{})); n.id=id; n.historial=[]; return n; };
const d1=mk('terreno-1',{terreno:'arena'});
const inv=W.editar({t:'terreno',id:'terreno-1',datos:d1});
probar('poner un sector lo guarda y devuelve su inversa', !!inv&&W.exportar().terreno.length===1&&inv.datos===null&&!W.vacio());
probar('...y el motor lo conoce', T.mundo.sectores.length===1&&T.toca(50,50));
const con=cuadro();
probar('el cuadro cambia sólo porque hay un sector', con!==base);
W.editar(inv);
probar('deshacer saca el sector y el cuadro vuelve idéntico', W.vacio()&&T.mundo.sectores.length===0&&cuadro()===base);
W.editar({t:'terreno',id:'terreno-1',datos:d1});
probar('volver a ponerlo da exactamente el mismo cuadro', cuadro()===con);
const d2=mk('terreno-1',{terreno:'pantano'}); const inv2=W.editar({t:'terreno',id:'terreno-1',datos:d2});
probar('reemplazar devuelve el anterior', inv2.datos&&inv2.datos.terreno==='arena'&&cuadro()!==con);
W.editar(inv2); probar('...y vuelve', cuadro()===con);
// persistencia
const txt=W.texto(); W.cargar({formato:2,semilla:NV.CONFIG.seed,paneles:{},rasgos:[],caminos:[]});
probar('cargar un archivo sin terreno lo vacía', T.mundo.sectores.length===0&&cuadro()===base);
W.importarTexto(txt);
probar('exportar → importar devuelve el mismo mundo y el mismo cuadro', cuadro()===con&&T.mundo.sectores[0].terreno==='arena');
probar('el archivo exportado como script trae el terreno', /"terreno"/.test(W.comoScript()));
probar('un sector inválido se rechaza', falla(()=>W.editar({t:'terreno',id:'x',datos:{id:'x',x:0,y:0,w:0,h:3,terreno:'arena'}}))&&falla(()=>W.editar({t:'terreno',id:'__v',datos:Object.assign({},d1,{id:'__v'})})));
// el editor
const E=NV.editor; probar('el Modo Dios tiene la herramienta de terreno', !!E.modos.terreno&&typeof E.modos.terreno.bajar==='function');
E.cambiarModo('terreno'); probar('se puede cambiar a la pestaña', E.modo==='terreno'); probar('el estado se describe', /Terreno|sector/i.test(E.modos.terreno.estado()));
E.cambiarModo('objetos');
// vista previa no se guarda
T.vista(Object.assign(mk('__vista',{terreno:'barro'}),{id:'__vista'})); const conVista=cuadro(); T.vista(null);
probar('la vista previa se ve pero no se guarda', conVista!==con&&W.exportar().terreno.length===1&&cuadro()===con);
// otro metro lejano no cambia
W.editar({t:'terreno',id:'terreno-1',datos:null}); m.ponerYo(50,50);
probar('quitar todo deja el cuadro original', cuadro()===base);


// ---- el Modo Dios con el ratón ----
const ev=(x,y,o)=>Object.assign({clientX:x,clientY:y,button:0,ctrlKey:false,shiftKey:false,altKey:false,preventDefault(){}},o||{});
const px=(col,fil)=>[col*m.cw()+m.cw()/2+(NV.desplaceX||0), fil*m.chh()+m.chh()/2+(NV.desplaceY||0)];
let TT=1e6; Date.now=()=>TT;
E.entrar&&E.entrar(); E.cambiarModo('terreno'); m.draw_();
const M=E.modos.terreno, cx=Math.floor(m.cols()/2), cy=Math.floor(m.rowsN()/2);
const antes=cuadro();
TT+=1000; { const [x0,y0]=px(cx-12,cy-6); E.alBajar(ev(x0,y0)); for(let t=1;t<=6;t++){ const [x,y]=px(cx-12+t*4,cy-6+t*2); E.alMover(ev(x,y)); } m.draw_(); }
probar('arrastrar en vacío muestra un sector provisional y no guarda nada', M._estado().drag&&W.vacio()&&T.mundo.sectores.length===0&&T.hay());
M.soltar(); m.draw_();
probar('soltar crea un sector en el mundo (con deshacer)', W.exportar().terreno.length===1&&!M._estado().drag&&E.pilas().deshacer>=1);
const s0=W.exportar().terreno[0];
probar('...con tamaño en metros enteros y elegido', Number.isInteger(s0.x)&&Number.isInteger(s0.w)&&s0.w>=2&&M._estado().sel===s0.id);
E.deshacer(); probar('deshacer lo quita', W.vacio());
E.rehacer&&0;
// editar con los controles: lo toca sólo a él, y 'anterior' vuelve atrás
W.editar({t:'terreno',id:'terreno-9',datos:mk('terreno-9',{x:cx-30,y:cy+10,w:6,h:6})});
const lejos=cuadro();
M.abrir(); const dd=W.exportar().terreno.find(q=>q.id==='terreno-9');
probar('un sector puesto tras deshacer queda solo en el mundo', W.exportar().terreno.length===1&&!!dd);
W.editar({t:'terreno',id:'terreno-2',datos:mk('terreno-2',{x:cx+20,y:cy+10,w:6,h:6})});
const otro=cuadro();
M._modificar('terreno-9',{'pasto.densidad':0.9,'pasto.alto':0.95,'flores.cantidad':3.2,'flores.roja':true},'x');
const d9=W.exportar().terreno.find(q=>q.id==='terreno-9'), dT2=W.exportar().terreno.find(q=>q.id==='terreno-2');
probar('un control edita sólo el sector elegido', d9.pasto.densidad===0.9&&d9.pasto.alto===0.95&&dT2.pasto.densidad===0.5);
probar('...y guarda la configuración anterior para volver', d9.historial.length===1&&d9.historial[0].pasto.densidad===0.5);
M._modificar('terreno-9',{'pasto.estado':'no-existe','pasto.densidad':7},'x');
const d9b=W.exportar().terreno.find(q=>q.id==='terreno-9');
probar('los valores fuera de rango o desconocidos se corrigen', d9b.pasto.estado==='fresco'&&d9b.pasto.densidad===1);
E.deshacer(); E.deshacer();
probar('deshacer revierte los cambios de los controles', W.exportar().terreno.find(q=>q.id==='terreno-9').pasto.densidad===0.5);
console.log(ok.length+' bien, '+mal.length+' mal'); mal.forEach(x=>console.log('  MAL: '+x));
process.exit(mal.length?1:0);

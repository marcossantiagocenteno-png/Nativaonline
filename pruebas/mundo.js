// El mundo editable: ediciones como datos, aplicadas sobre lo generado, exportables y reversibles.
const cargar=require('./cargar.js');
const m=cargar('module.exports={NV:window.NV};');
const NV=m.NV, W=NV.mundo, L=NV.LADO; const ok=[],mal=[]; const probar=(t,c)=>(c?ok:mal).push(t);
const falla=f=>{ try{ f(); return false; }catch(e){ return true; } };
const huella=(pi,pj)=>{ const p=NV.panel(pi,pj); return JSON.stringify([p.ground,p.trees,Array.from(p.occ),Array.from(p.shade),p.mapG]); };

const base=huella(0,0), base0=NV.panel(0,0).ground.slice();
probar('sin ediciones el mundo está vacío', W.vacio()&&W.estadisticas().paneles===0);

/* suelo */
const x=50,y=50, antes=NV.sueloEn(x,y);
const inv=W.editar({t:'suelo',x,y,m:antes==='d'?'g':'d'});
probar('una pincelada de suelo cambia ese metro', NV.sueloEn(x,y)!==antes);
probar('y sólo ese metro', NV.sueloEn(x+1,y)===base0[y][x+1]);
W.editar(inv);
probar('deshacer devuelve el mundo idéntico', huella(0,0)===base);

/* rasgo: un camino que cruza dos paneles */
W.editar({t:'rasgo+',rasgo:{id:'c1',tipo:'camino',puntos:[[90,50],[110,50]],ancho:3,material:'d'}});
probar('el camino se pinta en el primer panel', NV.sueloEn(95,50)==='d'&&NV.sueloEn(95,51)==='d');
probar('y sigue en el panel de al lado', NV.sueloEn(105,50)==='d');
probar('fuera de su ancho no toca nada', NV.sueloEn(95,57)===base0[57][95]);
W.editar({t:'rasgo-',id:'c1'});
probar('quitar el camino devuelve el mundo', huella(0,0)===base);

/* objetos */
const baseO=huella(-1,0), arb=NV.panel(-1,0).trees.find(t=>t.k==='roca'), ax=arb.x-L, ay=arb.y;
W.editar({t:'objeto-',x:ax,y:ay});
probar('quitar una roca generada la saca del panel y libera el metro', !NV.panel(-1,0).trees.some(t=>t.x===arb.x&&t.y===arb.y)&&!NV.panel(-1,0).occ[arb.y*L+arb.x]);
W.editar({t:'objeto-restaurar',x:ax,y:ay});
probar('restaurarlo devuelve el mundo', huella(-1,0)===baseO);
W.editar({t:'objeto+',x:10,y:10,objeto:{k:'roca',h:1}});
probar('agregar una roca la pone y ocupa el metro', NV.panel(0,0).trees.some(t=>t.x===10&&t.y===10&&t.k==='roca')&&NV.panel(0,0).occ[10*L+10]===1);
W.editar({t:'objeto-',x:10,y:10});
probar('quitar lo agregado lo borra del todo', huella(0,0)===base);

/* alturas */
const h0=NV.alturaEn(30.5,30.5);
W.editar({t:'altura',x:30,y:30,d:2});
probar('una altura editada sube ese punto', NV.alturaEn(30,30)>=2-1e-9);
W.editar({t:'altura',x:30,y:30,d:0});
probar('y volver a cero lo deja como estaba', Math.abs(NV.alturaEn(30.5,30.5)-h0)<1e-9&&W.estadisticas().alturas===0);

/* panel nuevo definido por datos */
probar('un panel fuera del mundo no existe', NV.panel(2,0)===null);
W.editar({t:'panel',pi:2,pj:0,def:{bioma:'este',nombre:'Prueba'}});
probar('un panel definido en datos se genera', !!NV.panel(2,0)&&NV.panel(2,0).nombre==='Prueba');
probar('los límites del mundo lo incluyen', NV.limites().x1===3*L);
W.editar({t:'panel',pi:2,pj:0,def:null});
probar('quitar la definición lo hace desaparecer', NV.panel(2,0)===null&&NV.limites().x1===2*L);

/* exportar / importar */
W.editar({t:'rasgo+',rasgo:{id:'c2',puntos:[[20,20],[40,30]],ancho:2,material:'d'}});
W.editar({t:'suelo',x:5,y:5,m:'d'}); W.editar({t:'objeto+',x:12,y:12,objeto:{k:'roca',h:1}});
const t1=W.texto(), h1=huella(0,0);
probar('el archivo es estable: exportar dos veces da lo mismo', W.texto()===t1);
W.cargar({formato:1,semilla:NV.CONFIG.seed,paneles:{},rasgos:[]});
probar('cargar un mundo vacío lo vuelve a la semilla', huella(0,0)===base);
W.cargar(JSON.parse(t1));
probar('exportar e importar da el mismo mundo', W.texto()===t1&&huella(0,0)===h1);
probar('el archivo como script se vuelve a leer', (()=>{ const s=W.comoScript(); W.cargar({formato:1,semilla:NV.CONFIG.seed,paneles:{},rasgos:[]}); W.importarTexto(s); return W.texto()===t1; })());

/* validación */
probar('un formato más nuevo se rechaza', falla(()=>W.validar({formato:99,semilla:NV.CONFIG.seed})));
probar('otra semilla se rechaza', falla(()=>W.validar({formato:1,semilla:'otra'})));
probar('un material inventado se rechaza', falla(()=>W.validar({formato:1,semilla:NV.CONFIG.seed,paneles:{'0,0':{suelo:[[1,1,'?']]}}})));
probar('un rasgo sin ancho se rechaza', falla(()=>W.editar({t:'rasgo+',rasgo:{id:'z',puntos:[[0,0]],ancho:0,material:'d'}})));
probar('una operación desconocida se rechaza', falla(()=>W.editar({t:'magia'})));

/* separado del guardado del jugador */
const guardado=[];
global.localStorage={setItem:(k,v)=>guardado.push(k),getItem:()=>null,removeItem(){}};
W.guardarBorrador();
probar('el borrador usa su propia llave, no la del jugador', guardado.length===1&&guardado[0]==='nativa.mundo.v1'&&guardado[0]!=='nativa.guardado.v1');

/* avisa a quien escucha */
let avisos=0; const off=W.alCambiar(()=>avisos++); W.editar({t:'suelo',x:7,y:7,m:'d'}); off(); W.editar({t:'suelo',x:8,y:8,m:'d'});
probar('los oyentes se enteran de los cambios (y se pueden desapuntar)', avisos===1);

console.log(ok.length+' bien, '+mal.length+' mal'); mal.forEach(x=>console.log('  MAL: '+x));
process.exit(mal.length?1:0);

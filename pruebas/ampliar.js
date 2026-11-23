// Ampliar el mundo de a parcelas de 10 × 10 m (operación 'parcela'): límites, suelo, deshacer y archivo.
const cargar=require('./cargar.js');
const m=cargar('module.exports={NV:window.NV};');
const NV=m.NV, W=NV.mundo; const ok=[],mal=[]; const probar=(t,c)=>(c?ok:mal).push(t);

let b=NV.limites();
probar('el mundo limpio es un cuadrado de 100 × 100 m', b.x0===0&&b.x1===100&&b.y0===0&&b.y1===100);
probar('fuera de él no hay nada', NV.sueloEn(105,5)===null&&NV.solidoEn(105,5)===true);

/* una parcela pegada al este: x 100..110, y 0..10 → índices (10,0) */
const inv=W.editar({t:'parcela',bx:10,by:0,on:true});
probar('la parcela nueva es tierra', NV.sueloEn(105,5)!==null&&NV.solidoEn(105,5)===false);
probar('sólo esos 10 × 10 m: más allá sigue vacío', NV.sueloEn(111,5)===null&&NV.sueloEn(105,11)===null);
b=NV.limites();
probar('los límites crecen sólo lo ampliado', b.x0===0&&b.x1===110&&b.y0===0&&b.y1===100);
probar('el mundo original no cambió', NV.sueloEn(50,50)!==null);

/* archivo y vuelta */
const txt=W.texto();
probar('la parcela viaja en el archivo', txt.includes('"parcelas"')&&!W.vacio());

/* otra parcela arriba de la primera (hacia el norte, y negativa) */
W.editar({t:'parcela',bx:10,by:-1,on:true});
probar('crece hacia el norte con índices negativos', NV.sueloEn(105,-5)!==null&&NV.limites().y0===-10);

W.editar({t:'parcela',bx:10,by:-1,on:false});
probar('quitar la parcela la devuelve al vacío', NV.sueloEn(105,-5)===null&&NV.limites().y0===0);
W.editar(inv);
probar('deshacer deja el mundo como estaba', NV.sueloEn(105,5)===null&&NV.limites().x1===100);
/* ida y vuelta por el archivo */
W.editar({t:'parcela',bx:10,by:-1,on:true}); const t2=W.texto(); W.editar({t:'parcela',bx:10,by:-1,on:false}); W.importarTexto(t2);
probar('el archivo se vuelve a leer igual', NV.sueloEn(105,-5)!==null&&W.texto()===t2);
W.editar({t:'parcela',bx:10,by:-1,on:false});
let falla=false; try{ W.editar({t:'parcela',bx:1.5,by:0,on:true}); }catch(e){ falla=true; }
probar('coordenadas inválidas se rechazan', falla);

console.log(ok.length+' bien, '+mal.length+' mal'); if(mal.length){ console.log(mal.join('\n')); process.exit(1); }

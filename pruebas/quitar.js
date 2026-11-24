// Quitar parcelas: la operación 'panel' con bioma 'vacio' (deshacible), límites y paneles vecinos.
const cargar=require('./cargar.js');
const NV=cargar('module.exports=window.NV;'), W=NV.mundo; const ok=[],mal=[]; const probar=(t,c)=>(c?ok:mal).push(t);
const pasto=(i,j)=>({bioma:'pasto',nombre:'Terreno '+NV.nombreDe(i,j)}), vacio={bioma:'vacio',nombre:'Quitada'};
W.editar({t:'panel',pi:1,pj:0,def:pasto(1,0)}); W.editar({t:'panel',pi:2,pj:0,def:pasto(2,0)});
probar('tres parcelas en fila', NV.limites().x1===300);
const inv=W.editar({t:'panel',pi:2,pj:0,def:vacio});
probar('quitar la parcela 2:0 la deja vacía y acorta los límites', NV.sueloEn(250,50)===null&&NV.solidoEn(250,50)&&NV.limites().x1===200);
probar('las otras siguen', NV.sueloEn(50,50)!==null&&NV.sueloEn(150,50)!==null);
W.editar(inv); probar('deshacer la devuelve', NV.sueloEn(250,50)!==null&&NV.limites().x1===300);
W.editar({t:'panel',pi:0,pj:0,def:vacio});
probar('también se puede quitar la de fábrica (0:0), y los límites la ignoran', NV.sueloEn(50,50)===null&&NV.limites().x0===100);
const t=W.texto(); W.importarTexto(t); probar('viaja en el archivo', NV.sueloEn(50,50)===null&&NV.sueloEn(150,50)!==null&&W.texto()===t);
W.editar({t:'panel',pi:0,pj:0,def:null}); probar('deshacer la de fábrica (def null) la trae de vuelta', NV.sueloEn(50,50)!==null&&NV.limites().x0===0);
console.log(ok.length+' bien, '+mal.length+' mal'); for(const x of mal) console.log('  ✗ '+x); process.exit(mal.length?1:0);

// Ampliar el mundo: cada parcela nueva es un panel de 100 × 100 m, nombrado en ejes cartesianos.
const cargar=require('./cargar.js');
const NV=cargar('module.exports=window.NV;'), W=NV.mundo, L=NV.LADO; const ok=[],mal=[]; const probar=(t,c)=>(c?ok:mal).push(t);
const def=(pi,pj)=>({bioma:'pasto',nombre:'Terreno '+NV.nombreDe(pi,pj)});
probar('una parcela mide 100 m', L===100);
probar('el 0:0 es 100 × 100 m', (()=>{ const b=NV.limites(); return b.x0===0&&b.x1===100&&b.y0===0&&b.y1===100; })());
probar('fuera no hay nada', NV.sueloEn(150,50)===null&&NV.solidoEn(150,50));
const inv=W.editar({t:'panel',pi:1,pj:0,def:def(1,0)});
probar('el terreno 1:0 queda al este y mide 100 m', NV.sueloEn(150,50)!==null&&NV.limites().x1===200&&NV.panel(1,0).coord==='1:0');
W.editar({t:'panel',pi:0,pj:-1,def:def(0,-1)});
probar('el terreno 0:1 queda al norte (y cartesiana)', NV.panel(0,-1).coord==='0:1'&&NV.sueloEn(50,-50)!==null&&NV.limites().y0===-100);
probar('el nombre se lee de vuelta', NV.desdeNombre('0:1').pj===-1);
const t=W.texto(); W.importarTexto(t); probar('viaja en el archivo', NV.sueloEn(150,50)!==null&&W.texto()===t);
W.editar(inv); W.editar({t:'panel',pi:0,pj:-1,def:null});
probar('deshacer devuelve el mundo de una sola parcela', NV.sueloEn(150,50)===null&&NV.limites().x1===100&&NV.limites().y0===0);
console.log(ok.length+' bien, '+mal.length+' mal'); for(const x of mal) console.log('  ✗ '+x); process.exit(mal.length?1:0);

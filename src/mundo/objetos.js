/* Nativa Online — MOTORES DE OBJETOS (lo que el Modo Dios puede colocar).
   Cada motor declara en el registro su cara "objetos": qué ofrece (catalogo), cómo arma uno
   (crear) y cómo da OTRA variante real de lo mismo (variar). El editor no conoce árboles ni rocas:
   lee el catálogo de lo que haya registrado. Un motor nuevo (arbustos, flores, ramas, decorado)
   aparece en la paleta con darse de alta acá o en su propio archivo; la herramienta no cambia.

   Un objeto es un dato: {k,h,s,sp?,len?} más su casilla {x,y} (metros enteros del mundo).
   La semilla `s` es lo que decide la forma: en las rocas elige un molde del catálogo de su
   tamaño; en los árboles, la copa, el tronco y la inclinación. Regenerar = otra `s`. */
(function(NV){
  const azar=()=>(NV.azarEditor||Math.random)();
  const nuevaS=()=>((azar()*1e6)|0)+1;
  const mayus=t=>t.charAt(0).toUpperCase()+t.slice(1);

  /* otra `s` que dé OTRO molde (módulo n), si hay más de uno */
  function otraS(sActual,n){
    let s=nuevaS(), g=0;
    if(n>1) while((s%n)===(sActual%n)&&g++<50) s=nuevaS();
    return s;
  }

  /* ---- árboles: una entrada por especie ---- */
  const ESPECIES=['pino','encino','alamo'];
  NV.motores.registrar({id:'arboles',nombre:'Árboles',estado:'integrado',archivo:'src/juego/dibujar.js',prueba:'pruebas/arboles.js',
    caras:{objetos:{
      catalogo:()=>ESPECIES.filter(sp=>NV.SPECIES[sp]).map(sp=>({id:'arbol:'+sp,nombre:mayus(NV.SPECIES[sp].n),k:'arbol',sp,oculto:true,encaja:o=>o.k==='arbol'&&o.sp===sp})),
      crear:(id)=>{ const sp=id.split(':')[1], A=NV.SPECIES[sp].alto;
        return {k:'arbol',sp,h:+(A[0]+azar()*(A[1]-A[0])).toFixed(2),s:nuevaS()}; },
      /* misma especie y casi la misma altura (±8 %); cambia la forma */
      variar:(o)=>({s:nuevaS(),h:+(o.h*(0.92+0.16*azar())).toFixed(2)})
    }}});

  /* ---- rocas: una entrada por tamaño. El tamaño NO cambia al regenerar: cambia el molde ---- */
  const TAM={pequena:{h:0.5,n:'Roca pequeña'},media:{h:1.2,n:'Roca mediana'},grande:{h:2.4,n:'Roca grande'}};
  const cat=h=>h<0.75?'pequena':h<1.75?'media':h<3.5?'grande':'gigante';
  NV.motores.registrar({id:'rocas',nombre:'Piedras y rocas',estado:'integrado',archivo:'src/juego/dibujar.js',prueba:'pruebas/rocas.js',
    caras:{objetos:{
      catalogo:()=>Object.keys(TAM).filter(c=>NV.ROCAS&&NV.ROCAS[c]).map(c=>({id:'roca:'+c,nombre:TAM[c].n,k:'roca',oculto:true,encaja:o=>o.k==='roca'&&cat(o.h)===c})),
      crear:(id)=>{ const c=id.split(':')[1], b=TAM[c].h; return {k:'roca',h:+(b*(0.92+0.16*azar())).toFixed(2),s:nuevaS()}; },
      variar:(o)=>{ const R=NV.ROCAS[cat(o.h)]; return {s:otraS(o.s,R?R.length:1)}; }
    }}});

  /* ---- troncos caídos ---- */
  NV.motores.registrar({id:'troncos',nombre:'Troncos',estado:'integrado',archivo:'src/juego/dibujar.js',
    caras:{objetos:{
      catalogo:()=>[{id:'caido:tronco',nombre:'Tronco caído',k:'caido',encaja:o=>o.k==='caido'}],
      crear:()=>({k:'caido',h:0.6,len:2+((azar()*3)|0),s:nuevaS()}),
      variar:(o)=>({s:nuevaS()})
    }}});

  /* el catálogo completo, agrupado por motor, para la paleta */
  NV.catalogoObjetos=()=>NV.motores.conCara('objetos').map(m=>({motor:m.id,nombre:m.nombre,items:m.caras.objetos.catalogo()})).filter(g=>g.items.length);
  /* de qué motor es una entrada del catálogo, y de cuál es un objeto ya puesto */
  NV.motorDeEntrada=id=>{ for(const m of NV.motores.conCara('objetos')) if(m.caras.objetos.catalogo().some(e=>e.id===id)) return m; return null; };
  NV.entradaDeObjeto=o=>{ for(const m of NV.motores.conCara('objetos')) for(const e of m.caras.objetos.catalogo()) if(e.encaja(o)) return {motor:m,entrada:e}; return null; };
  NV.motorDeObjeto=o=>{ const r=NV.entradaDeObjeto(o); return r&&r.motor; };
})(window.NV);

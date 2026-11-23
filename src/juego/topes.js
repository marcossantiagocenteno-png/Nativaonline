/* Nativa Online — TOPES: casillas por las que nadie pasa (ni el personaje ni los demás).
   Un tope es un objeto del mundo {k:'tope', fx, fy}: un rectángulo de casillas centrado en (x,y). El mundo lo
   trata como sólido (ediciones.OCUPAN), así que bloquea el paso igual que una roca; pero NO se dibuja: en el juego es
   invisible. Sólo el Modo Dios lo muestra, como una trama dorada, para poder verlo, elegirlo y borrarlo.
   Se diseña en la ventana del Modo Dios con dos perillas: cuántas casillas de ancho y cuántas de largo. */
(function(NV){
  const clamp=(v,a,b)=>v<a?a:v>b?b:v;
  const ID='tope:tope', MAX=41;
  const impar=n=>{ n=Math.round(+n)||1; n=clamp(n,1,MAX); return n%2?n:n+1; };
  const base=()=>({ancho:3,largo:3});
  let ULTIMO=null;
  const limpiar=spec=>({ancho:impar(spec&&spec.ancho),largo:impar(spec&&spec.largo)});
  function aObjeto(spec){
    const r=limpiar(spec);
    return {k:'tope',h:1,s:1,r,fx:(r.ancho-1)/2,fy:(r.largo-1)/2};
  }
  const CAMPOS=[
    {ruta:'ancho',etq:'Ancho (casillas)',tipo:'rng',min:1,max:MAX,paso:2,grupo:'Tope'},
    {ruta:'largo',etq:'Largo (casillas)',tipo:'rng',min:1,max:MAX,paso:2,grupo:'Tope'}];
  const resumen=o=>'Tope · '+(2*o.fx+1)+' × '+(2*o.fy+1)+' casillas';

  /* En el juego no se ve. En Modo Dios: una trama sobre cada casilla y un borde marcado. */
  const ORO=[214,168,64], ORO_B=[120,92,30];
  function marcar(tr,pick,get){
    for(let dy=-tr.fy;dy<=tr.fy;dy++) for(let dx=-tr.fx;dx<=tr.fx;dx++){
      const bc=(tr.x+dx-camX)*CPM, br=(tr.y+dy-camY)*RPM+RPM-1;
      if(bc>cols||bc+CPM<0) continue;
      const borde=dx===-tr.fx||dx===tr.fx||dy===-tr.fy||dy===tr.fy;
      const al=Math.round(NV.alturaEn(tr.x+dx+0.5,tr.y+dy+0.5)*HPM);
      for(let r=0;r<RPM;r++) for(let c=0;c<CPM;c++){
        const pared=borde&&((dx===-tr.fx&&c===0)||(dx===tr.fx&&c===CPM-1)||(dy===-tr.fy&&r===0)||(dy===tr.fy&&r===RPM-1));
        if(!pared&&(c+2*r)%5!==0) continue;
        const col=pared?ORO:ORO_B;
        alzaR=al; put(bc+c,br-(RPM-1)+r,pared?35:47,packc(col[0],col[1],col[2]));
      }
    }
  }
  NV.dibujarTope=function(tr){
    if(!(NV.editor&&NV.editor.activo)) return;
    const o=ordR, a=alzaR; ordR=60000;                 // por encima del suelo de las filas de más al sur
    try{ marcar(tr); } finally{ ordR=o; alzaR=a; }
  };

  function previa(spec){
    const r=limpiar(spec), mw=Math.max(8,r.ancho*1+2), mh=Math.max(8,r.largo+3);
    const fx=(r.ancho-1)/2, fy=(r.largo-1)/2;
    return {mw:mw,mh:mh,z:r.ancho>21||r.largo>21?0.5:1,S:{W:mw},items:[{x:(mw-1)/2,y:mh/2,pintar:ctx=>{
      for(let dy=-fy;dy<=fy;dy++) for(let dx=-fx;dx<=fx;dx++){
        const bc=ctx.bc+Math.round(dx*ctx.CPM), br=ctx.br+Math.round(dy*ctx.RPM);
        const borde=dx===-fx||dx===fx||dy===-fy||dy===fy;
        for(let r2=0;r2<ctx.RPM;r2++) for(let c=0;c<ctx.CPM;c++){
          const pared=borde&&((dx===-fx&&c===0)||(dx===fx&&c===ctx.CPM-1)||(dy===-fy&&r2===0)||(dy===fy&&r2===ctx.RPM-1));
          if(!pared&&(c+2*r2)%5!==0) continue;
          const col=pared?ORO:ORO_B; ctx.put(bc+c,br-(ctx.RPM-1)+r2,pared?35:47,(col[0]<<16)|(col[1]<<8)|col[2]);
        }
      }
    }}],detalle:'nadie pasa por aquí · invisible en el juego'};
  }

  if(NV.motores) NV.motores.registrar({id:'tope',nombre:'Topes (casillas intransitables)',estado:'integrado',
    archivo:'src/juego/topes.js',prueba:'pruebas/topes.js',
    caras:{
      objetos:{
        catalogo:()=>[{id:ID,nombre:'Tope (diseñar)',etiqueta:'Tope',k:'tope',disenar:true,encaja:o=>o.k==='tope'}],
        crear:()=>aObjeto(ULTIMO||base()),
        variar:o=>Object.assign({},o)
      },
      creador:{
        titulo:()=>'Diseñar un tope',
        campos:()=>CAMPOS,
        nuevo:()=>Object.assign(base(),ULTIMO||{}),
        variar:spec=>Object.assign({},spec),
        aObjeto, deObjeto:o=>({id:ID,spec:{ancho:2*o.fx+1,largo:2*o.fy+1}}), idDe:()=>ID,
        recordar:(id,spec)=>{ ULTIMO=limpiar(spec); },
        previa, resumen
      }
    }});
})(window.NV);

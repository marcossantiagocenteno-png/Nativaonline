// La luz del fuego: continua sobre el suelo y también sobre lo que se levanta de él.
//
// Antes el calor se leía una vez por metro, así que una hoguera salía en
// anillos cuadrados, y solo el suelo y el personaje lo recibían: un tronco a
// cinco metros del fuego quedaba tan frío como uno a cincuenta.
//
// Cómo se mide, porque no es obvio: el mundo tiene materiales distintos de un
// metro al siguiente (agua, pasto, tierra) y eso mueve el color mucho más que
// el fuego. Así que siempre se dibuja el MISMO cuadro dos veces, con y sin
// fuego, y se mira la diferencia casilla por casilla: el material se cancela y
// queda solo lo que puso el fuego.
const cargar=require('./cargar.js');
const m=cargar(`module.exports={
  NV:window.NV, draw_, tictac,
  ponerYo:(x,y)=>{ me.x=x; me.y=y; NV.camXf=undefined; NV.camYf=undefined; },
  estado:()=>({fbG,fbC,fbL,cols,rowsN,CPM,RPM,HPM,camX,camY})
};`);
const NV=m.NV;
const ok=[],mal=[]; const probar=(t,c)=>(c?ok:mal).push(t);
const DIA=30*86400e3/430, base=Date.UTC(2026,4,1,0,0,0);
const hora=i=>{ NV.actualizarCielo(base+DIA*i/8); };
m.tictac();
const HX=55, HY=52;                          // dónde arde la hoguera

/* Dibuja el cuadro con o sin fuego y devuelve una copia de los buffers. */
function dibujar(conFuego,yoX,yoY){
  const f0=NV.fuegoEn, c0=NV.calorEn, k0=NV.calorCerca;
  if(!conFuego){ NV.fuegoEn=()=>0; NV.calorEn=()=>0; NV.calorCerca=()=>false; }
  try{
    m.ponerYo(yoX,yoY); m.draw_();
    const E=m.estado();
    return {E, G:E.fbG.slice(), C:E.fbC.slice(), L:E.fbL.slice()};
  } finally { NV.fuegoEn=f0; NV.calorEn=c0; NV.calorCerca=k0; }
}
const rojo=c=>(c>>16)&255, rb=c=>((c>>16)&255)-(c&255);

console.log('=== el calor cambia de a poco, no de a metro ===');
{
  let salto=0, saltoMetro=0, previo=null, previoM=null;
  for(let x=57; x<=69; x+=0.02){
    const c=NV.calorEn(x,HY+0.5), q=NV.fuegoEn(Math.floor(x),HY);
    if(previo!==null){ salto=Math.max(salto,Math.abs(c-previo)); saltoMetro=Math.max(saltoMetro,Math.abs(q-previoM)); }
    previo=c; previoM=q;
  }
  console.log('  paso de 2 cm: el calor continuo cambia como mucho '+salto.toFixed(3)
              +' · por metro, de golpe, '+saltoMetro.toFixed(3));
  probar('el calor continuo no salta al cruzar de un metro a otro', salto<0.01);
  probar('el calor por metro sí saltaba (esto es lo que se arregló)', saltoMetro>0.1);
  probar('en el centro del metro da lo mismo que antes',
         Math.abs(NV.calorEn(HX+3.5,HY+0.5)-NV.fuegoEn(HX+3,HY))<1e-6);
  probar('lejos de la hoguera no hay nada que calcular', !NV.calorCerca(5,5) && NV.calorCerca(HX+5,HY));
}

console.log('\n=== el suelo: dentro de un metro, la luz baja al alejarse del fuego ===');
{
  hora(0);
  /* Todo el suelo es tierra: se pinta casilla por casilla y su glifo no
     depende de la luz. Cerca del fuego el color satura (el brillo tiene techo),
     así que se mira el tramo de transición, a más de nueve metros. */
  const suelo0=NV.sueloEn; NV.sueloEn=()=> 'd';
  let medias=[];
  try{
    const con=dibujar(true,61,HY), sin=dibujar(false,61,HY), E=con.E;
    for(const [a,b] of [[62,64],[65,67],[68,70]]){
      let tot=0, n=0, mismos=0, todos=0;
      for(let my=HY-2;my<=HY+2;my++) for(let mx=a;mx<=b;mx++){
        const top=(my-E.camY)*E.RPM, c0=(mx-E.camX)*E.CPM;
        let sO=0,nO=0,sE=0,nE=0;
        for(let r=top;r<top+E.RPM;r++) for(let k=0;k<E.CPM;k++){
          const col=c0+k; if(col>=E.cols) continue;
          const i=r*E.cols+col;
          if(con.L[i]!==0||sin.L[i]!==0||!con.G[i]) continue;
          todos++; if(con.G[i]!==sin.G[i]) continue; mismos++;
          const d=rojo(con.C[i])-rojo(sin.C[i]);
          if(k<E.CPM/2){ sO+=d; nO++; } else { sE+=d; nE++; }
        }
        if(nO&&nE){ tot+=sO/nO-sE/nE; n++; }
      }
      const media=n?tot/n:0; medias.push(media);
      console.log('  metros '+a+'-'+b+' al este (campo '+NV.fuegoEn(a,HY).toFixed(2)+' → '+NV.fuegoEn(b,HY).toFixed(2)
                  +'): la mitad que da al fuego recibe '+media.toFixed(1)+' niveles de rojo más que la otra'
                  +'  ['+n+' metros, glifos iguales '+mismos+'/'+todos+']');
      probar('metros '+a+'-'+b+': la luz es continua dentro del metro', n>=8 && media>3);
    }
  } finally { NV.sueloEn=suelo0; }
  probar('y a más distancia del fuego el desnivel dentro del metro es menor', medias[0]>medias[2]);
  console.log('  (con un valor por metro estos números dan 0,0 exactos)');
}

console.log('\n=== lo que se levanta del suelo recibe el calor ===');
{
  hora(0);
  const con=dibujar(true,HX,HY), sin=dibujar(false,HX,HY), E=con.E;
  /* el encino de 4,5 m que está cinco metros al sur de la hoguera */
  const T={x:56,y:56,h:4.5};
  const bc=(T.x-E.camX)*E.CPM+Math.floor(E.CPM/2), br=(T.y-E.camY)*E.RPM+E.RPM-1;
  const alto=Math.round(T.h*E.HPM), ancho=Math.round(E.CPM*0.9);
  const medir=(r0,r1)=>{
    let s=0,n=0;
    for(let r=r0;r<r1;r++) for(let c=bc-ancho;c<=bc+ancho;c++){
      if(c<0||c>=E.cols||r<0||r>=E.rowsN) continue;
      const i=r*E.cols+c;
      if(con.L[i]!==2||sin.L[i]!==2||con.G[i]!==sin.G[i]||!con.G[i]) continue;
      s+=rb(con.C[i])-rb(sin.C[i]); n++;
    }
    return {v:n?s/n:0,n};
  };
  const pie=medir(br-Math.round(alto/3),br+1), copa=medir(br-alto,br-Math.round(alto*2/3));
  console.log('  el encino de '+T.h+' m a cinco metros del fuego: el pie gana '+pie.v.toFixed(1)
              +' niveles de naranja ('+pie.n+' casillas), la copa '+copa.v.toFixed(1)+' ('+copa.n+')');
  probar('el pie del árbol se calienta', pie.n>20 && pie.v>20);
  probar('la copa se calienta mucho menos que el pie', copa.n>10 && copa.v<pie.v*0.5);
}
{
  /* El control, con la cámara lejos: ahí hay árboles pero el fuego no llega. */
  hora(0);
  const con=dibujar(true,25,HY), sin=dibujar(false,25,HY), E=con.E;
  let objetos=0, iguales=0;
  for(let i=0;i<E.cols*E.rowsN;i++){
    if(con.L[i]!==2||sin.L[i]!==2) continue;
    objetos++; if(con.C[i]===sin.C[i]&&con.G[i]===sin.G[i]) iguales++;
  }
  console.log('  con la cámara a treinta metros: '+iguales+' de '+objetos+' casillas de objetos idénticas con y sin fuego');
  probar('hay objetos a la vista para comparar', objetos>200);
  probar('lo que está lejos del fuego no cambia ni un nivel', iguales===objetos);
}
{
  /* La hoguera sola en el mundo: no se tiñe a sí misma. */
  hora(0);
  const o0=NV.objetosEn;
  NV.objetosEn=(a,b,c,d)=>o0(a,b,c,d).filter(o=>o.k==='hoguera');
  try{
    const con=dibujar(true,HX,HY), sin=dibujar(false,HX,HY), E=con.E;
    let n=0, iguales=0;
    for(let i=0;i<E.cols*E.rowsN;i++){
      if(con.L[i]!==2||sin.L[i]!==2||!con.G[i]) continue;
      n++; if(con.C[i]===sin.C[i]) iguales++;
    }
    console.log('  la hoguera sola: '+iguales+' de '+n+' casillas iguales con y sin fuego');
    probar('la hoguera no se tiñe a sí misma', n>20 && iguales===n);
  } finally { NV.objetosEn=o0; }
}

console.log('\n=== el personaje: la luz no salta al cruzar un metro ===');
{
  hora(0);
  let salto=0, previo=null;
  for(let x=HX+6; x<=HX+10; x+=0.05){
    const k=NV.luzPersonaje({x:0,y:0},x,HY,0).calor;
    if(previo!==null) salto=Math.max(salto,Math.abs(k-previo));
    previo=k;
  }
  console.log('  caminando de a 5 cm, la luz que recibe cambia como mucho '+salto.toFixed(3)+' por paso');
  probar('caminando, la luz del fuego sobre ella cambia sin saltos', salto<0.012);
  const quieta=NV.luzPersonaje({x:HX+3,y:HY},HX+3,HY,0).calor;
  const igual=Math.min(1,NV.fuegoEn(HX+3,HY)*(1.55-Math.min(1,NV.luz.amb)*0.95)*NV.titilar(0)*0.40);
  probar('parada en un metro recibe lo mismo que antes', Math.abs(quieta-igual)<1e-6);
}

console.log('\n'+ok.length+' comprobaciones pasaron'+(mal.length?', '+mal.length+' FALLARON:':''));
mal.forEach(t=>console.log('  ✗ '+t));
process.exit(mal.length?1:0);

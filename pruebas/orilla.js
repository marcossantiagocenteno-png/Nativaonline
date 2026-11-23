// La orilla y los reflejos.
//
// La costa se definía con una letra por metro, así que una orilla que dobla
// salía como escalera de un metro de paso. Y el agua no devolvía nada: un árbol
// a la orilla se plantaba sobre ella sin dejar rastro.
//
// Se miden en un mundo sintético donde se conoce la respuesta: una costa en
// diagonal de pendiente exacta, y un árbol real con agua al sur. Siempre se
// compara contra lo que había antes, porque un número suelto no dice nada.
const cargar=require('./cargar.js');
const m=cargar(`module.exports={
  NV:window.NV, draw_, tictac,
  ponerYo:(x,y)=>{ me.x=x; me.y=y; NV.camXf=undefined; NV.camYf=undefined; },
  espiarSuelo:f=>{ const o=celdaSuelo; celdaSuelo=function(mt,wx,wy,cx,cyb,l,c,t){
      const r=o(mt,wx,wy,cx,cyb,l,c,t); f(wx,wy,!!mt.ola,l); return r; }; },
  espiarEspuma:f=>{ if(typeof espumar==='undefined') return false;
      const o=espumar; espumar=function(wx,wy,cx,cyb,c,t){ const antes=_cc; o(wx,wy,cx,cyb,c,t);
        if(_cc!==antes) f(wx,wy); }; return true; },   // solo cuenta la que de verdad pintó espuma
  estado:()=>({fbG,fbC,fbL,cols,rowsN,CPM,RPM,HPM,camX,camY}),
  CPM:()=>CPM, RPM:()=>RPM, HPM:()=>HPM,
  /* le da a dibujarReflejo una lista de casillas inventadas, en vez de las de un árbol */
  reflejarDirecto:(tr,br,t,celdas)=>{
    for(let q=0;q<celdas.length;q++){ const c=celdas[q]; gB[q*4]=c[0]; gB[q*4+1]=c[1]; gB[q*4+2]=c[2]; gB[q*4+3]=c[3]; }
    gn=celdas.length; dibujarReflejo(tr,br,t);
  }
};`);
const NV=m.NV;
const ok=[],mal=[]; const probar=(t,c)=>(c?ok:mal).push(t);
m.tictac();
NV.actualizarCielo(Date.UTC(2026,4,1,0,0,0));
const sueloReal=NV.sueloEn, objetosReal=NV.objetosEn;
const sinFuego=()=>{ NV.fuegoEn=()=>0; NV.calorCerca=()=>false; NV.calorEn=()=>0; };
sinFuego();

/* Una costa en diagonal: agua al sur de la recta, arena al norte. */
function costa(pend){
  const Y0=52, X0=50;
  NV.sueloEn=(x,y)=> y>Y0+pend*(x-X0) ? 'a' : 's';
  NV.objetosEn=()=>[];
  const CPM=m.CPM(), reg=new Map(), espuma=[], tierra=[];
  m.espiarSuelo((wx,wy,agua,l)=>{
    const k=Math.round(wx*CPM-0.5); let a=reg.get(k); if(!a){ a=[]; reg.set(k,a); }
    a.push([wy,agua,l]);
  });
  const hayEspuma=m.espiarEspuma((wx,wy)=>espuma.push([wx,wy]));
  m.ponerYo(55,52); m.draw_();
  /* por columna: dónde cruza de tierra a agua */
  const borde=new Map(), dev=[];
  for(const [k,a] of reg){
    const wx=(k+0.5)/CPM; if(wx<47||wx>63) continue;
    a.sort((p,q)=>p[0]-q[0]);
    for(let i=1;i<a.length;i++) if(!a[i-1][1]&&a[i][1]){ borde.set(k,(a[i-1][0]+a[i][0])/2); break; }
  }
  const ks=[...borde.keys()].sort((a,b)=>a-b);
  for(const k of ks){ const wx=(k+0.5)/CPM; dev.push(borde.get(k)-(Y0+pend*(wx-X0))); }
  const media=dev.reduce((a,b)=>a+b,0)/dev.length;
  const res=dev.map(d=>d-media);
  const rms=Math.sqrt(res.reduce((a,b)=>a+b*b,0)/res.length);
  let salto=0; for(let i=1;i<res.length;i++) salto=Math.max(salto,Math.abs(res[i]-res[i-1]));
  /* la franja de espuma: ¿a qué distancia del borde, del lado del agua? */
  let lejosEsp=0; for(const [wx,wy] of espuma){
    const k=Math.round(wx*CPM-0.5), b=borde.get(k); if(b===undefined) continue;
    lejosEsp=Math.max(lejosEsp,wy-b);
  }
  /* la arena mojada: la luz de la tierra pegada al borde contra la de más adentro */
  let sc=0,nc=0,sl=0,nl=0;
  for(const [k,a] of reg){
    const b=borde.get(k); if(b===undefined) continue;
    for(const [wy,agua,l] of a){
      if(agua) continue;
      const d=b-wy;
      if(d>0&&d<0.20){ sc+=l; nc++; } else if(d>0.45&&d<0.80){ sl+=l; nl++; }
    }
  }
  return {rms, salto, pend, rpm:m.RPM(), espuma:espuma.length, hayEspuma, lejosEsp, mojada:nc&&nl?(sc/nc)/(sl/nl):1, nc, nl};
}

console.log('=== la orilla es una curva, no una escalera ===');
const R={};
for(const p of [0.35,0.15,0.8]){
  const r=costa(p); R[p]=r;
  console.log('  costa de pendiente '+p+': irregularidad '+r.rms.toFixed(3)+' m · salto mayor entre columnas vecinas '
              +r.salto.toFixed(3)+' m');
  probar('pendiente '+p+': la orilla no se desvía en escalones', r.rms<0.22 && r.salto<0.30);
}
console.log('  (con una letra por metro: 0,31 a 0,35 de irregularidad y 0,84 a 0,98 de salto)');

console.log('\n=== espuma del lado del agua, arena mojada del lado de la tierra ===');
{
  const r=R[0.35];
  console.log('  casillas de espuma '+r.espuma+' · la más lejana a '+r.lejosEsp.toFixed(3)
              +' m del borde · la tierra pegada al borde recibe '+(r.mojada*100).toFixed(0)+'% de la luz de la de más adentro');
  probar('hay una franja de espuma', r.hayEspuma && r.espuma>150);
  /* La banda llega a 0,22 m en perpendicular (0,13 + 0,09). Medida en vertical sobre
     una pendiente, 0,22/cos; y el borde se estima como el punto medio entre dos
     filas, así que la medición tiene un error de hasta una fila (1/RPM m), que
     crece al acercar el zoom. Ese error NO es espuma de más. */
  const limite=0.22/Math.cos(Math.atan(r.pend))+1/r.rpm+0.01;
  console.log('  límite: banda 0,22 m en vertical ('+(0.22/Math.cos(Math.atan(r.pend))).toFixed(3)+') + una fila ('
              +(1/r.rpm).toFixed(3)+' m, con '+r.rpm+' filas por metro) = '+limite.toFixed(3)+' m');
  probar('la espuma se pega a la orilla', r.hayEspuma && r.lejosEsp<limite);
  probar('la arena pegada al agua está más oscura (mojada)', r.nc>10 && r.nl>10 && r.mojada<0.85);
}

console.log('\n=== los reflejos ===');
/* La niebla del cuadro lava todo lo que está en las capas 0 y 1, y el reflejo es
   de la capa 1: igual que lava el agua de al lado, lo que es correcto, pero
   tapa lo que se quiere medir. Se apaga solo para esta sección. */
NV.nieblaEn=()=>0;
function reflejos(conAgua){
  NV.sueloEn=(x,y)=> conAgua && y>=58 ? 'L' : 'g';
  NV.objetosEn=()=>[{x:56,y:56,h:4.5,k:'arbol',sp:'encino',s:424242}];   // un encino de 4,5 m, armado por la prueba: no depende del bosque sorteado
  m.ponerYo(56,58); m.draw_();
  const E=m.estado();
  const br=(56-E.camY)*E.RPM+E.RPM-1;
  const arbol=[], reflejo=[];
  for(let r=0;r<E.rowsN;r++) for(let c=0;c<E.cols;c++){
    const i=r*E.cols+c; if(!E.fbG[i]) continue;
    if(E.fbL[i]===2) arbol.push([c,r,E.fbC[i]]);
    if(E.fbL[i]===1) reflejo.push([c,r,E.fbC[i]]);
  }
  let fuera=0;
  for(const [c,r] of reflejo){
    const mx=E.camX+Math.floor(c/E.CPM), my=E.camY+Math.floor(r/E.RPM);
    if(NV.sueloEn(mx,my)!=='L') fuera++;
  }
  return {E,br,arbol,reflejo,fuera};
}
{
  const con=reflejos(true), sin=reflejos(false);
  const E=con.E, br=con.br;
  const altoArbol=br-Math.min(...con.arbol.map(a=>a[1]));
  const baja=Math.max(...con.reflejo.map(a=>a[1]))-br;
  console.log('  el árbol sube '+altoArbol+' filas sobre su base; el reflejo baja '+baja+' filas ('+con.reflejo.length
              +' casillas); sin agua, '+sin.reflejo.length);
  probar('con agua al sur hay reflejo', con.reflejo.length>200);
  probar('sin agua no hay reflejo', sin.reflejo.length===0);
  probar('el reflejo mide lo mismo que el árbol (espejado)', Math.abs(baja-altoArbol)<=3);
  /* solo sobre agua */
  console.log('  casillas de reflejo fuera del agua: '+con.fuera);
  probar('el reflejo solo cae sobre el agua', con.fuera===0);
  /* más oscuro y más frío que el original */
  const lum=c=>(((c>>16)&255)+((c>>8)&255)+(c&255))/3;
  const prom=a=>a.reduce((s,x)=>s+lum(x[2]),0)/a.length;
  const rojo=a=>a.reduce((s,x)=>s+((x[2]>>16)&255),0)/a.length, azul=a=>a.reduce((s,x)=>s+(x[2]&255),0)/a.length;
  console.log('  luminosidad: árbol '+prom(con.arbol).toFixed(0)+' · reflejo '+prom(con.reflejo).toFixed(0)
              +' · el reflejo tiene rojo '+rojo(con.reflejo).toFixed(0)+' y azul '+azul(con.reflejo).toFixed(0));
  /* de noche el agua devuelve algo de cielo, así que puede salir un poco más clara que un árbol
     casi negro; lo que no puede es brillar (antes, con un brillo fijo, salía a 2,2 veces) */
  probar('de noche el reflejo no brilla más que el árbol', prom(con.reflejo)<=prom(con.arbol)*1.6);
  probar('el reflejo es frío (más azul que rojo)', azul(con.reflejo)>rojo(con.reflejo));
  /* el reflejo no pisa al árbol */
  const igual=con.arbol.length===sin.arbol.length;
  probar('el reflejo no cambia el árbol', igual);
}

{
  NV.actualizarCielo(Date.UTC(2026,4,1,0,0,0)+4*30*86400e3/430/8);       // pleno día
  const dia=reflejos(true);
  const lum=c=>(((c>>16)&255)+((c>>8)&255)+(c&255))/3;
  const prom=a=>a.reduce((s,x)=>s+lum(x[2]),0)/a.length;
  console.log('  de día: árbol '+prom(dia.arbol).toFixed(0)+' · reflejo '+prom(dia.reflejo).toFixed(0));
  probar('de día hay reflejo y es más oscuro que el árbol', dia.reflejo.length>200 && prom(dia.reflejo)<prom(dia.arbol)*0.95);
  /* Se apaga con la distancia al pie. Con el árbol real no se puede aislar: la
     copa es más clara que el tronco y compensa lo que la fórmula apaga. Se le da
     a dibujarReflejo una columna de casillas grises iguales a todas las alturas. */
  NV.sueloEn=(x,y)=> y>=58 ? 'L' : 'g';
  NV.objetosEn=()=>[];
  m.ponerYo(56,58); m.draw_();
  const E=m.estado(), br=(56-E.camY)*E.RPM+E.RPM-1, c0=(56-E.camX)*E.CPM+Math.floor(E.CPM/2);
  const gris=(220<<16)|(220<<8)|220, celdas=[], ALTO=Math.max(4,Math.round(4.5*E.HPM));   // las filas de un árbol de 4,5 m con este zoom
  for(let h=0;h<=ALTO;h++) for(let dc=-3;dc<=3;dc++) celdas.push([c0+dc,br-h,35,gris]);
  m.reflejarDirecto({h:4.5},br,0,celdas);
  const E2=m.estado(), rojo=c=>(c>>16)&255;
  const banda=(a,b)=>{ let s2=0,n=0;
    for(let h=Math.round(ALTO*a);h<Math.round(ALTO*b);h++){
      const r2=br+1+h;
      for(let c=0;c<E2.cols;c++){ const i=r2*E2.cols+c; if(E2.fbL[i]===1&&E2.fbG[i]){ s2+=rojo(E2.fbC[i]); n++; } }
    }
    return n?{v:s2/n,n}:{v:0,n:0}; };
  const b1=banda(0.20,0.40), b2=banda(0.60,0.80), b3=banda(0.80,1.0);
  console.log('  una fuente gris de 220: el agua devuelve '+b1.v.toFixed(0)+' a un cuarto de la altura, '
              +b2.v.toFixed(0)+' a tres cuartos, '+b3.v.toFixed(0)+' en la punta');
  probar('el reflejo se apaga con la distancia al pie', b1.n>20&&b2.n>20&&b3.n>10 && b2.v<b1.v*0.75 && b3.v<=b2.v);
}

console.log('\n'+ok.length+' comprobaciones pasaron'+(mal.length?', '+mal.length+' FALLARON:':''));
mal.forEach(t=>console.log('  ✗ '+t));
process.exit(mal.length?1:0);

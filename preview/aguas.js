/* Nativa Online — LABORATORIO DE AGUAS CONTINENTALES (independiente del juego).
   Todo lo que se ve lo calcula el motor (NV.aguas) en este momento, cuadro a cuadro: ninguna muestra es una imagen guardada y
   cada control cambia un parámetro real del motor o de lo que el motor LEE (viento, luz, clima).
   El viento y la luz son los del entorno compartido (el proveedor es un simulado con las mismas funciones que el real);
   el clima NO existe todavía en el juego: acá lo simulan los deslizadores a través de NV.aguas.usarClima.
   Vistas: Muestrario (las 20 muestras, animadas) · Banco (todo junto y editable, con el personaje controlable). */
(function(){
'use strict';
const NV=window.NV, A=NV.aguas, EN=NV.entorno, AR=NV.arbolado, RO=NV.rocoso;
const CPM=13, RPM=4, HPM=6.8, ASP=1.393, FONT_K=1/0.42, TAU=Math.PI*2;
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const pack=(r,g,b)=>(clamp(r|0,0,255)<<16)|(clamp(g|0,0,255)<<8)|clamp(b|0,0,255);
const tn=NV.makeNoise(NV.mulberry(4417));
const h3=(a,b,c)=>{ let x=((a|0)*374761393+((b|0)*668265263)+((c|0)*2246822519))>>>0; x=((x^(x>>>13))*1274126177)>>>0; return ((x^(x>>>16))>>>0)&0x7fffffff; };

/* ---------------------------------------------------------------- el ambiente simulado (viento, luz, clima) ---- */
const LUZ={dx:1,dy:0.45,porMetro:0.8,amb:1,r:1,g:0.98,b:0.86};
const CLIMA={lluvia:0,tormenta:0,niebla:0,nubes:0.35};
const VIENTO={modo:'calma',desde:0,fin:-1e9};      // calma | brisa | moderado | rafagas | cesa
/* intensidad del viento en x al instante t: la ráfaga entra por el este y cruza hacia el oeste (como la del viento real) */
function intensidadViento(x,t){
  const m=VIENTO.modo;
  if(m==='calma') return 0.02*(0.5+0.5*Math.sin(t*0.7+x*0.3));
  if(m==='brisa') return 0.30+0.06*Math.sin(t*0.9+x*0.2);
  if(m==='moderado') return 0.62+0.10*Math.sin(t*1.1+x*0.15);
  if(m==='rafagas'){ const tc=(((t+(x-30)/9)%14)+14)%14, g=tc<8?0.30:tc<10.5?0.30+0.78*Math.sin((tc-8)/2.5*Math.PI/2):0.30+0.78*Math.max(0,1-(tc-10.5)/3.5); return clamp(g,0,1.15); }
  if(m==='cesa') return 0;
  return 0;
}
const prov=EN.simulado({viento:{valor:0,ciclo:0},luz:LUZ});
prov.viento=(tipo,x,y,t)=>({mov:0,osc:0,I:intensidadViento(x,t),f:0});
prov.luz=()=>{ const S={dx:LUZ.dx,dy:LUZ.dy,porMetro:LUZ.porMetro}, amb=LUZ.amb; const l=EN._derivar(S,amb,{r:LUZ.r*amb,g:LUZ.g*amb,b:LUZ.b*amb}); l.firma=[S.dx,S.dy,S.porMetro,amb,LUZ.r,LUZ.g,LUZ.b].join('|'); return l; };
EN.usar(prov);
A.usarClima(()=>CLIMA);
const reloj=()=>performance.now()/1000;

/* ---------------------------------------------------------------- suelo y escena ---- */
function sueloBase(cols,rows,sem,arena){
  const G=new Uint16Array(cols*rows), C=new Int32Array(cols*rows);
  const PS=arena?[[150,132,96],[168,148,106],[184,164,120],[198,178,134]]:[[36,50,32],[50,68,40],[68,88,50],[88,108,62]];
  const gl=arena?['.',',',':','`']:[',','.',':','`'];
  for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){
    const i=r*cols+c, n=tn(c*0.21+sem,r*0.33,1,1), h=h3(c,r,sem)%100;
    if(h<(arena?55:66)){ const p=PS[Math.min(3,(n*4)|0)]; G[i]=gl[h%4].charCodeAt(0); C[i]=pack(p[0],p[1],p[2]); }
  }
  return {G,C};
}
const sueloCache=new Map();
function suelo(def){ const k=[def.mw,def.mh,def.sem||3,def.arena?1:0].join('|'); let s=sueloCache.get(k); if(!s){ s=sueloBase(Math.round(def.mw*CPM),Math.round(def.mh*RPM),def.sem||3,def.arena); sueloCache.set(k,s); } return s; }

/* los objetos que se reflejan: se dibujan en un búfer aparte y GRABAN lo que escriben, con la fila de su base */
const ROCAS={};
function roca(sem,tam){ const k=sem+tam; return ROCAS[k]||(ROCAS[k]=RO.crearRoca({mat:'granito',tam:tam||'media',forma:'irregular',sem:sem,escala:1,yaw:0,estado:{musgo:0.2,liquen:0.1,humedad:0.4,erosion:0,enterrada:0}})); }
const ARBOLES={};
function arbol(fam,sem){ const k=fam+sem; return ARBOLES[k]||(ARBOLES[k]=AR.generar(fam,'mediano',sem,{variante:0})); }

function dibujarJugador(ctx,fase,mov){
  /* un monito de 1,75 m con la cámara oblicua: sólo para el laboratorio (el juego usa el sprite del personaje con el mismo grabador) */
  const alto=Math.round(1.75*HPM), br=ctx.br, bc=ctx.bc, col=pack(232,226,210), col2=pack(196,186,168), put=ctx.put;
  const sw=mov?Math.round(Math.sin(fase*6.2)*1.2):0;
  for(let k=0;k<alto*0.46;k++) put(bc+(k<alto*0.2?0:(k%2?sw:-sw)),br-k,k<alto*0.18?124:124,col2);            // piernas
  for(let k=Math.round(alto*0.46);k<alto*0.82;k++) put(bc,br-k,124,col);                                    // torso
  put(bc-1,br-Math.round(alto*0.74),47,col); put(bc+1,br-Math.round(alto*0.74),92,col);                   // brazos
  if(mov){ put(bc-2,br-Math.round(alto*0.62),47,col2); put(bc+2,br-Math.round(alto*0.62),92,col2); }
  put(bc,br-Math.round(alto*0.9),79,col);                                                                   // cabeza
  put(bc,br-Math.round(alto*0.97),95,col2);
}
function dibujarMontana(ctx,ancho,alto,sem){
  const put=ctx.put, bc=ctx.bc, br=ctx.br;
  for(let c=0;c<ancho*CPM;c++){
    const u=c/(ancho*CPM), h=Math.round((0.35+0.65*Math.pow(tn(u*3.2+sem,1.5,1,1),1.2))*Math.sin(Math.PI*clamp(u,0,1))**0.5*alto*HPM);
    for(let k=0;k<h;k++){
      const q=k/Math.max(1,h), nieve=q>0.82;
      const code=nieve?35:q>0.5?65:q>0.2?94:58, v=0.5+0.5*tn(c*0.08,k*0.15+sem,1,1);
      put(bc+c,br-k,code,nieve?pack(226,232,240):pack(70+36*v*(1-q),84+34*v*(1-q),104+30*v));
    }
  }
}
/* ---- una escena: suelo + objetos + agua con reflejos + cascadas ---- */
function Escena(def){
  this.def=def; this.cols=Math.round(def.mw*CPM); this.rows=Math.round(def.mh*RPM);
  this.G=new Uint16Array(this.cols*this.rows); this.C=new Int32Array(this.cols*this.rows);
  this.FB=new Int32Array(this.cols*this.rows); this.OG=new Uint16Array(this.cols*this.rows); this.OC=new Int32Array(this.cols*this.rows);
  this.SK=new Float32Array(this.cols*this.rows);
  this.rec=new Int32Array(5*60000); this.nrec=0;
  this.est=null; this.jug={x:def.jugador?def.jugador.x:0,y:def.jugador?def.jugador.y:0,fase:0,mov:false};
}
Escena.prototype.render=function(t,opt){
  const d=this.def, cols=this.cols, rows=this.rows, s=suelo(d);
  const G=this.G, C=this.C, OG=this.OG, OC=this.OC, SK=this.SK, self=this;
  this.FB.fill(0); G.set(s.G); C.set(s.C); OG.fill(0); SK.fill(0); this.nrec=0;
  const rec=this.rec;
  let grabar=false, baseR=0;
  const put=(c,r,code,col)=>{
    if(c<0||c>=cols||r<0||r>=rows||code===32) return; const i=r*cols+c; OG[i]=code; OC[i]=col;
    if(grabar&&self.nrec<59990){ const q=self.nrec++*5; rec[q]=c; rec[q+1]=r; rec[q+2]=code; rec[q+3]=col; rec[q+4]=baseR; }
  };
  const sombrear=(c,r,k)=>{ if(c<0||r<0||c>=cols||r>=rows) return; const i=r*cols+c; if(k>SK[i]) SK[i]=k; };
  const ctxDe=(x,y)=>({x:60+x,y:60+y,t:t,CPM,HPM,RPM,bc:Math.round(x*CPM),br:Math.round(y*RPM)-1,put,cols,rows,detalle:2,contorno:true,pasto:0.3,sombrear});
  const objs=(d.objetos||[]).slice();
  if(d.jugador){ const J=this.jug; objs.push({tipo:'jugador',x:J.x,y:J.y}); }
  objs.sort((a,b)=>a.y-b.y);
  for(const o of objs){
    const ctx=ctxDe(o.x,o.y); baseR=ctx.br; grabar=o.refleja!==false;
    if(o.tipo==='arbol'){ const T=arbol(o.fam||'encino',o.sem||9); AR.pintarSombra(T,ctx); AR.pintar(T,ctx); }
    else if(o.tipo==='roca'){ const S=roca(o.sem||11,o.tam); RO.pintarSombra(S,ctx); RO.pintar(S,ctx); }
    else if(o.tipo==='montana'){ dibujarMontana(ctx,o.ancho,o.alto,o.sem||1); }
    else if(o.tipo==='acantilado'){ acantilado(ctx,o); }
    else if(o.tipo==='jugador'){ dibujarJugador(ctx,this.jug.fase,this.jug.mov); }
    grabar=false;
  }
  /* sombras proyectadas: sobre el suelo y, pasadas al motor, sobre el agua */
  for(let i=0;i<SK.length;i++){ const k=SK[i]; if(k>0&&G[i]){ const f=1-k, v=C[i]; C[i]=pack(((v>>16)&255)*f,((v>>8)&255)*(f+0.02),(v&255)*(f+0.05)); } }
  const sc={G,C,cols,rows,CPM,RPM,HPM,x0:0,y0:0,t:t,reflejables:{n:this.nrec,B:rec},sombras:[{c0:0,r0:0,w:cols,h:rows,k:SK}],opciones:opt||{},fondo:(c,r,col)=>{ self.FB[r*cols+c]=col; }};
  const cuerpos=d.cuerpos, nc=cuerpos.length;
  A.pintar(sc,cuerpos);
  for(const c of cuerpos) if(c.tipo==='cascada') A.pintarEspumaCascada(sc,c);
  /* lo que está en pie se pinta por encima del agua; el acantilado de las cascadas, también (la lámina cae delante) */
  for(let i=0;i<OG.length;i++) if(OG[i]){ G[i]=OG[i]; C[i]=OC[i]; }
  for(const c of cuerpos) if(c.tipo==='cascada') A.pintarCascada(sc,c);
  return {cols,rows,G,C,FB:this.FB};
};
function acantilado(ctx,o){
  const put=ctx.put, bc=ctx.bc, br=ctx.br, w=Math.round(o.ancho*CPM), h=Math.round(o.alto*HPM);
  for(let c=-Math.round(w/2);c<w/2;c++) for(let k=0;k<h;k++){
    const q=k/h, estr=0.5+0.5*Math.sin(k*0.55+tn(c*0.05,k*0.04,1,1)*5), n=tn(c*0.11+3,k*0.17,1,1);
    const code=n>0.62?35:n>0.42?77:n>0.26?37:65, v=0.45+0.4*n+0.12*estr;
    put(bc+c,br-k,code,pack(108*v*(1-0.25*q),100*v*(1-0.25*q),90*v*(1-0.2*q)));
  }
}

/* ---------------------------------------------------------------- las 20 muestras ---- */
const blob=(cx,cy,rx,ry,n,sem)=>{ const P=[]; for(let i=0;i<n;i++){ const a=i/n*TAU, k=0.82+0.36*((h3(i,sem,5)%1000)/1000); P.push([cx+Math.cos(a)*rx*k,cy+Math.sin(a)*ry*k]); } return P; };
const arbolesN=(xs,y,sem)=>xs.map((x,i)=>({tipo:'arbol',x,y:y+((h3(i,sem,3)%100)/100-0.5)*0.9,fam:i%2?'pino':'encino',sem:sem+i}));
const rocasEn=pts=>pts.map((p,i)=>({tipo:'roca',x:p[0],y:p[1],sem:11+i*3,tam:p[2]||'pequena'}));
const MW=26, MH=12;
function muestras(){
  const L=[];
  const m=(titulo,def,amb,pie)=>L.push({titulo,def:Object.assign({mw:MW,mh:MH},def),amb:amb||{},pie:pie||''});
  m('1 · Charco tranquilo',{cuerpos:[A.crear('charco',{poligono:blob(13,6.4,3.4,1.8,12,3),sem:3})],objetos:rocasEn([[8,3.5],[19,9.5]]).concat([{tipo:'arbol',x:21,y:4.2,fam:'encino',sem:4}])},{viento:'calma'},'prof. 12 cm · barro y piedras al borde');
  m('2 · Charco con viento',{cuerpos:[A.crear('charco',{poligono:blob(13,6.4,3.4,1.8,12,3),sem:3})],objetos:rocasEn([[8,3.5],[19,9.5]]).concat([{tipo:'arbol',x:21,y:4.2,fam:'encino',sem:4}])},{viento:'moderado'},'las ondas viajan hacia el oeste');
  const lagoP=blob(13,14.2,10.5,4.8,18,5);
  m('3 · Lago en calma',{mh:20,cuerpos:[A.crear('lago',{poligono:lagoP,sem:5})],objetos:arbolesN([3,7,12,17,22],9.0,20)},{viento:'calma'},'prof. máx. 4,5 m');
  m('4 · Lago con brisa',{mh:20,cuerpos:[A.crear('lago',{poligono:lagoP,sem:5})],objetos:arbolesN([3,7,12,17,22],9.0,20)},{viento:'brisa'});
  m('5 · Lago con ráfagas',{mh:20,cuerpos:[A.crear('lago',{poligono:lagoP,sem:5})],objetos:arbolesN([3,7,12,17,22],9.0,20)},{viento:'rafagas'},'ciclo de 14 s: calma, ráfaga, calma');
  m('6 · Laguna con distintas profundidades',{cuerpos:[A.crear('laguna',{poligono:blob(13,6.5,9.5,4.6,22,9),sem:9,prof:3.6,claridad:2.0})]},{viento:'calma'},'poco hondo en la orilla, hondo adentro');
  m('7 · Arroyo de corriente suave',{arena:false,cuerpos:[A.crear('arroyo',{curso:{puntos:[[-1,3],[6,5],[13,6.5],[20,8.5],[27,8]],anchos:[1.3,1.6,1.4,1.9,1.5]},sem:7,vel:0.5})]},{viento:'brisa'},'0,5 m/s, hacia el este');
  const pied=[{x:9,y:5.6,r:0.4},{x:14.5,y:6.3,r:0.35},{x:19,y:8.7,r:0.45},{x:6,y:4.8,r:0.25,sum:true},{x:12,y:7.3,r:0.28,sum:true},{x:17,y:7.4,r:0.3,sum:true},{x:22,y:8.4,r:0.25,sum:true}];
  m('8 · Riachuelo con piedras',{cuerpos:[A.crear('riachuelo',{curso:{puntos:[[-1,3],[6,5],[13,6.5],[20,8.5],[27,8]],anchos:[2.8,3.2,3.0,3.6,3.2]},sem:8,vel:0.8,piedras:pied})],
    objetos:pied.filter(p=>!p.sum).map((p,i)=>({tipo:'roca',x:p.x,y:p.y+0.15,sem:21+i,tam:'pequena'}))},{viento:'brisa'},'las piedras dividen la corriente');
  const pr=[{x:8,y:5.2,r:0.55},{x:16,y:6.8,r:0.5}];
  m('9 · Río de corriente moderada',{cuerpos:[A.crear('rio',{curso:{puntos:[[-1,2.2],[7,4],[14,6],[21,8.6],[27,9.2]],anchos:[6.5,7.5,6.8,8.2,7.4]},sem:11,vel:1.0,piedras:pr})],objetos:pr.map((p,i)=>({tipo:'roca',x:p.x,y:p.y+0.2,sem:31+i,tam:'media'}))},{viento:'brisa'},'1 m/s, más rápido al centro');
  m('10 · Río profundo',{mh:20,cuerpos:[A.crear('rio-profundo',{curso:{puntos:[[-1,3],[7,4.5],[14,6.2],[21,8.2],[27,8.8]],anchos:[8,9.5,8.5,10,9]},sem:12,vel:0.8})],objetos:arbolesN([3,8,16,22],4.0,40)},{viento:'brisa'},'prof. 5,5 m: fondo invisible');
  m('11 · Agua transparente poco profunda',{arena:true,cuerpos:[A.crear('lago',{poligono:blob(13,6.5,9.5,4.2,18,13),sem:13,prof:0.7,claridad:5,opacidad:0.04,tono:0.15,talud:3,piedras:Array.from({length:10},(_,i)=>({x:5+((h3(i,2,2)%1000)/1000)*16,y:3.6+((h3(i,3,3)%1000)/1000)*5.8,r:0.2+((h3(i,4,4)%100)/100)*0.2,sum:true}))})]},{viento:'brisa'},'se ve el fondo: arena, grava y piedras');
  m('12 · Agua azul oscura profunda',{mh:20,cuerpos:[A.crear('lago',{poligono:blob(13,14.4,10,4.8,18,14),sem:14,prof:9,claridad:0.5,opacidad:0.6,tono:1,talud:6})],objetos:arbolesN([3,8,13,18,23],9.0,50)},{viento:'brisa'},'prof. 9 m: sólo superficie y reflejos');
  m('13 · Cascada pequeña',{mh:14,arena:false,cuerpos:[A.crear('laguna',{poligono:blob(13,9.8,6.4,2.6,16,15),sem:15,prof:1.3,claridad:1.2}),A.crear('cascada',{x:13,y:8.1,ancho:2.2,alto:2.4,intensidad:0.7,sem:3})],objetos:[{tipo:'acantilado',x:13,y:8.0,ancho:12,alto:3.2,refleja:true}]},{viento:'calma'},'2,4 m de caída');
  m('14 · Cascada grande',{mh:25,cuerpos:[A.crear('laguna',{poligono:blob(13,20.2,7.2,3.1,18,16),sem:16,prof:2.6,claridad:1.0}),A.crear('cascada',{x:13,y:18.6,ancho:4,alto:9,intensidad:1.1,sem:4})],objetos:[{tipo:'acantilado',x:13,y:18.5,ancho:18,alto:10.5}]},{viento:'calma'},'9 m de caída, rocío y espuma');
  m('15 · Reflejo de árboles',{mh:22,cuerpos:[A.crear('lago',{poligono:blob(13,16.2,10.5,4.6,18,17),sem:17,prof:3})],objetos:arbolesN([2.5,6.5,10.5,15,19,23.5],10.4,60)},{viento:'calma'},'mirá el espejo');
  m('16 · Reflejo de montañas',{mh:16,cuerpos:[A.crear('lago',{poligono:blob(13,11.2,11.5,3.9,18,18),sem:18,prof:4})],objetos:[{tipo:'montana',x:0.5,y:6.0,ancho:25,alto:3.4,sem:3}]},{viento:'calma',nubes:0.5},'montañas lejanas sobre el agua');
  m('17 · Reflejo del personaje',{mh:18,cuerpos:[A.crear('lago',{poligono:blob(13,11.6,11.5,4.6,18,19),sem:19,prof:3.4})],objetos:arbolesN([3,23],7.0,70),jugador:{x:6,y:7.0,ruta:[[5,7.0],[20,7.0]]}},{viento:'calma'},'el reflejo sigue al personaje');
  m('18 · Ondas por contacto',{cuerpos:[A.crear('laguna',{poligono:blob(13,6.5,10,4.4,20,20),sem:20,prof:0.5,claridad:2.4,talud:2.4,tono:0.4})],jugador:{x:3,y:6.4,ruta:[[3,6.4],[8,6.4],[13,6.4],[18,6.4],[18,6.4],[8,6.4],[1,6.4]],corre:[2,3]}},{viento:'calma'},'entra, camina, corre, queda quieto, sale');
  m('19 · Agua con lluvia',{mh:20,cuerpos:[A.crear('lago',{poligono:blob(13,7,10.5,4.2,18,5),sem:5})],objetos:arbolesN([3,7,12,17,22],9.0,20)},{viento:'brisa',lluvia:0.8,nubes:0.9,niebla:0.15},'gotas que abren anillos');
  m('20 · Cambios de iluminación',{mh:20,cuerpos:[A.crear('lago',{poligono:blob(13,7,10.5,4.2,18,5),sem:5})],objetos:arbolesN([3,7,12,17,22],9.0,20)},{viento:'brisa',luzCiclo:true},'sol y luz que recorren el día (ciclo de 24 s)');
  return L;
}

/* ---------------------------------------------------------------- el ambiente de cada muestra ---- */
function aplicarAmbiente(amb,t){
  VIENTO.modo=amb.viento||'calma';
  CLIMA.lluvia=amb.lluvia||0; CLIMA.tormenta=amb.tormenta||0; CLIMA.niebla=amb.niebla||0; CLIMA.nubes=amb.nubes==null?0.35:amb.nubes;
  if(amb.luzCiclo){
    const u=((t%24)/24), dia=0.5-0.5*Math.cos(u*TAU), ang=u*TAU;
    LUZ.amb=0.16+0.98*dia; LUZ.dx=-Math.cos(ang)*1.4; LUZ.dy=0.3+0.2*Math.sin(ang); LUZ.porMetro=0.5+1.6*(1-dia);
    const k=clamp((dia-0.15)/0.6,0,1); LUZ.r=0.5+0.5*k; LUZ.g=0.62+0.36*k; LUZ.b=0.95-0.09*k;
  } else { LUZ.dx=1; LUZ.dy=0.45; LUZ.porMetro=0.8; LUZ.amb=1; LUZ.r=1; LUZ.g=0.98; LUZ.b=0.86; }
}
/* el personaje de la muestra camina su ruta y el motor decide qué onda produce */
function moverJugador(esc,t,dt){
  const J=esc.jug, d=esc.def.jugador; if(!d||!d.ruta) return;
  if(esc.rutaI===undefined){ esc.rutaI=1; J.x=d.ruta[0][0]; J.y=d.ruta[0][1]; esc.espera=0; }
  if(esc.espera>0){ esc.espera-=dt; J.mov=false; esc.vel=0; }
  else {
    const P=d.ruta[esc.rutaI], dx=P[0]-J.x, dy=P[1]-J.y, dist=Math.hypot(dx,dy);
    const corre=d.corre&&esc.rutaI>=d.corre[0]&&esc.rutaI<=d.corre[1], v=corre?3.4:1.5;
    if(dist<0.06){ if(d.ruta[(esc.rutaI+1)%d.ruta.length]===P||(P[0]===J.x&&P[1]===J.y&&false)) esc.espera=2; esc.rutaI=(esc.rutaI+1)%d.ruta.length; if(esc.rutaI===0){ J.x=d.ruta[0][0]; J.y=d.ruta[0][1]; esc.rutaI=1; } else if(d.ruta[esc.rutaI-1]&&d.ruta[esc.rutaI]&&d.ruta[esc.rutaI-1][0]===d.ruta[esc.rutaI][0]&&d.ruta[esc.rutaI-1][1]===d.ruta[esc.rutaI][1]) esc.espera=3; esc.vel=0; J.mov=false; }
    else { const s=Math.min(dist,v*dt); J.x+=dx/dist*s; J.y+=dy/dist*s; J.fase+=dt*(corre?1.5:0.9); J.mov=true; esc.vel=v; }
  }
  esc.est=A.actor(esc.est,esc.def.cuerpos,J.x,J.y,t,J.mov?esc.vel:0);
}

/* ---------------------------------------------------------------- dibujo en canvas ---- */
function pintarGrid(cv,g,cw){
  const chh=cw*ASP, dpr=Math.min(2,window.devicePixelRatio||1), W=Math.ceil(g.cols*cw), H=Math.ceil(g.rows*chh);
  if(cv.width!==Math.floor(W*dpr)||cv.height!==Math.floor(H*dpr)){ cv.width=Math.floor(W*dpr); cv.height=Math.floor(H*dpr); cv.style.width=W+'px'; cv.style.height=H+'px'; }
  const ctx=cv.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.fillStyle='rgb(5,9,8)'; ctx.fillRect(0,0,W,H);
  if(g.FB) for(let r=0;r<g.rows;r++) for(let c=0;c<g.cols;c++){ const f=g.FB[r*g.cols+c]; if(f){ ctx.fillStyle='rgb('+((f>>16)&255)+','+((f>>8)&255)+','+(f&255)+')'; ctx.fillRect(c*cw,r*chh,cw+0.6,chh+0.6); } }
  ctx.font=(cw*FONT_K).toFixed(2)+'px '+NV.MONO; ctx.textBaseline='middle';
  const adv=ctx.measureText('W').width, canRun=('letterSpacing' in ctx);
  if(canRun){ ctx.textAlign='left'; ctx.letterSpacing=(cw-adv).toFixed(2)+'px'; } else ctx.textAlign='center';
  const x0=canRun?(cw-adv)/2:cw/2;
  for(let r=0;r<g.rows;r++){
    const y=r*chh+chh/2; let start=-1,col=0,buf='';
    for(let c=0;c<=g.cols;c++){
      const i=r*g.cols+c, hay=c<g.cols&&g.G[i];
      if(hay&&(start<0||g.C[i]===col)){ if(start<0){ start=c; col=g.C[i]; buf=''; } buf+=String.fromCharCode(g.G[i]); continue; }
      if(start>=0){ ctx.fillStyle='rgb('+((col>>16)&255)+','+((col>>8)&255)+','+(col&255)+')';
        if(canRun) ctx.fillText(buf,start*cw+x0,y); else for(let q=0;q<buf.length;q++) ctx.fillText(buf[q],(start+q)*cw+x0,y); start=-1; }
      if(hay){ start=c; col=g.C[i]; buf=String.fromCharCode(g.G[i]); }
    }
  }
}

/* ---------------------------------------------------------------- interfaz ---- */
const ESTADO={vista:'muestrario',cw:2.4,pausa:false};
const css=document.createElement('style');
css.textContent=
 ':root{--oro:#c8a24a;--oroflojo:#6b5a2c;--dim:#8d8d86}*{box-sizing:border-box}'+
 'body{margin:0;background:#000;color:#fff;font:13px/1.45 ui-monospace,Menlo,Consolas,monospace}'+
 '#barra{position:sticky;top:0;z-index:9;display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;padding:8px 14px;background:#000;border-bottom:1px solid var(--oro)}'+
 'label{display:flex;align-items:center;gap:6px;color:var(--dim)}input[type=range]{width:110px;accent-color:var(--oro)}'+
 'button,select,input[type=number]{background:#000;color:#fff;border:1px solid var(--oro);padding:4px 9px;font:inherit;cursor:pointer;border-radius:2px}'+
 'button.on{background:var(--oro);color:#000}'+
 'h2{margin:0;padding:14px 14px 2px;font-size:13px;color:var(--oro);letter-spacing:.08em;text-transform:uppercase}'+
 'p.nota{margin:0;padding:0 14px 10px;color:var(--dim);font-size:12px;max-width:110ch}'+
 '.rejilla{display:flex;flex-wrap:wrap;gap:12px;padding:0 14px 14px;align-items:flex-start}'+
 'figure{margin:0;border:1px solid #2a2a26;background:#000}figure canvas{display:block}'+
 'figcaption{padding:5px 9px;border-top:1px solid #2a2a26;font-size:12px;display:flex;gap:8px;align-items:center;justify-content:space-between;color:var(--dim)}'+
 '.cuadro{position:relative}.rotulo{position:absolute;top:6px;left:8px;padding:2px 7px;background:#000c;border:1px solid var(--oroflojo);color:var(--oro);pointer-events:none}'+
 '#panel{width:300px;border:1px solid #2a2a26;padding:10px;display:flex;flex-direction:column;gap:7px;max-height:calc(100vh - 70px);overflow:auto;position:sticky;top:56px}'+
 '#panel h3{margin:6px 0 0;font-size:12px;color:var(--oro);font-weight:normal;letter-spacing:.06em;text-transform:uppercase}'+
 '#panel .p{display:grid;grid-template-columns:1fr 54px;gap:2px 8px;align-items:center}#panel .p span{color:var(--dim);font-size:12px}'+
 '#panel .p b{text-align:right;color:var(--oro);font-weight:normal}#panel .p input{grid-column:1/3;width:100%}#panel select{width:100%}'+
 '#panel .bt{display:flex;flex-wrap:wrap;gap:6px}#banco{display:flex;gap:14px;padding:10px 14px;align-items:flex-start}'+
 '#info{color:var(--dim);font-size:12px;padding:0 14px 10px}';
document.head.appendChild(css);
document.title='Laboratorio de aguas continentales — Nativa Online';
document.body.innerHTML='<div id="barra"></div><div id="cuerpo"></div>';
const $=(s,r)=>(r||document).querySelector(s);
const el=(tag,props,hijos)=>{ const e=document.createElement(tag); Object.assign(e,props||{}); (hijos||[]).forEach(h=>e.appendChild(typeof h==='string'?document.createTextNode(h):h)); return e; };

const MUESTRAS=muestras().map(s=>({s,esc:new Escena(s.def),vis:false,ult:0,cv:null,fps:0}));
let BANCO=null;

function barra(){
  const b=$('#barra'); b.innerHTML='';
  for(const [id,tx] of [['muestrario','Muestrario (20)'],['banco','Banco: todo junto y editable']]){
    const x=el('button',{textContent:tx,className:ESTADO.vista===id?'on':''}); x.onclick=()=>{ ESTADO.vista=id; dibujar(); }; b.appendChild(x);
  }
  const sl=(txt,min,max,val,fn)=>{ const l=el('label',{},[txt+' ',el('input',{type:'range',min,max,value:val})]); l.lastChild.oninput=e=>fn(+e.target.value); return l; };
  b.appendChild(sl('Escala',16,40,Math.round(ESTADO.cw*10),v=>{ ESTADO.cw=v/10; for(const m of MUESTRAS) m.ult=0; if(BANCO) BANCO.ult=0; }));
  const p=el('button',{textContent:ESTADO.pausa?'Reanudar':'Pausar',className:ESTADO.pausa?'on':''}); p.onclick=()=>{ ESTADO.pausa=!ESTADO.pausa; barra(); }; b.appendChild(p);
  b.appendChild(el('span',{id:'fps',style:'color:var(--dim)'}));
}
/* ---- muestrario ---- */
let io=null;
function muestrario(c){
  c.appendChild(el('h2',{textContent:'Muestrario de aguas continentales'}));
  c.appendChild(el('p',{className:'nota',textContent:'Las 20 muestras se calculan en vivo (sólo se anima la que está en pantalla). Cada una usa su propio viento, clima y luz: eso es lo que las diferencia. El reflejo, las ondas y las corrientes salen del motor, no de imágenes. Para tocar todo a mano, abrí el Banco.'}));
  const rej=el('div',{className:'rejilla'}); c.appendChild(rej);
  if(io) io.disconnect();
  io=('IntersectionObserver' in window)?new IntersectionObserver(es=>{ for(const e of es){ const m=MUESTRAS[+e.target.dataset.i]; m.vis=e.isIntersecting; } },{rootMargin:'200px'}):null;
  MUESTRAS.forEach((m,i)=>{
    const cv=el('canvas'); m.cv=cv; m.ult=0;
    const pie=el('span',{textContent:m.s.pie||''}), fp=el('span',{textContent:''}); m.fpEl=fp;
    const fig=el('figure',{},[el('div',{className:'cuadro'},[cv,el('span',{className:'rotulo',textContent:m.s.titulo})]),el('figcaption',{},[pie,fp])]);
    fig.dataset.i=i; rej.appendChild(fig); if(io) io.observe(fig); else m.vis=true;
  });
}
/* ---- banco ---- */
function crearBanco(){
  const pasto=[[2,8],[40,7]];
  const lago=A.crear('lago',{id:'lago',poligono:blob(17,20,13,5.5,20,31),sem:31});
  const rio=A.crear('rio',{id:'rio',curso:{puntos:[[34,0],[38,4],[44,9],[50,14],[58,17]],anchos:[5.5,6.5,6,7.5,7]},sem:32,vel:1.0,piedras:[{x:41,y:6.5,r:0.55},{x:47,y:11.7,r:0.5}]});
  const charco=A.crear('charco',{id:'charco',poligono:blob(8,31,3.2,1.6,12,33),sem:33});
  const arroyo=A.crear('arroyo',{id:'arroyo',curso:{puntos:[[22,31],[28,29],[34,28.5],[40,30]],anchos:[1.4,1.5,1.7,1.5]},sem:34,vel:0.6});
  const lag2=A.crear('laguna',{id:'laguna',poligono:blob(47,30,6.5,3.4,16,35),sem:35,prof:3});
  const casc=A.crear('cascada',{id:'cascada',x:52,y:25.3,ancho:3,alto:5,intensidad:0.9,sem:5});
  return {def:{mw:62,mh:36,cuerpos:[lago,rio,charco,arroyo,lag2,casc],
    objetos:arbolesN([3,8,14,20,27],12.4,80).concat(arbolesN([36,56],30,90)).concat([{tipo:'montana',x:2,y:6.0,ancho:30,alto:3.6,sem:7},{tipo:'acantilado',x:52,y:25.2,ancho:14,alto:6.2},
      {tipo:'roca',x:41,y:6.7,sem:51,tam:'media'},{tipo:'roca',x:47,y:11.9,sem:52,tam:'pequena'}]),
    jugador:{x:20,y:30,ruta:null}},sel:'lago',esc:null,cv:null,ult:0,teclas:{},est:null,golpes:0};
}
function parametrosDe(c){
  const R=[]; const T=A.TIPOS[c.tipo];
  if(c.tipo==='cascada'){ R.push(['alto','Altura (m)',0.8,16,0.1],['ancho','Anchura (m)',0.8,8,0.1],['intensidad','Intensidad',0.1,1.6,0.01]); return R; }
  R.push(['prof','Profundidad máx. (m)',0.05,12,0.05],['claridad','Claridad (m)',0.1,8,0.05],['opacidad','Opacidad',0,1,0.01],['tono','Tono (verde↔azul)',0,1,0.01],
    ['ondas','Intensidad de ondas',0,2,0.01],['viento','Respuesta al viento',0,1.5,0.01],['reflejo','Reflejo',0,1.5,0.01],['irreg','Orilla irregular',0,2,0.01],['humedad','Humedad de orilla (m)',0.1,2,0.05]);
  if(!T.estancada) R.push(['vel','Velocidad de corriente (m/s)',0,3,0.01]);
  return R;
}
function panelBanco(){
  const p=$('#panel'); if(!p) return; p.innerHTML='';
  const B=BANCO, cuerpos=B.def.cuerpos;
  const sl=(txt,min,max,step,get,set)=>{ const v=get(); const inp=el('input',{type:'range',min,max,step,value:v}), b=el('b',{textContent:(+v).toFixed(2)}); inp.oninput=e=>{ set(+e.target.value); b.textContent=(+e.target.value).toFixed(2); B.ult=0; }; return el('div',{className:'p'},[el('span',{textContent:txt}),b,inp]); };
  p.appendChild(el('h3',{textContent:'Viento (entorno compartido)'}));
  const vb=el('div',{className:'bt'}); for(const [k,t] of [['calma','Calma'],['brisa','Brisa'],['moderado','Moderado'],['rafagas','Ráfagas'],['cesa','Cesa']]){ const x=el('button',{textContent:t,className:VIENTO.modo===k?'on':''}); x.onclick=()=>{ VIENTO.modo=k; panelBanco(); }; vb.appendChild(x); } p.appendChild(vb);
  p.appendChild(el('h3',{textContent:'Luz (entorno compartido)'}));
  p.appendChild(sl('Cantidad',0.1,1.2,0.01,()=>LUZ.amb,v=>{ LUZ.amb=v; }));
  p.appendChild(sl('Sol (ángulo)',0,360,1,()=>((Math.atan2(LUZ.dy,LUZ.dx)*180/Math.PI)+360)%360,v=>{ const a=v*Math.PI/180; LUZ.dx=Math.cos(a)*1.1; LUZ.dy=Math.sin(a)*0.6; }));
  p.appendChild(sl('Largo de sombra',0.2,2,0.01,()=>LUZ.porMetro,v=>{ LUZ.porMetro=v; }));
  p.appendChild(el('h3',{textContent:'Clima (simulado: aún no existe el motor)'}));
  for(const [k,t] of [['lluvia','Lluvia'],['tormenta','Tormenta'],['niebla','Niebla'],['nubes','Nubes']]) p.appendChild(sl(t,0,1,0.01,()=>CLIMA[k],v=>{ CLIMA[k]=v; }));
  p.appendChild(el('h3',{textContent:'Cuerpo de agua'}));
  const s=el('select'); for(const c of cuerpos){ const o=el('option',{value:c.id,textContent:A.NOMBRES[c.tipo]+' · '+c.id}); if(c.id===B.sel) o.selected=true; s.appendChild(o); } s.onchange=()=>{ B.sel=s.value; panelBanco(); }; p.appendChild(s);
  const c=cuerpos.find(x=>x.id===B.sel);
  if(c){
    for(const [k,t,mn,mx,st] of parametrosDe(c)) p.appendChild(sl(t,mn,mx,st,()=>c[k],v=>{ c[k]=v; if(k==='prof'||k==='irreg'||k==='vel'||k==='humedad') A.tocar(c); }));
    const bt=el('div',{className:'bt'});
    const rg=el('button',{textContent:'Regenerar este sector'}); rg.onclick=()=>{ c.sem=(Math.random()*60000)|0; A.tocar(c); B.ult=0; }; bt.appendChild(rg);
    const el2=el('button',{textContent:'Eliminar'}); el2.onclick=()=>{ B.def.cuerpos=cuerpos.filter(x=>x!==c); B.sel=B.def.cuerpos.length?B.def.cuerpos[0].id:null; panelBanco(); B.ult=0; }; bt.appendChild(el2);
    p.appendChild(bt);
    if(c.tipo!=='cascada'){
      p.appendChild(el('div',{className:'p'},[el('span',{textContent:'Arrastrá los puntos dorados del mapa para cambiar el contorno o el recorrido.'})]));
      const pt=el('div',{className:'bt'});
      const ad=el('button',{textContent:'+ punto'}); ad.onclick=()=>{ const Q=A.TIPOS[c.tipo].estancada?c.poligono:c.curso.puntos, i=Math.max(0,Math.min(Q.length-1,B.pt==null?Q.length-1:B.pt)), j=(i+1)%Q.length, nuevo=[(Q[i][0]+Q[j][0])/2+0.4,(Q[i][1]+Q[j][1])/2+0.4]; Q.splice(i+1,0,nuevo); if(c.curso&&c.curso.anchos) c.curso.anchos.splice(i+1,0,c.curso.anchos[i]); A.tocar(c); B.ult=0; }; pt.appendChild(ad);
      const qu=el('button',{textContent:'− punto'}); qu.onclick=()=>{ const Q=A.TIPOS[c.tipo].estancada?c.poligono:c.curso.puntos, min=A.TIPOS[c.tipo].estancada?3:2; if(Q.length<=min) return; const i=B.pt==null?Q.length-1:B.pt; Q.splice(i,1); if(c.curso&&c.curso.anchos) c.curso.anchos.splice(i,1); B.pt=null; A.tocar(c); B.ult=0; }; pt.appendChild(qu);
      p.appendChild(pt);
    }
  }
  p.appendChild(el('h3',{textContent:'Agregar un cuerpo'}));
  const ns=el('select'); for(const k of A.TIPOS_ID){ ns.appendChild(el('option',{value:k,textContent:A.NOMBRES[k]})); } const nb=el('button',{textContent:'Agregar en el centro de la vista'});
  nb.onclick=()=>{ const t=ns.value, cx=B.vista?B.vista.cx:20, cy=B.vista?B.vista.cy:14, id=t+'-'+((Math.random()*999)|0);
    const nc=t==='cascada'?A.crear(t,{id,x:cx,y:cy}):A.TIPOS[t].estancada?A.crear(t,{id,poligono:blob(cx,cy,4,2.4,12,(Math.random()*999)|0),sem:(Math.random()*999)|0}):A.crear(t,{id,curso:{puntos:[[cx-6,cy-2],[cx,cy],[cx+6,cy+2]],anchos:[null,null,null].map(()=>A.TIPOS[t].ancho)},sem:(Math.random()*999)|0});
    B.def.cuerpos.push(nc); B.sel=id; panelBanco(); B.ult=0; };
  p.appendChild(ns); p.appendChild(nb);
  p.appendChild(el('h3',{textContent:'Guardar y cargar (datos del mundo)'}));
  const gb=el('div',{className:'bt'});
  const gu=el('button',{textContent:'Guardar'}); gu.onclick=()=>{ try{ localStorage.setItem('nativa.aguas.lab',JSON.stringify(A.datosMundo(B.def.cuerpos))); $('#info').textContent='Guardado: '+B.def.cuerpos.length+' cuerpos.'; }catch(e){ $('#info').textContent='No se pudo guardar: '+e.message; } }; gb.appendChild(gu);
  const ca=el('button',{textContent:'Cargar'}); ca.onclick=()=>{ try{ const o=JSON.parse(localStorage.getItem('nativa.aguas.lab')||'null'); B.def.cuerpos=A.desdeMundo(o); B.sel=B.def.cuerpos[0]?B.def.cuerpos[0].id:null; panelBanco(); B.ult=0; $('#info').textContent='Cargado: '+B.def.cuerpos.length+' cuerpos (corriente y ondas siguen solas).'; }catch(e){ $('#info').textContent='No se pudo cargar: '+e.message; } }; gb.appendChild(ca);
  const ex=el('button',{textContent:'Ver JSON'}); ex.onclick=()=>{ $('#info').textContent=JSON.stringify(A.datosMundo(B.def.cuerpos)).slice(0,600)+'…'; }; gb.appendChild(ex);
  p.appendChild(gb);
}
function banco(c){
  if(!BANCO){ BANCO=crearBanco(); BANCO.esc=new Escena(BANCO.def); }
  const B=BANCO;
  c.appendChild(el('h2',{textContent:'Banco: todo junto y editable'}));
  c.appendChild(el('p',{className:'nota',textContent:'Mové al personaje con WASD o las flechas (Shift corre): cuando pisa agua nacen ondas, y su reflejo lo acompaña. Clic en el agua: cae una piedra. Elegí un cuerpo, cambiale cualquier parámetro, arrastrá sus puntos dorados, agregá o quitá cuerpos y guardá. El viento, la luz y el clima son los controles de abajo.'}));
  const cv=el('canvas'); B.cv=cv; B.ult=0;
  const cont=el('div',{id:'banco'},[el('div',{},[cv,el('div',{id:'info',textContent:'Listo.'})]),el('div',{id:'panel'})]);
  c.appendChild(cont); panelBanco();
  /* interacción: piedras y arrastre de puntos */
  const aMundo=e=>{ const r=cv.getBoundingClientRect(), cw=ESTADO.cw, chh=cw*ASP; return {x:(e.clientX-r.left)/cw/CPM,y:(e.clientY-r.top)/chh/RPM}; };
  cv.onpointerdown=e=>{
    const p=aMundo(e), c0=B.def.cuerpos.find(x=>x.id===B.sel);
    if(c0&&c0.tipo!=='cascada'){ const Q=A.TIPOS[c0.tipo].estancada?c0.poligono:c0.curso.puntos; let best=1.2,bi=-1; Q.forEach((q,i)=>{ const d=Math.hypot(q[0]-p.x,q[1]-p.y); if(d<best){ best=d; bi=i; } }); if(bi>=0){ B.arr=bi; B.pt=bi; cv.setPointerCapture(e.pointerId); return; } }
    if(A.golpe(B.def.cuerpos,p.x,p.y,1.3,reloj(),{len:0.34,dec:1.2})){ B.golpes++; }
  };
  cv.onpointermove=e=>{ if(B.arr==null) return; const p=aMundo(e), c0=B.def.cuerpos.find(x=>x.id===B.sel); const Q=A.TIPOS[c0.tipo].estancada?c0.poligono:c0.curso.puntos; Q[B.arr][0]=p.x; Q[B.arr][1]=p.y; A.tocar(c0); B.ult=0; };
  cv.onpointerup=()=>{ B.arr=null; };
}
addEventListener('keydown',e=>{ if(!BANCO||ESTADO.vista!=='banco') return; const k=e.key.toLowerCase(); if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','shift'].includes(k)){ BANCO.teclas[k]=true; if(k.startsWith('arrow')) e.preventDefault(); } });
addEventListener('keyup',e=>{ if(BANCO) BANCO.teclas[e.key.toLowerCase()]=false; });

function dibujar(){
  barra(); const c=$('#cuerpo'); c.innerHTML='';
  if(ESTADO.vista==='muestrario') muestrario(c); else banco(c);
}

/* ---------------------------------------------------------------- el bucle ---- */
let tPrev=reloj(), acumFps=0, nFps=0, tFps=tPrev;
function marco(){
  requestAnimationFrame(marco);
  const t=reloj(), dt=Math.min(0.1,t-tPrev); tPrev=t;
  if(ESTADO.pausa) return;
  const t0=performance.now();
  if(ESTADO.vista==='muestrario'){
    /* una muestra por cuadro, la que hace más que no se actualiza: así el costo no se acumula */
    let mejor=null, edad=0;
    for(const m of MUESTRAS){ if(!m.vis||!m.cv) continue; const e=t-m.ult; if(e>edad&&e>0.09){ edad=e; mejor=m; } }
    if(mejor){
      const m=mejor, dts=Math.min(0.25,t-m.ult||0.1); m.ult=t;
      aplicarAmbiente(m.s.amb,t);
      moverJugador(m.esc,t,dts);
      const ta=performance.now(); const g=m.esc.render(t); pintarGrid(m.cv,g,ESTADO.cw);
      const ms=performance.now()-ta; if(m.fpEl) m.fpEl.textContent=Math.round(ms)+' ms';
    }
  } else if(BANCO&&BANCO.cv){
    const B=BANCO, T=B.teclas;
    const dx=(T.d||T.arrowright?1:0)-(T.a||T.arrowleft?1:0), dy=(T.s||T.arrowdown?1:0)-(T.w||T.arrowup?1:0), J=B.esc.jug;
    const corre=!!T.shift, v=corre?3.4:1.5;
    if(dx||dy){ const l=Math.hypot(dx,dy); J.x=clamp(J.x+dx/l*v*dt,0.5,B.def.mw-0.5); J.y=clamp(J.y+dy/l*v*dt,3,B.def.mh-0.5); J.fase+=dt*(corre?1.5:0.9); J.mov=true; } else J.mov=false;
    B.est=A.actor(B.est,B.def.cuerpos,J.x,J.y,t,J.mov?v:0);
    B.vista={cx:B.def.mw/2,cy:B.def.mh/2};
    const g=B.esc.render(t); pintarGrid(B.cv,g,ESTADO.cw);
    const inf=$('#info'); if(inf&&B.est&&!/Guardado|Cargado|No se pudo|\{/.test(inf.textContent)) inf.textContent='Personaje: '+(B.est.enAgua?('en el agua · '+B.est.accion+' · profundidad '+B.est.prof.toFixed(2)+' m'):'fuera del agua')+' · '+Math.round(performance.now()-t0)+' ms por cuadro';
  }
  acumFps+=1; if(t-tFps>1){ const f=$('#fps'); if(f) f.textContent=Math.round(acumFps/(t-tFps))+' cuadros/s'; acumFps=0; tFps=t; }
}
window.NV_AGUAS_LAB={MUESTRAS,ESTADO,aplicarAmbiente,VIENTO,CLIMA,LUZ,Escena,muestras,get banco(){ return BANCO; }};
dibujar(); requestAnimationFrame(marco);
})();

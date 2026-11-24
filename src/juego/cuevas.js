/* Nativa Online — MOTOR DE CUEVAS (cuevas). LABORATORIO: todavía no lo usa el juego.
   Independiente de rocas, árboles, aguas y estructuras: no los reemplaza ni los toca. Dibuja el INTERIOR de una cueva: una escena
   aparte (un sub-nivel), no un hueco en el mapa. La razón es de geometría: el mapa del juego guarda una sola altura por punto y una
   cueva necesita techo, paredes y aire entre el suelo y la roca.

   QUÉ ES. Una cueva es DATOS (una spec chica y determinista) más un SÓLIDO por distancia que cada celda recorre con un rayo, a la
   inclinación de cámara del juego (RPM/HPM), igual que rocas y estructuras. Es un CORTE: se ve el suelo y las paredes desde arriba,
   y el techo no se dibuja (quedan las paredes cortadas a su altura, muy oscuras). Lo que cuelga del techo (estalactitas) no se ve.

   LA SPEC. {tipo,mat,sem,semD,semV,escala,largo,ancho,alto,corte,edad,tono,lum,sat,estado:{musgo,humedad,charcos,cristales,derrumbe}}
   · FORMA (tipo, mat, sem, largo, ancho, alto, corte, salidas): el trazado de galerías y cámaras. `sem` la decide. `alto` es lo que
     mide la cueva de verdad (escala los espeleotemas y es lo que usará quien camine adentro); `corte` es hasta dónde se dibuja la roca:
     con la cámara del juego una pared de 4 m taparía 7 m de suelo detrás, así que el corte se hace a la altura de la cintura.
   · edad (0..1)      → más estalagmitas y columnas de calcita, roca más lisa y manchada. No cambia el trazado.
   · derrumbe (0..1)  → bloques caídos en el suelo y ladera de escombro al pie de las paredes. Usa SU semilla (`semD`).
   · charcos, cristales → cuántos charcos y cuántos racimos de cristal (los cristales brillan solos y alumbran un poco).
   · musgo y humedad  → sólo el pintado: el musgo crece hacia las bocas (donde llega el día); `semV` decide dónde.

   LUZ. Una cueva no tiene sol: tiene luces. Cada boca deja entrar el día, cada racimo grande de cristal alumbra, y quien llama puede
   pasar luces propias (la linterna de quien camina) en `ctx.luces`. La luz estática se hornea una vez por resolución; las dinámicas
   se suman al pintar. Sin luz, `ctx.memoria` deja ver apenas la forma de lo cercano (0 = negro de verdad).

   LAS BOCAS. Cada cueva dice dónde están sus entradas: `entradas(S)` → [{id,x,z,dx,dz,r}]. Es lo que lee Umbrales (umbrales.js)
   para atar la boca de afuera con la de adentro; la cueva no sabe nada del mapa de afuera.

   Todo se mide en metros. Coordenadas locales: x al este, z hacia el sur (hacia abajo en pantalla, como la y del juego), origen en el centro del trazado.
   Glifos: rampas propias por capa (roca, suelo, calcita, cristal, agua) con el extremo denso exclusivo en su capa (DISENO.md §9).
   Pruebas: pruebas/cuevas.js; laboratorio: preview/cuevas.html. */
(function(NV){
'use strict';
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const sm=u=>u<=0?0:u>=1?1:u*u*(3-2*u);
const lerp=(a,b,t)=>a+(b-a)*t;
const frac=x=>x-Math.floor(x);
function H4(a,b,c,d){
  let h=Math.imul(a|0,374761393)^Math.imul(b|0,668265263)^Math.imul(c|0,1274126177)^Math.imul(d|0,2147483629);
  h=Math.imul(h^(h>>>13),1274126177); return ((h^(h>>>16))>>>0)/4294967296;
}
function n3(x,y,z,s){
  const X=Math.floor(x), Y=Math.floor(y), Z=Math.floor(z), fx=sm(x-X), fy=sm(y-Y), fz=sm(z-Z);
  const a=H4(X,Y,Z,s), b=H4(X+1,Y,Z,s), c=H4(X,Y+1,Z,s), d=H4(X+1,Y+1,Z,s);
  const e=H4(X,Y,Z+1,s), f=H4(X+1,Y,Z+1,s), g=H4(X,Y+1,Z+1,s), h=H4(X+1,Y+1,Z+1,s);
  const l0=a+(b-a)*fx, l1=c+(d-c)*fx, l2=e+(f-e)*fx, l3=g+(h-g)*fx;
  const m0=l0+(l1-l0)*fy, m1=l2+(l3-l2)*fy; return m0+(m1-m0)*fz;
}
function fbm(x,y,z,s,o){ let a=0,amp=0.5,f=1,t=0; for(let i=0;i<o;i++){ a+=amp*n3(x*f,y*f,z*f,s+i*13); t+=amp; amp*=0.5; f*=2.03; } return a/t; }
const _c=[0,0,0];
function pal(p,t){ const n=p.length-1, x=clamp(t,0,1)*n, i=Math.min(n-1,x|0), f=x-i, a=p[i], b=p[i+1];
  _c[0]=a[0]+(b[0]-a[0])*f; _c[1]=a[1]+(b[1]-a[1])*f; _c[2]=a[2]+(b[2]-a[2])*f; return _c; }
const pack=(r,g,b)=>(clamp(r|0,0,255)<<16)|(clamp(g|0,0,255)<<8)|clamp(b|0,0,255);

/* ------------------------------------------------------------------ MATERIALES ----
   Cada roca trae su rampa y su paleta de pared y de suelo y el color de sus cristales. La calcita (estalagmitas y columnas), el
   cristal y el agua son comunes. Capas y extremos densos: roca `M`, suelo `O`, calcita `Y`, cristal `&`, agua `=`. */
const MATERIALES={
  caliza:{nombre:'Caliza', ramp:['.',':','-','=','%','M'], pal:[[12,12,15],[30,29,33],[58,55,56],[92,86,82],[130,121,110],[172,160,142]],
    suelo:[[22,18,14],[44,36,28],[72,60,44],[102,86,62],[134,114,84],[166,144,106]], cristal:[110,200,230], estrato:1.0, tono:0.22},
  basalto:{nombre:'Basalto', ramp:['.',':','-','=','%','M'], pal:[[8,9,13],[20,22,30],[40,44,56],[64,70,84],[94,100,116],[128,134,150]],
    suelo:[[14,14,18],[28,28,34],[46,46,54],[68,68,78],[92,92,104],[118,118,130]], cristal:[176,110,236], estrato:0.25, tono:0.14},
  arenisca:{nombre:'Arenisca', ramp:['.',':','-','=','%','M'], pal:[[22,12,8],[52,28,18],[92,52,32],[134,80,48],[176,112,66],[214,150,92]],
    suelo:[[30,20,12],[62,42,26],[98,70,42],[136,102,62],[172,134,84],[206,170,110]], cristal:[238,190,90], estrato:1.5, tono:0.30},
  hielo:{nombre:'Hielo', ramp:['.',':','-','=','%','M'], pal:[[10,18,28],[24,44,64],[46,80,106],[78,122,150],[122,170,192],[186,220,232]],
    suelo:[[16,26,36],[34,52,70],[58,86,108],[88,122,146],[128,164,184],[176,208,224]], cristal:[210,238,255], estrato:0.5, tono:0.10}
};
const MATS=Object.keys(MATERIALES);
const CALCITA={ramp:['.',':','!','|','T','Y'], pal:[[34,30,28],[70,64,58],[112,104,92],[154,144,128],[192,182,164],[226,216,194]]};
const CRISTAL_G=['.','*','+','x','X','&'];
const AGUA={ramp:['.','-','~','~','=','='], pal:[[6,12,20],[10,26,40],[16,44,64],[28,72,96],[52,108,132],[110,160,180]]};
const MUSGO_G=['°','*','°',';'], PAL_MUSGO=[[10,34,26],[20,58,40],[34,88,52],[58,122,66],[92,156,84]];
const DIA=[170,198,240];                                      // el color del día que entra por una boca
const ESTADO0={musgo:0,humedad:0,charcos:0,cristales:0,derrumbe:0};

/* ------------------------------------------------------------------ TIPOS ---- */
const TIPOS={
  galeria:      {nombre:'Galería',            cat:'Cuevas', mat:'caliza', largo:30, ancho:4.8, alto:4.2, corte:1.3, sal:2, rug:0.45, est:{humedad:0.3}},
  camara:       {nombre:'Cámara',             cat:'Cuevas', mat:'caliza', largo:16, ancho:12,  alto:4.6, corte:1.5, sal:1, rug:0.5,  est:{humedad:0.3}},
  grieta:       {nombre:'Grieta',             cat:'Cuevas', mat:'caliza', largo:22, ancho:1.9, alto:5.2, corte:0.8, sal:2, rug:0.16, est:{humedad:0.2}},
  caverna:      {nombre:'Caverna',            cat:'Cuevas', mat:'caliza', largo:34, ancho:24,  alto:6.0, corte:1.7, sal:2, rug:0.6,  est:{humedad:0.5,charcos:0.3}},
  cuevaAgua:    {nombre:'Cueva con lago',     cat:'Cuevas', mat:'caliza', largo:32, ancho:9.5, alto:4.8, corte:1.4, sal:2, rug:0.5,  est:{humedad:0.7,musgo:0.3}, lago:true},
  bifurcacion:  {nombre:'Bifurcación',        cat:'Cuevas', mat:'caliza', largo:26, ancho:4.4, alto:4.0, corte:1.3, sal:3, rug:0.42, est:{humedad:0.3}}
};
const TIPOS_ID=Object.keys(TIPOS);

/* ------------------------------------------------------------------ TRAZADO ----
   El plano de la cueva son cápsulas (galerías, de un radio a otro) y elipses (cámaras). Cada boca queda en el extremo de una
   galería: (x,z) dentro, (dx,dz) hacia afuera. */
function trazar(sp,rnd){
  const esc=sp.escala, L=sp.largo*esc, W=sp.ancho*esc, S=[], E=[];
  const cap=(a,b,r0,r1)=>S.push({k:'c',ax:a[0],az:a[1],bx:b[0],bz:b[1],r0,r1});
  const ell=(x,z,rx,rz,ang)=>S.push({k:'e',x,z,rx,rz,ang:ang||0});
  const cam=(P,R)=>{ for(let i=0;i<P.length-1;i++) cap(P[i],P[i+1],R[i],R[i+1]); };
  const boca=(id,P,Q,r)=>{ let dx=P[0]-Q[0], dz=P[1]-Q[1]; const n=Math.hypot(dx,dz)||1; E.push({id,x:P[0],z:P[1],dx:dx/n,dz:dz/n,r}); };
  const b=sp.tipo;
  if(b==='galeria'||b==='cuevaAgua'||b==='grieta'){
    const n=Math.max(4,Math.round(L/(b==='grieta'?3:4.5))), P=[], R=[]; let z=0;
    for(let i=0;i<=n;i++){
      const x=-L/2+L*i/n; z+=(rnd()-0.5)*W*(b==='grieta'?0.9:1.1); z=clamp(z,-L*0.16,L*0.16);
      if(b==='cuevaAgua') z=z*0.4;
      P.push([x,z]); R.push(Math.max(b==='grieta'?0.55:0.95,W/2*(0.78+0.5*rnd())));
    }
    P[0][1]=P[1][1]; P[n][1]=P[n-1][1];
    cam(P,R);
    if(b!=='grieta'){ const np=b==='cuevaAgua'?1:1+((rnd()*2)|0); for(let i=0;i<np;i++){ const k=1+((rnd()*(n-2))|0), s=rnd()<0.5?-1:1; ell(P[k][0],P[k][1]+s*W*0.7,W*(0.65+0.5*rnd()),W*(0.55+0.4*rnd()),rnd()*3); } }
    boca('a',P[0],P[1],R[0]); boca('b',P[n],P[n-1],R[n]);
  } else if(b==='camara'||b==='caverna'){
    const big=b==='caverna', rx=L/2*0.62, rz=W/2*0.62; ell(0,0,rx,rz,0);
    const nl=big?4+((rnd()*3)|0):3+((rnd()*2)|0);
    for(let i=0;i<nl;i++){ const a=rnd()*6.283, d=0.55+0.4*rnd(); ell(Math.cos(a)*rx*d,Math.sin(a)*rz*d,rx*(0.38+0.3*rnd()),rz*(0.38+0.3*rnd()),rnd()*3); }
    const tr=Math.max(1.05,Math.min(2.2,W*0.12));
    const P0=[-L/2*0.96,(rnd()-0.5)*rz*0.6], P1=[-rx*0.5,P0[1]*0.6]; cap(P0,P1,tr,tr+0.2); boca('a',P0,P1,tr);
    if(sp.salidas>=2){ const Q0=[L/2*0.96,(rnd()-0.5)*rz*0.6], Q1=[rx*0.5,Q0[1]*0.6]; cap(Q0,Q1,tr,tr+0.2); boca('b',Q0,Q1,tr); }
    if(sp.salidas>=3){ const Q0=[(rnd()-0.5)*rx,W/2*0.96], Q1=[Q0[0]*0.7,rz*0.5]; cap(Q0,Q1,tr,tr+0.2); boca('c',Q0,Q1,tr); }
  } else if(b==='bifurcacion'){
    const r0=Math.max(1.6,W*0.62); ell(0,0,r0,r0*0.9,0);
    const arm=L/2.1, ang=[Math.PI+0.25*(rnd()-0.5),-0.62+0.3*(rnd()-0.5),0.88+0.3*(rnd()-0.5)], ids=['a','b','c'];
    for(let i=0;i<3&&i<Math.max(2,sp.salidas);i++){
      const P=[[0,0]], R=[r0*0.7]; let a=ang[i];
      for(let j=1;j<=3;j++){ a+=(rnd()-0.5)*0.5; const d=arm*j/3; P.push([Math.cos(a)*d,Math.sin(a)*d*0.8]); R.push(Math.max(0.95,W/2*(0.8+0.4*rnd()))); }
      cam(P,R); boca(ids[i],P[3],P[2],R[3]);
    }
  }
  return {S,E};
}

/* ------------------------------------------------------------------ SPEC ---- */
function limpiar(s){
  s=s||{}; const tipo=s.tipo||'galeria', T=TIPOS[tipo]; if(!T) throw new Error('tipo de cueva desconocido: '+tipo);
  const mat=s.mat||T.mat; if(!MATERIALES[mat]) throw new Error('material de cueva desconocido: '+mat);
  const sem=(s.sem==null?1:s.sem)|0;
  const o={tipo,mat,sem,semD:(s.semD==null?(sem*2654435761+97)>>>0&0x7fffffff:s.semD)|0,semV:(s.semV==null?(sem*40503+11)&0x7fffffff:s.semV)|0,
    escala:clamp(s.escala==null?1:+s.escala,0.5,2),largo:clamp(s.largo==null?T.largo:+s.largo,6,80),ancho:clamp(s.ancho==null?T.ancho:+s.ancho,0.9,30),
    alto:clamp(s.alto==null?T.alto:+s.alto,1.6,10),corte:clamp(s.corte==null?T.corte:+s.corte,0.5,4.5),salidas:clamp(Math.round(s.salidas==null?T.sal:+s.salidas),1,3),
    edad:clamp(s.edad==null?0.4:+s.edad,0,1),tono:clamp(+(s.tono||0),-1,1),lum:clamp(+(s.lum||0),-0.6,0.6),sat:clamp(s.sat==null?1:+s.sat,0,2),
    estado:Object.assign({},ESTADO0,T.est,s.estado||{})};
  if(tipo==='bifurcacion') o.salidas=3;
  for(const k of Object.keys(o.estado)) o.estado[k]=clamp(+o.estado[k]||0,0,1);
  return o;
}
const CLAVE_FORMA=['tipo','mat','sem','semD','escala','largo','ancho','alto','corte','salidas','edad'];
const claveForma=sp=>CLAVE_FORMA.map(c=>sp[c]).join('|')+'|'+sp.estado.charcos+'|'+sp.estado.cristales+'|'+sp.estado.derrumbe;
const CACHE_G=new Map(); const ESTAD={solidos:0,aciertos:0,rasters:0,bandas:0,pintados:0};
const _I={mat:0,cut:0,boca:0};

/* ------------------------------------------------------------------ SÓLIDO ----
   Rejillas de 20 cm: Q (distancia con signo al aire del pasillo; positivo = aire), FH (altura del suelo) y HW (altura a la que la
   roca queda cortada). Sobre ellas el sólido es: suelo ∪ roca (donde Q<0, hasta HW) ∪ agua ∪ espeleotemas, cristales y bloques. */
function construirG(sp){
  const T=TIPOS[sp.tipo], M=MATERIALES[sp.mat], est=sp.estado, esc=sp.escala;
  const rnd=NV.mulberry((sp.sem*7919+TIPOS_ID.indexOf(sp.tipo)*104729+MATS.indexOf(sp.mat)*15485863)|0);
  const rndD=NV.mulberry((sp.semD*6151+TIPOS_ID.indexOf(sp.tipo)*7727+17)|0);
  const tz=trazar(sp,rnd), SH=tz.S, EN=tz.E, hc=0.2, sem=sp.sem;
  let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;
  for(const s of SH){ if(s.k==='c'){ const r=Math.max(s.r0,s.r1); x0=Math.min(x0,s.ax-r,s.bx-r); x1=Math.max(x1,s.ax+r,s.bx+r); z0=Math.min(z0,s.az-r,s.bz-r); z1=Math.max(z1,s.az+r,s.bz+r); }
    else { const r=Math.max(s.rx,s.rz); x0=Math.min(x0,s.x-r); x1=Math.max(x1,s.x+r); z0=Math.min(z0,s.z-r); z1=Math.max(z1,s.z+r); } }
  const PAD=3.5; x0-=PAD; x1+=PAD; z0-=PAD; z1+=PAD;
  const nx=Math.ceil((x1-x0)/hc)+1, nz=Math.ceil((z1-z0)/hc)+1, N=nx*nz;
  const Q=new Float32Array(N), FH=new Float32Array(N), HW=new Float32Array(N);
  const rug=T.rug*(0.6+0.8*Math.min(1,sp.ancho*esc/4));
  /* plano: unión suave de cápsulas y elipses + ruido; un camino de medio metro por el eje de cada galería queda siempre abierto */
  for(let j=0;j<nz;j++) for(let i=0;i<nx;i++){
    const x=x0+i*hc, z=z0+j*hc; let acc=0, core=-9;
    for(const s of SH){
      let d;
      if(s.k==='c'){ const px=x-s.ax, pz=z-s.az, vx=s.bx-s.ax, vz=s.bz-s.az, l2=vx*vx+vz*vz||1, t=clamp((px*vx+pz*vz)/l2,0,1), dd=Math.hypot(px-vx*t,pz-vz*t); d=dd-lerp(s.r0,s.r1,t); core=Math.max(core,0.5-dd); }
      else { const cs=Math.cos(s.ang), sn=Math.sin(s.ang), px=x-s.x, pz=z-s.z, qx=(px*cs+pz*sn)/s.rx, qz=(-px*sn+pz*cs)/s.rz; d=(Math.hypot(qx,qz)-1)*Math.min(s.rx,s.rz); core=Math.max(core,0.35-Math.hypot(px,pz)); }
      acc+=Math.exp(-d/0.6);
    }
    let q=-(-0.6*Math.log(acc||1e-30));
    q+=(fbm(x*0.28,0,z*0.28,sem+1,3)-0.5)*1.5*rug+(fbm(x*1.2,0,z*1.2,sem+2,2)-0.5)*0.5*rug;
    Q[j*nx+i]=Math.max(q,core);
  }
  const bil=(A,x,z)=>{ let fx=(x-x0)/hc, fz=(z-z0)/hc; fx=fx<0?0:fx>nx-1.001?nx-1.001:fx; fz=fz<0?0:fz>nz-1.001?nz-1.001:fz;
    const i=fx|0, j=fz|0, ax=fx-i, az=fz-j, k=j*nx+i; const a=A[k]+(A[k+1]-A[k])*ax, b=A[k+nx]+(A[k+nx+1]-A[k+nx])*ax; return a+(b-a)*az; };
  const QS=(x,z)=>bil(Q,x,z);
  let area=0; for(let k=0;k<N;k++) if(Q[k]>0.4) area+=hc*hc;
  const acaso=(minQ,maxQ)=>{ for(let t=0;t<40;t++){ const x=x0+PAD+rnd()*(x1-x0-2*PAD), z=z0+PAD+rnd()*(z1-z0-2*PAD), q=QS(x,z); if(q>=minQ&&q<=maxQ) return [x,z,q]; } return null; };
  /* charcos y lago: depresiones del suelo; el agua es una lámina a la altura WL que aparece donde el suelo queda por debajo */
  const POZ=[], WL=-0.12+0.16*est.charcos;
  if(T.lago) POZ.push({x:0,z:(rnd()<0.5?-1:1)*sp.ancho*esc*0.10,rx:sp.largo*esc*0.2,rz:sp.ancho*esc*0.34,ang:(rnd()-0.5)*0.4,pr:0.5});
  const np=Math.round(area*0.012*est.charcos*(0.6+0.8*rnd())); for(let i=0;i<np;i++){ const p=acaso(1.0,9); if(p) POZ.push({x:p[0],z:p[1],rx:0.5+rnd()*1.5,rz:0.4+rnd()*1.1,ang:rnd()*3,pr:0.28}); }
  for(const p of POZ){ p.c=Math.cos(p.ang); p.s=Math.sin(p.ang); }
  const nb=Math.round(area*0.03*est.derrumbe*(0.7+0.6*rndD()));   // derrumbe: bloques caídos
  for(let j=0;j<nz;j++) for(let i=0;i<nx;i++){
    const x=x0+i*hc, z=z0+j*hc, q=Q[j*nx+i];
    let f=(fbm(x*0.5,0,z*0.5,sem+3,2)-0.5)*0.16+0.30*sm(1-clamp(q/1.4,0,1))*(0.7+0.8*est.derrumbe);
    for(const p of POZ){ const px=x-p.x, pz=z-p.z, qx=(px*p.c+pz*p.s)/p.rx, qz=(-px*p.s+pz*p.c)/p.rz, r=Math.hypot(qx,qz); if(r<1.35) f-=(p.pr+0.1)*sm((1.25-r)/0.5); }
    FH[j*nx+i]=f;
    HW[j*nx+i]=Math.max(0.45,sp.corte*(0.86+0.28*fbm(x*0.18,0,z*0.18,sem+5,2))+(fbm(x*1.3,0,z*1.3,sem+7,2)-0.5)*0.34);
  }
  const FS=(x,z)=>bil(FH,x,z), HS=(x,z)=>bil(HW,x,z);
  /* espeleotemas, bloques y cristales */
  const F=[], LU=[];
  const ns=Math.round(Math.min(110,area*0.05*(0.12+sp.edad*1.1))); for(let i=0;i<ns;i++){ const p=acaso(0.45,6); if(!p) continue; const h=((0.18+0.9*rnd()*rnd())*(0.4+sp.edad)*0.9+0.12)*clamp(sp.alto/4.2,0.7,1.5); F.push({k:'s',x:p[0],z:p[1],y0:FS(p[0],p[1]),h,r:0.08+0.07*rnd()+h*0.12}); }
  const ncol=T.lago||sp.tipo==='caverna'||sp.tipo==='camara'?Math.round(area*0.0045*Math.max(0,sp.edad*1.4-0.25)):0;
  for(let i=0;i<ncol;i++){ const p=acaso(1.7,9); if(!p) continue; const r0=0.32+0.35*rnd(); if(p[2]<r0+0.8) continue; F.push({k:'c',x:p[0],z:p[1],r:r0,y0:FS(p[0],p[1]),y1:HS(p[0],p[1])}); }
  for(let i=0;i<nb;i++){ const p=acaso(0.5,2.6)||acaso(0.5,9); if(!p) continue; const r=0.18+0.5*rndD()*rndD()*1.4; F.push({k:'b',x:p[0],z:p[1],y:FS(p[0],p[1])+r*0.25,rx:r*(0.9+0.5*rndD()),ry:r*0.7,rz:r*(0.9+0.5*rndD()),sd:(rndD()*1e4)|0}); }
  const ncr=Math.round(Math.min(46,area*0.012*est.cristales*(0.5+rnd()))); const grupos=[];
  for(let i=0;i<ncr;i++){ const p=acaso(0.25,1.4); if(!p) continue; const nn=3+((rnd()*3)|0); let big=0;
    for(let k=0;k<nn;k++){ const a=rnd()*6.283, tl=0.25+0.5*rnd(), h=0.25+0.7*rnd(), ax=p[0]+Math.cos(a)*0.12*k, az=p[1]+Math.sin(a)*0.12*k, y0=FS(ax,az); big=Math.max(big,h);
      F.push({k:'x',x:ax,z:az,y0,px:ax+Math.cos(a)*tl*h*0.5,pz:az+Math.sin(a)*tl*h*0.5,py:y0+h,r:0.045+0.03*rnd()}); }
    grupos.push({x:p[0],z:p[1],h:big}); }
  /* bucket de 2 m para no recorrer todo en cada paso del rayo */
  const BK=2, bnx=Math.ceil((x1-x0)/BK)+1, bnz=Math.ceil((z1-z0)/BK)+1, B=new Array(bnx*bnz);
  F.forEach((f,ix)=>{ const br=f.k==='s'?f.r+0.2:f.k==='c'?f.r+0.2:f.k==='b'?Math.max(f.rx,f.rz)+0.2:0.3+Math.hypot(f.px-f.x,f.pz-f.z)+f.r;
    const a0=Math.max(0,Math.floor((f.x-br-x0)/BK)), a1=Math.min(bnx-1,Math.floor((f.x+br-x0)/BK)), b0=Math.max(0,Math.floor((f.z-br-z0)/BK)), b1=Math.min(bnz-1,Math.floor((f.z+br-z0)/BK));
    for(let b=b0;b<=b1;b++) for(let a=a0;a<=a1;a++){ const k=b*bnx+a; (B[k]||(B[k]=[])).push(ix); } });
  /* luces estáticas: el día en cada boca y los racimos grandes de cristal */
  for(const e of EN){ LU.push({x:e.x-e.dx*0.2,z:e.z-e.dz*0.2,y:1.6,rad:9.5*Math.min(1.4,0.7+e.r*0.25),r:DIA[0]/255,g:DIA[1]/255,b:DIA[2]/255,i:1.0,dia:1}); }
  grupos.sort((a,b)=>b.h-a.h); const cr=M.cristal; for(let i=0;i<Math.min(6,grupos.length);i++){ const g=grupos[i]; LU.push({x:g.x,z:g.z,y:0.5+g.h*0.5,rad:3.4+g.h*2,r:cr[0]/255,g:cr[1]/255,b:cr[2]/255,i:0.85,dia:0}); }
  const BOCAS=EN.map(e=>({id:e.id,x:e.x,z:e.z,dx:e.dx,dz:e.dz,r:e.r,mx:e.x+e.dx*(e.r+0.2),mz:e.z+e.dz*(e.r+0.2)}));
  /* ----- el sólido ----- */
  let hmaxW=0; for(let k=0;k<N;k++) if(HW[k]>hmaxW) hmaxW=HW[k];
  function ev(x,y,z,wi){
    let fx=(x-x0)/hc, fz=(z-z0)/hc; fx=fx<0?0:fx>nx-1.001?nx-1.001:fx; fz=fz<0?0:fz>nz-1.001?nz-1.001:fz;
    const i=fx|0, j=fz|0, ax=fx-i, az=fz-j, k=j*nx+i;
    const q=(Q[k]+(Q[k+1]-Q[k])*ax)*(1-az)+(Q[k+nx]+(Q[k+nx+1]-Q[k+nx])*ax)*az;
    const fh=(FH[k]+(FH[k+1]-FH[k])*ax)*(1-az)+(FH[k+nx]+(FH[k+nx+1]-FH[k+nx])*ax)*az;
    const hw=(HW[k]+(HW[k+1]-HW[k])*ax)*(1-az)+(HW[k+nx]+(HW[k+nx+1]-HW[k+nx])*ax)*az;
    let f=y-fh, mat=1, cut=0;
    const fw=Math.max(q,y-hw); if(fw<f){ f=fw; mat=0; if(y>hw-0.07&&q<0) cut=1; }
    const dw=WL-fh; if(dw>0.01){ const fa=Math.max(Math.abs(y-WL)-0.02,-dw*1.5); if(fa<f){ f=fa; mat=4; } }
    const bi=Math.floor((x-x0)/BK), bj=Math.floor((z-z0)/BK), bk=(bi<0||bj<0||bi>=bnx||bj>=bnz)?null:B[bj*bnx+bi];
    if(bk) for(let t=0;t<bk.length;t++){ const o=F[bk[t]]; let d;
      if(o.k==='s'){ const rd=Math.hypot(x-o.x,z-o.z), yy=y-o.y0; if(yy>o.h) d=Math.hypot(rd,yy-o.h); else { const r=o.r*Math.pow(Math.max(0,1-Math.max(0,yy)/o.h),0.85)+0.01; d=(rd-r)*0.85; } if(d<f){ f=d; mat=2; cut=0; } }
      else if(o.k==='c'){ const rd=Math.hypot(x-o.x,z-o.z), tt=clamp((y-o.y0)/Math.max(0.5,o.y1-o.y0),0,1), r=o.r*(0.62+0.38*Math.pow(Math.abs(2*tt-1),1.6)); d=Math.max((rd-r)*0.85,y-hw); if(d<f){ f=d; mat=2; cut=(y>hw-0.07)?1:0; } }
      else if(o.k==='b'){ const q0=Math.hypot((x-o.x)/o.rx,(y-o.y)/o.ry,(z-o.z)/o.rz); d=(q0-1)*Math.min(o.rx,o.ry,o.rz)+(n3(x*5,y*5,z*5,o.sd)-0.5)*0.06; if(d<f){ f=d; mat=0; cut=0; } }
      else { const px=x-o.x, py=y-o.y0, pz=z-o.z, vx=o.px-o.x, vy=o.py-o.y0, vz=o.pz-o.z, l2=vx*vx+vy*vy+vz*vz||1, tt=clamp((px*vx+py*vy+pz*vz)/l2,0,1); d=Math.hypot(px-vx*tt,py-vy*tt,pz-vz*tt)-o.r*(1-0.55*tt); if(d<f){ f=d; mat=3; cut=0; } }
    }
    if(wi){ _I.mat=mat; _I.cut=cut; _I.q=q; _I.fh=fh; _I.hw=hw; }
    return f;
  }
  const sdf=(U,v,Z)=>ev(U,v,Z,false), info=(U,v,Z)=>{ ev(U,v,Z,true); return _I; };
  ESTAD.solidos++;
  return {sdf,info,QS,FS,HS,box:{umin:x0,umax:x1,vmin:-0.7,vmax:hmaxW+0.4,zmin:z0,zmax:z1},paso:0.5,hmax:hmaxW,bocas:BOCAS,luces:LU,pozas:POZ,
    meta:{area:+area.toFixed(1),espeleotemas:ns,columnas:F.filter(o=>o.k==='c').length,bloques:F.filter(o=>o.k==='b').length,cristales:grupos.length,charcos:POZ.length,bocas:EN.length},
    nombre:T.nombre+' · '+M.nombre,r:{},WL};
}
function crear(spec){
  const sp=limpiar(spec), k=claveForma(sp);
  let G=CACHE_G.get(k);
  if(G) ESTAD.aciertos++; else { G=construirG(sp); if(CACHE_G.size>12) CACHE_G.clear(); CACHE_G.set(k,G); }
  return {tipo:sp.tipo,spec:sp,M:MATERIALES[sp.mat],g:G,sdf:G.sdf,box:G.box,nombre:G.nombre,hmax:G.hmax,_sh:{}};
}

/* ------------------------------------------------------------------ EDICIÓN ---- */
const CAMPOS_DANIO=['semD'], CAMPOS_PINTADO=['tono','lum','sat','semV'];
function editar(spec,cambios){
  const sp=limpiar(spec), out=Object.assign({},sp); let forma=false, danio=false, pintado=false;
  for(const k of Object.keys(cambios||{})){
    if(k==='estado'){ out.estado=Object.assign({},sp.estado,cambios.estado); for(const q of Object.keys(cambios.estado)){ if(q==='musgo'||q==='humedad') pintado=true; else if(q==='derrumbe') danio=true; else forma=true; } }
    else { out[k]=cambios[k]; if(CAMPOS_PINTADO.indexOf(k)>=0) pintado=true; else if(CAMPOS_DANIO.indexOf(k)>=0) danio=true; else forma=true; }
  }
  return {spec:limpiar(out),tocado:{forma:forma||danio,deterioro:danio,pintado}};
}
const azarS=()=>(((NV.azarEditor||Math.random)()*1e6)|0)+1;
function regenerar(spec,parte){
  const sp=limpiar(spec), o=Object.assign({},sp), n=azarS();
  if(parte==='forma') o.sem=n; else if(parte==='derrumbe') o.semD=n; else if(parte==='vegetacion') o.semV=n; else if(parte==='todo'){ o.sem=n; o.semD=n+7; o.semV=n+13; } else throw new Error('parte desconocida: '+parte);
  return limpiar(o);
}
const PLANTILLA={};
function plantilla(tipo,cambios){
  if(!TIPOS[tipo]) throw new Error('tipo de cueva desconocido: '+tipo);
  if(cambios===null) delete PLANTILLA[tipo]; else if(cambios) PLANTILLA[tipo]=Object.assign({},PLANTILLA[tipo]||{},cambios);
  return Object.assign({},PLANTILLA[tipo]||{});
}
function nuevo(tipo,sem){ if(!TIPOS[tipo]) throw new Error('tipo de cueva desconocido: '+tipo);
  const p=PLANTILLA[tipo]||{}; return limpiar(Object.assign({tipo,sem:sem==null?azarS():sem},p,{estado:Object.assign({},p.estado)})); }
function variar(spec){ const sp=limpiar(spec), n=azarS(); return limpiar(Object.assign({},sp,{sem:n,semD:n+7,semV:sp.semV})); }
function aObjeto(spec){ const sp=limpiar(spec); return {k:'cueva',c:JSON.parse(JSON.stringify(sp)),s:sp.sem}; }
function deObjeto(o){ if(!o||o.k!=='cueva'||!o.c) throw new Error('no es una cueva'); return limpiar(o.c); }

/* ------------------------------------------------------------------ CONSULTAS (lo que necesitará quien camine adentro) ---- */
const entradas=S=>S.g.bocas.map(b=>Object.assign({},b));
const luces=S=>S.g.luces.map(l=>Object.assign({},l));
/* ¿se puede pararse en (x,z)? el aire a 35 cm de la pared, y el agua honda no se pisa */
function suelo(S,x,z){ const g=S.g, q=g.QS(x,z), fh=g.FS(x,z), prof=Math.max(0,g.WL-fh); return {libre:q>0.35&&prof<0.3,aire:q>0,agua:prof>0.02,honda:prof>=0.3,y:Math.max(fh,g.WL),q}; }
const libre=(S,x,z)=>suelo(S,x,z).libre;
/* rejilla de pisables (para buscar caminos): [{cols,rows,x0,z0,paso,libre:Uint8Array}] */
function rejilla(S,paso){ paso=paso||0.5; const B=S.g.box, cols=Math.ceil((B.umax-B.umin)/paso), rows=Math.ceil((B.zmax-B.zmin)/paso), L=new Uint8Array(cols*rows);
  for(let j=0;j<rows;j++) for(let i=0;i<cols;i++) L[j*cols+i]=libre(S,B.umin+(i+0.5)*paso,B.zmin+(j+0.5)*paso)?1:0;
  return {cols,rows,x0:B.umin,z0:B.zmin,paso,libre:L}; }

/* ------------------------------------------------------------------ RASTER ----
   Los rayos se calculan por BANDAS de filas y sólo cuando se piden: una cueva de 80 m no cuesta lo de toda la escena sino lo que se ve. */
const BANDA=16;
function geometria(S,CPM,HPM,RPM,det){
  const g=S.g, key=CPM+'|'+HPM+'|'+RPM+'|'+det;
  if(g.r[key]) return g.r[key];
  const phi=Math.atan2(RPM,HPM), cphi=Math.cos(phi), sphi=Math.sin(phi), K=HPM/cphi, B=g.box, pad=3;
  const Ytop=B.vmax*cphi-B.zmin*sphi, YB=B.vmin*cphi-B.zmax*sphi;   // la altura en pantalla de un punto es v·cosφ − z·sinφ
  const cols=Math.ceil((B.umax-B.umin)*CPM)+pad*2+4, c0=Math.round(-B.umin*CPM)+pad+2, u0=-(c0)/CPM;
  const R0=Math.ceil(Ytop*K)+pad, rows=R0+Math.ceil(-YB*K)+pad+2, n=cols*rows;
  const R={cols,rows,c0,R0,u0,K,cphi,sphi,CPM,HPM,RPM,det,listo:new Uint8Array(Math.ceil(rows/BANDA)),
    hit:new Uint8Array(n),HU:new Float32Array(n),HV:new Float32Array(n),HZ:new Float32Array(n),
    mat:new Uint8Array(n),cut:new Uint8Array(n),hh:new Uint8Array(n),tone:new Uint8Array(n),ao:new Uint8Array(n),mo:new Uint8Array(n),de:new Uint8Array(n),
    nu:new Int8Array(n),nv:new Int8Array(n),nz:new Int8Array(n),LR:new Float32Array(n),LG:new Float32Array(n),LB:new Float32Array(n),EM:new Float32Array(n)};
  if(Object.keys(g.r).length>3) for(const k of Object.keys(g.r)) delete g.r[k];
  g.r[key]=R; ESTAD.rasters++; return R;
}
function hornear(S,R,b){
  if(R.listo[b]) return; R.listo[b]=1; ESTAD.bandas++;
  const g=S.g, sp=S.spec, M=S.M, B=g.box, sdf=g.sdf, info=g.info, cols=R.cols, CPM=R.CPM, eps=0.5/CPM, minStep=0.10/CPM, epsH=0.30/CPM, maxIt=R.det>=2?72:48, sphi=R.sphi, cphi=R.cphi, K=R.K;
  const r0=b*BANDA, r1=Math.min(R.rows,r0+BANDA), car=1.2, hAO=0.25, semF=sp.sem|0, LU=g.luces, BO=g.bocas;
  for(let r=r0;r<r1;r++){
    const Y=(R.R0-r+0.5)/K;
    let t0=Math.max((-Y*sphi-B.zmax)/cphi,(Y*cphi-B.vmax)/sphi), t1=Math.min((-Y*sphi-B.zmin)/cphi,(Y*cphi-B.vmin)/sphi);
    if(t0>=t1) continue;
    for(let c=0;c<cols;c++){
      const U=R.u0+(c+0.5)/CPM; if(U<B.umin||U>B.umax) continue;
      let t=t0, i=r*cols+c, ok=false, v=0, z=0;
      for(let it=0;it<maxIt;it++){
        v=Y*cphi-t*sphi; z=-Y*sphi-t*cphi; const f=sdf(U,v,z);
        if(f<epsH){ ok=true; break; }
        t+=Math.max(f*g.paso,minStep); if(t>t1) break;
      }
      if(!ok) continue;
      R.hit[i]=1; R.HU[i]=U; R.HV[i]=v; R.HZ[i]=z;
      let nu=sdf(U+eps,v,z)-sdf(U-eps,v,z), nv=sdf(U,v+eps,z)-sdf(U,v-eps,z), nz=sdf(U,v,z+eps)-sdf(U,v,z-eps); const nl=Math.hypot(nu,nv,nz)||1; nu/=nl; nv/=nl; nz/=nl;
      R.nu[i]=Math.round(nu*100); R.nv[i]=Math.round(nv*100); R.nz[i]=Math.round(nz*100);
      const I=info(U,v,z), mat=I.mat, cut=I.cut; R.mat[i]=mat; R.cut[i]=cut;
      const hh=H4(c,r,semF,2); R.hh[i]=Math.round(hh*255);
      let ao=1; if(R.det>=1){ ao=1-0.55*clamp((hAO-sdf(U+nu*hAO,v+nv*hAO,z+nz*hAO))/hAO,0,1)-0.25*clamp((2.2*hAO-sdf(U+nu*hAO*2.2,v+nv*hAO*2.2,z+nz*hAO*2.2))/(2.2*hAO),0,1); }
      R.ao[i]=Math.round(clamp(ao,0,1)*255);
      let tone=0.5+(hh-0.5)*0.22+(fbm(U*1.7,v*1.7,z*1.7,semF+9,2)-0.5)*0.34;
      if(mat===0) tone+=0.20*M.estrato*Math.sin(v*5.5+fbm(U*0.3,0,z*0.3,semF+11,2)*5)*(0.4+0.6*(1-sp.edad*0.6));
      if(sp.edad>0) tone+=(fbm(U*0.9,v*0.4,z*0.9,semF+15,2)-0.5)*0.30*sp.edad;
      R.tone[i]=Math.round(clamp(tone,0,1)*255);
      R.mo[i]=Math.round(fbm(U*1.5,v*1.5,z*1.5,(sp.semV|0)+71,3)*255);
      let dm=99, em=0; for(const bo of BO){ const d=Math.hypot(U-bo.mx,z-bo.mz); if(d<dm) dm=d; if((mat===0||mat===1)&&!cut&&v<Math.min(I.hw*0.85,bo.r*2.2+1.2)){ const e=clamp(1-d/(bo.r*1.7+0.5),0,1); if(e>em) em=e; } }
      R.de[i]=Math.round(Math.min(dm,40)*6); R.EM[i]=em*em*0.9;
      /* luz estática, con línea de vista sobre el plano: la roca entre la luz y la celda la corta */
      let lr=0,lg=0,lb=0;
      if(!cut&&mat!==3) for(const L of LU){
        const dx=L.x-U, dy=L.y-v, dz=L.z-z, d=Math.sqrt(dx*dx+dy*dy+dz*dz); if(d>L.rad) continue;
        const lam=mat===4?0.7:Math.max(0,(nu*dx+nv*dy+nz*dz)/(d||1)); if(lam<=0.02) continue;
        let vis=1; for(let s=1;s<=6;s++){ const f=s/7.4; if(g.QS(U+dx*f,z+dz*f)<-0.3){ vis=0; break; } }
        if(!vis) continue;
        const a=Math.pow(1-d/L.rad,2)*L.i*lam; lr+=L.r*a; lg+=L.g*a; lb+=L.b*a;
      }
      R.LR[i]=lr; R.LG[i]=lg; R.LB[i]=lb;
    }
  }
}
function filasVisibles(R,br,ctx){
  const rMin=ctx.rmin||0, rMax=ctx.rows==null?1e9:ctx.rows;
  return [Math.max(0,R.R0-br+rMin),Math.min(R.rows,R.R0-br+rMax)];
}

/* ------------------------------------------------------------------ PINTAR ----
   ctx: put,bc,br,CPM,HPM,RPM,haze,detalle,cols,rows,rmin,t, y además de la cueva:
        oscuridad (0 = todo a la vista, para editar · 1 = la cueva de verdad; por omisión 1)
        memoria   (cuánto se adivina sin luz, 0..0.3; por omisión 0.09)
        luces     ([{x,z,y,rad,r,g,b,i}] dinámicas en coordenadas de la cueva, por ejemplo la linterna) */
function pintar(S,ctx){
  const CPM=ctx.CPM||13, HPM=ctx.HPM||6.8, RPM=ctx.RPM||HPM/1.7, sp=S.spec, M=S.M, g=S.g, st=sp.estado;
  const det=ctx.detalle==null?(CPM<8?0:2):ctx.detalle, put=ctx.put, bc=ctx.bc, br=ctx.br, hz=ctx.haze==null?1:ctx.haze;
  const cMax=ctx.cols==null?1e9:ctx.cols, rMax=ctx.rows==null?1e9:ctx.rows;
  const R=geometria(S,CPM,HPM,RPM,det), {cols,c0,R0}=R;
  const [ra,rb]=filasVisibles(R,br,ctx); if(rb<=ra) return;
  for(let b=Math.floor(ra/BANDA);b<=Math.floor((rb-1)/BANDA);b++) hornear(S,R,b);
  const osc=ctx.oscuridad==null?1:clamp(ctx.oscuridad,0,1), mem=ctx.memoria==null?0.09:clamp(ctx.memoria,0,0.4), amb=lerp(0.80,0.04,osc);
  const DIN=(ctx.luces||[]).filter(l=>l&&l.rad>0), t=ctx.t||0, QS=g.QS, semV=sp.semV|0;
  const Mp=M.pal, Sp=M.suelo, cr=M.cristal, rampa=M.ramp;
  let nd=0;
  for(let r=ra;r<rb;r++){
    const rr=br-(R0-r); if(rr<(ctx.rmin||0)||rr>=rMax) continue;
    for(let c=0;c<cols;c++){
      const i=r*cols+c; if(!R.hit[i]) continue;
      const cc=bc+c-c0; if(cc<0||cc>=cMax) continue;
      const mat=R.mat[i], hh=R.hh[i]/255, tone=R.tone[i]/255, ao=R.ao[i]/255, u=R.HU[i], v=R.HV[i], z=R.HZ[i];
      let lr=R.LR[i], lg=R.LG[i], lb=R.LB[i], glyph, col, em=R.EM[i];
      if(R.cut[i]){ /* el corte de la roca arriba: sólo se adivina */
        const k=mem*0.9+amb*0.18; glyph=hh<0.5?':':'.'; const c2=pal(Mp,0.12+k*0.95); col=pack(c2[0]*(0.55+k),c2[1]*(0.55+k),c2[2]*(0.55+k));
      } else {
        const nu=R.nu[i]/100, nv=R.nv[i]/100, nz=R.nz[i]/100;
        for(let q=0;q<DIN.length;q++){ const L=DIN[q], dx=L.x-u, dy=(L.y==null?1.5:L.y)-v, dz=L.z-z, d=Math.sqrt(dx*dx+dy*dy+dz*dz); if(d>L.rad) continue;
          const lam=mat===4?0.7:Math.max(0,(nu*dx+nv*dy+nz*dz)/(d||1)); if(lam<=0.02) continue;
          let vis=1; for(let s=1;s<=5;s++){ const f=s/6.3; if(QS(u+dx*f,z+dz*f)<-0.3){ vis=0; break; } } if(!vis) continue;
          const a=Math.pow(1-d/L.rad,2)*(L.i==null?1:L.i)*lam; lr+=(L.r==null?1:L.r)*a; lg+=(L.g==null?0.8:L.g)*a; lb+=(L.b==null?0.55:L.b)*a; nd++; }
        const al=amb*(0.35+0.65*ao); lr=lr*ao+al; lg=lg*ao+al; lb=lb*ao+al*1.05;
        if(mat===3){ em=Math.max(em,0.85); }
        const dia=R.de[i]/6, DAY=clamp(1-dia/14,0,1);
        if(em>0){ lr+=em*DIA[0]/255*(mat===3?cr[0]/DIA[0]:1); lg+=em*DIA[1]/255*(mat===3?cr[1]/DIA[1]:1); lb+=em*DIA[2]/255*(mat===3?cr[2]/DIA[2]:1); }
        let lum=Math.max(lr,lg,lb), vis=Math.max(lum,mem*(0.45+0.55*ao)), k0=lum>0.0001?vis/lum:1;
        if(lum<mem*(0.45+0.55*ao)){ lr=lg=lb=vis; k0=1; }
        let t0=clamp(0.05+vis*0.86+(tone-0.5)*M.tono*0.9+(hh-0.5)*0.10,0,1), ramp, p;
        if(mat===1){ ramp=['.',',',';',':','o','O']; p=Sp; }
        else if(mat===2){ ramp=CALCITA.ramp; p=CALCITA.pal; }
        else if(mat===3){ ramp=CRISTAL_G; p=null; }
        else if(mat===4){ ramp=AGUA.ramp; p=AGUA.pal; }
        else { ramp=rampa; p=Mp; }
        const nR=ramp.length;
        if(mat===4){
          const ph=frac(hh*3+t*0.35+(u*0.9+z*0.7)); glyph=ph<0.34?'~':ph<0.66?'-':'~';
          const c2=pal(p,clamp(0.18+vis*0.7,0,1)); col=pack(c2[0]*0.9,c2[1]*0.95,c2[2]*1.05);
          if(vis>0.2&&hh<0.05+vis*0.2){ glyph='='; const c3=pal(p,0.95); col=pack(c3[0]*(0.5+vis*0.5),c3[1]*(0.5+vis*0.5),c3[2]*(0.5+vis*0.5)); }
        } else if(mat===3){
          glyph=CRISTAL_G[clamp(Math.floor((0.45+0.55*clamp(vis,0,1)+(hh-0.5)*0.2)*nR),0,nR-1)];
          const k=0.55+0.55*clamp(vis,0,1); col=pack(cr[0]*k,cr[1]*k,cr[2]*k);
        } else {
          glyph=ramp[clamp(Math.floor(t0*nR),0,nR-1)];
          const c2=pal(p,t0), mean=(lr+lg+lb)/3||1, tr=clamp(1+(lr/mean-1)*1.9,0.35,1.5), tg=clamp(1+(lg/mean-1)*1.9,0.35,1.5), tb=clamp(1+(lb/mean-1)*1.9,0.35,1.5), m=0.5;
          col=pack(c2[0]*(m+(1-m)*tr)*0.98,c2[1]*(m+(1-m)*tg)*0.98,c2[2]*(m+(1-m)*tb)*0.98);
          /* musgo: crece hacia las bocas, donde llega el día, y donde hay agua */
          if(st.musgo>0&&(mat===0||mat===1)&&vis>0.05){ const pr=st.musgo*(DAY*0.8+0.2*st.humedad)*(0.25+1.0*R.mo[i]/255)-0.12;
            if(hh<pr*1.1){ glyph=MUSGO_G[(hh*1000|0)%4]; const mc=pal(PAL_MUSGO,clamp(vis*0.9+(hh-0.5)*0.3,0,1)); col=pack(mc[0]*(0.6+0.4*tr),mc[1]*(0.6+0.4*tg),mc[2]*(0.6+0.4*tb)); } }
          /* humedad: brillos de agua que gotea sobre la roca mojada */
          if(st.humedad>0&&(mat===0||mat===2)&&vis>0.15&&hh>0.9&&frac(hh*37+t*0.05)<st.humedad*0.5){ glyph='\''; const k=0.6+0.5*vis; col=pack(150*k,180*k,205*k); }
          if(em>0.05&&mat!==3){ const k=em; const c2b=pal([[0,0,0],[DIA[0],DIA[1],DIA[2]]],0.55+0.4*k); col=pack(lerp((col>>16)&255,c2b[0],k*0.55),lerp((col>>8)&255,c2b[1],k*0.55),lerp(col&255,c2b[2],k*0.55)); glyph=hh<0.5?'.':'`'; }
        }
        if(sp.tono){ const cq=col; col=pack(((cq>>16)&255)*(1+0.18*sp.tono),((cq>>8)&255),(cq&255)*(1-0.18*sp.tono)); }
        if(sp.lum){ const m=1+sp.lum, cq=col; col=pack(((cq>>16)&255)*m,((cq>>8)&255)*m,(cq&255)*m); }
        if(sp.sat!==1){ const cq=col, r0=(cq>>16)&255, g0=(cq>>8)&255, b0=cq&255, gr=(r0+g0+b0)/3; col=pack(gr+(r0-gr)*sp.sat,gr+(g0-gr)*sp.sat,gr+(b0-gr)*sp.sat); }
      }
      if(hz<0.999) col=pack(((col>>16)&255)*hz,((col>>8)&255)*hz,(col&255)*hz);
      put(cc,rr,glyph,col);
    }
  }
  ESTAD.pintados++;
}

/* el tamaño de la pantalla que necesita la cueva entera y dónde poner su origen (bc,br) para que quepa: lo usa quien la muestra completa */
function marco(S,ctx){ ctx=ctx||{}; const CPM=ctx.CPM||13, HPM=ctx.HPM||6.8, RPM=ctx.RPM||HPM/1.7, det=ctx.detalle==null?(CPM<8?0:2):ctx.detalle, R=geometria(S,CPM,HPM,RPM,det); return {cols:R.cols,rows:R.rows,bc:R.c0,br:R.R0}; }
if(NV.entorno) NV.entorno.conectar('cuevas',{viento:[],luz:false,sombra:false,contorno:false});
const paraPaleta=TIPOS_ID.map(id=>({id:'cueva:'+id,nombre:TIPOS[id].nombre,k:'cueva',cat:TIPOS[id].cat,encaja:o=>o&&o.k==='cueva'&&o.c&&o.c.tipo===id}));
if(NV.motores) NV.motores.registrar({id:'cuevas',nombre:'Cuevas (interiores)',estado:'pendiente',
  archivo:'src/juego/cuevas.js',preview:'preview/cuevas.html',prueba:'pruebas/cuevas.js',
  caras:{generar:o=>crear(o), dibujar:(ctx,S)=>pintar(S,ctx),
    editor:{materiales:MATS.reduce((a,m)=>(a[m]=MATERIALES[m].nombre,a),{}),tipos:TIPOS_ID,
      estado:{musgo:[0,1],humedad:[0,1],charcos:[0,1],cristales:[0,1],derrumbe:[0,1]},
      parametros:{escala:[0.5,2],largo:[6,80],ancho:[0.9,30],alto:[1.6,10],salidas:[1,3],edad:[0,1],tono:[-1,1],lum:[-0.6,0.6],sat:[0,2]},
      conexiones:['luces propias (bocas, cristales, las que pase quien llama)','bocas que lee Umbrales','sin viento'],
      herramientas:['editar (cambia sólo lo pedido)','regenerar forma / derrumbe / vegetación']}}});

NV.cuevas={crear,limpiar,editar,regenerar,plantilla,nuevo,variar,aObjeto,deObjeto,pintar,marco,entradas,luces,suelo,libre,rejilla,paraPaleta,
  MATERIALES,MATS,TIPOS,TIPOS_ID,ESTADO0,estadisticas:()=>Object.assign({},ESTAD,{enCache:CACHE_G.size}),reiniciarCache:()=>{ CACHE_G.clear(); ESTAD.solidos=ESTAD.aciertos=ESTAD.rasters=ESTAD.bandas=ESTAD.pintados=0; }};
})(window.NV);

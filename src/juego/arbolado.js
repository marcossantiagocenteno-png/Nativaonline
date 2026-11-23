/* Nativa Online — MOTOR DE ÁRBOLES (arbolado). LABORATORIO: todavía no lo usa el juego.
   Cuatro familias —pino, encino, álamo y árbol seco— en tres tamaños (pequeño, mediano, grande), con
   variantes dentro de cada una. Es independiente del lienzo: genera el árbol como DATOS (tronco, ramas,
   masas de follaje) y lo vuelca por un `put(c,r,glifo,color)` que le pasa quien lo use (el laboratorio, o más
   adelante el juego). No tiene viento ni luz propios: se los pide a NV.entorno (src/motor/entorno.js), que
   a su vez los lee de los motores aprobados.

   CÓMO SE ARMA UNA COPA. No son puntos al azar: cada copa es un racimo de MASAS (elipsoides con volumen:
   centro, tres radios, un tono). Cada celda toma la masa que queda más cerca de la cámara (un z-buffer), y
   de esa masa sale su normal, así que hay lado iluminado, lado en sombra, y una masa tapa a la de atrás. Una
   pasada de autosombra oscurece lo que tiene otra masa entre él y el sol. Los bordes se deshilachan celda a
   celda y el follaje se agrupa en grumos con huecos por donde asoman las ramas.

   EL VIENTO sólo corre celdas. La copa se inclina hacia el oeste más cuanto más alta es la celda; las hojas
   tiemblan además con la oscilación de `arbol.hoja`; el tronco se corre apenas. La SOMBRA proyectada sale
   de las mismas masas, ya corridas por el viento, así que sigue a la copa. El CONTORNO negro sale del
   sistema compartido (NV.entorno.contorno), sobre la silueta ya movida.

   Unidades: metros. Una celda mide 1/CPM de ancho y 1/HPM de alto (el juego usa 13 y 6,8). Glifos: los del
   diccionario (SPECIES.copa/borde, WOOD, la corteza); no hay glifos nuevos.
   Probado en preview/arbolado.html y pruebas/arbolado.js. */
(function(NV){
'use strict';
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const sm=u=>u<=0?0:u>=1?1:u*u*(3-2*u);
function H(a,b,c){
  let h=Math.imul(a|0,374761393)^Math.imul(b|0,668265263)^Math.imul(c|0,1274126177);
  h=Math.imul(h^(h>>>13),1274126177); return ((h^(h>>>16))>>>0)/4294967296;
}
/* ruido de valores suave en dos dimensiones, determinista por semilla */
function ruido(x,y,s){
  const X=Math.floor(x), Y=Math.floor(y), fx=sm(x-X), fy=sm(y-Y);
  const a=H(X,Y,s), b=H(X+1,Y,s), c=H(X,Y+1,s), d=H(X+1,Y+1,s);
  return a+(b-a)*fx+(c-a)*fy+(a-b-c+d)*fx*fy;
}
const ch=s=>s.charCodeAt(0);
const ENT=()=>NV.entorno;

/* ----------------------------------------------------------------- PALETAS ----
   [r,g,b] finales, de oscura a clara, como las del motor de caminos: se interpolan entre escalones. */
const PAL={
  pino:   [[18,52,46],[32,82,64],[54,116,82],[84,150,102],[122,184,128],[170,216,160]],
  encino: [[16,40,20],[30,70,30],[54,104,40],[86,140,52],[128,172,66],[176,204,96]],
  alamo:  [[30,66,34],[54,104,48],[90,144,58],[132,178,70],[180,208,96],[224,234,140]],
  cortezaPino:  [[48,30,20],[80,52,34],[116,80,52],[150,108,70],[184,138,92]],
  cortezaEncino:[[34,26,20],[62,48,36],[94,74,54],[126,102,76],[156,130,98]],
  cortezaAlamo: [[44,43,40],[82,80,74],[124,122,112],[166,164,152],[198,196,184]],
  seco0:  [[60,44,32],[96,72,52],[130,100,72],[162,128,94],[192,156,116]],        // madera oscura, todavía con algo de humedad
  seco1:  [[70,60,50],[110,98,82],[148,134,114],[182,168,146],[214,200,176]],    // seco y gris
  seco2:  [[96,90,82],[140,132,120],[178,170,156],[208,200,186],[232,226,212]]  // blanqueado, envejecido
};
const ORLA=(5<<16)|(8<<8)|11;                                   // la orla negra, la misma de piedras y árboles del juego
const _c=[0,0,0];
function pal(p,t){            // -> [r,g,b] en _c (sin reservar memoria por celda)
  const n=p.length-1, x=clamp(t,0,1)*n, i=Math.min(n-1,x|0), f=x-i, a=p[i], b=p[i+1];
  _c[0]=a[0]+(b[0]-a[0])*f; _c[1]=a[1]+(b[1]-a[1])*f; _c[2]=a[2]+(b[2]-a[2])*f; return _c;
}
const pack=(r,g,b)=>(clamp(r|0,0,255)<<16)|(clamp(g|0,0,255)<<8)|clamp(b|0,0,255);

/* ------------------------------------------------------------------ FAMILIAS ----
   alto: [pequeño, mediano, grande] como [mínimo, máximo] en metros.
   copa/borde: rampas del diccionario (de ralo a denso); placa/veta: la corteza.
   hueco: cuánto se abre el follaje en grumos (por donde asoman las ramas); tamano: nombre legible. */
const FAMILIAS={
  pino:  {nombre:'Pino',  variantes:3, alto:[[3.0,4.0],[5.2,6.8],[8.6,10.8]],
          copa:['.',':',';','*','A','#'], borde:['.',':','^'], placa:['H','#','%'], veta:'|',
          pal:'pino', corteza:'cortezaPino', hueco:0.10, sombra:0.60},
  encino:{nombre:'Encino',variantes:3, alto:[[3.0,4.0],[4.8,6.0],[6.8,8.4]],
          copa:['.',',','o','e','8','@'], borde:['.',',','`','o'], placa:['H','%','#'], veta:'|',
          pal:'encino', corteza:'cortezaEncino', hueco:0.16, sombra:0.62},
  alamo: {nombre:'Álamo', variantes:3, alto:[[4.2,5.2],[7.0,8.6],[10.0,12.4]],
          copa:['.','"','v','o','8'], borde:['.','"','v'], placa:['l','|','I'], veta:'-',
          pal:'alamo', corteza:'cortezaAlamo', hueco:0.12, sombra:0.45},
  seco:  {nombre:'Árbol seco', variantes:3, alto:[[2.6,3.4],[4.4,5.6],[6.4,8.0]],
          copa:[], borde:[], placa:['t','h','H'], veta:'|', pal:null, corteza:'seco1', hueco:0, sombra:0.40}
};
const NOMBRES=Object.keys(FAMILIAS);
const TAMANOS=['pequeno','mediano','grande'];
const ETIQUETA={pequeno:'Pequeño',mediano:'Mediano',grande:'Grande'};

/* ---------------------------------------------------------------- GENERADORES ----
   Cada uno llena A.tronco (eje y radios), A.blobs (masas de follaje), A.ramas y A.raices. Todo en metros:
   u = a lo ancho (este +), v = altura, z = profundidad (hacia la cámara +). */
const lerp=(a,b,t)=>a+(b-a)*t;
const R=(rnd,a,b)=>a+(b-a)*rnd();

function masa(A,u,v,z,ru,rv,rz,tono,o){
  A.blobs.push(Object.assign({u,v,z,ru,rv,rz,tono,ev:1,irr:1,sd:A.blobs.length*7+3},o||{}));
}
/* una rama curvada: polilínea con radio que se afina. Devuelve la punta y el rumbo */
function rama(A,rnd,u,v,z,theta,len,r0,r1,o){
  o=o||{}; const n=Math.max(3,Math.round(len/0.32)), paso=len/n;
  const dz=o.dz||0, torc=o.torsion==null?0.30:o.torsion, grav=o.grav==null?0.10:o.grav;
  const pts=[[u,v,z]]; let th=theta;
  for(let i=0;i<n;i++){
    th+=(rnd()-0.5)*torc;
    th*=(1-grav);                               // las ramas tienden a subir (se enderezan hacia la vertical)
    u+=Math.sin(th)*paso; v+=Math.cos(th)*paso; z+=dz*paso;
    pts.push([u,v,z]);
  }
  const rm={pts,r0,r1,muerta:!!o.muerta,rota:!!o.rota,hoja:o.hoja};
  A.ramas.push(rm);
  return {u,v,z,th,rama:rm};
}
/* el eje del tronco: de v=0 a v=top, con curva suave. r(v) afinándose y ensanchado al pie */
function tronco(A,rnd,top,r0,rTop,lean,wob,flare){
  const n=Math.max(6,Math.round(top/0.3)), pts=[], rs=[], fase=rnd()*6.28;
  for(let i=0;i<=n;i++){
    const f=i/n, v=top*f;
    const u=lean*top*f*f+wob*top*Math.sin(f*3.4+fase)*f;
    const rad=lerp(r0,rTop,Math.pow(f,0.85))*(1+flare*Math.exp(-v/Math.max(0.25,top*0.07)));
    pts.push([u,v,0]); rs.push(rad);
  }
  A.tronco={pts,r:rs,top};
  return pts;
}
const ejeU=(A,v)=>{ const P=A.tronco.pts; let i=0; while(i<P.length-2&&P[i+1][1]<v) i++; const a=P[i], b=P[i+1], t=(v-a[1])/Math.max(1e-6,b[1]-a[1]); return a[0]+(b[0]-a[0])*clamp(t,0,1); };
const radioEn=(A,v)=>{ const P=A.tronco.pts; let i=0; while(i<P.length-2&&P[i+1][1]<v) i++; const a=P[i], b=P[i+1], t=(v-a[1])/Math.max(1e-6,b[1]-a[1]); return A.tronco.r[i]+(A.tronco.r[i+1]-A.tronco.r[i])*clamp(t,0,1); };

function raices(A,rnd,n,largo){
  const r0=A.tronco.r[0];
  for(let i=0;i<n;i++){
    const lado=i%2?1:-1, L=largo*R(rnd,0.6,1.1)*(1+i*0.05);
    A.raices.push({u0:lado*r0*0.35,u1:lado*(r0*0.5+L),v1:0.02,r0:r0*0.42,r1:r0*0.10,z:R(rnd,-0.1,0.2)});
  }
}

/* ---- PINO ---------------------------------------------------------------- */
function construirPino(A,rnd,ti,variante){
  const Hh=A.h, v=variante;
  const hb=Hh*[0.10,0.16,0.20][ti]*R(rnd,0.8,1.25)*(v===2?1.35:1);               // tronco pelado al pie
  const r0=Hh*[0.034,0.030,0.029][ti], lean=R(rnd,-0.012,0.012);
  tronco(A,rnd,Hh*0.97,r0,r0*0.18,lean,0.004,ti===2?0.9:0.35);
  if(ti===2) raices(A,rnd,4,Hh*0.05);
  const n=Math.round([6,9,12][ti]*R(rnd,0.9,1.15)*(v===2?0.75:1));                // pisos de ramas
  const Rmax=Hh*[0.29,0.235,0.20][ti]*R(rnd,0.92,1.12)*(v===2?1.10:v===0?0.95:1);
  const expo=v===0?0.95:v===1?0.80:0.70, vtop=Hh*0.955, span=vtop-hb;
  const ry0=span/n*(v===2?0.95:1.18);
  const ladoRaro=[R(rnd,0.6,1.0),R(rnd,0.6,1.0)];
  for(let i=0;i<n;i++){
    const f=(i+0.5)/n, vi=hb+span*(i/(n-0.2))*0.98+ry0*0.18;
    const Ri=Rmax*Math.pow(1-f*0.97,expo)*R(rnd,0.82,1.18), fz=Ri*0.62;
    const asim=v===1?R(rnd,0.55,1.05):R(rnd,0.82,1.06);
    const L=[clamp(ladoRaro[0]*(v===1?1:0.95)*asim,0.45,1.1),clamp(ladoRaro[1]*(2-asim)*0.9,0.45,1.1)];
    const lift=v===1?(rnd()-0.5)*Ri*0.12:0, tonoB=clamp(0.20+0.46*f+(rnd()-0.5)*0.30,0.08,0.95);
    const droop=Ri*[0.20,0.17,0.15][ti];
    /* el piso: un núcleo, dos mantos interiores y dos puntas caídas por lado */
    masa(A,ejeU(A,vi)+0.02,vi+ry0*0.05,R(rnd,-0.05,0.18)*Ri,Ri*0.56,ry0*1.0,fz*0.85,tonoB,{ev:1.25,irr:0.9});
    for(let s=-1;s<=1;s+=2){
      const Ls=L[s<0?0:1];
      masa(A,s*Ri*0.46*Ls,vi-droop*0.30,R(rnd,-0.25,0.35)*Ri*0.5,Ri*0.50*Ls,ry0*0.96,fz,tonoB+R(rnd,-0.08,0.10),{ev:1.45,irr:1.0});
      masa(A,s*Ri*0.86*Ls,vi-droop*1.05+lift,R(rnd,-0.3,0.35)*Ri*0.5,Ri*0.34*Ls,ry0*0.82,fz*0.7,tonoB+R(rnd,-0.04,0.14),{ev:1.8,irr:1.2});
      if(f<0.80&&n>6) masa(A,s*Ri*0.64*Ls,vi+ry0*0.12,R(rnd,0.15,0.55)*Ri*0.6,Ri*0.36*Ls,ry0*0.7,fz*0.7,tonoB+0.12,{ev:1.3,irr:1.1});
      /* la rama que sostiene cada manto: se ve por debajo del faldón */
      if(i<n-2) rama(A,rnd,0,vi-ry0*0.3,0,s*1.25,Ri*0.7*Ls,Math.max(0.025,r0*0.28*(1-f)),0.014,{torsion:0.15,grav:-0.04,dz:R(rnd,-0.1,0.2)});
    }
  }
  /* la punta: un cono fino, y la flecha del tronco */
  masa(A,ejeU(A,Hh*0.9),Hh*0.915,0.02,Hh*0.050,Hh*0.075,Hh*0.045,0.78,{ev:1.2,irr:0.8});
  masa(A,ejeU(A,Hh*0.95),Hh*0.97,0.02,Hh*0.026,Hh*0.05,Hh*0.026,0.9,{ev:1.2,irr:0.6});
  /* ramas secas pegadas al tronco, bajo la copa: la edad del árbol */
  if(ti>=1) for(let i=0;i<(ti===2?6:3);i++){
    const vv=R(rnd,0.05,hb*0.95), s=rnd()<0.5?-1:1;
    rama(A,rnd,ejeU(A,vv),vv,0,s*R(rnd,1.0,1.4),R(rnd,0.25,0.55),Math.max(0.02,radioEn(A,vv)*0.30),0.012,{muerta:true,rota:rnd()<0.5,torsion:0.25});
  }
}

/* ---- ENCINO -------------------------------------------------------------- */
function construirEncino(A,rnd,ti,variante){
  const Hh=A.h, v=variante;
  const hb=Hh*(v===2?0.20:0.30)*R(rnd,0.9,1.15);
  const r0=Hh*[0.064,0.062,0.066][ti], lean=R(rnd,-0.045,0.045);
  tronco(A,rnd,hb*1.05,r0,r0*0.78,lean,0.02,1.3);
  raices(A,rnd,ti===0?2:ti===1?4:6,Hh*0.07);
  const W=Hh*(v===0?1.30:v===1?1.12:1.55)*R(rnd,0.92,1.08), nl=[3,4,5][ti]+(rnd()<0.4?1:0);
  const rho=Hh*[0.17,0.185,0.2][ti], vTop=Hh*0.96, puntas=[];
  for(let i=0;i<nl;i++){
    const lado=(i%2?1:-1), ang=lado*R(rnd,0.28,1.05)*(v===2?1.25:1);
    const L=(Hh-hb)*R(rnd,0.62,0.95), ve=hb*R(rnd,0.9,1.02);
    const dz=R(rnd,-0.45,0.45);
    const rr=radioEn(A,ve)*R(rnd,0.55,0.75);
    const p=rama(A,rnd,ejeU(A,ve),ve,0,ang,L*0.62,rr,rr*0.55,{dz,torsion:0.42,grav:0.07});
    const pp=p.rama.pts, mid=pp[Math.floor(pp.length*0.5)];
    puntas.push([p.u,p.v,p.z]);
    /* cada rama se bifurca dos veces */
    for(let k=0;k<2;k++){
      const dth=(k?1:-1)*R(rnd,0.30,0.65), qi=Math.floor(pp.length*R(rnd,0.45,0.85)), q=pp[qi];
      const c=rama(A,rnd,q[0],q[1],q[2],p.th+dth,L*R(rnd,0.28,0.45),rr*0.42,rr*0.14,{dz:dz*0.8+R(rnd,-0.2,0.2),torsion:0.5,grav:0.05});
      puntas.push([c.u,c.v,c.z]);
      /* y la bifurcación, una más fina */
      const cp=c.rama.pts, q2=cp[Math.floor(cp.length*0.6)];
      const c2=rama(A,rnd,q2[0],q2[1],q2[2],c.th+(k?-1:1)*R(rnd,0.3,0.6),L*R(rnd,0.14,0.24),rr*0.16,rr*0.07,{torsion:0.5,grav:0.05,dz:R(rnd,-0.2,0.2)});
      puntas.push([c2.u,c2.v,c2.z]);
    }
    if(mid) puntas.push([mid[0],mid[1],mid[2]]);
  }
  /* copa: masas en cada punta de rama + un relleno en el volumen de la copa */
  const centro=[ejeU(A,hb),hb+(vTop-hb)*0.52], sa=W*0.5, sb=(vTop-hb)*0.52;
  for(const p of puntas){
    const k=3+((rnd()*3)|0);
    for(let j=0;j<k;j++){
      const rr=rho*R(rnd,0.65,1.18);
      const u=p[0]+R(rnd,-1,1)*rho*0.9, vv=clamp(p[1]+R(rnd,-0.55,0.75)*rho,hb*0.9,vTop-rr*0.35), z=p[2]+R(rnd,-1.1,1.1)*rho;
      const dd=Math.hypot((u-centro[0])/(sa*1.12),(vv-centro[1])/(sb*1.18));
      if(dd>1.05) continue;
      masa(A,u,vv,z,rr,rr*R(rnd,0.78,0.96),rr*0.95,clamp(0.36+0.28*((vv-hb)/(vTop-hb))+R(rnd,-0.22,0.22),0.05,0.98),{irr:1.1});
    }
  }
  const paso=rho*0.95;
  for(let gv=hb+rho*0.4;gv<vTop;gv+=paso*0.92) for(let gu=-sa;gu<=sa;gu+=paso){
    const u=gu+R(rnd,-0.3,0.3)*paso+centro[0], vv=gv+R(rnd,-0.3,0.3)*paso;
    const dd=Math.hypot((u-centro[0])/sa,(vv-centro[1])/sb);
    if(dd>1.0||rnd()>Math.pow(1-dd*dd,0.28)) continue;
    const rr=rho*R(rnd,0.62,1.0);
    masa(A,u,Math.min(vv,vTop-rr*0.3),R(rnd,-1.0,1.1)*rho*(1-dd*0.4),rr,rr*R(rnd,0.78,0.95),rr*0.9,clamp(0.30+0.30*((vv-hb)/(vTop-hb))+R(rnd,-0.2,0.2),0.04,0.98),{irr:1.15});
  }
}

/* ---- ÁLAMO --------------------------------------------------------------- */
function construirAlamo(A,rnd,ti,variante){
  const Hh=A.h, v=variante;
  const hb=Hh*[0.13,0.17,0.19][ti]*R(rnd,0.9,1.15);
  const r0=Math.max(0.045,Hh*0.0215), lean=R(rnd,-0.012,0.012);
  tronco(A,rnd,Hh*0.98,r0,r0*0.22,lean,0.006,ti===2?0.8:0.3);
  if(ti===2) raices(A,rnd,4,Hh*0.04);
  const Wc=Hh*(v===0?0.155:v===1?0.255:0.205)*R(rnd,0.9,1.1), vtop=Hh*0.985, span=vtop-hb;
  const niveles=Math.max(5,Math.round(span/(0.42+0.05*ti))), dv=span/niveles;
  const ladea=v===2?R(rnd,-0.06,0.06):0;
  for(let i=0;i<niveles;i++){
    const f=(i+0.5)/niveles, vi=hb+span*f;
    /* llama: ancha a un tercio, afinándose hacia la punta y hacia el pie */
    const w=Wc*0.5*(0.30+0.70*Math.sin(Math.PI*Math.pow(clamp(f*0.92+0.04,0,1),0.78)))*R(rnd,0.82,1.14);
    const eje=ejeU(A,vi)+ladea*span*f*f+R(rnd,-0.12,0.12)*Wc*0.2;
    const tono=clamp(0.34+0.46*f+R(rnd,-0.22,0.22),0.05,0.98);
    masa(A,eje,vi,R(rnd,0.0,0.2)*w,w*0.82,dv*R(rnd,0.95,1.35),w*0.82,tono,{irr:1.05});
    for(let s=-1;s<=1;s+=2){
      masa(A,eje+s*w*R(rnd,0.45,0.72),vi+R(rnd,-0.25,0.35)*dv,R(rnd,-0.5,0.7)*w,w*R(rnd,0.50,0.74),dv*R(rnd,0.85,1.2),w*0.65,tono+R(rnd,-0.1,0.14),{irr:1.2});
      /* un mechón que asoma: rompe el borde liso */
      if(rnd()<0.55) masa(A,eje+s*w*R(rnd,0.85,1.1),vi+R(rnd,-0.4,0.4)*dv,R(rnd,-0.2,0.6)*w,w*0.30,dv*R(rnd,0.55,0.85),w*0.30,tono+0.1,{irr:1.3});
      if(i%3===1&&f<0.8) rama(A,rnd,ejeU(A,vi),vi,0,s*R(rnd,0.35,0.6),w*R(rnd,1.0,1.5),Math.max(0.02,radioEn(A,vi)*0.4),0.012,{torsion:0.18,grav:-0.02,dz:R(rnd,-0.1,0.2)});
    }
  }
  masa(A,ejeU(A,Hh*0.95),Hh*0.965,0.02,Wc*0.17,Hh*0.04,Wc*0.17,0.92,{irr:0.8});
  if(ti>=1) for(let i=0;i<4;i++){
    const vv=R(rnd,0.2,hb*0.95), s=rnd()<0.5?-1:1;
    rama(A,rnd,ejeU(A,vv),vv,0,s*R(rnd,0.5,0.9),R(rnd,0.2,0.45),Math.max(0.018,radioEn(A,vv)*0.3),0.01,{muerta:true,torsion:0.2});
  }
}

/* ---- ÁRBOL SECO ---------------------------------------------------------- */
function construirSeco(A,rnd,ti,variante){
  const Hh=A.h, v=variante;
  A.sequedad=Math.min(2,(rnd()*3)|0);
  const r0=Hh*[0.050,0.046,0.044][ti], lean=R(rnd,-0.07,0.07)*(v===0?1.8:1), nTop=Hh*R(rnd,0.62,0.78);
  tronco(A,rnd,nTop,r0,r0*0.42,lean,v===0?0.028:0.012,1.2);
  raices(A,rnd,ti===0?2:ti===1?4:6,Hh*0.07);
  const prof=[2,3,3][ti], nl=[4,6,8][ti]+(v===1?2:0);
  const maxP=prof;
  const hacer=(u,vv,z,th,len,rr,d,sinCopa)=>{
    const rota=rnd()<(v===2?0.34:0.16)&&d>0, l=rota?len*R(rnd,0.45,0.8):len;
    const r1=rota?rr*0.7:rr*(d>=maxP?0.38:0.34);
    const p=rama(A,rnd,u,vv,z,th,l,rr,Math.max(0.011,r1),{rota,torsion:v===0?0.7:0.42,grav:0.07,dz:R(rnd,-0.5,0.5),muerta:A.sequedad===2&&rnd()<0.3});
    if(rota||d>=maxP) return;
    const pp=p.rama.pts, hijos=d===0?3:2;
    for(let k=0;k<hijos;k++){
      const qi=Math.max(1,Math.floor(pp.length*R(rnd,0.30,0.88))), q=pp[qi];
      const dth=(rnd()<0.5?-1:1)*R(rnd,0.32,0.9);
      hacer(q[0],q[1],q[2],p.th*0.6+dth,len*R(rnd,0.42,0.68),Math.max(0.012,rr*R(rnd,0.40,0.58)),d+1);
    }
    /* la punta sigue (bifurcación terminal) */
    if(d<maxP-0 && rnd()<0.85) hacer(p.u,p.v,p.z,p.th+(rnd()-0.5)*0.9,len*R(rnd,0.40,0.6),Math.max(0.012,rr*0.4),d+1);
  };
  for(let i=0;i<nl;i++){
    const f=0.34+0.62*(i/(nl-0.4)), vv=nTop*f, lado=i%2?1:-1;
    const th=lado*R(rnd,0.42,1.10)*(v===0?1.15:1), len=Hh*R(rnd,0.25,0.46)*(1-0.38*f);
    hacer(ejeU(A,vv),vv,0,th,len,Math.max(0.025,radioEn(A,vv)*R(rnd,0.55,0.8)),0);
  }
  /* la guía del tronco se sigue en ramas finas hacia arriba, o termina rota */
  const rotoArriba=v===2||rnd()<0.28;
  const tope=rama(A,rnd,ejeU(A,nTop),nTop,0,R(rnd,-0.25,0.25),Hh-nTop,radioEn(A,nTop)*0.85,rotoArriba?radioEn(A,nTop)*0.55:0.014,{rota:rotoArriba,torsion:0.5,grav:0.12});
  if(!rotoArriba){ const pp=tope.rama.pts; for(let k=0;k<3;k++){ const q=pp[Math.floor(pp.length*R(rnd,0.3,0.9))]; hacer(q[0],q[1],q[2],(k%2?1:-1)*R(rnd,0.4,0.9),Hh*R(rnd,0.12,0.22),0.02,maxP-1); } }
  /* muñones secos pegados al tronco */
  for(let i=0;i<(ti===0?2:5);i++){
    const vv=R(rnd,0.2,nTop*0.8), s=rnd()<0.5?-1:1;
    rama(A,rnd,ejeU(A,vv),vv,0,s*R(rnd,0.8,1.3),R(rnd,0.15,0.4),Math.max(0.02,radioEn(A,vv)*0.3),0.015,{rota:true,muerta:true,torsion:0.2});
  }
}

const CONSTRUCTORES={pino:construirPino,encino:construirEncino,alamo:construirAlamo,seco:construirSeco};

/* ------------------------------------------------------------------ GENERAR ----
   generar(familia,tamaño,semilla[,{variante,alto}]) -> árbol (datos puros). Misma semilla, mismo árbol. */
function medir(A){
  let u0=1e9,u1=-1e9,v1=0,z0=1e9,z1=-1e9,vb0=1e9,vb1=-1e9;
  for(const b of A.blobs){
    u0=Math.min(u0,b.u-b.ru*1.1); u1=Math.max(u1,b.u+b.ru*1.1); v1=Math.max(v1,b.v+b.rv*1.1);
    z0=Math.min(z0,b.z-b.rz); z1=Math.max(z1,b.z+b.rz); vb0=Math.min(vb0,b.v-b.rv*b.ev); vb1=Math.max(vb1,b.v+b.rv);
  }
  for(const m of A.ramas) for(const p of m.pts){ u0=Math.min(u0,p[0]-m.r0); u1=Math.max(u1,p[0]+m.r0); v1=Math.max(v1,p[1]+m.r0); }
  for(let i=0;i<A.tronco.pts.length;i++){ const p=A.tronco.pts[i], r=A.tronco.r[i]; u0=Math.min(u0,p[0]-r*1.4); u1=Math.max(u1,p[0]+r*1.4); v1=Math.max(v1,p[1]); }
  for(const q of A.raices){ u0=Math.min(u0,q.u1-q.r0,q.u0-q.r0); u1=Math.max(u1,q.u1+q.r0,q.u0+q.r0); }
  A.ext={u0,u1,v1,z0:Math.min(z0,-0.3),z1:Math.max(z1,0.3),vb0:isFinite(vb0)?vb0:0,vb1:isFinite(vb1)?vb1:A.h};
}
function generar(fam,tam,sem,opt){
  const F=FAMILIAS[fam]; if(!F) throw new Error('familia desconocida: '+fam);
  const ti=TAMANOS.indexOf(tam); if(ti<0) throw new Error('tamaño desconocido: '+tam);
  opt=opt||{}; sem=sem|0;
  const rnd=NV.mulberry((sem*2654435+NOMBRES.indexOf(fam)*7919+ti*104729+12345)|0);
  const a=F.alto[ti], Hh=opt.alto||(a[0]+rnd()*(a[1]-a[0]));
  const variante=opt.variante!=null?clamp(opt.variante|0,0,F.variantes-1):Math.floor(rnd()*F.variantes);
  const A={fam,tam,ti,sem,variante,h:Hh,tronco:null,blobs:[],ramas:[],raices:[],sequedad:0,ext:null,_r:null,_f:new Map(),_s:null};
  CONSTRUCTORES[fam](A,rnd,ti,variante);
  medir(A);
  return A;
}

/* -------------------------------------------------------------------- RASTER ----
   El árbol sin viento, en una rejilla de celdas con z-buffer. Se guarda en el árbol y sólo se rehace si cambia el
   zoom (CPM/HPM) o la luz. Después de esto el viento nada más desplaza celdas. */
/* La clave de caché de la luz, redondeada: el paso de la hora no obliga a rehacer cada árbol en cada cuadro. */
const LK=l=>{ const q=(v,k)=>Math.round((v||0)/k); return [q(l.L.x,0.03),q(l.L.y,0.03),q(l.L.z,0.03),q(l.amb,0.04),q(l.r,0.05),q(l.g,0.05),q(l.b,0.05),q(l.porMetro,0.05)].join(','); };
function raster(A,CPM,HPM,luz){
  const key=CPM+'|'+HPM+'|'+LK(luz);
  if(A._r&&A._r.key===key) return A._r;
  const F=FAMILIAS[A.fam], pad=3, e=A.ext;
  const c0=Math.ceil(-e.u0*CPM)+pad, W=c0+Math.ceil(e.u1*CPM)+pad+1;
  const R0=Math.ceil(e.v1*HPM)+pad, Hh=R0+pad+2, n=W*Hh;
  const Z=new Float32Array(n).fill(-1e9), T=new Uint8Array(n), NE=new Float32Array(n), NS=new Float32Array(n), NU=new Float32Array(n);
  const TO=new Float32Array(n), ED=new Uint8Array(n), DI=new Uint8Array(n), HV=new Float32Array(n);
  const sem=A.sem;
  /* una celda de pantalla (c,r) y el punto del árbol (u,v) */
  const U=c=>(c-c0+0.5)/CPM, V=r=>(R0-r+0.5)/HPM;

  /* un disco de madera en (u,v) con radio rad (m): una celda de ancho como mínimo */
  function disco(u,v,z,rad,ty,dir,tono){
    const rc=Math.max(0.62,rad*CPM), rr=Math.max(0.62,rad*HPM), cc=u*CPM+c0, cr=R0-v*HPM;
    const a=Math.floor(cc-rc-1), b=Math.ceil(cc+rc+1), c=Math.floor(cr-rr-1), d=Math.ceil(cr+rr+1);
    for(let r=c;r<=d;r++){ if(r<0||r>=Hh||r>R0+1) continue;
      for(let q=a;q<=b;q++){ if(q<0||q>=W) continue;
        const dx=(q+0.5-cc)/rc, dy=(r+0.5-cr)/rr, d2=dx*dx+dy*dy; if(d2>1) continue;
        const i=r*W+q, zz=z+rad*Math.sqrt(1-dx*dx)*0.9; if(zz<=Z[i]) continue;
        Z[i]=zz; T[i]=ty; NE[i]=dx; NS[i]=Math.sqrt(1-dx*dx); NU[i]=0; TO[i]=tono; ED[i]=0; DI[i]=dir; HV[i]=rad;
      } }
  }
  /* un tramo de madera entre dos puntos, con radios que cambian */
  function tramo(p,q,ra,rb,ty,tono){
    const du=q[0]-p[0], dv=q[1]-p[1], L=Math.hypot(du*CPM,dv*HPM), k=Math.max(1,Math.ceil(L*1.6));
    /* dirección en pantalla para los glifos finos */
    const sx=du*CPM, sy=-dv*HPM, ang=Math.atan2(Math.abs(sy),Math.abs(sx));
    const dir=ang>1.15?0:(ang<0.38?3:(sx*sy<0?2:1));   // 0 | · 1 / · 2 \ · 3 -  (en pantalla, y crece hacia abajo)
    for(let s=0;s<=k;s++){ const t=s/k; disco(p[0]+du*t,p[1]+dv*t,lerp(p[2]||0,q[2]||0,t),lerp(ra,rb,t),ty,dir,tono); }
  }
  /* raíces: sobre el suelo */
  for(const q of A.raices){
    const p0=[q.u0,0.30,q.z], p1=[(q.u0+q.u1)*0.5,0.12,q.z], p2=[q.u1,0.02,q.z];
    tramo(p0,p1,q.r0,q.r0*0.6,1,0.3); tramo(p1,p2,q.r0*0.6,q.r1,1,0.3);
  }
  /* el tronco */
  const tp=A.tronco.pts, tr=A.tronco.r;
  for(let i=0;i<tp.length-1;i++) tramo(tp[i],tp[i+1],tr[i],tr[i+1],1,H(i,sem,5));
  /* las ramas: marcadas de más a menos gruesas para que lo fino quede encima */
  const ordenadas=A.ramas.slice().sort((a,b)=>b.r0-a.r0);
  for(const m of ordenadas){
    const P=m.pts, to=m.muerta?0.15:H(P.length,sem,9);
    for(let i=0;i<P.length-1;i++){
      const f0=i/(P.length-1), f1=(i+1)/(P.length-1);
      tramo(P[i],P[i+1],lerp(m.r0,m.r1,f0),lerp(m.r0,m.r1,f1),2,to);
    }
    if(m.rota){ const q=P[P.length-1]; disco(q[0],q[1],q[2],m.r1*0.9,2,0,0.25); }   // el muñón roto, algo más grueso
  }

  /* el follaje: masas con volumen */
  const hueco=F.hueco, sd=sem*13+7;
  for(let bi=0;bi<A.blobs.length;bi++){
    const b=A.blobs[bi], rvU=b.rv, rvD=b.rv*b.ev;
    const a=Math.floor((b.u-b.ru*1.2)*CPM)+c0, bb=Math.ceil((b.u+b.ru*1.2)*CPM)+c0;
    const c=Math.floor(R0-(b.v+rvU*1.2)*HPM), d=Math.ceil(R0-(b.v-rvD*1.2)*HPM);
    for(let r=Math.max(0,c);r<=Math.min(Hh-1,d);r++){
      const v=V(r), dv=(v-b.v)/(v>=b.v?rvU:rvD);
      for(let q=Math.max(0,a);q<=Math.min(W-1,bb);q++){
        const u=U(q), du=(u-b.u)/b.ru;
        let d2=du*du+dv*dv; if(d2>=1.35) continue;
        d2*=1+(0.5-ruido(u*3.3+b.sd,v*3.0,sd))*0.62*b.irr;                    // silueta orgánica, no una elipse
        if(d2>=1) continue;
        const i=r*W+q;
        if(hueco>0&&d2>0.15){ const g=ruido(u*2.6+11,v*2.3+5,sd+5); if(g<hueco*(0.25+0.75*d2)) continue; }   // grumos con huecos
        if(d2>0.60&&H(q,r,sem)<(d2-0.60)/0.40*0.88) continue;                // las hojas del borde se deshilachan
        const z=b.z+b.rz*Math.sqrt(1-d2); if(z<=Z[i]) continue;
        Z[i]=z; T[i]=3; NE[i]=du; NU[i]=dv; NS[i]=Math.sqrt(1-d2);
        TO[i]=b.tono; ED[i]=d2>0.60?1:0;
      }
    }
  }

  /* autosombra: si hacia el sol hay algo más cerca de la cámara que el rayo, esta celda está tapada */
  const Ls=luz.L, ZS=A.ext.z1-A.ext.z0;
  /* luz de lectura: el sol del entorno suele quedar detrás del árbol y las caras que miran a cámara se pierden.
     Se conserva el lado (este/oeste) y la altura, y se inclina hacia la cámara lo justo para ver el volumen. */
  const ly=Ls.y*0.35+0.50, ln=Math.hypot(Ls.x,ly,Ls.z)||1;
  const luzV=Object.assign({},luz,{L:{x:Ls.x/ln,y:ly/ln,z:Ls.z/ln}});
  const sombraProp=new Float32Array(n).fill(1);
  const dists=[0.30,0.62];
  for(let r=0;r<Hh;r++) for(let q=0;q<W;q++){
    const i=r*W+q, ty=T[i]; if(!ty||ty===1&&false) continue;
    let f=1;
    for(let k=0;k<dists.length;k++){
      const dm=dists[k], jc=q+Math.round(Ls.x*dm*CPM), jr=r-Math.round(Ls.z*dm*HPM);
      if(jc<0||jr<0||jc>=W||jr>=Hh) continue;
      const j=jr*W+jc;
      if(T[j]&&Z[j]>Z[i]+Ls.y*dm+0.04&&T[j]!==1) f*=0.78;
      else if(T[j]===1&&Z[j]>Z[i]+Ls.y*dm+0.10) f*=0.85;
    }
    sombraProp[i]=f;
  }

  /* glifos y colores finales */
  const G=new Uint8Array(n), C=new Int32Array(n);
  const palF=F.pal?PAL[F.pal]:null, palC=A.fam==='seco'?PAL['seco'+A.sequedad]:PAL[F.corteza];
  const vc0=A.ext.vb0, vcs=Math.max(0.5,A.ext.vb1-A.ext.vb0), zc0=A.ext.z0, zcs=Math.max(0.5,ZS);
  for(let r=0;r<Hh;r++) for(let q=0;q<W;q++){
    const i=r*W+q, ty=T[i]; if(!ty) continue;
    const v=V(r);
    let lum=ENT().sobreCara(NE[i],NS[i],NU[i]*(ty===3?1:0),luzV);
    if(ty===3){
      /* abajo y adentro, más oscuro; arriba y al frente, más claro */
      const ao=0.88+0.12*clamp((Z[i]-zc0)/zcs,0,1), vf=0.88+0.22*clamp((v-vc0)/vcs,0,1);
      lum*=ao*vf*sombraProp[i];
      const h=H(q,r,sem+3), dens=clamp(0.10+0.95*(lum-0.30)/1.05+(h-0.5)*0.40,0,1);
      const rp=ED[i]?F.borde:F.copa;
      G[i]=ch(rp[Math.min(rp.length-1,Math.floor(dens*rp.length))]);
      const t=clamp((lum-0.35)/0.75*0.85+(TO[i]-0.5)*0.34+0.16+(h-0.5)*0.12,0,1);
      const c=pal(palF,t); C[i]=pack(c[0]*luz.r,c[1]*luz.g,c[2]*luz.b);
    } else {
      lum*=sombraProp[i]*(ty===2?0.92:1);
      const rad=HV[i], u=U(q);
      const fino=rad<0.052;
      if(fino||A.fam==='seco'&&rad<0.075){
        G[i]=ch(DI[i]===0?'|':DI[i]===1?'/':DI[i]===2?'\\':'-');
      } else {
        const vn=ruido(u*21,v*1.7,sem+9), rp=F.placa;
        G[i]=vn>0.70?ch(F.veta):ch(rp[clamp(Math.floor((1-clamp((lum-0.35)/0.9,0,1))*rp.length),0,rp.length-1)]);
        if(H(q,r,sem+11)<0.07) G[i]=ch('.');
      }
      const t=clamp((lum-0.35)/0.75*0.8+(TO[i]-0.5)*0.18+0.12,0,1);
      const c=pal(palC,t); C[i]=pack(c[0]*luz.r,c[1]*luz.g,c[2]*luz.b);
    }
  }
  const out={key,W,H:Hh,c0,R0,G,C,Z,T,TO,ED,DI,n};
  A._r=out; A._f.clear(); A._s=null;
  return out;
}

/* ---------------------------------------------------------------- VIENTO + CUADRO ----
   El árbol en un instante: aplica el viento a las celdas ya rasterizadas. Se guarda por "nivel de viento"
   (el desplazamiento redondeado), así un árbol que sigue en la misma ráfaga no se rehace. */
function vientoDe(A,ctx){
  const e=ENT(), x=ctx.x||0, y=ctx.y||0, t=ctx.t||0, k=Math.sqrt(A.h/5);
  const wr=e.viento('arbol.rama',x,y,t), wt=e.viento('arbol.tronco',x,y,t), wh=e.viento('arbol.hoja',x,y,t);
  const sw=ctx.sway==null?1:ctx.sway;
  return {rama:wr.mov*k*sw, tronco:wt.mov*k*sw, hoja:wh.mov*k*sw, osc:wh.osc*sw, f:wh.f||1.15, I:wr.I};
}
const SHIFT=(m,v,H)=>Math.round(m*Math.pow(clamp(v/H,0,1.15),1.4));
function cuadro(A,ctx){
  const e=ENT(), CPM=ctx.CPM||13, HPM=ctx.HPM||6.8, luz=e.luz(ctx.x||0,ctx.y||0,ctx.t||0);
  const Rr=raster(A,CPM,HPM,luz), w=vientoDe(A,ctx);
  const qR=Math.round(w.rama*2), qT=Math.round(w.tronco*2), qO=Math.round(w.osc*3);
  const fase=qO>0?Math.floor(((ctx.t||0)*w.f*4))&3:0, key=qR+'|'+qT+'|'+qO+'|'+fase;
  let F=A._f.get(key); if(F) return F;
  const mR=qR/2, mT=qT/2, mO=qO/3, padW=Math.min(14,Math.ceil(Math.abs(mR)+mO+Math.abs(mT))+3);
  const W=Rr.W+padW*2, Hh=Rr.H, n=W*Hh;
  const G=new Uint8Array(n), C=new Int32Array(n), Zo=new Float32Array(n).fill(-1e9);
  const sem=A.sem, Hm=A.h;
  const ang=fase/4*6.2832;
  for(let r=0;r<Hh;r++){
    const v=(Rr.R0-r+0.5)/HPM;
    const sR=-SHIFT(mR,v,Hm), sT=-SHIFT(mT,v,Hm);
    for(let q=0;q<Rr.W;q++){
      const i=r*Rr.W+q, g=Rr.G[i]; if(!g) continue;
      const ty=Rr.T[i]; let dc=ty===1?sT:sR;
      if(ty===3&&mO>0.01){ const ph=H(q>>2,r>>1,sem)*6.2832; dc+=Math.round(mO*Math.sin(ang+ph)); }
      const c=q+padW+dc; if(c<0||c>=W) continue;
      const j=r*W+c, z=Rr.Z[i]; if(z<=Zo[j]) continue;
      Zo[j]=z; G[j]=g; C[j]=Rr.C[i];
    }
  }
  /* el contorno: sobre la silueta ya movida */
  const O=e.contorno.silueta(G,W,Hh);
  for(let i=0;i<n;i++) if(O[i]){ G[i]=35; C[i]=ORLA; }
  F={G,C,W,H:Hh,c0:Rr.c0+padW,R0:Rr.R0,key};
  if(A._f.size>=8) A._f.delete(A._f.keys().next().value);
  A._f.set(key,F);
  return F;
}

/* pinta el árbol: `ctx.put(c,r,glifo,color)`, base en (ctx.bc, ctx.br) (la celda del pie del tronco), ctx.haze opcional */
function pintar(A,ctx){
  const F=cuadro(A,ctx), put=ctx.put, bc=ctx.bc, br=ctx.br, hz=ctx.haze==null?1:ctx.haze;
  const cMax=ctx.cols==null?1e9:ctx.cols, rMax=ctx.rows==null?1e9:ctx.rows;
  for(let r=0;r<F.H;r++){
    const rr=br-(F.R0-r); if(rr<(ctx.rmin||0)||rr>=rMax) continue;
    for(let q=0;q<F.W;q++){
      const i=r*F.W+q, g=F.G[i]; if(!g) continue;
      const cc=bc+q-F.c0; if(cc<0||cc>=cMax) continue;
      let col=F.C[i];
      if(hz<0.999) col=pack(((col>>16)&255)*hz,((col>>8)&255)*hz,(col&255)*hz);
      put(cc,rr,g,col);
    }
  }
}

/* ------------------------------------------------------------------- SOMBRA ----
   La sombra proyectada sobre el suelo, de las mismas masas, corridas por el viento. Devuelve una rejilla
   {c0,r0,w,h,k} relativa a la celda del pie; cada celda k de 0 a ~0,6 dice cuánto oscurece el suelo. */
function sombra(A,ctx){
  const e=ENT(), CPM=ctx.CPM||13, RPM=ctx.RPM||4, luz=e.luz(ctx.x||0,ctx.y||0,ctx.t||0), w=vientoDe(A,ctx);
  const key=Math.round(w.rama*2)+'|'+CPM+'|'+RPM+'|'+LK(luz);
  if(A._s&&A._s.key===key) return A._s.h;
  const cuerpos=[], F=FAMILIAS[A.fam];
  for(const b of A.blobs) cuerpos.push({e:b.u,h:b.v,s:b.z,re:b.ru,rh:b.rv,rs:b.rz,f:0.85});
  /* el tronco y las ramas gruesas: una sombra fina y larga */
  const tp=A.tronco.pts;
  for(let i=0;i<tp.length;i+=3) cuerpos.push({e:tp[i][0],h:tp[i][1],s:0,re:Math.max(0.05,A.tronco.r[i]),rh:0.3,rs:Math.max(0.05,A.tronco.r[i]),f:1});
  if(A.fam==='seco') for(const m of A.ramas){ if(m.r0<0.04) continue; for(let i=0;i<m.pts.length;i+=2){ const p=m.pts[i]; cuerpos.push({e:p[0],h:p[1],s:p[2],re:Math.max(0.04,m.r0*0.7),rh:0.2,rs:0.05,f:0.9}); } }
  const k=Math.sqrt(A.h/5);
  const h=e.huella(cuerpos,luz,{CPM,RPM,fuerza:F.sombra,despl:vv=>-w.rama*Math.pow(clamp(vv/A.h,0,1.15),1.4)/CPM});
  A._s={key,h};
  return h;
}
/* la sombra sobre el suelo, celda a celda, por una función que da quien dibuja: sombrear(c,r,k) */
function pintarSombra(A,ctx){
  const h=sombra(A,ctx), f=ctx.sombrear; if(!f) return h;
  for(let r=0;r<h.h;r++) for(let q=0;q<h.w;q++){ const k=h.k[r*h.w+q]; if(k>0.03) f(ctx.bc+h.c0+q,ctx.br+h.r0+r,k); }
  return h;
}

/* ------------------------------------------------------------------ CATÁLOGO ---- */
const catalogo=()=>{
  const out=[];
  for(const f of NOMBRES) for(const t of TAMANOS) out.push({id:f+':'+t,familia:f,tam:t,nombre:FAMILIAS[f].nombre+' '+ETIQUETA[t].toLowerCase()});
  return out;
};

NV.arbolado={FAMILIAS,NOMBRES,TAMANOS,ETIQUETA,PAL,generar,raster,cuadro,pintar,sombra,pintarSombra,catalogo,ORLA,aObjeto,previa};

/* ------------------------------------------------------------------ MODO DIOS ----
   Cara "objetos" y cara "creador": el árbol que el Modo Dios coloca y diseña es {k:'arbolnv', r:receta, h, s, fx:0, fy:0};
   la receta es {fam,tam,sem,alto?,variante?}. Convive con los árboles del juego (k:'arbol'), que no se tocan. */
const azarEd=()=>(NV.azarEditor||Math.random)();
const nuevaSem=()=>((azarEd()*60000)|0)+1;
const clon=o=>JSON.parse(JSON.stringify(o));
const ID_ARBOL='arbolado:arbol', ARBOL0={fam:'pino',tam:'mediano'};
let DISENO=null;
function limpiar(spec){ const o=clon(spec); if(!FAMILIAS[o.fam]) o.fam='pino'; if(TAMANOS.indexOf(o.tam)<0) o.tam='mediano'; o.sem=o.sem|0; return o; }
function aObjeto(spec){
  const r=limpiar(spec), A=generar(r.fam,r.tam,r.sem,r);
  return {k:'arbolnv',r,h:+A.h.toFixed(2),s:r.sem,fx:0,fy:0};
}
const PCACHE=new Map();
const arbolDe=r=>{ const k=JSON.stringify(r); let A=PCACHE.get(k); if(!A){ if(PCACHE.size>24) PCACHE.clear(); A=generar(r.fam,r.tam,r.sem,r); PCACHE.set(k,A); } return A; };
const NOM_FAM=NOMBRES.reduce((a,f)=>{ a[f]=FAMILIAS[f].nombre; return a; },{});
const CAMPOS_ARBOL=[
  {ruta:'fam',etq:'Familia',tipo:'sel',opciones:NOMBRES.map(f=>[f,NOM_FAM[f]]),grupo:'Árbol'},
  {ruta:'tam',etq:'Tamaño',tipo:'sel',opciones:TAMANOS.map(t=>[t,ETIQUETA[t]]),grupo:'Árbol'},
  {ruta:'alto',etq:'Altura (m)',tipo:'rng',min:0,max:16,paso:0.5,auto:0,grupo:'Árbol'},
  {ruta:'variante',etq:'Variante',tipo:'rng',min:-1,max:2,paso:1,auto:-1,grupo:'Árbol'},
  {ruta:'viento',etq:'Viento (sólo la vista)',tipo:'rng',min:0,max:1.2,paso:0.05,def:0,vista:true,grupo:'Vista previa'}];
function previa(spec,opt){
  const r=limpiar(spec), A=arbolDe(r), E=A.ext, z=A.h<4.6?2:1, ancho=Math.max(E.u1-E.u0,2);
  const mw=Math.max(Math.ceil(ancho)+2,4), mh=Math.ceil(A.h*1.7)+3;
  return {mw,mh,z,S:A,items:[{x:mw/2-(E.u0+E.u1)/2,y:mh-1.5,pintar:ctx=>{ pintarSombra(A,ctx); pintar(A,ctx); }}],detalle:NOM_FAM[r.fam]+' · '+A.h.toFixed(1)+' m de alto'};
}
const resumen=o=>NOM_FAM[o.r.fam]+' · '+ETIQUETA[o.r.tam].toLowerCase()+' · '+o.h.toFixed(1)+' m';

/* Conexiones con el entorno: lo que este motor recibe. */
if(NV.entorno) NV.entorno.conectar('arbolado',{viento:['arbol.tronco','arbol.rama','arbol.hoja'],luz:true,sombra:true,contorno:true});

/* Alta en el registro. */
if(NV.motores) NV.motores.registrar({id:'arbolado',nombre:'Árboles diseñados: pinos, encinos, álamos y secos',estado:'integrado',
  archivo:'src/juego/arbolado.js',preview:'preview/arbolado.html',prueba:'pruebas/arbolado.js',
  caras:{generar:(o)=>generar(o.familia,o.tam,o.sem,o), dibujar:(ctx,A)=>pintar(A,ctx),
    objetos:{
      catalogo:()=>[{id:ID_ARBOL,nombre:'Árbol (diseñar)',etiqueta:'Árbol diseñado',k:'arbolnv',disenar:true,encaja:o=>o.k==='arbolnv'&&!!o.r}],
      crear:()=>aObjeto(Object.assign(clon(DISENO||ARBOL0),{sem:nuevaSem()})),
      variar:o=>aObjeto(Object.assign(clon(o.r),{sem:nuevaSem()}))
    },
    creador:{
      titulo:()=>'Diseñar un árbol',
      campos:()=>CAMPOS_ARBOL,
      nuevo:()=>Object.assign(clon(DISENO||ARBOL0),{sem:nuevaSem()}),
      variar:spec=>Object.assign(clon(spec),{sem:nuevaSem()}),
      aObjeto, deObjeto:o=>({id:ID_ARBOL,spec:clon(o.r)}), idDe:()=>ID_ARBOL,
      recordar:(id,spec)=>{ DISENO=clon(spec); },
      previa, resumen
    },
    editor:{familias:NOMBRES.reduce((a,f)=>{ a[f]={nombre:FAMILIAS[f].nombre,variantes:FAMILIAS[f].variantes}; return a; },{}),
            tamanos:TAMANOS, parametros:{variante:{tipo:'eleccion',opciones:[0,1,2],def:null}},
            conexiones:['viento: arbol.tronco, arbol.rama, arbol.hoja','luz y sombra proyectada','contorno compartido'],
            herramientas:['colocar','regenerar','eliminar','diseñar (ventana del Modo Dios)']}}});
})(window.NV);

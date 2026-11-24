/* Nativa Online — MOTOR DE AGUAS CONTINENTALES (en laboratorio: todavía NO está en el juego).
   Charcos, lagos, lagunas, arroyos, riachuelos, ríos, ríos profundos y cascadas. El mar queda FUERA: tendrá su propio motor.

   El agua no es una textura azul: cada cuerpo guarda un CAMPO (profundidad en metros, distancia a la orilla, corriente y
   coordenadas de cauce) y sobre ese campo se calcula, celda por celda y cuadro a cuadro, una SUPERFICIE con altura y pendiente:

     viento    ondas que viajan HACIA donde sopla el viento (de este a oeste) y que crecen y se apagan con inercia
     corriente el patrón de la superficie VIAJA con el flujo del cauce (dos fases cruzadas: no se estira con el tiempo)
     obstáculos las piedras dividen la corriente: proa, estela, remolino
     golpes    ondas circulares por contacto, lluvia y caída de cascadas (analíticas: sin simular una malla)
   y de la superficie salen el glifo, el color, la espuma y el reflejo:

     profundidad  color en cinco tramos + visibilidad del fondo = exp(-prof/claridad)·(1-opacidad)
     reflejos     lo que se dibuja (árbol, roca, montaña, personaje) se graba y se ESPEJA respecto de su base, que es lo que hace
                  una cámara oblicua (un metro de altura son 1,7 metros de suelo en filas), y se deforma con la pendiente de
                  la ola de esa celda; el cielo y las nubes se reflejan por rayo (la nube se muestrea corrida hacia el norte)
     luz          la del entorno compartido (NV.entorno.luz): color, cantidad, sol para el destello, sombras proyectadas

   CONEXIONES (este motor sólo LEE; no escribe en ninguno):
     viento   NV.entorno.viento('agua',x,y,t)   tipo 'agua' registrado acá (V.registrar): no hay un segundo viento
     luz      NV.entorno.luz() y NV.entorno.sombra.huella
     clima    A.usarClima(fn)  -> {lluvia,tormenta,niebla,nubes} de 0 a 1. NO existe un motor de clima en el proyecto: ésta es
              la interfaz que el agua necesita; el laboratorio la simula y el motor real, cuando exista, se conecta acá
     terreno  el cuerpo de agua ES su lecho (campo de profundidad); la orilla se pinta sobre el suelo que ya hay en el búfer
     rocas    `piedras:[{x,y,r,sum}]`: obstáculos (sum=false) y piedras de fondo (sum=true)

   Coordenadas: x al este, y al SUR, metros. La escena que se pinta es {G,C,cols,rows,CPM,RPM,HPM,x0,y0,t}: G y C son los
   búferes de glifo y color del tablero (los mismos fbG/fbC del juego), la celda (c,r) está en
   (x0+(c+.5)/CPM, y0+(r+.5)/RPM). Todo lo "estimado a ojo" lo dice su comentario; nada de acá está medido contra una referencia. */
(function(NV){
'use strict';
const TAU=6.283185307179586;
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const mix=(a,b,k)=>a+(b-a)*k;
const sm=u=>u<=0?0:u>=1?1:u*u*(3-2*u);

/* ------------------------------------------------------------------ azar y ruido ---- */
function h3(a,b,c){ let x=((a|0)*374761393+((b|0)*668265263)+((c|0)*2246822519))>>>0; x=((x^(x>>>13))*1274126177)>>>0; return ((x^(x>>>16))>>>0)&0x7fffffff; }
const r01=(a,b,c)=>(h3(a,b,c)%65536)/65536;
function ruido(s,x,y){
  const i=Math.floor(x), j=Math.floor(y), fx=x-i, fy=y-j, ux=fx*fx*(3-2*fx), uy=fy*fy*(3-2*fy);
  const a=r01(s,i,j), b=r01(s,i+1,j), c=r01(s,i,j+1), d=r01(s,i+1,j+1);
  return a+(b-a)*ux+((c-a)+(a-b-c+d)*ux)*uy;
}
const NS=4096, TS=new Float32Array(NS+1); for(let i=0;i<=NS;i++) TS[i]=Math.sin(i/NS*TAU);
function sen(x){ const u=x*(NS/TAU), i=Math.floor(u), f=u-i, k=i&(NS-1); return TS[k]+(TS[k+1]-TS[k])*f; }
const cos=x=>sen(x+1.5707963267948966);
/* seno y coseno de una vez (misma tabla): el resultado queda en _SN y _CS */
let _SN=0, _CS=0; const CUARTO=NS>>2;
function senCos(x){ const u=x*(NS/TAU), i=Math.floor(u), f=u-i, k=i&(NS-1), k2=(k+CUARTO)&(NS-1); _SN=TS[k]+(TS[k+1]-TS[k])*f; _CS=TS[k2]+(TS[k2+1]-TS[k2])*f; }
/* ruido con memoria de la última casilla de la rejilla: celdas vecinas caen casi siempre en la misma */
function ruidoMem(M,s,x,y){
  const i=Math.floor(x), j=Math.floor(y);
  if(M.i!==i||M.j!==j||M.s!==s){ M.i=i; M.j=j; M.s=s; M.a=r01(s,i,j); M.b=r01(s,i+1,j); M.c=r01(s,i,j+1); M.d=r01(s,i+1,j+1); }
  const fx=x-i, fy=y-j, ux=fx*fx*(3-2*fx), uy=fy*fy*(3-2*fy);
  return M.a+(M.b-M.a)*ux+((M.c-M.a)+(M.a-M.b-M.c+M.d)*ux)*uy;
}
const MEMR=[{},{},{},{},{},{}];

/* ------------------------------------------------------------------ tipos ----
   lam: largos de onda del viento en metros; amp: altura de la ola de viento a tope (m); ramp: glifos de menos a más cresta */
const TIPOS={
  charco:      {fondo:0.34, fondoInt:0.6, estancada:true, suave:0.75, entierro:0.04, pasto:0.6, lirios:0, orillaRocas:0.5, orillaDentro:0.2, musgoRocas:0.5, prof:0.12, claridad:0.35, opacidad:0.12, tono:0.30, ondas:1, viento:1, reflejo:1.00, irreg:1.0, humedad:0.55, talud:0.22, lam:[0.30,0.52,0.18], amp:0.010, ramp:[' ','.','-','~','-'], fondoVis:1},
  lago:        {fondo:0.30, fondoInt:0.95, estancada:true, suave:0.8, entierro:0.7, pasto:1.0, lirios:0.8, orillaRocas:1.0, orillaDentro:0.8, musgoRocas:0.6, prof:4.5,  claridad:2.4,  opacidad:0.30, tono:0.72, ondas:1, viento:1, reflejo:1.00, irreg:1.1, humedad:0.9,  talud:5.0,  lam:[2.8,1.2,0.55],    amp:0.030, ramp:['_','_','-','-','~'], fondoVis:1},
  laguna:      {fondo:0.33, fondoInt:0.9, estancada:true, suave:0.8, entierro:0.5, pasto:1.2, lirios:1.2, orillaRocas:0.9, orillaDentro:0.6, musgoRocas:0.7, prof:2.4,  claridad:1.6,  opacidad:0.25, tono:0.55, ondas:1, viento:1, reflejo:1.00, irreg:1.0, humedad:0.8,  talud:3.2,  lam:[2.0,0.9,0.45],    amp:0.024, ramp:['_','-','-','~','-'], fondoVis:1},
  arroyo:      {fondo:0.40, fondoInt:0.8, estancada:false,suave:0.85, sinuosidad:0.7, entierro:0.15, pasto:1.0, lirios:0, orillaRocas:1.2, orillaDentro:1.0, musgoRocas:0.5, prof:0.22, claridad:0.8,  opacidad:0.10, tono:0.40, ondas:1, viento:0.5, reflejo:0.55, irreg:0.7, humedad:0.45, vel:0.55, ancho:1.4, lam:[0.40,0.22,0.15], amp:0.008, ramp:['.','-','~','~','='], fondoVis:1},
  riachuelo:   {fondo:0.40, fondoInt:0.85, estancada:false,suave:0.85, sinuosidad:0.7, entierro:0.25, pasto:1.0, lirios:0, orillaRocas:1.2, orillaDentro:1.2, musgoRocas:0.5, prof:0.45, claridad:1.0,  opacidad:0.14, tono:0.46, ondas:1, viento:0.55,reflejo:0.60, irreg:0.7, humedad:0.55, vel:0.80, ancho:2.8, lam:[0.55,0.30,0.18], amp:0.011, ramp:['.','-','~','~','='], fondoVis:1},
  rio:         {fondo:0.38, fondoInt:0.9, estancada:false,suave:0.85, sinuosidad:0.6, entierro:0.55, pasto:0.8, lirios:0, orillaRocas:1.0, orillaDentro:1.0, musgoRocas:0.5, prof:1.6,  claridad:1.3,  opacidad:0.28, tono:0.62, ondas:1, viento:0.65,reflejo:0.75, irreg:0.8, humedad:0.8,  vel:1.00, ancho:7.0, lam:[1.3,0.7,0.35],    amp:0.017, ramp:['-','~','~','=','='], fondoVis:1},
  'rio-profundo':{fondo:0.24, fondoInt:1.0, estancada:false,suave:0.85, sinuosidad:0.5, entierro:0.9, pasto:0.6, lirios:0, orillaRocas:0.8, orillaDentro:0.5, musgoRocas:0.5, prof:5.5,claridad:0.7,  opacidad:0.55, tono:0.90, ondas:1, viento:0.75,reflejo:0.95, irreg:0.7, humedad:0.9,  vel:0.80, ancho:9.0, lam:[2.2,1.0,0.5],    amp:0.022, ramp:['_','_','=','=','~'], fondoVis:1}
};
const TIPOS_ID=Object.keys(TIPOS).concat(['cascada']);
const CASCADA0={tipo:'cascada',x:0,y:0,ancho:2.5,alto:4,intensidad:0.8,espuma:1,tono:0.2,sem:1,viento:0.3};
/* los tipos que se pueden meter al Modo Dios como lista (nombre legible) */
const NOMBRES={charco:'Charco',lago:'Lago',laguna:'Laguna',arroyo:'Arroyo',riachuelo:'Riachuelo',rio:'Río','rio-profundo':'Río profundo',cascada:'Cascada'};

/* ------------------------------------------------------------------ clima (interfaz de ENTRADA) ---- */
const CLIMA0=Object.freeze({lluvia:0,tormenta:0,niebla:0,nubes:0.35});
let climaProv=()=>CLIMA0;
const usarClima=fn=>{ climaProv=typeof fn==='function'?fn:(()=>CLIMA0); };
const clima=()=>Object.assign({},CLIMA0,climaProv()||{});

/* ------------------------------------------------------------------ datos: crear, validar, guardar ---- */
let _id=1;
function crear(tipo,spec){
  if(TIPOS_ID.indexOf(tipo)<0) throw new Error('tipo de agua desconocido: '+tipo);
  spec=spec||{};
  let c;
  if(tipo==='cascada') c=Object.assign({},CASCADA0,spec,{tipo});
  else {
    const T=TIPOS[tipo];
    c=Object.assign({sem:1,piedras:[],corriente:null},T,spec,{tipo});
    c.lam=(spec.lam||T.lam).slice();
    if(T.estancada){ c.poligono=(spec.poligono||[]).map(p=>[+p[0],+p[1]]); }
    else { c.curso=spec.curso?{puntos:spec.curso.puntos.map(p=>[+p[0],+p[1]]),anchos:spec.curso.anchos?spec.curso.anchos.slice():null}:{puntos:[],anchos:null}; }
    c.piedras=(spec.piedras||[]).map(p=>({x:+p.x,y:+p.y,r:+p.r,sum:!!p.sum}));
  }
  c.id=spec.id||(tipo+'-'+(_id++));
  c.v=1; c.golpes=[];
  validar(c);
  return c;
}
function validar(c){
  const num=v=>typeof v==='number'&&isFinite(v);
  if(!c||TIPOS_ID.indexOf(c.tipo)<0) throw new Error('agua: tipo inválido');
  if(typeof c.id!=='string'||!c.id) throw new Error('agua: sin id');
  if(c.tipo==='cascada'){ for(const k of ['x','y','ancho','alto','intensidad']) if(!num(c[k])) throw new Error('cascada '+c.id+': '+k+' inválido'); if(!(c.ancho>0)||!(c.alto>0)) throw new Error('cascada '+c.id+': sin tamaño'); return c; }
  for(const k of ['prof','claridad','opacidad','tono','ondas','viento','reflejo','irreg','humedad']) if(!num(c[k])) throw new Error('agua '+c.id+': '+k+' inválido');
  if(!(c.prof>0)) throw new Error('agua '+c.id+': profundidad inválida');
  for(const k of ['suave','sinuosidad','entierro','pasto','lirios','orillaRocas','orillaDentro','musgoRocas','fondo','fondoInt']) if(c[k]!==undefined&&!num(c[k])) throw new Error('agua '+c.id+': '+k+' inválido');
  if(TIPOS[c.tipo].estancada){
    if(!Array.isArray(c.poligono)||c.poligono.length<3) throw new Error('agua '+c.id+': el contorno necesita al menos tres puntos');
    for(const p of c.poligono) if(!num(p[0])||!num(p[1])) throw new Error('agua '+c.id+': punto inválido');
  } else {
    const q=c.curso; if(!q||!Array.isArray(q.puntos)||q.puntos.length<2) throw new Error('agua '+c.id+': el cauce necesita al menos dos puntos');
    for(const p of q.puntos) if(!num(p[0])||!num(p[1])) throw new Error('agua '+c.id+': punto inválido');
    if(q.anchos&&(!Array.isArray(q.anchos)||q.anchos.length!==q.puntos.length)) throw new Error('agua '+c.id+': anchos no coincide con los puntos');
    if(!num(c.vel)||c.vel<0) throw new Error('agua '+c.id+': velocidad inválida');
  }
  for(const p of (c.piedras||[])) if(!num(p.x)||!num(p.y)||!(p.r>0)) throw new Error('agua '+c.id+': piedra inválida');
  return c;
}
/* lo que se guarda: todo menos lo que se recalcula (campo, golpes en curso) */
function aDatos(c){ const o={}; for(const k of Object.keys(c)) if(k[0]!=='_'&&k!=='golpes'&&k!=='v') o[k]=JSON.parse(JSON.stringify(c[k])); return o; }
function deDatos(o){ const c=Object.assign({},JSON.parse(JSON.stringify(o))); c.v=1; c.golpes=[]; delete c._f; return validar(c); }
/* cualquier cambio de forma o de parámetros del campo avisa acá: el campo se rehace al próximo cuadro */
const tocar=c=>{ c.v=(c.v||0)+1; c._f=null; return c; };

/* ------------------------------------------------------------------ el campo del cuerpo ----
   Una rejilla de PPM muestras por metro: profundidad, distancia con signo a la orilla (+ adentro), corriente (m/s) y
   coordenadas de cauce (s: a lo largo, n: a lo ancho, a la izquierda del flujo). Se rehace sólo si la forma cambia. */
const PPM=4;
function segDist(px,py,ax,ay,bx,by){ const dx=bx-ax, dy=by-ay, l2=dx*dx+dy*dy; let t=l2>0?((px-ax)*dx+(py-ay)*dy)/l2:0; t=clamp(t,0,1); const qx=ax+dx*t-px, qy=ay+dy*t-py; return Math.sqrt(qx*qx+qy*qy); }
function enPoligono(px,py,P){ let dentro=false; for(let i=0,j=P.length-1;i<P.length;j=i++){ const xi=P[i][0], yi=P[i][1], xj=P[j][0], yj=P[j][1]; if(((yi>py)!==(yj>py))&&(px<(xj-xi)*(py-yi)/(yj-yi)+xi)) dentro=!dentro; } return dentro; }

function tangentes(Q){ const n=Q.length, T=[]; for(let i=0;i<n;i++){ const a=Q[Math.max(0,i-1)], b=Q[Math.min(n-1,i+1)]; let dx=b[0]-a[0], dy=b[1]-a[1]; const l=Math.hypot(dx,dy)||1; T.push([dx/l,dy/l]); } return T; }

/* ---- curvas: los puntos que se dan son de CONTROL; la forma real es una curva suave que pasa por ellos ----
   suave 0 = poligonal (firme, vectorial); 1 = curva completa (Catmull-Rom). Devuelve puntos [x,y] y, si hay, el valor w
   (ancho) interpolado en cada uno. Poco a poco: se subdivide cada tramo en pasos de ~0,5 m. */
function curvar(P,W,cerrado,k){
  const n=P.length; if(n<2) return {P:P.map(q=>[q[0],q[1]]),W:W?W.slice():null};
  const g=i=>cerrado?P[((i%n)+n)%n]:P[clamp(i,0,n-1)];
  const out=[], ow=W?[]:null, tramos=cerrado?n:n-1;
  for(let i=0;i<tramos;i++){
    const p0=g(i-1), p1=g(i), p2=g(i+1), p3=g(i+2), L=Math.hypot(p2[0]-p1[0],p2[1]-p1[1]), m=k<=0.01?1:clamp(Math.ceil(L/0.5),2,24);
    for(let j=0;j<m;j++){
      const u=j/m, u2=u*u, u3=u2*u;
      const cx=0.5*((2*p1[0])+(-p0[0]+p2[0])*u+(2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*u2+(-p0[0]+3*p1[0]-3*p2[0]+p3[0])*u3);
      const cy=0.5*((2*p1[1])+(-p0[1]+p2[1])*u+(2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*u2+(-p0[1]+3*p1[1]-3*p2[1]+p3[1])*u3);
      out.push([mix(p1[0]+(p2[0]-p1[0])*u,cx,k),mix(p1[1]+(p2[1]-p1[1])*u,cy,k)]);
      if(ow) ow.push(mix(W[i],W[Math.min(i+1,n-1)],u));
    }
  }
  if(!cerrado){ out.push([P[n-1][0],P[n-1][1]]); if(ow) ow.push(W[n-1]); }
  return {P:out,W:ow};
}
/* el recorrido de un río: curva + meandros. Los meandros desplazan cada punto de lado con un ruido lento a lo largo del cauce;
   la amplitud crece con el ancho y se apaga en los extremos para que el río empiece y termine donde se lo puso. */
function meandrar(Q,W,sinu,sem){
  const n=Q.length; if(n<3||sinu<=0.01) return Q;
  const arco=[0]; for(let i=1;i<n;i++) arco.push(arco[i-1]+Math.hypot(Q[i][0]-Q[i-1][0],Q[i][1]-Q[i-1][1]));
  const total=arco[n-1], T=tangentes(Q), out=[];
  for(let i=0;i<n;i++){
    const w=W?W[i]:2, lam=clamp(w*7,5,32), amp=sinu*(0.45*w+0.25);
    const ex=clamp(Math.min(arco[i],total-arco[i])/Math.max(2,w*2),0,1), e=ex*ex*(3-2*ex);
    const off=(ruido(sem+21,arco[i]/lam,0.5)-0.5)*2*amp*e+(ruido(sem+22,arco[i]/(lam*0.35),1.5)-0.5)*0.5*amp*e;
    out.push([Q[i][0]-T[i][1]*off,Q[i][1]+T[i][0]*off]);
  }
  return out;
}
/* ---- punto más cercano del cauce (con poda: casi todos los tramos se descartan por su caja) ---- */
function sobreCauce(c,F,px,py,o){
  const Q=F.P, A=F.anchos, Lc=F.arco, Tv=F.tang, N=Q.length-1, bx=F.segBox;
  let best=1e18, bi=F.ult||0, bt=0;
  const probar=i=>{
    const ax=Q[i][0], ay=Q[i][1], dx=Q[i+1][0]-ax, dy=Q[i+1][1]-ay, l2=dx*dx+dy*dy;
    let t=l2>0?((px-ax)*dx+(py-ay)*dy)/l2:0; t=t<0?0:t>1?1:t;
    const qx=ax+dx*t-px, qy=ay+dy*t-py, d2=qx*qx+qy*qy;
    if(d2<best){ best=d2; bi=i; bt=t; }
  };
  const i0=Math.max(0,Math.min(N-1,bi)); for(let i=Math.max(0,i0-6);i<=Math.min(N-1,i0+6);i++) probar(i);
  let r=Math.sqrt(best);
  for(let i=0;i<N;i++){
    const q=i*4; if(px<bx[q]-r||px>bx[q+2]+r||py<bx[q+1]-r||py>bx[q+3]+r) continue;
    probar(i); r=Math.sqrt(best);
  }
  F.ult=bi;
  const a=Q[bi], b=Q[bi+1], dx=b[0]-a[0], dy=b[1]-a[1], ls=Math.hypot(dx,dy)||1;
  let tx=mix(Tv[bi][0],Tv[bi+1][0],bt), ty=mix(Tv[bi][1],Tv[bi+1][1],bt); const tl=Math.hypot(tx,ty)||1; tx/=tl; ty/=tl;
  const qx=a[0]+dx*bt, qy=a[1]+dy*bt;
  const lado=(px-qx)*(-ty)+(py-qy)*tx;                 // a la izquierda del flujo (en un plano con y al sur, "izquierda" es +n)
  o.s=Lc[bi]+ls*bt; o.n=lado; o.tx=tx; o.ty=ty; o.w=mix(A[bi],A[bi+1],bt); o.dist=Math.sqrt(best);
  return o;
}
function prepararCampo(c){
  if(c._f&&c._fv===c.v) return c._f;
  const T=TIPOS[c.tipo], F={ppm:PPM}, sem=c.sem|0;
  const suave=clamp(c.suave==null?0:c.suave,0,1), irreg=clamp(c.irreg==null?1:c.irreg,0,3);
  /* la forma real: los puntos dados, curvados y (los cursos) con meandros */
  let pts, area=0, esc=0;
  if(T.estancada){
    pts=curvar(c.poligono,null,true,suave).P;
    for(let i=0,j=pts.length-1;i<pts.length;j=i++) area+=pts[j][0]*pts[i][1]-pts[i][0]*pts[j][1]; area=Math.abs(area)/2;
    esc=irreg*clamp(0.085*Math.sqrt(area),0.25,3.2);                // metros de lado a lado en la orilla
  } else {
    const An=(c.curso.anchos||c.curso.puntos.map(()=>c.ancho)).map(v=>Math.max(0.2,v));
    const cu=curvar(c.curso.puntos,An,false,suave);
    F.P=meandrar(cu.P,cu.W,clamp(c.sinuosidad==null?0:c.sinuosidad,0,3),sem); F.anchos=cu.W;
    pts=F.P; esc=irreg*0.32*Math.max(0.5,F.anchos.reduce((a,b)=>a+b,0)/F.anchos.length)*0.5;
  }
  /* caja de la forma + margen para la orilla húmeda y lo que se mueve la orilla */
  let x0=1e18,y0=1e18,x1=-1e18,y1=-1e18;
  for(const p of pts){ x0=Math.min(x0,p[0]); x1=Math.max(x1,p[0]); y0=Math.min(y0,p[1]); y1=Math.max(y1,p[1]); }
  const anchoMax=T.estancada?0:Math.max.apply(null,F.anchos)*0.9;
  const ent=Math.max(0,c.entierro||0), mg=(c.humedad||0.5)+1.2+anchoMax*0.5+esc*1.5+ent*1.7+0.5+(c.pasto>0?1.7:0);
  x0-=mg; y0-=mg; x1+=mg; y1+=mg;
  F.x0=x0; F.y0=y0; F.w=Math.ceil((x1-x0)*PPM)+1; F.h=Math.ceil((y1-y0)*PPM)+1;
  const n=F.w*F.h;
  F.prof=new Float32Array(n); F.d=new Float32Array(n).fill(-99); F.fx=new Float32Array(n); F.fy=new Float32Array(n); F.s=new Float32Array(n); F.n=new Float32Array(n);
  /* la orilla no es de regla: tres escalas de ruido (grande y sinuosa, media, fina). Mismas funciones para cursos y cuerpos quietos. */
  const lam1=T.estancada?clamp(0.45*Math.sqrt(area),2.5,18):clamp(esc*9+2,3,14);
  const bordeRuido=(px,py)=>((ruido(sem,px/lam1,py/lam1)-0.5)*2+(ruido(sem+1,px*3/lam1,py*3/lam1)-0.5)*0.8+(ruido(sem+2,px*9/lam1,py*9/lam1)-0.5)*0.35)*esc;
  if(T.estancada){
    const talud=Math.max(0.12,c.talud), lagunar=c.tipo==='laguna', nP=pts.length;
    for(let j=0;j<F.h;j++) for(let i=0;i<F.w;i++){
      const px=x0+i/PPM, py=y0+j/PPM;
      let dm=1e18; for(let k=0,l=nP-1;k<nP;l=k++){ const d=segDist(px,py,pts[l][0],pts[l][1],pts[k][0],pts[k][1]); if(d<dm) dm=d; }
      let d=(enPoligono(px,py,pts)?dm:-dm)+bordeRuido(px,py);
      const q=j*F.w+i; F.d[q]=d;
      if(d>0){
        const u=sm(d/talud);
        let pf=c.prof*Math.pow(u,0.9)*(0.84+0.32*ruido(sem+7,px*0.35,py*0.35));
        if(lagunar) pf*=0.45+1.1*ruido(sem+9,px*0.13,py*0.13);
        F.prof[q]=pf;
      }
    }
  } else {
    const Q=F.P, N=Q.length;
    F.arco=[0]; for(let i=1;i<N;i++) F.arco.push(F.arco[i-1]+Math.hypot(Q[i][0]-Q[i-1][0],Q[i][1]-Q[i-1][1]));
    F.tang=tangentes(Q);
    F.segBox=new Float32Array((N-1)*4); for(let i=0;i<N-1;i++){ F.segBox[i*4]=Math.min(Q[i][0],Q[i+1][0]); F.segBox[i*4+1]=Math.min(Q[i][1],Q[i+1][1]); F.segBox[i*4+2]=Math.max(Q[i][0],Q[i+1][0]); F.segBox[i*4+3]=Math.max(Q[i][1],Q[i+1][1]); }
    F.largo=F.arco[N-1]; F.anchoMedio=F.anchos.reduce((a,b)=>a+b,0)/N;
    const o={};
    for(let j=0;j<F.h;j++) for(let i=0;i<F.w;i++){
      const px=x0+i/PPM, py=y0+j/PPM; sobreCauce(c,F,px,py,o);
      /* anchura natural: estrechamientos y ensanchamientos a lo largo */
      const w=o.w*(0.82+0.36*ruido(sem+3,o.s*0.11,3.3)), half=w/2;
      let d=half-Math.abs(o.n)+bordeRuido(px,py)*Math.min(1.5,Math.max(0.35,half*0.5));
      const q=j*F.w+i; F.d[q]=d; F.s[q]=o.s; F.n[q]=o.n; F.fx[q]=o.tx; F.fy[q]=o.ty;
      if(d>-0.001){
        const u=clamp(o.n/half,-1,1);
        /* hondo al centro, poco hondo en las orillas; con pozas y bajíos a lo largo */
        let pf=c.prof*Math.pow(Math.max(0,1-u*u),0.7)*(0.68+0.64*ruido(sem+5,o.s*0.17,u*1.4));
        pf*=sm(d/Math.max(0.15,Math.min(half*0.6,0.9)));
        F.prof[q]=pf;
        /* más rápido al centro y donde se angosta */
        const v=c.vel*(0.30+0.70*(1-u*u))*Math.sqrt(F.anchoMedio/Math.max(0.3,w))*(0.86+0.28*ruido(sem+6,o.s*0.3,0.5));
        F.fx[q]*=v; F.fy[q]*=v;
      } else { F.fx[q]=0; F.fy[q]=0; }
    }
    /* las piedras: dónde caen sobre el cauce, para la estela */
    c._ps=(c.piedras||[]).map(p=>{ const t={}; sobreCauce(c,F,p.x,p.y,t); return {x:p.x,y:p.y,r:p.r,sum:!!p.sum,s:t.s,n:t.n}; });
  }
  F.area=area; F.caja={x0:x0+mg,y0:y0+mg,x1:x1-mg,y1:y1-mg};
  c._f=F; c._fv=c.v;
  if(T.estancada) c._ps=(c.piedras||[]).map(p=>({x:p.x,y:p.y,r:p.r,sum:!!p.sum,s:0,n:0}));
  return F;
}
/* interpola el campo en (x,y). out: {prof,d,fx,fy,s,n}. Devuelve false si cae fuera de la rejilla. */
function muestra(F,x,y,o){
  const u=(x-F.x0)*PPM, v=(y-F.y0)*PPM, i=Math.floor(u), j=Math.floor(v);
  if(i<0||j<0||i>=F.w-1||j>=F.h-1){ o.d=-99; o.prof=0; o.fx=0; o.fy=0; o.s=0; o.n=0; return false; }
  const fx=u-i, fy=v-j, q=j*F.w+i, w00=(1-fx)*(1-fy), w10=fx*(1-fy), w01=(1-fx)*fy, w11=fx*fy;
  o.d=F.d[q]*w00+F.d[q+1]*w10+F.d[q+F.w]*w01+F.d[q+F.w+1]*w11;
  o.prof=F.prof[q]*w00+F.prof[q+1]*w10+F.prof[q+F.w]*w01+F.prof[q+F.w+1]*w11;
  o.fx=F.fx[q]*w00+F.fx[q+1]*w10+F.fx[q+F.w]*w01+F.fx[q+F.w+1]*w11;
  o.fy=F.fy[q]*w00+F.fy[q+1]*w10+F.fy[q+F.w]*w01+F.fy[q+F.w+1]*w11;
  /* s y n sólo cambian de a poquito: el más cercano alcanza y no mezcla dos tramos de la curva */
  const qq=(v-j>0.5?j+1:j)*F.w+(u-i>0.5?i+1:i);
  o.s=F.s[qq]; o.n=F.n[qq];
  return true;
}
/* ¿(x,y) es agua? y a qué profundidad: lo usa quien necesite saber si el personaje pisa agua */
function enAgua(cuerpos,x,y){
  const o={};
  for(const c of cuerpos){
    if(c.tipo==='cascada') continue;
    const F=prepararCampo(c); if(!muestra(F,x,y,o)) continue;
    if(o.d>0&&o.prof>0.01) return {cuerpo:c,prof:o.prof,d:o.d,fx:o.fx,fy:o.fy};
  }
  return null;
}

/* ------------------------------------------------------------------ estado por cuadro de cada cuerpo ----
   El viento se consulta en algunos puntos a lo ancho del cuerpo (la ráfaga entra por el este y cruza el agua) y con
   memoria: el agua tarda en levantarse y en calmarse. Nada de esto guarda estado entre cuadros: se deduce del tiempo. */
const VIENTO_DIR=Object.freeze({x:-1,y:0});          // el viento global siempre va de este a oeste
function registrarViento(){ const V=NV.viento; if(V&&V.registrar&&V.tipos&&!V.tipos.agua) V.registrar('agua',{amp:1,lag:0.20,inercia:0.45,expo:0.85}); }
/* El viento se consulta en tres puntos a lo ancho del cuerpo (la ráfaga entra por el este y cruza el agua). El agua tarda en
   levantarse (~1,2 s) y en calmarse (~3,5 s): esa memoria es del agua, no del viento, y se lleva acá, por cuerpo. Sólo es
   estado de dibujo: se rehace sola si el cuadro salta (más de 1,5 s de diferencia). */
const TAU_SUBE=1.2, TAU_BAJA=3.5;
function intensidadViento(c,F,t){
  const E=NV.entorno, cx=F.caja, x0=cx.x0, x1=cx.x1, ys=(cx.y0+cx.y1)/2, K=3;
  if(!E||!E.viento) return {est:[0,0,0],x0:0,x1:1,dir:VIENTO_DIR};
  const W=c._w||(c._w={est:null,t:null});
  const dt=W.t==null?1e9:t-W.t;
  const cruda=[]; for(let k=0;k<K;k++){ const r=E.viento('agua',mix(x0,x1,k/(K-1)),ys,t); cruda.push(r&&r.I||0); }
  if(!W.est||dt>1.5||dt<-1e-9){ W.est=cruda.slice(); }
  else if(dt>0) for(let k=0;k<K;k++){ const tau=cruda[k]>W.est[k]?TAU_SUBE:TAU_BAJA; W.est[k]+=(cruda[k]-W.est[k])*(1-Math.exp(-dt/tau)); }
  W.t=t;
  return {est:W.est.slice(),x0,x1,dir:VIENTO_DIR};
}
const GRAV=9.8;
function actualizar(c,t,cuerpos){
  if(c.tipo==='cascada') return null;
  const F=prepararCampo(c), T=TIPOS[c.tipo], cl=clima();
  const W=intensidadViento(c,F,t), S={};
  S.W=W; S.cl=cl;
  S.dirA=Math.atan2(W.dir.y,W.dir.x);
  /* tormenta y lluvia levantan la superficie aunque no haya viento global fuerte */
  S.extra=0.55*cl.tormenta+0.20*cl.lluvia;
  S.ondas=[];
  const dirs=[0,0.5,-0.6], pes=[0.5,0.32,0.18];
  for(let i=0;i<3;i++){
    const lam=c.lam[i]*(1+0.35*Math.max(...W.est));
    const k=TAU/lam, w=Math.sqrt(GRAV*k), a=pes[i]*T.amp*c.ondas*c.viento;
    const ang=S.dirA+dirs[i]+(r01(c.sem|0,i,9)-0.5)*0.35;
    S.ondas.push({kx:k*Math.cos(ang),ky:k*Math.sin(ang),w:w*0.55,a,ph:r01(c.sem|0,i,3)*TAU,lam});
  }
  /* los golpes viejos se van */
  if(c.golpes.length){ const ya=c.golpes; c.golpes=ya.filter(g=>t-g.t0<g.dec*3.2&&t>=g.t0-0.001); }
  /* anillos de cascadas que caen en este cuerpo */
  S.anillos=c.golpes.slice();
  S.turb=[];
  if(cuerpos) for(const o of cuerpos){
    if(o.tipo!=='cascada') continue;
    const cj=F.caja, ix=o.x, iy=o.y;
    if(ix<cj.x0-1||ix>cj.x1+1||iy<cj.y0-1||iy>cj.y1+1) continue;
    const m={}; if(!muestra(F,ix,iy+0.4,m)||m.d<=0) continue;
    const I=o.intensidad, per=Math.max(0.12,0.42/Math.max(0.25,I)), amp=0.018*Math.sqrt(o.alto*I+0.5);
    const k=Math.floor(t/per);
    for(let j=k;j>=k-5;j--){
      const t0=j*per+r01(o.sem|0,j,5)*per*0.8;
      if(t0>t) continue;
      const jx=(r01(o.sem|0,j,6)-0.5)*o.ancho*0.9;
      S.anillos.push({x:ix+jx,y:iy+0.35,t0,amp:amp*(0.7+0.6*r01(o.sem|0,j,7)),vel:0.85,len:0.34,dec:1.1});
    }
    S.turb.push({x:ix,y:iy+0.3,r:0.9+0.16*o.alto*I,k:clamp(0.5+I*0.7,0,1.4)});
  }
  /* lluvia: gotas deterministas, repartidas en una rejilla de 1 m (sólo si llueve) */
  S.gotas=null;
  if(cl.lluvia>0.01){
    const cj=F.caja, gx0=Math.floor(cj.x0), gy0=Math.floor(cj.y0), gw=Math.ceil(cj.x1)-gx0+1, gh=Math.ceil(cj.y1)-gy0+1;
    const buck=new Array(gw*gh), tau=0.8, p=0.06+0.5*cl.lluvia;
    for(let j=0;j<gh;j++) for(let i=0;i<gw;i++){
      const cx=gx0+i, cy=gy0+j;
      const k0=Math.floor(t/tau);
      for(let k=k0;k>=k0-1;k--){
        if(r01(cx,cy,k*7+11)>=p) continue;
        const off=r01(cx,cy,k*7+12), age=t-(k+off)*tau; if(age<0||age>1.4) continue;
        (buck[j*gw+i]||(buck[j*gw+i]=[])).push({x:cx+r01(cx,cy,k*7+13),y:cy+r01(cx,cy,k*7+14),age});
      }
    }
    S.gotas={gx0,gy0,gw,gh,buck};
  }
  S.t=t;
  /* lo que no depende de la celda se calcula una vez por cuadro: fase del ciclo y el desfase de cada raya */
  const Tp=2.6; S.Tp=Tp; S.ph0=((t/Tp)%1+1)%1; S.sh=[[0,0,0],[0,0,0]];
  if(!T.estancada) for(let f=0;f<2;f++){ const q=(Math.floor(t/Tp+(f?0.5:0)))|0; for(let i=0;i<3;i++) S.sh[f][i]=r01(c.sem|0,i*13+f,q&1023)*TAU; }
  /* la potencia del viento se tabula: pow por celda era de lo más caro */
  S.aw=S.aw||AWT;
  return S;
}
const AWT=new Float32Array(1025); for(let i=0;i<=1024;i++) AWT[i]=Math.pow(i/512,0.85);   // 0 a 2

/* ------------------------------------------------------------------ la superficie ----
   h: altura en metros; sx, sy: pendiente (m/m, y al sur); turb: 0..1.4 de agitación local (espuma, rompe el reflejo) */
const _o={h:0,sx:0,sy:0,turb:0};
function ring(g,t,x,y,o){
  const dx=x-g.x, dy=y-g.y, rho=Math.sqrt(dx*dx+dy*dy), age=t-g.t0, front=g.vel*age, del=rho-front;
  if(del>g.len*1.1||del<-g.len*5) return;
  const env=Math.exp(-((del+0.6*g.len)*(del+0.6*g.len))/(1.4*g.len*g.len));
  const A=g.amp*Math.exp(-age/g.dec)/Math.sqrt(1+rho/0.35)*env, ph=TAU*del/g.len;
  senCos(ph); o.h+=A*_SN;
  const dd=A*TAU/g.len*_CS, inv=rho>1e-4?1/rho:0;
  o.sx+=dd*dx*inv; o.sy+=dd*dy*inv; o.turb+=Math.abs(A)*8;
}
function superficie(c,S,m,x,y,t,o){
  o.h=0; o.sx=0; o.sy=0; o.turb=0;
  const T=TIPOS[c.tipo], cl=S.cl;
  /* intensidad del viento aquí: se interpola entre las estaciones de este a oeste */
  const W=S.W, u=clamp((x-W.x0)/Math.max(1e-6,W.x1-W.x0),0,1), fk=u*(W.est.length-1), ik=Math.min(W.est.length-2,Math.floor(fk)), fr=fk-ik;
  let I=mix(W.est[ik],W.est[ik+1],fr);
  const xa=Math.max(0,I+S.extra), ia=Math.min(1023,xa*512|0), Aw=0.10+(xa>=2?Math.pow(xa,0.85):AWT[ia]+(AWT[ia+1]-AWT[ia])*(xa*512-ia));
  /* ondas de viento: viajan en la dirección del viento y se achican hacia la orilla (poco fondo, poco oleaje) */
  const prof=m.prof, orilla=sm(m.d/0.5)*sm(prof/(0.06+0.1*T.amp*20));
  for(let q=0;q<S.ondas.length;q++){
    const w=S.ondas[q], a=w.a*Aw*orilla;
    senCos(w.kx*x+w.ky*y-w.w*t+w.ph);
    o.h+=a*_SN; const d=a*_CS; o.sx+=d*w.kx; o.sy+=d*w.ky;
  }
  if(cl.tormenta>0.02){ /* chapoteo caótico encima, en tormenta */
    const a=0.012*cl.tormenta*orilla, p1=x*9.3+y*7.1-t*7.4, p2=x*-6.2+y*11.6-t*9.1;
    o.h+=a*(sen(p1)+sen(p2)); o.sx+=a*(9.3*cos(p1)-6.2*cos(p2)); o.sy+=a*(7.1*cos(p1)+11.6*cos(p2));
    o.turb+=cl.tormenta*0.5;
  }
  /* corriente: el patrón viaja con el flujo del cauce. Dos fases cruzadas: cada una vuelve a empezar cuando su peso es 0 */
  if(!T.estancada){
    const v=Math.hypot(m.fx,m.fy);
    if(v>0.01){
      const tx=m.fx/v, ty=m.fy/v, nx=-ty, ny=tx, Tp=S.Tp;
      const aF=T.amp*0.9*c.ondas*clamp(v/0.8,0.3,1.7)*(1.3-0.6*clamp(prof/Math.max(0.2,c.prof),0,1));
      const ph0=S.ph0;
      for(let f=0;f<2;f++){
        const p=(ph0+f*0.5)%1, wt=1-Math.abs(2*p-1), sOff=v*p*Tp, s=m.s-sOff, n=m.n;
        /* tres rayas alargadas a lo largo del flujo; cada vuelta de fase cambia el desfase para no repetir */
        for(let i=0;i<3;i++){
          const Ls=c.lam[i]*1.9, Ln=c.lam[i]*0.9, sh=S.sh[f][i];
          const warp=1.4*(ruidoMem(MEMR[f*3+i],c.sem|0,s/(Ls*2)+i*5,n/(Ln*2))-0.5);
          const phs=TAU*(s/Ls+n/Ln*0.35)+sh+warp, a=aF*wt*(i===0?0.5:i===1?0.32:0.18);
          senCos(phs); o.h+=a*_SN; const d=a*_CS, ds=TAU/Ls, dn=TAU/Ln*0.35;
          o.sx+=d*(ds*tx+dn*nx); o.sy+=d*(ds*ty+dn*ny);
        }
      }
      /* obstáculos: proa arriba, estela abajo con rayas que viajan, y más agitación */
      if(c._ps) for(const st of c._ps){
        if(st.sum) continue;
        const ds=m.s-st.s, dn=m.n-st.n, r=st.r;
        if(ds>-2.2*r&&ds<16*r){
          if(ds>=0){
            const wk=Math.exp(-ds/(5*r))*Math.exp(-(dn*dn)/((r*(1+0.3*ds/r))*(r*(1+0.3*ds/r))));
            if(wk>0.01){ const a=0.5*aF*3.2*wk, ph=TAU*((ds-v*t)/(1.7*r))+dn*2.0; o.h+=a*sen(ph); const d=a*cos(ph)*TAU/(1.7*r); o.sx+=d*tx; o.sy+=d*ty; o.turb+=wk*1.1; }
          } else {
            const pr=Math.exp(ds/(0.8*r))*Math.exp(-(dn*dn)/(1.4*r*r));
            if(pr>0.02){ o.h+=0.7*aF*3*pr; o.turb+=pr*0.55; }
          }
        }
      }
    }
  }
  /* golpes y anillos (contacto, cascadas) */
  for(let i=0;i<S.anillos.length;i++){ const g=S.anillos[i]; const dx=x-g.x, dy=y-g.y, R=g.vel*(t-g.t0)+g.len*1.3; if(dx>R||dx<-R||dy>R||dy<-R) continue; ring(g,t,x,y,o); }
  /* lluvia */
  if(S.gotas){
    const G=S.gotas, gi=Math.floor(x)-G.gx0, gj=Math.floor(y)-G.gy0;
    for(let j=gj-1;j<=gj+1;j++) for(let i=gi-1;i<=gi+1;i++){
      if(i<0||j<0||i>=G.gw||j>=G.gh) continue; const b=G.buck[j*G.gw+i]; if(!b) continue;
      for(const d of b){ ring({x:d.x,y:d.y,t0:t-d.age,amp:0.008*(0.6+cl.lluvia),vel:0.7,len:0.15,dec:0.4},t,x,y,o); }
    }
  }
  /* agitación local de cascadas */
  for(const z of S.turb){ const dx=x-z.x, dy=(y-z.y)*1.2, q=Math.exp(-(dx*dx+dy*dy)/(z.r*z.r)); if(q>0.01) o.turb+=z.k*q; }
  /* crestas muy empinadas con viento fuerte: espuma suelta */
  const cresta=(o.h-0.6*T.amp*c.ondas*c.viento)/(0.4*T.amp*c.ondas*c.viento+1e-6);
  if(I+S.extra>0.85&&cresta>0.2) o.turb+=0.5*clamp(cresta,0,1)*clamp(I+S.extra-0.8,0,1);
  return o;
}

/* ------------------------------------------------------------------ golpes: contacto del jugador y lo que venga ----
   Nunca hay ondas sobre tierra: golpe() sólo actúa si (x,y) es agua. */
function golpe(cuerpos,x,y,fuerza,t,opt){
  const a=enAgua(cuerpos,x,y); if(!a) return false;
  const f=clamp(fuerza==null?1:fuerza,0.05,3), o=opt||{};
  /* se escala por profundidad: el charco chapotea, el agua honda se traga el golpe */
  const k=0.55+0.45*clamp(a.prof/0.4,0,1);
  a.cuerpo.golpes.push({x,y,t0:t,amp:0.022*f*k,vel:o.vel||0.9,len:o.len||0.28,dec:o.dec||0.9});
  if(a.cuerpo.golpes.length>40) a.cuerpo.golpes.shift();
  return true;
}
/* un actor (el jugador) que se mueve: decide el golpe según la acción. `est` lo conserva quien llama. */
function actor(est,cuerpos,x,y,t,vel){
  est=est||{enAgua:false,ult:-9,x:x,y:y,quieto:0};
  const a=enAgua(cuerpos,x,y), moved=Math.hypot(x-est.x,y-est.y), v=vel==null?(moved/Math.max(1e-3,t-(est.t||t-0.016))):vel;
  let accion='fuera';
  if(a&&!est.enAgua){ accion='entrar'; golpe(cuerpos,x,y,1.9,t,{len:0.34,dec:1.3}); golpe(cuerpos,x,y,1.0,t+0.0001,{vel:1.3,len:0.5,dec:1.1}); est.ult=t; }
  else if(!a&&est.enAgua){ accion='salir'; golpe(cuerpos,est.x,est.y,1.1,t,{len:0.3,dec:1.0}); est.ult=t; }
  else if(a){
    const corre=v>2.4, camina=v>0.25, cada=corre?0.17:camina?0.34:2.4;
    if(t-est.ult>=cada){ golpe(cuerpos,x,y,corre?1.5:camina?0.8:0.18,t,corre?{vel:1.1,len:0.3}:undefined); est.ult=t; }
    accion=corre?'correr':camina?'caminar':'quieto';
  }
  est.enAgua=!!a; est.x=x; est.y=y; est.t=t; est.accion=accion; est.prof=a?a.prof:0;
  return est;
}

/* ------------------------------------------------------------------ color, lecho y cielo ---- */
const PAL=[[0,[140,196,178]],[0.12,[112,184,192]],[0.5,[84,156,200]],[1.3,[62,122,182]],[2.8,[42,88,150]],[5,[28,58,112]],[9,[16,34,76]]];
function colorProf(p,tono,out){
  let i=0; while(i<PAL.length-2&&p>PAL[i+1][0]) i++;
  const a=PAL[i], b=PAL[i+1], k=clamp((p-a[0])/(b[0]-a[0]),0,1);
  let r=mix(a[1][0],b[1][0],k), g=mix(a[1][1],b[1][1],k), bl=mix(a[1][2],b[1][2],k);
  const v=1-tono;                                   // tono 0 = verdoso, 1 = azul puro
  out[0]=r*(1-0.16*v); out[1]=g*(1+0.10*v); out[2]=bl*(1-0.22*v);
}
/* el lecho: arena, grava y piedras, en el mundo (no en la pantalla). Devuelve color y glifo. */
const _lec={r:0,g:0,b:0,code:46,piedra:0};
function lecho(c,x,y,o){
  const sem=(c.sem|0)+101, gx=Math.floor(x*2.2), gy=Math.floor(y*2.2), n=ruido(sem,x*0.9,y*0.9), hh=r01(gx,gy,sem);
  let r=176+30*n-14, g=160+26*n-12, b=118+22*n-10, code=46, pie=0;
  if(hh<0.20){ const q=0.55+0.45*r01(gx,gy,sem+1); r=104*q+14; g=98*q+13; b=88*q+12; code=hh<0.07?79:111; pie=1; }       // piedra: O o
  else if(hh<0.55){ code=hh<0.38?58:44; }                                                                            // grava: : ,
  else code=46;
  /* piedras sumergidas del cuerpo */
  if(c._ps) for(const st of c._ps){ if(!st.sum) continue; const dx=x-st.x, dy=y-st.y; if(dx*dx+dy*dy<st.r*st.r){ r=88; g=84; b=78; code=79; pie=1; break; } }
  o.r=r; o.g=g; o.b=b; o.code=code; o.piedra=pie;
  return o;
}
/* el cielo que se refleja: el rayo sube hacia el norte, así que la nube se toma corrida hacia el norte (no pegada encima) */
const _cie=[0,0,0];
function cielo(x,y,t,luz,cl,out){
  const lr=luz.r, lg=luz.g, lb=luz.b, amb=luz.amb;
  const dia=clamp((amb-0.30)/0.55,0,1);
  const sr=mix(10,132,dia), sg=mix(16,178,dia), sb=mix(34,226,dia);
  /* nubes: dos octavas, derivan con el viento (hacia el oeste) */
  const nx=x*0.045+t*0.012, ny=(y-509)*0.045;
  const nb=0.62*ruido(901,nx,ny)+0.38*ruido(902,nx*2.3+7,ny*2.3);
  const cob=sm((nb-(1-cl.nubes)+0.16)/0.32);
  const gris=1-0.5*cl.tormenta;
  const cr=mix(sr,230*gris,cob*0.85), cg=mix(sg,232*gris,cob*0.85), cb=mix(sb,238*gris,cob*0.85);
  out[0]=cr*(0.25+0.8*lr/Math.max(amb,0.05)*amb); out[1]=cg*(0.25+0.8*lg/Math.max(amb,0.05)*amb); out[2]=cb*(0.25+0.8*lb/Math.max(amb,0.05)*amb);
  return cob;
}
const VISTA={x:0,y:0.862,z:0.508};                   // de la superficie hacia la cámara: 30,5° de elevación (HPM/RPM = 1,7)

/* ------------------------------------------------------------------ pintar ---- */
let skyT=null, skyCob=null, skyR=null, skyG=null, skyB=null;     // el cielo reflejado, por bloques de 4×2 celdas (cambia muy despacio)
const scr={n:0,body:null,H:null,SX:null,SY:null,TU:null,PR:null,D:null,RG:null,RC:null,RA:null};
function asegurar(n){
  if(scr.n>=n) return;
  scr.n=n; scr.body=new Uint8Array(n); scr.H=new Float32Array(n); scr.SX=new Float32Array(n); scr.SY=new Float32Array(n); scr.TU=new Float32Array(n);
  scr.PR=new Float32Array(n); scr.D=new Float32Array(n); scr.RG=new Uint16Array(n); scr.RC=new Int32Array(n); scr.RA=new Float32Array(n); scr.FX=new Float32Array(n); scr.FY=new Float32Array(n); scr.WL=new Float32Array(n); scr.VG=new Uint8Array(n); scr.WL=new Float32Array(n);
}
const pack=(r,g,b)=>((r<0?0:r>255?255:r|0)<<16)|((g<0?0:g>255?255:g|0)<<8)|(b<0?0:b>255?255:b|0);
function esc(c){ return c; }
/* escena: {G,C,cols,rows,CPM,RPM,HPM,x0,y0,t, reflejables:{n,B:Int32Array(n*5: c,r,glifo,color,filaBase)}, sombras:[{c0,r0,w,h,k}], opciones} */
/* el color de fondo del agua. Es azul: de azul marino (c.fondo=0) a azul claro (c.fondo=1), más verdoso o más azul según el tono, más o menos
   saturado según c.fondoInt, y más oscuro cuanto más hondo. De lo que el agua refleja y de la luz sólo toma una parte: el fondo no es el cielo. */
const _bg=[0,0,0];
function colorFondo(c,R,G,B,prof){
  const T=TIPOS[c.tipo], f=c.fondo==null?T.fondo:c.fondo, it=c.fondoInt==null?T.fondoInt:c.fondoInt, t=clamp(c.tono,0,1);
  const V=255*(0.10+0.75*f)*(0.55+0.45*Math.exp(-prof/(c.claridad*1.5+1)));
  let r=mix(0.14,0.20,t), g=mix(0.52,0.40,t), b=mix(0.52,0.80,t);
  const gr=(r+g+b)/3, sa=0.5+0.7*it; r=gr+(r-gr)*sa; g=gr+(g-gr)*sa; b=gr+(b-gr)*sa;
  const l=(R+G+B)/3, mod=0.75+0.5*clamp(l/70,0,1.3);
  _bg[0]=clamp(mix(r*V*mod,R*(0.2+0.8*f),0.28),0,255); _bg[1]=clamp(mix(g*V*mod,G*(0.2+0.8*f),0.28),0,255); _bg[2]=clamp(mix(b*V*mod,B*(0.2+0.8*f),0.28),0,255);
  return _bg;
}
function pintar(sc,cuerpos){
  const {G,C,cols,rows,CPM,RPM,HPM,x0,y0,t}=sc, n=cols*rows;
  asegurar(n);
  const luz=(NV.entorno&&NV.entorno.luz)?NV.entorno.luz(0,0,t):{amb:1,r:1,g:1,b:1,L:{x:-0.8,y:-0.2,z:0.55}};
  const cl=clima(), L=luz.L||{x:-0.8,y:-0.2,z:0.55};
  const body=scr.body, H=scr.H, SX=scr.SX, SY=scr.SY, TU=scr.TU, PR=scr.PR, D=scr.D;
  body.fill(0); D.fill(-99); scr.WL.fill(-1); scr.VG.fill(0);
  const op=sc.opciones||{}, gR=op.reflejo==null?1:op.reflejo, gDef=op.deformacion==null?1:op.deformacion;
  const mascara=sc.mascara||null;
  /* si quien dibuja sabe poner el color de FONDO de una celda (sc.fondo(col,fila,color)), el agua es un fondo azul y los glifos quedan para lo que
     de verdad se ve: crestas de ola, destellos, espuma, reflejos, piedras del fondo. Sin eso, se pinta como antes (todo con glifos). */
  const conFondo=typeof sc.fondo==='function', mk=[];                      // celdas que ya tienen un objeto o un personaje: no se tocan
  const lista=cuerpos.filter(c=>c.tipo!=='cascada');
  /* sólo los cuerpos que tocan lo que se ve: si ninguno, no se gasta nada */
  const vx0=x0-1, vx1=x0+cols/CPM+1, vy0=y0-1, vy1=y0+rows/RPM+1, vis=[];
  for(const c of lista){ const F=prepararCampo(c); if(F.x0+F.w/PPM<vx0||F.x0>vx1||F.y0+F.h/PPM<vy0||F.y0>vy1) continue; vis.push(c); }
  if(!vis.length){ pintar.ult=0; return 0; }
  lista.length=0; for(const c of vis) lista.push(c);
  const estados=lista.map(c=>actualizar(c,t,cuerpos));
  const m={};
  let bc0=cols, bc1=-1, br0=rows, br1=-1;
  /* ---- pasada 1: superficie de cada celda de agua y la banda húmeda de la orilla ---- */
  for(let bi=0;bi<lista.length;bi++){
    const c=lista[bi], F=c._f, S=estados[bi], T=TIPOS[c.tipo];
    const cx0=Math.max(0,Math.floor((F.x0-x0)*CPM)), cx1=Math.min(cols-1,Math.ceil((F.x0+F.w/PPM-x0)*CPM));
    const cy0=Math.max(0,Math.floor((F.y0-y0)*RPM)), cy1=Math.min(rows-1,Math.ceil((F.y0+F.h/PPM-y0)*RPM));
    const hum=c.humedad;
    for(let r=cy0;r<=cy1;r++){
      const wy=y0+(r+0.5)/RPM;
      for(let cc=cx0;cc<=cx1;cc++){
        const wx=x0+(cc+0.5)/CPM;
        if(!muestra(F,wx,wy,m)) continue;
        const i=r*cols+cc;
        if(mascara&&mascara[i]){ if(conFondo&&m.d>0&&m.prof>0.004) mk.push(i,bi); continue; }
        if(m.d>0&&m.prof>0.004){
          superficie(c,S,m,wx,wy,t,_o);
          body[i]=bi+1; H[i]=_o.h; SX[i]=_o.sx; SY[i]=_o.sy; TU[i]=_o.turb; PR[i]=m.prof; D[i]=m.d; scr.FX[i]=m.fx; scr.FY[i]=m.fy;
          if(cc<bc0) bc0=cc; if(cc>bc1) bc1=cc; if(r<br0) br0=r; if(r>br1) br1=r;
          /* la barranca: el agua está hundida en el terreno. Desde la cámara (al sur, mirando al norte) se ve la pared de la orilla
             NORTE bajando hasta el agua: ocupa, hacia el sur, entierro·HPM filas desde el borde. Se sabe que la orilla está al
             norte porque la distancia a la orilla crece hacia el sur (ny>0). */
          if(c.entierro>0.02&&m.d<c.entierro*HPM/RPM+0.5){
            const gi=((wx-F.x0)*PPM)|0, gj=((wy-F.y0)*PPM)|0;
            if(gi>0&&gj>0&&gi<F.w-1&&gj<F.h-1){
              const q=gj*F.w+gi, gx=F.d[q+1]-F.d[q-1], gy=F.d[q+F.w]-F.d[q-F.w], gl=Math.sqrt(gx*gx+gy*gy)||1, ny=gy/gl;
              if(ny>0.2){ const alto=c.entierro*HPM/RPM, u=m.d/(ny*alto); if(u>=0&&u<1) scr.WL[i]=u; }
            }
          }
        } else if(m.d>-hum-(c.pasto>0?1.6:0)&&body[i]===0){
          D[i]=m.d;                      // tierra mojada (y, más allá, la franja de plantas de la orilla)
          if(cc<bc0) bc0=cc; if(cc>bc1) bc1=cc; if(r<br0) br0=r; if(r>br1) br1=r;
          if(c.pasto>0&&m.d<-0.05) scr.VG[i]=plantaDe(c,wx,wy,-m.d,hum);
        }
      }
    }
  }
  /* ---- pasada 2: reflejos de lo grabado, espejados respecto de su base ---- */
  const RG=scr.RG, RC=scr.RC, RA=scr.RA; RG.fill(0); RA.fill(0);
  const rf=sc.reflejables;
  if(rf&&rf.n&&gR>0){
    const B=rf.B;
    for(let q=0;q<rf.n;q++){
      const c0=B[q*5], r0=B[q*5+1], code=B[q*5+2], col=B[q*5+3], br=B[q*5+4];
      const hrow=br-r0; if(hrow<0) continue;                        // sólo lo que está por encima de la base
      let r2=br+1+hrow, c2=c0;
      if(r2<0||r2>=rows||c2<0||c2>=cols) continue;
      let i2=r2*cols+c2; if(!body[i2]) continue;                    // sólo cae sobre agua
      /* la pendiente de la ola desvía el rayo: más cuanto más alto el punto; las olas grandes lo parten */
      const z=hrow/HPM, dc=Math.round(-SX[i2]*z*2.4*gDef*CPM*0.5), dr=Math.round(SY[i2]*z*1.6*gDef*RPM*0.25);
      c2+=dc; r2+=dr;
      if(r2<0||r2>=rows||c2<0||c2>=cols) continue;
      i2=r2*cols+c2; if(!body[i2]) continue;
      const cu=lista[body[i2]-1], tur=TU[i2];
      /* cuánto refleja: el agua honda y oscura, mucho; la agitada y la poco profunda, menos */
      let R=cu.reflejo*gR*(0.34+0.30*clamp(PR[i2]/Math.max(0.3,cu.claridad*0.6),0,1));
      R*=1/(1+2.6*tur)*(1-0.55*cl.tormenta)*(1-0.75*cl.niebla);
      const fade=1-0.62*clamp(hrow/(HPM*3.5),0,1);
      R*=fade; if(R<0.045) continue;
      if(R>RA[i2]){ RA[i2]=R; RG[i2]=code; RC[i2]=col; }
    }
  }
  /* ---- pasada 3: color y glifo de cada celda ---- */
  const dc=[0,0,0], bed=_lec, cs=[0,0,0];
  const sombras=sc.sombras||null;
  if(bc1<bc0){ pintar.ult=0; return 0; }
  const nb=(cols>>2)+2; if(!skyT||skyT.length<nb){ skyT=new Int32Array(nb); skyCob=new Float32Array(nb); skyR=new Float32Array(nb); skyG=new Float32Array(nb); skyB=new Float32Array(nb); }
  skyT.fill(0);
  let pintadas=0; const bgS=lista.map(()=>[0,0,0,0]);
  for(let r=br0;r<=br1;r++){
    const wy=y0+(r+0.5)/RPM;
    for(let cc=bc0;cc<=bc1;cc++){
      const i=r*cols+cc, bi=body[i];
      if(!bi){
        /* tierra junto al agua: oscurecida por la humedad y con piedritas */
        const d=D[i]; if(d>-90&&G[i]){ orillaTierra(sc,i,cc,r,d); if(scr.VG[i]) pintarPlanta(sc,i,cc,r,scr.VG[i],d,luz,sombras); }
        continue;
      }
      const c=lista[bi-1], T=TIPOS[c.tipo], wx=x0+(cc+0.5)/CPM;
      const wl=scr.WL[i];
      if(wl>=0){
        /* pared de tierra: clara arriba (al nivel del suelo), oscura y mojada donde toca el agua */
        const hq=h3((wx*7)|0,(wy*7)|0,23)%100, v0=C[i], k=1-0.62*wl*(0.7+0.3*wl);
        let R1=(112+((v0>>16)&255)*0.18)*k, G1=(88+((v0>>8)&255)*0.20)*k, B1=(64+(v0&255)*0.16)*k;
        if(wl>0.72){ const w2=(wl-0.72)/0.28; R1=mix(R1,30,w2*0.5); G1=mix(G1,48,w2*0.5); B1=mix(B1,62,w2*0.55); }
        let code=wl<0.14?(hq<50?39:44):wl<0.55?(hq<45?124:hq<75?58:33):(hq<50?58:hq<80?108:46);
        if(wl<0.1&&hq<30){ R1=mix(R1,((v0>>16)&255),0.6); G1=mix(G1,((v0>>8)&255),0.6); B1=mix(B1,(v0&255),0.6); }
        let fr=luz.r, fg=luz.g, fb=luz.b;
        if(sombras) for(const sh of sombras){ const sc2=cc-sh.c0, sr=r-sh.r0; if(sc2>=0&&sr>=0&&sc2<sh.w&&sr<sh.h){ const kk=sh.k[sr*sh.w+sc2]; if(kk>0){ const f=1-0.5*kk; fr*=f; fg*=f; fb*=f; } } }
        G[i]=code; C[i]=pack(R1*fr,G1*fg,B1*fb); pintadas++; continue;
      }
      const prof=PR[i], sx=SX[i], sy=SY[i], tu=TU[i], h=H[i];
      /* color por profundidad y fondo visible (con refracción: se mira un poco corrido por la pendiente) */
      colorProf(prof,c.tono,dc);
      let R0=dc[0], G0=dc[1], B0=dc[2];
      const vis=Math.exp(-prof/Math.max(0.05,c.claridad))*(1-c.opacidad)*(1-0.6*clamp(tu,0,1));
      let glifoFondo=0;
      if(vis>0.04){
        lecho(c,wx+sx*prof*0.6,wy+sy*prof*0.6,bed);
        const att=0.55+0.45*vis, k=clamp(vis*1.15,0,0.9);
        R0=mix(R0,bed.r*att*0.78,k); G0=mix(G0,bed.g*att*0.82,k); B0=mix(B0,bed.b*att*0.9,k);
        if(vis>0.36&&(bed.piedra||bed.code!==46)) glifoFondo=bed.code;
      }
      /* luz: color y cantidad del entorno compartido; sombras proyectadas (árboles, rocas) */
      let lr=luz.r, lg=luz.g, lb=luz.b;
      if(sombras) for(const sh of sombras){ const sc2=cc-sh.c0, sr=r-sh.r0; if(sc2>=0&&sr>=0&&sc2<sh.w&&sr<sh.h){ const k=sh.k[sr*sh.w+sc2]; if(k>0){ const f=1-0.5*k; lr*=f; lg*=f; lb*=f; } } }
      /* normal, destello del sol y cuánto refleja el cielo */
      const nl=Math.sqrt(sx*sx+sy*sy+1), nx=-sx/nl, ny=-sy/nl, nz=1/nl;
      const nv=nx*VISTA.x+ny*VISTA.y+nz*VISTA.z;
      const rx=2*nv*nx-VISTA.x, ry=2*nv*ny-VISTA.y, rz=2*nv*nz-VISTA.z;
      const sp=Math.max(0,rx*L.x+ry*L.y+rz*L.z), sp2=sp*sp, sp4=sp2*sp2, sp8=sp4*sp4, sp16=sp8*sp8, sp32=sp16*sp16, spec=sp32*sp16*clamp(luz.amb,0,1.2)*(1-0.7*cl.niebla)*(1-0.6*cl.tormenta);
      const f1=1-clamp(nv,0,1), fres=f1*f1*f1;
      const calma=1/(1+3*tu);
      /* cielo reflejado */
      const blk=cc>>2, stm=(r>>1)+1;
      if(skyT[blk]!==stm){ skyT[blk]=stm; skyCob[blk]=cielo(wx,wy,t,luz,cl,cs); skyR[blk]=cs[0]; skyG[blk]=cs[1]; skyB[blk]=cs[2]; }
      cs[0]=skyR[blk]; cs[1]=skyG[blk]; cs[2]=skyB[blk];
      const Rs=c.reflejo*gR*(0.10+0.34*fres+0.14*clamp(prof/Math.max(0.3,c.claridad),0,1))*calma*(1-0.7*cl.niebla);
      R0=mix(R0,cs[0],Rs); G0=mix(G0,cs[1],Rs); B0=mix(B0,cs[2],Rs);
      R0*=lr; G0*=lg; B0*=lb;
      /* la ola aclara la cresta y oscurece el valle */
      const alt=clamp(h/(T.amp*c.ondas+1e-6)*0.5,-1,1), lum=0.84+0.20*alt+0.4*clamp(Math.abs(sx)+Math.abs(sy),0,0.8)*0.3;
      R0*=lum; G0*=lum; B0*=lum;
      let bR=R0, bG=G0, bB=B0;                  // lo que es el agua misma, antes de mezclarle un reflejo
      /* objeto reflejado: se mezcla en color y, si es fuerte, aporta el glifo */
      let code, ra=RA[i];
      if(ra>0){
        const rc=RC[i], ar=((rc>>16)&255), ag=((rc>>8)&255), ab=(rc&255), ta=0.78;
        const k=clamp(ra*1.5,0,0.8);
        R0=mix(R0,mix(ar,dc[0],0.45)*lr*ta,k); G0=mix(G0,mix(ag,dc[1],0.45)*lg*ta,k); B0=mix(B0,mix(ab,dc[2],0.45)*lb*ta,k);
      }
      /* glifo de la superficie */
      const sub=clamp(alt*0.5+0.5+clamp(spec,0,0.2),0,1), RP=T.ramp;
      const hh=h3((wx*9)|0,(wy*9)|0,5)%100;
      code=RP[Math.min(RP.length-1,(sub*RP.length)|0)].charCodeAt(0);
      if(conFondo){
        /* con fondo propio, la superficie sólo lleva glifo donde hay ola de verdad: cresta (clara) o valle (oscuro) */
        const aa=Math.abs(alt), prob=clamp((aa-0.26)*170*c.ondas,0,94);
        if(hh>=prob) code=32;
        else if(!(ra>0.12)) { const cr=alt>0?1.30+0.9*alt:0.78+0.25*alt; R0=bR*cr+10; G0=bG*cr+13; B0=bB*cr+18; }
      }
      /* agua quieta y honda: rala, con rayitas sueltas y mucho vacío */
      if(tu<0.12&&prof>0.8&&hh<44) code=32;
      if(glifoFondo&&hh<80) code=glifoFondo;
      if(ra>0.12&&RG[i]>32) code=RG[i];
      /* destello del sol */
      if(spec>0.22&&hh<70){ code=spec>0.55?42:58; const g2=1.2+0.9*spec; R0=mix(R0,255*lr,clamp(spec*1.2,0,0.85)); G0=mix(G0,246*lg,clamp(spec*1.2,0,0.85)); B0=mix(B0,214*lb,clamp(spec*1.2,0,0.85)); }
      /* espuma: donde hay agitación; en el charco, nunca */
      const espu=clamp(tu-0.55,0,1)*(c.tipo==='charco'?0.3:1);
      if(espu>0.04&&hh<espu*100+8){ code=hh%3?42:35; const f=0.75+0.5*espu; R0=mix(R0,214*lr,f*0.7); G0=mix(G0,226*lg,f*0.7); B0=mix(B0,232*lb,f*0.7); }
      /* niebla: el agua se funde con la atmósfera */
      if(cl.niebla>0.01){ const f=cl.niebla*0.55, fr=170*luz.amb, fg=178*luz.amb, fb=186*luz.amb; R0=mix(R0,fr,f); G0=mix(G0,fg,f); B0=mix(B0,fb,f); bR=mix(bR,fr,f); bG=mix(bG,fg,f); bB=mix(bB,fb,f); }
      if(c.lirios>0&&T.estancada&&prof<2.2&&tu<0.45&&D[i]>0.9&&ra<=0.3){
        const lp=hojaLirio(c,wx,wy,D[i]);
        if(lp){ const gl=lp>1?42:(alt>0.15?79:111); code=lp>1?42:gl; const sh=0.8+0.3*clamp(alt,-1,1);
          if(lp>1){ R0=mix(R0,244*lr,0.9); G0=mix(G0,222*lg,0.9); B0=mix(B0,232*lb,0.9); }
          else { R0=mix(R0,58*lr*sh,0.82); G0=mix(G0,112*lg*sh,0.82); B0=mix(B0,52*lb*sh,0.82); } }
      }
      if(conFondo){
        const bgc=colorFondo(c,bR,bG,bB,prof), q=bgS[bi-1]; q[0]+=bgc[0]; q[1]+=bgc[1]; q[2]+=bgc[2]; q[3]++;
        sc.fondo(cc,r,pack(bgc[0],bgc[1],bgc[2]));
        /* el glifo no puede ser más oscuro que su propio fondo: si lo fuera, no se vería */
        if(code!==32){ const lg=(R0+G0+B0)/3, lb=(bgc[0]+bgc[1]+bgc[2])/3; if(lg<lb*1.12){ const k=(lb*1.12+6)/Math.max(1,lg); R0*=k; G0*=k; B0*=k; } }
      }
      G[i]=code; C[i]=pack(R0,G0,B0); pintadas++;
    }
  }
  /* las celdas de agua tapadas por un objeto (una roca en el lago): el mismo fondo, con el promedio de lo pintado del cuerpo */
  if(conFondo) for(let k=0;k<mk.length;k+=2){ const i=mk[k], q=bgS[mk[k+1]];
    const cc=i%cols, r=(i/cols)|0; let R,Gc,B;
    if(q[3]>0){ R=q[0]/q[3]; Gc=q[1]/q[3]; B=q[2]/q[3]; } else { const c=lista[mk[k+1]]; colorProf(0.5,c.tono,dc); const f=colorFondo(c,dc[0]*luz.r,dc[1]*luz.g,dc[2]*luz.b,0.5); R=f[0]; Gc=f[1]; B=f[2]; }
    sc.fondo(cc,r,pack(R,Gc,B)); }
  pintar.ult=pintadas; return pintadas;
}
/* ---- plantas de la orilla: pastos y juncos en la tierra, hojas de lirio sobre el agua ----
   Salen de un ruido por metro (crecen en matas, no parejo) y de un hash por celda; el cuerpo da la densidad (`pasto`, `lirios`). */
function plantaDe(c,wx,wy,dn,hum){
  const sem=c.sem|0, band=hum+1.6;
  const mata=ruido(sem+41,wx*0.8,wy*0.8);                              // dónde hay mata
  const p=c.pasto*0.30*clamp(1.15-dn/band,0,1)*clamp((mata-0.32)*2.6,0,1.2);
  const hq=(h3((wx*7)|0,(wy*7)|0,33)%1000)/1000;
  if(hq>=p) return 0;
  const alto=ruido(sem+42,wx*0.55+9,wy*0.55)>0.58&&dn<hum+0.5&&c.tipo!=='charco';     // juncos: más altos, pegados al agua
  return alto?2:1;
}
/* una hoja de lirio en esta celda de agua: 0 nada, 1 hoja, 2 hoja con flor */
function hojaLirio(c,wx,wy,d){
  const sem=c.sem|0, n=ruido(sem+51,wx*0.45,wy*0.45), grupo=clamp((n-(0.62-0.10*c.lirios))*4.5,0,1)*clamp((d-0.8)/1.5,0,1);
  if(grupo<=0) return 0;
  const hq=(h3((wx*5)|0,(wy*3)|0,37)%1000)/1000;
  if(hq>=0.42*grupo*Math.min(1.5,c.lirios)) return 0;
  return h3((wx*5)|0,(wy*3)|0,38)%100<9?2:1;
}
function pintarPlanta(sc,i,cc,r,tipo,d,luz,sombras){
  const {G,C,x0,y0,CPM,RPM,t}=sc, v=C[i], lum=(((v>>16)&255)+((v>>8)&255)+(v&255))/3, f=clamp(lum/105,0.4,1.25);
  const wx=x0+(cc+0.5)/CPM, wy=y0+(r+0.5)/RPM, hq=h3((wx*9)|0,(wy*9)|0,35)%100;
  const viento=(NV.entorno&&NV.entorno.viento)?clamp(Math.abs(NV.entorno.viento('agua',wx,wy,t)||0),0,1.2):0.3;
  const sway=sen(TAU*(wx*0.21+t*0.55)+hq*0.3)*0.5+0.5+viento*0.5;
  let code, R,Gc,B;
  if(tipo===2){ code=hq<55?33:hq<80?106:124; const k=0.8+0.4*(hq%7)/7; R=70*k*f; Gc=110*k*f; B=48*k*f; }                  // junco: ! j |
  else { code=sway>1.0?92:sway<0.55?47:124; if(hq<18) code=124; const k=0.75+0.5*(hq%9)/9; R=62*k*f; Gc=104*k*f; B=44*k*f; } // brizna: \ / |
  const kk=clamp(1+d/0.9,0.5,1);
  R=mix(((v>>16)&255)*0.6,R,0.85*kk); Gc=mix(((v>>8)&255)*0.6,Gc,0.85*kk); B=mix((v&255)*0.6,B,0.85*kk);
  R*=luz.r; Gc*=luz.g; B*=luz.b;
  if(sombras) for(const sh of sombras){ const a=cc-sh.c0, b=r-sh.r0; if(a>=0&&b>=0&&a<sh.w&&b<sh.h){ const k=sh.k[b*sh.w+a]; if(k>0){ const q=1-0.5*k; R*=q; Gc*=q; B*=q; } } }
  G[i]=code; C[i]=pack(R,Gc,B);
}
/* la tierra pegada al agua: húmeda, oscura, con piedritas */
function orillaTierra(sc,i,cc,r,d){
  const {G,C,x0,y0,CPM,RPM,t}=sc, hum=0.9;
  const k=clamp(1+d/hum,0,1);           // d<0 en tierra: 1 pegado al agua, 0 a `hum` metros
  if(k<=0) return;
  const v=C[i], f=1-0.42*k*k;
  let R=((v>>16)&255)*f, Gc=((v>>8)&255)*f*0.98, B=(v&255)*f*1.04;
  const wx=x0+(cc+0.5)/CPM, wy=y0+(r+0.5)/RPM, hh=h3((wx*5)|0,(wy*5)|0,17)%100;
  if(k>0.55&&hh<14){ G[i]=hh<5?111:46; R=108*f+10; Gc=98*f+10; B=86*f+10; }       // guijarro o grava
  else if(k>0.3&&k<0.9&&hh>93){ G[i]=58; R=mix(R,60,0.4); Gc=mix(Gc,54,0.4); B=mix(B,44,0.4); }   // barro
  /* una línea fina de espuma que respira en el borde mismo */
  if(d>-0.10){ const sw=0.5+0.5*sen(TAU*(wx*0.35+wy*0.2)-t*0.9); if(sw>0.6&&hh<60){ G[i]=46; R=mix(R,216,0.5); Gc=mix(Gc,226,0.5); B=mix(B,228,0.5); } }
  C[i]=pack(R,Gc,B);
}

/* ------------------------------------------------------------------ cascadas ----
   Una lámina vertical (la altura se ve en filas: alto*HPM), con rayas que caen a la velocidad de la caída libre,
   labio de agua lisa arriba, rocío que sube desde el pie y espuma en el agua de abajo (la espuma se pinta con pintar()
   si el cuerpo de abajo está en la lista; el rocío y la lámina, acá). Llamarla DESPUÉS de dibujar el fondo y las rocas. */
function pintarCascada(sc,c){
  const {G,C,cols,rows,CPM,RPM,HPM,x0,y0,t}=sc;
  const luz=(NV.entorno&&NV.entorno.luz)?NV.entorno.luz(0,0,t):{amb:1,r:1,g:1,b:1};
  const cl=clima(), I=c.intensidad;
  const bc=Math.round((c.x-x0)*CPM), br=Math.round((c.y-y0)*RPM), alto=Math.max(2,Math.round(c.alto*HPM)), mitad=Math.max(2,Math.round(c.ancho*CPM/2));
  const vel=Math.min(14,Math.sqrt(2*GRAV*c.alto)*0.8)*HPM;                 // filas por segundo: caída libre, un poco frenada
  const sem=c.sem|0;
  for(let dr=0;dr<=alto;dr++){
    const r=br-dr, v=dr/alto;                                              // v: 0 en el pie, 1 en el labio
    if(r<0||r>=rows) continue;
    /* el chorro se abre un poco hacia abajo y se deshace en rocío cuanto más alta es la caída */
    const ab=1+0.18*(1-v)*Math.min(1,c.alto/8), m=Math.round(mitad*ab);
    for(let du=-m;du<=m;du++){
      const cc=bc+du; if(cc<0||cc>=cols) continue;
      const u=Math.abs(du)/Math.max(1,m);
      if(u>0.82&&h3(du,dr>>1,sem)%100<(u-0.8)*320) continue;               // borde deshilachado
      const i=r*cols+cc;
      const Ls=HPM*(0.9+1.8*r01(sem,du,3)), z=(dr+t*vel*(0.8+0.4*r01(sem,du,4)))/Ls, fz=z-Math.floor(z);
      let val=Math.pow(1-fz,1.5)*(0.55+0.45*r01(sem,du,5));
      val*=0.55+0.45*I;
      const spray=sm((0.55-v)/0.55)*0;
      let code, lz=0.8+0.5*val, Rr=214, Gg=232, Bb=246;
      if(v>0.94){ code=hhash(du,dr,sem)<55?61:126; lz=1.05; Rr=226; Gg=240; Bb=250; }                // labio liso: = ~
      else if(val>0.62) code=124;                                                                         // |
      else if(val>0.38) code=hhash(du,dr+(t*6|0),sem)<50?33:58;                                           // ! :
      else if(val>0.20) code=46;
      else { if(hhash(du,dr,sem+1)<62) continue; code=39; lz*=0.8; }
      if(v<0.16){ /* el pie: salpicadura */ const q=hhash(du,dr+(t*9|0),sem+2); code=q<40?111:q<70?42:176; lz=1.0+0.3*(1-v/0.16); }
      /* altura: arriba la cascada pierde cuerpo y se vuelve rocío */
      if(c.alto>6&&v>0.35&&v<0.9&&hhash(du,dr+(t*5|0),sem+3)<c.alto*2.2) code=hhash(du,dr,sem+4)<50?58:39;
      const a=Math.min(1.15,lz*(0.35+0.85*luz.amb));
      G[i]=code; C[i]=pack(Rr*a*luz.r,Gg*a*luz.g,Bb*a*luz.b);
    }
  }
  /* el rocío que sube desde el pie, más ancho cuanto más alta y fuerte la caída */
  const Rm=Math.round((0.9+0.2*c.alto*I)*CPM), Hm=Math.round((0.6+0.12*c.alto*I)*HPM);
  for(let dr=0;dr<=Hm;dr++) for(let du=-Rm;du<=Rm;du++){
    const r=br-dr, cc=bc+du; if(r<0||r>=rows||cc<0||cc>=cols) continue;
    const q=(du*du)/(Rm*Rm)+(dr*dr)/(Hm*Hm); if(q>1) continue;
    const dens=(1-q)*0.55*Math.min(1,I+0.2);
    if(hhash(du,dr+(t*3.2|0),sem+7)/100>dens) continue;
    const i=r*cols+cc, a=0.5+0.4*luz.amb, v=C[i];
    G[i]=hhash(du,dr,sem+8)<55?58:46;
    C[i]=pack(mix((v>>16)&255,200*a*luz.r,0.55),mix((v>>8)&255,214*a*luz.g,0.55),mix(v&255,224*a*luz.b,0.55));
  }
}
const hhash=(a,b,c)=>h3(a,b,c)%100;
/* la espuma sobre el agua de abajo (anillos que se abren desde el impacto); se llama después de pintar() */
function pintarEspumaCascada(sc,c){
  const {G,C,cols,rows,CPM,RPM,x0,y0,t}=sc, luz=(NV.entorno&&NV.entorno.luz)?NV.entorno.luz(0,0,t):{amb:1,r:1,g:1,b:1};
  const I=c.intensidad, Rx=(0.8+0.22*c.alto*I)*CPM, Ry=(0.8+0.22*c.alto*I)*RPM*1.6;
  const cx=(c.x-x0)*CPM, cy=(c.y-y0)*RPM+RPM*0.3, sem=c.sem|0;
  const r0=Math.max(0,Math.floor(cy-Ry)), r1=Math.min(rows-1,Math.ceil(cy+Ry)), c0=Math.max(0,Math.floor(cx-Rx)), c1=Math.min(cols-1,Math.ceil(cx+Rx));
  for(let r=r0;r<=r1;r++) for(let cc=c0;cc<=c1;cc++){
    const dx=(cc-cx)/Rx, dy=(r-cy)/Ry, q=Math.sqrt(dx*dx+dy*dy); if(q>1) continue;
    const ring=0.5+0.5*sen(TAU*(q*2.2-t*0.9)), dens=(1-q*q)*(0.35+0.55*ring)*Math.min(1,0.4+I);
    if(hhash(cc,r+(t*4|0),sem+11)/100>dens) continue;
    const i=r*cols+cc, a=0.7+0.45*luz.amb;
    G[i]=hhash(cc,r,sem+12)<60?42:35; C[i]=pack(224*a*luz.r,234*a*luz.g,240*a*luz.b);
  }
}

/* ------------------------------------------------------------------ el mundo: la lista de cuerpos del juego ----
   Los datos viven en el mundo editado (NV.mundo, op 'agua'); acá se arman los cuerpos. Un cuerpo cuyos datos no cambiaron
   se conserva tal cual (sus golpes en curso y su campo no se pierden al editar otro). */
let LISTA=[], FIRMAS=new Map(), VERSION=0;
function sincronizar(arr){
  const nuevos=[], firmas=new Map(), previos=new Map(LISTA.map(c=>[c.id,c]));
  for(const d of (arr||[])){
    const f=JSON.stringify(d); let c=previos.get(d.id);
    if(!c||FIRMAS.get(d.id)!==f){ try{ const n=deDatos(d); if(c&&c.golpes) n.golpes=c.golpes; c=n; }catch(e){ if(NV.avisarError) NV.avisarError('✗ agua '+(d&&d.id)+': '+e.message); continue; } }
    firmas.set(d.id,f); nuevos.push(c);
  }
  LISTA=nuevos; FIRMAS=firmas; VERSION++; PREV_LISTA=null; return LISTA;
}
/* vista previa del Modo Dios: un cuerpo que todavía no se guardó (o uno guardado con cambios sin soltar) se dibuja ya */
let PREVIA=null, PREV_LISTA=null;
function vista(d){
  if(!d){ PREVIA=null; PREV_LISTA=null; return; }
  try{ const c=deDatos(d); const q=LISTA.find(x=>x.id===d.id); if(q&&q.golpes) c.golpes=q.golpes; PREVIA=c; PREV_LISTA=null; }catch(e){ PREVIA=null; PREV_LISTA=null; }
}
function cuerpos(){
  if(!PREVIA) return LISTA;
  if(!PREV_LISTA){ const r=[]; let puesto=false; for(const c of LISTA){ if(c.id===PREVIA.id){ r.push(PREVIA); puesto=true; } else r.push(c); } if(!puesto) r.push(PREVIA); PREV_LISTA=r; }
  return PREV_LISTA;
}
/* ¿hay agua a menos de `reach` metros de (x,y)? (para saber qué objetos grabar para el reflejo) */
function cerca(x,y,reach){
  for(const c of cuerpos()){ if(c.tipo==='cascada'){ if(Math.abs(c.x-x)<=3+c.ancho&&y>=c.y-reach&&y<=c.y+4) return true; continue; }
    const F=prepararCampo(c); const cj=F.caja; if(x>=cj.x0-3&&x<=cj.x1+3&&y>=cj.y0-reach&&y<=cj.y1+2) return true; }
  return false;
}
/* para el editor: ¿qué cuerpo está en (x,y)? devuelve el de arriba (la cascada primero) */
function cuerpoEn(x,y,tol){
  tol=tol||0.6;
  const L=cuerpos(); for(let i=L.length-1;i>=0;i--){ const c=L[i];
    if(c.tipo==='cascada'){ if(Math.abs(c.x-x)<=c.ancho/2+tol&&y<=c.y+tol&&y>=c.y-c.alto*1.7-tol) return c; continue; }
    const F=prepararCampo(c), o={}; if(muestra(F,x,y,o)&&o.d>-tol) return c; }
  return null;
}

/* ---- rocas de la orilla y de adentro ----
   Devuelve dónde poner rocas (del motor de rocas: NV.rocoso) alrededor y dentro del cuerpo: [{x,y,spec,dentro}] con x,y enteros (la casilla del mundo).
   No las pone: el Modo Dios las coloca como objetos reales, así que se editan, se regeneran y se borran como cualquier roca. Mismo cuerpo + misma `semO`, mismas rocas. */
const MAT_ORILLA=['granito','caliza','basalto','pizarra','arenisca'];
function decorar(c,semO){
  if(c.tipo==='cascada') return [];
  const T=TIPOS[c.tipo], F=prepararCampo(c), rnd=NV.mulberry((((c.sem|0)*977+(semO|0)*131)^0x5bd1e995)|0), dd=(v,d)=>v==null?d:v;
  const kOr=dd(c.orillaRocas,T.orillaRocas), kIn=dd(c.orillaDentro,T.orillaDentro), kMu=dd(c.musgoRocas,T.musgoRocas);
  const ori=[], ins=[];
  for(let j=0;j<F.h;j+=2) for(let i=0;i<F.w;i+=2){ const q=j*F.w+i, d=F.d[q];
    if(d<=-0.3&&d>-1.8) ori.push(q); else if(d>0.45&&F.prof[q]>0.04&&F.prof[q]<=1.3) ins.push(q); }
  const matB=MAT_ORILLA[(rnd()*MAT_ORILLA.length)|0];
  const nOr=kOr<=0?0:Math.min(28,Math.round(kOr*ori.length*0.25*0.12)), nIn=kIn<=0||!ins.length?0:Math.min(12,Math.round(kIn*(0.7+ins.length*0.25*0.03)));
  const formas={pequena:['redondeada','angular','plana','irregular','ovalada'],media:['redondeada','angular','plana','irregular','alargada','fracturada','estratificada'],grande:['redondeada','fracturada','angular','irregular','erosionada','estratificada']};
  const rad={pequena:0.9,media:1.6,grande:2.6}, out=[];
  const pickT=dentro=>{ const r=rnd(); return dentro?(r<0.72?'pequena':r<0.95?'media':'grande'):(r<0.5?'pequena':r<0.85?'media':'grande'); };
  const poner=(lista,n,dentro)=>{
    for(let k=0,intentos=0;k<n&&intentos<n*30&&lista.length;intentos++){
      const q=lista[(rnd()*lista.length)|0], i=q%F.w, j=(q/F.w)|0;
      const x=Math.round(F.x0+(i+rnd())/PPM), y=Math.round(F.y0+(j+rnd())/PPM), m={};
      if(!muestra(F,x+0.5,y+0.5,m)) continue;
      if(dentro?!(m.d>0.35&&m.prof>0.03):!(m.d<-0.15&&m.d>-2.2)) continue;
      const tam=pickT(dentro); let libre=true;
      for(const o of out){ if(Math.hypot(o.x-x,(o.y-y)*1.6)<(rad[tam]+rad[o.spec.tam])*0.6){ libre=false; break; } }
      if(!libre) continue;
      const mat=rnd()<0.8?matB:MAT_ORILLA[(rnd()*MAT_ORILLA.length)|0], fl=formas[tam], forma=fl[(rnd()*fl.length)|0];
      const musgo=rnd()<kMu*(dentro?0.55:0.9)?0.3+rnd()*0.6:0;
      const estado={musgo,liquen:rnd()<0.25?0.2+rnd()*0.4:0,humedad:dentro?0.7:0.35+rnd()*0.4,erosion:rnd()*0.4,enterrada:dentro?0.25+rnd()*0.35:0.15+rnd()*0.4};
      out.push({x,y,dentro,spec:{mat,tam,forma,estado,sem:(rnd()*60000|0)+1,escala:0.85+rnd()*0.35,yaw:rnd()*6.28}}); k++;
    }
  };
  poner(ori,nOr,false); poner(ins,nIn,true);
  return out;
}
/* hasta dónde llega el agua a una roca metida en ella (en metros de altura de la roca), o null si está en seco */
function nivelEn(x,y){
  const L=cuerpos(), o={};
  for(let i=L.length-1;i>=0;i--){ const c=L[i]; if(c.tipo==='cascada') continue;
    const F=prepararCampo(c); if(muestra(F,x+0.5,y+0.5,o)&&o.d>0.2&&o.prof>0.03) return Math.round(Math.min(0.6,0.10+o.prof*0.5)*20)/20; }
  return null;
}

/* ------------------------------------------------------------------ registro ---- */
const A={decorar,nivelEn,sincronizar,vista,cuerpos,cerca,cuerpoEn,version:()=>VERSION,TIPOS,TIPOS_ID,NOMBRES,CASCADA0,crear,validar,aDatos,deDatos,tocar,prepararCampo,muestra,enAgua,actualizar,superficie,
  golpe,actor,pintar,pintarCascada,pintarEspumaCascada,usarClima,clima,VIENTO_DIR,colorProf,cielo,lecho,sen,
  datosMundo:cuerpos=>({formato:1,cuerpos:cuerpos.map(aDatos)}),
  desdeMundo:o=>{ if(!o||o.formato!==1||!Array.isArray(o.cuerpos)) throw new Error('aguas: formato desconocido'); return o.cuerpos.map(deDatos); }};
registrarViento();
NV.aguas=A;
if(NV.motores) NV.motores.registrar({id:'aguas',nombre:'Aguas continentales',estado:'integrado',archivo:'src/juego/aguas.js',
  preview:'preview/aguas.html',prueba:'pruebas/aguas.js',
  caras:{ambiente:(x,y,t)=>{ const a=enAgua(LISTA,x,y); return a?{prof:a.prof,fx:a.fx,fy:a.fy}:null; },
    editor:{parametros:{profundidad:{tipo:'cantidad',min:0.05,max:12,def:null},transparencia:{tipo:'cantidad',min:0,max:1,def:null},ondas:{tipo:'cantidad',min:0,max:2,def:1},
      reflejo:{tipo:'cantidad',min:0,max:1.5,def:1},velocidad:{tipo:'cantidad',min:0,max:3,def:null}}}}});
})(window.NV);

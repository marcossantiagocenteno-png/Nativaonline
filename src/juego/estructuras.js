/* Nativa Online — MOTOR DE ESTRUCTURAS Y RUINAS (estructuras). LABORATORIO: todavía no lo usa el juego.
   Independiente de los motores de rocas, árboles y agua: no los reemplaza ni los toca. Sigue la misma arquitectura que
   ellos: el objeto es DATOS (una spec chica y determinista) más un SÓLIDO que se evalúa con una función de distancia; cada
   celda de pantalla lanza un rayo con la inclinación de cámara del juego (la de RPM/HPM) y de ahí salen la normal, la
   sombra propia, la oclusión y los materiales. Luz, sombra proyectada y contorno vienen de NV.entorno.

   LA SPEC. {tipo,mat,sem,semD,semV,escala,yaw,inclinacion,largo,alto,grosor,edad,deterioro,tono,lum,sat,estado:{...}}
   · FORMA (tipo, mat, sem, medidas): dónde están los bloques, los huecos, las juntas. `sem` la decide.
   · ANTIGÜEDAD (`edad` 0..1) y DETERIORO (`deterioro` 0..1) son dos perillas distintas: un muro viejo puede estar entero
     (edad alta, deterioro bajo) y uno nuevo puede estar derrumbado.
       edad      → juntas comidas, aristas redondeadas, tono lavado, rugosidad, hundimiento. No saca piezas.
       deterioro → cuáles bloques faltan (primero los de arriba y los de las puntas), cuánto bajó la corona, dónde se ve el
                   relleno interior, qué escombros caen al pie, qué se inclina. Usa SU semilla (`semD`): cambiar el
                   deterioro no reordena los bloques.
   · NATURALEZA (`estado`: musgo, líquen, humedad, vegetación, tierra, hojas, quemadura, enterrada) y la semilla `semV`:
     sólo cambian el pintado; el sólido y sus rayos se reutilizan. Regenerar la vegetación no toca la forma.

   EL DETERIORO RESPETA LA ESTRUCTURA. Un muro es dos caras de bloques con un relleno de cascote en medio y una corona:
   pierde bloques de la corona y de las puntas, baja por escalones de hilada, muestra el relleno donde falta el frente, y
   los bloques caídos quedan al pie a ambos lados. Una columna es un fuste de tambores: se corta por una fractura inclinada
   y los tambores quedan tumbados al lado. Un arco pierde dovelas y la clave baja primero. Un pozo pierde piezas del brocal.

   Todo se mide en metros. Glifos: rampas propias por material (extremo denso exclusivo en su capa, ver DISENO.md §9) y los
   del juego para musgo, líquen y grieta. El contorno es el compartido (NV.entorno.contorno). Pruebas:
   pruebas/estructuras.js; laboratorio: preview/estructuras.html. */
(function(NV){
'use strict';
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const sm=u=>u<=0?0:u>=1?1:u*u*(3-2*u);
const lerp=(a,b,t)=>a+(b-a)*t;
const frac=x=>x-Math.floor(x);
const ENT=()=>NV.entorno;
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
const ORLA=(5<<16)|(8<<8)|11;
const MUSGO_G=['\u00b0','*','\u00b0',';'], LIQ_G=['\u00b0','*','\u00b0'], SUELO_G=[',','.',':',';'], HOJA_G=[',','`','\'','.'], VEG_G=['"','v',';','"','*'];
const PAL_MUSGO=[[10,34,26],[20,58,40],[34,88,52],[58,122,66],[92,156,84]];
const PAL_SUELO=[[30,26,20],[50,43,32],[74,64,46],[100,88,62],[126,112,80]];
const PAL_HOJA=[[74,48,22],[112,70,26],[150,92,30],[176,118,42]];
const PAL_VEG=[[14,52,30],[26,86,44],[46,122,60],[78,158,84]];
const LIQ_COL=[[196,188,84],[150,172,132],[214,146,64]];

/* ------------------------------------------------------------------ MATERIALES ----
   Cada uno es una estructura de bloques, no un color. bh/bl: altura de hilada y largo de bloque en metros (estilizados:
   un ladrillo real mediría 6 cm y no se podría dibujar en 13 columnas por metro); irreg: bloques de medidas distintas;
   g/bev: profundidad y ancho de la junta; sal: cuánto sobresale un bloque de otro. */
const MATERIALES={
  mamposteria:{nombre:'Mampostería', ramp:['.',':','o','e','0','Q'], pal:[[34,32,30],[62,58,52],[96,90,80],[132,124,110],[168,158,140],[204,194,172]],
    bh:[0.30,0.52], bl:[0.40,1.00], irreg:1, g:0.050, bev:0.075, sal:0.030, tono:0.20, junta:[84,78,68], grano:0.30},
  sillar:{nombre:'Sillar', ramp:['.',':','-','c','O','D'], pal:[[70,62,52],[112,102,86],[150,138,116],[184,172,146],[212,200,172],[236,226,198]],
    bh:[0.40,0.40], bl:[0.85,0.85], irreg:0, g:0.028, bev:0.050, sal:0.012, tono:0.10, junta:[96,88,74], grano:0.18},
  ladrillo:{nombre:'Ladrillo', ramp:['.',':','=','E','K','R'], pal:[[52,24,18],[88,40,28],[128,60,40],[162,82,52],[192,108,68],[218,138,92]],
    bh:[0.24,0.24], bl:[0.50,0.50], irreg:0, g:0.032, bev:0.046, sal:0.010, tono:0.26, junta:[132,120,104], grano:0.22},
  piedraSeca:{nombre:'Piedra seca', ramp:['.',':','o','a','8','W'], pal:[[30,32,34],[54,58,62],[84,90,96],[116,124,130],[150,158,164],[184,190,194]],
    bh:[0.34,0.62], bl:[0.50,1.25], irreg:1, g:0.070, bev:0.110, sal:0.050, tono:0.22, junta:[26,26,28], grano:0.34},
  madera:{nombre:'Madera', ramp:['.','-','=','h','I','U'], pal:[[34,24,16],[60,42,28],[88,62,40],[118,86,56],[150,112,74],[184,142,98]],
    bh:[0.16,0.16], bl:[1.2,1.2], irreg:0, g:0.020, bev:0.030, sal:0.008, tono:0.18, junta:[24,16,10], grano:0.25}
};
const MATS=Object.keys(MATERIALES);
const PAL_NUCLEO=[[24,20,16],[42,36,28],[64,56,44],[90,80,64]], NUC_G=[':',';',',','.'];
const ESTADO0={musgo:0,liquen:0,humedad:0,vegetacion:0,tierra:0,hojas:0,quemadura:0,enterrada:0};
/* los nombres de las perillas de antigüedad y deterioro que pide el pliego */
const ANTIGUEDAD={'Nuevo':0.0,'Usado':0.18,'Viejo':0.45,'Muy antiguo':0.85,'Abandonado durante años':0.65};
const DETERIORO={'Intacto':0.0,'Deteriorado':0.38,'Parcialmente destruido':0.68,'Completamente derrumbado':1.0};

/* ------------------------------------------------------------------ TIPOS ----
   Cada tipo: nombre, categoría, construcción y los valores por omisión de sus medidas. */
const TIPOS={
  muro:        {nombre:'Muro',                 cat:'Construcciones', mat:'mamposteria', largo:6.0, alto:2.2, grosor:0.7},
  muroLadrillo:{nombre:'Muro de ladrillo',     cat:'Construcciones', mat:'ladrillo',    largo:5.0, alto:2.4, grosor:0.55, base:'muro'},
  paredCaida:  {nombre:'Pared derrumbada',     cat:'Construcciones', mat:'mamposteria', largo:6.5, alto:2.6, grosor:0.7,  base:'muro', det:0.92},
  cercaPiedra: {nombre:'Cerca de piedra',      cat:'Construcciones', mat:'piedraSeca',  largo:7.0, alto:1.0, grosor:0.55, base:'muro', det:0.25},
  columna:     {nombre:'Columna rota',         cat:'Construcciones', mat:'sillar',      largo:0.7, alto:3.6, grosor:0.7,  det:0.6},
  pilar:       {nombre:'Pilar antiguo',        cat:'Construcciones', mat:'sillar',      largo:0.95,alto:3.0, grosor:0.95, base:'muro', det:0.25},
  arco:        {nombre:'Arco de piedra',       cat:'Construcciones', mat:'sillar',      largo:5.4, alto:4.2, grosor:0.9,  base:'muro', det:0.3},
  escalera:    {nombre:'Escalera destruida',   cat:'Construcciones', mat:'mamposteria', largo:2.4, alto:2.0, grosor:3.2,  det:0.5},
  chimenea:    {nombre:'Chimenea aislada',     cat:'Construcciones', mat:'ladrillo',    largo:1.3, alto:3.8, grosor:1.0,  base:'muro', det:0.35},
  puerta:      {nombre:'Puerta abandonada',    cat:'Construcciones', mat:'madera',      largo:1.1, alto:2.1, grosor:0.16, det:0.45},
  ventana:     {nombre:'Marco de ventana',     cat:'Construcciones', mat:'madera',      largo:1.0, alto:1.3, grosor:0.14, det:0.4},
  cercaMadera: {nombre:'Cerca de madera',      cat:'Construcciones', mat:'madera',      largo:6.0, alto:1.2, grosor:0.12, det:0.35},
  puente:      {nombre:'Puente destruido',     cat:'Construcciones', mat:'madera',      largo:5.6, alto:0.9, grosor:1.5,  det:0.55},
  pozo:        {nombre:'Pozo',                 cat:'Rurales',        mat:'mamposteria', largo:1.9, alto:1.0, grosor:1.9,  det:0.25}
};
const TIPOS_ID=Object.keys(TIPOS);
const baseDe=t=>TIPOS[t].base||t;

/* ------------------------------------------------------------------ GEOMETRÍA BÁSICA ---- */
const _I={e:9,t:0,core:0,mat:0,hz:0,vac:0,hx:0};     // lo que el último info() dejó dicho de ese punto
function cajaR(x,y,z,hx,hy,hz,r){ const qx=Math.abs(x)-hx+r, qy=Math.abs(y)-hy+r, qz=Math.abs(z)-hz+r;
  return Math.hypot(Math.max(qx,0),Math.max(qy,0),Math.max(qz,0))+Math.min(Math.max(qx,qy,qz),0)-r; }

/* retícula de bloques de una cara: las hiladas se reparten una vez (las comparten las dos caras), los bloques de cada cara
   son propios (otra semilla): así el frente y el dorso no son espejo. */
function hiladas(M,rnd,Hh,esc){
  const ys=[0]; let y=0, k=0;
  while(y<Hh-0.02){
    const bh=(M.irreg?lerp(M.bh[0],M.bh[1],rnd()):M.bh[0]*(1+0.03*(rnd()-0.5)))*esc;
    y=(Hh-(y+bh)<0.4*bh)?Hh:y+bh; ys.push(y); if(++k>80) break;
  }
  return ys;
}
function caraBloques(M,rnd,W,ys,esc,bondOff){
  const n=ys.length-1, X=[],T=[],P=[],V=[];
  for(let k=0;k<n;k++){
    const xs=[], bl0=M.bl[0]*esc;
    let x=-W/2-0.001-(M.irreg?rnd()*M.bl[1]*esc*0.7:((k+bondOff)&1)*bl0*0.5);
    xs.push(x);
    while(x<W/2+0.001){ const bl=(M.irreg?lerp(M.bl[0],M.bl[1],rnd()*0.6+rnd()*0.4):bl0*(1+0.08*(rnd()-0.5)))*esc/(M.irreg?esc:1)*(M.irreg?1:1); x+=Math.max(0.12,bl); xs.push(x); if(xs.length>64) break; }
    X.push(Float32Array.from(xs));
    const nb=xs.length-1, t=new Float32Array(nb), p=new Float32Array(nb), v=new Uint8Array(nb).fill(1);
    for(let i=0;i<nb;i++){ t[i]=rnd()-0.5; p[i]=rnd(); }
    T.push(t); P.push(p); V.push(v);
  }
  return {X,T,P,V,n};
}
function ixH(ys,y){ let lo=0,hi=ys.length-2; while(lo<hi){ const m=(lo+hi+1)>>1; if(ys[m]<=y) lo=m; else hi=m-1; } return lo; }
function ixB(X,x){ let lo=0,hi=X.length-2; while(lo<hi){ const m=(lo+hi+1)>>1; if(X[m]<=x) lo=m; else hi=m-1; } return lo; }

/* ------------------------------------------------------------------ ESCOMBROS ----
   Piezas caídas: cajas redondeadas (bloques) y cilindros tumbados (tambores). Se reparten por la masa que falta. */
function escombro(it){ it.c=Math.cos(it.yaw); it.s=Math.sin(it.yaw); it.br=Math.max(it.hx,it.hz,it.hl||0)*1.5+it.r+0.05; return it; }
function sdEsc(it,x,y,z){
  const dx=x-it.x, dz=z-it.z, lx=dx*it.c+dz*it.s, lz=-dx*it.s+dz*it.c, ly=y-it.y;
  if(it.cil) return Math.max(Math.hypot(ly,lz)-it.cr, Math.abs(lx)-it.hl)*0.9;
  return cajaR(lx,ly,lz,it.hx,it.hy,it.hz,it.r);
}
function repartir(rnd,n,x0,x1,zf,zb,hlo,hhi,esc,sunk){
  const out=[];
  for(let i=0;i<n;i++){
    const w=lerp(hlo,hhi,rnd()*rnd()*0.5+rnd()*0.5)*esc, h=w*lerp(0.45,0.8,rnd()), d=w*lerp(0.55,0.95,rnd());
    const lado=rnd()<0.62?1:-1, z=lado>0?zf+Math.pow(rnd(),1.6)*(hhi*3.2)*esc:zb-Math.pow(rnd(),1.6)*(hhi*3.2)*esc*0.7;
    out.push(escombro({x:lerp(x0,x1,rnd()),z,yaw:rnd()*3.1416,hx:w*0.5,hy:h*0.5,hz:d*0.5,r:Math.min(w,h)*0.14,y:h*0.5*(1-sunk*0.5)-sunk*0.03,t:rnd()-0.5}));
  }
  return out;
}

/* ------------------------------------------------------------------ MURO ----
   Dos caras de bloques con relleno en medio y corona. Sirve para muros, cercas de piedra, pilares, arcos y chimeneas
   (que son muros con huecos, con afilado o con boca). huecos: [{x0,x1,y0,y1,tipo:'puerta'|'ventana'|'arco'|'hogar'}]. */
function bMuro(sp,M,rnd,rndD,Mm){
  const esc=sp.escala, L=sp.largo*esc, Hh=sp.alto*esc, T=sp.grosor*esc, d=sp.deterioro, edad=sp.edad;
  const ys=hiladas(M,rnd,Hh,esc), n=ys.length-1;
  const F=caraBloques(M,NV.mulberry((sp.sem*31+11)|0),L,ys,esc,0), B=caraBloques(M,NV.mulberry((sp.sem*37+23)|0),L,ys,esc,1);
  const huecos=(sp.huecos||[]).map(h=>({x0:h.x0*esc,x1:h.x1*esc,y0:h.y0*esc,y1:h.y1*esc,tipo:h.tipo||'puerta',marco:h.marco!==false}));
  for(const h of huecos){ if(h.tipo==='arco'){ h.r=(h.x1-h.x0)/2; h.cx=(h.x0+h.x1)/2; h.cyy=h.y1-h.r; } }
  /* --- DETERIORO: corona por bandas, bloques que faltan, puntas comidas --- */
  const bw=Math.max(0.3,M.bl[0]*esc*0.9), nbin=Math.ceil(L/bw)+1, cap=new Float32Array(nbin), xL=new Float32Array(n), xR=new Float32Array(n);
  const meanBh=Hh/n, sSem=(sp.semD*13+5)|0;
  for(let i=0;i<nbin;i++){
    const x=-L/2+i*bw, ex=Math.min(x+L/2,L/2-x)/Math.max(L,1e-3);
    let prof=clamp((fbm(x*0.42+sSem,0.5,2.1,sSem,3)-0.30)*2.0+(H4(i,sSem,3,1)-0.5)*0.9+0.5*(0.5-ex)*d*1.4,0,1);
    prof=Math.pow(prof,1.35); const drop=Hh*d*(d>0.85?1.0:0.8)*prof, rest=Hh-drop;
    const k=ixH(ys,Math.max(0,rest-0.001)); cap[i]=d<0.02?Hh:Math.max(ys[k+1]<=Hh?ys[k+1]:Hh,0.18*esc+(d>0.95?H4(i,sSem,4,1)*0.35*esc:0.25*esc));
    if(d<0.02) cap[i]=Hh; else cap[i]=Math.min(Hh,Math.max(cap[i],ys[Math.min(n,Math.max(1,ixH(ys,rest)))]));
  }
  for(let k=0;k<n;k++){
    const fy=(ys[k]+ys[k+1])/2/Hh, bite=d*(0.12+0.9*fy*fy)*Math.pow(rndD(),0.7)*M.bl[1]*esc*1.4;
    xL[k]=-L/2+bite*(0.4+0.6*rndD()); xR[k]=L/2-bite*(0.4+0.6*rndD());
  }
  const shell=T*0.30;
  for(const Ra of [F,B]){
    for(let k=0;k<n;k++){ const X=Ra.X[k], fy=(ys[k]+ys[k+1])/2/Hh; for(let b=0;b<X.length-1;b++){
      const cx=(X[b]+X[b+1])/2, ib=clamp(Math.floor((cx+L/2)/bw),0,nbin-1), alto=ys[k+1]>cap[ib]+0.02*esc;
      const ex=Math.min(cx+L/2,L/2-cx)/L, p=d*d*0.20*(0.15+0.85*fy)*(1+(0.5-ex)*0.9)+d*0.04;
      if(alto||rndD()<p) Ra.V[k][b]=0;
    } }
  }
  /* --- escombros caídos: la masa que falta, repartida al pie a ambos lados --- */
  let falt=0; for(let i=0;i<nbin;i++) falt+=(Hh-cap[i])*bw; falt=falt/(Hh*L);
  const nEsc=Math.round(clamp(falt*L*Hh*(M.irreg?3.4:3.0)/(M.bl[0]*M.bh[0]*esc*esc)*0.16,0,26)+(d>0.15?2:0)*Math.min(1,d*3));
  const ESC=d>0.12?repartir(rndD,nEsc,-L/2-0.2*esc,L/2+0.2*esc,T/2,-T/2,M.bh[0]*0.9,M.bl[M.irreg?0:0]*1.5+0.05,esc,clamp(edad,0,1)):[];
  /* --- relieve de una cara --- */
  const g0=M.g*(1+edad*1.4)*esc*0.9+0.003, bev=M.bev*esc*(1+edad*0.7), rug=0.010*esc*(0.5+edad*1.5)*M.grano*3;
  const afil=sp.afilado||0;
  function rel(R,x,y,wi){
    const k=ixH(ys,Math.min(y,Hh-1e-4)), X=R.X[k], b=ixB(X,x), x0=X[b], x1=X[b+1], y0=ys[k], y1=ys[k+1];
    const e=Math.min(x-x0,x1-x,y-y0,y1-y);
    if(wi){ _I.e=e; _I.t=R.T[k][b]; _I.hz=(y-y0<x-x0&&y-y0<x1-x&&y-y0<y1-y)?1:0; _I.hx=(Math.min(x-x0,x1-x)<Math.min(y-y0,y1-y))?1:0; }
    if(!R.V[k][b]){ if(wi) _I.core=1; return shell*(0.78+0.5*n3(x*5,y*5,0.5,sSem))+M.sal*esc*2*n3(x*9,y*9,1.5,sSem+3); }
    if(wi) _I.core=0;
    const u=clamp(e/bev,0,1);
    return g0*(1-sm(u))+(R.P[k][b]-0.5)*M.sal*esc*(1-0.7*edad)+(n3(x*7,y*7,2.5,sp.sem)-0.5)*rug;
  }
  /* huecos: distancia 2D (negativa dentro) y su borde en arco con dovelas */
  function dHueco(h,x,y){
    if(h.tipo==='arco'){ const dr=Math.max(Math.abs(x-h.cx)-h.r, h.y0-y, -(y-h.cyy)+0); if(y<h.cyy) return Math.max(Math.abs(x-h.cx)-h.r,h.y0-y); return Math.hypot(x-h.cx,y-h.cyy)-h.r; }
    return Math.max(Math.max(h.x0-x,x-h.x1),Math.max(h.y0-y,y-h.y1));
  }
  const FR=sp.matB&&MATERIALES[sp.matB]?sp.matB:'madera', fw=0.11*esc;
  const nDov=h=>Math.max(5,Math.round(Math.PI*h.r/(0.5*esc)/1)|1);
  const dovViva=(h,i)=>(sp.semD*7+i*13+((h.x0*10)|0))&1023;
  function ev(x,y,z,wi){
    const yy=Math.max(0,y);
    let cx=x; if(afil){ const k=1-afil*clamp(yy/Hh,0,1); cx=x/k; }
    const ib=clamp(Math.floor((cx+L/2)/bw),0,nbin-1), capy=cap[ib];
    const k=ixH(ys,Math.min(yy,Hh-1e-4));
    const R=z>=0?F:B, side=z>=0?1:0;
    let r=rel(R,cx,yy,wi);
    /* dovelas del borde de un arco: un anillo propio con juntas radiales */
    let arco=null;
    for(let q=0;q<huecos.length;q++){ const h=huecos[q]; if(h.tipo!=='arco') continue;
      const dd=Math.hypot(cx-h.cx,yy-h.cyy), ri=h.r, ring=0.46*esc;
      if(yy>=h.cyy-0.05*esc&&dd>=ri-0.01&&dd<ri+ring){
        const ang=Math.atan2(yy-h.cyy,cx-h.cx), nd=nDov(h), a=ang/Math.PI*nd, ia=Math.floor(a), fa=a-ia, ed=Math.min(fa,1-fa)*Math.PI*dd/nd;
        const eh=Math.min(dd-ri,ri+ring-dd), e=Math.min(ed,eh), v=H4(ia,sp.sem,5,2), caida=(sp.deterioro>0.05)&&(((dovViva(h,ia)%100)/100)<sp.deterioro*0.55*(Math.abs(ia-(nd-1)/2)<0.6?1.5:1));
        arco={e,t:v-0.5,caida,ia};
        if(caida) r=shell*1.2; else r=(M.g*esc*0.9)*(1-sm(clamp(e/bev,0,1)))-0.03*esc;
        if(wi){ _I.e=e; _I.t=arco.t; _I.core=caida?1:0; _I.hz=(ed<eh)?0:1; _I.hx=(ed<eh)?1:0; }
        break;
      }
    }
    let f=Math.abs(z)-(T/2-r);
    const dEnd=Math.max(xL[k]-cx,cx-xR[k]);
    let fe=Math.max(f,dEnd), top=yy-capy;
    top+=(n3(x*6,yy*6,z*6,sSem+7)-0.5)*0.05*esc*(d>0.05?1:0.4);
    fe=Math.max(fe,top);
    /* los bloques que faltan arriba dejan el borde irregular: se recorta con la hilada de cada bloque faltante */
    if(afil) fe=fe*(1-afil*0.3);
    for(let q=0;q<huecos.length;q++){ const h=huecos[q], dh=dHueco(h,cx,yy); if(dh>-0.9*esc){ fe=Math.max(fe,-dh); } }
    let mat=0;
    /* marcos y hojas de madera dentro de los huecos */
    for(let q=0;q<huecos.length;q++){ const h=huecos[q]; if(!h.marco||h.tipo==='hogar') continue;
      if(Math.abs(z)>T*0.62||cx<h.x0-0.2||cx>h.x1+0.2||yy>h.y1+0.2||yy<h.y0-0.2) continue;
      const hh=(h.y1-h.y0)/2, cxm=(h.x0+h.x1)/2, cym=(h.y0+h.y1)/2;
      let df=9;
      df=Math.min(df,cajaR(cx-h.x0-fw/2,yy-cym,z,fw/2,hh,T*0.30,0.012*esc));
      df=Math.min(df,cajaR(cx-h.x1+fw/2,yy-cym,z,fw/2,hh,T*0.30,0.012*esc));
      if(h.tipo!=='arco') df=Math.min(df,cajaR(cx-cxm,yy-h.y1+fw/2,z,(h.x1-h.x0)/2+fw*0.3,fw/2,T*0.30,0.012*esc));
      if(h.tipo==='ventana') df=Math.min(df,cajaR(cx-cxm,yy-cym,z,(h.x1-h.x0)/2,fw*0.30,T*0.18,0.01*esc),cajaR(cx-cxm,yy-cym,z,fw*0.30,hh,T*0.18,0.01*esc));
      if(h.tipo==='puerta'&&(sp.hoja||0)>0){ const ab=sp.hoja, hw=(h.x1-h.x0)/2, ax=Math.cos(ab*1.1), lx=(cx-h.x0)/Math.max(0.2,ax)-hw*0, tab=Math.floor((cx-h.x0)/(0.16*esc)), ph=H4(tab,sp.sem,8,3);
        if(ph>d*0.6) df=Math.min(df,cajaR(cx-cxm,yy-cym+0.04*esc,z-0.02*esc*ab,hw-fw*0.5,hh-fw*0.5,0.035*esc,0.008*esc)); }
      if(df<fe){ fe=df; mat=1; }
    }
    for(let q=0;q<ESC.length;q++){ const it=ESC[q]; if(Math.abs(x-it.x)>it.br||Math.abs(z-it.z)>it.br) continue; const s=sdEsc(it,x,yy,z); if(s<fe){ fe=s; mat=0; if(wi){ _I.core=0; _I.t=it.t; _I.e=9; _I.hz=0; _I.hx=0; } } }
    if(wi){ _I.mat=mat; if(mat===1){ _I.e=9; _I.t=n3(x*4,yy*4,z*4,sp.sem)-0.5; _I.core=0; } if(fe>0.4&&!arco&&false) _I.core=0; _I.vac=0; }
    return Math.max(fe,-y);
  }
  const sombra=[]; { const ns=Math.max(2,Math.round(L/1.6)); for(let i=0;i<ns;i++){ const x=-L/2+(i+0.5)*L/ns, ib=clamp(Math.floor((x+L/2)/bw),0,nbin-1); sombra.push({x,y:cap[ib]/2,z:0,rx:L/ns*0.62,ry:cap[ib]/2,rz:T*0.5}); } }
  let hmax=0; for(let i=0;i<nbin;i++) hmax=Math.max(hmax,cap[i]);
  return {ev,hx:L/2+1.4*esc+(ESC.length?1.2*esc:0),hz:T/2+(ESC.length?1.4*esc:0.25),hy:Math.max(0.3,hmax)+0.2,car:Math.max(1,T),hmax,sombra,rubble:ESC.length,
    meta:{L,Hh,T,cap}};
}

/* ------------------------------------------------------------------ COLUMNA ----
   Fuste de tambores apilados sobre una base y con capitel. Con deterioro se parte por una fractura inclinada, el capitel
   se cae y los tambores quedan tumbados al lado. */
function bColumna(sp,M,rnd,rndD){
  const esc=sp.escala, R=sp.largo*esc/2, Hh=sp.alto*esc, d=sp.deterioro, edad=sp.edad;
  const nT=clamp(Math.round(Hh/(0.62*esc)),3,9), ys=[0]; for(let i=1;i<=nT;i++) ys.push(Hh*0.86*i/nT);
  const base=0.22*esc, cap=0.26*esc;
  const xo=[],zo=[],ro=[]; for(let i=0;i<nT;i++){ const sh=(0.01+d*0.05)*esc; xo.push((rnd()-0.5)*2*sh); zo.push((rnd()-0.5)*2*sh); ro.push(R*(1-0.08*i/nT)); }
  const flut=sp.flautas==null?1:sp.flautas, nF=10;
  const rot=(sp.semD*0.37)%3.14, frac_=clamp(1-d*0.92,0.06,1), corte=Hh*0.86*frac_+base*0.4, incl=(rndD()-0.5)*0.9*d, ang=rndD()*6.28;
  const conCap=d<0.28, dropP=d>0.04&&rndD()<d*0.5;
  const ESC=[];
  if(d>0.2){
    const nd=Math.min(5,Math.round(d*(nT-Math.floor(frac_*nT)))+1);
    for(let i=0;i<nd;i++){ const rr=R*0.97, hl=lerp(0.28,0.30,rndD())*esc*1.2*(1+rndD()*0.5), x=(rndD()<0.5?-1:1)*(R+0.5*esc+rndD()*1.7*esc), z=(rndD()-0.3)*1.8*esc+R*0.9;
      ESC.push(escombro({x,z,yaw:rndD()*3.14,hx:hl,hy:rr,hz:rr,hl,cr:rr,cil:true,r:0.02,y:rr*0.94,t:rndD()-0.5,cx:0})); }
    const nc=Math.round(2+d*6); for(const it of repartir(rndD,nc,-R*2.4,R*2.4,R,-R,0.20,0.5,esc,edad)) ESC.push(it);
  }
  function ev(x,y,z,wi){
    const yy=Math.max(0,y); let f=9, mat=0;
    const sx=x-(incl*0.3)*yy, rr=Math.hypot(sx,z);
    /* fuste */
    const kk=clamp(ixH(ys,Math.min(yy,ys[ys.length-1]-1e-4))-0,0,nT-1), e=Math.min(yy-ys[kk],ys[kk+1]-yy), ex=xo[kk], ez=zo[kk];
    const rr2=Math.hypot(sx-ex,z-ez), th=Math.atan2(z-ez,sx-ex);
    const fl=flut?0.022*esc*(1-sm(Math.abs(Math.sin(th*nF/2))*2.2))*flut:0, jr=0.012*esc*(1-sm(e/(0.05*esc)))+(edad*0.01*esc);
    const rfu=ro[kk]-fl-jr*(1+edad*1.4)+(n3(x*6,yy*6,z*6,sp.sem)-0.5)*0.014*esc*(0.4+edad);
    let fFuste=rr2-rfu;
    /* fractura inclinada y rugosa en la cima */
    const planoC=(yy-corte)-(Math.cos(ang)*sx+Math.sin(ang)*z)*Math.tan(0.55*Math.min(1,d*1.4))-(n3(x*5,0.5,z*5,sp.sem+9)-0.5)*0.10*esc*d;
    fFuste=Math.max(fFuste,planoC*0.8, yy-(ys[nT]+0.0));
    f=fFuste;
    if(wi){ _I.e=e; _I.t=H4(kk,sp.sem,2,2)-0.5; _I.core=0; _I.hz=e<0.04*esc?1:0; _I.hx=flut&&(Math.abs(Math.sin(th*nF/2))<0.18)?1:0; _I.vac=0; }
    /* base: dado cuadrado */
    const fb=cajaR(sx,yy-base/2,z,R*1.28,base/2,R*1.28,0.02*esc); if(fb<f){ f=fb; if(wi){ _I.e=Math.min(yy,base-yy); _I.hz=1; _I.hx=0; _I.t=0.2; } }
    /* capitel */
    if(conCap){ const fc=Math.max(Math.hypot(sx,z)-R*1.22*(0.8+0.2*sm((yy-Hh*0.86)/cap)),Math.abs(yy-(Hh*0.86+cap/2))-cap/2); if(fc<f){ f=fc; if(wi){ _I.e=9; _I.hz=0; _I.t=0.1; } } }
    for(let q=0;q<ESC.length;q++){ const it=ESC[q]; if(Math.abs(x-it.x)>it.br||Math.abs(z-it.z)>it.br) continue; const s=sdEsc(it,x,yy,z); if(s<f){ f=s; if(wi){ _I.e=9; _I.hz=0; _I.hx=0; _I.t=it.t; _I.core=0; } } }
    return Math.max(f,-y);
  }
  const hm=Math.max(corte,0.5)+(conCap?cap:0), sombra=[{x:0,y:hm/2,z:0,rx:R*1.1,ry:hm/2,rz:R*1.1}];
  return {ev,hx:R*1.5+(ESC.length?4.2*esc:0.2),hz:R*1.5+(ESC.length?2.4*esc:0.2),hy:hm+0.3,car:Math.max(1,R*2),hmax:hm,sombra,rubble:ESC.length,meta:{R,Hh,nT}};
}

/* ------------------------------------------------------------------ ESCALERA ----
   Peldaños que suben hacia el norte. Con deterioro faltan peldaños, se pican los filos y se parten los extremos. */
function bEscalera(sp,M,rnd,rndD){
  const esc=sp.escala, W=sp.largo*esc, Hh=sp.alto*esc, D=sp.grosor*esc, d=sp.deterioro, edad=sp.edad;
  const n=clamp(Math.round(Hh/(0.30*esc)),4,10), rise=Hh/n, run=D/n, P=[];
  for(let i=0;i<n;i++){
    const baja=d>0.05&&rndD()<d*0.62*(0.4+i/n), cut=rndD()<d*0.5;
    const hi=(i+1)*rise*(baja?lerp(0.35,0.8,rndD()):1), x0=-W/2+(cut?rndD()*W*0.5*d:0), x1=W/2-(rndD()<d*0.5?rndD()*W*0.4*d:0);
    P.push({x:(x0+x1)/2,hx:Math.max(0.1,(x1-x0)/2),y:hi/2,hy:hi/2,z:-i*run-run/2+D/2-run*0.0,hz:run/2*(0.96+0.1*rnd()),t:rnd()-0.5,tilt:(rndD()-0.5)*0.05*d});
  }
  const ESC=d>0.1?repartir(rndD,Math.round(2+d*8),-W/2-0.4*esc,W/2+0.4*esc,D/2+0.1,D/2,0.18,0.42,esc,edad):[];
  const r=0.03*esc*(1+edad);
  function ev(x,y,z,wi){
    const yy=Math.max(0,y); let f=9;
    for(let i=0;i<n;i++){ const p=P[i]; const dd=cajaR(x-p.x,yy-p.y-(z+0)*0*0,z-p.z,p.hx,p.hy,p.hz,r+(n3(x*7,yy*7,z*7,sp.sem+i)-0.5)*0.03*esc*(0.3+d)); if(dd<f){ f=dd; if(wi){ const ey=Math.min(p.hy*2-yy,yy), ez=Math.min(Math.abs(z-p.z)); _I.e=Math.min(Math.abs(yy-p.hy*2),Math.abs(z-p.z+p.hz)); _I.t=p.t; _I.core=0; _I.hz=1; _I.hx=0; } } }
    for(let q=0;q<ESC.length;q++){ const it=ESC[q]; if(Math.abs(x-it.x)>it.br||Math.abs(z-it.z)>it.br) continue; const s=sdEsc(it,x,yy,z); if(s<f){ f=s; if(wi){ _I.e=9; _I.t=it.t; _I.core=0; _I.hz=0; _I.hx=0; } } }
    if(wi){ _I.mat=0; _I.vac=0; }
    return Math.max(f,-y);
  }
  const sombra=[{x:0,y:Hh/2*0.8,z:-D*0.15,rx:W*0.5,ry:Hh*0.45,rz:D*0.45}];
  return {ev,hx:W/2+1.3*esc,hz:D/2+(ESC.length?1.2*esc:0.3),hy:Hh+0.2,car:Math.max(1,Hh),hmax:Hh,sombra,rubble:ESC.length,meta:{n,rise,run}};
}

/* ------------------------------------------------------------------ POZO ----
   Brocal circular de hiladas; adentro, el hueco oscuro. Opcional: marco con viga, polea, cuerda, cubeta y techito. */
function bPozo(sp,M,rnd,rndD){
  const esc=sp.escala, Ro=sp.largo*esc/2, Hh=sp.alto*esc, Rm=Ro*0.62, d=sp.deterioro, edad=sp.edad, wall=Ro*0.30, Ri=Ro-wall;
  const ys=hiladas(M,rnd,Hh,esc), n=ys.length-1, cm=Math.PI*2*(Ro-wall/2);
  const cols=[],tn=[],vv=[]; for(let k=0;k<n;k++){ const nb=Math.max(5,Math.round(cm/(M.bl[0]*esc*(M.irreg?1.2:1))+(k&1?0.5:0))), t=new Float32Array(nb), v=new Uint8Array(nb).fill(1); for(let i=0;i<nb;i++){ t[i]=rnd()-0.5; if(rndD()<d*d*0.45*(0.3+0.7*ys[k]/Hh)||(d>0.15&&H4(i,k,sp.semD,5)<d*0.18*(k>=n-2?2.2:0.4))) v[i]=0; } cols.push(nb); tn.push(t); vv.push(v); }
  const g0=M.g*(1+edad*1.4)*esc*0.9+0.003, bev=M.bev*esc*(1+edad*0.7), shell=wall*0.32;
  const marco=sp.marco!==false&&sp.marco!==0, techo=!!sp.techo, polea=!!sp.polea||marco, cubeta=sp.cubeta!==false&&marco;
  const ph=Hh+1.55*esc, pe=Ro*1.12, ESC=repartir(rndD,Math.round(3+d*7),-Ro*1.2,Ro*1.2,Ro,-Ro,0.18,0.42,esc,edad);
  const inclina=(rndD()-0.5)*0.12*d;
  function ev(x,y,z,wi){
    const yy=Math.max(0,y); let f=9, mat=0;
    const k=ixH(ys,Math.min(yy,Hh-1e-4)), r=Math.hypot(x,z), th=Math.atan2(z,x), nb=cols[k], a=(th/Math.PI/2+1)*nb, ia=Math.floor(a), fa=a-ia, ib=((ia%nb)+nb)%nb;
    const y0=ys[k], y1=ys[k+1], ed=Math.min(fa,1-fa)*(Math.PI*2*Rm/nb), ey=Math.min(yy-y0,y1-yy), e=Math.min(ed,ey);
    let rel, core=0;
    if(!vv[k][ib]){ rel=shell*(0.7+0.6*n3(x*5,yy*5,z*5,sp.semD)); core=1; } else rel=g0*(1-sm(clamp(e/bev,0,1)))+(tn[k][ib])*M.sal*esc*0.6+(n3(x*7,yy*7,z*7,sp.sem)-0.5)*0.008*esc*(0.5+edad*1.5);
    const dOut=r-(Ro-rel), dIn=(Ri+rel*0.6)-r;
    let top=yy-Hh+(n3(x*5,0.5,z*5,sp.semD)-0.5)*0.06*esc*(0.3+d)+ (d>0.2&&!vv[n-1][ib]?0.18*esc:0);
    f=Math.max(dOut,dIn,top);
    if(wi){ _I.e=e; _I.t=tn[k][ib]; _I.core=core; _I.hz=ey<ed?1:0; _I.hx=ey<ed?0:1; _I.mat=0; _I.vac=(r<Ri*0.98&&yy<0.25*esc)?1:0; }
    if(marco){
      const px=Ro*1.02, ang=inclina;
      const fp=Math.min(cajaR(x+px,yy-ph/2,z,0.07*esc,ph/2,0.07*esc,0.012*esc),cajaR(x-px,yy-ph/2,z,0.07*esc,ph/2,0.07*esc,0.012*esc));
      const fv=cajaR(x,yy-ph+0.05*esc,z,px+0.12*esc,0.06*esc,0.06*esc,0.012*esc);
      let fm=Math.min(fp,fv);
      if(polea){ const fpl=Math.max(Math.hypot(x,yy-(ph-0.22*esc))-0.14*esc,Math.abs(z)-0.03*esc); fm=Math.min(fm,fpl); }
      if(cubeta){ const cy=Hh*0.5+0.3*esc*(rndD()*0), fc=Math.max(Math.hypot(x-0.0,z)-(0.15*esc-0.04*esc*(yy-cy)/(0.35*esc)),Math.abs(yy-cy)-0.17*esc);
        const fcu=Math.max(Math.hypot(x,z)-0.012*esc,Math.abs(yy-(cy+0.25*esc+(ph-0.2*esc-cy-0.25*esc)/2))-(ph-0.2*esc-cy-0.25*esc)/2);
        fm=Math.min(fm,fc,fcu); }
      if(techo){ const rx=Math.abs(x)-px*1.25, ro=(yy-(ph+0.10*esc))+rx*0.0, fz=Math.max(Math.abs(z)-0.62*esc*(1-(yy-ph)/(0.6*esc)),Math.abs(x)-px*1.45,Math.abs(yy-(ph+0.2*esc))-0.18*esc); fm=Math.min(fm,fz); }
      if(fm<f){ f=fm; if(wi){ _I.mat=1; _I.e=9; _I.t=n3(x*3,yy*3,z*3,sp.sem)-0.5; _I.core=0; _I.vac=0; } }
    }
    for(let q=0;q<ESC.length;q++){ const it=ESC[q]; if(Math.abs(x-it.x)>it.br||Math.abs(z-it.z)>it.br) continue; const s=sdEsc(it,x,yy,z); if(s<f){ f=s; if(wi){ _I.mat=0; _I.e=9; _I.t=it.t; _I.core=0; _I.hz=0; _I.hx=0; _I.vac=0; } } }
    return Math.max(f,-y);
  }
  const hh=marco?ph:Hh, sombra=[{x:0,y:Hh/2,z:0,rx:Ro,ry:Hh/2,rz:Ro}]; if(marco){ sombra.push({x:-Ro,y:ph/2,z:0,rx:0.1,ry:ph/2,rz:0.1},{x:Ro,y:ph/2,z:0,rx:0.1,ry:ph/2,rz:0.1}); }
  return {ev,hx:Ro*1.55+1.0*esc,hz:Ro*1.55+0.5*esc,hy:hh+0.35,car:Math.max(1,Ro*2),hmax:hh,sombra,rubble:ESC.length,meta:{Ro,Ri,Hh,marco},radial:true};
}

/* ------------------------------------------------------------------ PIEZAS DE MADERA ----
   Cerca, puerta, ventana y puente comparten un sólido hecho de listones y tablas con veta. */
function tabla(x,y,z,cx,cy,cz,hx,hy,hz,yaw,pitch,r){
  let dx=x-cx, dy=y-cy, dz=z-cz;
  if(yaw){ const c=Math.cos(yaw), s=Math.sin(yaw), ax=dx*c+dz*s; dz=-dx*s+dz*c; dx=ax; }
  if(pitch){ const c=Math.cos(pitch), s=Math.sin(pitch), ay=dy*c-dx*s; dx=dy*s+dx*c; dy=ay; }
  return cajaR(dx,dy,dz,hx,hy,hz,r);
}
function bMadera(sp,M,rnd,rndD,tipo){
  const esc=sp.escala, L=sp.largo*esc, Hh=sp.alto*esc, T=sp.grosor*esc, d=sp.deterioro, edad=sp.edad;
  const partes=[], r=0.012*esc;
  const add=(o)=>partes.push(o);
  let hx=L/2+0.4, hz=T/2+0.3, hy=Hh+0.2, car=Math.max(1,Hh), ESC=[];
  if(tipo==='cercaMadera'){
    const nP=Math.max(2,Math.round(L/(1.5*esc))+1), sp_=L/(nP-1), pw=0.07*esc;
    for(let i=0;i<nP;i++){ const falta=d>0.2&&rndD()<d*0.25&&i>0&&i<nP-1, lean=(rndD()-0.5)*0.55*d*(i>0?1:0.4), hh=Hh*(falta?lerp(0.15,0.4,rndD()):1-(rndD()<d*0.45?rndD()*0.35:0));
      add({k:'poste',x:-L/2+i*sp_,hh,pw,lean,t:rnd()-0.5}); }
    const nR=sp.rieles||2;
    for(let q=0;q<nR;q++){ const yR=Hh*(nR===1?0.7:0.36+0.40*q/(nR-1)); for(let i=0;i<nP-1;i++){ const rot=d>0.2&&rndD()<d*0.45, ausente=d>0.15&&rndD()<d*0.30;
      if(ausente) continue; const x0=-L/2+i*sp_, ln=sp_*(rot?lerp(0.45,0.8,rndD()):1), pitch=rot?(rndD()-0.5)*0.9*d:(rndD()-0.5)*0.04*d;
      add({k:'riel',x:x0+ln/2+(rot?(rndD()-0.3)*sp_*0.15:0),y:yR-(rot?rndD()*0.3*Hh:0),hl:ln/2,hh:0.04*esc,hd:0.025*esc,pitch,t:rnd()-0.5}); } }
    hx=L/2+0.4; hz=0.5*esc; hy=Hh+0.2;
    if(d>0.25) for(let i=0;i<Math.round(d*3);i++){ ESC.push(escombro({x:(rndD()-0.5)*L,z:0.1*esc+rndD()*0.5*esc,yaw:rndD()*3.14,hx:0.45*esc*lerp(0.6,1.0,rndD()),hy:0.03*esc,hz:0.04*esc,r:0.01*esc,y:0.04*esc,t:rndD()-0.5})); }
  } else if(tipo==='puerta'||tipo==='ventana'){
    const fw=0.11*esc, hw=L/2, hh=Hh/2, ts=T/2, nT=Math.max(3,Math.round(L/(0.16*esc)));
    add({k:'jamba',x:-hw+fw/2,y:hh,hx:fw/2,hy:hh,hz:ts*1.2,t:0.1}); add({k:'jamba',x:hw-fw/2,y:hh,hx:fw/2,hy:hh,hz:ts*1.2,t:-0.1}); add({k:'dintel',x:0,y:Hh-fw/2,hx:hw,hy:fw/2,hz:ts*1.2,t:0.0});
    if(tipo==='puerta'){ const ab=sp.hoja==null?0.4:sp.hoja;
      for(let i=0;i<nT;i++){ const ph_=H4(i,sp.semD,6,1); if(ph_<d*0.55*(i%2?1:0.7)&&d>0.15) continue; const x=-hw+fw+(i+0.5)*(L-2*fw)/nT, w=(L-2*fw)/nT/2*0.94, brk=ph_>1-d*0.35?lerp(0.4,0.8,rndD()):1;
        add({k:'tablon',x:x*Math.cos(ab*0.9),y:(Hh-fw)/2*brk-(brk<1?0:0)+0.0,hx:w*Math.cos(ab*0.9)+0.001,hy:(Hh-fw)/2*brk,hz:ts*0.7,z:Math.sin(ab*0.9)*(x+hw),yaw:ab*0.9,t:rnd()-0.5}); }
      add({k:'travesano',x:0,y:Hh*0.28,hx:hw-fw,hy:0.05*esc,hz:ts*1.0,t:0.2}); add({k:'travesano',x:0,y:Hh*0.72,hx:hw-fw,hy:0.05*esc,hz:ts*1.0,t:-0.2});
    } else { add({k:'travesano',x:0,y:Hh/2,hx:hw-fw,hy:0.03*esc,hz:ts*0.9,t:0.2}); add({k:'jamba',x:0,y:Hh/2,hx:0.03*esc,hy:hh-fw,hz:ts*0.9,t:0.0});
      add({k:'dintel',x:0,y:fw/2,hx:hw,hy:fw/2,hz:ts*1.5,t:0.1}); }
    hx=hw+0.5; hz=ts+Math.sin((sp.hoja||0.4)*0.9)*L+0.3; hy=Hh+0.2;
  } else if(tipo==='puente'){
    const nT=Math.max(6,Math.round(L/(0.36*esc))), ancho=T/2, tw=L/nT/2*0.9;
    for(let i=0;i<nT;i++){ const falta=d>0.1&&rndD()<d*0.38*(0.5+0.8*Math.sin(Math.PI*(i+0.5)/nT)), roto=!falta&&d>0.1&&rndD()<d*0.28;
      if(falta) continue; add({k:'tabla',x:-L/2+(i+0.5)*L/nT,y:Hh,hx:tw,hy:0.035*esc,hz:ancho*(roto?lerp(0.4,0.9,rndD()):1),z:roto?(rndD()-0.5)*ancho*0.6:0,yaw:0,pitch:roto?(rndD()-0.5)*0.35:0,hunde:Math.sin(Math.PI*(i+0.5)/nT)*0.12*d*esc,t:rnd()-0.5}); }
    for(const s of [-1,1]){ add({k:'viga',x:0,y:Hh-0.10*esc,z:s*ancho*0.7,hx:L/2,hy:0.07*esc,hz:0.06*esc,t:0.1});
      const nPo=Math.max(2,Math.round(L/(1.3*esc))+1); for(let i=0;i<nPo;i++){ if(d>0.2&&rndD()<d*0.35) continue; const x=-L/2+0.08*esc+i*(L-0.16*esc)/(nPo-1);
        add({k:'poste',x,z:s*ancho*0.92,hh:Hh*0.9*(1+0.0)+0.4*esc*0,pw:0.05*esc,lean:(rndD()-0.5)*0.4*d,t:rnd()-0.5,yb:Hh*0.0,alto:0.8*esc}); }
      for(let i=0;i<nPo-1;i++){ if(d>0.1&&rndD()<d*0.5) continue; add({k:'barandal',x:-L/2+(i+0.5)*L/(nPo-1),y:Hh+0.62*esc,z:s*ancho*0.92,hl:L/(nPo-1)/2,t:0.1}); } }
    hx=L/2+1.0*esc; hz=ancho+0.4*esc; hy=Hh+1.1*esc;
    /* estribos de piedra en las dos puntas */
    for(const s of [-1,1]) add({k:'estribo',x:s*(L/2+0.45*esc),y:(Hh+0.05*esc)/2-0.1*esc,hx:0.55*esc,hy:(Hh+0.10*esc)/2,hz:ancho+0.2*esc,t:rnd()-0.5});
    if(d>0.3) for(let i=0;i<Math.round(d*4);i++) ESC.push(escombro({x:(rndD()-0.5)*L*0.8,z:(rndD()<0.5?-1:1)*(ancho+0.5*esc+rndD()*0.8*esc),yaw:rndD()*3.14,hx:0.45*esc*lerp(0.6,1,rndD()),hy:0.035*esc,hz:0.09*esc,r:0.01*esc,y:0.05*esc,t:rndD()-0.5}));
  }
  function ev(x,y,z,wi){
    const yy=Math.max(0,y); let f=9, mat=1, t=0, e=9;
    for(let q=0;q<partes.length;q++){ const p=partes[q]; let dd;
      switch(p.k){
        case 'poste': { const yb=p.yb||0, hh=(p.alto||p.hh); dd=tabla(x,yy,z,p.x+(p.lean?p.lean*0:0),yb+hh/2,(p.z||0),p.pw||0.05*esc,hh/2,p.pw||0.05*esc,0,p.lean||0,r); if(p.lean){ dd=Math.max(dd,-1); } break; }
        case 'riel': dd=tabla(x,yy,z,p.x,p.y,0.06*esc,p.hl,p.hh,p.hd,0,p.pitch,r); break;
        case 'tablon': dd=tabla(x,yy,z,p.x,p.y,p.z||0,p.hx,p.hy,p.hz,p.yaw||0,0,r); break;
        case 'tabla': dd=tabla(x,yy-(p.hunde||0),z,p.x,p.y,p.z||0,p.hx,p.hy,p.hz,p.yaw||0,p.pitch||0,r); break;
        case 'viga': dd=cajaR(x-p.x,yy-p.y,z-p.z,p.hx,p.hy,p.hz,r); break;
        case 'barandal': dd=cajaR(x-p.x,yy-p.y,z-p.z,p.hl,0.03*esc,0.03*esc,r); break;
        case 'estribo': dd=cajaR(x-p.x,yy-p.y,z,p.hx,p.hy,p.hz,0.03*esc); break;
        default: dd=cajaR(x-p.x,yy-p.y,z-(p.z||0),p.hx,p.hy,p.hz,r);
      }
      if(dd<f){ f=dd; if(wi){ t=p.t||0; mat=p.k==='estribo'?0:1; e=9; } }
    }
    for(let q=0;q<ESC.length;q++){ const it=ESC[q]; if(Math.abs(x-it.x)>it.br||Math.abs(z-it.z)>it.br) continue; const s=sdEsc(it,x,yy,z); if(s<f){ f=s; if(wi){ mat=1; t=it.t; e=9; } } }
    if(wi){ _I.mat=mat; _I.t=t; _I.e=e; _I.core=0; _I.hz=0; _I.hx=0; _I.vac=0; }
    return Math.max(f,-y);
  }
  const sombra=[]; if(tipo==='cercaMadera'||tipo==='puente'){ const ns=Math.max(2,Math.round(L/1.4)); for(let i=0;i<ns;i++) sombra.push({x:-L/2+(i+0.5)*L/ns,y:Hh*0.5,z:0,rx:L/ns*0.5,ry:Hh*0.5,rz:0.12}); } else sombra.push({x:0,y:Hh/2,z:0,rx:L*0.5,ry:Hh*0.5,rz:0.14});
  return {ev,hx,hz,hy,car,hmax:Hh,sombra,rubble:ESC.length,meta:{partes:partes.length},madera:true};
}

/* ------------------------------------------------------------------ SPEC Y SÓLIDO ---- */
function limpiar(s){
  s=s||{}; const tipo=s.tipo||'muro', T=TIPOS[tipo]; if(!T) throw new Error('tipo de estructura desconocido: '+tipo);
  const mat=s.mat||T.mat; if(!MATERIALES[mat]) throw new Error('material desconocido: '+mat);
  const sem=(s.sem==null?1:s.sem)|0;
  const o={tipo,mat,sem,semD:(s.semD==null?(sem*2654435761+97)>>>0&0x7fffffff:s.semD)|0,semV:(s.semV==null?(sem*40503+11)&0x7fffffff:s.semV)|0,
    escala:clamp(s.escala==null?1:+s.escala,0.4,2.5),yaw:+(s.yaw||0),inclinacion:clamp(+(s.inclinacion||0),-0.35,0.35),
    largo:clamp(s.largo==null?T.largo:+s.largo,0.4,24),alto:clamp(s.alto==null?T.alto:+s.alto,0.3,9),grosor:clamp(s.grosor==null?T.grosor:+s.grosor,0.08,8),
    edad:clamp(s.edad==null?0.45:+s.edad,0,1),deterioro:clamp(s.deterioro==null?(T.det==null?0:T.det):+s.deterioro,0,1),
    tono:clamp(+(s.tono||0),-1,1),lum:clamp(+(s.lum||0),-0.6,0.6),sat:clamp(s.sat==null?1:+s.sat,0,2),
    estado:Object.assign({},ESTADO0,s.estado)};
  for(const k of Object.keys(o.estado)) o.estado[k]=clamp(+o.estado[k]||0,0,1);
  for(const k of ['huecos','afilado','hoja','flautas','marco','techo','polea','cubeta','matB','rieles','boca']) if(s[k]!==undefined) o[k]=s[k];
  return o;
}
/* qué campos cambian el SÓLIDO (y por lo tanto rehacen los rayos) y cuáles sólo el pintado */
const CLAVE_FORMA=['tipo','mat','sem','semD','escala','yaw','inclinacion','largo','alto','grosor','edad','deterioro','huecos','afilado','hoja','flautas','marco','techo','polea','cubeta','matB','rieles','boca'];
const claveForma=sp=>{ let k=''; for(const c of CLAVE_FORMA) k+=(sp[c]===undefined?'':JSON.stringify(sp[c]))+'|'; return k+(sp.estado.enterrada||0); };
const CACHE_G=new Map(); const ESTAD={solidos:0,aciertos:0,rasters:0,pintados:0};
function construirG(sp){
  const M=MATERIALES[sp.mat], T=TIPOS[sp.tipo], b=baseDe(sp.tipo);
  const rnd=NV.mulberry((sp.sem*7919+TIPOS_ID.indexOf(sp.tipo)*104729+MATS.indexOf(sp.mat)*15485863)|0);
  const rndD=NV.mulberry((sp.semD*6151+TIPOS_ID.indexOf(sp.tipo)*7727+17)|0);
  let C;
  if(b==='muro'){
    const s2=Object.assign({},sp);
    if(sp.tipo==='pilar'){ s2.huecos=[]; }
    else if(sp.tipo==='arco'){ const L=sp.largo, ph=Math.min(sp.alto*0.55,1.9), r=Math.min((L-2*0.9)/2,L*0.3); s2.huecos=[{x0:-r,x1:r,y0:0,y1:ph+r,tipo:'arco',marco:false}]; }
    else if(sp.tipo==='chimenea'){ s2.afilado=sp.afilado==null?0.28:sp.afilado; s2.huecos=[{x0:-sp.largo*0.22,x1:sp.largo*0.22,y0:0,y1:sp.alto*0.28,tipo:'hogar',marco:false}]; }
    else if(sp.tipo==='muro'||sp.tipo==='muroLadrillo'||sp.tipo==='paredCaida'){ if(!sp.huecos) s2.huecos=[]; }
    C=bMuro(s2,M,rnd,rndD);
  } else if(b==='columna') C=bColumna(sp,M,rnd,rndD);
  else if(b==='escalera') C=bEscalera(sp,M,rnd,rndD);
  else if(b==='pozo') C=bPozo(sp,M,rnd,rndD);
  else C=bMadera(sp,M,rnd,rndD,b);
  const esc=sp.escala, yaw=sp.yaw, cy=Math.cos(yaw), sy=Math.sin(yaw), lean=sp.inclinacion, sink=(sp.estado.enterrada*0.34+sp.edad*0.03)*Math.min(1,C.hmax)*(b==='pozo'||b==='muro'?1:0.8);
  const ev=C.ev, radial=!!C.radial;
  const sdf=(U,v,Z)=>{ const x0=U*cy+Z*sy, z=-U*sy+Z*cy, y=v+sink, x=x0-lean*y; return Math.max(ev(x,y,z,false),-v); };
  const info=(U,v,Z)=>{ const x0=U*cy+Z*sy, z=-U*sy+Z*cy, y=v+sink, x=x0-lean*y; ev(x,y,z,true); return _I; };
  const ex=Math.abs(cy)*C.hx+Math.abs(sy)*C.hz+Math.abs(lean)*C.hy, ez=Math.abs(sy)*C.hx+Math.abs(cy)*C.hz, hy=Math.max(0.3,C.hy-sink+0.1);
  const cuerpos=C.sombra.map(s=>({e:s.x*cy-s.z*sy*(-1)*0+s.x*0+(s.x*cy+s.z*(-sy)),h:s.y-sink,s:s.x*sy+s.z*cy,re:Math.max(0.12,Math.abs(cy)*s.rx+Math.abs(sy)*s.rz),rh:s.ry,rs:Math.max(0.12,Math.abs(sy)*s.rx+Math.abs(cy)*s.rz),f:0.9}));
  ESTAD.solidos++;
  return {sdf,info,box:{umin:-ex,umax:ex,vmin:-0.05,vmax:hy,zmin:-ez,zmax:ez},car:C.car,hmax:Math.max(0.3,C.hmax-sink),paso:0.5,cuerpos,rubble:C.rubble,meta:C.meta,
    madera:!!C.madera,radial,sink,nombre:T.nombre+' · '+M.nombre,r:{},base:b};
}
function crear(spec){
  const sp=limpiar(spec), k=claveForma(sp);
  let G=CACHE_G.get(k);
  if(G) ESTAD.aciertos++; else { G=construirG(sp); if(CACHE_G.size>40) CACHE_G.clear(); CACHE_G.set(k,G); }
  return {tipo:sp.tipo,spec:sp,M:MATERIALES[sp.mat],g:G,sdf:G.sdf,box:G.box,nombre:G.nombre,hmax:G.hmax,car:G.car,_sh:{}};
}

/* ------------------------------------------------------------------ EDICIÓN ----
   editar() cambia sólo lo pedido y devuelve qué capa se tocó (forma, deterioro o pintado). regenerar() sortea una sola parte:
   'forma' (los bloques), 'deterioro' (cuáles faltan y qué cae), 'vegetacion' (musgo, líquen, hojas, enredadera). */
const CAMPOS_DETERIORO=['deterioro','semD'], CAMPOS_PINTADO=['tono','lum','sat','estado','semV'];
function editar(spec,cambios){
  const sp=limpiar(spec), out=Object.assign({},sp); let forma=false, danio=false, pintado=false;
  for(const k of Object.keys(cambios||{})){
    if(k==='estado'){ out.estado=Object.assign({},sp.estado,cambios.estado); if('enterrada' in cambios.estado) forma=true; if(Object.keys(cambios.estado).some(q=>q!=='enterrada')) pintado=true; }
    else { out[k]=cambios[k]; if(CAMPOS_PINTADO.indexOf(k)>=0) pintado=true; else if(CAMPOS_DETERIORO.indexOf(k)>=0) danio=true; else forma=true; }
  }
  return {spec:limpiar(out),tocado:{forma,deterioro:danio,pintado}};
}
function regenerar(spec,parte){
  const sp=limpiar(spec), o=Object.assign({},sp), n=((Math.random()*1e6)|0)+1+((NV.azarEditor?NV.azarEditor()*1e6:0)|0);
  if(parte==='forma') o.sem=n; else if(parte==='deterioro') o.semD=n; else if(parte==='vegetacion') o.semV=n; else if(parte==='todo'){ o.sem=n; o.semD=n+7; o.semV=n+13; } else throw new Error('parte desconocida: '+parte);
  return limpiar(o);
}
/* EL GENERADOR vs EL RESULTADO. La plantilla de un tipo son cambios sobre sus valores por omisión (por ejemplo "todos los pozos
   futuros con marco y más viejos"). Sólo la leen nuevo() y variar(): lo que ya está colocado es una spec completa y no la mira. */
const PLANTILLA={};
function plantilla(tipo,cambios){
  if(!TIPOS[tipo]) throw new Error('tipo de estructura desconocido: '+tipo);
  if(cambios===null) delete PLANTILLA[tipo]; else if(cambios) PLANTILLA[tipo]=Object.assign({},PLANTILLA[tipo]||{},cambios);
  return Object.assign({},PLANTILLA[tipo]||{});
}
const azarS=()=>(((NV.azarEditor||Math.random)()*1e6)|0)+1;
function nuevo(tipo,sem){ if(!TIPOS[tipo]) throw new Error('tipo de estructura desconocido: '+tipo);
  const p=PLANTILLA[tipo]||{}; return limpiar(Object.assign({tipo,sem:sem==null?azarS():sem},p,{estado:Object.assign({},p.estado)})); }
/* otra variante real de lo mismo: mismas medidas, edad, deterioro y estado; otra forma y otros daños */
function variar(spec){ const sp=limpiar(spec), n=azarS(); return limpiar(Object.assign({},sp,{sem:n,semD:n+7,semV:sp.semV})); }
/* un objeto del mundo (el mismo formato que los demás motores: dato puro + casilla) y de vuelta */
function aObjeto(spec){ const sp=limpiar(spec); return {k:'estructura',e:JSON.parse(JSON.stringify(sp)),h:+Math.max(0.3,sp.alto*sp.escala).toFixed(2),s:sp.sem}; }
function deObjeto(o){ if(!o||o.k!=='estructura'||!o.e) throw new Error('no es una estructura'); return limpiar(o.e); }

/* ------------------------------------------------------------------ RASTER ---- */
const LK=l=>{ const q=(v,k)=>Math.round((v||0)/k); return [q(l.L.x,0.03),q(l.L.y,0.03),q(l.L.z,0.03),q(l.amb,0.04),q(l.r,0.05),q(l.g,0.05),q(l.b,0.05),q(l.porMetro,0.05)].join(','); };
function rasterCaja(S,u0,cols,R0,rows,opt){
  const CPM=opt.CPM, HPM=opt.HPM, RPM=opt.RPM, phi=Math.atan2(RPM,HPM), cphi=Math.cos(phi), sphi=Math.sin(phi), K=HPM/cphi;
  const n=cols*rows, HU=new Float32Array(n), HV=new Float32Array(n), HZ=new Float32Array(n), hit=new Uint8Array(n);
  const B=S.box, eps=0.30/CPM, minStep=0.10/CPM, sdf=S.sdf, paso=S.paso, maxIt=opt.det>=2?72:48;
  for(let r=0;r<rows;r++){
    const Y=(R0-r+0.5)/K;
    let t0=-1e9,t1=1e9;
    t0=Math.max(t0,(-Y*sphi-B.zmax)/cphi); t1=Math.min(t1,(-Y*sphi-B.zmin)/cphi);
    t0=Math.max(t0,(Y*cphi-B.vmax)/sphi); t1=Math.min(t1,(Y*cphi-B.vmin)/sphi);
    if(t0>=t1) continue;
    for(let c=0;c<cols;c++){
      const U=u0+(c+0.5)/CPM; if(U<B.umin||U>B.umax) continue;
      let t=t0;
      for(let it=0;it<maxIt;it++){
        const v=Y*cphi-t*sphi, z=-Y*sphi-t*cphi, f=sdf(U,v,z);
        if(f<eps){ const i=r*cols+c; hit[i]=1; HU[i]=U; HV[i]=v; HZ[i]=z; break; }
        t+=Math.max(f*paso,minStep); if(t>t1) break;
      }
    }
  }
  return {HU,HV,HZ,hit,cphi,sphi,K};
}
/* los rayos se calculan una vez por resolución; el pintado se rehace aparte cuando cambia el aspecto o la luz */
function geometria(S,CPM,HPM,RPM,det){
  const g=S.g, key=CPM+'|'+HPM+'|'+RPM+'|'+det;
  if(g.r[key]) return g.r[key];
  const phi=Math.atan2(RPM,HPM), cphi=Math.cos(phi), sphi=Math.sin(phi), K=HPM/cphi, B=g.box, pad=3;
  const Ytop=B.vmax*cphi+B.zmax*sphi, Ybot=-B.zmax*sphi;
  const cols=Math.ceil((B.umax-B.umin)*CPM)+pad*2+4, c0=Math.round(-B.umin*CPM)+pad+2, u0=-(c0)/CPM;
  const R0=Math.ceil(Ytop*K)+pad, rows=R0+Math.ceil(-Ybot*K)+pad+2;
  const rc=rasterCaja({box:B,sdf:g.sdf,paso:g.paso},u0,cols,R0,rows,{CPM,HPM,RPM,det});
  const out={cols,rows,c0,R0,u0,HU:rc.HU,HV:rc.HV,HZ:rc.HZ,hit:rc.hit,K,cphi,sphi,CPM,HPM,RPM,det};
  if(Object.keys(g.r).length>6) for(const k of Object.keys(g.r)) delete g.r[k];
  g.r[key]=out; ESTAD.rasters++; return out;
}
function claveAspecto(sp){ const e=sp.estado; return [sp.tono,sp.lum,sp.sat,sp.semV,sp.edad,sp.deterioro,e.musgo,e.liquen,e.humedad,e.vegetacion,e.tierra,e.hojas,e.quemadura,e.enterrada,sp.mat].join(','); }
function sombrear(S,R,luz,det){
  const g=S.g, sp=S.spec, M=S.M, st=sp.estado, n=R.cols*R.rows, cols=R.cols, rows=R.rows, sdf=g.sdf, info=g.info, sem=sp.semV|0, semF=sp.sem|0;
  const Ls=luz.L, ly=Ls.y*0.35+0.50, ln=Math.hypot(Ls.x,ly,Ls.z)||1, Lr=[Ls.x/ln,Ls.z/ln,ly/ln], Lt=[Ls.x,Ls.z,Ls.y];
  const G=new Uint8Array(n), C=new Int32Array(n), TY=new Uint8Array(n), NU=new Float32Array(n), NV_=new Float32Array(n), NZ=new Float32Array(n), LU=new Float32Array(n);
  const eps=0.5/R.CPM, car=g.car, hAO=clamp(car*0.10,0.05,0.30), hmax=g.hmax, ambF=clamp(luz.amb==null?1:luz.amb,0.45,1.3);
  const Md=MATERIALES.madera, ft=(luz.r||1)*ambF, fg=(luz.g||1)*ambF, fb=(luz.b||1)*ambF, edad=sp.edad;
  const cphi=R.cphi, sphi=R.sphi;
  for(let i=0;i<n;i++){
    if(!R.hit[i]) continue;
    const u=R.HU[i], v=R.HV[i], z=R.HZ[i], cc=i%cols, rr=(i/cols)|0;
    let nu=sdf(u+eps,v,z)-sdf(u-eps,v,z), nv=sdf(u,v+eps,z)-sdf(u,v-eps,z), nz=sdf(u,v,z+eps)-sdf(u,v,z-eps);
    const nl=Math.hypot(nu,nv,nz)||1; nu/=nl; nv/=nl; nz/=nl; NU[i]=nu; NV_[i]=nv; NZ[i]=nz;
    const lam=Math.max(0,nu*Lr[0]+nv*Lr[1]+nz*Lr[2]);
    let lum=0.34+0.92*lam+0.10*Math.max(0,nz);
    if(det>=1){
      let sh=1, t=0.05*car+eps*2;
      for(let k=0;k<(det>=2?7:4);k++){ const d=sdf(u+Lt[0]*t+nu*eps,v+Lt[1]*t+nv*eps,z+Lt[2]*t+nz*eps); if(d<0.002){ sh=0; break; } sh=Math.min(sh,clamp(5*d/t,0,1)); t+=clamp(d,0.04*car,0.28*car); if(v+Lt[1]*t>hmax*1.5) break; }
      const ao=1-0.85*clamp((hAO-sdf(u+nu*hAO,v+nv*hAO,z+nz*hAO))/hAO,0,1)*0.7-0.5*clamp((2.2*hAO-sdf(u+nu*hAO*2.2,v+nv*hAO*2.2,z+nz*hAO*2.2))/(2.2*hAO),0,1)*0.3;
      lum=lum*(1-0.40+0.40*sh)*clamp(1-(1-ao)*0.8,0.30,1); LU[i]=lam*(0.4+0.6*sh);
    } else LU[i]=lam;
    lum*=0.66+0.34*sm(v/(0.18*Math.min(Math.max(0.5,hmax),3)+0.06));
    const I=info(u,v,z), hh=H4(cc,rr,semF,2), hq=H4((u*60)|0,(v*60)|0,(z*60)|0,semF);
    const Mt=I.mat===1?Md:M;
    let t0=clamp(0.10+lum*0.72,0,1)+(I.t)*Mt.tono*0.30+(hh-0.5)*Mt.grano*0.30, glyph, r, gg, bb, ty=1;
    if(I.vac){ glyph=hh<0.5?'.':':'; r=10; gg=12; bb=14; ty=6; }
    else if(I.core){ const cc2=pal(PAL_NUCLEO,clamp(lum*0.9+(hh-0.5)*0.4,0,1)); r=cc2[0]; gg=cc2[1]; bb=cc2[2]; glyph=NUC_G[((hh*4)|0)%4]; ty=7; }
    else {
      const ramp=Mt.ramp, nR=ramp.length;
      glyph=ramp[clamp(Math.floor(t0*nR),0,nR-1)];
      const cc2=pal(Mt.pal,clamp(t0,0,1)); r=cc2[0]; gg=cc2[1]; bb=cc2[2];
      /* madera: la veta corre a lo largo de la pieza */
      if(I.mat===1){ const vt=frac((u*9+z*7)*0.7+H4((u*3)|0,(z*3)|0,semF,9)); if(vt<0.22&&lum>0.2){ glyph='|'; r*=0.62; gg*=0.60; bb*=0.58; } }
      /* juntas de los bloques */
      else if(I.e<Mt.bev*0.62*sp.escala&&I.e>-1&&I.e<9){
        const horiz=I.hz?1:0; glyph=horiz?'-':'|'; const jc=Mt.junta, k=clamp(0.5+lum*0.5,0.3,1.1);
        const fade=edad*0.6; r=lerp(jc[0],r*0.4,fade)*k; gg=lerp(jc[1],gg*0.4,fade)*k; bb=lerp(jc[2],bb*0.4,fade)*k; ty=2;
        if(hh<edad*0.55) glyph=horiz?'_':'.';
      }
    }
    /* edad: lavado y oscurecimiento parejo */
    if(edad>0){ const gr=(r+gg+bb)/3; const k=0.34*edad; r=lerp(r,gr*0.92,k); gg=lerp(gg,gr*0.92,k); bb=lerp(bb,gr*0.9,k); const m=1-0.14*edad; r*=m; gg*=m; bb*=m; }
    if(sp.tono){ r*=1+0.18*sp.tono; bb*=1-0.18*sp.tono; }
    if(sp.lum){ const m=1+sp.lum; r*=m; gg*=m; bb*=m; }
    if(sp.sat!==1){ const gr=(r+gg+bb)/3; r=gr+(r-gr)*sp.sat; gg=gr+(gg-gr)*sp.sat; bb=gr+(bb-gr)*sp.sat; }
    /* quemadura: tizne arriba de los huecos y manchas al azar */
    if(st.quemadura>0){ const q=st.quemadura*(0.35+0.65*fbm(u*1.6,v*1.1,z*1.6,sem+81,2)); if(hh<q*0.9){ const k=1-0.78*q; r*=k; gg*=k; bb*=k*1.02; if(q>0.55&&hq<0.25) glyph=':'; } }
    /* humedad: sube desde abajo y se filtra por vetas */
    if(st.humedad>0&&!I.vac){ const wl=0.10+0.9*st.humedad, sc=(wl*Math.max(0.6,hmax)-v)/(0.15*Math.max(0.6,hmax)+0.02)+(fbm(u*1.8,v*0.6,z*1.8,sem+61,2)-0.5)*1.4, w=clamp(sc,0,1); if(w>0&&hh<w+0.1){ r*=lerp(1,0.55,w); gg*=lerp(1,0.62,w); bb*=lerp(1,0.72,w); } }
    /* musgo: donde el lugar ya es húmedo y protegido */
    let esVerde=0;
    if(st.musgo>0&&!I.vac&&I.mat!==1){
      const mo=fbm(u*1.6,v*1.2,z*1.6,sem+71,3), baseW=1-clamp(v/(0.55*Math.min(Math.max(hmax,0.8),3)+0.05),0,1), sombra=1-clamp(LU[i]*1.4,0,1), junta=(I.e<Mt.bev*1.4*sp.escala?0.30:0);
      let score=mo*0.55+baseW*0.35+sombra*0.22+junta+(nv>0.4?0.20:0)+(I.core?0.15:0)-0.30; score*=0.35+st.musgo*1.3;
      const pr=sm((score-0.16)/0.30);
      if(hq<pr||H4(cc,rr,sem,9)<pr*0.9){ glyph=MUSGO_G[((hh*4)|0)%4]; const mc=pal(PAL_MUSGO,clamp(lum*0.8+(hh-0.5)*0.3,0,1)); r=mc[0]; gg=mc[1]; bb=mc[2]; esVerde=1; ty=3; }
    }
    /* líquen: manchas redondas en lo asoleado */
    if(st.liquen>0&&!esVerde&&!I.vac&&LU[i]>0.18&&I.mat!==1){
      const gs=0.16, su=(u+z*0.6)/gs, sv=v/gs, iu=Math.floor(su), iv=Math.floor(sv); let best=9, bi=0;
      for(let a=-1;a<=1;a++) for(let b=-1;b<=1;b++){ const cu=iu+a+H4(iu+a,iv+b,sem,3), cvv=iv+b+H4(iu+a,iv+b,sem,4), dd=Math.hypot(su-cu,sv-cvv)/(0.28+0.22*H4(iu+a,iv+b,sem,5)); if(dd<best&&H4(iu+a,iv+b,sem,6)<st.liquen*0.75){ best=dd; bi=H4(iu+a,iv+b,sem,7); } }
      if(best<1&&(best<0.7||hq<0.5)){ const lc=LIQ_COL[(bi*3)|0]; glyph=LIQ_G[((hh*3)|0)%3]; const k=clamp(lum,0.35,1.15); r=lc[0]*k; gg=lc[1]*k; bb=lc[2]*k; ty=4; esVerde=1; }
    }
    /* vegetación invasora: enredadera que sube desde el pie, más espesa abajo, y matas en las cornisas */
    if(st.vegetacion>0&&!esVerde&&!I.vac){
      const alt=clamp(v/Math.max(0.8,hmax),0,1), sube=1-alt*(1-0.55*st.vegetacion), hebra=fbm(u*2.2,v*0.55,z*2.2,sem+91,3), score=(hebra-0.5)*1.4+st.vegetacion*1.3-0.55-alt*0.8+(nv>0.5?0.18:0)+(I.core?0.12:0);
      const pr=sm(score/0.5)*sube;
      if(H4(cc,rr,sem,11)<pr){ glyph=VEG_G[((hh*5)|0)%5]; const vc=pal(PAL_VEG,clamp(lum*0.9+(hh-0.5)*0.4,0,1)); r=vc[0]; gg=vc[1]; bb=vc[2]; ty=8; esVerde=1; }
    }
    /* hojas: sobre lo que mira al cielo y al pie */
    if(st.hojas>0&&!esVerde&&!I.vac&&(nv>0.55||v<0.12)&&H4(cc,rr,sem,13)<st.hojas*(nv>0.55?0.55:0.30)){ glyph=HOJA_G[((hh*4)|0)%4]; const hc=pal(PAL_HOJA,clamp(lum*0.8+(hh-0.5)*0.5,0,1)); r=hc[0]; gg=hc[1]; bb=hc[2]; ty=9; }
    G[i]=glyph.charCodeAt(0); C[i]=pack(r*ft,gg*fg,bb*fb); TY[i]=ty;
  }
  /* aristas: los saltos de normal entre celdas vecinas se leen con el glifo de su dirección */
  if(det>=1){
    for(let rr=0;rr<rows-1;rr++) for(let c=0;c<cols-1;c++){
      const i=rr*cols+c; if(!R.hit[i]||TY[i]!==1) continue;
      const jr=R.hit[i+1]?i+1:-1, jd=R.hit[i+cols]?i+cols:-1; let gl=0, mul=1;
      if(jr>=0){ const d=NU[i]*NU[jr]+NV_[i]*NV_[jr]+NZ[i]*NZ[jr]; if(d<0.88){ gl=(NU[jr]-NU[i]>0)?'/':'\\'; gl=(Math.abs(NV_[jr]-NV_[i])<0.2)?'|':gl; mul=(LU[jr]>LU[i])?0.80:1.24; } }
      if(!gl&&jd>=0){ const d=NU[i]*NU[jd]+NV_[i]*NV_[jd]+NZ[i]*NZ[jd]; if(d<0.88){ gl=(Math.abs(NU[jd]-NU[i])<0.25)?'_':((NU[jd]-NU[i]>0)?'\\':'/'); mul=(LU[jd]>LU[i])?0.82:1.22; } }
      if(gl){ G[i]=gl.charCodeAt(0); const v=C[i]; C[i]=pack(((v>>16)&255)*mul,((v>>8)&255)*mul,(v&255)*mul); }
    }
  }
  return {G,C,TY};
}
/* el pintado de una estructura: sombrea (cacheado por luz y aspecto), mezcla el pie con la tierra y pone el contorno */
function cuadroDe(S,CPM,HPM,RPM,luz,det,contorno,pasto){
  const R=geometria(S,CPM,HPM,RPM,det), sp=S.spec, key=LK(luz)+'|'+claveAspecto(sp)+'|'+det+'|'+(contorno?1:0)+'|'+(pasto||0)+'|'+CPM+'|'+HPM+'|'+RPM;
  const c=S._sh; if(c.key===key) return {R,F:c.F};
  const sh=sombrear(S,R,luz,det), {cols,rows}=R, G=sh.G.slice(), C=sh.C.slice(), st=sp.estado, sem=sp.semV|0;
  const bury=st.enterrada, hm=Math.max(0.5,S.g.hmax), lim0=(0.04+0.30*bury+0.30*st.tierra)*Math.min(hm,2.5);
  for(let r=0;r<rows;r++) for(let cc=0;cc<cols;cc++){
    const i=r*cols+cc; if(!R.hit[i]) continue; const v=R.HV[i], lim=lim0*(0.7+0.6*H4(cc>>1,0,sem,23));
    if(v<lim&&H4(cc,r,sem,24)<sm(1-v/lim)*0.95){ const sc=pal(PAL_SUELO,0.35+0.5*H4(cc,r,sem,25)); G[i]=SUELO_G[(H4(cc,r,sem,26)*4)|0].charCodeAt(0); C[i]=pack(sc[0],sc[1],sc[2]); sh.TY[i]=5; }
  }
  /* tierra acumulada en el suelo al pie: celdas de suelo junto a lo sólido */
  if(st.tierra>0||bury>0){
    const collar=0.14+0.5*st.tierra+0.3*bury, rowsF=Math.ceil(collar*R.sphi*R.K)+2;
    for(let r=0;r<rows;r++){
      const Y=(R.R0-r+0.5)/R.K; if(Y>0.05) continue; const zs=-Y/R.sphi;
      for(let cc=0;cc<cols;cc++){
        const i=r*cols+cc; if(R.hit[i]) continue; const u=R.u0+(cc+0.5)/CPM; if(u<S.g.box.umin-collar||u>S.g.box.umax+collar) continue;
        const d=S.g.sdf(u,0.02,zs); if(d>collar||d<-0.02) continue; const rel=clamp(d/collar,0,1), pr=(1-rel)*(0.30+0.6*st.tierra+0.5*bury);
        if(H4(cc,r,sem,27)<pr){ const sc=pal(PAL_SUELO,0.25+0.6*H4(cc,r,sem,28)); G[i]=SUELO_G[(H4(cc,r,sem,29)*4)|0].charCodeAt(0); C[i]=pack(sc[0],sc[1],sc[2]); sh.TY[i]=5; }
      }
    }
  }
  /* pasto y enredadera al pie, con la semilla de vegetación */
  if(pasto||st.vegetacion>0){
    const P=Math.max(pasto||0,st.vegetacion*0.7);
    for(let r=0;r<rows;r++) for(let cc=0;cc<cols;cc++){
      const i=r*cols+cc; if(!(R.hit[i]&&R.HV[i]<0.20*Math.min(hm,2.2))) continue;
      if(sh.TY[i]===2||sh.TY[i]===7) continue;
      if(H4(cc,r,sem,31)<P*0.55*(1-R.HV[i]/(0.20*Math.min(hm,2.2)))){ const gc=pal(PAL_VEG,0.3+0.6*H4(cc,r,sem,32)); G[i]=(H4(cc,r,sem,33)<0.5?'"':'*').charCodeAt(0); C[i]=pack(gc[0],gc[1],gc[2]); }
    }
  }
  if(contorno){ const O=ENT().contorno.silueta(G,cols,rows); if(O) for(let i=0;i<G.length;i++) if(O[i]){ G[i]=35; C[i]=ORLA; } }
  c.key=key; c.F={G,C,TY:sh.TY}; ESTAD.pintados++;
  return {R,F:c.F};
}
/* pinta la estructura. ctx: put,bc,br,CPM,HPM,RPM,haze,contorno,detalle,cols,rows,elev,pasto,x,y,t */
function pintar(S,ctx){
  const E=ENT(), CPM=ctx.CPM||13, HPM=ctx.HPM||6.8, RPM=ctx.RPM||HPM/1.7, luz=E.luz(ctx.x||0,ctx.y||0,ctx.t||0);
  const det=ctx.detalle==null?(CPM<8?0:2):ctx.detalle, put=ctx.put, bc=ctx.bc, br=ctx.br-Math.round((ctx.elev||0)*HPM), hz=ctx.haze==null?1:ctx.haze;
  const cMax=ctx.cols==null?1e9:ctx.cols, rMax=ctx.rows==null?1e9:ctx.rows;
  const {R,F}=cuadroDe(S,CPM,HPM,RPM,luz,det,ctx.contorno!==false,ctx.pasto||0), {cols,rows,c0,R0}=R;
  for(let r=0;r<rows;r++){
    const rr=br-(R0-r); if(rr<(ctx.rmin||0)||rr>=rMax) continue;
    for(let c=0;c<cols;c++){
      const i=r*cols+c, gl=F.G[i]; if(!gl) continue;
      const cc=bc+c-c0; if(cc<0||cc>=cMax) continue;
      let col=F.C[i]; if(hz<0.999) col=pack(((col>>16)&255)*hz,((col>>8)&255)*hz,(col&255)*hz);
      put(cc,rr,gl,col);
    }
  }
}
/* la sombra proyectada: una masa de elipsoides según la forma, con el desplazamiento por altura de la luz */
function sombra(S,ctx){
  const E=ENT(), CPM=ctx.CPM||13, RPM=ctx.RPM||4, luz=E.luz(ctx.x||0,ctx.y||0,ctx.t||0), key=CPM+'|'+RPM+'|'+LK(luz);
  if(S._s&&S._s.key===key) return S._s.h;
  const h=E.huella(S.g.cuerpos,luz,{CPM,RPM,fuerza:0.5}); S._s={key,h}; return h;
}
function pintarSombra(S,ctx){ const h=sombra(S,ctx), f=ctx.sombrear; if(!f) return h;
  for(let r=0;r<h.h;r++) for(let q=0;q<h.w;q++){ const k=h.k[r*h.w+q]; if(k>0.03) f(ctx.bc+h.c0+q,ctx.br+h.r0+r,k); } return h; }

/* ------------------------------------------------------------------ AGRUPACIONES ----
   Un conjunto es una lista de partes {id,spec,x,y} (metros desde su origen, y hacia el sur). Se pueden descomponer y editar
   cada una por separado: cambiar una parte no toca las otras. */
const GRUPOS={
  ruina:{nombre:'Ruina',desc:'muro principal, columnas rotas, piedras caídas y vegetación'},
  casa:{nombre:'Restos de casa',desc:'cuatro muros con puerta y ventana, chimenea y escombros'},
  pozoAntiguo:{nombre:'Pozo antiguo',desc:'pozo con marco, polea, cubeta y cuerda; piedras alrededor'},
  cercado:{nombre:'Cercado',desc:'cerca de piedra con tramos de cerca de madera'},
  puenteRoto:{nombre:'Puente roto',desc:'puente destruido con estribos y tablas caídas'}
};
const GRUPOS_ID=Object.keys(GRUPOS);
function grupo(tipo,sem,opt){
  if(!GRUPOS[tipo]) throw new Error('agrupación desconocida: '+tipo);
  opt=opt||{}; const rnd=NV.mulberry((sem*7919+GRUPOS_ID.indexOf(tipo)*3571)|0), d=opt.deterioro==null?null:opt.deterioro, ed=opt.edad==null?null:opt.edad;
  const P=[], add=(id,spec,x,y)=>P.push({id,spec:Object.assign({sem:((rnd()*1e6)|0)+1},spec,d==null?{}:{deterioro:d},ed==null?{}:{edad:ed}),x,y});
  const nat=(m,v,l,h,t,ho)=>({musgo:m,vegetacion:v,liquen:l,humedad:h,tierra:t,hojas:ho});
  if(tipo==='ruina'){
    add('muro',{tipo:'muro',mat:'mamposteria',largo:7,alto:2.6,deterioro:0.55,edad:0.7,estado:nat(0.5,0.4,0.3,0.3,0.4,0.2)},0,0);
    add('col1',{tipo:'columna',mat:'sillar',deterioro:0.45,edad:0.75,estado:nat(0.4,0.3,0.2,0.2,0.4,0.2)},-4.2,1.4);
    add('col2',{tipo:'columna',mat:'sillar',deterioro:0.82,edad:0.75,alto:3.2,estado:nat(0.4,0.3,0.2,0.2,0.4,0.2)},4.6,1.2);
    add('caida',{tipo:'paredCaida',mat:'mamposteria',largo:3.4,alto:1.6,edad:0.7,estado:nat(0.5,0.5,0.3,0.3,0.5,0.3)},-1.5,3.4);
  } else if(tipo==='casa'){
    const W=5.6, D=4.2, H=2.3, e=opt.edad==null?0.6:opt.edad, base={mat:'mamposteria',alto:H,edad:e,estado:nat(0.4,0.35,0.3,0.25,0.3,0.2)};
    add('frente',Object.assign({tipo:'muro',largo:W,deterioro:0.55,huecos:[{x0:-0.6,x1:0.6,y0:0,y1:1.9,tipo:'puerta'},{x0:1.5,x1:2.3,y0:0.9,y1:1.8,tipo:'ventana'}]},base),0,D/2);
    add('fondo',Object.assign({tipo:'muro',largo:W,deterioro:0.4,huecos:[{x0:-1.8,x1:-0.9,y0:0.9,y1:1.8,tipo:'ventana'}]},base),0,-D/2);
    add('izq',Object.assign({tipo:'muro',largo:D,deterioro:0.7,yaw:Math.PI/2},base),-W/2,0);
    add('der',Object.assign({tipo:'muro',largo:D,deterioro:0.85,yaw:Math.PI/2,alto:H*0.9},base),W/2,0);
    add('chimenea',{tipo:'chimenea',mat:'ladrillo',deterioro:0.45,edad:e,estado:nat(0.2,0.3,0.1,0.1,0.3,0.2)},W/2+0.9,-0.4);
  } else if(tipo==='pozoAntiguo'){
    add('pozo',{tipo:'pozo',mat:'mamposteria',marco:true,polea:true,cubeta:true,deterioro:0.3,edad:0.7,estado:nat(0.5,0.4,0.3,0.5,0.4,0.2)},0,0);
    add('brocal',{tipo:'paredCaida',mat:'mamposteria',largo:1.8,alto:0.7,edad:0.8,estado:nat(0.5,0.5,0.3,0.4,0.5,0.3)},-1.9,1.1);
    add('muretePiedra',{tipo:'cercaPiedra',largo:2.6,alto:0.8,deterioro:0.7,edad:0.8,estado:nat(0.4,0.5,0.3,0.3,0.4,0.2)},2.4,0.9);
  } else if(tipo==='cercado'){
    add('piedra',{tipo:'cercaPiedra',largo:6,edad:0.7,estado:nat(0.4,0.4,0.3,0.2,0.3,0.1)},0,0);
    add('madera',{tipo:'cercaMadera',largo:4.2,deterioro:0.55,edad:0.6,estado:nat(0.2,0.2,0.1,0.2,0.2,0.1)},5.4,0.2);
  } else if(tipo==='puenteRoto'){
    add('puente',{tipo:'puente',largo:6,deterioro:0.6,edad:0.7,estado:nat(0.3,0.3,0.2,0.4,0.2,0.2)},0,0);
    add('estriboIzq',{tipo:'muro',mat:'mamposteria',largo:2.2,alto:1.1,deterioro:0.5,edad:0.8,yaw:Math.PI/2,estado:nat(0.5,0.4,0.3,0.5,0.4,0.2)},-3.4,0);
    add('estriboDer',{tipo:'muro',mat:'mamposteria',largo:2.2,alto:1.1,deterioro:0.8,edad:0.8,yaw:Math.PI/2,estado:nat(0.5,0.4,0.3,0.5,0.4,0.2)},3.4,0);
  }
  return {tipo,sem,partes:P.map(p=>({id:p.id,spec:limpiar(p.spec),x:p.x,y:p.y}))};
}
function descomponer(g){ return g.partes.map(p=>({id:p.id,spec:JSON.parse(JSON.stringify(p.spec)),x:p.x,y:p.y})); }
function pintarGrupo(g,ctx){
  const C=ctx.CPM||13, R=ctx.RPM||4, ord=g.partes.slice().sort((a,b)=>a.y-b.y);
  for(const p of ord){ const S=g._S&&g._S[p.id]&&g._S[p.id].k===JSON.stringify(p.spec)?g._S[p.id].S:null, SS=S||crear(p.spec);
    (g._S=g._S||{})[p.id]={k:JSON.stringify(p.spec),S:SS};
    const c2=Object.assign({},ctx,{bc:ctx.bc+Math.round(p.x*C),br:ctx.br+Math.round(p.y*R)});
    if(ctx.sombrear) pintarSombra(SS,c2); pintar(SS,c2); }
}

if(NV.entorno) NV.entorno.conectar('estructuras',{viento:[],luz:true,sombra:true,contorno:true});
const paraPaleta=TIPOS_ID.map(id=>({id:'estructura:'+id,nombre:TIPOS[id].nombre,k:'estructura',cat:TIPOS[id].cat,encaja:o=>o&&o.k==='estructura'&&o.e&&o.e.tipo===id}));
if(NV.motores) NV.motores.registrar({id:'estructuras',nombre:'Estructuras y ruinas',estado:'pendiente',
  archivo:'src/juego/estructuras.js',preview:'preview/estructuras.html',prueba:'pruebas/estructuras.js',
  caras:{generar:o=>crear(o), dibujar:(ctx,S)=>pintar(S,ctx),
    editor:{materiales:MATS.reduce((a,m)=>(a[m]=MATERIALES[m].nombre,a),{}),tipos:TIPOS_ID,agrupaciones:GRUPOS_ID,antiguedad:ANTIGUEDAD,deterioro:DETERIORO,
      estado:{musgo:[0,1],liquen:[0,1],humedad:[0,1],vegetacion:[0,1],tierra:[0,1],hojas:[0,1],quemadura:[0,1],enterrada:[0,1]},
      parametros:{escala:[0.4,2.5],yaw:[0,6.28],inclinacion:[-0.35,0.35],edad:[0,1],deterioro:[0,1],tono:[-1,1],lum:[-0.6,0.6],sat:[0,2]},
      conexiones:['luz y sombra proyectada','contorno compartido (silueta exterior)','sin viento por ahora'],
      herramientas:['editar (cambia sólo lo pedido)','regenerar forma / deterioro / vegetación','descomponer agrupaciones']}}});

NV.estructuras={crear,limpiar,editar,regenerar,plantilla,nuevo,variar,aObjeto,deObjeto,pintar,sombra,pintarSombra,grupo,descomponer,pintarGrupo,paraPaleta,
  MATERIALES,MATS,TIPOS,TIPOS_ID,GRUPOS,GRUPOS_ID,ANTIGUEDAD,DETERIORO,ESTADO0,estadisticas:()=>Object.assign({},ESTAD,{enCache:CACHE_G.size}),reiniciarCache:()=>{ CACHE_G.clear(); ESTAD.solidos=ESTAD.aciertos=ESTAD.rasters=ESTAD.pintados=0; }};
})(window.NV);

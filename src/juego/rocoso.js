/* Nativa Online — MOTOR DE ROCAS Y FORMACIONES (rocoso). LABORATORIO: todavía no lo usa el juego.
   Independiente del motor de piedra que ya está en el juego (NV.ROCAS / drawRoca): no lo reemplaza ni lo toca.
   Es la segunda cara de la arquitectura que estrena el motor de árboles: el objeto es DATOS (una spec chica y
   determinista) más un SÓLIDO que se evalúa con una función de distancia; el volcado a celdas es aparte y se guarda.

   CÓMO SE VE UN VOLUMEN. Cada roca es un sólido: un elipsoide (más o menos cuadrado según la forma) al que se le
   restan planos de corte (facetas), cavidades, una hendidura, ledges de estrato y un ruido de rugosidad. Cada
   celda de pantalla lanza un rayo con la inclinación de cámara del juego (la misma de RPM/HPM), baja hasta tocar
   el sólido y de ahí sale TODO: la normal (luz y sombra de caras), la oclusión de las cavidades, la sombra propia
   hacia el sol, el contacto con el suelo, y dónde caen las grietas. Las grietas son la intersección de la
   superficie con planos de junta reales (granito: dos juegos de juntas; basalto: columnas; arenisca, caliza y
   rojiza: estratos con su inclinación; pizarra: láminas finas), así que siguen la estructura y no son rayas
   al azar. Musgo, líquen y humedad se reparten por lo que la roca ya sabe de sí misma (sombra, cavidades, base,
   cerca de grietas) y se dosifican con puntillado, no con manchas pegadas.

   FORMACIONES (acantilados, riscos, pies de monte, laderas). Mismo sólido, otra receta: un frente con estratos que
   retroceden según la dureza de cada capa, columnas separadas por juntas, canaletas de erosión, derrumbe al pie,
   cavidades, una cima con su relieve, y bloques que emergen de la masa. Se dibuja por TRAMOS de columnas: el sólido
   es global, así que cada tramo se rehace solo (y sólo el que se tocó).

   Todo se mide en metros. Glifos: sólo los del diccionario (rampas por material, extremo denso exclusivo; musgo y
   líquen los del juego). El contorno sale de NV.entorno.contorno y respeta la silueta exterior. Pruebas:
   pruebas/rocoso.js; laboratorio: preview/rocoso.html. */
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
function fbm(x,y,z,s,o){
  let a=0,amp=0.5,f=1,t=0;
  for(let i=0;i<o;i++){ a+=amp*n3(x*f,y*f,z*f,s+i*13); t+=amp; amp*=0.5; f*=2.03; }
  return a/t;
}
const smax=(a,b,k)=>{ const h=Math.max(k-Math.abs(a-b),0)/k; return Math.max(a,b)+h*h*k*0.25; };
const smin=(a,b,k)=>{ const h=Math.max(k-Math.abs(a-b),0)/k; return Math.min(a,b)-h*h*k*0.25; };
const ch=s=>s.charCodeAt(0);
const _c=[0,0,0];
function pal(p,t){ const n=p.length-1, x=clamp(t,0,1)*n, i=Math.min(n-1,x|0), f=x-i, a=p[i], b=p[i+1];
  _c[0]=a[0]+(b[0]-a[0])*f; _c[1]=a[1]+(b[1]-a[1])*f; _c[2]=a[2]+(b[2]-a[2])*f; return _c; }
const pack=(r,g,b)=>(clamp(r|0,0,255)<<16)|(clamp(g|0,0,255)<<8)|clamp(b|0,0,255);
const ORLA=(5<<16)|(8<<8)|11;                   // la orla negra de siempre
const MUSGO_G=['\u00b0','*','\u00b0',';'], LIQ_G=['\u00b0','*','\u00b0'], SUELO_G=[',','.',':',';'], GUIJA=[46,58,176,111,99];
const PAL_MUSGO=[[10,34,26],[20,58,40],[34,88,52],[58,122,66],[92,156,84]];
const PAL_SUELO=[[30,26,20],[50,43,32],[74,64,46],[100,88,62],[126,112,80]];
const PAL_AGUA=[[22,52,66],[36,84,102],[58,120,138],[96,164,180]];
const LIQ_COL=[[196,188,84],[150,172,132],[214,146,64]];

/* ------------------------------------------------------------------ MATERIALES ----
   Cada uno es una estructura, no un color: rampa de glifos (extremo denso exclusivo del material), paleta,
   rugosidad, grano, y qué juntas lleva. */
const MATERIALES={
  granito:{nombre:'Granito', ramp:[':','o','a','e','0','&','@'], pal:[[28,30,36],[56,60,68],[88,94,104],[122,128,138],[158,163,172],[198,202,208]],
           rug:0.85, grano:0.55, fleco:0.20, capa:0, juntas:'granito', poro:0, fino:6},
  caliza:{nombre:'Caliza', ramp:['.',':','-','c','o','O'], pal:[[76,68,58],[120,110,94],[160,149,128],[192,182,158],[218,209,186],[238,231,212]],
           rug:0.55, grano:0.20, capa:0.55, bandas:0.35, juntas:'estrato', cavidades:true, poro:0.20, fino:3},
  arenisca:{nombre:'Arenisca', ramp:['.',':','-','o','8','%'], pal:[[66,42,30],[102,68,42],[142,100,60],[180,134,84],[208,168,110],[230,198,144]],
           rug:0.60, grano:0.30, capa:0.24, bandas:0.9, juntas:'estrato', viento:true, poro:0.08, fino:4},
  basalto:{nombre:'Basalto', ramp:['.',':','c','a','H','B'], pal:[[32,36,42],[54,60,68],[80,88,98],[108,118,130],[140,152,164],[174,186,198]],
           rug:0.60, grano:0.28, capa:0, juntas:'columnas', poro:0.16, fino:5},
  pizarra:{nombre:'Pizarra', ramp:['.',':','-','l','I','#'], pal:[[46,56,74],[72,88,116],[102,122,152],[134,156,184],[166,188,214],[200,218,236]],
           rug:0.35, grano:0.18, capa:0.075, bandas:0.7, juntas:'laminas', lamin:true, poro:0, fino:3},
  rojiza:{nombre:'Roca rojiza', ramp:['.',',',':','x','X','M'], pal:[[62,26,20],[100,42,30],[142,66,42],[178,96,58],[208,130,80],[232,168,108]],
           rug:0.65, grano:0.40, capa:0.30, bandas:1.0, juntas:'estrato', viento:true, poro:0.10, fino:4}
};
const MATS=Object.keys(MATERIALES);
const TAMANOS={pequena:[0.22,0.55], media:[0.80,1.60], grande:[1.90,3.80]};
const TAMS=Object.keys(TAMANOS);
const FORMAS=['redondeada','ovalada','angular','afilada','plana','alargada','irregular','estratificada','fracturada','erosionada'];
const ESTADO0={musgo:0, liquen:0, humedad:0, erosion:0, enterrada:0};

/* ------------------------------------------------------------------ LA ROCA ----
   spec: {mat,tam,forma,estado:{...},sem,escala,yaw,alto}. Misma spec, misma roca. */
function crearRoca(spec){
  const sp=Object.assign({mat:'granito',tam:'media',forma:'irregular',sem:1,escala:1,yaw:0},spec);
  sp.estado=Object.assign({},ESTADO0,spec&&spec.estado);
  const M=MATERIALES[sp.mat]; if(!M) throw new Error('material desconocido: '+sp.mat);
  if(!TAMANOS[sp.tam]) throw new Error('tamaño desconocido: '+sp.tam);
  if(FORMAS.indexOf(sp.forma)<0) throw new Error('forma desconocida: '+sp.forma);
  const rnd=NV.mulberry((sp.sem*7919+MATS.indexOf(sp.mat)*104729+TAMS.indexOf(sp.tam)*15485863+FORMAS.indexOf(sp.forma)*1299709)|0);
  const T=TAMANOS[sp.tam], h=(sp.alto||lerp(T[0],T[1],rnd()))*sp.escala;
  let w,d,p=2.2,nPl=0,taper=0,ledge=0,slot=false,cav=0,fnz=1;
  switch(sp.forma){
    case 'redondeada':    w=1.55*h; d=1.35*h; p=2.1; break;
    case 'ovalada':       w=2.10*h; d=1.20*h; p=2.0; break;
    case 'angular':       w=1.55*h; d=1.30*h; p=3.0; nPl=8; break;
    case 'afilada':       w=0.95*h; d=0.85*h; p=2.5; nPl=5; taper=0.62; break;
    case 'plana':         w=3.10*h; d=2.40*h; p=3.4; nPl=3; break;
    case 'alargada':      w=3.30*h; d=1.00*h; p=2.4; nPl=3; break;
    case 'irregular':     w=1.70*h; d=1.35*h; p=2.6; nPl=6; fnz=1.5; break;
    case 'estratificada': w=1.95*h; d=1.55*h; p=3.6; nPl=3; ledge=0.10; break;
    case 'fracturada':    w=1.60*h; d=1.35*h; p=3.0; nPl=7; slot=true; break;
    case 'erosionada':    w=1.90*h; d=1.35*h; p=2.2; nPl=2; cav=4+((rnd()*4)|0); fnz=1.4; break;
  }
  const er=sp.estado.erosion; if(er>0){ cav+=Math.round(er*5); fnz+=er*1.2; }
  const a=w/2, c=d/2, bh=h/2, m=Math.min(a,bh,c);
  const bury=sp.estado.enterrada, cv=bh-bury*h*0.34;          // el centro baja y el suelo corta la parte de abajo
  const yaw=(sp.yaw||0)+rnd()*6.283, cy=Math.cos(yaw), sy=Math.sin(yaw);
  /* planos de corte: facetas. La normal sube con preferencia; el corte queda entre 0,6 y 0,9 del apoyo */
  const PL=[];
  for(let i=0;i<nPl;i++){
    const th=rnd()*6.283, ny0=(sp.forma==='plana'&&i===0)?1:(rnd()*1.35-0.30);
    let nx=Math.cos(th), nz=Math.sin(th), ny=ny0;
    if(sp.forma==='alargada'&&i<2){ nx=(i?1:-1)*0.98; nz=0.1; ny=0.1; }
    const l=Math.hypot(nx,ny,nz); nx/=l; ny/=l; nz/=l;
    const sup=Math.sqrt((a*nx)*(a*nx)+(bh*ny)*(bh*ny)+(c*nz)*(c*nz));
    PL.push(nx,ny,nz,sup*(sp.forma==='plana'&&i===0?0.84:(0.52+rnd()*0.30)));
  }
  /* cavidades (caliza, erosionada) */
  const CV=[];
  for(let i=0;i<cav;i++){
    const th=rnd()*6.283, ph=rnd()*2.4-0.6; let nx=Math.cos(th)*Math.cos(ph), nz=Math.sin(th)*Math.cos(ph), ny=Math.sin(ph);
    const r=m*(0.16+rnd()*0.24);
    CV.push(nx*a*0.82,ny*bh*0.82,nz*c*0.82,r);
  }
  /* hendidura grande: plano casi vertical que corta desde arriba, con un largo limitado */
  let SL=null;
  if(slot){ const th=rnd()*3.14, nx=Math.cos(th), nz=Math.sin(th); SL={nx,nz,off:(rnd()-0.5)*a*0.4,w:Math.max(0.022*m,0.5/13),y0:cv-bh*0.15+rnd()*bh*0.3}; }
  const lh=M.capa?Math.max(0.045,M.capa*Math.sqrt(h)*0.8):0.2;
  const amp=M.rug*m*(nPl>=4?0.11:0.20)*fnz*(sp.tam==='pequena'?0.8:1), fx=1/(Math.max(0.3,h*0.9)), oct=3;
  const kPl=m*(0.018+er*0.30), eps2=0;
  const sdf=(u,v,z)=>{
    const x=u*cy+z*sy, zz=-u*sy+z*cy, y=v-cv;
    let ax=a, cz=c;
    if(taper){ const k=1-taper*clamp(v/h,0,1); ax*=k; cz*=k; }
    if(ledge){ const fr=frac(v/lh); const s=1-ledge*(fr<0.2?1-fr/0.2:0)*0.9-ledge*0.25*fr; ax*=s; cz*=s; }
    const qx=Math.abs(x/ax), qy=Math.abs(y/bh), qz=Math.abs(zz/cz);
    let nn;
    if(p<2.3) nn=Math.sqrt(qx*qx+qy*qy+qz*qz);
    else if(p<3.3) nn=Math.cbrt(qx*qx*qx+qy*qy*qy+qz*qz*qz);
    else nn=Math.sqrt(Math.sqrt(qx*qx*qx*qx+qy*qy*qy*qy+qz*qz*qz*qz));
    let f=(nn-1)*m*0.9;
    for(let i=0;i<PL.length;i+=4) f=smax(f,PL[i]*x+PL[i+1]*y+PL[i+2]*zz-PL[i+3],kPl);
    for(let i=0;i<CV.length;i+=4) f=smax(f,CV[i+3]-Math.hypot(x-CV[i],y-CV[i+1],zz-CV[i+2]),CV[i+3]*0.5);
    if(SL){ let sd=SL.w-Math.abs(SL.nx*x+SL.nz*zz-SL.off); sd=Math.min(sd,(v-SL.y0)); f=smax(f,sd,SL.w*0.8); }
    f+=(fbm(x*fx*2.2,y*fx*2.2,zz*fx*2.2,sp.sem,oct)-0.5)*amp*2;
    return Math.max(f,-v);
  };
  const ub=Math.max(a,c)*1.22+0.15;
  const S={tipo:'roca',spec:sp,M,sdf,h,a,c,bh,cv,m,paso:0.62,car:Math.max(h,a*0.8),hmax:h,
    box:{umin:-ub,umax:ub,vmin:-0.05,vmax:h*1.08,zmin:-ub,zmax:ub},
    capaH:M.capa?lh:0, capaTilt:(rnd()-0.5)*(M.lamin?0.7:0.35), yaw, cy, sy, cv,
    juntas:[], facetas:nPl>=4||sp.forma==='angular'||sp.forma==='fracturada'||M.juntas==='columnas'};
  S.local=(u,v,z)=>[u*cy+z*sy,v-cv,-u*sy+z*cy];
  /* juntas del material (en el marco local de la roca) */
  const wj=Math.max(0.5/13,0.012*m);
  const jt=(th,tilt,esp)=>{ const nx=Math.cos(th)*Math.cos(tilt), nz=Math.sin(th)*Math.cos(tilt), ny=Math.sin(tilt); return {nx,ny,nz,esp,off:rnd()*esp,w:wj*(0.7+rnd()*0.7),mask:0.30+rnd()*0.25,s:(rnd()*1000)|0}; };
  const big=Math.max(h,a);
  if(M.juntas==='granito'){ S.juntas.push(jt(rnd()*3.14,0.1,big*(0.55+rnd()*0.4)),jt(rnd()*3.14+1.3,-0.1,big*(0.7+rnd()*0.5))); if(sp.tam!=='pequena') S.juntas.push(jt(0,1.4,big*0.9)); }
  else if(M.juntas==='columnas'){ const t0=rnd()*3.14, e=Math.max(0.12,0.30*Math.sqrt(h)); for(let k=0;k<3;k++) S.juntas.push(Object.assign(jt(t0+k*1.0472,0.0,e),{mask:0.06,w:wj*0.9})); }
  else if(M.juntas==='laminas'){ const t=0.9+rnd()*0.5; S.juntas.push(Object.assign(jt(0.6,t,lh*1.1),{mask:0.12,w:wj*0.5}),jt(2.2,0.2,big*0.8)); }
  else { S.juntas.push(jt(rnd()*6.28,0.05,big*(1.0+rnd()*0.6))); }   // estratos: la capa va aparte
  S.nombre=M.nombre+' '+sp.forma;
  return S;
}

/* ------------------------------------------------------------------ LA FORMACIÓN ----
   spec: {tipo,mat,ancho,alto,fondo,sem,estado,estrato,columnas,erosion,derrumbe,inclinacion,bloques} */
const TIPOS_FORM={
  acantilado:{nombre:'Acantilado',   alto:[9,15],  fondo:5, columnas:0, derr:0.5, top:0.20, estratos:1, bloques:0.0},
  pared:     {nombre:'Pared rocosa vertical',alto:[7,11],fondo:4, columnas:3.2,derr:0.25,top:0.10, estratos:1, bloques:0.0},
  risco:     {nombre:'Gran risco',    alto:[11,17], fondo:5, columnas:5.5, derr:0.5, top:0.55, estratos:0.6, bloques:0.1, picos:true},
  escalonada:{nombre:'Formación escalonada',alto:[8,12],fondo:9, columnas:0, derr:0.4, top:0.12, estratos:1, bloques:0.0, tiers:3},
  erosionada:{nombre:'Pared erosionada',alto:[8,12],fondo:4,columnas:0, derr:0.8, top:0.22, estratos:0.8, bloques:0.1, canal:1},
  macizo:    {nombre:'Bloques en la montaña',alto:[9,14],fondo:7, columnas:0, derr:0.6, top:0.30, estratos:0.4, bloques:1.0, ladera:0.5},
  piedemonte:{nombre:'Pie de montaña rocoso',alto:[3.2,5],fondo:9, columnas:0, derr:0, top:0.3, estratos:0.2, bloques:1.2, pendiente:true},
  ladera:    {nombre:'Ladera de rocas',alto:[2.6,4], fondo:10, columnas:0, derr:0, top:0.2, estratos:0.1, bloques:0.8, pendiente:true, suave:true}
};
const TIPOS=Object.keys(TIPOS_FORM);
function crearFormacion(spec){
  const T0=TIPOS_FORM[(spec&&spec.tipo)||'acantilado']; if(!T0) throw new Error('tipo de formación desconocido: '+spec.tipo);
  const sp=Object.assign({tipo:'acantilado',mat:'caliza',ancho:28,sem:1},spec);
  sp.estado=Object.assign({},ESTADO0,spec&&spec.estado);
  const M=MATERIALES[sp.mat]; if(!M) throw new Error('material desconocido: '+sp.mat);
  const rnd=NV.mulberry((sp.sem*7919+TIPOS.indexOf(sp.tipo)*104729+MATS.indexOf(sp.mat)*15485863)|0);
  const W=sp.ancho, Hh=sp.alto||lerp(T0.alto[0],T0.alto[1],rnd()), D=sp.fondo||T0.fondo, s0=sp.sem|0;
  const lh=sp.estrato||Math.max(0.5,Hh/(M.capa?clamp(M.capa*18,4,13):7))*(M.lamin?0.35:1);
  const nK=Math.ceil(Hh/lh)+3, REC=[];
  for(let k=0;k<nK+2;k++){ const hd=H4(k,s0,9,1); REC.push((0.18+0.82*hd*hd)*lh*0.34*T0.estratos*(sp.dureza==null?1:sp.dureza)); }
  const col=sp.columnas!=null?sp.columnas:T0.columnas, ero=sp.erosion!=null?sp.erosion:(T0.canal||0)*0.8+sp.estado.erosion*0.8;
  const vertical=sp.orient==='este'||sp.orient==='oeste';
  /* de frente un muro vertical se ve de canto; con un talud (la cara echada hacia atrás) la cara mira un poco hacia arriba y se lee */
  const der=sp.derrumbe!=null?sp.derrumbe:T0.derr, lean=(sp.inclinacion||0)-(vertical?0.3:0);
  const A1=1.1+0.09*Hh, A2=0.16+0.015*Hh, seg=sp.bloque||(2.6+Hh*0.12), bamp=(0.30+0.045*Hh)*(sp.fractura==null?1:sp.fractura);
  /* bloques de frente: cada fila de capas se parte en bloques que avanzan o retroceden, con saltos verticales netos */
  const contra=(u,v)=>{ const kk=Math.floor(v/(lh*2.2)), x=u/seg+0.4*(fbm(u*0.15,kk,0,s0+23,2)-0.5), q=Math.floor(x), t=x-q, w=0.10; return lerp(H4(q,kk,s0,24)-0.5,H4(q+1,kk,s0,24)-0.5,sm((t-(1-w))/w))*bamp*2; };
  const zf=(u,v)=>{
    let z=A1*(fbm(u*0.09,0,0.5,s0,3)-0.5)*2+A2*(fbm(u*0.8,v*0.6,0,s0+1,3)-0.5)*2+contra(u,v);
    const k=Math.max(0,Math.floor(v/lh)), fr=v/lh-k, q=1-fr;
    z-=REC[Math.min(k,REC.length-1)]*(0.55+0.45*q*q);
    if(col>0){
      const uu=u/col+0.12*(fbm(u*0.2,v*0.1,1,s0+3,2)-0.5)*4, ci=Math.floor(uu), fu=Math.abs(uu-ci-0.5)*2;       // 1 en la junta
      z-=Math.exp(-Math.pow((1-fu)*(1)*8,2)*0)*0 + Math.pow(Math.max(0,fu-0.82)/0.18,2)*0.30*Math.min(col,3);
      z+=(H4(ci,s0,5,2)-0.5)*0.55*lh*Math.min(1,v/(lh*1.2));
    }
    if(ero>0) z-=ero*0.5*Math.max(0,fbm(u*1.9,v*0.10,2,s0+5,3)-0.50)*2.0*Math.min(1,v/(Hh*0.25));
    z+=der*Hh*0.34*Math.exp(-v/(0.14*Hh))*(0.6+0.4*fbm(u*0.3,0,3,s0+7,2));
    z+=lean*v;
    return z;
  };
  const picos=T0.picos, tiers=T0.tiers, pend=T0.pendiente, suave=T0.suave, ladera=T0.ladera||0;
  const top=(u,zs)=>{
    const rel=clamp(-zs/D,0,1);
    let hT=Hh*(1+T0.top*(fbm(u*0.085+zs*0.04,zs*0.1,4,s0+11,3)-0.5));
    if(picos){ const r=1-Math.abs(2*fbm(u*0.07,zs*0.12,5,s0+12,3)-1); hT=Hh*(0.45+0.65*Math.pow(r,0.8)); }
    if(tiers){ const ti=Math.floor(rel*tiers+0.0001); hT=Hh*(0.50+0.50*ti/(tiers-0.0))*(0.96+0.08*fbm(u*0.1,ti,6,s0,2)); }
    if(pend){ hT=Hh*(0.12+0.88*Math.pow(rel,suave?1.2:0.85))+Hh*0.07*(fbm(u*0.3,zs*0.3,7,s0+13,3)-0.5); }
    if(ladera) hT=hT+Hh*ladera*0.5*rel;
    return hT;
  };
  /* bloques que emergen de la masa */
  const BL=[], nb=Math.round(W*(T0.bloques||0)*(sp.bloques==null?1:sp.bloques)*0.35);
  for(let i=0;i<nb;i++){
    const r=(0.45+Math.pow(rnd(),1.7)*(pend?2.0:2.4)), u=rnd()*W, zs=-rnd()*D*(pend?1:0.55);
    BL.push({u,zs,r,v:null});
  }
  for(const b of BL){ b.v=Math.max(0.1,top(b.u,b.zs)*(pend?0.78:0.90)-b.r*0.1)+b.r*(pend?0.1:0.15); }
  const BK=new Map(); for(const b of BL){ const k=Math.floor(b.u/3); if(!BK.has(k)) BK.set(k,[]); BK.get(k).push(b); }
  /* cavidades: socavones bajo los estratos duros */
  const CV=[], ncv=Math.round(W*0.06*(M.cavidades?2.2:1)*(1+ero));
  for(let i=0;i<ncv;i++) CV.push({u:rnd()*W,v:Hh*(0.12+rnd()*0.55),r:0.35+rnd()*0.9});
  const fp=0.82;
  const sdf=(u,v,zs)=>{
    let f=Math.max((zs-(pend?(zs+4):zf(u,v)))*fp,-(zs+D),(v-top(u,zs))*fp);
    if(pend) f=Math.max(-(zs+D),(v-top(u,zs))*fp, zs-0.5-Math.abs(0));
    for(let kk=Math.floor(u/3)-1;kk<=Math.floor(u/3)+1;kk++){
      const L=BK.get(kk); if(!L) continue;
      for(let i=0;i<L.length;i++){ const b=L[i], dx=(u-b.u)/b.r, dy=(v-b.v)/(b.r*0.85), dz=(zs-b.zs)/b.r;
        const dd=(Math.sqrt(dx*dx+dy*dy+dz*dz)-1)*b.r*0.8; f=smin(f,dd+(fbm(u*1.2,v*1.2,zs*1.2,s0+17,2)-0.5)*b.r*0.35,b.r*0.35); }
    }
    for(let i=0;i<CV.length;i++){ const c=CV[i]; if(Math.abs(u-c.u)>c.r*1.4) continue; f=smax(f,c.r-Math.hypot((u-c.u)*0.9,(v-c.v)*1.2,(zs+c.r*0.15)*0.8),c.r*0.5); }
    f+=(fbm(u*0.5,v*0.5,zs*0.5,s0+19,3)-0.5)*0.30+(fbm(u*1.7,v*1.7,zs*1.7,s0+20,2)-0.5)*0.12;
    return Math.max(f,-v);
  };
  const S={tipo:'formacion',spec:sp,M,sdf,Hh,W,D,paso:0.62,maxIt:80,car:Math.max(2,Hh*0.3),hmax:Hh*1.2,
    box:{umin:-1,umax:W+1,vmin:-0.05,vmax:Hh*(1+T0.top*0.5+(ladera?0.6:0))+1,zmin:-D-0.1,zmax:pend?0.6:der*Hh*0.34+A1+A2+bamp+0.9},
    aoK:0.45,shK:0.22,capaH:M.capa||sp.estrato?lh:lh*1.0, capaTilt:(rnd()-0.5)*0.10*(T0.estratos?1:0), juntas:[], facetas:true, lh, columnas:col,
    nombre:T0.nombre};
  S.local=(u,v,z)=>[u,v,z];
  const wj=0.55/13;
  if(col>0){ for(let k=0;k<3;k++) S.juntas.push({nx:1,ny:0,nz:0,esp:col,off:0,w:wj*1.4,mask:0.0,s:k,vert:true}); }
  else { S.juntas.push({nx:Math.cos(1.2),ny:0.04,nz:Math.sin(1.2),esp:Math.max(3,Hh*0.9),off:rnd()*6,w:wj*1.3,mask:0.38,s:11},{nx:Math.cos(2.0),ny:-0.05,nz:Math.sin(2.0),esp:Math.max(4,Hh*1.3),off:rnd()*7,w:wj*1.1,mask:0.40,s:12}); }
  S.juntas.push({nx:0.0,ny:1,nz:0.0,esp:0,off:0,w:0,mask:1,s:0,estrato:true});
  S.bloques=BL;
  return (sp.orient==='este'||sp.orient==='oeste')?verticalizar(S,sp.orient):S;
}
/* Una formación VERTICAL corre de norte a sur y mira al este o al oeste. El cuerpo se arma igual que la horizontal
   (u a lo largo del muro, zs hacia afuera) y acá sólo se cambia de marco: el largo pasa a ser la profundidad de pantalla
   y el fondo pasa a ser el ancho. Con la cámara de frente un plano que mira al este se ve de canto; lo que se lee son
   los escalones de cada estrato (cada capa retrocede), la cima y la inclinación. Por eso conviene estrato marcado. */
function verticalizar(S0,lado){
  const L=S0.W, Dp=S0.D, B0=S0.box, pad=Math.max(0.6,B0.zmax), W2=Dp+pad+0.3, f0=S0.sdf, este=lado==='este';
  const zsDe=U=>este?U-Dp:-(U-pad);
  const S=Object.assign({},S0,{vert:true,lado,largo:L,W:W2,D:L,fondoReal:Dp});
  S.sdf=(U,v,z)=>f0(z+L,v,zsDe(U));
  S.local=(U,v,z)=>[z+L,v,zsDe(U)];
  S.box={umin:0,umax:W2,vmin:B0.vmin,vmax:B0.vmax,zmin:-L-1,zmax:1};
  S.cuerposV=()=>{ const n=Math.max(2,Math.round(L/2)), out=[];
    for(let i=0;i<n;i++){ const z=-L+(i+0.5)*L/n; out.push({e:(este?Dp:pad+Dp)*0.5,h:S0.Hh*0.5,s:z,re:Dp*0.5,rh:S0.Hh*0.5,rs:L/n*0.7,f:0.9}); }
    return out; };
  return S;
}

/* ------------------------------------------------------------------ RASTER ----
   Rayo por celda con la inclinación de cámara del juego: la altura vale HPM filas por metro, la profundidad RPM.
   Sale el sólido, la normal, y luego el sombreado. */
function sombrearCeldas(S,HU,HV,HZ,hit,cols,rows,luz,det,o){
  const n=cols*rows, M=S.M, st=S.spec.estado, sem=S.spec.sem|0;
  const Ls=luz.L, ly=Ls.y*0.35+0.50, ln=Math.hypot(Ls.x,ly,Ls.z)||1, Lr=[Ls.x/ln,Ls.z/ln,ly/ln];   // (este, arriba, hacia cámara)
  const Lt=[Ls.x,Ls.z,Ls.y];
  const G=new Uint8Array(n), C=new Int32Array(n), TY=new Uint8Array(n);
  const NU=new Float32Array(n), NV_=new Float32Array(n), NZ=new Float32Array(n), LU=new Float32Array(n);
  const eps=0.5/o.CPM, car=S.car, hAO=clamp(car*0.10,0.05,0.35), hmax=S.hmax;
  const cphi=o.cphi, sphi=o.sphi, bH=Math.max(0.3,S.hmax);
  const sdf=S.sdf, ambF=clamp(luz.amb==null?1:luz.amb,0.45,1.3);
  const rampa=M.ramp, nR=rampa.length;
  for(let i=0;i<n;i++){
    if(!hit[i]) continue;
    const u=HU[i], v=HV[i], z=HZ[i];
    /* normal */
    let nu=sdf(u+eps,v,z)-sdf(u-eps,v,z), nv=sdf(u,v+eps,z)-sdf(u,v-eps,z), nz=sdf(u,v,z+eps)-sdf(u,v,z-eps);
    const nl=Math.hypot(nu,nv,nz)||1; nu/=nl; nv/=nl; nz/=nl;
    NU[i]=nu; NV_[i]=nv; NZ[i]=nz;
    const lam=Math.max(0,nu*Lr[0]+nv*Lr[1]+nz*Lr[2]);
    let lum=0.34+0.92*lam+0.10*Math.max(0,nz);
    if(det>=1){
      /* sombra propia hacia el sol y oclusión de cavidades */
      let sh=1, t=0.05*car+eps*2;
      for(let k=0;k<(det>=2?7:4);k++){ const d=sdf(u+Lt[0]*t+nu*eps,v+Lt[1]*t+nv*eps,z+Lt[2]*t+nz*eps); if(d<0.002){ sh=0; break; } sh=Math.min(sh,clamp(5*d/t,0,1)); t+=clamp(d,0.04*car,0.28*car); if(v+Lt[1]*t>hmax*1.4) break; }
      const ao=1-0.85*clamp((hAO-sdf(u+nu*hAO,v+nv*hAO,z+nz*hAO))/hAO,0,1)*0.7-0.5*clamp((2.2*hAO-sdf(u+nu*hAO*2.2,v+nv*hAO*2.2,z+nz*hAO*2.2))/(2.2*hAO),0,1)*0.3;
      const aoK=S.aoK==null?1:S.aoK; const shK=S.shK==null?0.42:S.shK; lum=lum*(1-shK+shK*sh)*clamp(1-(1-ao)*aoK,0.35,1);
      LU[i]=lam*(0.4+0.6*sh);
    } else LU[i]=lam;
    /* contacto con el suelo */
    lum*=0.66+0.34*sm(v/(0.18*Math.min(bH,3)+0.06));
    /* capas: coordenada de estrato y tono por capa */
    const [lx,ly2,lz2]=S.local(u,v,z);
    let q=0, tl=0;
    if(S.capaH){ const ct=Math.cos(S.capaTilt), stt=Math.sin(S.capaTilt); q=(ly2*ct+lx*stt)/S.capaH+(fbm(lx*0.9,ly2*0.4,lz2*0.9,sem+31,2)-0.5)*0.55;
      tl=(H4(Math.floor(q),sem,3,7)-0.5); lum*=1+(M.bandas||0)*tl*0.55; }
    /* grietas: planos de junta de verdad */
    let crack=0, cdir=0, cd=9;
    for(let j=0;j<S.juntas.length;j++){
      const J=S.juntas[j]; if(J.estrato||!J.esp) continue;
      const pq=(J.nx*lx+J.ny*ly2+J.nz*lz2+J.off)/J.esp, dq=Math.abs(pq-Math.round(pq))*J.esp;
      if(dq<cd) cd=dq;
      if(dq<J.w&&fbm(lx*1.3+J.s,ly2*1.3,lz2*1.3,sem+41,2)>J.mask){
        crack=1;
        /* dirección en pantalla: tangente = normal de superficie × normal del plano */
        const tu=nv*J.nz-nz*J.ny, tv=nz*J.nx-nu*J.nz, tz=nu*J.ny-nv*J.nx, dx=tu, dy=tv*cphi-tz*sphi;
        cdir=Math.abs(dy)>2*Math.abs(dx)?0:(Math.abs(dx)>2*Math.abs(dy)?3:(dx*dy>0?1:2));
      }
    }
    /* fleco mineral (granito), poros (basalto, caliza), viento (arenisca) */
    const hh=H4(i%cols,(i/cols)|0,sem,2), hq=H4((u*60)|0,(v*60)|0,(z*60)|0,sem);
    let t0=clamp(0.10+lum*0.70,0,1)+(hh-0.5)*M.grano*0.30;
    let tr=0, colFl=null;
    if(M.fleco&&hh<M.fleco){ tr=(hh<M.fleco*0.5)?0.28:-0.30; colFl=hh<M.fleco*0.5?0:1; }
    let g=rampa[clamp(Math.floor((t0+tr)*nR),0,nR-1)];
    const poro=M.poro&&fbm(lx*(18/Math.max(0.5,S.car*0.5+0.5)),ly2*18/Math.max(0.5,S.car*0.5+0.5),lz2*18/Math.max(0.5,S.car*0.5+0.5),sem+51,2)>1-M.poro*0.55;
    if(poro){ g=rampa[Math.max(0,clamp(Math.floor((t0-0.22)*nR),0,nR-1))]; t0-=0.15; }
    if(M.lamin&&S.capaH){ const fr=frac(q); if(fr<0.16){ g='-'; t0+=0.05; } else if(fr>0.9){ g='l'; t0+=0.10; } }
    if(M.juntas==='estrato'&&S.capaH&&M.capa>0.2){ const fr=frac(q); if(fr<0.10&&nv<0.7){ g='='; t0-=0.16; } }
    if(M.viento&&Math.abs(nu)<0.45){ const fr=frac(q*2.2+hh*0.2); if(fr<0.18){ g='-'; t0-=0.08; } }
    let t=clamp(t0,0,1), glyph=g, isMus=0;
    let r=0,gg=0,bb=0;
    const cc=pal(M.pal,t); r=cc[0]; gg=cc[1]; bb=cc[2];
    if(colFl===0){ r=lerp(r,214,0.35); gg=lerp(gg,176,0.30); bb=lerp(bb,168,0.30); } else if(colFl===1){ r*=0.55; gg*=0.55; bb*=0.6; }
    /* grietas */
    if(crack){ glyph=['|','/','\\','_'][cdir==3?3:cdir]; if(cdir===3) glyph='_'; r*=0.22; gg*=0.22; bb*=0.24; if(M.lamin) glyph=cdir===3?'-':glyph; TY[i]=2; }
    /* estado: humedad (se filtra desde abajo y por vetas) */
    let wet=0;
    if(st.humedad>0){ const wl=0.10+0.9*st.humedad, sc=(wl*hmax-v)/(0.15*hmax+0.02)+(fbm(lx*(2.5/bH+0.8),ly2*0.6,lz2*(2.5/bH+0.8),sem+61,2)-0.5)*1.4;
      wet=clamp(sc,0,1); if(wet>0&&hh<wet+0.1){ r*=lerp(1,0.55,wet); gg*=lerp(1,0.62,wet); bb*=lerp(1,0.72,wet); wet=1; } else wet=0;
      if(wet&&nv>0.3&&hq<0.18&&LU[i]>0.35){ glyph="'"; r=190; gg=206; bb=214; } }
    /* musgo: dónde la roca ya es húmeda y protegida */
    if(st.musgo>0&&!crack){
      const mo=fbm(lx*(2.0/bH+0.6),ly2*(2.0/bH+0.6),lz2*(2.0/bH+0.6),sem+71,3);
      const baseW=1-clamp(v/(0.55*Math.min(hmax,3)+0.05),0,1), sombra=1-clamp(LU[i]*1.4,0,1), cav=1-clamp((lum-0.1),0,1);
      const grieta=cd<S.m*0.12?0.5:0;
      let score=mo*0.55+baseW*0.35+sombra*0.20+grieta+cav*0.15+(nv>0.2?0.12:0)-0.32;
      score*=0.35+st.musgo*1.3;
      const pr=sm((score-0.16)/0.30);
      if(hq<pr||H4(i%cols,(i/cols)|0,sem,9)<pr*0.9){
        glyph=MUSGO_G[((hh*4)|0)%4]; const mc=pal(PAL_MUSGO,clamp(lum*0.8+(hh-0.5)*0.3,0,1)); r=mc[0]; gg=mc[1]; bb=mc[2]; isMus=1; TY[i]=3;
      }
    }
    /* líquen: manchas redondas en lo asoleado, de tres colores, con borde punteado */
    if(st.liquen>0&&!isMus&&LU[i]>0.18){
      const gs=Math.max(0.07,0.13*Math.sqrt(S.car)), su=(lx+lz2*0.6)/gs, sv=ly2/gs, iu=Math.floor(su), iv=Math.floor(sv);
      let best=9, bi=0;
      for(let a=-1;a<=1;a++) for(let b=-1;b<=1;b++){
        const cu=iu+a+H4(iu+a,iv+b,sem,3), cvv=iv+b+H4(iu+a,iv+b,sem,4);
        const dd=Math.hypot(su-cu,sv-cvv)/(0.28+0.22*H4(iu+a,iv+b,sem,5)); if(dd<best&&H4(iu+a,iv+b,sem,6)<st.liquen*0.75){ best=dd; bi=H4(iu+a,iv+b,sem,7); }
      }
      if(best<1&&(best<0.7||hq<0.5)){ const lc=LIQ_COL[(bi*3)|0]; glyph=LIQ_G[((hh*3)|0)%3]; const k=clamp(lum*1.0,0.35,1.15); r=lc[0]*k; gg=lc[1]*k; bb=lc[2]*k; TY[i]=4; }
    }
    const ft=(luz.r||1)*ambF, fg=(luz.g||1)*ambF, fb=(luz.b||1)*ambF;
    G[i]=glyph.charCodeAt(0); C[i]=pack(r*ft,gg*fg,bb*fb);
    if(!TY[i]) TY[i]=1;
  }
  /* facetas: los saltos de normal entre celdas vecinas son filos; se leen con el glifo de su dirección */
  if(S.facetas&&det>=1){
    for(let rr=0;rr<rows-1;rr++) for(let c=0;c<cols-1;c++){
      const i=rr*cols+c; if(!hit[i]||TY[i]>=2) continue;
      const jr=hit[i+1]?i+1:-1, jd=hit[i+cols]?i+cols:-1;
      let gl=0, mul=1;
      if(jr>=0){ const d=NU[i]*NU[jr]+NV_[i]*NV_[jr]+NZ[i]*NZ[jr]; if(d<0.90){ gl=(NU[jr]-NU[i]>0)?'/':'\\'; gl=(Math.abs(NV_[jr]-NV_[i])<0.2)?'|':gl; mul=(LU[jr]>LU[i])?0.78:1.28; } }
      if(!gl&&jd>=0){ const d=NU[i]*NU[jd]+NV_[i]*NV_[jd]+NZ[i]*NZ[jd]; if(d<0.90){ gl=(Math.abs(NU[jd]-NU[i])<0.25)?'_':((NU[jd]-NU[i]>0)?'\\':'/'); mul=(LU[jd]>LU[i])?0.8:1.26; } }
      if(gl){ G[i]=gl.charCodeAt(0); const v=C[i]; C[i]=pack(((v>>16)&255)*mul,((v>>8)&255)*mul,(v&255)*mul); }
    }
  }
  return {G,C,TY,LU};
}

/* Rayo por celda. Devuelve {G,C,cols,rows,c0,R0,...} sin contorno ni suelo. */
function rasterCaja(S,u0,cols,R0,rows,opt){
  const CPM=opt.CPM, HPM=opt.HPM, RPM=opt.RPM, phi=Math.atan2(RPM,HPM), cphi=Math.cos(phi), sphi=Math.sin(phi), K=HPM/cphi;
  const n=cols*rows, HU=new Float32Array(n), HV=new Float32Array(n), HZ=new Float32Array(n), hit=new Uint8Array(n);
  const B=S.box, eps=0.30/CPM, minStep=0.10/CPM, sdf=S.sdf, paso=S.paso, maxIt=S.maxIt||(opt.det>=2?64:44);
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

/* ------------------------------------------------------------------ ROCA: RASTER Y PINTADO ---- */
/* La clave de caché de la luz: redondeada, para que el paso de la hora del día no obligue a rehacer cada roca en cada cuadro. */
const LK=l=>{ const q=(v,k)=>Math.round((v||0)/k); return [q(l.L.x,0.03),q(l.L.y,0.03),q(l.L.z,0.03),q(l.amb,0.04),q(l.r,0.05),q(l.g,0.05),q(l.b,0.05),q(l.porMetro,0.05)].join(','); };
function rasterRoca(S,CPM,HPM,RPM,luz,det){
  const key=CPM+'|'+HPM+'|'+RPM+'|'+LK(luz)+'|'+det;
  if(S._r&&S._r.key===key) return S._r;
  const phi=Math.atan2(RPM,HPM), cphi=Math.cos(phi), sphi=Math.sin(phi), K=HPM/cphi, B=S.box, pad=3;
  const Ytop=B.vmax*cphi+B.zmax*sphi, Ybot=-B.zmax*sphi;
  const cols=Math.ceil((B.umax-B.umin)*CPM)+pad*2+4, c0=Math.round(-B.umin*CPM)+pad+2;
  const u0=-(c0)/CPM;
  const R0=Math.ceil(Ytop*K)+pad, rows=R0+Math.ceil(-Ybot*K)+pad+2;
  const rc=rasterCaja(S,u0,cols,R0,rows,{CPM,HPM,RPM,det});
  const sc=sombrearCeldas(S,rc.HU,rc.HV,rc.HZ,rc.hit,cols,rows,luz,det,{CPM,cphi:rc.cphi,sphi:rc.sphi});
  const out={key,cols,rows,c0,R0,u0,G:sc.G,C:sc.C,TY:sc.TY,hit:rc.hit,HV:rc.HV,HU:rc.HU,HZ:rc.HZ,K,cphi,sphi,CPM,HPM,RPM,fr:{},suelo:null};
  S._r=out; return out;
}
/* Distancia al sólido sobre el plano del suelo, para la tierra y el contacto: se evalúa en la celda de suelo */
function suelo(S,R,luz,det){
  if(R.suelo) return R.suelo;
  const {cols,rows,c0,R0,K,sphi,CPM}=R, M=S.M, st=S.spec.estado, sem=S.spec.sem|0, list=[];
  const collar=0.10*Math.sqrt(S.car)+0.04+st.enterrada*0.30*Math.sqrt(S.car), rowsFloor=Math.ceil(collar*sphi*K)+2;
  for(let r=0;r<rows;r++){
    const Y=(R0-r+0.5)/K; if(Y>0.05) { continue; }
    const zs=-Y/sphi;
    for(let c=0;c<cols;c++){
      if(R.hit[r*cols+c]) continue;
      const u=R.u0+(c+0.5)/CPM; if(u<S.box.umin-collar||u>S.box.umax+collar) continue;
      const d=S.sdf(u,0.02,zs);
      if(d>collar||d<-0.02) continue;
      const rel=clamp(d/collar,0,1);
      list.push([c,r,rel,H4(c,r,sem,21)]);
    }
  }
  R.suelo=list; return list;
}
/* pinta la roca. ctx: put,bc,br,CPM,HPM,RPM,haze,contorno,detalle,cols,rows,elev,nivelAgua,pasto,sueloMat */
function pintar(S,ctx){
  const E=ENT(), CPM=ctx.CPM||13, HPM=ctx.HPM||6.8, RPM=ctx.RPM||HPM/1.7, luz=E.luz(ctx.x||0,ctx.y||0,ctx.t||0);
  const det=ctx.detalle==null?(CPM<8?0:2):ctx.detalle;
  const R=rasterRoca(S,CPM,HPM,RPM,luz,det), put=ctx.put, bc=ctx.bc, br=ctx.br-Math.round((ctx.elev||0)*HPM), hz=ctx.haze==null?1:ctx.haze;
  const cMax=ctx.cols==null?1e9:ctx.cols, rMax=ctx.rows==null?1e9:ctx.rows, sem=S.spec.sem|0, st=S.spec.estado;
  const contorno=ctx.contorno!==false, agua=ctx.nivelAgua;
  const key=(contorno?1:0)+'|'+(agua==null?'':agua)+'|'+(ctx.pasto||0)+'|'+(ctx.sueloMat||'');
  let F=R.fr[key];
  if(!F){
    const {cols,rows}=R, G=R.G.slice(), C=R.C.slice();
    /* tierra y pasto al pie: transición natural entre piedra y suelo */
    const tierra=suelo(S,R,luz,det);
    const bury=st.enterrada;
    for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){
      const i=r*cols+c; if(!R.hit[i]) continue;
      const v=R.HV[i], lim=(0.05+0.35*bury)*Math.min(S.hmax,2.5)*(0.7+0.6*H4(c>>1,0,sem,23));
      if(v<lim&&H4(c,r,sem,24)<sm(1-v/lim)*0.95){ const sc=pal(PAL_SUELO,0.35+0.5*H4(c,r,sem,25)); G[i]=SUELO_G[(H4(c,r,sem,26)*4)|0].charCodeAt(0); C[i]=pack(sc[0],sc[1],sc[2]); }
    }
    for(const [c,r,rel,h] of tierra){
      const pr=(1-rel)*(0.28+0.7*bury)+(rel<0.25?0.18:0);
      if(h<pr){ const i=r*cols+c, sc=pal(PAL_SUELO,0.25+0.6*H4(c,r,sem,27)); const gc=h<pr*0.25?GUIJA[(h*400|0)%5]:SUELO_G[(H4(c,r,sem,28)*4)|0].charCodeAt(0); G[i]=typeof gc==='number'?gc:gc; C[i]=pack(sc[0],sc[1],sc[2]); R.TY[i]=5; }
    }
    if(ctx.pasto){
      const P=ctx.pasto;
      for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){
        const i=r*cols+c; if(!(R.hit[i]&&R.HV[i]<0.20*Math.min(S.hmax,2.2))) continue;
        if(H4(c,r,sem,31)<P*0.55*(1-R.HV[i]/(0.20*Math.min(S.hmax,2.2)))){ const gc=pal([[14,58,36],[28,96,60],[52,140,92],[84,176,118]],0.3+0.6*H4(c,r,sem,32)); G[i]=(H4(c,r,sem,33)<0.5?'"':'*').charCodeAt(0); C[i]=pack(gc[0],gc[1],gc[2]); }
      }
    }
    if(agua!=null){
      for(let i=0;i<G.length;i++) if(R.hit[i]&&R.HV[i]<agua){ const v=C[i], k=0.55, wc=pal(PAL_AGUA,0.35+0.4*H4(i,0,sem,41));
        C[i]=pack(lerp((v>>16)&255,wc[0],k),lerp((v>>8)&255,wc[1],k),lerp(v&255,wc[2],k)); }
    }
    let O=null; if(contorno) O=E.contorno.silueta(G,cols,rows);
    if(O) for(let i=0;i<G.length;i++) if(O[i]){ G[i]=35; C[i]=ORLA; }
    F={G,C}; if(Object.keys(R.fr).length>6) R.fr={}; R.fr[key]=F;
  }
  const {cols,rows,c0,R0}=R;
  for(let r=0;r<rows;r++){
    const rr=br-(R0-r); if(rr<(ctx.rmin||0)||rr>=rMax) continue;
    for(let c=0;c<cols;c++){
      const i=r*cols+c, g=F.G[i]; if(!g) continue;
      const cc=bc+c-c0; if(cc<0||cc>=cMax) continue;
      let col=F.C[i]; if(hz<0.999) col=pack(((col>>16)&255)*hz,((col>>8)&255)*hz,(col&255)*hz);
      put(cc,rr,g,col);
    }
  }
}

/* La sombra proyectada de una roca sobre el suelo: elipsoides a lo largo de la masa, con el desplazamiento por
   altura de la luz. También devuelve el contacto (oscurece justo al pie). */
function sombra(S,ctx){
  const E=ENT(), CPM=ctx.CPM||13, RPM=ctx.RPM||4, luz=E.luz(ctx.x||0,ctx.y||0,ctx.t||0);
  const key=CPM+'|'+RPM+'|'+LK(luz); if(S._s&&S._s.key===key) return S._s.h;
  const cuerpos=[];
  if(S.tipo==='roca'){
    const n=Math.max(2,Math.round(S.a/Math.max(0.2,S.h*0.5)));
    for(let i=0;i<n;i++){ const f=n===1?0:(i/(n-1)-0.5)*2; const rr=Math.sqrt(Math.max(0.15,1-f*f*0.8));
      cuerpos.push({e:f*S.a*0.55*S.cy,h:S.cv,s:f*S.a*0.55*S.sy,re:Math.max(S.a*0.5,0.1)*rr+0.05,rh:S.bh*rr,rs:Math.max(S.c*0.7,0.1),f:0.9}); }
  } else if(S.vert){
    cuerpos.push(...S.cuerposV());
  } else {
    const n=Math.max(2,Math.round(S.W/2));
    for(let i=0;i<n;i++){ const u=(i+0.5)*S.W/n; cuerpos.push({e:u,h:S.Hh*0.5,s:-S.D*0.3,re:S.W/n*0.7,rh:S.Hh*0.5,rs:S.D*0.45,f:0.9}); }
  }
  const h=E.huella(cuerpos,luz,{CPM,RPM,fuerza:0.5});
  S._s={key,h}; return h;
}
function pintarSombra(S,ctx){ const h=sombra(S,ctx), f=ctx.sombrear; if(!f) return h;
  for(let r=0;r<h.h;r++) for(let q=0;q<h.w;q++){ const k=h.k[r*h.w+q]; if(k>0.03) f(ctx.bc+h.c0+q,ctx.br+h.r0+r,k); } return h; }

/* Perturbación de la corriente alrededor de una roca (agua): cola corriente abajo y salpicadura al frente.
   Devuelve celdas {c,r,g,col}; quien dibuja el agua las pone encima. No toca el motor de agua. */
function perturbacion(S,ctx){
  const CPM=ctx.CPM||13, RPM=ctx.RPM||4, sem=S.spec.sem|0, out=[], a=(S.a||S.W/2)*CPM*0.95, b=Math.max(1,(S.c||2)*RPM*0.9), dir=ctx.corriente==null?1:ctx.corriente;
  for(let r=-Math.ceil(b)-2;r<=Math.ceil(b)+2;r++) for(let c=-Math.ceil(a)-4;c<=Math.ceil(a)+Math.ceil(a*3);c++){
    const x=c*dir, d=Math.hypot(x/(a+1),r/(b+1));
    let k=0; if(d>0.85&&d<1.35) k=0.8*(1.35-d)/0.5; else if(x>a*0.6&&Math.abs(r)<b*(1-(x-a*0.6)/(a*3.2))+0.6) k=0.6*(1-(x-a*0.6)/(a*3.2));
    if(k>0&&H4(c,r,sem,51)<k){ const tc=pal(PAL_AGUA,0.55+0.4*H4(c,r,sem,52)); out.push({c:(ctx.bc||0)+c,r:(ctx.br||0)+r,g:((H4(c,r,sem,53)<0.6)?'~':'-').charCodeAt(0),col:pack(tc[0]*1.35,tc[1]*1.35,tc[2]*1.35)}); }
  }
  return out;
}

/* ------------------------------------------------------------------ FORMACIÓN: TRAMOS ---- */
const TRAMO=64;                                    // columnas por tramo
function rasterTramo(F,k,CPM,HPM,RPM,luz,det){
  F._t=F._t||new Map();
  const key=k+'|'+CPM+'|'+HPM+'|'+RPM+'|'+LK(luz)+'|'+det+'|'+(F._v&&F._v[k]||0);
  const hit=F._t.get(k); if(hit&&hit.key===key) return hit;
  const phi=Math.atan2(RPM,HPM), cphi=Math.cos(phi), sphi=Math.sin(phi), K=HPM/cphi, B=F.box, pad=2;
  const Ytop=Math.max(B.vmax*cphi+B.zmax*sphi,B.vmax*cphi-B.zmin*sphi), Ybot=-B.zmax*sphi, R0=Math.ceil(Ytop*K)+pad, rows=R0+Math.ceil(-Ybot*K)+pad+2;
  const u0=k*TRAMO/CPM, cols=Math.min(TRAMO,Math.ceil(F.W*CPM)-k*TRAMO); if(cols<=0) return null;
  /* el sólido es global: el tramo no necesita a sus vecinos, así que se rehace solo */
  const rc=rasterCaja(F,u0,cols,R0,rows,{CPM,HPM,RPM,det});
  const sc=sombrearCeldas(F,rc.HU,rc.HV,rc.HZ,rc.hit,cols,rows,luz,det,{CPM,cphi:rc.cphi,sphi:rc.sphi});
  const out={key,k,cols,rows,R0,u0,G:sc.G,C:sc.C,TY:sc.TY,hit:rc.hit,HV:rc.HV};
  F._t.set(k,out); return out;
}
function invalidarFormacion(F,u0,u1,CPM){
  CPM=CPM||13; F._v=F._v||{}; const a=Math.max(0,Math.floor(u0*CPM/TRAMO)), b=Math.floor(u1*CPM/TRAMO);
  for(let k=a;k<=b;k++) F._v[k]=(F._v[k]||0)+1; F._fr=null; return b-a+1;
}
/* Arma el cuadro completo de la formación (con contorno exterior) y lo pinta */
function pintarFormacion(F,ctx){
  const E=ENT(), CPM=ctx.CPM||13, HPM=ctx.HPM||6.8, RPM=ctx.RPM||HPM/1.7, luz=E.luz(ctx.x||0,ctx.y||0,ctx.t||0);
  const det=ctx.detalle==null?(CPM<8?0:1):ctx.detalle, hz=ctx.haze==null?1:ctx.haze, put=ctx.put, bc=ctx.bc, br=ctx.br;
  const cMax=ctx.cols==null?1e9:ctx.cols, rMax=ctx.rows==null?1e9:ctx.rows, contorno=ctx.contorno!==false, sem=F.spec.sem|0;
  const nT=Math.ceil(F.W*CPM/TRAMO), ven=ctx.ventana||null;      // ventana en columnas relativas: sólo los tramos visibles
  const k0=ven?Math.max(0,Math.floor((ven[0])/TRAMO)):0, k1=ven?Math.min(nT-1,Math.floor(ven[1]/TRAMO)):nT-1;
  const tr=[]; for(let k=k0;k<=k1;k++){ const t=rasterTramo(F,k,CPM,HPM,RPM,luz,det); if(t) tr.push(t); }
  if(!tr.length) return;
  const rows=tr[0].rows, R0=tr[0].R0, totalCols=(k1-k0+1)*TRAMO+2*2, ox=2, key=[k0,k1,contorno,ctx.pasto||0,CPM,HPM,LK(luz),det].join('|')+'|'+tr.map(t=>t.key).join('~');
  let FR=F._fr;
  if(!FR||FR.key!==key){
    const G=new Uint8Array(totalCols*rows), C=new Int32Array(totalCols*rows);
    for(const t of tr){ const off=(t.k-k0)*TRAMO+ox;
      for(let r=0;r<rows;r++) for(let c=0;c<t.cols;c++){ const i=r*t.cols+c; if(!t.G[i]) continue; const j=r*totalCols+off+c; G[j]=t.G[i]; C[j]=t.C[i]; } }
    /* tierra y pasto al pie de la pared: una franja de transición, no un corte limpio */
    for(const t of tr){ const off=(t.k-k0)*TRAMO+ox;
      for(let r=0;r<rows;r++) for(let c=0;c<t.cols;c++){ const i=r*t.cols+c; if(!t.hit[i]) continue; const v=t.HV[i];
        const lim=0.30+0.5*H4(c>>2,t.k,sem,61), hh=H4(c+t.k*TRAMO,r,sem,62);
        if(v<lim&&hh<sm(1-v/lim)*0.85){ const sc=pal(PAL_SUELO,0.3+0.5*H4(c,r,sem,63)); const j=r*totalCols+off+c; G[j]=SUELO_G[(hh*4*1.17|0)%4].charCodeAt(0); C[j]=pack(sc[0],sc[1],sc[2]); }
        else if(ctx.pasto&&v<lim*1.8&&hh<ctx.pasto*0.4){ const gc=pal([[14,58,36],[28,96,60],[52,140,92],[84,176,118]],0.3+0.6*H4(c,r,sem,64)); const j=r*totalCols+off+c; G[j]=(hh<0.2?'"':'*').charCodeAt(0); C[j]=pack(gc[0],gc[1],gc[2]); }
      } }
    if(contorno){ const O=E.contorno.silueta(G,totalCols,rows); for(let i=0;i<G.length;i++) if(O[i]){ G[i]=35; C[i]=ORLA; } }
    FR=F._fr={key,G,C,totalCols,rows,R0,ox};
  }
  const base=ctx.bc+k0*TRAMO-ox;
  for(let r=0;r<FR.rows;r++){
    const rr=br-(FR.R0-r); if(rr<(ctx.rmin||0)||rr>=rMax) continue;
    for(let c=0;c<FR.totalCols;c++){
      const i=r*FR.totalCols+c, g=FR.G[i]; if(!g) continue;
      const cc=base+c; if(cc<0||cc>=cMax) continue;
      let col=FR.C[i]; if(hz<0.999) col=pack(((col>>16)&255)*hz,((col>>8)&255)*hz,(col&255)*hz);
      put(cc,rr,g,col);
    }
  }
}

/* ------------------------------------------------------------------ AGRUPACIONES ----
   Devuelve [{spec,x,y,elev}] en metros relativos al centro del grupo. Nada en retícula: puntos al azar con
   separación según el tamaño de cada piedra, los grandes primero. */
const GRUPOS={
  pequeno:{nombre:'Pequeño grupo de piedras',n:[6,10],r:[1.4,1.4],mix:{pequena:1}},
  arbol:{nombre:'Rocas alrededor de un árbol',n:[4,7],anillo:[1.1,2.4],mix:{pequena:0.45,media:0.55}},
  bloques:{nombre:'Grandes bloques agrupados',n:[3,5],r:[3.2,2.2],mix:{grande:0.6,media:0.3,pequena:0.1},apila:true},
  piedemonte:{nombre:'Acumulación al pie de una montaña',n:[14,22],r:[7,2.2],mix:{grande:0.18,media:0.37,pequena:0.45},banda:true},
  rio:{nombre:'Formación rocosa junto a un río',n:[7,11],r:[6,1.6],mix:{grande:0.2,media:0.4,pequena:0.4},rio:true},
  ladera:{nombre:'Ladera con piedras dispersas',n:[12,18],r:[8,4],mix:{media:0.3,pequena:0.7},ladera:true},
  penascos:{nombre:'Conjunto de peñascos',n:[5,8],r:[6,3],mix:{grande:0.7,media:0.3}}
};
const GRUPOS_ID=Object.keys(GRUPOS);
function grupo(tipo,sem,opt){
  const G=GRUPOS[tipo]; if(!G) throw new Error('grupo desconocido: '+tipo);
  opt=opt||{}; const rnd=NV.mulberry((sem*2654435+GRUPOS_ID.indexOf(tipo)*7919)|0), out=[];
  const n=Math.round(lerp(G.n[0],G.n[1],rnd())*(opt.densidad==null?1:opt.densidad));
  const mats=opt.materiales||[opt.mat||'granito'];
  const pickT=()=>{ let r=rnd(),acc=0; for(const k in G.mix){ acc+=G.mix[k]; if(r<acc) return k; } return Object.keys(G.mix)[0]; };
  const formas={pequena:['redondeada','angular','plana','irregular','ovalada'],media:['redondeada','angular','plana','irregular','alargada','fracturada','estratificada'],grande:['redondeada','fracturada','angular','irregular','erosionada','estratificada']};
  const cand=[]; for(let i=0;i<n;i++) cand.push(pickT());
  cand.sort((a,b)=>TAMS.indexOf(b)-TAMS.indexOf(a));
  const rad={pequena:0.55,media:1.1,grande:2.0};
  for(const tam of cand){
    let ok=false, x=0, y=0;
    for(let it=0;it<40&&!ok;it++){
      if(G.anillo){ const a=rnd()*6.283, r=lerp(G.anillo[0],G.anillo[1],rnd()); x=Math.cos(a)*r*1.3; y=Math.sin(a)*r*0.7; }
      else if(G.banda){ x=(rnd()-0.5)*G.r[0]*2; y=-rnd()*G.r[1]*(0.4+rnd()); }
      else if(G.rio){ x=(rnd()-0.5)*G.r[0]*2; y=(rnd()-0.5)*G.r[1]*2*(0.4+0.6*Math.sin(x*0.5)*0.5+0.5); }
      else if(G.ladera){ x=(rnd()-0.5)*G.r[0]*2; y=(rnd()-0.5)*G.r[1]*2; if(rnd()<0.35*(y<0?1:0)) continue; }
      else { const a=rnd()*6.283, r=Math.sqrt(rnd()); x=Math.cos(a)*r*G.r[0]; y=Math.sin(a)*r*G.r[1]; }
      ok=true; for(const o of out){ const rr=(rad[tam]+rad[o.spec.tam])*0.62*(opt.separacion==null?1:opt.separacion); if(Math.hypot((x-o.x)/1.3,(y-o.y)/0.75)<rr) { ok=false; break; } }
    }
    if(!ok) continue;
    const mat=mats[(rnd()*mats.length)|0], fl=formas[tam], forma=fl[(rnd()*fl.length)|0];
    const estado={musgo:opt.musgo!=null?opt.musgo:(rnd()<0.35?0.3+rnd()*0.5:0),liquen:opt.liquen!=null?opt.liquen:(rnd()<0.3?0.3+rnd()*0.5:0),humedad:opt.humedad!=null?opt.humedad:(G.rio?0.6:0),erosion:rnd()*0.4,enterrada:tam==='pequena'?rnd()*0.35:rnd()*0.5};
    const spec={mat,tam,forma,estado,sem:(rnd()*1e6)|0,escala:0.85+rnd()*0.3,yaw:rnd()*6.28};
    const el={spec,x,y,elev:0,agua:G.rio&&y>0?0.25+rnd()*0.4:null};
    out.push(el);
    if(G.apila&&tam==='grande'&&rnd()<0.6&&out.length<n){ out.push({spec:{mat,tam:'media',forma:'irregular',estado:Object.assign({},estado),sem:(rnd()*1e6)|0,escala:0.8,yaw:rnd()*6.28},x:x+(rnd()-0.5)*1.0,y:y-0.2,elev:(TAMANOS.grande[0]+TAMANOS.grande[1])*0.25*0.9,agua:null}); }
  }
  out.sort((a,b)=>a.y-b.y);
  return {tipo,sem,rocas:out};
}

/* ------------------------------------------------------------------ CATÁLOGO ---- */
const catalogo=()=>{
  const o=[];
  for(const t of TAMS) for(const f of FORMAS) o.push({id:t+':'+f,tam:t,forma:f,nombre:f+' ('+t+')'});
  for(const t of TIPOS) o.push({id:'formacion:'+t,tipo:t,nombre:TIPOS_FORM[t].nombre});
  return o;
};
const pintarGrupo=(Gp,ctx)=>{
  const sol=[];
  for(const e of Gp.rocas){ const S=e.S||(e.S=crearRoca(e.spec)); sol.push([e,S]); }
  for(const [e,S] of sol) if(ctx.sombrear) pintarSombra(S,Object.assign({},ctx,{bc:ctx.bc+Math.round(e.x*(ctx.CPM||13)),br:ctx.br+Math.round(e.y*(ctx.RPM||4))}));
  for(const [e,S] of sol) pintar(S,Object.assign({},ctx,{bc:ctx.bc+Math.round(e.x*(ctx.CPM||13)),br:ctx.br+Math.round(e.y*(ctx.RPM||4)),elev:e.elev||0,nivelAgua:e.agua==null?ctx.nivelAgua:e.agua,haze:(ctx.haze==null?1:ctx.haze)*(1-0.012*Math.max(0,-e.y))}));
};

NV.rocoso={MATERIALES,MATS,TAMANOS,TAMS,FORMAS,TIPOS_FORM,TIPOS,GRUPOS,GRUPOS_ID,ESTADO0,
  crearRoca,crearFormacion,pieDe,aObjeto,previa,raster:rasterRoca,pintar,pintarFormacion,invalidarFormacion,sombra,pintarSombra,perturbacion,grupo,pintarGrupo,catalogo,ORLA,TRAMO};

/* ------------------------------------------------------------------ MODO DIOS ----
   Lo que este motor ofrece para colocar (cara "objetos") y para diseñar a mano (cara "creador"). Un objeto del
   mundo es {k:'rocoso', r:receta, h, s, fx, fy}: la receta es el spec del motor, tal cual; el resto lo derivan
   el mundo (ocupación) y el dibujo (altura para el reflejo). Regenerar = otra semilla con la misma receta. */
const azarEd=()=>(NV.azarEditor||Math.random)();
const nuevaSem=()=>((azarEd()*60000)|0)+1;
const clon=o=>JSON.parse(JSON.stringify(o));
const ROCA0={mat:'granito',tam:'media',forma:'irregular',escala:1,yaw:0,estado:{musgo:0,liquen:0,humedad:0,erosion:0,enterrada:0}};
const FORM0={tipo:'acantilado',mat:'caliza',orient:'sur',ancho:24,inclinacion:0,pie:true,estado:{musgo:0.3,liquen:0.2,humedad:0.1,erosion:0,enterrada:0}};
const DISENO={};                                   // el último diseño de cada entrada: lo que se coloca "otra vez"
const ID_ROCA='rocoso:roca', ID_FORM='rocoso:formacion';
const idDe=spec=>spec&&spec.tipo?ID_FORM:ID_ROCA;
function limpiar(spec){
  const o=clon(spec); o.estado=Object.assign({},ESTADO0,o.estado);
  if(o.tipo){ o.ancho=clamp(+o.ancho||24,3,48); } else { o.escala=clamp(+o.escala||1,0.3,3); }
  return o;
}
function aObjeto(spec){
  const r=limpiar(spec), S=r.tipo?crearFormacion(r):crearRoca(r);
  const fx=r.tipo?(S.vert?Math.min(8,Math.ceil(S.W/2)):Math.ceil(S.W/2)):Math.min(6,Math.round(S.a)), fy=r.tipo?(S.vert?Math.ceil(S.largo/2):Math.min(4,Math.ceil(S.D*0.5))):Math.min(6,Math.round(S.c));
  const ob={k:'rocoso',r,h:+S.hmax.toFixed(2),s:r.sem|0,fx,fy};
  if(S.vert) ob.dy=fy;       // un muro de norte a sur se dibuja por su punta sur (ver paneles.objetosEn)
  return ob;
}
const baseDe=id=>clon(id===ID_FORM?FORM0:ROCA0);
const paraPaleta=[
  {id:ID_ROCA,nombre:'Roca (diseñar)',etiqueta:'Roca diseñada',k:'rocoso',disenar:true,encaja:o=>o.k==='rocoso'&&!!o.r&&!o.r.tipo},
  {id:ID_FORM,nombre:'Formación (diseñar)',etiqueta:'Formación diseñada',k:'rocoso',disenar:true,encaja:o=>o.k==='rocoso'&&!!o.r&&!!o.r.tipo}];
const opc=(obj)=>Object.keys(obj).map(k=>[k,obj[k]]);
const NOM_MAT=MATS.reduce((a,k)=>{ a[k]=MATERIALES[k].nombre; return a; },{});
const NOM_TAM={pequena:'Pequeña',media:'Mediana',grande:'Grande'};
const NOM_FORMA={redondeada:'Redondeada',ovalada:'Ovalada',angular:'Angular',afilada:'Afilada',plana:'Plana',alargada:'Alargada',irregular:'Irregular',estratificada:'Estratificada',fracturada:'Fracturada',erosionada:'Erosionada'};
const NOM_TIPO=TIPOS.reduce((a,k)=>{ a[k]=TIPOS_FORM[k].nombre; return a; },{});
const ESTADOS_CAMPOS=[
  {ruta:'estado.musgo',etq:'Musgo',tipo:'rng',min:0,max:1,paso:0.05,grupo:'Estado'},
  {ruta:'estado.liquen',etq:'Líquenes',tipo:'rng',min:0,max:1,paso:0.05,grupo:'Estado'},
  {ruta:'estado.humedad',etq:'Humedad',tipo:'rng',min:0,max:1,paso:0.05,grupo:'Estado'}];
const CAMPOS={
  [ID_ROCA]:[
    {ruta:'mat',etq:'Material',tipo:'sel',opciones:opc(NOM_MAT),grupo:'Piedra'},
    {ruta:'tam',etq:'Tamaño',tipo:'sel',opciones:opc(NOM_TAM),grupo:'Piedra'},
    {ruta:'forma',etq:'Forma',tipo:'sel',opciones:opc(NOM_FORMA),grupo:'Piedra'},
    {ruta:'escala',etq:'Escala',tipo:'rng',min:0.5,max:2,paso:0.05,grupo:'Piedra'},
    {ruta:'yaw',etq:'Orientación',tipo:'rng',min:0,max:6.28,paso:0.1,fmt:'grados',grupo:'Piedra'}]
    .concat(ESTADOS_CAMPOS,[
    {ruta:'estado.erosion',etq:'Erosión',tipo:'rng',min:0,max:1,paso:0.05,grupo:'Estado'},
    {ruta:'estado.enterrada',etq:'Parcialmente enterrada',tipo:'rng',min:0,max:1,paso:0.05,grupo:'Estado'}]),
  [ID_FORM]:[
    {ruta:'tipo',etq:'Tipo',tipo:'sel',opciones:opc(NOM_TIPO),grupo:'Formación'},
    {ruta:'mat',etq:'Material',tipo:'sel',opciones:opc(NOM_MAT),grupo:'Formación'},
    {ruta:'orient',etq:'Orientación',tipo:'sel',opciones:[['sur','Horizontal · cara al sur'],['este','Vertical · cara al este'],['oeste','Vertical · cara al oeste']],grupo:'Formación'},
    {ruta:'ancho',etq:'Largo (m)',tipo:'rng',min:3,max:48,paso:1,grupo:'Formación'},
    {ruta:'fondo',etq:'Fondo (m)',tipo:'rng',min:0,max:12,paso:1,auto:0,grupo:'Formación'},
    {ruta:'alto',etq:'Alto (m)',tipo:'rng',min:0,max:18,paso:1,auto:0,grupo:'Formación'},
    {ruta:'estrato',etq:'Grosor de estrato (m)',tipo:'rng',min:0,max:3,paso:0.1,auto:0,grupo:'Estructura'},
    {ruta:'columnas',etq:'Columnas (m)',tipo:'rng',min:-0.5,max:8,paso:0.5,auto:-0.5,grupo:'Estructura'},
    {ruta:'erosion',etq:'Canales de erosión',tipo:'rng',min:-0.05,max:1,paso:0.05,auto:-0.05,grupo:'Estructura'},
    {ruta:'derrumbe',etq:'Derrumbe al pie',tipo:'rng',min:-0.05,max:1,paso:0.05,auto:-0.05,grupo:'Estructura'},
    {ruta:'inclinacion',etq:'Inclinación',tipo:'rng',min:-0.4,max:0.4,paso:0.05,def:0,grupo:'Estructura'},
    {ruta:'pie',etq:'Rocas sueltas al pie',tipo:'chk',grupo:'Estructura'}].concat(ESTADOS_CAMPOS)};
/* Las rocas sueltas al pie de una formación: posiciones en metros desde su borde izquierdo (x) y hacia el sur (y) */
function pieDe(F){
  if(F._pie) return F._pie;
  const sp=F.spec, G=grupo('piedemonte',sp.sem|0,{mat:sp.mat,densidad:(F.vert?F.largo:F.W)/20}), out=[];
  if(F.vert){   // al pie del lado que mira: x desde el borde izquierdo, y hacia el sur desde la punta sur del muro
    const L=F.largo, este=F.lado==='este', borde=este?F.fondoReal:Math.max(0.6,F.box.zmax);
    for(const e of G.rocas){ const s2=Object.assign({},e.spec,{escala:(e.spec.escala||1)*0.55}), a=clamp(L/2+e.x*(L/14),0.5,L-0.5);
      out.push({S:crearRoca(s2),x:borde+(este?1:-1)*(0.8+Math.abs(e.y)*0.35),y:a-L}); }
    return F._pie=out;
  }
  for(const e of G.rocas){ const s2=Object.assign({},e.spec,{escala:(e.spec.escala||1)*0.55}); out.push({S:crearRoca(s2),x:F.W/2+e.x*(F.W/14),y:0.8+Math.abs(e.y)*0.35}); }
  return F._pie=out;
}
/* La escena de vista previa de un diseño: tamaño en metros, zoom y qué se pinta (el que la dibuja pone suelo, luz y put) */
const PCACHE=new Map();
const solidoDe=r=>{ const k=JSON.stringify(r); let S=PCACHE.get(k); if(!S){ if(PCACHE.size>24) PCACHE.clear(); S=r.tipo?crearFormacion(r):crearRoca(r); PCACHE.set(k,S); } return S; };
function previa(spec,opt){
  opt=opt||{}; const r=limpiar(spec);
  if(r.tipo){
    const F=solidoDe(r);
    if(F.vert){
      const mw=Math.ceil(F.W)+6, mh=Math.ceil(F.Hh*1.7+F.largo)+5, cy=mh-3, X0=F.lado==='este'?1:3;
      const items=[{x:X0,y:cy,pintar:ctx=>{ pintarSombra(F,ctx); pintarFormacion(F,ctx); }}];
      if(r.pie!==false) for(const e of pieDe(F)) items.push({x:X0+e.x,y:cy+e.y,pintar:ctx=>{ pintarSombra(e.S,ctx); pintar(e.S,ctx); }});
      return {mw,mh,z:opt.rapido?0.5:(F.largo>22?0.7:1),items,S:F,pan:0,vis:F.W,detalle:'alto '+F.Hh.toFixed(1)+' m · largo '+F.largo+' m · cara al '+F.lado};
    }
    const vis=Math.min(F.W,16), pan=clamp(opt.pan||0,0,1)*(F.W-vis), mw=Math.ceil(vis)+2, mh=Math.ceil(F.Hh*1.7+F.D+5), cy=mh-3;
    const items=[{x:1,y:cy,pintar:ctx=>{ const C=ctx.CPM; ctx.bc=Math.round(1*C)-Math.round(pan*C); ctx.ventana=[pan*C-4,(pan+vis)*C+4]; pintarSombra(F,ctx); pintarFormacion(F,ctx); }}];
    if(r.pie!==false) for(const e of pieDe(F)){ const x=1+e.x-pan; if(x<-1.5||x>vis+3.5) continue;
      items.push({x,y:cy+e.y,pintar:ctx=>{ pintarSombra(e.S,ctx); pintar(e.S,ctx); }}); }
    return {mw,mh,z:opt.rapido?0.5:1,items,S:F,pan,vis,detalle:'alto '+F.Hh.toFixed(1)+' m · ancho '+F.W+' m'};
  }
  const S=solidoDe(r), z=({pequena:3,media:2,grande:1})[r.tam]||1, ub=S.box.umax, zm=S.box.zmax;
  const mw=Math.max(Math.ceil(ub*2)+2,r.tam==='pequena'?3:5), mh=Math.ceil(S.h*1.7+zm)+2;
  return {mw,mh,z,S,items:[{x:mw/2,y:mh-(zm+0.6),pintar:ctx=>{ pintarSombra(S,ctx); pintar(S,ctx); }}],detalle:S.h.toFixed(2)+' m de alto'};
}
const resumen=o=>{ const r=o.r; return r.tipo?(NOM_TIPO[r.tipo]+' · '+NOM_MAT[r.mat]+' · '+r.ancho+' m de '+(r.orient==='este'||r.orient==='oeste'?'largo, vertical al '+r.orient:'ancho')):(NOM_MAT[r.mat]+' · '+NOM_TAM[r.tam].toLowerCase()+' · '+NOM_FORMA[r.forma].toLowerCase()); };

if(NV.entorno) NV.entorno.conectar('rocoso',{viento:[],luz:true,sombra:true,contorno:true});
if(NV.motores) NV.motores.registrar({id:'rocoso',nombre:'Rocas, peñascos y formaciones',estado:'integrado',
  archivo:'src/juego/rocoso.js',preview:'preview/rocoso.html',prueba:'pruebas/rocoso.js',
  caras:{generar:o=>o&&o.tipo?crearFormacion(o):crearRoca(o), dibujar:(ctx,S)=>S.tipo==='formacion'?pintarFormacion(S,ctx):pintar(S,ctx),
    objetos:{
      catalogo:()=>paraPaleta,
      crear:id=>aObjeto(Object.assign(clon(DISENO[id]||baseDe(id)),{sem:nuevaSem()})),
      variar:o=>aObjeto(Object.assign(clon(o.r),{sem:nuevaSem()}))
    },
    creador:{
      titulo:id=>id===ID_FORM?'Diseñar una formación':'Diseñar una roca',
      campos:id=>CAMPOS[id]||CAMPOS[ID_ROCA],
      nuevo:id=>Object.assign(clon(DISENO[id]||baseDe(id)),{sem:nuevaSem()}),
      variar:spec=>Object.assign(clon(spec),{sem:nuevaSem()}),
      aObjeto, deObjeto:o=>({id:idDe(o.r),spec:clon(o.r)}), idDe,
      recordar:(id,spec)=>{ DISENO[id]=clon(spec); },
      previa, resumen
    },
    editor:{materiales:NOM_MAT, tamanos:TAMS, formas:FORMAS, formaciones:TIPOS,
      estado:{musgo:[0,1],liquen:[0,1],humedad:[0,1],erosion:[0,1],enterrada:[0,1]},
      parametros:{escala:[0.5,2],yaw:[0,6.28],detalle:[0,2],contorno:[false,true]},
      conexiones:['luz y sombra proyectada','contorno compartido (silueta exterior)','sin viento'],
      herramientas:['colocar','eliminar','regenerar','diseñar (ventana del Modo Dios)','formación: trazar y editar tramos']}}});
})(window.NV);

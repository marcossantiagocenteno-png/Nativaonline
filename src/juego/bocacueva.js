/* Nativa Online — ENTRADAS DE CUEVA: la boca vista desde afuera.
   Un objeto del mundo {k:'bocacueva', r:receta, fx, fy, occ, um, dirIn}. Es una masa de roca en 3D (no un dibujo plano) con un túnel tallado
   que SIEMPRE se genera: ahí está la boca, el hueco por donde se entra y por donde se sale. Se dibuja con la cámara del juego (lanzando un rayo por
   casilla de pantalla, como las cuevas y las rocas), así se ve igual de frente, en tres cuartos o de lado: sólo gira la masa.

   Receta r = {tipo, cara, mat, ancho, alto, prof, boca, forma, pasto, rocas, veg, edad, musgo, sem}. Todo en metros.
     · tipo: 'muro' (pared de roca), 'monticulo' (loma de pasto con la roca asomando alrededor de la boca), 'penasco' (varias rocas amontonadas).
     · cara: hacia dónde mira la boca: sur (de frente), sureste / suroeste (tres cuartos), este / oeste (de lado).
     · forma de la boca: arco redondo, irregular, baja y ancha, alta y angosta.
     · pasto, rocas (bloques alrededor), veg (arbustos y enredadera), edad (desgaste), musgo.
   El origen es la casilla de AFUERA, delante de la boca (la casilla donde está el objeto). `occ` son las casillas sólidas (las saca de la forma:
   la boca queda libre), `um` es la casilla de adentro del túnel donde va el Umbral (se pone solo al colocar) y `dirIn` hacia dónde se cruza.

   La imagen de cada receta se hornea por bandas de filas, sólo las que se ven, a una resolución de referencia y se escala al zoom del juego.
   Pruebas: pruebas/subescenas.js */
(function(NV){
'use strict';
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const ID='bocacueva:entrada';
const MATS=['caliza','basalto','arenisca','hielo'];
const CARAS={sur:[0,1],sureste:[0.70711,0.70711],suroeste:[-0.70711,0.70711],este:[0.9397,0.3420],oeste:[-0.9397,0.3420]};      // de lado va ladeada 20° hacia la cámara: si no, la boca queda exactamente de canto y no se ve
const ENTRA={sur:'norte',sureste:'noroeste',suroeste:'noreste',este:'oeste',oeste:'este'};      // hacia dónde se cruza (adentro)
const CARA_TXT=[['sur','Sur · de frente'],['sureste','Sureste · tres cuartos'],['suroeste','Suroeste · tres cuartos'],['este','Este · de lado'],['oeste','Oeste · de lado']];
const TIPO_TXT=[['muro','Pared de roca'],['monticulo','Montículo con pasto'],['penasco','Peñasco']];
const FORMA_TXT=[['arco','Arco redondo'],['irregular','Irregular'],['baja','Baja y ancha'],['alta','Alta y angosta']];
const azar=()=>(((NV.azarEditor||Math.random)()*1e6)|0)+1;
const sm=u=>u*u*(3-2*u);
function H4(a,b,c,d){ let h=Math.imul(a|0,374761393)^Math.imul(b|0,668265263)^Math.imul(c|0,1274126177)^Math.imul(d|0,2147483629); h=Math.imul(h^(h>>>13),1274126177); return ((h^(h>>>16))>>>0)/4294967296; }
function vn(x,y,z,s){
  const X=Math.floor(x), Y=Math.floor(y), Z=Math.floor(z), fx=sm(x-X), fy=sm(y-Y), fz=sm(z-Z);
  const a=H4(X,Y,Z,s), b=H4(X+1,Y,Z,s), c=H4(X,Y+1,Z,s), d=H4(X+1,Y+1,Z,s), e=H4(X,Y,Z+1,s), f=H4(X+1,Y,Z+1,s), g=H4(X,Y+1,Z+1,s), h=H4(X+1,Y+1,Z+1,s);
  const l0=a+(b-a)*fx, l1=c+(d-c)*fx, l2=e+(f-e)*fx, l3=g+(h-g)*fx, m0=l0+(l1-l0)*fy, m1=l2+(l3-l2)*fy; return m0+(m1-m0)*fz;
}
const MATERIALES=()=>(NV.cuevas&&NV.cuevas.MATERIALES)||{caliza:{ramp:['.',':','-','=','%','M'],pal:[[12,12,15],[30,29,33],[58,55,56],[92,86,82],[130,121,110],[172,160,142]],estrato:1}};
function pal(p,t){ const n=p.length-1, x=clamp(t,0,1)*n, i=Math.min(n-1,x|0), f=x-i, a=p[i], b=p[i+1]; return [a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f,a[2]+(b[2]-a[2])*f]; }
const pack=(r,g,b)=>(clamp(r|0,0,255)<<16)|(clamp(g|0,0,255)<<8)|clamp(b|0,0,255);
const PAL_PASTO=[[14,36,18],[30,70,30],[54,108,40],[92,146,52],[138,176,72]], PAL_HOJA=[[8,28,16],[18,52,24],[34,86,34],[60,124,46],[100,160,60]], PAL_MUSGO=[[10,34,26],[20,58,40],[34,88,52],[58,122,66],[92,156,84]];
const G_PASTO=[',',"'",'`','"'], G_HOJA=['*','%','°',';'], G_MUSGO=['°','*','°',';'];

function limpiar(r){
  r=r||{};
  const tipo=TIPO_TXT.some(t=>t[0]===r.tipo)?r.tipo:'muro', forma=FORMA_TXT.some(t=>t[0]===r.forma)?r.forma:'arco';
  const ancho=clamp(+r.ancho||9,3,22);
  return {tipo, cara:CARAS[r.cara]?r.cara:'sur', mat:MATS.indexOf(r.mat)>=0?r.mat:'caliza', ancho,
    alto:clamp(+r.alto||4.4,1.6,9), prof:clamp(+r.prof||6,4,12), boca:clamp(r.boca==null?2.8:+r.boca,1.6,Math.max(1.6,Math.min(5.5,ancho*0.75))), forma,
    pasto:clamp(r.pasto==null?(tipo==='monticulo'?0.7:0.2):+r.pasto,0,1), rocas:clamp(r.rocas==null?0.4:+r.rocas,0,1), veg:clamp(r.veg==null?0.3:+r.veg,0,1),
    edad:clamp(r.edad==null?0.5:+r.edad,0,1), musgo:clamp(r.musgo==null?0.4:+r.musgo,0,1), sem:(r.sem|0)||azar()};
}
const base=()=>limpiar({});

/* ------------------------------------------------------------------ LA FORMA ----
   Coordenadas del mundo (U este, v arriba, z sur) con el origen en la casilla de afuera. Adentro se mide en el sistema de la boca:
   s = hacia afuera (positivo = fuera de la roca), a = a lo ancho. La cara de la roca está en s = −1. */
const GEO=new Map();
function armar(r){
  const key=JSON.stringify(r); let G=GEO.get(key); if(G) return G;
  const [ox,oz]=CARAS[r.cara], lx=-oz, lz=ox, W=r.ancho, H=r.alto, P=r.prof, sem=r.sem, cs=-1-P/2, td=clamp(P*0.85,3.4,8);
  const w=r.boca, forma=r.forma;
  let hb=forma==='baja'?w*0.58:forma==='alta'?w*1.7:w*1.05+0.3; hb=Math.max(1.1,Math.min(hb,H*0.85)); const hs=hb*0.4, irr=forma==='irregular'?0.7:0.12;
  const disp=0.45+0.7*r.edad, R=k=>H4(k,3,sem,9);
  const ac=-Math.max(0,W/2-w/2-0.8)*lz;                                      // de lado la masa se corre al norte: la boca queda en su extremo y nada cae al sur del punto

  /* los bloques y los arbustos de alrededor (en coordenadas del mundo) */
  const BL=[], VG=[];
  const aMundo=(a,s)=>[a*lx+s*ox,a*lz+s*oz];
  for(let k=0,n=Math.round(2+r.rocas*10);k<n;k++){
    const a=ac+(R(k*5+1)*2-1)*(W/2+1.4), s=-R(k*5+2)*(P+0.8)+0.3, rad=0.3+R(k*5+3)*(0.45+r.rocas*0.9)*Math.min(1.4,H/3);
    if(Math.abs(a)<w/2+rad+0.5&&s>-td-0.5) continue;                          // no tapan la boca
    const [U,z]=aMundo(a,s); if(z>0.45-rad*0.4) continue; BL.push([U,rad*0.45,z,rad]);
  }
  for(let k=0,n=Math.round(r.veg*16);k<n;k++){
    const a=ac+(R(k*7+40)*2-1)*(W/2+1.2), s=-R(k*7+41)*(P+0.6)+0.2, rad=0.3+R(k*7+42)*0.5, alta=R(k*7+43)<0.3&&r.tipo!=='monticulo';
    const [U,z]=aMundo(a,s); if(z>0.45-rad*0.4) continue;
    if(Math.abs(a)<w/2+rad*0.6&&s>-td-0.5) continue;
    VG.push([U,alta?H*(0.55+0.4*R(k+90)):rad*0.5,z,rad]);
  }
  const PEN=[[0,0,1,1,1],[(R(60)*2-1)*W*0.3,0,0.7,0.7,0.8],[(R(61)*2-1)*W*0.3,0,0.6,0.55,0.9]];
  const D=[0,0,0];
  function masa(a,s,v){
    a-=ac;
    if(r.tipo==='monticulo'){
      const Ra=W/2, Rs=P/2+0.6, Rv=H*1.05, k=Math.sqrt((a/Ra)*(a/Ra)+((s-cs)/Rs)*((s-cs)/Rs)+(v/Rv)*(v/Rv));
      let d=(k-1)*Math.min(Ra,Rs,Rv)*0.85;
      const oa=Math.min(W*0.3,3.4), oh=Math.min(H*0.75,3.4), qa=Math.abs(a)-(oa-0.6), qs=Math.abs(s-(-1-1.5))-(1.5-0.6), qv=Math.abs(v-(oh/2-0.6))-((oh+1.2)/2-0.6);
      d=Math.min(d,Math.sqrt(Math.max(qa,0)**2+Math.max(qs,0)**2+Math.max(qv,0)**2)+Math.min(Math.max(qa,qs,qv),0)-0.6);
      return d;
    }
    let d=1e9;
    const n=r.tipo==='penasco'?3:1;
    for(let i=0;i<n;i++){
      const p=PEN[i], hw=(W/2)*p[2]*(r.tipo==='penasco'?0.8:1), hp=(P/2)*p[3], hh=(H*p[4]+1.2)/2, ca=r.tipo==='penasco'?p[0]:0, rr=Math.min(1.1,hw*0.3,hh*0.4);
      const wv=r.tipo==='muro'?1-0.18*Math.max(0,v/H):1;
      const qa=Math.abs(a-ca)-(hw*wv-rr), qs=Math.abs(s-(cs+(i?(R(70+i)*2-1)*P*0.15:0)))-(hp-rr), qv=Math.abs(v-(H*p[4]-1.2)/2)-(hh-rr);
      d=Math.min(d,Math.sqrt(Math.max(qa,0)**2+Math.max(qs,0)**2+Math.max(qv,0)**2)+Math.min(Math.max(qa,qs,qv),0)-rr);
    }
    return d;
  }
  /* deja en D = [roca, vegetación, túnel (negativo = adentro del hueco)] y devuelve la distancia al conjunto */
  function medir(U,v,z){
    const s=U*ox+z*oz, a=U*lx+z*lz;
    const dm=masa(a,s,v)+(vn(U*0.8,v*0.8,z*0.8,sem)-0.5)*disp;
    /* el túnel: sección (a,v) extruida hacia adentro hasta td; el piso (v<0) queda sólido */
    const wr=(w/2)*(1+irr*(vn(a*0.9+3,v*0.9,s*0.2,sem+5)-0.5)*2), ex=Math.abs(a)/wr, ey=Math.max(0,v-hs)/Math.max(0.2,hb-hs);
    const sh=(Math.sqrt(ex*ex+ey*ey)-1)*wr*0.8;
    const carve=Math.max(sh,-(s+td),-v);
    let dr=Math.max(dm,-carve);
    for(let i=0;i<BL.length;i++){ const b=BL[i], dx=U-b[0], dy=v-b[1], dz=z-b[2]; dr=Math.min(dr,Math.sqrt(dx*dx+dy*dy+dz*dz)-b[3]+(vn(U*2.1,v*2.1,z*2.1,sem+13)-0.5)*0.35); }
    let dv=1e9;
    for(let i=0;i<VG.length;i++){ const b=VG[i], dx=U-b[0], dy=v-b[1], dz=z-b[2]; dv=Math.min(dv,Math.sqrt(dx*dx+dy*dy+dz*dz)-b[3]+(vn(U*3.3,v*3.3,z*3.3,sem+17)-0.5)*0.45); }
    D[0]=dr; D[1]=dv; D[2]=carve; return Math.min(dr,dv);
  }
  /* la caja: las esquinas de la masa girada, más lo de alrededor */
  const ex=W/2+2.2, es=[[ac+ex,-P-1.8],[ac+ex,0.5],[ac-ex,-P-1.8],[ac-ex,0.5]];
  let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;
  for(const [a,s] of es){ const [U,z]=aMundo(a,s); x0=Math.min(x0,U); x1=Math.max(x1,U); z0=Math.min(z0,z); z1=Math.max(z1,z); }
  const box={umin:x0,umax:x1,zmin:z0,zmax:z1,vmin:-0.5,vmax:H+1.4};
  /* las casillas sólidas (a media altura, sin la vegetación) y dónde va el umbral */
  const occ=[], oc=new Set(); let fx=0, fy=0;
  for(let dy=Math.floor(box.zmin)-1;dy<=Math.ceil(box.zmax);dy++) for(let dx=Math.floor(box.umin)-1;dx<=Math.ceil(box.umax);dx++){
    medir(dx,0.7,dy); if(D[0]<0.12){ occ.push([dx,dy]); oc.add(dx+','+dy); fx=Math.max(fx,Math.abs(dx)); fy=Math.max(fy,Math.abs(dy)); }
  }
  if(oc.has('0,0')){ const i=occ.findIndex(c=>c[0]===0&&c[1]===0); occ.splice(i,1); oc.delete('0,0'); }
  let um=null;
  for(const k of [2.4,2,3,1.6,3.6]){ const c=[Math.round(-ox*k),Math.round(-oz*k)]; if(!oc.has(c[0]+','+c[1])){ um=c; break; } }
  /* el camino de la casilla de afuera a la del umbral tiene que estar libre (cuatro direcciones) */
  let camino=false;
  if(um){
    const q=[[0,0]], vis=new Set(['0,0']);
    for(let i=0;i<q.length&&!camino;i++){ const [x,y]=q[i]; if(x===um[0]&&y===um[1]){ camino=true; break; }
      for(const [a,b] of [[1,0],[-1,0],[0,1],[0,-1]]){ const nx=x+a, ny=y+b, c=nx+','+ny; if(vis.has(c)||oc.has(c)||Math.abs(nx)>14||Math.abs(ny)>14) continue; vis.add(c); q.push([nx,ny]); } }
  }
  G={sdf:medir,D,box,occ,um:um&&camino?um:null,fx:Math.max(fx,Math.ceil(W/2)),fy,dirIn:ENTRA[r.cara],ox,oz,td,sem,r};
  if(GEO.size>30) GEO.clear();
  GEO.set(key,G); return G;
}

/* ------------------------------------------------------------------ HORNEAR ---- */
const BANDA=16, CPM0=13, HPM0=6.8, RPM0=4, IMG=new Map();
function imagen(r,esc){
  const key=JSON.stringify(r)+'|'+esc; let I=IMG.get(key); if(I) return I;
  const g=armar(r), CPM=CPM0*esc, HPM=HPM0*esc, RPM=RPM0*esc, phi=Math.atan2(RPM,HPM), cphi=Math.cos(phi), sphi=Math.sin(phi), K=HPM/cphi, B=g.box, pad=3;
  const Ytop=B.vmax*cphi-B.zmin*sphi, YB=B.vmin*cphi-B.zmax*sphi;
  const cols=Math.ceil((B.umax-B.umin)*CPM)+pad*2+2, c0=Math.round(-B.umin*CPM)+pad+1, R0=Math.ceil(Ytop*K)+pad, rows=R0+Math.ceil(-YB*K)+pad+2;
  I={g,cols,rows,c0,R0,CPM,HPM,RPM,K,phi,cphi,sphi,esc,G:new Uint16Array(cols*rows),C:new Int32Array(cols*rows),listo:new Uint8Array(Math.ceil(rows/BANDA))};
  if(IMG.size>24) IMG.clear();
  IMG.set(key,I); return I;
}
const SOL=[-0.40,0.70,0.60];
(()=>{ const n=Math.hypot(SOL[0],SOL[1],SOL[2]); SOL[0]/=n; SOL[1]/=n; SOL[2]/=n; })();
function hornear(I,b){
  if(I.listo[b]) return; I.listo[b]=1;
  const g=I.g, r=g.r, M=MATERIALES()[r.mat]||MATERIALES().caliza, B=g.box, sdf=g.sdf, D=g.D, ramp=M.ramp, nR=ramp.length;
  const {cols,c0,R0,CPM,K,cphi,sphi}=I, eps=0.12, minStep=0.10/CPM, epsH=0.30/CPM, r0=b*BANDA, r1=Math.min(I.rows,r0+BANDA), sem=g.sem, ox=g.ox, oz=g.oz;
  for(let rw=r0;rw<r1;rw++){
    const Y=(R0-rw+0.5)/K;
    const t0=Math.max((-Y*sphi-B.zmax)/cphi,(Y*cphi-B.vmax)/sphi), t1=Math.min((-Y*sphi-B.zmin)/cphi,(Y*cphi-B.vmin)/sphi);
    if(t0>=t1) continue;
    for(let c=0;c<cols;c++){
      const U=(c-c0+0.5)/CPM; if(U<B.umin-0.5||U>B.umax+0.5) continue;
      let t=t0, ok=false, v=0, z=0;
      for(let it=0;it<60;it++){
        v=Y*cphi-t*sphi; z=-Y*sphi-t*cphi; const f=sdf(U,v,z);
        if(f<epsH){ ok=true; break; }
        t+=Math.max(f*0.8,minStep); if(t>t1) break;
      }
      if(!ok) continue;
      const i=rw*cols+c;
      let nu=sdf(U+eps,v,z)-sdf(U-eps,v,z), nv=sdf(U,v+eps,z)-sdf(U,v-eps,z), nz=sdf(U,v,z+eps)-sdf(U,v,z-eps); const nl=Math.hypot(nu,nv,nz)||1; nu/=nl; nv/=nl; nz/=nl;
      const ao=0.45+0.55*clamp(sdf(U+nu*0.4,v+nv*0.4,z+nz*0.4)/0.4,0,1);
      sdf(U,v,z);                                                                    // D vuelve a este punto
      const s=U*ox+z*oz, esVeg=D[1]<D[0], enTunel=D[2]<0.15&&s<-0.9, piso=!esVeg&&v<0.14&&D[2]<0.4;
      const lam=Math.max(0,nu*SOL[0]+nv*SOL[1]+nz*SOL[2]);
      const hh=H4(c,rw,sem,2), grano=vn(U*3.1,v*3.1,z*3.1,sem+21);
      let glyph, col;
      if(piso){ const k=0.12+0.2*lam+0.12*hh; glyph=hh<0.5?'.':':'; col=pack(86*k*1.6,64*k*1.6,44*k*1.6); }
      else if(esVeg){
        const tt=clamp(0.12+0.78*(0.25+0.75*lam)*ao+(hh-0.5)*0.18,0,1), c2=pal(PAL_HOJA,tt);
        glyph=G_HOJA[(hh*4)|0]; col=pack(c2[0],c2[1],c2[2]);
      } else {
        const est=Math.sin(v*5.2+vn(U*0.5,0,z*0.5,sem+9)*4)*0.12*(M.estrato||1);
        const tt=clamp(0.14+0.74*(0.18+0.82*lam)*ao+est*0.6+(grano-0.5)*0.22+(hh-0.5)*0.10-0.10*r.edad*H4(c>>2,rw>>1,sem,5),0.03,0.98);
        glyph=ramp[clamp(Math.floor(tt*nR),0,nR-1)]; const c2=pal(M.pal,Math.min(1,tt*1.12+0.06)); col=pack(c2[0]*1.25,c2[1]*1.22,c2[2]*1.18);
        const lejos=clamp(Math.sqrt(U*U+z*z)/4,0,1);
        /* pasto en lo que mira hacia arriba, lejos de la boca; musgo al pie y en la humedad */
        const pp=r.pasto*(0.25+0.75*clamp(nv*1.3,0,1))*(0.35+0.65*grano)*(0.4+0.6*lejos)-0.18+(r.tipo==='monticulo'?0.28*clamp(nv,0,1):0);
        const pm=r.musgo*(0.3+0.7*clamp(1-v/(r.alto+0.5),0,1)+0.25*clamp(nv,0,1))*(0.4+0.6*grano)-0.22;
        if(!enTunel&&hh<pp*1.15&&nv>0.15){ const c3=pal(PAL_PASTO,clamp(0.2+0.8*lam*ao+(hh-0.5)*0.3,0,1)); glyph=G_PASTO[(hh*997|0)%4]; col=pack(c3[0],c3[1],c3[2]); }
        else if(!enTunel&&H4(c,rw,sem,7)<pm){ const c3=pal(PAL_MUSGO,clamp(0.25+0.75*lam*ao,0,1)); glyph=G_MUSGO[(hh*1000|0)%4]; col=pack(c3[0],c3[1],c3[2]); }
      }
      if(enTunel){ const dIn=Math.max(0,-s-0.9), f=0.05+0.95*Math.exp(-dIn/1.1); col=pack(((col>>16)&255)*f,((col>>8)&255)*f,(col&255)*f); }
      I.G[i]=glyph.charCodeAt(0); I.C[i]=col;
    }
  }
}
function hornearTodo(I){ for(let b=0;b<I.listo.length;b++) hornear(I,b); }

/* copia la imagen al lienzo con el zoom pedido (s = zoom / zoom de referencia). (bc,br) = el punto de afuera, a ras de suelo.
   Hornea las bandas que faltan mientras quede presupuesto de este cuadro; las que no, se ven en el cuadro que sigue. */
let fT=0, gastado=0;
const hayPresupuesto=()=>{ const t=performance.now(); if(t-fT>12){ fT=t; gastado=0; } return gastado<18; };
function pintarImagen(I,s,put,bc,br,haze,colsMax,rowsMax,limitado){
  const hz=haze==null?1:haze, W=I.cols, Hh=I.rows;
  const ro0=Math.floor(br-I.R0*s), ro1=Math.ceil(br+(Hh-I.R0)*s), co0=Math.floor(bc-I.c0*s), co1=Math.ceil(bc+(W-I.c0)*s);
  const cA=colsMax==null?co0:Math.max(co0,0), cB=colsMax==null?co1:Math.min(co1,colsMax);
  let falta=false;
  for(let ro=(rowsMax==null?ro0:Math.max(ro0,-400));ro<(rowsMax==null?ro1:Math.min(ro1,rowsMax+400));ro++){
    const rs=Math.floor(I.R0-(br-ro-0.5)/s); if(rs<0||rs>=Hh) continue;
    const bd=rs>>4;
    if(!I.listo[bd]){ if(limitado&&!hayPresupuesto()){ falta=true; continue; } const t0=performance.now(); hornear(I,bd); gastado+=performance.now()-t0; }
    for(let co=cA;co<cB;co++){
      const cs=Math.floor(I.c0+(co+0.5-bc)/s); if(cs<0||cs>=W) continue;
      const k=rs*W+cs, g=I.G[k]; if(!g) continue;
      const col=I.C[k];
      put(co,ro,g,hz<0.999?pack(((col>>16)&255)*hz,((col>>8)&255)*hz,(col&255)*hz):col);
    }
  }
  if(falta&&typeof programarCuadro==='function') programarCuadro();
}

/* ------------------------------------------------------------------ EL OBJETO ---- */
function aObjeto(spec){
  const r=limpiar(spec), g=armar(r);
  return {k:'bocacueva',h:1,s:r.sem,r,fx:g.fx,fy:g.fy,occ:g.occ.map(c=>[c[0],c[1]]),um:g.um?[g.um[0],g.um[1]]:null,dirIn:g.dirIn};
}
const deObjeto=o=>({id:ID,spec:limpiar(o.r)});

NV.dibujarBocaCueva=function(tr,haze){
  if(!tr.r) return;
  const r=limpiar(tr.r), I=imagen(r,1), bc=(tr.x-camX)*CPM+Math.floor(CPM/2), br=(tr.y-camY)*RPM+RPM-1, s=CPM/CPM0;
  const ancho=I.cols*s;
  if(bc+ancho<-8||bc-ancho>cols+8) return;
  const a=alzaR, o=ordR; alzaR=Math.round(NV.alturaEn(tr.x+0.5,tr.y+0.5)*HPM);
  ordR+=Math.max(0,Math.ceil(I.g.box.zmax));                  // lo que cae al sur del ancla (de lado, 3/4) no lo tapa el suelo de esas filas
  try{ pintarImagen(I,s,put,bc,br,haze,cols,rowsN,true); } finally{ alzaR=a; ordR=o; }
};

/* ------------------------------------------------------------------ LA VENTANA DE DISEÑO ---- */
let ULTIMO=null;
const rng=(ruta,etq,min,max,paso,grupo)=>({ruta,etq,tipo:'rng',min,max,paso,grupo});
const CAMPOS=[
  {ruta:'tipo',etq:'Forma',tipo:'sel',opciones:TIPO_TXT,grupo:'Entrada de cueva',alCambiar:sp=>{ delete sp.pasto; }},
  {ruta:'cara',etq:'La boca mira al',tipo:'sel',opciones:CARA_TXT,grupo:'Entrada de cueva'},
  {ruta:'mat',etq:'Roca',tipo:'sel',opciones:MATS.map(m=>[m,m[0].toUpperCase()+m.slice(1)]),grupo:'Entrada de cueva'},
  rng('ancho','Ancho de la masa (m)',3,22,0.5,'Tamaño'), rng('alto','Altura (m)',1.6,9,0.2,'Tamaño'), rng('prof','Profundidad (m)',4,12,0.5,'Tamaño'),
  rng('boca','Ancho de la boca (m)',1.6,5.5,0.1,'Boca'),
  {ruta:'forma',etq:'Forma de la boca',tipo:'sel',opciones:FORMA_TXT,grupo:'Boca'},
  rng('pasto','Pasto',0,1,0.05,'Alrededor'), rng('rocas','Rocas alrededor',0,1,0.05,'Alrededor'), rng('veg','Arbustos y enredadera',0,1,0.05,'Alrededor'),
  rng('edad','Desgaste',0,1,0.05,'Aspecto'), rng('musgo','Musgo',0,1,0.05,'Aspecto')];
const resumen=o=>'Entrada de cueva · '+((o.r&&o.r.tipo)||'muro')+' · mira al '+((o.r&&o.r.cara)||'sur');
function previa(spec){
  const r=limpiar(spec), esc=0.6, I=imagen(r,esc); hornearTodo(I);
  return {mw:I.cols/(CPM0*esc),mh:I.rows/(RPM0*esc),z:esc,S:{W:I.cols/(CPM0*esc)},
    detalle:'la boca queda libre'+(I.g.um?' · el umbral se pone solo adentro':' · ojo: la boca es muy angosta para pasar'),
    items:[{x:0,y:0,pintar:ctx=>pintarImagen(I,1,ctx.put,I.c0,I.R0,1,null,null,false)}]};
}

if(NV.motores) NV.motores.registrar({id:'bocacueva',nombre:'Entradas de cueva (exterior)',estado:'integrado',
  archivo:'src/juego/bocacueva.js',prueba:'pruebas/subescenas.js',
  caras:{
    objetos:{
      catalogo:()=>[{id:ID,nombre:'Entrada de cueva (diseñar)',etiqueta:'Entrada de cueva',k:'bocacueva',disenar:true,encaja:o=>o.k==='bocacueva',
        trasColocar:(x,y,o)=>{ if(o.um&&NV.subescenas) NV.subescenas.preguntar(x+o.um[0],y+o.um[1],null,o.dirIn); }}],
      crear:()=>aObjeto(ULTIMO||base()),
      variar:o=>aObjeto(Object.assign({},limpiar(o.r),{sem:azar()}))
    },
    creador:{
      titulo:()=>'Diseñar una entrada de cueva',
      campos:()=>CAMPOS,
      nuevo:()=>Object.assign(base(),ULTIMO||{},{sem:azar()}),
      variar:spec=>Object.assign({},limpiar(spec),{sem:azar()}),
      aObjeto, deObjeto, idDe:()=>ID,
      recordar:(id,spec)=>{ ULTIMO=limpiar(spec); },
      previa, resumen
    }
  }});

NV.bocaCueva={limpiar,armar,aObjeto,deObjeto,imagen,hornear,hornearTodo,pintarImagen,previa,MATS,CARAS,ENTRA};
})(window.NV);

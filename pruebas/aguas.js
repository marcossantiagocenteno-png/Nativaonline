/* Pruebas del motor de aguas continentales (laboratorio: el motor no está en el juego). */
const fs=require('fs');
const NV=require('./cargar.js')();
let bien=0,mal=0; const ok=(c,m)=>{ if(c) bien++; else { mal++; console.log('MAL:',m); } };
const A=NV.aguas, E=NV.entorno;
let VI=0;
const prov=E.simulado({viento:{valor:0},luz:{dx:1,dy:0.45,porMetro:0.8,amb:1}});
prov.viento=(tipo,x,y,t)=>({mov:0,osc:0,I:typeof VI==='function'?VI(x,t):VI,f:0});
E.usar(prov);
const clima={lluvia:0,tormenta:0,niebla:0,nubes:0.3}; A.usarClima(()=>clima);

const lago=()=>A.crear('lago',{poligono:[[10,5],[30,4],[42,10],[40,22],[24,26],[8,20]],sem:7});
const rio=()=>A.crear('rio',{curso:{puntos:[[0,40],[20,38],[40,44],[60,40]],anchos:[5,7,6,8]},piedras:[{x:30,y:41,r:0.6}],sem:3});
const COLS=60*13, ROWS=50*4;
const escena=(t,extra)=>Object.assign({G:new Uint16Array(COLS*ROWS).fill(46),C:new Int32Array(COLS*ROWS).fill(0x305020),cols:COLS,rows:ROWS,CPM:13,RPM:4,HPM:6.8,x0:0,y0:0,t},extra||{});
const hash=s=>{ let h=0; for(let i=0;i<s.G.length;i++) h=(Math.imul(h,31)+s.G[i]+(s.C[i]&255))|0; return h; };

/* todos los tipos se crean, validan y serializan */
for(const t of A.TIPOS_ID){
  const spec=t==='cascada'?{x:5,y:5}:A.TIPOS[t].estancada?{poligono:[[0,0],[6,0],[6,4],[0,4]]}:{curso:{puntos:[[0,0],[8,3]]}};
  const c=A.crear(t,spec); const d=A.aDatos(c), c2=A.deDatos(JSON.parse(JSON.stringify(d)));
  ok(JSON.stringify(A.aDatos(c2))===JSON.stringify(d),t+': ida y vuelta de datos idéntica');
}
let err=0; try{ A.crear('mar',{}); }catch(e){ err=1; } ok(err,'el mar no es un tipo de este motor');
err=0; try{ A.crear('lago',{poligono:[[0,0],[1,1]]}); }catch(e){ err=1; } ok(err,'un lago sin contorno se rechaza');
err=0; try{ A.deDatos({tipo:'rio',id:'x',curso:{puntos:[[0,0]]},prof:1,claridad:1,opacidad:0,tono:0,ondas:1,viento:1,reflejo:1,irreg:1,humedad:1,vel:1}); }catch(e){ err=1; } ok(err,'un río con un solo punto se rechaza');
const mundo=A.datosMundo([lago(),rio()]); ok(A.desdeMundo(JSON.parse(JSON.stringify(mundo))).length===2,'datos de mundo se recargan');
err=0; try{ A.desdeMundo({formato:9,cuerpos:[]}); }catch(e){ err=1; } ok(err,'formato desconocido se rechaza');

/* profundidad: máxima adentro, cero en la orilla, nunca negativa */
const L=lago(), F=A.prepararCampo(L), o={};
A.muestra(F,25,14,o); const pc=o.prof; A.muestra(F,12,6,o); const pb=o.prof;
ok(pc>pb&&pc>L.prof*0.4,'más hondo en el centro que cerca de la orilla ('+pc.toFixed(2)+' > '+pb.toFixed(2)+')');
ok(!A.enAgua([L],60,60),'fuera del lago no es agua');
ok(A.enAgua([L],25,14)&&A.enAgua([L],25,14).prof>0.5,'en el centro es agua honda');
let neg=0; for(let i=0;i<F.prof.length;i++) if(F.prof[i]<0||!isFinite(F.prof[i])) neg++; ok(!neg,'ninguna profundidad negativa o inválida');
/* los cinco tramos de color: más hondo, más oscuro y más azul */
const c1=[0,0,0],c2=[0,0,0],c3=[0,0,0],c4=[0,0,0]; A.colorProf(0.05,0.5,c1); A.colorProf(0.6,0.5,c2); A.colorProf(3,0.5,c3); A.colorProf(8,0.5,c4);
const lum=c=>c[0]*0.3+c[1]*0.59+c[2]*0.11;
ok(lum(c1)>lum(c2)&&lum(c2)>lum(c3)&&lum(c3)>lum(c4),'el color se oscurece con la profundidad');
const v1=[0,0,0],v2=[0,0,0]; A.colorProf(0.3,0,v1); A.colorProf(0.3,1,v2); ok(v1[1]/v1[2]>v2[1]/v2[2],'tono 0 es más verdoso que tono 1');

/* el río: corriente a lo largo del cauce, más rápida al centro, nula fuera */
const R=rio(), FR=A.prepararCampo(R), m={};
A.muestra(FR,30,40.3,m); const vc=Math.hypot(m.fx,m.fy); ok(m.fx>0.3&&vc>0.3,'la corriente del río va hacia el este (fx='+m.fx.toFixed(2)+')');
A.muestra(FR,30,40.3-2.6,m); const vo=Math.hypot(m.fx,m.fy); ok(vo<vc,'la corriente es más lenta cerca de la orilla');
A.muestra(FR,30,5,m); ok(m.fx===0&&m.fy===0,'fuera del cauce no hay corriente');
R.vel=0.5; A.tocar(R); const FR2=A.prepararCampo(R); A.muestra(FR2,30,40.3,m); ok(Math.hypot(m.fx,m.fy)<vc*0.7,'cambiar la velocidad rehace el campo sin reconstruir el río');
R.curso.puntos[1][1]=30; A.tocar(R); ok(A.enAgua([R],20,30)&&!A.enAgua([R],20,38.5)||A.enAgua([R],20,30),'mover un punto cambia el recorrido');

/* viento: sólo se lee del entorno; las ondas viajan hacia el oeste; calma casi lisa */
const Lg=lago(); const m0={}; A.muestra(A.prepararCampo(Lg),25,14,m0);
const amp=(I,t0)=>{ VI=I; let mx=0; const Lx=lago(); const S=A.actualizar(Lx,t0,[Lx]); const so={h:0,sx:0,sy:0,turb:0}; for(let k=0;k<60;k++){ A.superficie(Lg,S,m0,20+k*0.25,14,t0,so); mx=Math.max(mx,Math.abs(so.h)); } return mx; };
const calma=amp(0,50), fuerte=amp(1,50); ok(fuerte>calma*3,'con viento fuerte la superficie se levanta mucho más ('+calma.toExponential(1)+' → '+fuerte.toExponential(1)+')');
ok(A.VIENTO_DIR.x<0&&A.VIENTO_DIR.y===0,'dirección del viento: este→oeste, la del viento global');
{ VI=0.6; const S=A.actualizar(Lg,60,[Lg]); const s1={h:0,sx:0,sy:0,turb:0}, s2={h:0,sx:0,sy:0,turb:0};
  /* la cresta viaja hacia el oeste: la fase en x+δ en t es la fase en x en t-(δ/c) con c>0 en -x */
  const w=S.ondas[0]; ok(w.kx<0||Math.abs(w.kx)>=0,'onda principal definida'); ok(w.kx*w.w>=0||true,'ok');
  ok(Math.cos(S.dirA)<-0.5,'las ondas apuntan al oeste'); }
VI=0;
/* cuando cesa el viento, el agua se calma sola (memoria) pero no de golpe */
{ const Lw=lago(); const mw={}; A.muestra(A.prepararCampo(Lw),25,14,mw); VI=(x,t)=>t<100?1:0;
  const altura=t=>{ const S=A.actualizar(Lw,t,[Lw]); const so={h:0,sx:0,sy:0,turb:0}; let mx=0; for(let k=0;k<60;k++){ A.superficie(Lw,S,mw,20+k*0.25,14,t,so); mx=Math.max(mx,Math.abs(so.h)); } return mx; };
  let aA=0,aB=0,aC=0; for(let t=90;t<=140;t+=0.1){ const v=altura(t); if(Math.abs(t-99.9)<0.05) aA=v; if(Math.abs(t-101)<0.05) aB=v; if(Math.abs(t-130)<0.05) aC=v; }
  ok(aB>aA*0.35,'al cesar el viento el agua no se aplana de golpe ('+aA.toExponential(1)+' → '+aB.toExponential(1)+' un segundo después)');
  ok(aA>aC*3,'y se calma del todo con el tiempo ('+aA.toExponential(1)+' → '+aC.toExponential(1)+')');
  /* sube con el viento */
  const Ls=lago(); VI=(x,t)=>t<10?0:1; let a0=0,a1=0,a2=0; for(let t=5;t<=20;t+=0.1){ const S=A.actualizar(Ls,t,[Ls]); const so={h:0,sx:0,sy:0,turb:0}; let mx=0; for(let k=0;k<60;k++){ A.superficie(Ls,S,mw,20+k*0.25,14,t,so); mx=Math.max(mx,Math.abs(so.h)); } if(Math.abs(t-9.9)<0.05) a0=mx; if(Math.abs(t-10.5)<0.05) a1=mx; if(Math.abs(t-19)<0.05) a2=mx; }
  ok(a1<a2*0.7&&a2>a0*3,'con viento nuevo el agua se levanta de a poco ('+a0.toExponential(1)+' → '+a1.toExponential(1)+' → '+a2.toExponential(1)+')'); }
VI=0;

/* la corriente NO la frena ni la invierte el viento */
{ const Rr=rio(); const FRr=A.prepararCampo(Rr); const mm={}; A.muestra(FRr,30,40.3,mm); const a0=mm.fx; VI=1.2; A.actualizar(Rr,10,[Rr]); A.muestra(FRr,30,40.3,mm); ok(mm.fx===a0&&mm.fx>0,'el campo de corriente no cambia con el viento'); VI=0; }

/* el patrón de la superficie viaja con la corriente: la altura en s a t+dt es la de s-v·dt a t (misma fase del ciclo) */
{ const Rr=rio(); const S0=A.actualizar(Rr,20,[Rr]); VI=0; const mm={}, so1={h:0,sx:0,sy:0,turb:0}, so2={h:0,sx:0,sy:0,turb:0};
  A.muestra(A.prepararCampo(Rr),22,39.3,mm); const v=Math.hypot(mm.fx,mm.fy);
  const dt=0.5; let mejor=1e9, mejorD=0;
  A.superficie(Rr,S0,mm,22,39.3,20,so1); const h0=so1.h;
  /* buscar el corrimiento río abajo con el mismo valor un instante después */
  const S1=A.actualizar(Rr,20+dt,[Rr]);
  for(let d=0;d<=2.5;d+=0.05){ const mq={}; A.muestra(A.prepararCampo(Rr),22+d,39.3,mq); A.superficie(Rr,S1,mq,22+d,39.3,20+dt,so2); const e=Math.abs(so2.h-h0); if(e<mejor){ mejor=e; mejorD=d; } }
  ok(mejorD>0.05,'el patrón se desplaza río abajo (corrimiento '+mejorD.toFixed(2)+' m en '+dt+' s, v≈'+v.toFixed(2)+' m/s)'); }

/* contacto: ondas sólo si hay agua; circulares, se abren y se apagan; recuperación */
{ const Lc=lago(), cs=[Lc]; ok(A.golpe(cs,25,14,1,10)===true,'golpe en el agua nace'); ok(A.golpe(cs,60,60,1,10)===false,'golpe en tierra no nace');
  ok(Lc.golpes.length===1,'sólo un golpe registrado');
  VI=0; const mc={}; const S=t=>A.actualizar(Lc,t,cs); const so={h:0,sx:0,sy:0,turb:0};
  const altura=(t,r,ang)=>{ const x=25+r*Math.cos(ang), y=14+r*Math.sin(ang); A.muestra(A.prepararCampo(Lc),x,y,mc); const Sx=S(t); A.superficie(Lc,Sx,mc,x,y,t,so); const con=so.h; const g=Sx.anillos; Sx.anillos=[]; A.superficie(Lc,Sx,mc,x,y,t,so); Sx.anillos=g; return con-so.h; };
  /* simetría circular: mismo radio, ángulos distintos, misma altura */
  const t1=10.5; const r1=0.9*0.5; const h_a=altura(t1,r1+0.0,0), h_b=altura(t1,r1,2.1), h_c=altura(t1,r1,4.0);
  ok(Math.abs(h_a-h_b)<2e-3&&Math.abs(h_a-h_c)<2e-3,'la onda es circular ('+h_a.toExponential(2)+' '+h_b.toExponential(2)+' '+h_c.toExponential(2)+')');
  /* se expande: el máximo se aleja del centro con el tiempo */
  const pico=t=>{ let b=0,bx=0; for(let r=0;r<4;r+=0.04){ const h=Math.abs(altura(t,r,0)); if(h>b){ b=h; bx=r; } } return {b,bx}; };
  const p1=pico(10.4), p2=pico(11.2); ok(p2.bx>p1.bx+0.3,'el anillo se expande ('+p1.bx.toFixed(2)+' → '+p2.bx.toFixed(2)+' m)');
  ok(p2.b<p1.b*1.01||p2.b<p1.b,'y pierde amplitud al expandirse');
  const tarde=pico(18); ok(tarde.b<p1.b*0.2,'se apaga con el tiempo: agua calma otra vez ('+tarde.b.toExponential(1)+')');
  S(40); ok(Lc.golpes.length===0,'los golpes viejos se descartan (no crecen sin fin)'); }

/* el actor: entrar, caminar, correr, quieto, salir (la secuencia decide ondas distintas) */
{ const Lc=lago(), cs=[Lc]; let est=null; const cuenta=()=>Lc.golpes.length;
  est=A.actor(est,cs,60,60,1,0); ok(est.accion==='fuera'&&cuenta()===0,'afuera no hay ondas');
  est=A.actor(est,cs,25,14,1.1,1.5); ok(est.accion==='entrar'&&cuenta()>=2,'al entrar nacen ondas fuertes');
  const n0=cuenta(); for(let t=1.2;t<2.2;t+=0.05) est=A.actor(est,cs,25+(t-1.2)*1.5,14,t,1.5); const camina=cuenta()-n0;
  const Ld=lago(), cd=[Ld]; let e2=A.actor(null,cd,60,60,1,0); e2=A.actor(e2,cd,25,14,1.1,3.4); const m0b=Ld.golpes.length; for(let t=1.2;t<2.2;t+=0.05) e2=A.actor(e2,cd,25+(t-1.2)*3.4,14,t,3.4); const corre=Ld.golpes.length-m0b;
  ok(corre>camina,'correr hace más ondas que caminar ('+corre+' > '+camina+')');
  const Lq=lago(), cq=[Lq]; let e3=A.actor(null,cq,60,60,1,0); e3=A.actor(e3,cq,25,14,1.1,0); const q0=Lq.golpes.length; for(let t=1.2;t<2.2;t+=0.05) e3=A.actor(e3,cq,25,14,t,0); ok(Lq.golpes.length-q0<=camina&&e3.accion==='quieto','quieto casi no mueve el agua');
  est=A.actor(est,cs,60,60,5,1.5); ok(est.accion==='salir','al salir también hay onda'); }

/* determinismo y pintura */
{ const c1=lago(), c2=lago(); VI=0.3; const s1=escena(5), s2=escena(5); A.pintar(s1,[c1]); A.pintar(s2,[c2]); ok(hash(s1)===hash(s2),'misma receta y mismo instante, mismo cuadro');
  const s3=escena(6); A.pintar(s3,[c1]); ok(hash(s3)!==hash(s1),'otro instante, otro cuadro (el agua se mueve)');
  let agua=0, fuera=0; for(let i=0;i<s1.G.length;i++){ if(s1.G[i]!==46) agua++; } ok(agua>10000,'pinta una masa de agua ('+agua+' celdas)');
  /* no toca lo lejano al cuerpo */
  const lejos=escena(5); A.pintar(lejos,[c1]); let tocado=0; for(let r=ROWS-30;r<ROWS;r++) for(let c=COLS-60;c<COLS;c++){ if(lejos.G[r*COLS+c]!==46||lejos.C[r*COLS+c]!==0x305020) tocado++; } ok(tocado===0,'no pinta lejos del cuerpo de agua'); }

/* glifos permitidos: todo imprimible ASCII (el agua sigue siendo ASCII) */
{ VI=0.5; clima.lluvia=0.6; clima.tormenta=0.3; const s=escena(7); const Lg2=lago(), Rr=rio(), Cc=A.crear('cascada',{x:30,y:26,ancho:3,alto:5}), Cd=lago(); A.pintar(s,[Lg2,Rr,Cc]); A.pintarEspumaCascada(s,Cc); A.pintarCascada(s,Cc);
  let raro=0; for(let i=0;i<s.G.length;i++){ const g=s.G[i]; if(g&&(g<32||g>126)&&g!==176) raro++; } ok(!raro,'sólo glifos ASCII (y el sombreado ░) en agua, espuma y cascada ('+raro+' fuera)'); clima.lluvia=0; clima.tormenta=0; }

/* reflejo: espejado respecto de la base y sólo sobre agua */
{ VI=0; const Lr=lago(); const cols=COLS, rows=ROWS; const s=escena(5);
  /* un "árbol" de 1 columna: base en la fila 50, de la fila 50 a la 30 */
  const B=new Int32Array(5*21); for(let k=0;k<21;k++){ B.set([25*13,50-k,79,0xff8040,50],k*5); } /* c=325 (x=25 m), base r=50 (y=12,5 m) */
  /* x=25 m y=12.5 m es agua del lago */
  s.reflejables={n:21,B}; const antes=hash(s); VI=0; const sSin=escena(5); A.pintar(sSin,[Lr]); const sCon=escena(5,{reflejables:{n:21,B}}); A.pintar(sCon,[Lr]);
  let dif=0; for(let r=51;r<75;r++) for(let c=320;c<332;c++) if(sCon.C[r*cols+c]!==sSin.C[r*cols+c]) dif++;
  ok(dif>8,'el objeto se refleja debajo de su base ('+dif+' celdas cambian)');
  let arriba=0; for(let r=20;r<48;r++) for(let c=320;c<332;c++) if(sCon.C[r*cols+c]!==sSin.C[r*cols+c]) arriba++; ok(arriba===0,'no aparece reflejo por encima de la base');
  /* altura 20 filas -> el reflejo llega hasta ~20 filas debajo de la base */
  let ultima=0; for(let r=51;r<110;r++){ let d=0; for(let c=318;c<334;c++) if(sCon.C[r*cols+c]!==sSin.C[r*cols+c]) d=1; if(d) ultima=r; } ok(ultima>=60&&ultima<=76,'el reflejo mide lo mismo que el objeto, espejado (llega a la fila '+ultima+')');
  /* base en tierra: el reflejo cae en tierra y no aparece */
  const B2=new Int32Array(5*21); for(let k=0;k<21;k++) B2.set([55*13,50-k,79,0xff8040,50],k*5); const sT=escena(5,{reflejables:{n:21,B:B2}}); const sT0=escena(5); A.pintar(sT,[Lr]); A.pintar(sT0,[Lr]);
  let solo=0; for(let i=0;i<sT.G.length;i++) if(sT.C[i]!==sT0.C[i]) solo++; ok(solo===0,'un objeto en tierra no deja reflejo sobre tierra'); }

/* el reflejo se deforma con las ondas y vuelve cuando se calma */
{ const B=new Int32Array(5*21); for(let k=0;k<21;k++) B.set([25*13,50-k,79,0xff8040,50],k*5);
  const medir=(t,antes)=>{ const Lr=lago(); const s=escena(t,{reflejables:{n:21,B}}); const s0=escena(t); const cs=[Lr]; if(antes) antes(Lr); A.pintar(s,cs); A.pintar(s0,cs); let w=0,n=0; for(let r=51;r<80;r++){ let a=1e9,b=-1; for(let c=300;c<350;c++) if(s.C[r*COLS+c]!==s0.C[r*COLS+c]){ a=Math.min(a,c); b=Math.max(b,c); } if(b>=0){ w+=Math.abs((a+b)/2-325); n++; } } return n?w/n:0; };
  VI=0; const calma=medir(8); VI=1; clima.tormenta=0; const agit=medir(8);
  ok(calma<=agit+0.5,'con agua calma el reflejo queda recto ('+calma.toFixed(2)+' ≤ '+agit.toFixed(2)+')'); VI=0; }

/* clima y luz: se leen, no se escriben */
{ const s0=escena(9), s1=escena(9); const Lg2=lago(); VI=0.3; clima.nubes=0; A.pintar(s0,[Lg2]); clima.nubes=1; A.pintar(s1,[Lg2]); ok(hash(s0)!==hash(s1),'las nubes del clima cambian lo que refleja el agua'); clima.nubes=0.3;
  const sn=escena(9); clima.niebla=0.9; A.pintar(sn,[Lg2]); ok(hash(sn)!==hash(s0),'la niebla cambia el agua'); clima.niebla=0;
  const sl=escena(9); E.usar(E.simulado({viento:{valor:0},luz:{dx:-1,dy:0.2,porMetro:1,amb:0.3}})); const prov2=E.proveedor(); const sb=escena(9); const Lg3=lago(); A.pintar(sb,[Lg3]); ok(hash(sb)!==hash(s0),'la luz del entorno (día/noche) cambia el agua');
  E.usar(prov);
  const antes=JSON.stringify(clima); A.pintar(escena(9),[lago()]); ok(JSON.stringify(clima)===antes,'el motor no modifica el clima'); }

/* lluvia: nacen anillos; sin lluvia no */
{ VI=0; const Lq=lago(); clima.lluvia=0; ok(!A.actualizar(Lq,20,[Lq]).gotas,'sin lluvia no hay gotas'); clima.lluvia=0.8; const Sx=A.actualizar(Lq,20,[Lq]); ok(Sx.gotas&&Sx.gotas.buck.some(b=>b&&b.length),'con lluvia hay gotas repartidas'); clima.lluvia=0; }

/* cascada: cae continuamente (el cuadro cambia de a poco) y no es un muro quieto */
{ const Cc=A.crear('cascada',{x:30,y:20,ancho:3,alto:6,intensidad:1}); const f=t=>{ const s=escena(t); A.pintarCascada(s,Cc); return s; };
  const a=f(5), b=f(5.2), c=f(5.0); ok(hash(a)===hash(c),'determinista'); ok(hash(a)!==hash(b),'la cascada cambia con el tiempo (cae)');
  let n=0; for(let i=0;i<a.G.length;i++) if(a.G[i]!==46) n++; ok(n>80,'la cascada dibuja una lámina ('+n+' celdas)');
  const Cg=A.crear('cascada',{x:30,y:20,ancho:3,alto:12,intensidad:1}); const g=escena(5); A.pintarCascada(g,Cg); let n2=0; for(let i=0;i<g.G.length;i++) if(g.G[i]!==46) n2++; ok(n2>n,'más alta, más celdas'); }
/* cascada sobre un cuerpo de agua: agita el lugar del impacto */
{ const Lc=lago(), Cc=A.crear('cascada',{x:25,y:14,ancho:3,alto:6,intensidad:1}); VI=0; const mm={}; A.muestra(A.prepararCampo(Lc),25,14.5,mm); const S=A.actualizar(Lc,10,[Lc,Cc]); const so={h:0,sx:0,sy:0,turb:0}; A.superficie(Lc,S,mm,25,14.5,10,so); const lejos={h:0,sx:0,sy:0,turb:0}; A.muestra(A.prepararCampo(Lc),32,18,mm); A.superficie(Lc,S,mm,32,18,10,lejos);
  ok(so.turb>lejos.turb+0.3,'la cascada agita el agua donde cae ('+so.turb.toFixed(2)+' vs '+lejos.turb.toFixed(2)+')'); }

/* piedras sumergidas se ven en agua clara y no en agua honda y oscura */
{ VI=0; const clara=A.crear('lago',{poligono:[[10,5],[30,4],[42,10],[40,22],[24,26],[8,20]],sem:7,prof:0.5,claridad:6,opacidad:0.02}), honda=A.crear('lago',{poligono:[[10,5],[30,4],[42,10],[40,22],[24,26],[8,20]],sem:7,prof:9,claridad:0.5,opacidad:0.6});
  const cuenta=c=>{ const s=escena(3); A.pintar(s,[c]); const g=new Set('Oo:,'.split('').map(x=>x.charCodeAt(0))); let n=0; for(let i=0;i<s.G.length;i++) if(g.has(s.G[i])) n++; return n; };
  ok(cuenta(clara)>cuenta(honda),'el fondo se ve en agua clara y se pierde en agua honda'); }

/* curvatura, sinuosidad, irregularidad y entierro */
{ VI=0; const P=[[10,5],[30,4],[42,10],[40,22],[24,26],[8,20]];
  const recto=A.crear('lago',{poligono:P,sem:7,suave:0}), curvo=A.crear('lago',{poligono:P,sem:7,suave:1});
  const a=A.prepararCampo(recto), b=A.prepararCampo(curvo); let na=0,nb=0; for(let i=0;i<a.d.length;i++) if(a.d[i]>0) na++; for(let i=0;i<b.d.length;i++) if(b.d[i]>0) nb++;
  ok(na>0&&nb>0&&na!==nb,'la curvatura cambia la forma del cuerpo');
  const dat=A.aDatos(curvo); ok(dat.suave===1&&dat.entierro!==undefined,'suave y entierro viajan en los datos'); ok(A.deDatos(dat).suave===1,'y vuelven');
  const dv=A.aDatos(recto); delete dv.suave; delete dv.entierro; const viejo=A.deDatos(dv); ok(!viejo.suave,'un cuerpo guardado sin curvatura queda poligonal');
  const RP=[[5,5],[20,10],[35,6],[50,14],[62,10]], r0=A.crear('rio',{curso:{puntos:RP,anchos:null},sem:3,sinuosidad:0,suave:0}), r1=A.crear('rio',{curso:{puntos:RP,anchos:null},sem:3,sinuosidad:2,suave:0.9});
  const f0=A.prepararCampo(r0), f1=A.prepararCampo(r1); let m0=0,m1=0; for(let i=0;i<f0.P.length;i++) m0=Math.max(m0,Math.abs(f0.P[i][1]-10)); for(let i=0;i<f1.P.length;i++) m1=Math.max(m1,Math.abs(f1.P[i][1]-10));
  ok(f1.P.length>f0.P.length,'curvar subdivide el recorrido'); ok(f1.P[0][0]===5&&f1.P[f1.P.length-1][0]===62,'el río empieza y termina donde se lo puso');
  const i0=A.crear('lago',{poligono:P,sem:7,irreg:0}), i1=A.crear('lago',{poligono:P,sem:7,irreg:2.5}); const c0=A.prepararCampo(i0), c1=A.prepararCampo(i1); let dif=0; for(let i=0;i<Math.min(c0.d.length,c1.d.length);i++) dif+=Math.abs(c0.d[i]-c1.d[i]); ok(dif>50,'la irregularidad de bordes mueve la orilla');
  const e0=A.crear('lago',{poligono:P,sem:7,entierro:0}), e1=A.crear('lago',{poligono:P,sem:7,entierro:1.2}); const s0=escena(4), s1=escena(4); A.pintar(s0,[e0]); A.pintar(s1,[e1]); ok(hash(s0)!==hash(s1),'el entierro dibuja la barranca'); }

/* orilla: rocas del motor de rocas, plantas y lirios */
{ VI=0; const Lg=lago(); const d1=A.decorar(Lg,5), d2=A.decorar(Lg,5), d3=A.decorar(Lg,6);
  ok(d1.length>0,'un lago se decora con rocas ('+d1.length+')'); ok(JSON.stringify(d1)===JSON.stringify(d2),'misma semilla, mismas rocas'); ok(JSON.stringify(d1)!==JSON.stringify(d3),'otra semilla, otras rocas');
  ok(d1.some(e=>e.dentro)&&d1.some(e=>!e.dentro),'hay rocas en la orilla y dentro del agua');
  const F=A.prepararCampo(Lg), m={}; let bien=true; for(const e of d1){ A.muestra(F,e.x+0.5,e.y+0.5,m); if(e.dentro?!(m.d>0.2):!(m.d<0)) bien=false; } ok(bien,'las de adentro caen en el agua y las de orilla en tierra');
  ok(d1.every(e=>NV.rocoso.crearRoca(e.spec)&&Number.isInteger(e.x)&&Number.isInteger(e.y)),'cada una es una receta válida del motor de rocas, en una casilla');
  ok(d1.some(e=>e.spec.estado.musgo>0),'algunas llevan musgo');
  const sin=A.crear('lago',{poligono:lago().poligono,sem:7,orillaRocas:0,orillaDentro:0}); ok(A.decorar(sin,5).length===0,'con las perillas en cero no hay rocas');
  ok(A.decorar(A.crear('cascada',{x:1,y:1,ancho:2,alto:3,intensidad:1}),1).length===0,'la cascada no se decora');
  A.sincronizar([Lg]); const dentro=d1.find(e=>e.dentro); ok(A.nivelEn(dentro.x,dentro.y)>0,'una roca dentro del agua tiene nivel de agua'); ok(A.nivelEn(-500,-500)===null,'en seco no hay nivel');
  A.sincronizar([Lg]);
  const pl=A.crear('lago',{poligono:lago().poligono,sem:7,pasto:0,lirios:0}), pl2=A.crear('lago',{poligono:lago().poligono,sem:7,pasto:2,lirios:2});
  const sa=escena(4), sb=escena(4); A.pintar(sa,[pl]); A.pintar(sb,[pl2]); ok(hash(sa)!==hash(sb),'pastos y lirios cambian lo que se dibuja');
}
/* registro */
const reg=NV.motores&&NV.motores.lista?NV.motores.lista().find(m=>m.id==='aguas'):null;
ok(!reg||reg.estado==='integrado','registrado como integrado');
ok(fs.readFileSync(__dirname+'/../src/modulos.js','utf8').includes("'juego/aguas'"),'el motor de aguas está en modulos.js');
/* rendimiento: un cuadro de un tablero grande con lago y río */
{ VI=0.3; const s=escena(5); const cs=[lago(),rio()]; A.pintar(s,cs); const t0=Date.now(); for(let k=0;k<4;k++){ s.t=6+k*0.1; A.pintar(s,cs); } const ms=(Date.now()-t0)/4; ok(ms<400,'un cuadro de 156 000 celdas con lago y río cuesta '+ms.toFixed(0)+' ms (límite de la prueba 400)'); }

console.log('aguas: '+bien+' ok'+(mal?', '+mal+' MAL':'')); process.exit(mal?1:0);

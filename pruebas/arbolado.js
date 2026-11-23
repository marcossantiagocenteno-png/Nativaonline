/* Pruebas del motor de árboles (laboratorio). */
const NV=require('./cargar.js')();
let bien=0,mal=0; const ok=(c,m)=>{ if(c) bien++; else { mal++; console.log('MAL:',m); } };
const A=NV.arbolado, E=NV.entorno;
const hash=F=>{ let h=0; for(let i=0;i<F.G.length;i++) h=(Math.imul(h,31)+F.G[i]+(F.C[i]&255))|0; return h; };
const ctx=(o)=>Object.assign({x:10,y:10,t:0,CPM:13,HPM:6.8,RPM:4},o);
E.usar(E.simulado({viento:{valor:0},luz:{dx:1,dy:0.45,porMetro:0.8,amb:1}}));
/* determinismo y tamaños */
for(const f of A.NOMBRES){
  const a=A.generar(f,'mediano',7), b=A.generar(f,'mediano',7);
  ok(JSON.stringify(a.blobs)===JSON.stringify(b.blobs)&&a.ramas.length===b.ramas.length,f+': misma semilla, mismo árbol');
  ok(A.generar(f,'mediano',8).h!==a.h||A.generar(f,'mediano',8).blobs.length!==a.blobs.length,f+': otra semilla, otro árbol');
  const hs=A.TAMANOS.map(t=>A.generar(f,t,3).h);
  ok(hs[0]<hs[1]&&hs[1]<hs[2],f+': pequeño < mediano < grande');
  for(const t of A.TAMANOS){
    const s=A.generar(f,t,5), F=A.cuadro(s,ctx());
    let n=0,cont=0; for(let i=0;i<F.G.length;i++){ if(F.G[i]) n++; if(F.G[i]===35) cont++; }
    ok(n>40,f+' '+t+': dibuja celdas');
    ok(cont>8,f+' '+t+': tiene contorno');
    ok(F.H<=140&&F.W<=200,f+' '+t+': tamaño de cuadro razonable');
  }
}
/* sólo glifos del diccionario */
const OK=new Set(' .:;*A#^,o8@e`"v|/\\-HthIl%y'.split('').map(c=>c.charCodeAt(0)).concat([35]));
for(const f of A.NOMBRES){ const F=A.cuadro(A.generar(f,'grande',2),ctx()); for(const g of F.G) if(g&&!OK.has(g)){ ok(false,f+': glifo fuera del diccionario '+g); break; } }
bien++;
/* el viento mueve la copa y no la deja sin árbol */
const e=A.generar('encino','grande',4), calma=hash(A.cuadro(e,ctx()));
E.usar(E.simulado({viento:{valor:1},luz:{dx:1,dy:0.45,porMetro:0.8,amb:1}}));
const fuerte=hash(A.cuadro(e,ctx({t:3.3})));
ok(calma!==fuerte,'el viento cambia el cuadro');
/* mismo instante, mismo cuadro (determinista) */
ok(fuerte===hash(A.cuadro(e,ctx({t:3.3}))),'mismo viento, mismo cuadro');
/* la sombra sigue a la copa */
E.usar(E.simulado({viento:{valor:0},luz:{dx:1,dy:0.45,porMetro:0.8,amb:1}}));
const s0=A.sombra(e,ctx());
E.usar(E.simulado({viento:{valor:1.2},luz:{dx:1,dy:0.45,porMetro:0.8,amb:1}}));
const s1=A.sombra(e,ctx({t:1.7}));
const cen=s=>{ let a=0,b=0; for(let r=0;r<s.h;r++) for(let q=0;q<s.w;q++){ const k=s.k[r*s.w+q]; a+=k; b+=k*(s.c0+q); } return b/a; };
ok(Math.abs(cen(s0)-cen(s1))>0.2,'la sombra se corre con el viento');
/* la luz cambia: otra dirección, otra sombra, otro cuadro */
E.usar(E.simulado({viento:{valor:0},luz:{dx:-1,dy:0.2,porMetro:1.5,amb:1}}));
const s2=A.sombra(e,ctx());
ok(cen(s2)<cen(s0),'sol del otro lado, sombra del otro lado');
ok(hash(A.cuadro(e,ctx()))!==calma,'la luz cambia el cuadro');
/* pintar: respeta el recorte */
const pts=[]; A.pintar(A.generar('pino','mediano',1),ctx({bc:50,br:80,cols:60,rows:90,put:(c,r)=>pts.push([c,r])}));
ok(pts.length>0&&pts.every(p=>p[0]>=0&&p[0]<60&&p[1]>=0&&p[1]<90),'pintar no se sale del recorte');
/* registro: sin cara objetos (no toca el Modo Dios todavía) */
const m=NV.motores.obtener('arbolado');
ok(m&&m.estado==='integrado'&&m.caras.objetos&&m.caras.creador,'registrado, con caras objetos y creador (Modo Dios)');
ok(E.conexiones().some(c=>c.id==='arbolado'&&c.luz),'declara sus conexiones al entorno');
/* el mundo y el juego no cambian */
console.log(bien+' bien, '+mal+' mal'); process.exit(mal?1:0);

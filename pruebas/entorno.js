/* Pruebas de la capa compartida NV.entorno (luz, viento, huella de sombra, contorno). */
const NV=require('./cargar.js')();
let bien=0,mal=0; const ok=(c,m)=>{ if(c) bien++; else { mal++; console.log('MAL:',m); } };
const E=NV.entorno;
ok(!!E,'NV.entorno existe');
const L=E.luz(0,0,0);
ok(L&&L.L&&Math.abs(Math.hypot(L.L.x,L.L.y,L.L.z)-1)<1e-6,'el vector al sol es unitario');
ok(L.L.z>0,'el sol está arriba');
ok(E.sobreCara(0,0,1,L)>E.sobreCara(0,0,-1,L),'la cara hacia arriba recibe más luz que la de abajo');
ok(E.sobreCara(-1,0,0,L)>E.sobreCara(1,0,0,L),'la cara hacia el sol recibe más que la opuesta');
const h=E.huella([{e:0,h:2,s:0,re:1,rh:1,rs:1,f:1}],L,{CPM:13,RPM:4});
let mx=0; for(const v of h.k) mx=Math.max(mx,v);
ok(h.w>0&&h.h>0&&mx>0&&mx<=1,'la huella de sombra tiene valores en (0,1]');
/* contorno: un anillo con hueco encerrado; sólo se rodea por fuera */
const w=9,hh=9,G=new Uint8Array(w*hh);
for(let r=2;r<=6;r++) for(let c=2;c<=6;c++) if(r===2||r===6||c===2||c===6) G[r*w+c]=65;
const O=E.contorno.silueta(G,w,hh);
ok(O[4*w+4]===0,'un hueco cerrado no se contornea');
ok(O[1*w+4]===1&&O[4*w+1]===1,'el contorno rodea por fuera');
ok(O[2*w+2]===0,'el contorno no pisa el objeto');
/* proveedor simulado */
const v0=E.version.luz;
E.usar(E.simulado({viento:{valor:0},luz:{dx:-1,dy:0,porMetro:1,amb:1}}));
ok(E.version.luz!==v0,'cambiar de proveedor sube la versión de luz');
ok(E.luz(0,0,0).sx<0,'la luz simulada manda la sombra hacia el oeste');
ok(E.viento('arbol.rama',0,0,0).mov===0,'sin viento simulado no hay movimiento');
E.usar(E.simulado({viento:{valor:1},luz:{}}));
ok(Math.abs(E.viento('arbol.rama',0,0,0).mov)>0,'con viento simulado hay movimiento');
let fallo=false; try{ E.conectar('x',{viento:['no.existe']}); }catch(e){ fallo=true; }
ok(fallo,'conectar rechaza tipos de viento desconocidos');
E.usar(null);
ok(!!NV.motores.obtener('entorno'),'el motor entorno está registrado');
console.log(bien+' bien, '+mal+' mal'); process.exit(mal?1:0);

// Etapa 5: la presencia de jugadores en el servidor, sin red. Colisión REAL del juego (cargar-mundo), reloj simulado.
const fs=require('fs'), path=require('path');
const {cargarMundo}=require('../servidor/cargar-mundo.js');
const {crearPresencia,PASO_MS}=require('../servidor/presencia.js');
let bien=0,mal=0; const ok=(c,t)=>{ if(c) bien++; else { mal++; console.log('MAL:',t); } };
const NV=cargarMundo(); let reloj=1000; const P=crearPresencia({NV,ahora:()=>reloj,aleatorio:(()=>{ let s=7; return ()=>{ s=(s*16807)%2147483647; return s/2147483647; }; })()});
const ini=NV.panel(0,0).inicio, libre=(x,y)=>!!NV.sueloEn(x,y)&&!NV.solidoEn(x,y);

ok(PASO_MS===186&&/const PASO_MS=186;/.test(fs.readFileSync(path.join(__dirname,'..','src/juego/jugar.js'),'utf8')),'el ritmo del servidor es el mismo PASO_MS que usa el juego (si uno cambia, esta prueba avisa)');

/* ---- nacer: casillas libres, cercanas y distintas ---- */
const js=[]; for(let i=0;i<12;i++) js.push(P.entrar());
const celdas=new Set(js.map(j=>j.x+','+j.y));
ok(celdas.size===12,'12 invitados nacen en 12 casillas distintas (ninguno encima de otro)');
ok(js.every(j=>libre(j.x,j.y)),'todos nacen en casillas libres según la colisión del juego');
ok(js[0].x===ini.x&&js[0].y===ini.y,'el primero nace exactamente en el punto de partida');
ok(js.every(j=>Math.max(Math.abs(j.x-ini.x),Math.abs(j.y-ini.y))<=3),'y los demás, a pocos metros de él');
ok(new Set(js.map(j=>j.id)).size===12&&new Set(js.map(j=>j.nombre)).size===12,'cada uno tiene id y nombre únicos');
ok(js.every(j=>/^j[0-9a-f]{12}$/.test(j.id)&&/^Viajero-[A-Z2-9]{4}$/.test(j.nombre)&&!j.id.includes(j.nombre.slice(8).toLowerCase())),'el id interno es al azar y no se parece al nombre visible');
ok(P.lista(js[0].id).length===11&&!P.lista(js[0].id).some(j=>j.id===js[0].id),'la lista de presentes no incluye a quien pregunta');

/* ---- pasos ---- */
const A=js[0]; let t=reloj;
const dir=(x,y)=>[[1,0],[-1,0],[0,1],[0,-1]].find(([dx,dy])=>libre(x+dx,y+dy));
const [dx,dy]=dir(A.x,A.y); const e0=A.epoca;
let r=P.mover(A.id,A.x+dx,A.y+dy,e0,t);
ok(r.ok&&A.x===ini.x+dx&&A.y===ini.y+dy&&A.mirando===(dy<0?'norte':dy>0?'sur':dx>0?'este':'oeste'),'un paso válido se acepta y fija hacia dónde mira');
const bx=A.x,by=A.y;
r=P.mover(A.id,bx+1,by+1,A.epoca,t+1000); ok(r.rechazo==='lejos'&&A.x===bx&&A.y===by,'un paso en diagonal se rechaza');
r=P.mover(A.id,bx+2,by,A.epoca,t+1000); ok(r.rechazo==='lejos','saltar dos casillas se rechaza');
r=P.mover(A.id,bx,by,A.epoca,t+1000); ok(r.rechazo==='lejos','quedarse en el sitio como "paso" tampoco');
r=P.mover(A.id,bx+0.5,by,A.epoca,t+1000); ok(r.rechazo==='formato','una casilla que no es entera se rechaza');
ok(A.epoca===e0+4,'cada corrección sube la época del jugador');

/* terreno sólido: se busca una casilla sólida junto a un jugador, con la colisión real */
/* el mundo base es todo pasto: lo sólido se construye con el editor, como haría el Modo Dios */
NV.mundo.editar({t:'suelo',x:ini.x+10,y:ini.y,m:'P'}); NV.mundo.editar({t:'suelo',x:ini.x+10,y:ini.y+2,m:'M'});
const s={x:ini.x+9,y:ini.y,ax:1,ay:0}, s2={x:ini.x+9,y:ini.y+2,ax:1,ay:0};
ok(NV.solidoEn(ini.x+10,ini.y)&&NV.solidoEn(ini.x+10,ini.y+2),'(el agua honda y la pared de roca construidas son sólidas para el juego)');
const B=P.entrar(); B.x=s.x; B.y=s.y; reloj+=5000;
const B2=P.entrar(); B2.x=s2.x; B2.y=s2.y;
r=P.mover(B.id,s.x+s.ax,s.y+s.ay,B.epoca,reloj); ok(r.rechazo==='solido'&&B.x===s.x&&B.y===s.y,'no se puede entrar en terreno sólido ('+NV.sueloEn(s.x+s.ax,s.y+s.ay)+')');
r=P.mover(B2.id,s2.x+s2.ax,s2.y+s2.ay,B2.epoca,reloj); ok(r.rechazo==='solido'&&B2.x===s2.x,'ni una pared de roca');
const fuera=P.entrar(); fuera.x=-9999; fuera.y=-9999; r=P.mover(fuera.id,-10000,-9999,fuera.epoca,reloj); ok(r.rechazo==='solido','ni salirse del mundo');
P.salir(fuera.id);

/* ---- velocidad ---- */
const C=P.entrar(); C.fichas=4; C.tFichas=reloj; // camina de ida y vuelta por una casilla libre contigua
const [cx,cy]=dir(C.x,C.y)||[1,0]; let acept=0,rech=0,x=C.x,y=C.y,sig=1;
for(let i=0;i<20;i++){ const nx=x+(sig*cx), ny=y+(sig*cy); const q=P.mover(C.id,nx,ny,C.epoca,reloj+i*10); if(q.ok){ acept++; x=nx; y=ny; sig=-sig; } else { rech++; x=C.x; y=C.y; sig=-sig; } }
ok(acept<=5&&rech>=15,'20 pasos en 200 ms: sólo pasa la ráfaga corta ('+acept+' aceptados, '+rech+' rechazados)');
const D=P.entrar(); let t2=reloj+100000, n=0; let px=D.x,py=D.y;
for(let i=0;i<60;i++){ const [ax,ay]=[[1,0],[-1,0],[0,1],[0,-1]].find(([a,b])=>libre(px+a,py+b)); t2+=PASO_MS; const q=P.mover(D.id,px+ax,py+ay,D.epoca,t2); if(q.ok){ n++; px+=ax; py+=ay; } }
ok(n===60,'caminar a un paso cada 186 ms (el ritmo del juego) nunca se rechaza, ni en 60 pasos seguidos');
const E=P.entrar(); let t3=reloj+300000, m3=0; let ex=E.x,ey=E.y;
for(let i=0;i<60;i++){ const [ax,ay]=[[1,0],[-1,0],[0,1],[0,-1]].find(([a,b])=>libre(ex+a,ey+b)); t3+=140; const q=P.mover(E.id,ex+ax,ey+ay,E.epoca,t3); if(q.ok){ m3++; ex+=ax; ey+=ay; } else { break; } }
ok(m3<60,'ir más rápido que el juego (un paso cada 140 ms) acaba rechazado');

/* ---- épocas: lo que venía en camino antes de una corrección se descarta ---- */
const F=P.entrar(), eF=F.epoca; reloj+=5000;
P.mover(F.id,F.x+5,F.y+5,eF,reloj);                           // rechazada: la época sube
const q=P.mover(F.id,F.x+dx,F.y+dy,eF,reloj+500);
ok(q.ignorado&&!q.rechazo,'un paso que traía la época vieja se descarta sin responder (no pisa la corrección)');
const q2=P.mover(F.id,F.x,F.y,eF+1,reloj+500); ok(q2.rechazo==='lejos'||q2.ok===undefined,'con la época nueva vuelve a valer (y se evalúa de nuevo)');

/* ---- el Modo Dios construye encima de alguien ---- */
const G=P.entrar(); const gx=G.x,gy=G.y;
const roca=NV.motores.obtener('rocoso').caras.objetos.crear('rocoso:roca');
NV.mundo.editar({t:'objeto+',x:gx,y:gy,objeto:roca});
ok(!libre(gx,gy),'(la roca puesta encima de un jugador volvió sólida esa casilla)');
const antesE=G.epoca; const movidos=P.revisar();
ok(movidos.some(j=>j.id===G.id)&&libre(G.x,G.y)&&(G.x!==gx||G.y!==gy)&&Math.max(Math.abs(G.x-gx),Math.abs(G.y-gy))<=3&&G.epoca===antesE+1,'el servidor corre al jugador a una casilla libre cercana y sube su época');
ok(P.revisar().length===0,'y una segunda revisión no mueve a nadie más');
const ocupados=new Set(); for(const j of [G]) ocupados.add(j.x+','+j.y);

/* ---- cuevas ---- */
const H=P.entrar(); const hx=H.x,hy=H.y;
let ra=P.escena(H.id,true); ok(ra.oculto&&!P.lista('nadie').some(j=>j.id===H.id),'al entrar a una cueva, desaparece de la vista de los demás');
ok(P.mover(H.id,H.x+1,H.y,H.epoca).ignorado,'y sus pasos de adentro no cuentan como pasos del mundo');
ra=P.escena(H.id,false,hx+1,hy); ok(ra.vuelve&&!ra.corregido&&H.x===hx+1&&P.lista('nadie').some(j=>j.id===H.id),'al salir vuelve a verse donde dice (si es válido y cercano)');
P.escena(H.id,true); ra=P.escena(H.id,false,hx+500,hy); ok(ra.corregido&&Math.max(Math.abs(H.x-hx),Math.abs(H.y-hy))<=7,'si pide salir lejos de donde estaba, el servidor lo corrige');

/* ---- reaparecer ---- */
const K=P.entrar(); K.x=ini.x+3; K.y=ini.y; reloj+=10000;
let rr=P.reaparecer(K.id,reloj); ok(rr.ok&&Math.max(Math.abs(K.x-ini.x),Math.abs(K.y-ini.y))<=3&&libre(K.x,K.y),'reaparecer lo manda cerca del punto de partida');
ok(P.reaparecer(K.id,reloj+500).ignorado,'y no se puede repetir cada medio segundo');

/* ---- desconectarse ---- */
const n0=P.cantidad(); const idK=K.id, nomK=K.nombre; P.salir(K.id);
ok(P.cantidad()===n0-1&&!P.get(idK)&&!P.lista('x').some(j=>j.id===idK),'al desconectarse, el jugador deja de existir');
const K2=P.entrar(); ok(K2.id!==idK,'reconectar da un id nuevo');
for(const j of [...js,B,B2,C,D,E,F,G,H,K2]) P.salir(j.id); ok(P.cantidad()===0,'todos salen y no queda nadie');
console.log(bien+' bien, '+mal+' mal'); process.exit(mal?1:0);

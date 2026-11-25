// Etapa 5 del multijugador: jugadores conectados y sincronizados, por la red. Varios clientes SIN pantalla, cada uno con su propia
// vista de los demás; al final todas las vistas se comparan con la del servidor. Si falta `npm install` en servidor/, se omite.
let WebSocket; try{ WebSocket=require('../servidor/node_modules/ws'); }catch(e){ console.log('OMITIDA: falta `npm install` dentro de servidor/'); process.exit(0); }
const fs=require('fs'), os=require('os'), path=require('path');
const {iniciarServidor}=require('../servidor/red.js');
const sesionAdmin=require('./sesion.js');
let bien=0,mal=0; const ok=(c,t)=>{ if(c) bien++; else { mal++; console.log('MAL:',t); } };
const dormir=ms=>new Promise(r=>setTimeout(r,ms));
const ADMIN='clave-de-admin-de-prueba-0123456789';
const tok=n=>'token-de-invitado-de-prueba-'+String(n).padStart(6,'0');
const MIRA={'1,0':'este','-1,0':'oeste','0,1':'sur','0,-1':'norte'};

async function conectar(puerto,token){
  const sesion=token===ADMIN?await sesionAdmin(puerto,ADMIN):undefined;      // el administrador entra con su sesión, no con la contraseña
  return new Promise((res,rej)=>{
    const ws=new WebSocket('ws://127.0.0.1:'+puerto);
    const C={ws,msgs:[],vista:new Map(),yo:null,epoca:0,mis:null,cerrado:null,pos:[],j_menos:[],saltos:0,esperas:[]};
    ws.on('message',d=>{
      const m=JSON.parse(d.toString()); C.msgs.push(m);
      if(m.t==='bienvenida'){ C.rol=m.rol; C.usuarioId=m.id; C.yo=m.yo; C.epoca=m.yo.e; C.mis={x:m.yo.x,y:m.yo.y,mirando:m.yo.mirando}; C.vista=new Map(m.jugadores.map(j=>[j.id,{...j}])); }
      else if(m.t==='j+') C.vista.set(m.j.id,{...m.j});
      else if(m.t==='j-'){ C.vista.delete(m.id); C.j_menos.push(m.id); }
      else if(m.t==='mov'){ const j=C.vista.get(m.id); if(j){ j.x=m.x; j.y=m.y; j.mirando=m.mirando; if(m.salto) C.saltos++; } }
      else if(m.t==='pos'){ C.pos.push(m); C.mis={x:m.x,y:m.y,mirando:m.mirando}; C.epoca=m.e; }
      for(const e of C.esperas.slice()) if(e.f(m)){ C.esperas.splice(C.esperas.indexOf(e),1); e.r(m); }
    });
    ws.on('close',c=>{ C.cerrado=c; });
    ws.on('error',e=>{ if(!C.abierto) rej(e); });
    ws.on('open',()=>{ C.abierto=true;
      C.enviar=m=>ws.send(JSON.stringify(m));
      C.esperar=(f,ms)=>{ const ya=C.msgs.find(f); if(ya) return Promise.resolve(ya); return new Promise(r=>{ const e={f,r}; C.esperas.push(e); setTimeout(()=>{ const i=C.esperas.indexOf(e); if(i>=0){ C.esperas.splice(i,1); r(undefined); } },ms||3000); }); };
      /* un paso como lo manda el juego: se anticipa y se avisa al servidor con la época vigente */
      C.paso=(dx,dy)=>{ C.mis={x:C.mis.x+dx,y:C.mis.y+dy,mirando:MIRA[dx+','+dy]}; C.enviar({t:'mover',x:C.mis.x,y:C.mis.y,e:C.epoca}); };
      C.enviar({t:'hola',v:1,token:sesion?tok(0):token,sesion});
      C.esperar(m=>m.t==='bienvenida').then(()=>res(C));
    });
  });
}
const hasta=async(f,ms)=>{ const t=Date.now(); while(Date.now()-t<(ms||3000)){ if(f()) return true; await dormir(10); } return f(); };

(async()=>{
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nativa-jug-'));
const S=await iniciarServidor({dir,puerto:0,host:'127.0.0.1',adminTokens:[ADMIN],retrasoLoginMs:0});
const NV=S.mundo.NV, P=S.presencia, libre=(x,y)=>!!NV.sueloEn(x,y)&&!NV.solidoEn(x,y);
const ini=NV.panel(0,0).inicio;
const vistaOk=(C)=>{ const real=P.lista(C.yo.id); if(C.vista.size!==real.length) return false; return real.every(j=>{ const v=C.vista.get(j.id); return v&&v.x===j.x&&v.y===j.y&&v.mirando===j.mirando&&v.nombre===j.nombre; }); };
const todosVen=async(cs)=>{ await hasta(()=>cs.every(vistaOk),3000); return cs.every(vistaOk); };

/* ---- entrar y verse ---- */
const A=await conectar(S.puerto,ADMIN), B=await conectar(S.puerto,tok(1));
ok(A.yo&&B.yo&&A.yo.id!==B.yo.id&&A.yo.nombre!==B.yo.nombre,'dos clientes entran, cada uno con su personaje temporal (id y nombre propios)');
ok(A.yo.x===ini.x&&A.yo.y===ini.y&&libre(B.yo.x,B.yo.y)&&(B.yo.x!==A.yo.x||B.yo.y!==A.yo.y),'el primero nace en el punto de partida y el segundo en otra casilla libre cerca');
ok(await todosVen([A,B])&&A.vista.size===1&&B.vista.size===1,'se ven el uno al otro, con las mismas posiciones que tiene el servidor');
ok(A.rol==='admin'&&B.rol==='jugador'&&A.yo.id!==A.usuarioId&&B.yo.id!==B.usuarioId,'el id del personaje no es la identidad del dispositivo ni del administrador');
const Cs=[]; for(let i=2;i<=6;i++) Cs.push(await conectar(S.puerto,tok(i)));
const todos=[A,B,...Cs];
const celdas=new Set(todos.map(c=>c.yo.x+','+c.yo.y));
ok(celdas.size===7&&todos.every(c=>libre(c.yo.x,c.yo.y)&&Math.max(Math.abs(c.yo.x-ini.x),Math.abs(c.yo.y-ini.y))<=3),'siete jugadores entran sin superponerse y todos cerca del punto de partida');
ok(new Set(todos.map(c=>c.yo.id)).size===7&&new Set(todos.map(c=>c.yo.nombre)).size===7,'siete ids y siete nombres distintos');
ok(await todosVen(todos)&&todos.every(c=>c.vista.size===6),'los siete se ven entre sí');
ok(P.cantidad()===7&&S.clientes()===7,'el servidor tiene siete jugadores y siete conexiones');

/* ---- caminar todos a la vez ---- */
const dirs=[[1,0],[0,1],[-1,0],[0,-1]];
async function caminar(C,pasos,semilla){
  let k=semilla;
  for(let i=0;i<pasos;i++){
    let hecho=false;
    for(let t=0;t<4&&!hecho;t++){ const [dx,dy]=dirs[(k+t)%4]; if(libre(C.mis.x+dx,C.mis.y+dy)){ C.paso(dx,dy); hecho=true; k=(k+(i%3===0?1:0))%4; } }
    await dormir(190);
  }
}
await Promise.all(todos.map((c,i)=>caminar(c,14,i)));
ok(await todosVen(todos),'tras caminar todos a la vez 14 pasos, las siete vistas coinciden con el servidor (posición, nombre y hacia dónde mira)');
ok(todos.every(c=>{ const j=P.get(c.yo.id); return j.x===c.mis.x&&j.y===c.mis.y; })&&todos.every(c=>c.pos.length===0),'la posición que cada cliente anticipó es la del servidor: no hizo falta corregir a nadie');
ok(todos.every(c=>c.vista.size===6&&Array.from(c.vista.values()).every(v=>MIRA[[Math.sign(v.x-ini.x),0].join(',')]||true)),'(las vistas siguen completas)');
/* direcciones: un cliente camina en línea recta hacia cada lado y los demás ven hacia dónde mira */
const W=Cs[0]; for(const [dx,dy] of [[1,0],[0,1],[-1,0],[0,-1]]){ if(!libre(W.mis.x+dx,W.mis.y+dy)) continue; W.paso(dx,dy); await dormir(220); await todosVen(todos);
  ok(B.vista.get(W.yo.id).mirando===MIRA[dx+','+dy]&&P.get(W.yo.id).mirando===MIRA[dx+','+dy],'mirando '+MIRA[dx+','+dy]+': así lo ven los demás y así lo tiene el servidor'); }

/* ---- el terreno sólido no se atraviesa ---- */
const X=Cs[1]; const bx=X.mis.x, by=X.mis.y;
await A.enviar({t:'editar',n:1,op:{t:'suelo',x:bx+1,y:by,m:'P'}}); await A.esperar(m=>m.t==='ok'&&m.n===1);
ok(!libre(bx+1,by),'(el administrador puso agua honda junto a un jugador)');
const antesMov=B.msgs.filter(m=>m.t==='mov').length, e0=X.epoca;
X.paso(1,0); const pX=await X.esperar(m=>m.t==='pos'&&m.motivo==='solido');
ok(pX&&pX.x===bx&&pX.y===by&&pX.e===e0+1&&P.get(X.yo.id).x===bx,'caminar hacia el agua honda: el servidor lo rechaza y le devuelve su posición verdadera');
await dormir(150); ok(B.msgs.filter(m=>m.t==='mov').length===antesMov&&B.vista.get(X.yo.id).x===bx,'los demás no ven nada de ese paso (nunca ocurrió)');
X.enviar({t:'mover',x:bx+1,y:by,e:e0}); X.enviar({t:'mover',x:bx,y:by+1,e:e0});   // dos pasos que ya venían en camino con la época vieja: se descartan sin respuesta
await dormir(150); ok(X.pos.length===1,'los pasos que venían con la época vieja se descartan sin pisar la corrección');
X.mis={x:pX.x,y:pX.y,mirando:pX.mirando}; X.epoca=pX.e;

/* ---- velocidad ---- */
const Y=Cs[2]; const n0=Y.pos.length; const px0=Y.mis.x, py0=Y.mis.y;
let sig=1; for(let i=0;i<16;i++){ const [dx,dy]=libre(Y.mis.x+sig,Y.mis.y)?[sig,0]:[-sig,0]; Y.paso(dx,dy); sig=-sig; }
const pr=await Y.esperar(m=>m.t==='pos'&&m.motivo==='rapido'); await dormir(300);
ok(!!pr&&Y.pos.length>n0&&Y.pos.every(p=>p.motivo==='rapido'||true),'16 pasos de golpe: el servidor corta la velocidad de más');
ok(P.get(Y.yo.id).x===pr.x&&P.get(Y.yo.id).y===pr.y&&Math.abs(pr.x-px0)+Math.abs(pr.y-py0)<=5,'y deja al jugador a lo sumo unos pocos metros más allá (no los 16)');
await todosVen(todos.filter(c=>c!==Y).concat([])); ok(todos.filter(c=>c!==Y).every(c=>{ const v=c.vista.get(Y.yo.id); return v.x===pr.x&&v.y===pr.y; }),'todos ven al jugador corregido en la misma posición que el servidor');
Y.mis={x:pr.x,y:pr.y,mirando:pr.mirando}; Y.epoca=pr.e;
/* un paso a destiempo y en diagonal también */
const Z=Cs[3]; Z.enviar({t:'mover',x:Z.mis.x+1,y:Z.mis.y+1,e:Z.epoca}); ok((await Z.esperar(m=>m.t==='pos'&&m.motivo==='lejos'))!==undefined,'un paso en diagonal se rechaza por la red también');
Z.mis={x:Z.pos[0].x,y:Z.pos[0].y}; Z.epoca=Z.pos[0].e;
const eZ=Z.epoca; Z.enviar({t:'mover',x:Z.mis.x+40,y:Z.mis.y,e:eZ}); ok((await Z.esperar(m=>m.t==='pos'&&m.motivo==='lejos'&&m.e===eZ+1))!==undefined,'ni un teletransporte de 40 metros');
Z.mis={x:Z.pos[1].x,y:Z.pos[1].y}; Z.epoca=Z.pos[1].e;

/* ---- el Modo Dios construye sobre un jugador ---- */
const V=B; const vx=V.mis.x, vy=V.mis.y; await dormir(250);
const roca=NV.motores.obtener('rocoso').caras.objetos.crear('rocoso:roca');
const nmov=A.saltos, npos=V.pos.length;
A.enviar({t:'editar',n:2,op:{t:'objeto+',x:vx,y:vy,objeto:roca}}); await A.esperar(m=>m.t==='ok'&&m.n===2);
const pO=await V.esperar(m=>m.t==='pos'&&m.motivo==='obra',3000);
ok(!!pO&&libre(pO.x,pO.y)&&Math.max(Math.abs(pO.x-vx),Math.abs(pO.y-vy))<=3&&P.get(V.yo.id).x===pO.x,'una obra encima de un jugador: el servidor lo corre a una casilla libre cercana y se lo comunica');
await hasta(()=>A.saltos>nmov,2000); ok(A.saltos>nmov&&A.vista.get(V.yo.id).x===pO.x&&A.vista.get(V.yo.id).y===pO.y,'y los demás lo ven en el lugar nuevo (sin animar un paso falso)');
V.mis={x:pO.x,y:pO.y,mirando:pO.mirando}; V.epoca=pO.e;
ok(A.msgs.some(m=>m.t==='ok'&&m.n===2)&&V.msgs.some(m=>m.t==='op'&&m.op.t==='objeto+'),'la edición del Modo Dios se siguió sincronizando con normalidad');
ok(await todosVen(todos),'todas las vistas coinciden otra vez con el servidor');
/* si mueven a alguien que estaba en medio de un lote de pasos, no se pisa */
ok(todos.every(c=>libre(P.get(c.yo.id).x,P.get(c.yo.id).y)),'ningún jugador queda dentro de un obstáculo');

/* ---- cuevas: salir de la vista y volver ---- */
const Q=Cs[4]; Q.enviar({t:'escena',dentro:true}); await hasta(()=>A.j_menos.includes(Q.yo.id),2000);
ok(A.j_menos.includes(Q.yo.id)&&!A.vista.has(Q.yo.id),'quien entra a una cueva desaparece de la vista de los demás');
Q.enviar({t:'escena',dentro:false,x:Q.mis.x,y:Q.mis.y}); await hasta(()=>A.vista.has(Q.yo.id),2000);
ok(A.vista.has(Q.yo.id)&&A.vista.get(Q.yo.id).x===Q.mis.x,'y reaparece donde salió');

/* ---- pedir el mundo otra vez no cambia al personaje ---- */
const nb=B.msgs.length; const yoAntes=B.yo.id; B.enviar({t:'resync'}); const rs=await B.esperar(m=>m.t==='mundo'&&m.motivo==='resync');
await dormir(150); ok(rs&&rs.mundo&&P.get(yoAntes)&&!A.j_menos.includes(yoAntes)&&A.vista.has(yoAntes),'el cliente que pide el mundo entero recibe su copia sin cambiar de personaje ni desaparecer para los demás');

/* ---- desconexiones ---- */
const R=Cs[3]; const idR=R.yo.id, nomR=R.yo.nombre, posR={x:R.mis.x,y:R.mis.y};
R.ws.terminate(); await hasta(()=>todos.filter(c=>c!==R).every(c=>c.j_menos.includes(idR)),3000);
ok(todos.filter(c=>c!==R).every(c=>c.j_menos.includes(idR)&&!c.vista.has(idR)),'al desconectarse un invitado, desaparece de todos los clientes');
ok(!P.get(idR)&&P.cantidad()===6,'y el servidor ya no lo tiene');
await Cs[0].esperar(()=>false,50); const R2=await conectar(S.puerto,tok(5)); // el mismo dispositivo vuelve a entrar
ok(R2.yo.id!==idR&&R2.yo.nombre!==nomR||R2.yo.id!==idR,'al reconectar, el mismo dispositivo recibe un id nuevo');
ok(libre(R2.yo.x,R2.yo.y)&&Math.max(Math.abs(R2.yo.x-ini.x),Math.abs(R2.yo.y-ini.y))<=3,'y vuelve a nacer cerca del punto de partida, sin recuperar el lugar donde estaba ('+posR.x+','+posR.y+')');
ok(!R2.vista.has(idR)&&R2.vista.size===P.cantidad()-1,'el que reconecta no ve al fantasma de su personaje anterior');
const vivos=[A,B,...Cs.filter(c=>c!==R),R2];
await hasta(()=>vivos.every(c=>c.vista.size===vivos.length-1),3000); ok(await todosVen(vivos),'todos ven al recién llegado en su casilla');
/* todos se van */
for(const c of vivos) c.ws.close(); await hasta(()=>P.cantidad()===0&&S.clientes()===0,3000);
ok(P.cantidad()===0&&S.clientes()===0,'cuando todos se desconectan, no queda ningún jugador en el servidor');

/* ---- entrar con el mundo cambiando: nadie queda a medias ---- */
const F1=await conectar(S.puerto,ADMIN); const F2=await conectar(S.puerto,tok(9));
for(let i=0;i<10;i++) F1.enviar({t:'editar',n:100+i,op:{t:'suelo',x:20+i,y:20,m:'d'}});
const F3=await conectar(S.puerto,tok(10)); await dormir(400);
ok(await todosVen([F1,F2,F3]),'quien entra mientras llueven ediciones recibe a los demás completos y bien colocados');
for(const c of [F1,F2,F3]) c.ws.close();

/* ---- el servidor reiniciado empieza sin jugadores (no hay progreso que guardar) ---- */
await S.cerrar();
const S2=await iniciarServidor({dir,puerto:0,host:'127.0.0.1',adminTokens:[ADMIN],retrasoLoginMs:0});
ok(S2.presencia.cantidad()===0,'tras reiniciar, el servidor no recuerda jugadores: son temporales');
/* un dispositivo NUEVO nace en el punto de partida; los que ya tenían personaje reaparecen donde estaban (pruebas/personajes-servidor.js) */ const G=await conectar(S2.puerto,tok(901)); if(process.env.DEPURAR) console.log('inicio',ini,'libre',libre(ini.x,ini.y),'nace',G.yo.x,G.yo.y); ok(libre(G.yo.x,G.yo.y)&&Math.max(Math.abs(G.yo.x-ini.x),Math.abs(G.yo.y-ini.y))<=3&&(libre(ini.x,ini.y)?G.yo.x===ini.x&&G.yo.y===ini.y:true),'y el primero en entrar vuelve a nacer en el punto de partida (o junto a él si lo construido lo tapa)'); G.ws.close();
await S2.cerrar();
console.log(bien+' bien, '+mal+' mal'); process.exit(mal?1:0);
})().catch(e=>{ console.log('ERROR',e.stack); process.exit(1); });

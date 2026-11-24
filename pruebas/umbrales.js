/* Pruebas de Umbrales (laboratorio). */
const NV=require('./cargar.js')();
let bien=0,mal=0; const ok=(c,m)=>{ if(c) bien++; else { mal++; console.log('MAL:',m); } };
const U=NV.umbrales, CV=NV.cuevas;
const lim=()=>U.reiniciar();
const norte=(mapa,x,y)=>({mapa,x,y});
/* ---- la regla: sin mapa elegido no se entra ---- */
lim(); U.registrarMapa('mundo',{tipo:'mundo'});
U.registrar({id:'boca',mapa:'mundo',x:0,y:0,dx:0,dy:-1,radio:1});
let p=U.puede('boca'); ok(!p.ok&&p.motivo==='sin-destino','un umbral sin mapa elegido no se puede cruzar');
ok(typeof p.mensaje==='string'&&p.mensaje.length>5&&!/\d/.test(p.mensaje),'el mensaje es una frase sin números');
ok(U.bloqueaPaso('mundo',0.2,0.2),'sin mapa elegido actúa como tope');
ok(!U.bloqueaPaso('mundo',5,5),'lejos del umbral no bloquea');
let j=norte('mundo',0.3,0), r=U.paso(j); ok(r&&!r.ok&&r.motivo==='sin-destino'&&j.mapa==='mundo','quien camina no entra y queda en su mapa');
ok(r.rebote&&Math.hypot(r.rebote.x-0,r.rebote.y-0)>1,'el rechazo trae un punto de rebote fuera del círculo');
ok(U.paso(j)===null,'estando parado sobre un umbral cerrado no se repite el aviso');
/* elegido pero inexistente */
U.elegirMapa('boca','cueva-1'); p=U.puede('boca'); ok(!p.ok&&p.motivo==='mapa-inexistente','mapa elegido que aún no existe: no se entra');
/* existe pero sin puertas */
U.registrarMapa('cueva-1',{tipo:'cueva'}); p=U.puede('boca'); ok(!p.ok&&p.motivo==='sin-puertas','mapa sin puertas: no se entra');
/* puerta que no pertenece a ese mapa */
U.registrar({id:'otra',mapa:'mundo',x:9,y:9}); U.elegirMapa('boca','cueva-1','otra'); ok(U.puede('boca').motivo==='puerta-inexistente','la puerta elegida debe ser de ese mapa');
/* cerrado */
U.registrar({id:'c1:a',mapa:'cueva-1',tipo:'salida',x:-10,y:2,dx:-1,dy:0,radio:0.8}); U.elegirMapa('boca','cueva-1','c1:a'); ok(U.puede('boca').ok,'con mapa y puerta válidos se puede');
U.abrir('boca',false); ok(U.puede('boca').motivo==='cerrado','un umbral cerrado no se cruza'); U.abrir('boca',true);
/* ---- cruzar y llegar ---- */
const evs=[]; const off=U.alCruzar(e=>evs.push(e)); const bl=[]; U.alBloquear(e=>bl.push(e));
j={mapa:'mundo',x:0.2,y:0.1}; r=U.paso(j);
ok(r.ok&&j.mapa==='cueva-1','cruza y queda en el mapa de destino');
ok(Math.hypot(j.x-(-10),j.y-2)>0.8&&j.x>-10&&Math.abs(j.y-2)<1e-9,'aparece delante de la puerta de destino, dentro de su mapa (no encima)');
ok(Math.abs(j.dx-1)<1e-9&&Math.abs(j.dy)<1e-9,'mira hacia adentro de su mapa');
ok(U.detectar('cueva-1',j.x,j.y)===null,'aparece fuera del círculo de la puerta: no vuelve a disparar');
ok(U.paso(j)===null,'un paso más en el sitio no cruza de nuevo');
ok(evs.length===1&&evs[0].mapa==='cueva-1','el evento de cruce se emite una vez'); off();
U.paso(Object.assign({},{mapa:'mundo',x:0.2,y:0.1})); ok(evs.length===1,'quitar el oyente funciona');
/* ---- vincular: ida y vuelta ---- */
lim(); U.registrarMapa('mundo'); U.registrarMapa('cueva');
U.registrar({id:'m:b',mapa:'mundo',x:20,y:5,dx:0,dy:-1,radio:1}); U.registrar({id:'c:a',mapa:'cueva',tipo:'salida',x:-14,y:2,dx:-1,dy:0,radio:0.9});
U.vincular('m:b','c:a'); ok(U.puede('m:b').ok&&U.puede('c:a').ok,'vincular abre los dos sentidos');
j={mapa:'mundo',x:20,y:5.4}; for(let y=6;y>=4;y-=0.5){ j.y=y; if(U.paso(j)) break; } ok(j.mapa==='cueva','entra por la boca de afuera');
const ent={x:j.x,y:j.y}; U.registrar({id:'tmp',mapa:'cueva',x:ent.x,y:ent.y,radio:0.3}); U.quitar('tmp');
j.x=-14; j.y=2; j.sobre=null; r=U.paso(j); ok(r&&r.ok&&j.mapa==='mundo','sale por la salida de adentro');
ok(j.y>5&&Math.abs(j.x-20)<1e-9&&j.dy>0,'sale delante de la boca de afuera, mirando hacia afuera');
ok(U.detectar('mundo',j.x,j.y)===null,'y fuera de su círculo');
try{ U.vincular('m:b','m:b'); ok(false,'no se puede vincular un umbral consigo mismo'); }catch(e){ ok(true,'no se puede vincular un umbral consigo mismo'); }
U.desvincular('m:b',true); ok(!U.puede('m:b').ok&&!U.puede('c:a').ok,'desvincular en ambos lados cierra la ida y la vuelta');
/* ---- una cueva se registra sola ---- */
lim(); U.registrarMapa('mundo'); const S=CV.crear({tipo:'galeria',sem:7}); const us=U.desdeCueva('cueva-7',S,{nombre:'Galería'});
ok(us.length===S.spec.salidas&&us.every(u=>u.mapa==='cueva-7'&&u.tipo==='salida'),'desdeCueva registra una salida por cada boca');
ok(U.mapa('cueva-7').tipo==='cueva'&&U.mapa('cueva-7').cueva.tipo==='galeria','y el mapa guarda la spec de la cueva');
ok(us.every(u=>!U.puede(u.id).ok),'las salidas nuevas no llevan a ningún lado hasta que se las ate');
ok(us.every(u=>CV.suelo(S,u.x,u.y).libre),'cada salida está en suelo libre de la cueva (misma z que y)');
ok(us.every(u=>Math.abs(Math.hypot(u.dx,u.dy)-1)<1e-9),'direcciones unitarias');
U.registrar({id:'mundo:b',mapa:'mundo',x:3,y:3,dx:0,dy:-1}); U.vincular('mundo:b',us[0].id); ok(U.puede('mundo:b').ok&&U.puede(us[0].id).ok,'se ata la boca de afuera con la salida de adentro');
/* elegir sólo el mapa: entra por la primera puerta */
U.registrar({id:'mundo:c',mapa:'mundo',x:7,y:3}); U.elegirMapa('mundo:c','cueva-7'); ok(U.puede('mundo:c').ok&&U.puede('mundo:c').destino.umbral===us[0].id,'elegir sólo el mapa entra por su primera puerta');
/* ---- guardado ---- */
const dump=U.exportar(), txt=JSON.stringify(dump); U.reiniciar(); ok(U.lista().length===0,'reiniciar vacía'); const r2=U.importar(JSON.parse(txt));
ok(r2.umbrales===dump.umbrales.length&&r2.mapas===dump.mapas.length&&U.puede('mundo:b').ok,'exportar e importar conservan umbrales, mapas y vínculos');
let e=0; try{ U.importar({version:9}); }catch(x){ e=1; } ok(e,'un archivo desconocido se rechaza');
e=0; try{ U.registrar({id:'x'}); }catch(x){ e=1; } ok(e,'un umbral sin mapa propio se rechaza');
ok(U.deObjeto(U.aObjeto('mundo:b')).id==='mundo:b','pasa por el formato de objeto del mundo');
U.quitarMapa('cueva-7'); ok(U.lista('cueva-7').length===0&&U.puede('mundo:b').motivo==='mapa-inexistente','quitar un mapa quita sus umbrales y deja sin salida a los que llevaban allí');
/* un oyente que falla no frena a los demás */
lim(); U.registrarMapa('a'); U.registrarMapa('b'); U.registrar({id:'a1',mapa:'a',x:0,y:0}); U.registrar({id:'b1',mapa:'b',x:0,y:0}); U.vincular('a1','b1'); let llamado=0; U.alCruzar(()=>{ throw new Error('x'); }); U.alCruzar(()=>llamado++);
U.cruzar('a1',{mapa:'a',x:0,y:0}); ok(llamado===1,'un oyente que falla no frena a los demás');
/* los números nunca llegan al jugador */
ok(U.MOTIVOS.every(m=>!/\d/.test(U.mensaje(m))),'ningún mensaje lleva números');
console.log(mal?'FALLAN '+mal+' de '+(bien+mal):'todo bien '+bien+' ok'); process.exit(mal?1:0);

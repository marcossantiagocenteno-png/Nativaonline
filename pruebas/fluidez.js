// FLUIDEZ: mide si el recorrido avanza de forma continua o a saltos, con un reloj virtual.
//   node pruebas/fluidez.js [--hz=60] [--costo=ms] [--arboles] [--json]
// Reproduce el ciclo real del juego (temporizadores de pasos y de animación + lazo de cuadros)
// sobre un reloj que se controla, y en cada cuadro dibujado anota dónde está la cámara, el
// personaje y el tiempo del ambiente. Después resume lo que el ojo nota:
//   · cuadros: cada cuánto se dibuja y cuánto varía ese intervalo
//   · rugosidad del avance: cuánto cambia la velocidad con que se desliza el escenario
//   · personaje en pantalla: cuánto se mueve respecto de la pantalla (si la cámara lo sigue bien, casi nada)
//   · paradas: cuadros en que el personaje se detiene entre dos pasos aunque se siga caminando
//   · ambiente: cuántas veces por segundo cambia el tiempo del viento y del pasto
// Los números NO son de un monitor real: sirven para comparar "antes" y "después".
const arg=(n,d)=>{ const a=process.argv.find(x=>x.startsWith('--'+n+'=')); return a?a.split('=')[1]:d; };
const HZ=+arg('hz',60), COSTO=+arg('costo',0), JSON_OUT=process.argv.includes('--json'), TAU=arg('tau',null), SOLO=arg('solo',null);
if(process.argv.includes('--arboles')) global.__arboles=true;
const cargar=require('./cargar.js');

/* ---- el reloj y los temporizadores virtuales ---- */
let T=1e6, tid=1, timers=[], rafs=[];
global.setInterval=(f,ms)=>{ const t={id:tid++,f,ms,next:T+ms}; timers.push(t); return t.id; };
global.setTimeout=(f,ms)=>{ const t={id:tid++,f,ms,next:T+ms,una:true}; timers.push(t); return t.id; };
global.clearInterval=global.clearTimeout=id=>{ timers=timers.filter(t=>t.id!==id); };
global.requestAnimationFrame=cb=>{ rafs.push(cb); return rafs.length; };
global.cancelAnimationFrame=()=>{};
Date.now=()=>T;

/* contador de cuadros dibujados de verdad, sólo para esta prueba */
const MARCA=[["  if(dt>46&&animMs<520)","  NV._dibujos=(NV._dibujos||0)+1;\n  if(dt>46&&animMs<520)"]];
function nuevoJuego(paso){
  global.performance={now:()=>T};
  timers=[]; rafs=[];
  const rep=MARCA.concat(paso?[['const PASO_MS=186','const PASO_MS='+paso]]:[]).concat(TAU?[['const CAM_TAU=0.07','const CAM_TAU='+TAU]]:[]);
  const g=cargar(`module.exports={NV:window.NV, me:()=>me, camX:()=>camX, camY:()=>camY, cw:()=>cw, chh:()=>chh,
    animMs:()=>animMs, frame:()=>frame, calidad:()=>calidad, andar:empezarACaminar, parar:dejarDeCaminar, ir:irHacia, mover:move,
    poner:(x,y)=>{ me.x=x; me.y=y; NV.desdeX=undefined; NV.desdeY=undefined; NV.camXf=undefined; NV.camYf=undefined; NV.camAlz=undefined; },
    visor:()=>{ draw(); }};`,rep);
  g.NV.particulas=false;
  return g;
}

/* ---- un recorrido ---- */
function recorrer(g,{ms,guion,paso}){
  const NV=g.NV, P=1000/HZ, filas=[];
  g.visor();                               // el cuadro inicial
  let t0=T, d0=NV._dibujos||0, proximoVsync=T+P, ultimoGuion=0;
  const fin=T+ms;
  while(T<fin){
    T=proximoVsync; proximoVsync+=P;
    /* guion: acciones en un instante (teclas) */
    while(guion.length&&guion[0].t<=T-t0){ guion.shift().f(); }
    /* temporizadores vencidos (pasos y animación), en orden */
    timers.sort((a,b)=>a.next-b.next);
    for(const tm of timers.slice()){ if(tm.next<=T&&timers.includes(tm)){ tm.f(); if(tm.una) timers=timers.filter(x=>x!==tm); else tm.next+=tm.ms; } }
    /* los cuadros pedidos */
    const cb=rafs; rafs=[]; const antes=NV._dibujos||0, r0=process.hrtime.bigint();
    for(const f of cb) f(T);
    const real=Number(process.hrtime.bigint()-r0)/1e6;
    if((NV._dibujos||0)>antes){
      const pp=NV.posDibujo(T), cw=g.cw(), chh=g.chh(), CPM=NV.CPM(), cx=g.camX(), cy=g.camY();
      const colJ=Math.round((pp.x-cx)*CPM+CPM/2);
      filas.push({T:T-t0, real, camXf:NV.camXf, camYf:NV.camYf, ppx:pp.x, ppy:pp.y, tp:pp.tp,
        pantX:colJ*cw+(NV.desplaceX||0), pantXideal:(pp.x-NV.camXf)*CPM*cw+cw*CPM/2, mx:g.me().x, my:g.me().y,
        frame:g.frame(), tv:NV.tViento||0, pxm:CPM*cw});
      if(COSTO>0) T+=COSTO;                  // un cuadro caro retrasa el siguiente
      while(proximoVsync<=T) proximoVsync+=P;
    }
  }
  return filas;
}

/* ---- métricas ---- */
const media=a=>a.reduce((s,x)=>s+x,0)/(a.length||1);
const desv=a=>{ const m=media(a); return Math.sqrt(media(a.map(x=>(x-m)*(x-m)))); };
const pct=(a,p)=>{ const s=a.slice().sort((x,y)=>x-y); return s[Math.min(s.length-1,Math.floor(p*s.length))]; };
function medir(filas,eje){
  const R={};
  const f=filas.filter(r=>r.T>700&&r.T<filas[filas.length-1].T-300);        // régimen: sin el arranque ni el final
  const dts=[]; for(let i=1;i<f.length;i++) dts.push(f[i].T-f[i-1].T);
  R.cuadros_por_s=+(1000/media(dts)).toFixed(1);
  R.intervalo_ms={medio:+media(dts).toFixed(1),max:+Math.max(...dts).toFixed(1),desv:+desv(dts).toFixed(1)};
  /* velocidad con la que se desliza el escenario (px/s) en cada cuadro */
  const cam=eje==='y'?'camYf':'camXf', pxm=r=>r.pxm;
  const vel=[]; for(let i=1;i<f.length;i++) vel.push((f[i][cam]-f[i-1][cam])*pxm(f[i])/((f[i].T-f[i-1].T)/1000));
  const vm=media(vel);
  R.escenario_px_s={medio:+vm.toFixed(0),rugosidad_pct:+(100*desv(vel)/Math.abs(vm||1)).toFixed(0),
    peor_pct:+(100*Math.max(...vel.map(v=>Math.abs(v-vm)))/Math.abs(vm||1)).toFixed(0)};
  /* el personaje contra la pantalla: sin tendencia lineal, cuánto baila */
  const sx=f.map(r=>r.pantX), n=sx.length, tt=f.map(r=>r.T);
  const mt=media(tt), ms_=media(sx); let sxy=0,sxx=0; for(let i=0;i<n;i++){ sxy+=(tt[i]-mt)*(sx[i]-ms_); sxx+=(tt[i]-mt)*(tt[i]-mt); }
  const b=sxx?sxy/sxx:0; const res=sx.map((x,i)=>x-(ms_+b*(tt[i]-mt)));
  R.personaje_en_pantalla_px={deriva_px_s:+(b*1000).toFixed(1),vaiven_pico_a_pico:+(Math.max(...res)-Math.min(...res)).toFixed(1),rms:+desv(res).toFixed(2)};
  /* paradas: cuadros con el personaje quieto entre pasos mientras se sigue andando */
  let quietos=0, seguidos=0, peor=0;
  for(let i=1;i<f.length;i++){ const q=Math.abs(f[i].ppx-f[i-1].ppx)+Math.abs(f[i].ppy-f[i-1].ppy)<1e-9; if(q){ quietos++; seguidos++; peor=Math.max(peor,seguidos); } else seguidos=0; }
  R.paradas={cuadros_quietos:quietos,de:f.length-1,racha_max:peor};
  /* el ambiente: cuántas veces por segundo cambia el tiempo que leen el viento y el pasto */
  let cambios=0; for(let i=1;i<f.length;i++) if(f[i].tv!==f[i-1].tv) cambios++;
  const dur=(f[f.length-1].T-f[0].T)/1000;
  R.ambiente={cambios_por_s:+(cambios/dur).toFixed(1),cuadros_con_ambiente_repetido_pct:+(100*(1-cambios/(f.length-1))).toFixed(0)};
  /* cuánto cuesta calcular un cuadro (JS, sin pintar de verdad) */
  R.costo_cuadro_ms={medio:+media(f.map(r=>r.real)).toFixed(1),p95:+pct(f.map(r=>r.real),0.95).toFixed(1)};
  return R;
}

/* ---- recorridos ---- */
function librePara(g,dx,dy,n,desde){
  const NV=g.NV; const cand=desde||[[50,50],[30,70],[70,30],[-50,50],[150,50],[50,-50],[50,150],[20,20],[80,80]];
  for(const [x0,y0] of cand) for(let k=0;k<30;k++){
    const x=x0+(k%6)*5, y=y0+Math.floor(k/6)*5; let ok=true;
    for(let i=0;i<=n&&ok;i++){ const X=x+dx*i, Y=y+dy*i; if(!NV.sueloEn(X,Y)||NV.solidoEn(X,Y)||NV.sueloEn(X,Y)==='A'||NV.sueloEn(X,Y)==='a'||NV.sueloEn(X,Y)==='P') ok=false; }
    if(ok) return [x,y];
  }
  return null;
}
const ESCENAS=[];
const esc=(nombre,eje,fn,opts)=>ESCENAS.push({nombre,eje,fn,opts:opts||{}});
esc('1 caminar en línea recta','x',(g)=>{ const [x,y]=librePara(g,1,0,40); g.poner(x,y); return {ms:5200,guion:[{t:300,f:()=>g.andar(1,0)}]}; });
esc('2 correr (paso de 130 ms)','x',(g)=>{ const [x,y]=librePara(g,1,0,50); g.poner(x,y); return {ms:5200,guion:[{t:300,f:()=>g.andar(1,0)}]}; },{paso:130});
esc('3 diagonal (escalera hacia el sureste)','x',(g)=>{ const [x,y]=librePara(g,1,0,26); g.poner(x,y); return {ms:5400,guion:[{t:300,f:()=>g.ir(x+14,y+14)}]}; });
function libreCuadro(g,r){
  const NV=g.NV; for(const [x0,y0] of [[50,50],[30,70],[70,30],[-50,50],[150,50],[50,-50],[50,150],[20,20],[80,80]]) for(let k=0;k<60;k++){
    const cx=x0+(k%8)*4, cy=y0+Math.floor(k/8)*4; let ok=true;
    for(let j=-r;j<=r&&ok;j++) for(let i=-r;i<=r&&ok;i++){ const c=NV.sueloEn(cx+i,cy+j); if(!c||NV.solidoEn(cx+i,cy+j)||c==='A'||c==='a'||c==='P') ok=false; }
    if(ok) return [cx,cy];
  } return null;
}
esc('4 cambios rápidos de dirección','x',(g)=>{ const [x,y]=libreCuadro(g,8); g.poner(x-4,y);
  const L=[[1,0],[1,0],[0,1],[-1,0],[-1,0],[-1,0],[0,-1],[1,0],[1,0],[1,0],[-1,0],[1,0],[0,1],[0,-1],[1,0],[1,0]]; const gu=[]; let t=300;
  for(const [dx,dy] of L){ gu.push({t,f:()=>g.andar(dx,dy)}); t+=186*2; }
  return {ms:t+900,guion:gu}; });

/* ---- ejecución ---- */
const salida=[];
for(const E of ESCENAS){
  if(SOLO&&E.nombre[0]!==SOLO) continue;
  const g=nuevoJuego(E.opts.paso);
  const cfg=E.fn(g); cfg.paso=E.opts.paso;
  const filas=recorrer(g,cfg);
  const r=medir(filas,E.eje); r.escena=E.nombre; salida.push(r);
  g.parar(); timers=[];
}
/* ---- lo que tiene que cumplirse ----
   En línea recta (caminar y correr) el avance es uniforme y el personaje casi no se mueve en pantalla.
   En escalera y en giros el escenario va a pulsos POR DISEÑO (el personaje anda por casillas y por ejes),
   así que ahí sólo se exige lo que sí depende de la corrección: cuadros parejos, sin paradas, ambiente continuo. */
const fallos=[];
const exige=(cond,txt)=>{ if(!cond) fallos.push(txt); };
for(const r of salida){
  const recta=/^[12] /.test(r.escena), n=r.escena.split(' ')[0]+' ';
  exige(r.cuadros_por_s>=0.93*1000/(COSTO?Math.ceil(COSTO/(1000/HZ))*(1000/HZ):1000/HZ),n+'cuadros por segundo por debajo de lo esperado');
  exige(r.intervalo_ms.desv<=2.5,n+'los cuadros llegan a intervalos desparejos');
  exige(r.paradas.cuadros_quietos===0,n+'el personaje se detiene entre pasos');
  exige(r.ambiente.cuadros_con_ambiente_repetido_pct<=5,n+'el ambiente se actualiza a saltos');
  if(recta){
    exige(r.escenario_px_s.rugosidad_pct<=3,n+'el escenario avanza a tirones (rugosidad '+r.escenario_px_s.rugosidad_pct+' %)');
    exige(r.personaje_en_pantalla_px.vaiven_pico_a_pico<=6,n+'el personaje se bambolea en pantalla');
    exige(Math.abs(r.personaje_en_pantalla_px.deriva_px_s)<=2,n+'la cámara se queda atrás o se adelanta');
  }
}
if(JSON_OUT){ console.log(JSON.stringify(salida)); process.exit(fallos.length?1:0); }
console.log('Pantalla simulada a '+HZ+' Hz'+(COSTO?' · cada cuadro dibujado cuesta '+COSTO+' ms virtuales':'')+(global.__arboles?' · con árboles':'')+'\n');
for(const r of salida){
  console.log('== '+r.escena);
  console.log('   cuadros: '+r.cuadros_por_s+'/s · intervalo medio '+r.intervalo_ms.medio+' ms, máx '+r.intervalo_ms.max+', desv '+r.intervalo_ms.desv);
  console.log('   escenario: '+r.escenario_px_s.medio+' px/s · rugosidad '+r.escenario_px_s.rugosidad_pct+'% (peor cuadro '+r.escenario_px_s.peor_pct+'% fuera de la media)');
  console.log('   personaje en pantalla: deriva '+r.personaje_en_pantalla_px.deriva_px_s+' px/s · vaivén '+r.personaje_en_pantalla_px.vaiven_pico_a_pico+' px (rms '+r.personaje_en_pantalla_px.rms+')');
  console.log('   paradas: '+r.paradas.cuadros_quietos+' cuadros quietos de '+r.paradas.de+' (racha máx '+r.paradas.racha_max+')');
  console.log('   ambiente: cambia '+r.ambiente.cambios_por_s+' veces/s · '+r.ambiente.cuadros_con_ambiente_repetido_pct+'% de los cuadros repiten el mismo tiempo');
  console.log('   costo de calcular un cuadro: '+r.costo_cuadro_ms.medio+' ms (p95 '+r.costo_cuadro_ms.p95+')');
}

if(fallos.length){ console.log('\n✗ '+fallos.length+' fallas:'); fallos.forEach(x=>console.log('   · '+x)); process.exit(1); }
console.log('\nTodo en orden: avance uniforme, cámara sin tirones, sin paradas y ambiente continuo.');

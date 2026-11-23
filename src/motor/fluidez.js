/* Nativa Online — EL MOTOR GLOBAL DE FLUIDEZ.
   Vive mientras el juego está abierto y no cambia nada de lo que se ve ni de la velocidad de la simulación: sólo MIRA.
   Qué mide, y cómo cuesta casi nada:
     · cada cuadro: el intervalo entre cuadros (lo que el ojo nota), cuánto trabajó el hilo (lógica + pintado) y cuánto
       esperó (el navegador); en un anillo de 600 muestras, sin crear objetos por cuadro
     · fases: lógica del cuadro, preparación del mundo (draw_), pintado (flush); y, UNO de cada 24 cuadros, el tiempo
       de cada motor (pasto, suelo, detalle, caminos, terreno, árboles/rocas) envolviendo sus funciones. Los cuadros que
       no se muestrean no pagan nada por eso.
     · respuesta de los controles: del evento (tecla, clic, rueda) al final del cuadro que lo dibujó
     · tirones: un cuadro que tarda más de 2× lo normal (y más de 28 ms): se anota cuándo, cuánto, y qué fase lo causó
     · zonas: en los cuadros muestreados, cuánto cuesta cada bloque de 8×8 m del mapa
   Lo consulta el Modo Dios (pestaña Fluidez). NV.fluidez.apagado=true lo desconecta del todo. */
(function(){
'use strict';
const NV=window.NV, N=600, MUESTREO=24;
const F=NV.fluidez={apagado:false};
const ahora=()=>performance.now();
const iv=new Float32Array(N), cpu=new Float32Array(N), fl=new Float32Array(N), fp=new Float32Array(N), lat=new Float32Array(N);
let i=0, n=0, tPrev=0, t0=0, cuadroN=0, fases={}, culpa='', pendientes=[], latUlt=0;
F.muestreando=false;
const motores={}, zonas=new Map(), tirones=[], cuenta={}, muestreaTodo={'árboles':true,'rocas':true};
F.fases=fases;
/* una fase del cuadro actual (la llama flush, por ejemplo) */
F.fase=(nombre,ms)=>{ if(F.apagado) return; fases[nombre]=(fases[nombre]||0)+ms; };
/* un evento de entrada (tecla, clic, rueda): su respuesta se mide hasta el fin del cuadro que lo dibuja */
F.entrada=(t)=>{ if(F.apagado) return; if(pendientes.length<8) pendientes.push(t===undefined?ahora():t); };
F.inicio=function(){
  if(F.apagado) return;
  t0=ahora(); fases={}; F.fases=fases; cuadroN++; F.muestreando=(cuadroN%MUESTREO)===0;
};
F.fin=function(){
  if(F.apagado||!t0) return;
  const t=ahora(), trabajo=t-t0, intervalo=tPrev?t0-tPrev:0; tPrev=t0;
  if(intervalo>0&&intervalo<1000){
    iv[i]=intervalo; cpu[i]=trabajo; fl[i]=fases.pintar||0; fp[i]=fases.mundo||0; lat[i]=0;
    for(const p of pendientes){ const l=t-p; if(l>=0&&l<2000){ lat[i]=Math.max(lat[i],l); latUlt=l; } } pendientes.length=0;
    /* ¿tirón? más de 2× el intervalo típico y más de 28 ms */
    const med=mediana(iv,Math.min(n,120));
    if(n>30&&intervalo>Math.max(28,2*med)){
      let mayor='lógica', mm=trabajo-(fases.pintar||0)-(fases.mundo||0);
      if((fases.mundo||0)>mm){ mayor='mundo'; mm=fases.mundo; } if((fases.pintar||0)>mm){ mayor='pintado'; mm=fases.pintar; }
      if(trabajo<intervalo*0.45) mayor='navegador (el hilo esperaba)';
      tirones.push({t:Math.round(t),ms:Math.round(intervalo),trabajo:Math.round(trabajo),culpable:mayor}); if(tirones.length>100) tirones.shift();
    }
    i=(i+1)%N; if(n<N) n++;
  }
  t0=0; F.muestreando=false;
};
function mediana(a,m){ if(!m) return 16.7; const b=[]; for(let k=0;k<m;k++) b.push(a[(i-1-k+N*2)%N]); b.sort((x,y)=>x-y); return b[b.length>>1]; }

/* ---- los motores: se envuelven sus funciones públicas; el envoltorio sólo cuesta en los cuadros muestreados ---- */
function envolver(nombre,dueño,prop,clave){
  const f=dueño[prop]; if(typeof f!=='function'||f.__flu) return false;
  /* Las funciones que se llaman miles de veces por cuadro (una por metro o por celda) NO se cronometran una a una:
     cronometrar cuesta más que la función y metía un tirón cada 24 cuadros. Se mide 1 llamada de cada 32 y se
     multiplica; las que se llaman una vez por cuadro se miden siempre. */
  const w=function(){
    if(!F.muestreando) return f.apply(this,arguments);
    if(muestreaTodo[nombre]!==true&&++cuenta[nombre]%32!==0) return f.apply(this,arguments);
    const t=ahora(); const r=f.apply(this,arguments); const d=(ahora()-t)*(muestreaTodo[nombre]===true?1:32);
    motores[nombre]=(motores[nombre]||0)+d;
    if(clave){ const k=clave(arguments); zonas.set(k,(zonas.get(k)||0)+d); }
    return r;
  };
  cuenta[nombre]=0;
  w.__flu=true; dueño[prop]=w; return true;
}
const bloque=a=>(Math.floor(a[0]/8)*8)+','+(Math.floor(a[1]/8)*8);
/* se llama una vez con todo ya cargado */
F.instrumentar=function(){
  const g=window, hechos=[];
  const prueba=(nombre,dueño,prop,clave)=>{ try{ if(dueño&&envolver(nombre,dueño,prop,clave)) hechos.push(nombre); }catch(e){} };
  prueba('pasto',g,'pastoFranja',bloque);
  prueba('terreno',NV.terreno,'dibujarMetro',bloque);
  prueba('caminos',NV.caminos,'celdaRed');
  prueba('suelo',g,'celdaSuelo');
  prueba('detalle',g,'detallar');
  prueba('árboles',NV.arbolado,'dibujar'); prueba('rocas',NV.rocoso,'dibujar');
  return hechos;
};

/* ---- lo que muestra el Modo Dios ---- */
function stat(a,m){ const b=[]; for(let k=0;k<m;k++) b.push(a[(i-1-k+N*2)%N]); b.sort((x,y)=>x-y);
  const s=b.reduce((p,q)=>p+q,0); return {prom:s/(m||1),p50:b[m>>1]||0,p95:b[Math.floor(m*0.95)]||0,max:b[m-1]||0,b}; }
F.resumen=function(){
  const m=Math.min(n,120); if(m<5) return null;
  const I=stat(iv,m), C=stat(cpu,m), P=stat(fl,m), W=stat(fp,m);
  let dev=0; for(const x of I.b) dev+=(x-I.prom)*(x-I.prom); dev=Math.sqrt(dev/m);
  const Lm=[]; for(let k=0;k<Math.min(n,N);k++) if(lat[k]>0) Lm.push(lat[k]); Lm.sort((a,b)=>a-b);
  const top=Object.entries(motores).sort((a,b)=>b[1]-a[1]);
  const zs=[...zonas.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5);
  return {fps:1000/I.prom,fpsProm:1000/I.prom,fpsMin:1000/I.max,cuadroMs:I.prom,p95:I.p95,max:I.max,variacion:dev,
    trabajoMs:C.prom,carga:Math.min(1,C.prom/Math.max(1,I.prom)),pintadoMs:P.prom,mundoMs:W.prom,
    respuestaMs:Lm.length?Lm[Math.floor(Lm.length*0.5)]:null,respuestaMax:Lm.length?Lm[Lm.length-1]:null,respuestaUlt:latUlt,
    motores:top,zonas:zs,tirones:tirones.slice(-12),
    pincel:NV.pincel?{activo:NV.pincel.activo,motivo:NV.pincel.motivo,stats:NV.pincel.stats}:null};
};
F.serie=function(){ const m=Math.min(n,N), o=new Float32Array(m); for(let k=0;k<m;k++) o[k]=iv[(i-m+k+N*2)%N]; return o; };
F.serieTrabajo=function(){ const m=Math.min(n,N), o=new Float32Array(m); for(let k=0;k<m;k++) o[k]=cpu[(i-m+k+N*2)%N]; return o; };
F.reiniciar=function(){ i=0; n=0; tPrev=0; tirones.length=0; for(const k in motores) delete motores[k]; zonas.clear(); latUlt=0; };
F.tirones=()=>tirones;
})();

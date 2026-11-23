/* Nativa Online — pestaña "Fluidez" del Modo Dios: el panel del MOTOR GLOBAL DE FLUIDEZ.
   Solo LEE de NV.fluidez (que mide sin tocar nada). Se refresca 2 veces por segundo y sólo mientras la pestaña está
   abierta; con el diagnóstico apagado el medidor deja de registrar y el costo es cero.
   Es una herramienta del que construye el juego: aquí sí hay números, el jugador nunca los ve. */
(function(){
'use strict';
const NV=window.NV, E=NV.editor; if(!E||!E.modos) return;
const $=id=>document.getElementById(id);
let timer=null, grafica=null;
const f1=(x,d=1)=>(x==null||!isFinite(x))?'—':x.toFixed(d);
const NOMBRE={pasto:'pasto',detalle:'detalle del suelo',arbolado:'árboles',rocoso:'rocas',caminos:'caminos'};

function html(){
  return '<div class="tcab">MOTOR GLOBAL DE FLUIDEZ</div>'+
    '<div class="fluCab"><label><input type="checkbox" id="fluOn" checked> diagnóstico activo</label><button id="fluReset">reiniciar</button></div>'+
    '<canvas id="fluGraf" width="300" height="70"></canvas>'+
    '<div id="fluTxt"></div>';
}
function dibujarGrafica(){
  const c=grafica; if(!c) return; const g=c.getContext('2d'), W=c.width, H=c.height;
  g.clearRect(0,0,W,H); g.fillStyle='#0b0d10'; g.fillRect(0,0,W,H);
  const s=NV.fluidez.serie(), w=NV.fluidez.serieTrabajo(), m=s.length; if(m<2) return;
  const tope=100; const y=v=>H-1-Math.min(1,v/tope)*(H-2);
  g.strokeStyle='#3a3320'; g.lineWidth=1; for(const ms of [16.7,33.3,66.7]){ g.beginPath(); g.moveTo(0,y(ms)); g.lineTo(W,y(ms)); g.stroke(); }
  const traza=(a,col)=>{ g.strokeStyle=col; g.beginPath(); for(let k=0;k<m;k++){ const X=k/(m-1)*W; k?g.lineTo(X,y(a[k])):g.moveTo(X,y(a[k])); } g.stroke(); };
  traza(s,'#d8b45a'); traza(w,'#ffffff');
}
function refrescar(){
  const F=NV.fluidez, t=$('fluTxt'); if(!t) return;
  if(F.apagado){ t.innerHTML='<div class="trow"><span class="tet">Diagnóstico apagado: no se mide nada.</span></div>'; return; }
  const r=F.resumen(); if(!r){ t.textContent='Midiendo…'; return; }
  const fila=(a,b)=>'<div class="trow"><span class="tet">'+a+'</span><span>'+b+'</span></div>';
  let h='';
  h+=fila('FPS ahora / mínimo',f1(r.fps,0)+' / '+f1(r.fpsMin,0));
  h+=fila('Cuadro (prom · p95 · máx)',f1(r.cuadroMs)+' · '+f1(r.p95)+' · '+f1(r.max)+' ms');
  h+=fila('Variación del cuadro',f1(r.variacion)+' ms');
  h+=fila('Respuesta a controles',r.respuestaMs==null?'—':f1(r.respuestaMs)+' ms (máx '+f1(r.respuestaMax,0)+')');
  h+=fila('Carga de proceso',f1(r.carga*100,0)+' %  ('+f1(r.trabajoMs)+' ms)');
  h+=fila('Pintado · mundo',f1(r.pintadoMs)+' · '+f1(r.mundoMs)+' ms');
  h+=fila('Pintor',r.pincel&&r.pincel.activo?r.pincel.motivo:'texto (de siempre)');
  const top=r.motores.length?r.motores:[]; const tot=top.reduce((p,q)=>p+q[1],0)||1;
  h+='<div class="tcab">Motor que más consume</div>';
  h+=top.length?top.slice(0,4).map(([k,v],j)=>fila((j?'':'▸ ')+(NOMBRE[k]||k),f1(v)+' ms · '+f1(v/tot*100,0)+' %')).join(''):fila('—','sin muestras aún');
  h+='<div class="tcab">Sectores que más piden (8×8 m)</div>';
  h+=r.zonas.length?r.zonas.map(([k,v])=>fila(String(k).replace(',',' , '),f1(v)+' ms')).join(''):fila('—','sin muestras aún');
  h+='<div class="tcab">Interrupciones recientes</div>';
  h+=r.tirones.length?r.tirones.slice(-6).reverse().map(x=>fila(x.ms+' ms',x.culpable+' (trabajo '+x.trabajo+' ms)')).join(''):fila('—','ninguna');
  t.innerHTML=h; dibujarGrafica();
}
E.modos.fluidez={
  bajar(){}, mover(){}, soltar(){}, tecla(){ return false; }, pintar(){},
  estado(){ return '<b>Fluidez</b>\nOro: tiempo entre cuadros · Blanco: trabajo\nRayas: 60, 30 y 15 FPS'; },
  abrir(){ grafica=$('fluGraf'); refrescar(); clearInterval(timer); timer=setInterval(refrescar,500); },
  cerrar(){ clearInterval(timer); timer=null; },
  iniciar(){
    const r=$('diosFluidez'); if(!r) return; r.innerHTML=html();
    const on=$('fluOn'), rs=$('fluReset');
    if(on) on.addEventListener('change',e=>{ NV.fluidez.apagado=!e.target.checked; refrescar(); });
    if(rs) rs.addEventListener('click',()=>{ NV.fluidez.reiniciar(); refrescar(); });
  }
};
})();

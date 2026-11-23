/* Nativa Online — la interfaz, construida desde JavaScript.
   Vive acá y no en index.html por un motivo concreto: el HTML queda diez minutos
   en la caché del navegador y no hay forma de evitarlo en este alojamiento. Los
   módulos, en cambio, se piden con la hora actual. Teniendo el marcado acá, un
   cambio de interfaz llega al instante y el enlace es siempre el mismo. */

const NVi = window.NV;

/* Sello de versión, puesto por sellar.sh al publicar. Se ve en el pie: así
   Marcos y yo sabemos al instante si está mirando la última versión. */
NVi.VERSION='22/11 19:42';

NVi.MARCADO = `<div id="stage">
  <canvas id="cv"></canvas>
  <div id="reloj"><span id="relojM"></span><span id="relojS"></span></div>
  <div id="compass">N<br><span>&#9650;</span></div>

  <div id="hudTL" class="hud">
    <div id="wname">Claro del norte</div>
    <div id="st1">&mdash;</div>
    <div id="st2"></div>
    <div class="fila"><button id="bAnim" class="on" title="Viento">~</button><button id="bMap" title="Mapa">mapa</button></div>
  </div>

  <div id="map"><div id="mapCab"></div><pre id="mapTx"></pre></div>

  <div id="hudBL" class="hud">
    <div id="st3"></div>
    <div id="ayuda">Flechas o WASD &middot; E para mirar &middot; tocar para ir</div>
    <div id="sello"></div>
  </div>

  <div id="bubble"></div>
  <button id="bInfo" title="Informaci&oacute;n">i</button>
  <aside id="info">
    <div class="icaj" data-cuadro="controles">Controles</div>
  </aside>
  <div id="cuadro"><div class="cbox">
    <button id="cx" title="Cerrar">&times;</button>
    <h2 id="ctit"></h2>
    <div id="ccuerpo"></div>
  </div></div>
</div>

<div id="toast"></div>`;

/* Se inserta al principio del cuerpo, no se reemplaza: la página todavía se está
   leyendo y reemplazarla se llevaría puestos los módulos que faltan cargar. */
document.body.insertAdjacentHTML('afterbegin', NVi.MARCADO);

/* Red de seguridad: si algo revienta, que se lea en la pantalla en vez de
   dejarla en negro sin explicación. */
NVi.avisarError=function(d){
  let c=document.getElementById('fallo');
  if(!c){
    c=document.createElement('pre');
    c.id='fallo';
    document.body.appendChild(c);
  }
  c.textContent=(c.textContent?c.textContent+'\n':'')+d;
  c.style.display='block';
};
window.addEventListener('error',function(e){
  NVi.avisarError('✗ '+(e.message||'error')+'\n   '+
    String(e.filename||'').split('/').slice(-1)[0]+' línea '+e.lineno);
});

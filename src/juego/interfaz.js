/* Nativa Online — la interfaz, construida desde JavaScript.
   Vive acá y no en index.html por un motivo concreto: el HTML queda diez minutos
   en la caché del navegador y no hay forma de evitarlo en este alojamiento. Los
   módulos, en cambio, se piden con la hora actual. Teniendo el marcado acá, un
   cambio de interfaz llega al instante y el enlace es siempre el mismo. */

const NVi = window.NV;

NVi.MARCADO = `<header>
  <h1 id="wname">Claro del norte</h1>
  <span class="zg">
    <button class="zb" data-z="0">1</button><button class="zb on" data-z="1">2</button><button class="zb" data-z="2">3</button>
  </span>
  <button id="bAnim" class="on" title="Viento">~</button>
  <button id="bMap">mapa</button>
  <span class="sp"></span>
</header>

<main>
  <div id="stage">
    <canvas id="cv"></canvas>
    <div id="compass">N<br><span>&#9650;</span></div>
    <div id="reloj"><span id="relojM"></span><span id="relojS"></span></div>
    <div id="map"><div id="mapCab"></div><pre id="mapTx"></pre></div>
    <div id="bubble"></div>
    <div id="pad">
      <button class="e"></button><button data-mv="n">&#9650;</button><button class="e"></button>
      <button data-mv="w">&#9664;</button><button data-mv="a">E</button><button data-mv="e">&#9654;</button>
      <button class="e"></button><button data-mv="s">&#9660;</button><button class="e"></button>
    </div>
  </div>
</main>

<footer>
  <span id="st1">—</span><span id="st2"></span><span id="st3">Flechas o WASD &middot; E para mirar &middot; rueda, pellizco o + / &minus; para el zoom</span>
</footer>

<div class="modal" id="mdHelp"><div class="box">
  <h3>D&oacute;nde est&aacute;s</h3>
  <div style="font-size:12px;line-height:1.6">
    Un claro de 100 &times; 100 metros. Arriba es <b>norte</b>, abajo <b>sur</b>, derecha <b>este</b>.
    El sol est&aacute; al este y bajo, as&iacute; que todo tira su sombra hacia el oeste y los &aacute;rboles tienen
    la cara derecha iluminada.<br><br>
    La c&aacute;mara mira el suelo inclinada: un metro hacia el norte ocupa menos pantalla que un metro
    hacia el este, y lo que tiene altura se levanta y tapa lo que queda detr&aacute;s.<br><br>
    Camin&aacute; con flechas o WASD. En celular, el control de abajo a la derecha.
  </div>
  <div class="acts"><button data-close class="on">Cerrar</button></div>
</div></div>


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

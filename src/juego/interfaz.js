/* Nativa Online — la interfaz, construida desde JavaScript.
   Vive acá y no en index.html por un motivo concreto: el HTML queda diez minutos
   en la caché del navegador y no hay forma de evitarlo en este alojamiento. Los
   módulos, en cambio, se piden con la hora actual. Teniendo el marcado acá, un
   cambio de interfaz llega al instante y el enlace es siempre el mismo. */

const NVi = window.NV;

/* Sello de versión, puesto por sellar.sh al publicar. Se ve en el pie: así
   Marcos y yo sabemos al instante si está mirando la última versión. */
NVi.VERSION='23/11 16:55';

NVi.MARCADO = `<div id="stage">
  <canvas id="cv"></canvas>
  <div id="compass">N<br><span>&#9650;</span></div>

  <div id="hudTL" class="hud">
    <div id="wname">Claro del norte</div>
    <div id="st2"></div>
    <div class="fila"><button id="bAnim" class="on" title="Viento">~</button><button id="bMap" title="Mapa">mapa</button></div>
  </div>

  <div id="map"><div id="mapCab"></div><pre id="mapTx"></pre></div>

  <div id="hudBL" class="hud">
    <div id="ayuda">Flechas o WASD &middot; E para mirar &middot; tocar para ir</div>
    <div id="sello"></div>
  </div>

  <div id="dios">
    <div id="diosTit">Modo Dios</div>
    <div class="pestanas"><button id="diosModoObj" class="on">Objetos</button><button id="diosModoCam">Caminos</button><button id="diosModoTer">Terreno</button><button id="diosModoFlu">Fluidez</button></div>
    <div class="cuerpo">
    <div id="diosPaleta"></div>
    <div id="diosCaminos">
      <div class="grupo">Familia</div>
      <button class="camFam" data-fam="tierra">tierra</button>
      <button class="camFam" data-fam="tierra-antigua">tierra antigua</button>
      <button class="camFam" data-fam="empedrado">empedrado</button>
      <button class="camFam" data-fam="empedrado-antiguo">empedrado antiguo</button>
      <div class="grupo">Variante</div>
      <div class="fila"><button class="camVar" data-var="natural">natural</button><button class="camVar" data-var="intermedia">media</button><button class="camVar" data-var="detallada">detallada</button></div>
      <div class="grupo">Anchura</div>
      <div class="fila"><button id="camAncMenos" title="[">&minus;</button><span id="camAncho"></span><button id="camAncMas" title="]">+</button></div>
      <div class="fila"><button id="camTerminar">terminar</button><button id="camTextura" title="Ctrl + clic">otra textura</button></div>
      <div class="fila"><button id="camBorrar" title="Supr o clic derecho">borrar</button></div>
    </div>
    <div id="diosTerreno"></div>
    <div id="diosFluidez"></div>
    <div id="diosEstado"></div>
    </div>
    <div class="pie"><button id="diosDeshacer" title="Ctrl+Z">deshacer</button><button id="diosRehacer" title="Ctrl+Shift+Z">rehacer</button><button id="diosExportar">exportar</button><button id="diosSalir">salir</button></div>
  </div>

  <div id="creador">
    <div id="creaCab"><span id="creaTit"></span><button id="creaCerrar" title="Cerrar (Esc)">&times;</button></div>
    <div id="creaVistaCaja"><canvas id="creaVista"></canvas></div>
    <div id="creaInfo"></div>
    <div id="creaPanFila"><span>recorrer</span><input id="creaPan" type="range" min="0" max="1" step="0.02" value="0.5"></div>
    <div id="creaCampos"></div>
    <div class="fila"><button id="creaRegen" title="Otra variante con las mismas perillas">otra semilla</button><button id="creaLuz">luz: estudio</button></div>
    <div class="fila"><button id="creaColocar">colocar</button><button id="creaAplicar">aplicar</button><button id="creaBorrar" title="Eliminar esta pieza del mundo">borrar</button></div>
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

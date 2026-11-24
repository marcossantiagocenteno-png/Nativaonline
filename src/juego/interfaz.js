/* Nativa Online — la interfaz, construida desde JavaScript.
   Vive acá y no en index.html por un motivo concreto: el HTML queda diez minutos
   en la caché del navegador y no hay forma de evitarlo en este alojamiento. Los
   módulos, en cambio, se piden con la hora actual. Teniendo el marcado acá, un
   cambio de interfaz llega al instante y el enlace es siempre el mismo. */

const NVi = window.NV;

/* Sello de versión, puesto por sellar.sh al publicar. Se ve en el pie: así
   Marcos y yo sabemos al instante si está mirando la última versión. */
NVi.VERSION='24/11 14:20';

NVi.MARCADO = `<div id="stage">
  <canvas id="cv"></canvas>
  <div id="compass">N<br><span>&#9650;</span></div>

  <div id="hudTL" class="hud">
    <div id="wname">Claro del norte</div>
    <div id="ofEstado"></div>
    <div id="st2"></div>
    <div class="fila"><button id="bAnim" class="on" title="Viento">~</button><button id="bMap" title="Mapa">mapa</button></div>
  </div>

  <div id="map"><div id="mapCab"></div><pre id="mapTx"></pre></div>

  <div id="hudBL" class="hud">
    <div id="ayuda">Flechas o WASD &middot; E para mirar &middot; tocar para ir</div>
    <div id="sello"></div>
  </div>

  <div id="expandir">
    <div id="expTxt"></div>
    <div class="fila"><button id="expSi">Sí</button><button id="expNo">No</button></div>
  </div>

  <div id="dios">
    <div id="diosTit">Modo Dios</div>
    <div id="diosOficial">
      <div id="ofLinea"></div>
      <div class="fila"><button id="ofCopia" title="Copia completa del mundo oficial">copia</button><button id="ofImportar" title="Reemplazar el mundo oficial por una copia">importar</button><button id="ofSalir" title="Cerrar la sesión de administrador y volver al inicio">cerrar sesión</button></div>
      <input id="ofArchivo" type="file" accept=".json,application/json">
    </div>
    <div class="pestanas"><button id="diosModoObj" class="on">Objetos</button><button id="diosModoCam">Caminos</button><button id="diosModoTer">Terreno</button><button id="diosModoAgu">Aguas</button><button id="diosModoFlu">Fluidez</button></div>
    <div id="diosParcela"><span>Parcela</span><button id="parAdd" class="on">Añadir</button><button id="parQuit">Remover</button><button id="parSel" title="Arrastrá un rectángulo: lo que queda dentro se selecciona (Mayús suma)">Seleccionar objetos</button><button id="parBorrar" disabled title="Supr o Retroceso">Borrar</button></div>
    <div class="cuerpo">
    <div id="diosSub"><div class="grupo">Sub-mundo</div><div id="subNombre"></div><button id="subEditar">editar esta cueva</button><button id="subSalir">salir de la cueva</button></div>
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
    <div id="diosAguas"></div>
    <div id="diosFluidez"></div>
    <div id="diosEstado"></div>
    </div>
    <div class="pie"><button id="diosDeshacer" title="Ctrl+Z">deshacer</button><button id="diosRehacer" title="Ctrl+Shift+Z">rehacer</button><button id="diosMundos" title="El mundo y sus sub-mundos">mundos</button><button id="diosExportar">exportar</button><button id="diosSalir">salir</button></div>
  </div>

  <div id="umbralAsk">
    <div id="umbTit">Nuevo Umbral</div>
    <label class="umbCampo"><span>Nombre del sub-mapa</span><input id="umbNombre" type="text" maxlength="40" autocomplete="off"></label>
    <label class="umbCampo"><span>Su mundo es</span><select id="umbMundo"></select></label>
    <div class="fila"><button id="umbSeguir">crear</button><button id="umbCancelar">cancelar</button></div>
  </div>

  <div id="mundos">
    <div id="mundosCab"><span>Mundos</span><button id="mundosCerrar" title="Cerrar">&times;</button></div>
    <div id="mundosLista"></div>
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

/* La PORTADA: la pantalla de entrada (la dibuja y la maneja juego/portada.js; acá vive su marcado, como el del resto de la interfaz).
   Los botones y el campo son elementos reales. El arte de fondo es un lienzo; el marco y el título son SVG. */
NVi.MARCADO_PORTADA = `<div id="portada">
  <canvas id="ptLienzo" aria-hidden="true"></canvas>
  <div id="ptMarco" aria-hidden="true"></div>
  <main id="ptCentro">
    <h1 id="ptTitulo" aria-label="Nativa Online">
      <svg id="ptLetras" viewBox="0 0 540 172" role="img" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="ptDegradado" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="172">
            <stop offset="0" stop-color="#f6f1e7"/><stop offset=".55" stop-color="#e8dcc2"/><stop offset="1" stop-color="#c8a24a"/>
          </linearGradient>
          <filter id="ptRoto" x="-4%" y="-8%" width="108%" height="116%">
            <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="4" result="r"/>
            <feDisplacementMap in="SourceGraphic" in2="r" scale="5" xChannelSelector="R" yChannelSelector="G" result="d"/>
            <feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves="1" seed="9" result="g"/>
            <feColorMatrix in="g" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -16 11.9" result="m"/>
            <feComposite in="d" in2="m" operator="in"/>
          </filter>
        </defs>
        <g filter="url(#ptRoto)" fill="none" stroke="url(#ptDegradado)" stroke-width="21" stroke-linejoin="miter" stroke-miterlimit="2.2" stroke-linecap="butt">
          <g transform="translate(6 16)"><polyline points="10,140 10,0 60,140 60,0"/></g>
          <g transform="translate(92 16)"><polyline points="8,140 35,4 62,140"/><line x1="19" y1="102" x2="51" y2="102"/></g>
          <g transform="translate(178 16)"><line x1="0" y1="10" x2="70" y2="10"/><line x1="35" y1="10" x2="35" y2="140"/></g>
          <g transform="translate(264 16)"><line x1="35" y1="0" x2="35" y2="140"/><path d="M6 7H64M6 133H64" stroke-width="14"/></g>
          <g transform="translate(350 16)"><polyline points="6,0 35,140 64,0"/></g>
          <g transform="translate(436 16)"><polyline points="8,140 35,4 62,140"/><line x1="19" y1="102" x2="51" y2="102"/></g>
        </g>
      </svg>
    </h1>
    <div id="ptSub"><span>Online</span></div>
    <div id="ptAccesos">
      <button id="ptInvitado" class="ptBtn" type="button">Invitado</button>
      <button id="ptAdmin" class="ptBtn" type="button" aria-expanded="false" aria-controls="ptClaveForm">Administrador</button>
      <form id="ptClaveForm" autocomplete="off" novalidate>
        <label for="ptClave">Contraseña de administrador</label>
        <input id="ptClave" type="password" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="200">
        <div class="ptFila"><button id="ptClaveOk" class="ptBtn" type="submit">Entrar</button><button id="ptClaveVolver" class="ptBtn ptSec" type="button">Volver</button></div>
      </form>
      <div id="ptMensaje" role="status" aria-live="polite"></div>
    </div>
    <div id="ptEstado"></div>
    <a id="ptSolitario" href="?solitario">Modo solitario (sin servidor)</a>
  </main>
</div>`;

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

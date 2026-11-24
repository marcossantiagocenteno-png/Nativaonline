/* Nativa Online — LISTA ÚNICA DE MÓDULOS, en el orden en que se cargan.
   La leen index.html (el cargador) y pruebas/cargar.js. Un módulo nuevo se agrega
   acá y NADA MÁS: antes había que acordarse de dos listas y una se desincronizaba.
   Las rutas son relativas a src/ y sin .js. Los de arte/ no llevan la hora en la
   dirección (pesan cientos de kilos y casi nunca cambian). */
window.NV_MODULOS=[
  'motor/base',
  'motor/registro',          // el catálogo de motores: lo usan luz, viento y todos los que vengan
  'mundo/diccionario',
  'mundo/mundo-datos',       // el archivo del mundo editado (vacío mientras no haya ediciones)
  'mundo/generar',
  'mundo/paneles',
  'mundo/ediciones','mundo/huella','mundo/objetos',         // aplica las ediciones del mundo sobre cada panel generado
  'luz-de-lunas/luz',
  'mundo/viento',
  'motor/entorno',           // lo que comparten árboles, rocas y los que vengan: viento, luz, sombras, contorno
  'motor/fluidez',           // el motor global de fluidez: sólo mide, no cambia nada
  'motor/pincel',            // el pintor por GPU del tablero (apagado salvo ?pincel=gl hasta que se apruebe)
  'motor/lienzo',
  'arte/myrella',
  'motor/sprites',
  'juego/interfaz',
  'juego/personajes',
  'juego/pasto',
  'juego/terreno',           // terreno y vegetación por sectores: configura el pasto real zona por zona (lo edita el Modo Dios)
  'juego/caminos',
  'juego/arbolado',          // motor de árboles (lo coloca y lo diseña el Modo Dios)
  'juego/rocoso',            // motor de rocas y formaciones (lo coloca y lo diseña el Modo Dios)
  'juego/estructuras',       // motor de estructuras y ruinas: muros, columnas, arcos, pozos (laboratorio; el juego aún no lo usa)
  'juego/cuevas',            // motor de cuevas (interiores): corte con luces propias, bocas que lee Umbrales (el interior lo dibuja y camina juego/subescenas)
  'juego/umbrales',          // Umbrales: pasar de un mapa a otro (boca de cueva ↔ interior); no sabe dibujar nada; lo cablea juego/subescenas
  'juego/aguas',             // motor de aguas continentales: charcos, lagos, ríos, cascadas (los coloca el Modo Dios)
  'juego/puente-motores',    // puente: dibuja en el juego los objetos {k:'rocoso'} y {k:'arbolnv'}
  'juego/topes',             // topes: casillas por las que nadie pasa (invisibles fuera del Modo Dios)
  'juego/bocacueva',         // entradas de cueva vistas desde afuera: pared con arco y hueco libre (las coloca el Modo Dios)
  'juego/subescenas',        // sub-mundos: el Umbral del Modo Dios, el interior de cueva caminable y el listado de mundos
  'juego/dibujar',
  'juego/particulas',
  'juego/editor',
  'juego/editor-caminos',
  'juego/editor-fluidez',   // la pestaña "fluidez" del Modo Dios
  'juego/editor-aguas',      // la pestaña "aguas" del Modo Dios: lagos, ríos, cascadas
  'juego/editor-terreno',    // la pestaña "terreno" del Modo Dios
  'juego/creador',           // la ventana de diseño del Modo Dios: las perillas de los motores
  'juego/jugar'
];

/* Los módulos que carga el SERVIDOR del mundo compartido (servidor/). El servidor no dibuja nada: sólo decide el estado
   (colisión, alturas, ediciones, objetos sólidos), así que usa el MISMO código que el cliente para eso y ninguno de pantalla.
   Todo módulo de NV_MODULOS tiene que estar en una de estas dos listas (servidor/ vigila que ninguno se pierda):
   si un motor nuevo decide algo del estado del mundo, va en NV_MODULOS_SERVIDOR; si sólo dibuja, en NV_MODULOS_SOLO_CLIENTE.
   index.html y pruebas/cargar.js no leen estas dos listas: el modo solitario no cambia. */
window.NV_MODULOS_SERVIDOR=[
  'motor/base','motor/registro','mundo/diccionario','mundo/mundo-datos','mundo/generar','mundo/paneles','mundo/ediciones','mundo/huella','mundo/objetos',
  'luz-de-lunas/luz','mundo/viento','motor/entorno','juego/terreno','juego/caminos','juego/arbolado','juego/rocoso','juego/estructuras',
  'juego/cuevas','juego/umbrales','juego/aguas','juego/puente-motores','juego/topes','juego/bocacueva'
];
window.NV_MODULOS_SOLO_CLIENTE=[
  'motor/fluidez','motor/pincel','motor/lienzo','arte/myrella','motor/sprites','juego/interfaz','juego/personajes','juego/pasto',
  'juego/subescenas','juego/dibujar','juego/particulas','juego/editor','juego/editor-caminos','juego/editor-fluidez','juego/editor-aguas',
  'juego/editor-terreno','juego/creador','juego/jugar'
];

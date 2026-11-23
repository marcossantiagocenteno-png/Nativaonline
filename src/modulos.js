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
  'mundo/ediciones','mundo/objetos',         // aplica las ediciones del mundo sobre cada panel generado
  'luz-de-lunas/luz',
  'mundo/viento',
  'motor/entorno',           // lo que comparten árboles, rocas y los que vengan: viento, luz, sombras, contorno
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
  'juego/puente-motores',    // puente: dibuja en el juego los objetos {k:'rocoso'} y {k:'arbolnv'}
  'juego/topes',             // topes: casillas por las que nadie pasa (invisibles fuera del Modo Dios)
  'juego/dibujar',
  'juego/particulas',
  'juego/editor',
  'juego/editor-caminos',
  'juego/editor-terreno',    // la pestaña "terreno" del Modo Dios
  'juego/creador',           // la ventana de diseño del Modo Dios: las perillas de los motores
  'juego/jugar'
];

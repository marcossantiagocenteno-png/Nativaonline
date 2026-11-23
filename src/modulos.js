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
  'juego/caminos',
  'juego/arbolado',          // motor de árboles (laboratorio: el juego todavía no lo llama)
  'juego/dibujar',
  'juego/particulas',
  'juego/editor',
  'juego/editor-caminos',
  'juego/jugar'
];

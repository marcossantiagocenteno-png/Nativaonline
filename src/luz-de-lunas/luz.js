/* Nativa Online — LUZ DE LUNAS.
   Esta carpeta es toda la luz del juego. No hay ciclo de día y noche, ni astros,
   ni eclipses, ni estaciones, ni mareas, ni lluvia: el mundo vive siempre bajo la
   misma luz. Ahora esa luz es de DÍA: clara, cálida, con el sol alto y sombras
   cortas. (La de antes, de noche: amb 0.72, r 0.72, g 1.00, b 0.88, sombra
   {dx:1, dy:0.30, porMetro:1.7}, estrellas 1, luciérnagas 1.)

   Para cambiar cómo se ve el juego se toca SOLO esta tabla. Nada más del código
   decide la luz: todo lo demás lee NV.luz (color y cantidad) y NV.LUZ_LUNAS.sombra
   (hacia dónde caen las sombras y qué tan largas). Sin números para el jugador. */

const NVl = window.NV;

const LUZ_LUNAS = {
  amb: 1.00,                       // cuánta luz hay: toda
  r: 1.00, g: 0.98, b: 0.86,       // el tono: sol limpio, apenas cálido
  sombra: {dx: 1, dy: 0.45, porMetro: 0.8},     // sol alto: sombra corta, hacia el este
  /* el brillo del sol sobre el agua quieta, fijo en la pantalla (fracciones de
     lo que se ve): a la derecha y arriba del centro */
  luna: {x: 0.62, y: 0.40, fuerza: 0.70, rx: 2.4, ry: 1.05},
  estrellas: 0,                    // de día no hay estrellas en el agua (0 a 1)
  luciernagas: 0                   // 1 las deja salir sobre el pasto, 0 las apaga
};

NVl.LUZ_LUNAS = LUZ_LUNAS;
/* lo que lee todo el dibujo: ya multiplicado por la cantidad de luz */
NVl.luz = {amb: LUZ_LUNAS.amb,
           r: LUZ_LUNAS.r*LUZ_LUNAS.amb, g: LUZ_LUNAS.g*LUZ_LUNAS.amb, b: LUZ_LUNAS.b*LUZ_LUNAS.amb};

/* El cielo, en palabras y sin un solo número. */
NVl.cieloEnPalabras = function(){
  return 'El sol alto lo baña todo de una luz clara y tibia.';
};

/* Alta en el registro de motores. La luz es una consulta de ambiente: color y cantidad. */
if(NVl.motores) NVl.motores.registrar({id:'luz',nombre:'Luz del cielo',estado:'integrado',
  archivo:'src/luz-de-lunas/luz.js',prueba:'pruebas/personajes.js',
  caras:{ambiente:()=>NVl.luz,
         editor:{parametros:{amb:{tipo:'cantidad',min:0,max:1.2,def:LUZ_LUNAS.amb}}}}});

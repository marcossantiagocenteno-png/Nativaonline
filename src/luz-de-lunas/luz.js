/* Nativa Online — LUZ DE LUNAS.
   Esta carpeta es toda la luz del juego. No hay día ni noche, ni sol, ni astros,
   ni eclipses, ni estaciones, ni mareas, ni lluvia: el mundo vive siempre bajo la
   misma luz de lunas, fría y verdosa, con sombras largas hacia el este. Lo que
   antes calculaban astro.js, cielo.js y mareas.js ya no existe.

   Para cambiar cómo se ve el juego se toca SOLO esta tabla. Nada más del código
   decide la luz: todo lo demás lee NV.luz (color y cantidad) y NV.LUZ_LUNAS.sombra
   (hacia dónde caen las sombras y qué tan largas). Sin números para el jugador. */

const NVl = window.NV;

const LUZ_LUNAS = {
  amb: 0.72,                       // cuánta luz hay
  r: 0.72, g: 1.00, b: 0.88,       // el tono: verde frío, sin llegar a turquesa
  sombra: {dx: 1, dy: 0.30, porMetro: 1.7},     // hacia el este, larga y baja
  /* la luna que se refleja en el agua quieta, fija en la pantalla (fracciones de
     lo que se ve): a la derecha y arriba del centro */
  luna: {x: 0.62, y: 0.40, fuerza: 0.85, rx: 2.0, ry: 0.95},
  estrellas: 1,                    // cuántas estrellas se ven reflejadas (0 a 1)
  luciernagas: 1                   // 1 las deja salir sobre el pasto, 0 las apaga
};

NVl.LUZ_LUNAS = LUZ_LUNAS;
/* lo que lee todo el dibujo: ya multiplicado por la cantidad de luz */
NVl.luz = {amb: LUZ_LUNAS.amb,
           r: LUZ_LUNAS.r*LUZ_LUNAS.amb, g: LUZ_LUNAS.g*LUZ_LUNAS.amb, b: LUZ_LUNAS.b*LUZ_LUNAS.amb};

/* El cielo, en palabras y sin un solo número. */
NVl.cieloEnPalabras = function(){
  return 'Las lunas lo bañan todo de una luz fría y quieta.';
};

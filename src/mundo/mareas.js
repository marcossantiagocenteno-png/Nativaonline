/* Nativa Online — mareas. Cálculo puro, sin pantalla.
   La fuerza de marea tira en dos direcciones opuestas a la vez, así que lo que
   importa no es sumar números sino sumar direcciones: dos cuerpos alineados se
   refuerzan, dos en ángulo recto se anulan. */

const NVm = window.NV;

const MAREA = {
  /* Pesos relativos. La ficha original daba 205 para Calavera, 68 para la
     estrella y 1 para Madre: eso hacía mareas cataclísmicas y quedó descartado.
     Se conserva el orden —Calavera manda, la estrella pesa, Madre acompaña—
     con valores jugables. */
  pesos:{ calavera:1.00, estrella:0.34, madre:0.14 },
  /* umbrales sobre la amplitud combinada, de 0 a 1 */
  umbrales:{ muerta:0.30, viva:0.62, reforzada:0.84, excepcional:0.955 }
};

const TAU2=Math.PI*2;
const SUMA=Object.values(MAREA.pesos).reduce((a,b)=>a+b,0);
const MAYOR=Math.max(...Object.values(MAREA.pesos));
const MIN=Math.max(0, 2*MAYOR-SUMA)/SUMA;     // todas opuestas
const MAX=1;                                   // todas alineadas

/* Longitud de cada cuerpo visto desde el planeta, en vueltas. */
function longitudes(t){
  const A=NVm.ASTRO;
  return {
    estrella: t/A.anoAstro,
    calavera: t/A.lunas.calavera.sideral,
    madre:    t/A.lunas.madre.sideral + A.lunas.madre.epocaNueva/A.lunas.madre.sideral*0
  };
}

/* Suma vectorial de las tres influencias, al doble de ángulo porque la marea
   tiene dos crestas opuestas. */
function marea(t){
  const L=longitudes(t), P=MAREA.pesos;
  let x=0,y=0, maxp=0;
  for(const k in P){
    const a=L[k]*2*TAU2;
    x+=P[k]*Math.cos(a); y+=P[k]*Math.sin(a); maxp+=P[k];
  }
  /* normalizar contra lo mínimo y lo máximo que estas tres fuerzas pueden dar:
     con Calavera pesando tanto, la suma cruda nunca bajaría del 35% */
  const cruda=Math.hypot(x,y)/maxp;
  const amplitud=Math.max(0,Math.min(1,(cruda-MIN)/(MAX-MIN)));
  const direccion=Math.atan2(y,x)/2;            // hacia dónde se abulta el agua

  /* la altura del agua oscila dos veces por día del planeta */
  const hora=(t-Math.floor(t))*TAU2;
  const altura=amplitud*Math.cos(2*hora-direccion*2);

  const U=MAREA.umbrales;
  let clase='ordinaria';
  if(amplitud>=U.excepcional) clase='excepcional';
  else if(amplitud>=U.reforzada) clase='reforzada';
  else if(amplitud>=U.viva) clase='viva';
  else if(amplitud<U.muerta) clase='muerta';

  return {amplitud, altura, direccion, clase,
          subiendo: Math.sin(2*hora-direccion*2)>0,
          palabras: PALABRAS[clase]};
}

const PALABRAS={
  muerta:'El agua apenas se mueve.',
  ordinaria:'El agua sube y baja como siempre.',
  viva:'El agua llega más lejos de lo normal.',
  reforzada:'La crecida se nota: el arroyo va cargado.',
  excepcional:'El agua trepa donde nunca llega; lo bajo se inunda.'
};

/* Próxima vez que la marea alcanza una clase dada. */
function proximaMarea(clase,t,limite){
  const U=MAREA.umbrales;
  const min = clase==='excepcional'?U.excepcional : clase==='reforzada'?U.reforzada : U.viva;
  for(let d=0.02; d<(limite||NVm.ASTRO.anoAstro); d+=0.02)
    if(marea(t+d).amplitud>=min) return d;
  return null;
}

NVm.MAREA=MAREA; NVm.marea=marea; NVm.proximaMarea=proximaMarea;

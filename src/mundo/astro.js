/* Nativa Online — astronomía. Cálculo puro: no toca pantalla ni colores.
   La presentación vive en cielo.js. Reglas en docs/DISENO.md. */

const NVa = window.NV;

/* ---------- configuración ----------
   Todo parámetro dudoso vive acá y se puede ajustar sin tocar el cálculo. */
const ASTRO = {
  /* planeta */
  anoAstro: 430,            // días astronómicos por vuelta a la estrella
  diasCalendario: 30,       // días del calendario jugable que representan ese año
  horasDia: 24,             // día solar del planeta
  inclinacionAxial: 23.4,
  excentricidad: 0,
  gravedad: 4.17,           // veces la terrestre. Todavía no afecta a nada.

  /* un día del calendario jugable dura un día real */
  msPorDiaCalendario: 24*60*60*1000,

  lunas: {
    calavera: {
      nombre:'Calavera', diametro:8000, distancia:150000,
      sideral:1.366, inclinacion:8, nodal:180,
      /* SUPUESTO: luna nueva en el día 1 del calendario, origen del tiempo. */
      epocaNueva:0,
      /* SUPUESTO: nodo ascendente en longitud 0 al empezar. */
      nodo0:0,
      peso:0.78              // cuánto aporta a la luz nocturna
    },
    madre: {
      nombre:'Madre', diametro:3600, distancia:390000,
      sideral:5.65, inclinacion:12, nodal:360,
      /* SUPUESTO: luna nueva en el día 27 del calendario, como en la ficha
         anterior. 27 días de calendario = 27 × 430/30 días astronómicos. */
      epocaNueva:27*430/30,
      nodo0:0,
      peso:0.22
    }
  }
};

const TAU = Math.PI*2;
const msPorDiaAstro = ASTRO.msPorDiaCalendario * ASTRO.diasCalendario / ASTRO.anoAstro;
const diasAstroPorCalendario = ASTRO.anoAstro / ASTRO.diasCalendario;

/* período sinódico: cuánto tarda la luna en volver a la misma fase.
   1/sinódico = 1/sideral − 1/año, porque el planeta también avanza. */
function sinodico(l){ return 1/(1/l.sideral - 1/ASTRO.anoAstro); }
for(const k in ASTRO.lunas) ASTRO.lunas[k].sinodico = sinodico(ASTRO.lunas[k]);

const FASES=['nueva','creciente fina','cuarto creciente','gibosa creciente',
             'llena','gibosa menguante','cuarto menguante','menguante fina'];

/* ---------- tiempo ---------- */
function tiempoAstro(ms){ return ms/msPorDiaAstro; }     // días astronómicos continuos

function calendario(t){
  const tAno = ((t%ASTRO.anoAstro)+ASTRO.anoAstro)%ASTRO.anoAstro;
  return {
    ano: Math.floor(t/ASTRO.anoAstro),
    diaAstro: tAno,                                       // 0 … 430
    dia: Math.floor(tAno/diasAstroPorCalendario)+1,       // 1 … 30, lo que ve el jugador
    fraccionDia: t-Math.floor(t),                         // 0 medianoche, 0.5 mediodía
    estacion: ['primavera','verano','otoño','invierno'][Math.floor(tAno/(ASTRO.anoAstro/4))%4]
  };
}

/* ---------- lunas ---------- */
function estadoLuna(l,t){
  const fase = (((t-l.epocaNueva)/l.sinodico)%1+1)%1;     // 0 nueva, 0.5 llena
  const ilum = (1-Math.cos(fase*TAU))/2;                  // 0 … 1
  /* elongación: cuánto se separa del sol en el cielo */
  const elong = fase*TAU;
  /* ángulo horario: 0 cuando el astro está en lo más alto */
  const hSol = (t-Math.floor(t)-0.5)*TAU;
  const hLuna = hSol - elong;
  const altura = Math.cos(hLuna);                          // 1 cenit, 0 horizonte, −1 bajo tierra
  /* nodo, con precesión retrógrada */
  const nodo = ((l.nodo0 - t/l.nodal)%1+1)%1;
  return {
    nombre:l.nombre, fase, ilum, altura,
    sobreHorizonte: altura>0,
    grados: Math.asin(Math.max(-1,Math.min(1,altura)))*180/Math.PI,
    nombreFase: FASES[Math.floor(((fase+1/16)%1)*8)],
    aparente: 2*Math.atan(l.diametro/2/l.distancia)*180/Math.PI,   // tamaño en el cielo
    nodo,
    cfg:l
  };
}

function astroEn(ms){
  const t=tiempoAstro(ms), cal=calendario(t);
  const lunas={};
  for(const k in ASTRO.lunas) lunas[k]=estadoLuna(ASTRO.lunas[k],t);
  /* sol: elevación por hora del día */
  const arco=(cal.fraccionDia-0.25)/0.5;
  const deDia = arco>0 && arco<1;
  return {
    t, ...cal, deDia,
    solElev: deDia?Math.sin(arco*Math.PI)*58:0,
    solAzimut: 90+arco*180,
    lunas
  };
}

/* Próxima vez que una luna alcanza una fase dada (0 nueva, 0.5 llena). */
function proximaFase(clave,objetivo,ms){
  const l=ASTRO.lunas[clave], t=tiempoAstro(ms);
  const actual=(((t-l.epocaNueva)/l.sinodico)%1+1)%1;
  let falta=objetivo-actual; if(falta<=0) falta+=1;
  return {enDiasAstro:falta*l.sinodico, enHorasReales:falta*l.sinodico*msPorDiaAstro/3600000};
}

NVa.ASTRO=ASTRO; NVa.astroEn=astroEn; NVa.tiempoAstro=tiempoAstro;
NVa.calendario=calendario; NVa.proximaFase=proximaFase;
NVa.msPorDiaAstro=msPorDiaAstro; NVa.FASES=FASES;

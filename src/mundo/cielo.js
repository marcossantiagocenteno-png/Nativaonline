/* Nativa Online — cielo: el sol, las dos lunas y la hora.
   Reglas en docs/DISENO.md. Sin dependencias ni compilación:
   los módulos se cargan en orden y comparten el objeto global NV. */

const NV_ = window.NV;

/* Un año de juego = un mes nuestro  →  un día de juego = dos horas reales. */
const DIA_MS = 2*60*60*1000;
const ANO_DIAS = 360;

/* Períodos de las lunas, en días de juego. No son múltiplos entre sí:
   así las conjunciones y los eclipses caen solos y rarísimos. */
const LUNA_MAYOR = 7.3;
const LUNA_MENOR = 3.1;

/* Color de la luz según la hora. Se interpola entre estas paradas. */
const PARADAS = [
  {f:0.00, amb:0.16, r:0.44, g:0.54, b:0.86, n:'noche cerrada'},
  {f:0.18, amb:0.20, r:0.50, g:0.58, b:0.88, n:'antes del alba'},
  {f:0.25, amb:0.52, r:1.18, g:0.80, b:0.60, n:'amanece'},
  {f:0.32, amb:0.86, r:1.12, g:0.96, b:0.82, n:'mañana temprano'},
  {f:0.44, amb:1.00, r:1.00, g:1.00, b:1.00, n:'mañana'},
  {f:0.50, amb:1.04, r:1.00, g:1.00, b:0.98, n:'mediodía'},
  {f:0.62, amb:0.98, r:1.04, g:0.99, b:0.92, n:'tarde'},
  {f:0.72, amb:0.72, r:1.16, g:0.88, b:0.66, n:'cae la tarde'},
  {f:0.78, amb:0.40, r:1.14, g:0.74, b:0.62, n:'anochece'},
  {f:0.86, amb:0.20, r:0.52, g:0.58, b:0.88, n:'noche'},
  {f:1.00, amb:0.16, r:0.44, g:0.54, b:0.86, n:'noche cerrada'}
];

function entre(a,b,t){ return a+(b-a)*t; }

const cielo = {
  fase:0.4, dia:0, ano:0, elev:40, azimut:140,
  sombra:{dx:-1, dy:0, porMetro:1.7},
  luz:{amb:1, r:1, g:1, b:1},
  lunas:{mayor:0, menor:0, brillo:0},
  nombre:'mañana', deNoche:false
};

function actualizarCielo(ms){
  const total = ms/DIA_MS;
  const fase = total - Math.floor(total);          // 0 medianoche, 0.5 mediodía
  cielo.fase = fase;
  cielo.dia = Math.floor(total) % ANO_DIAS;
  cielo.ano = Math.floor(total/ANO_DIAS);

  /* sol: sale por el este, pasa alto al mediodía, se pone por el oeste */
  const arco = (fase-0.25)/0.5;                     // 0 al amanecer, 1 al ocaso
  const dia = arco>0 && arco<1;
  cielo.elev = dia ? Math.sin(arco*Math.PI)*58 : 0;
  cielo.azimut = 90 + arco*180;                     // 90 este, 180 sur, 270 oeste
  cielo.deNoche = !dia;

  /* la sombra apunta al lado contrario del sol y se acorta al mediodía */
  const s = (cielo.azimut+180)*Math.PI/180;
  const largo = cielo.elev>3 ? Math.min(14, 1/Math.tan(cielo.elev*Math.PI/180)) : 0;
  cielo.sombra.dx = Math.sin(s);
  cielo.sombra.dy = -Math.cos(s);
  cielo.sombra.porMetro = largo;

  /* lunas: dos fases que casi nunca coinciden */
  const fm = (total/LUNA_MAYOR)%1, fn = (total/LUNA_MENOR)%1;
  cielo.lunas.mayor = 1-Math.abs(fm*2-1);           // 0 nueva, 1 llena
  cielo.lunas.menor = 1-Math.abs(fn*2-1);
  cielo.lunas.brillo = cielo.lunas.mayor*0.7 + cielo.lunas.menor*0.3;

  /* color y cantidad de luz */
  let i=0; while(i<PARADAS.length-2 && fase>PARADAS[i+1].f) i++;
  const a=PARADAS[i], b=PARADAS[i+1];
  const t=(fase-a.f)/Math.max(0.0001,(b.f-a.f));
  let amb=entre(a.amb,b.amb,t);
  if(!dia) amb += cielo.lunas.brillo*0.14;          // las lunas aclaran la noche
  cielo.luz.amb=amb;
  cielo.luz.r=entre(a.r,b.r,t)*amb;
  cielo.luz.g=entre(a.g,b.g,t)*amb;
  cielo.luz.b=entre(a.b,b.b,t)*amb;
  cielo.nombre = t<0.5 ? a.n : b.n;
  return cielo;
}

/* Descripción del cielo sin un solo número, para cuando el jugador mira. */
function cieloEnPalabras(){
  const l=cielo.lunas;
  if(!cielo.deNoche){
    const alto = cielo.elev>45?'alto':cielo.elev>20?'a media altura':'bajo, rasante';
    const lado = cielo.fase<0.5?'al este':'al oeste';
    return 'El sol está '+alto+', '+lado+'.';
  }
  const f=v=>v>0.85?'llena':v>0.55?'crecida':v>0.25?'en cuarto':'casi nueva';
  const juntas = Math.abs(l.mayor-l.menor)<0.08 && l.mayor>0.8;
  return juntas
    ? 'Las dos lunas están llenas a la vez; el bosque se ve casi como de día.'
    : 'La luna mayor está '+f(l.mayor)+' y la menor '+f(l.menor)+'.';
}

NV_.DIA_MS=DIA_MS; NV_.cielo=cielo;
NV_.actualizarCielo=actualizarCielo; NV_.cieloEnPalabras=cieloEnPalabras;
NV_.luz=cielo.luz;

/* Nativa Online — clima: viento.
   Reglas en docs/DISENO.md. Sin dependencias ni compilación:
   los módulos se cargan en orden y comparten el objeto global NV. */

/* ---------- viento: ráfagas que entran por el este y viajan al oeste ---------- */
let wind=0;
function windAt(mx,my,t){
  const wave=0.5+0.5*Math.sin(t*1.25 + mx*0.33 + my*0.10);
  const gust=gustN(mx*0.12+t*1.6, my*0.12, 2, 0.5);
  return wave*(0.35+gust*1.15)*(NV.vientoFactor||1);
}



/* ---------- clima ----------
   Nada de sorteos sueltos: todo sale del tiempo astronómico, así que dos
   sesiones en el mismo momento ven el mismo cielo. La marea empuja la humedad,
   la humedad hace nubes y las nubes hacen lluvia, siempre de a poco. */

const CLIMA = {
  humedadBase:{primavera:0.55, verano:0.34, otoño:0.60, invierno:0.48},
  tempBase:   {primavera:14,   verano:26,   otoño:12,   invierno:3},
  influenciaMarea:0.20,      // cuánto empuja la marea a la humedad
  umbralNube:0.46,
  umbralLluvia:0.62,
  umbralTormenta:0.80,
  mareaTormenta:0.62      // hace falta marea viva o más
};
const ruidoClima = NV.makeNoise(NV.mulberry(20261122));
const suave=(a,b,v)=>{ const t=Math.max(0,Math.min(1,(v-a)/(b-a))); return t*t*(3-2*t); };

function clima(t){
  const cal=NV.calendario(t);
  const est=cal.estacion;
  const hora=t-Math.floor(t);

  const temp = CLIMA.tempBase[est] + Math.sin((hora-0.25)*Math.PI*2)*6
             + ruidoClima(t*0.7,0,2,1)*5-2.5;

  const m=NV.marea(t);
  const lento = ruidoClima(t*0.35,100,3,1);
  let humedad = CLIMA.humedadBase[est] + (lento-0.5)*0.62
              + (m.amplitud-0.5)*CLIMA.influenciaMarea
              - suave(14,30,temp)*0.18;
  humedad=Math.max(0,Math.min(1,humedad));

  const nubes = suave(CLIMA.umbralNube, 0.95, humedad*0.75 + ruidoClima(t*0.9,500,2,1)*0.35);
  const lluvia = nubes>0.25 ? suave(CLIMA.umbralLluvia,0.98, humedad*0.6+nubes*0.5) : 0;
  /* La tormenta no la dispara la luna por sí sola: hace falta que coincidan
     lluvia cerrada, marea crecida y aire cargado. La luna manda por detrás, a
     través de la marea, y por eso el que mira el cielo puede anticiparla. */
  const tormenta = lluvia>0.52 && m.amplitud>CLIMA.mareaTormenta && humedad>CLIMA.umbralTormenta;
  const intensidad = tormenta?3 : lluvia>0.42?2 : lluvia>0.06?1 : 0;
  const viento = 1 + lluvia*0.9 + (tormenta?1.5:0);

  return {temp, humedad, nubes, lluvia, tormenta, intensidad, viento, marea:m, estacion:est,
    palabras: tormenta?'Hay tormenta: el viento acuesta el pasto.'
            : intensidad===2?'Llueve cerrado.'
            : intensidad===1?'Llovizna.'
            : nubes>0.72?'El cielo está tapado.'
            : nubes>0.35?'Pasan nubes.'
            : 'El cielo está despejado.',
    humedadEnPalabras: humedad>0.78?'el aire está pesado de humedad'
            : humedad>0.52?'el aire está húmedo'
            : humedad>0.3?'el aire está seco'
            : 'el aire está reseco'};
}

/* Próximo tramo con lluvia, mirando hacia adelante. */
function proximaLluvia(t,limite){
  for(let d=0.02; d<(limite||60); d+=0.02) if(clima(t+d).lluvia>0.2) return d;
  return null;
}

/* ---------- niebla ----------
   Un campo que se arrastra hacia el oeste con el viento. Es espesa de
   madrugada, se levanta con el sol y vuelve al caer la tarde; la humedad y el
   agua cercana la alimentan. Misma maquinaria que va a usar el fuego: algo que
   ocupa la grilla, se mueve y reacciona al aire. */
const ruidoNiebla = NV.makeNoise(NV.mulberry(77312));
const NIEBLA = { oeste:0.62, deriva:33, piso:0.0 };   // deriva: unos 6 m por minuto real

function nieblaEn(mx,my,t){
  const c = NV.cielo && NV.cielo.clima;
  const hora = t-Math.floor(t);
  /* de madrugada espesa, al mediodía casi nada */
  let ciclo = hora<0.22?1 : hora<0.34?1-(hora-0.22)/0.12 : hora<0.68?0.06
            : hora<0.82?(hora-0.68)/0.14 : 1;
  const hum = c?Math.max(0,c.humedad-0.3)/0.7:0.35;
  const base = NIEBLA.piso + ciclo*(0.30+hum*0.70);
  if(base<=0.02) return 0;
  /* más al oeste, y arrastrándose hacia allá con el tiempo */
  const oeste = NIEBLA.oeste * Math.max(0, 1 - mx/(NV.ASTRO?70:70));
  const bancos = ruidoNiebla(mx*0.055 + t*NIEBLA.deriva, my*0.055, 3, 1);
  const v = base*(oeste + bancos*0.85 - 0.34);
  return Math.max(0, Math.min(1, v));
}

NV.NIEBLA=NIEBLA; NV.nieblaEn=nieblaEn;
NV.windAt=windAt; NV.CLIMA=CLIMA; NV.clima=clima; NV.proximaLluvia=proximaLluvia;

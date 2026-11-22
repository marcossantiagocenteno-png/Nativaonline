/* Nativa Online — clima: viento.
   Reglas en docs/DISENO.md. Sin dependencias ni compilación:
   los módulos se cargan en orden y comparten el objeto global NV. */

/* ---------- viento: ráfagas que entran por el este y viajan al oeste ---------- */
let wind=0;
function windAt(mx,my,t){
  const wave=0.5+0.5*Math.sin(t*1.25 + mx*0.33 + my*0.10);
  const gust=gustN(mx*0.12+t*1.6, my*0.12, 2, 0.5);
  return wave*(0.35+gust*1.15);
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
  umbralTormenta:0.86
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
  const tormenta = lluvia>0.45 && NV.windAt(0,0,t*9)>0.95 && humedad>CLIMA.umbralTormenta;

  return {temp, humedad, nubes, lluvia, tormenta, marea:m, estacion:est,
    palabras: tormenta?'Hay tormenta.'
            : lluvia>0.55?'Llueve con ganas.'
            : lluvia>0.12?'Llovizna.'
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

NV.windAt=windAt; NV.CLIMA=CLIMA; NV.clima=clima; NV.proximaLluvia=proximaLluvia;

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

NV.windAt=windAt;

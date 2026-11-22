/* Nativa Online — diccionario de glifos.
   Reglas en docs/DISENO.md. Sin dependencias ni compilación:
   los módulos se cargan en orden y comparten el objeto global NV. */

/* ---------- DICCIONARIO ----------
   Regla 1: mayúscula = grande, cerca o denso; minúscula = chico, lejos o ralo.
   Regla 2: cada material es una rampa de ralo a tupido; la luz elige el escalón.
   Regla 3: el extremo ralo de toda rampa es ". ," y eso se comparte; la identidad
            vive en el extremo denso, que sí es exclusivo dentro de su capa.
   Regla 4: entre capas distintas (suelo / sotobosque / copa) un glifo puede repetirse:
            la altura y el color ya los separan. */

const MAT={                                   // capa SUELO, en uso
  g:{n:'pasto corto', fam:'verde',  ramp:[' ','\u00b0','\u00b0','*','*']},
  G:{n:'pasto largo', fam:'verdeO', ramp:['|','|','|','|','|'], tip:['|','/','\\'], fam2:'verde'},
  s:{n:'arena de río',fam:'arena',  ramp:['.','.',':','\u00b0',':']},
  k:{n:'guijarral',   fam:'piedra', ramp:['.',':','\u00b0','o','c']},
  a:{n:'agua somera', fam:'agua',   ramp:[' ','.','-','~','-'], agua:1.22},
  A:{n:'corriente',   fam:'agua',   ramp:['-','~','~','=','~'], agua:1.00}
};
const MID={};                                 // sotobosque: vacío por ahora
/* Reservado: acordado, fuera del mundo actual. */
const RESERVA={
  musgo:'\u00b0 o', tierra:'\u00b0 *', hojarasca:'v u', charco:'- = ~',
  helecho:'f F', zarza:'x X', hongos:'n m', juncos:'! j', flores:'*'
};
/* Tres especies, cada una con su silueta, su rampa de follaje y su corteza. */
const SPECIES={
  pino:{  n:'pino',   fam:'pino',   corteza:'corteza',
          copa:[' ','.',':',';','*','A','#'], borde:[' ','.',':','^'],
          w:0.42, troncoFrac:0.46, tiers:4, sway:0.5, alto:[4.5,6.5]},
  encino:{n:'encino', fam:'verde',  corteza:'corteza',
          copa:[' ','.',',','o','e','8','@'], borde:[' ','.',',','`','o'],
          w:0.80, troncoFrac:0.24, tiers:0, sway:1.0, alto:[3.0,4.6]},
  alamo:{ n:'álamo',  fam:'alamo',  corteza:'cortezaClara',
          copa:[' ','.','"','v','o','8'], borde:[' ','.','"','v'],
          w:0.38, troncoFrac:0.40, tiers:0, sway:1.8, alto:[4.0,5.6]}
};
const WOOD={ tronco:['t','h','H'], rama:['y','Y'], tocon:['o','0','U'], caido:['h','H'] };
const RAMP={
  copa:  [' ','.',',','o','e','8','@'],
  borde: [' ','.',',','`','o'],
  punta: ['I','I','i'],
  tronco: WOOD.tronco, rama: WOOD.rama
};
/* 4 escalones de luz por familia, nada de degradado continuo */
NV.MAT=MAT; NV.MID=MID; NV.RESERVA=RESERVA; NV.SPECIES=SPECIES; NV.WOOD=WOOD; NV.RAMP=RAMP;

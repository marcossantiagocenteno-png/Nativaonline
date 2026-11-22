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
  A:{n:'corriente',   fam:'agua',   ramp:['-','~','~','=','~'], agua:1.00},
  P:{n:'agua honda',  fam:'honda',  ramp:['~','=','_','_','_'], agua:0.62, solido:true},
  E:{n:'espuma',      fam:'espuma', ramp:['-','~','=','*','#'], agua:1.25},
  M:{n:'roca madre',  fam:'piedra', ramp:['.',':','^','A','M'], solido:true, textura:'roca'},
  V:{n:'el vacío',    fam:'abismo', ramp:[' ',' ','.',':','.'], solido:true, textura:'caida'},
  d:{n:'tierra',      fam:'tierra', ramp:['.',',','-','_','='], textura:'tierra'},
  R:{n:'ruina',       fam:'piedra', ramp:['.',':','#','%','#'], solido:true, textura:'roca'},
  N:{n:'nieve',       fam:'nieve',  ramp:[' ','.','\u00b0','*','*']},
  D:{n:'duna',        fam:'arena',  ramp:['.','.',':',';',':']}
};
const MID={};                                 // sotobosque: vacío por ahora
/* Reservado: acordado, fuera del mundo actual. */
const RESERVA={
  musgo:'\u00b0 o', tierra:'\u00b0 *', hojarasca:'v u', charco:'- = ~',
  helecho:'f F', zarza:'x X', hongos:'n m', juncos:'! j', flores:'*'
};
/* Tres especies, cada una con su silueta, su rampa de follaje y su corteza.
   A las rampas de copa y borde se les suma ahora el detalle de la corteza
   —placa, veta y nudo— y los tres parámetros con que cada especie reparte su
   follaje. Nada de esto reemplaza al diccionario: lo amplía por las cuatro
   reglas de arriba. La placa es el extremo denso y es exclusiva por especie;
   el extremo ralo sigue siendo compartido.

   placa  : los glifos de la corteza, de la cresta más gruesa a la más fina
   veta   : el surco entre dos crestas, que va más oscuro
   nudo   : la cicatriz de una rama que se cayó
   luzC   : cuánto refleja esa corteza (el álamo es claro, el encino oscuro)
   famS   : la familia del follaje que queda en su propia sombra
   gamma  : menor que uno tupe el follaje, mayor lo ralea
   umbral : por debajo de esta densidad no se escribe nada y se ve el cielo
   grumo  : en bloques de cuántas celdas se agrupan los huecos */
const SPECIES={
  mistico:{n:'árbol místico', fam:'hueso', corteza:'hueso',
          copa:[' ','.','/','\\','|','Y','y'], borde:[' ','.','/','\\'],
          w:1.35, troncoFrac:0.30, tiers:0, sway:0.3, alto:[7,9], seco:true},
  pino:{  n:'pino',   fam:'pino',   corteza:'corteza',
          copa:[' ','.',':',';','*','A','#'], borde:[' ','.',':','^'],
          w:0.42, troncoFrac:0.46, tiers:4, sway:0.5, alto:[4.5,6.5],
          placa:['H','#','%'], veta:'|', nudo:['0','o'], luzC:1.00,
          famS:'pino',  gamma:0.66, umbral:0.20, grumo:2},
  encino:{n:'encino', fam:'verde',  corteza:'corteza',
          copa:[' ','.',',','o','e','8','@'], borde:[' ','.',',','`','o'],
          w:0.80, troncoFrac:0.24, tiers:0, sway:1.0, alto:[3.0,4.6],
          placa:['H','%','#'], veta:'|', nudo:['@','0'], luzC:0.88,
          famS:'verdeO', gamma:0.92, umbral:0.26, grumo:1},
  alamo:{ n:'álamo',  fam:'alamo',  corteza:'cortezaClara',
          copa:[' ','.','"','v','o','8'], borde:[' ','.','"','v'],
          w:0.38, troncoFrac:0.40, tiers:0, sway:1.8, alto:[4.0,5.6],
          placa:['l','|','I'], veta:'-', nudo:['o','0'], luzC:1.15,
          famS:'verde',  gamma:1.10, umbral:0.30, grumo:1}
};
const WOOD={ tronco:['t','h','H'], rama:['y','Y'], tocon:['o','0','U'], caido:['h','H'] };
/* ---------- MODELOS ----------
   Tres por especie. Todo se mide en FRACCIONES DEL ALTO del árbol, no en
   metros: el generador sortea la altura y el modelo se estira solo, así el
   mismo modelo sirve para un pino joven y para uno del bosque viejo.

   grosor   : el diámetro del tronco al pie
   ancho    : cuánto mide la copa a lo ancho
   horqueta : hasta dónde sube el tronco antes de abrirse en ramas
   lider    : hasta dónde sigue subiendo la guía central, afinándose
   inclina  : cuánto se corre el eje por cada unidad de altura
   nudos    : a qué alturas quedaron cicatrices de ramas caídas
   muertas  : a qué alturas hay una rama seca, sin una hoja
   pisos    : el pino reparte sus ramas en pisos (n), que caen (cae)
   manchas  : el encino lleva una rama y una mancha de follaje por lóbulo [x,y,r]
   columna  : el álamo apila manchas angostas; llama las ensancha al medio */
const MODELOS={
 pino:[
  {id:'pino-1', n:'joven, cerrado hasta abajo', grosor:0.039, ancho:0.462,
   horqueta:0.96, inclina:0,     pisos:{desde:0.14,n:8,cae:0.34,p:0.85},
   nudos:[], muertas:[]},
  {id:'pino-2', n:'adulto de fuste limpio', grosor:0.038, ancho:0.422,
   horqueta:0.96, inclina:0.03,  pisos:{desde:0.48,n:6,cae:0.40,p:0.80},
   nudos:[0.22,0.33,0.42], muertas:[0.46]},
  {id:'pino-3', n:'viejo, descopado', grosor:0.048, ancho:0.586,
   horqueta:0.90, inclina:-0.05, pisos:{desde:0.42,n:5,cae:0.16,p:0.40},
   nudos:[0.26,0.36,0.46,0.56], muertas:[0.44,0.60]}
 ],
 encino:[
  {id:'encino-1', n:'copa en dos lóbulos', grosor:0.081, ancho:0.952,
   horqueta:0.34, lider:0.86, inclina:0,
   manchas:[[-0.321,0.643,0.205],[0.298,0.726,0.224],[-0.024,0.845,0.167]],
   nudos:[0.20], muertas:[]},
  {id:'encino-2', n:'bifurcado desde abajo', grosor:0.100, ancho:1.158,
   horqueta:0.22, inclina:0,
   manchas:[[-0.447,0.539,0.232],[0.408,0.618,0.221],[-0.118,0.789,0.195],
            [0.184,0.829,0.184]],
   nudos:[], muertas:[]},
  {id:'encino-3', n:'viejo, copa despareja', grosor:0.091, ancho:1.043,
   horqueta:0.38, lider:0.90, inclina:0.05,
   manchas:[[-0.413,0.533,0.143],[0.185,0.707,0.226],[0.435,0.489,0.126],
            [0.011,0.870,0.126]],
   nudos:[0.24,0.32], muertas:[0.42]}
 ],
 alamo:[
  {id:'alamo-1', n:'columnar joven', grosor:0.030, ancho:0.280,
   horqueta:0.92, inclina:0,    columna:{desde:0.26,n:7,llama:0},
   nudos:[], muertas:[]},
  {id:'alamo-2', n:'adulto, copa en llama', grosor:0.031, ancho:0.345,
   horqueta:0.90, inclina:0.02, columna:{desde:0.30,n:8,llama:1},
   nudos:[0.28,0.38], muertas:[]},
  {id:'alamo-3', n:'ladeado, copa rala', grosor:0.032, ancho:0.352,
   horqueta:0.88, inclina:0.20, columna:{desde:0.28,n:7,llama:1,rala:0.68},
   nudos:[0.32], muertas:[0.44]}
 ]
};
const RAMP={
  copa:  [' ','.',',','o','e','8','@'],
  borde: [' ','.',',','`','o'],
  punta: ['I','I','i'],
  tronco: WOOD.tronco, rama: WOOD.rama
};
/* 4 escalones de luz por familia, nada de degradado continuo */
NV.MAT=MAT; NV.MID=MID; NV.RESERVA=RESERVA; NV.SPECIES=SPECIES; NV.WOOD=WOOD; NV.RAMP=RAMP;
NV.MODELOS=MODELOS;

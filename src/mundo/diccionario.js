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

/* ---------- EL SUELO ----------
   El suelo se sorteaba celda por celda: cada celda saca su densidad de un hash
   propio. Eso da estática. La arena de verdad tiene ONDAS, la tierra tiene
   TERRONES y GRIETAS, el pasto crece en MATAS y la nieve se acumula en
   MANCHONES, y un hash por celda no puede dar nada de eso, porque todas esas
   cosas son coherencia espacial. Ahora la densidad sale de un ruido suave de
   dos octavas en coordenadas de celda, más lo que cada material tenga propio:

   onda    : una sinusoide en la dirección del viento o de la corriente, con la
             cresta corrida por el ruido para que no salga peinada. El largo va
             en METROS: puesto en celdas da un período de dos caracteres, que no
             se lee como onda sino como alternancia.
   terron  : el bulto de la tierra, de un ruido de escala media
   grieta  : corre por donde el ruido pasa justo por el medio; el umbral tiene
             que ser chico, porque una grieta es una línea fina
   charco  : qué fracción del barro está encharcada, y si brilla
   costra  : el barro seco partido en placas
   calibre : el canto rodado, chico cerca del agua y grueso lejos
   mata    : cuánta mata de pasto hay; la reparte un ruido por metro, así crece
             a parches y no parejo como una cancha
   tendido : cuánto se acuesta la brizna, para el pasto seco o pisado
   manto   : cuánta nieve cubre, y por dónde asoma lo de abajo
   detalle : lista de DET que se esparcen sobre este suelo (flores, guijarros...) */

/* Detalle suelto del suelo. Cada uno aparece en MANCHAS (un ruido en metros del
   mundo, así que no cambia con el zoom) y con una densidad en cosas por metro
   CUADRADO en el centro de la mancha, no por celda: por celda, acercarse
   llenaba el prado de flores.
     glifo  : el carácter. Va por la regla 3: '+' no lo usa ningún suelo; 'o' es
              el extremo denso del guijarral (un guijarro es un guijarro);
              ',' es el extremo ralo compartido
     fam    : familias de color; cada mancha elige UNA, para que sea de un color
     escala : tamaño de la mancha, en metros
     corte  : qué parte del ruido queda fuera de manchas (más alto = menos manchas)
     borde  : cuánto ruido hace falta por encima del corte para llegar a la densidad
              plena: chico = manchas de borde marcado, grande = se van ralando
     porM2  : cuántos hay por metro cuadrado en el centro de la mancha
     alza   : si sube sobre una brizna (la flor) o va a ras del suelo
     sem    : desfase del ruido y de la semilla, para que dos detalles no coincidan */
const DET={
  flores:   {glifo:'+', fam:['flor','hoja'],   escala:2.6, corte:0.58, borde:0.10, porM2:6.5, alza:1, sem:311},
  guijarros:{glifo:'o', fam:['piedra'],        escala:4.5, corte:0.60, borde:0.10, porM2:3.8, alza:0, sem:523},
  hojarasca:{glifo:',', fam:['hoja','hongo'],  escala:3.2, corte:0.55, borde:0.12, porM2:11.0, alza:0, sem:707}
};
const MAT={                                   // capa SUELO, en uso
  /* UN SOLO PASTO. En la muestra de referencia todo el prado es la misma brizna y sólo
     cambia la luz. Los cuatro materiales de pasto siguen existiendo —el generador y las
     pruebas los distinguen por su letra— pero se dibujan igual: brizna fina y erguida,
     base en sombra y punta clara, con flores blancas sueltas. */
  g:{n:'pasto', fam:'verdeO', ramp:['|','|','|','|','|'], tip:['|','/','\\'], fam2:'verde', largo:1, mata:0.70,
     detalle:[DET.flores]},
  G:{n:'pasto', fam:'verdeO', ramp:['|','|','|','|','|'], tip:['|','/','\\'], fam2:'verde', largo:1, mata:0.70,
     detalle:[DET.flores]},
  h:{n:'pasto', fam:'verdeO', ramp:['|','|','|','|','|'], tip:['|','/','\\'], fam2:'verde', largo:1, mata:0.70,
     detalle:[DET.flores]},
  n:{n:'pasto', fam:'verdeO', ramp:['|','|','|','|','|'], tip:['|','/','\\'], fam2:'verde', largo:1, mata:0.70,
     detalle:[DET.flores]},
  s:{n:'arena de río',fam:'arena',  ramp:['.','.',':','\u00b0',';'],
     onda:{largo:0.8, angulo:0.0, fuerza:0.62}},
  y:{n:'arena de mar',fam:'roca2',  ramp:['.',':','\u00b0','=','='], mojada:1,
     onda:{largo:1.6, angulo:0.10, fuerza:0.34}},
  b:{n:'barro',       fam:'tierra', ramp:[':',',','-','=','~'],
     charco:0.42, brillo:1, costra:0.4, textura:'tierra'},
  k:{n:'guijarral',   fam:'piedra', ramp:['.',':','\u00b0','o','c'], calibre:0.5},
  K:{n:'canto de mar',fam:'piedra', ramp:[':','\u00b0','o','c','O'], calibre:1},
  a:{n:'agua somera', fam:'agua',   ramp:[' ','.','-','~','-'], agua:1.22, ola:'somera'},
  A:{n:'corriente',   fam:'agua',   ramp:['-','~','~','=','~'], agua:1.00, ola:'rio'},
  P:{n:'agua honda',  fam:'honda',  ramp:['~','=','_','_','_'], agua:0.62, solido:true, ola:'rio-profundo'},
  E:{n:'espuma',      fam:'espuma', ramp:['-','~','=','*','#'], agua:1.25, ola:'rompiente'},
  L:{n:'lago',        fam:'honda',  ramp:['_','_','=','=','~'], agua:0.62, solido:true, ola:'tranquila'},
  l:{n:'orilla del lago',fam:'agua',ramp:[' ','.','-','~','-'], agua:1.22, ola:'tranquila-somera'},
  O:{n:'mar abierto', fam:'honda',  ramp:['~','=','_','_','_'], agua:0.58, solido:true, ola:'mar'},
  M:{n:'roca madre',  fam:'piedra', ramp:['.',':','^','A','M'], solido:true, textura:'roca'},
  V:{n:'el vacío',    fam:'abismo', ramp:[' ',' ','.',':','.'], solido:true, textura:'caida'},
  d:{n:'tierra',      fam:'tierra', ramp:['.',',','-','_','='], textura:'tierra', terron:0.48},
  R:{n:'ruina',       fam:'piedra', ramp:['.',':','#','%','#'], solido:true, textura:'roca'},
  N:{n:'nieve',       fam:'nieve',  ramp:[' ','.','\u00b0','*','*'], manto:0.97},
  D:{n:'duna',        fam:'arena',  ramp:['.','.',':',';',';'],
     onda:{largo:2.6, angulo:0.42, fuerza:0.74}}
};
/* ---------- EL AGUA ----------
   El agua no es una textura: es una SUPERFICIE CON ALTURA. Todo sale de un
   campo de olas —la suma de dos o tres sinusoides que viajan, más ruido para
   que el frente no salga peinado— y de ahí se deducen las tres cosas que la
   hacen leer como agua:

     la ALTURA elige el glifo (cresta tupida, valle liso),
     la PENDIENTE hacia el este decide dónde pega el reflejo del sol,
     y la ESPUMA aparece donde la cresta es alta Y empinada a la vez.

   El reflejo es lo que más vende el agua. Sin él, cualquier campo de ondas
   parece una tela corrugada, y eso era exactamente el agua de antes: una
   sinusoide de densidad sin brillo.

   olas    : largo en metros, dirección en radianes (0 = al este), velocidad en
             metros por segundo, amplitud
   hondo   : cuánto oscurece la profundidad
   espuma  : desde qué altura de cresta rompe (9 = no rompe nunca)
   brillo  : cuánto reflejo deja; el agua quieta espeja, la revuelta no
   quiebre : cuánto desordena el ruido el frente de la ola
   reposo  : de 0 a 1, cuánto se mueve la superficie (contraste y ritmo de las olas);
             el agua de la muestra está quieta casi siempre y sólo se arruga un poco
   rocio   : el viento arranca agua de la cresta y la tira por arriba */
const OLAS={
 'tranquila':{reposo:0.55, fam:'agua', famH:'honda', hondo:0.30, espuma:9, brillo:1.35, quiebre:0.10,
   rampa:['_','_','-','-','~'],
   olas:[{largo:5.0,dir:0.30,vel:0.22,amp:0.55},{largo:2.1,dir:1.40,vel:0.15,amp:0.30}]},
 'tranquila-somera':{reposo:0.55, fam:'agua', famH:'agua', hondo:0.06, espuma:9, brillo:1.40, quiebre:0.20,
   rampa:[' ','.','-','~','-'],
   olas:[{largo:3.0,dir:0.30,vel:0.26,amp:0.55},{largo:1.1,dir:1.40,vel:0.20,amp:0.34}]},
 'somera':{reposo:0.5, fam:'agua', famH:'agua', hondo:0.05, espuma:0.74, brillo:0.85, quiebre:0.85,
   rampa:['.','-','~','~','='],
   olas:[{largo:0.75,dir:0.08,vel:1.35,amp:0.70},{largo:0.30,dir:-0.30,vel:1.80,amp:0.45}]},
 'rio':{reposo:0.55, fam:'agua', famH:'agua', hondo:0.35, espuma:0.90, brillo:1.00, quiebre:0.35,
   rampa:['-','~','~','=','='],
   olas:[{largo:2.2,dir:0.04,vel:0.95,amp:0.60},{largo:0.8,dir:0.30,vel:1.25,amp:0.34}]},
 'rio-profundo':{reposo:0.45, fam:'honda', famH:'honda', hondo:0.85, espuma:9, brillo:0.70, quiebre:0.12,
   rampa:['_','_','=','=','~'],
   olas:[{largo:4.0,dir:0.02,vel:0.55,amp:0.45},{largo:1.5,dir:0.40,vel:0.70,amp:0.22}]},
 'mar-calma':{reposo:0.45, fam:'honda', famH:'honda', hondo:0.70, espuma:9, brillo:1.45, quiebre:0.08,
   rampa:['_','_','-','-','~'],
   olas:[{largo:14.0,dir:1.55,vel:1.60,amp:0.70},{largo:3.0,dir:1.20,vel:0.70,amp:0.22}]},
 'mar-olas':{reposo:0.8, fam:'honda', famH:'honda', hondo:0.62, espuma:0.76, brillo:1.05, quiebre:0.30,
   rampa:['-','~','~','=','='],
   olas:[{largo:9.0,dir:1.57,vel:2.30,amp:1.00},{largo:3.2,dir:1.30,vel:1.30,amp:0.40},
         {largo:1.1,dir:1.80,vel:1.10,amp:0.18}]},
 'mar-tormenta':{fam:'honda', famH:'honda', hondo:0.55, espuma:0.60, brillo:0.55, quiebre:0.80,
   rampa:['~','=','=','#','#'], rocio:1,
   olas:[{largo:7.0,dir:1.57,vel:3.40,amp:1.25},{largo:2.6,dir:1.05,vel:2.40,amp:0.75},
         {largo:0.9,dir:2.10,vel:2.00,amp:0.40}]},
 'rompiente':{reposo:0.85, fam:'espuma', famH:'espuma', hondo:0.10, espuma:0.30, brillo:1.20, quiebre:0.70,
   rampa:['-','~','=','*','#'],
   olas:[{largo:6.0,dir:1.57,vel:2.60,amp:1.10},{largo:1.4,dir:1.40,vel:1.60,amp:0.50}]}
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
          w:1.35, troncoFrac:0.30, tiers:0, sway:0.3, alto:[7,9], seco:true,
          glifos:{ralo:['1','l','i','I','!'], denso:['@','&','Q','O','9'], fam:'hueso', fleco:'nieve', tono:1.20},
          modelo:{id:'mistico-1', grosor:0.07, ancho:0.9, horqueta:0.40, lider:0.85, inclina:0.04,
                  manchas:[[-0.30,0.70,0.20],[0.24,0.76,0.22],[-0.04,0.90,0.15]], nudos:[], muertas:[]}},
  pino:{  n:'pino',   fam:'pino',   corteza:'corteza',
          copa:[' ','.',':',';','*','A','#'], borde:[' ','.',':','^'],
          w:0.42, troncoFrac:0.46, tiers:4, sway:0.5, alto:[4.5,6.5],
          placa:['H','#','%'], veta:'|', nudo:['0','o'], luzC:1.00,
          glifos:{ralo:['1','l','i','t','f','I','j'], denso:['k','b','d','h','B','R','6','4'], fam:'pino', fleco:'piedra', tono:0.85},
          famS:'pino',  gamma:0.78, umbral:0.26, grumo:2},
  encino:{n:'encino', fam:'verde',  corteza:'corteza',
          copa:[' ','.',',','o','e','8','@'], borde:[' ','.',',','`','o'],
          w:0.80, troncoFrac:0.24, tiers:0, sway:1.0, alto:[3.0,4.6],
          placa:['H','%','#'], veta:'|', nudo:['@','0'], luzC:0.88,
          glifos:{ralo:['1','i','l','t','j'], denso:['p','q','g','d','b','6'], fam:'verde', fleco:'verde', tono:1.05},
          famS:'verdeO', gamma:1.00, umbral:0.32, grumo:2},
  alamo:{ n:'álamo',  fam:'alamo',  corteza:'cortezaClara',
          copa:[' ','.','"','v','o','8'], borde:[' ','.','"','v'],
          w:0.38, troncoFrac:0.40, tiers:0, sway:1.8, alto:[4.0,5.6],
          placa:['l','|','I'], veta:'-', nudo:['o','0'], luzC:1.15,
          glifos:{ralo:['1','l','i','t','I','!','|'], denso:['h','b','d','k','R','6','9'], fam:'cortezaClara', fleco:'piedra', tono:1.15},
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
/* grosor: troncos más gruesos que antes (×1,7 encino, ×1,5 pino, ×1,35 álamo):
   el bosque viejo se lee por el fuste ancho y torcido, no por la copa. */
const MODELOS={
 pino:[
  {id:'pino-1', n:'joven, cerrado hasta abajo', grosor:0.058, ancho:0.462,
   horqueta:0.96, inclina:0,     pisos:{desde:0.14,n:8,cae:0.34,p:0.85},
   nudos:[], muertas:[]},
  {id:'pino-2', n:'adulto de fuste limpio', grosor:0.057, ancho:0.422,
   horqueta:0.96, inclina:0.03,  pisos:{desde:0.48,n:6,cae:0.40,p:0.80},
   nudos:[0.22,0.33,0.42], muertas:[0.46]},
  {id:'pino-3', n:'viejo, descopado', grosor:0.072, ancho:0.586,
   horqueta:0.90, inclina:-0.05, pisos:{desde:0.42,n:5,cae:0.16,p:0.40},
   nudos:[0.26,0.36,0.46,0.56], muertas:[0.44,0.60]}
 ],
 encino:[
  {id:'encino-1', n:'copa en dos lóbulos', grosor:0.138, ancho:0.952,
   horqueta:0.34, lider:0.86, inclina:-0.06,
   manchas:[[-0.321,0.643,0.205],[0.298,0.726,0.224],[-0.024,0.845,0.167]],
   nudos:[0.20], muertas:[]},
  {id:'encino-2', n:'bifurcado desde abajo', grosor:0.170, ancho:1.158,
   horqueta:0.22, inclina:0.07,
   manchas:[[-0.447,0.539,0.232],[0.408,0.618,0.221],[-0.118,0.789,0.195],
            [0.184,0.829,0.184]],
   nudos:[], muertas:[]},
  {id:'encino-3', n:'viejo, copa despareja', grosor:0.155, ancho:1.043,
   horqueta:0.38, lider:0.90, inclina:0.05,
   manchas:[[-0.413,0.533,0.143],[0.185,0.707,0.226],[0.435,0.489,0.126],
            [0.011,0.870,0.126]],
   nudos:[0.24,0.32], muertas:[0.42]}
 ],
 alamo:[
  {id:'alamo-1', n:'columnar joven', grosor:0.041, ancho:0.280,
   horqueta:0.92, inclina:0,    columna:{desde:0.26,n:7,llama:0},
   nudos:[], muertas:[]},
  {id:'alamo-2', n:'adulto, copa en llama', grosor:0.042, ancho:0.345,
   horqueta:0.90, inclina:0.02, columna:{desde:0.30,n:8,llama:1},
   nudos:[0.28,0.38], muertas:[]},
  {id:'alamo-3', n:'ladeado, copa rala', grosor:0.043, ancho:0.352,
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
/* ---------- PIEDRA ----------
   Un árbol es tronco más follaje. Una roca es otra cosa: masa con caras planas.
   Lo que la hace leer como piedra y no como globo es que cada cara reciba su
   propia luz —constante dentro de la cara— y que el filo entre dos caras se
   vea. Un degradado suave da un almohadón; un escalón da una piedra.

   Cuatro texturas, cada una una rampa de ralo a tupido como manda la regla 2.
   Cinco escalones y no cuatro, y la cara clara arranca en un glifo liviano: con
   cuatro glifos todos densos la cara iluminada salía como un panel macizo sin
   grano. La arenisca pierde el '=' del grano porque ése queda reservado al
   estrato: con el mismo glifo en los dos, la repisa se perdía adentro de la
   textura. 'grano' es de cuántas celdas son los manchones. */
const TEX={
  /* Cinco escalones, no cuatro, y la cara clara arranca en un glifo liviano:
     con cuatro glifos todos densos la cara iluminada salía como un panel macizo
     sin grano. El manchón necesita rango tonal para verse. */
  granito:  {claro:['o','a','0','e','8','9','&','#','@'], oscuro:['.',':','o','c','e','a','%'], fam:'piedra', grano:1},
  /* La arenisca pierde el '=' del grano: ése queda reservado al estrato. Con el
     mismo glifo en los dos, la repisa se perdía adentro de la textura. */
  arenisca: {claro:['-',':','o','8','%'], oscuro:['.','.',':','-','o'], fam:'roca2',  grano:3},
  pulido:   {claro:[':','o','0','0','8'], oscuro:['.','.',':','o','o'], fam:'piedra', grano:3},
  basalto:  {claro:['c','o','a','%','8','#','H','B'], oscuro:['.',':','c','o','e','%'], fam:'piedra', grano:1}
};
const LIQUEN={glifos:['°','°','*','*'], fam:'musgo'};
/* Los quince modelos de piedra. Las chicas, medias y grandes y las gigantes del
   pie de monte llevan silueta: 'perfil' va de la base izquierda, sube por
   arriba y baja a la base derecha, en fracciones del alto. 'caras' dice dónde
   se corta esa silueta en caras verticales y qué luz tiene cada una; el salto
   de luz entre dos caras es el filo. 'estrat' son repisas que cruzan la piedra,
   'grietas' polilíneas oscuras, 'liquen' manchas que sólo agarran en la cara
   que da al sol, y 'pie' cuánto derrumbe hay al pie.

   Los acantilados no llevan silueta: se sintetizan, porque un muro de dieciséis
   metros son más de doscientos caracteres de ancho y una silueta a mano ahí da
   un panel plano. Llevan en cambio cuánto relieve tiene la cara, cada cuántos
   metros hay una canaleta, cuánto se quiebra el borde de arriba, cada cuánto
   hay un estrato, de qué ancho son las columnas fracturadas y a qué alturas hay
   repisas. */
const ROCAS={
 pequena:[
  {id:'peq-1', n:'Canto rodado', alto:0.45, tex:'pulido',
   perfil:[[-1.10,0],[-1.16,0.42],[-0.72,0.88],[0,1],[0.76,0.86],[1.14,0.40],[1.08,0]],
   caras:[[-1.2,0.44],[-0.2,0.78],[0.5,1.06]], estrat:[], grietas:[],
   liquen:[[-0.45,0.72,0.30]], pie:0},
  {id:'peq-2', n:'Lajas apiladas', alto:0.55, tex:'arenisca',
   perfil:[[-1.30,0],[-1.34,0.34],[-0.96,0.40],[-1.02,0.72],[-0.50,0.80],
           [0.62,1],[1.20,0.92],[1.26,0.30],[1.18,0]],
   caras:[[-1.4,0.40],[0.1,0.86],[0.7,1.12]],
   estrat:[], grietas:[], liquen:[], pie:0.3}   /* medio metro: la repisa no cabe */,
  {id:'peq-3', n:'Piedra angulosa partida', alto:0.40, tex:'granito',
   perfil:[[-1.25,0],[-0.95,0.62],[-0.30,1],[0.28,0.94],[0.60,0.52],[1.30,0.22],[1.22,0]],
   caras:[[-1.3,0.34],[-0.3,0.72],[0.3,1.14]], estrat:[],
   grietas:[[[-0.30,1],[-0.10,0.30]]], liquen:[], pie:0.2}
 ],
 media:[
  {id:'med-1', n:'Bloque facetado con liquen', alto:1.15, tex:'granito',
   perfil:[[-1.05,0],[-1.12,0.50],[-0.80,0.90],[-0.10,1],[0.62,0.96],[1.00,0.58],[0.96,0]],
   caras:[[-1.2,0.38],[-0.25,0.80],[0.45,1.14]], estrat:[],
   grietas:[[[-0.45,0.95],[-0.20,0.22]]],
   liquen:[[0.40,0.70,0.34],[0.10,0.86,0.22]], pie:0.35},
  {id:'med-2', n:'Piedra hendida en dos', alto:1.30, tex:'basalto',
   perfil:[[-1.00,0],[-1.06,0.56],[-0.62,0.94],[-0.16,0.74],[-0.04,0.98],
           [0.46,1],[0.92,0.62],[0.88,0]],
   caras:[[-1.1,0.36],[-0.10,0.72],[0.40,1.16]], estrat:[],
   grietas:[[[-0.10,0.86],[-0.06,0.10]]], liquen:[], pie:0.4},
  {id:'med-3', n:'Canto grande medio enterrado', alto:0.95, tex:'pulido',
   perfil:[[-1.45,0],[-1.40,0.46],[-0.88,0.86],[0.05,1],[0.95,0.84],[1.42,0.42],[1.38,0]],
   caras:[[-1.5,0.42],[-0.1,0.84],[0.6,1.10]], estrat:[], grietas:[],
   liquen:[[-0.70,0.62,0.36]], pie:0.7}
 ],
 grande:[
  {id:'gra-1', n:'Bloque errático de techo plano', alto:2.40, tex:'granito',
   perfil:[[-0.92,0],[-0.98,0.62],[-0.86,0.96],[-0.20,1],[0.58,0.98],[0.86,0.66],[0.82,0]],
   caras:[[-1.0,0.30],[-0.30,0.74],[0.35,1.16]], estrat:[],
   grietas:[[[-0.55,0.96],[-0.42,0.14]],[[0.30,0.98],[0.46,0.40]]],
   liquen:[[0.00,0.90,0.30]], pie:0.45},
  {id:'gra-2', n:'Roca en voladizo', alto:2.80, tex:'basalto',
   perfil:[[-0.58,0],[-0.66,0.42],[-1.10,0.66],[-1.16,0.92],[-0.30,1],
           [0.52,0.96],[0.70,0.54],[0.52,0]],
   caras:[[-1.2,0.26],[-0.35,0.66],[0.25,1.18]], estrat:[],
   grietas:[[[-0.70,0.92],[-0.55,0.46]]], liquen:[[-0.60,0.84,0.26]], pie:0.5},
  {id:'gra-3', n:'Peñasco de estratos inclinados', alto:2.10, tex:'arenisca',
   perfil:[[-1.20,0],[-1.26,0.40],[-0.95,0.78],[-0.35,1],[0.70,0.82],[1.12,0.44],[1.08,0]],
   caras:[[-1.3,0.38],[-0.20,0.78],[0.50,1.12]],
   /* tres repisas y poca inclinación: con cinco y 0,085 las líneas se cruzaban
      entre ellas y no se leía ninguna */
   estrat:[0.28,0.52,0.78], inclinaEstrat:0.05,
   grietas:[], liquen:[], pie:0.6}
 ],
 gigante:[
  {id:'gig-1', n:'Torreón de grietas verticales', alto:6.00, tex:'basalto',
   perfil:[[-0.46,0],[-0.52,0.34],[-0.44,0.72],[-0.50,0.94],[-0.12,1],
           [0.34,0.96],[0.44,0.70],[0.38,0.30],[0.42,0]],
   caras:[[-0.55,0.26],[-0.18,0.66],[0.18,1.18]], estrat:[],
   grietas:[[[-0.30,0.98],[-0.26,0.06]],[[0.10,0.94],[0.16,0.20]],
            [[-0.05,0.70],[-0.02,0.10]]],
   liquen:[[-0.30,0.40,0.14]], pie:0.9},
  {id:'gig-2', n:'Mole de lomo pulido', alto:7.50, tex:'pulido',
   perfil:[[-0.74,0],[-0.80,0.30],[-0.66,0.64],[-0.34,0.92],[0.08,1],
           [0.50,0.88],[0.70,0.56],[0.72,0.24],[0.66,0]],
   caras:[[-0.85,0.34],[-0.20,0.80],[0.30,1.20]], estrat:[],
   grietas:[[[-0.20,0.90],[-0.10,0.40]]],
   liquen:[[-0.50,0.50,0.22],[-0.30,0.74,0.16]], pie:0.7},
  {id:'gig-3', n:'Amontonamiento de bloques', alto:5.20, tex:'granito',
   perfil:[[-1.05,0],[-1.10,0.32],[-0.72,0.44],[-0.80,0.70],[-0.34,0.80],
           [-0.40,1],[0.18,0.98],[0.26,0.72],[0.72,0.64],[0.66,0.34],[0.98,0.26],[0.94,0]],
   caras:[[-1.15,0.30],[-0.30,0.72],[0.25,1.16]],
   estrat:[], grietas:[[[-0.72,0.44],[-0.78,0.68]],[[-0.34,0.80],[-0.38,0.99]],
            [[0.26,0.72],[0.70,0.65]],[[0.66,0.34],[0.96,0.27]]],
   liquen:[[0.40,0.46,0.20]], pie:1.0},
  /* Menhires: columnas de pie, angostas y altas, como las piedras del claro de
     la referencia. El perfil casi no se ensancha, la cima se rompe en un hombro,
     y llevan musgo bajo y pie de derrumbe corto. */
  {id:'gig-4', n:'Menhir de cima rota', alto:6.20, tex:'granito',
   perfil:[[-0.30,0],[-0.34,0.30],[-0.30,0.78],[-0.34,0.92],[-0.10,1],
           [0.06,0.90],[0.30,0.94],[0.32,0.50],[0.28,0]],
   caras:[[-0.40,0.24],[-0.10,0.62],[0.12,1.16]], estrat:[],
   grietas:[[[-0.12,0.96],[-0.08,0.20]],[[0.14,0.88],[0.18,0.34]]],
   liquen:[[-0.18,0.18,0.16],[0.10,0.10,0.12]], pie:0.35},
  {id:'gig-5', n:'Menhir inclinado', alto:5.00, tex:'granito',
   perfil:[[-0.34,0],[-0.30,0.40],[-0.20,0.80],[-0.10,1],[0.22,0.98],
           [0.36,0.60],[0.40,0.22],[0.36,0]],
   caras:[[-0.45,0.22],[-0.05,0.58],[0.20,1.14]], estrat:[],
   grietas:[[[0.00,0.94],[0.10,0.30]]],
   liquen:[[-0.15,0.24,0.18]], pie:0.30}
 ],
 /* Los acantilados NO llevan silueta dibujada a mano: se sintetizan. Un muro
    de dieciséis metros son más de doscientos caracteres de ancho, y una silueta
    a mano ahí da un panel plano con tres bandas. Un acantilado es borde
    superior quebrado, contrafuertes y canaletas, estratos y derrumbe al pie,
    repetible a lo largo de toda la costa. */
 acantilado:[
  {id:'aca-1', n:'Acantilado de estratos horizontales', muro:1, alto:9, ancho:16,
   tex:'arenisca', relieve:0.34, canaleta:5.0, cresta:0.13, crestaEsc:3.2,
   estratoCada:1.05, estratoTilt:0.012, columnas:0, repisas:[], pie:0.55},
  {id:'aca-2', n:'Acantilado de columnas fracturadas', muro:1, alto:12, ancho:14,
   tex:'basalto', relieve:0.22, canaleta:3.0, cresta:0.07, crestaEsc:1.4,
   estratoCada:0, estratoTilt:0, columnas:0.95, repisas:[], pie:0.40},
  {id:'aca-3', n:'Acantilado con repisas y derrumbe', muro:1, alto:7, ancho:18,
   tex:'granito', relieve:0.44, canaleta:6.5, cresta:0.17, crestaEsc:4.0,
   estratoCada:0, estratoTilt:0, columnas:0, repisas:[0.34,0.62,0.84], pie:1.30}
 ]
};
NV.TEX=TEX; NV.LIQUEN=LIQUEN; NV.ROCAS=ROCAS;
NV.OLAS=OLAS; NV.MAT=MAT; NV.MID=MID; NV.RESERVA=RESERVA; NV.SPECIES=SPECIES; NV.WOOD=WOOD; NV.RAMP=RAMP;
NV.MODELOS=MODELOS;

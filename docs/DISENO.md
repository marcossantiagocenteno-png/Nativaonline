# Nativa Online — documento de diseño

> Este documento manda sobre el código. Si el código lo contradice, el código está mal.
> Toda sesión de trabajo (humana o con Claude) empieza leyendo esto.

---

## 1. La tesis

La misión del juego es **proteger el Bosque Eterno**. No hay misiones encadenadas,
no hay botín, no hay barras de experiencia. Se cuida: animales, plantas, nativas.
Se ahuyenta cazadores, se desarman trampas, se equilibran especies, se pelea con
los lobos de la niebla cuando no queda otra.

Consecuencia de diseño, no negociable: **el mundo es el contenido**. Lo que hay
que construir no son enemigos ni objetos, es una simulación que se desequilibra
sola. Si la simulación respira, el juego existe aunque no haya nada más.

---

## 2. La regla de los números ocultos

El motor tiene dos capas y **la de abajo nunca le habla al jugador**.

- **Capa de simulación**: calcula daño, durabilidad, heridas, hambre, frío, veneno,
  poblaciones. Trabaja con números.
- **Capa sensorial**: es lo único que el jugador percibe. Traduce todo a cuerpo y
  mundo: la nativa cojea, el arco se siente flojo, la respiración se acorta, la
  lanza se traba al clavarse, el agua está más fría que ayer.

Nunca aparece un número de daño, de vida, de defensa ni de durabilidad. Ni en la
interfaz, ni en un menú, ni en un mensaje. Las armas y armaduras **casi no se
diferencian en daño**; se diferencian en cuánto duran. El jugador tiene que darse
cuenta solo.

Si un día aparece un `32/50` en pantalla, el juego dejó de ser este juego.

---

## 3. Las nativas

Dos clases, sin estadísticas visibles:

| | arma | ritmo | defensa |
|---|---|---|---|
| **Guardiana** | arco, flecha y daga | rápida | poca |
| **Centinela** | lanza, escudo y armadura | lenta | mucha |

La diferencia se siente al moverse y al recibir un golpe, nunca se lee.

**La muerte es permanente.** Se muere y se empieza de nuevo.

Estados del cuerpo, todos sensoriales y ninguno severo de más: heridas, veneno,
calor, frío, hambre.

---

## 4. Lumivaâri

La comunicación con NPC y con otros jugadores es **muy limitada** y ocurre en
Lumivaâri. El jugador aprende el significado de las palabras jugando; sin
entenderlas no puede intercambiar objetos.

Regla para que sea un acertijo y no un muro: **cada palabra entra con una pista no
verbal**. La NPC señala el objeto, lo levanta, lo ofrece, mira al cielo. Si la
palabra llega sola, el jugador abandona.

El jugador tiene un glosario que se llena solo con lo que va deduciendo.

---

## 5. Tiempo, cielo y estaciones

**Un año de juego = un mes nuestro.** De ahí sale todo lo demás:

| unidad de juego | tiempo real |
|---|---|
| 1 año | 30 días |
| 1 estación | 7 días y medio |
| 1 día | 2 horas |
| 1 noche | unos 45 minutos |

El calendario corre solo, aunque no haya nadie conectado.

**Cosmología: dos lunas y un sol.** Calculada en `src/mundo/astro.js`, presentada
en `src/mundo/cielo.js`. Los números viven en `NV.ASTRO` y se pueden ajustar sin
tocar el cálculo.

El planeta tarda **430 días** en dar la vuelta a su estrella, y ese año entero
dura **un mes nuestro**. De ahí sale todo lo demás, sin capas intermedias: **la
fecha avanza con el sol, no con el reloj de afuera**. El calendario es,
directamente, el día del planeta.

| | duración real |
|---|---|
| Año: 430 días | 30 días nuestros, un mes |
| Mes: 43 días (diez por año) | 3 días nuestros |
| Estación: 107,5 días | 7 días y medio |
| Día del planeta | 100 minutos |
| Ciclo de fases de Calavera | 2 h 18 min |
| Ciclo de fases de Madre | 9 h 35 min |

El sol sale por el este, llega a 58° al mediodía y se pone por el oeste. La sombra
apunta al lado contrario y se acorta al mediodía: al oeste a la mañana, al norte al
mediodía, al este a la tarde. De noche no hay sombra proyectada.

**Calavera** mide 8.000 km y orbita a 150.000 km: en el cielo se ve **seis veces más
grande que nuestra Luna**, y por eso alumbra tanto. Período sideral 1,366 días,
sinódico 1,37035. Inclinación 8°, precesión nodal 180 días.

**Madre** mide 3.600 km a 390.000 km: aparenta lo mismo que nuestra Luna y alumbra
poco. Sideral 5,65 días, sinódico 5,725. Inclinación 12°, precesión nodal 360 días.

La luz de la noche **nunca es fija**: depende de la fase de cada luna, de su altura
sobre el horizonte y de su tamaño aparente. Hay noches de oscuridad completa, sin
ninguna luna arriba, y noches en que se ve casi todo. Con poca luz la vista se
cierra a unos metros.

**Eclipses.** No basta con que una luna esté nueva o llena: tiene que pasar cerca de
uno de sus nodos, los dos puntos donde su órbita cruza el plano del planeta. Los
nodos retroceden —180 días Calavera, 360 Madre—, así que las temporadas de eclipse
se corren a lo largo del año. Se distinguen totales, anulares, parciales y
penumbrales según la geometría.

Cuando Calavera eclipsa, el mundo entero se tiñe de **rojo**; cuando lo hace Madre,
de un **blanco pálido y frío**. En un eclipse doble gana el de mayor magnitud, por
regla fija, nunca al azar. El origen de esos colores es deliberadamente desconocido
y el juego no lo explica.

**Problema abierto: los eclipses son demasiado frecuentes.** Con los números
actuales, Calavera produce unos 108 eclipses de sol y 286 de luna por año: trece
episodios por día real. Madre, unos 39 al año. No es un error de cálculo, es
consecuencia de la geometría: una luna de 3° de ancho que orbita cada 1,37 días,
con solo 8° de inclinación, se cruza con la estrella todo el tiempo. Si los
eclipses tienen que ser un presagio y no una rutina, la palanca es la **inclinación
orbital**: con 25° o 30°, Calavera bajaría a unos diez al año. Pendiente de decidir.

**Supuestos tomados**, por no estar definidos, ambos configurables en `NV.ASTRO`:
Calavera está nueva en el origen del tiempo (día 1), Madre está nueva el día 387
del año, y los nodos de ambas arrancan en longitud 0.

**Mareas.** `src/mundo/mareas.js`. No se suman números: se suman direcciones. Cada
cuerpo tira en dos sentidos opuestos a la vez, así que dos alineados se refuerzan y
dos en ángulo recto se anulan. Cinco clases —muerta, ordinaria, viva, reforzada,
excepcional— repartidas a lo largo del año, y una oscilación de dos pleamares por
día del planeta. Los pesos de la ficha original —205 para Calavera— quedaron
descartados por cataclísmicos; se conserva el orden, con Calavera mandando, la
estrella pesando un tercio y Madre acompañando.

**Clima.** `src/mundo/clima.js`. Nada de sorteos sueltos: todo sale del tiempo
astronómico, de modo que dos sesiones en el mismo instante ven el mismo cielo. La
estación fija una humedad de base, la marea la empuja, la humedad hace nubes y las
nubes hacen lluvia, siempre de a poco. Medido sobre un año: llueve el 24% del
tiempo en otoño y nada en verano; las tormentas ocupan el 0,09%. La marea alta deja
más humedad que la baja, pero no la decide sola.

**Tres intensidades de lluvia**, y la grande no la dispara la luna.

| | se ve | viento |
|---|---|---|
| Llovizna | hilos ralos y cortos | normal |
| Lluvia cerrada | cortina tupida, la distancia se pierde | casi el doble |
| Tormenta | cortina inclinada, relámpagos | más del triple |

Cada gota tiene su columna, su velocidad y su desvío: cae de verdad, se tuerce con
la ráfaga y revienta contra el suelo con una marca.

La **tormenta exige que coincidan tres cosas**: lluvia cerrada, marea viva o más y
aire cargado. La luna manda por detrás, a través de la marea, nunca de forma
directa: medido sobre un año, con Calavera llena hay tormenta solo el 3,6% de las
veces. Así el que mira el cielo puede anticiparla —ve la marea trepando y el aire
pesado— sin que sea una regla mecánica.

Los **relámpagos** son un golpe de luz blanca en el mundo entero que dura menos de
una décima de segundo: alumbra todo y vuelve enseguida. Mientras hay tormenta el
dibujo se acelera a 70 milisegundos por cuadro, porque si no la mitad de los
fogonazos caerían entre cuadro y cuadro y no se verían. En plena noche cerrada el
fogonazo muestra el bosque completo por un instante.

Las nubes apagan la luz y le quitan color. La lluvia, además, **cierra la vista**:
la cortina tapa la distancia aunque sea mediodía.

**El cielo vive dentro del mapa**, no en una ventana aparte: se abre con el botón
*mapa* o la tecla `M` y se refresca solo. Arriba, las dos lunas dibujadas y la hora
en palabras; abajo, la estación, la fecha, el tiempo y la marea.

Cada luna se **dibuja**: un disco oscuro y encima la parte iluminada, recortada por
una elipse que se aplasta según la fase. En cuarto la elipse vale cero y queda
media luna exacta; en llena ocupa el disco entero, y el lado iluminado cambia de
este a oeste al pasar la llena.

**El borde dice cuál es cuál**, y sigue el color de su eclipse: ámbar para
Calavera, pálido para Madre. Así el dibujo comunica la fase y el borde la
identidad, sin repetir información. Cuando una está eclipsando, su borde late.

**El tiempo también se ve sin abrir nada:** una franja arriba de la escena es el
día entero del planeta, con los tramos de noche oscuros y el amanecer y el ocaso
en naranja, y un sol o una luna recorriéndola.

**Niebla.** `src/mundo/clima.js`. Un campo que ocupa la grilla, se arrastra hacia
el oeste a unos seis metros por minuto real y reacciona a la humedad. Carga sobre
el tercio oeste del claro.

**No se prende y se apaga**: de madrugada espesa y de día adelgaza, pero nunca se
va del todo. Lo que la hace aparecer y desaparecer en un lugar son los bancos que
pasan, no un interruptor horario.

Al dibujarse se comporta como una nube a ras del suelo: **lava el color de lo que
hay abajo pero no borra ningún glifo**, así que las piedritas y las briznas siguen
ahí, grises. Y **no toca las copas de los árboles**, que quedan por encima de ella.

Es la misma maquinaria que va a usar el fuego cuando se propague.

**La hoguera.** Un objeto en el claro, a cinco metros del punto de partida. Los
leños se dibujan cruzados y la llama se levanta con glifos que cambian cuadro a
cuadro, más angosta y más clara hacia la punta, con chispas que suben. Late con
tres ondas superpuestas, así que no parpadea al azar: respira.

Su luz alcanza dieciséis metros a la redonda y **se suma a la del cielo**: de día casi no
se nota, de noche cerrada es lo único que ves. No solo aclara, entibia: lo que
alcanza se corre hacia el ámbar. No se puede caminar sobre ella.

**Pendiente:** el mundo todavía no tiene costas, así que la marea se calcula pero
no hay agua que suba.

La hora se comunica en palabras —*amanece*, *mediodía*, *cae la tarde*, *noche
cerrada*— nunca en números, igual que todo lo demás.

Las estaciones cambian el aspecto del bosque, los recursos disponibles y los
problemas que aparecen.

---

## 6. El sandbox

El mundo corre sin el jugador. Los NPC tienen tareas propias de mantenimiento del
bosque y las cumplen o no: *la general Myrella Robles lidera un ataque contra los
lobos de la niebla en el sector tal*.

Consecuencias reales:

- Los animales **pueden extinguirse**.
- Si nadie frena a los lobos, **la niebla avanza**, cubre el bosque y llega a la
  ciudad.
- Si eso pasa, el servidor se apaga un día y todo se reinicia.

**Pendiente de decidir:** qué sobrevive al reinicio. Un reinicio que borra todo
castiga; uno que deja huella —ruinas, memoria del bosque, nativas que nacen
sabiendo algo— construye mitología.

---

## 7. El mapa por paneles

El mundo es una cuadrícula de paneles de **100 × 100 metros**. El claro es el
**0:0**. Se nombran con ejes cartesianos: **x crece al este, y crece al norte**.

```
              (0:1) norte
   (-1:0) oeste   [0:0] claro   (1:0) este
              (0:-1) sur
```

Hacia adentro del código la y crece al sur, que es como se dibuja la pantalla.
Las dos coordenadas conviven y se traducen en un solo lugar: `src/mundo/paneles.js`.

**El ruido se muestrea en coordenadas del mundo, no del panel**, así que el
terreno cruza las costuras sin un escalón. Medido en el borde oeste del claro:
cero cambios de tipo en 27 puntos de la juntura.

Los cinco paneles de prueba:

| | nombre | qué hay |
|---|---|---|
| **0:0** | El claro | pasto, arroyo con brazo al este, la hoguera |
| **-1:0** | El bosque viejo | árboles un 55% más altos, un lago, cuatro ruinas de muro, el árbol místico, y una pared de roca viva en el borde oeste que cierra el mundo |
| **1:0** | El acantilado | el brazo del arroyo se ensancha y ahonda hasta el filo. De tierra adentro al mar: tierra pelada, el filo de roca, **el vacío de la caída**, la rompiente y el mar abierto |
| **0:1** | El filo del desierto | bosque frondoso y un corte abrupto, serpenteante, a dunas |
| **0:-1** | Los pinos fríos | pinos que ralean hacia el sur —148 en la mitad norte contra 3 en la sur— y nieve que gana terreno |

**Dos senderos cruzan el mundo entero**, uno de este a oeste y otro de norte a
sur, y se cortan en el claro. Están definidos en coordenadas del mundo, así que
pasan de un panel al siguiente sin juntura: medido, cero desajustes en la costura.
Son de tierra pisada en el medio y de hierba gastada en los bordes, que es como se
hace un sendero de verdad: no lo dibuja nadie, lo gasta el que pasa. Ningún árbol
nace encima. **Donde el sendero cruza el arroyo del claro, el fondo sube y hay un
vado**; en el acantilado no, porque allá el río ya es ancho y hondo y cortar el
paso es lo que corresponde.

Cada panel se genera de su propia semilla derivada de la del mundo, y queda en
memoria. Todavía no guarda lo que cambia: eso llega cuando haya algo que cambiar.

Siguiente paso cuando el mundo esté listo: **10 × 10 paneles**.

---

## 8. Físicas

Simples pero bien logradas: viento, oscuridad, niebla, lluvia, agua, fuego,
movimiento, pelea.

Nota técnica importante: **niebla y fuego son la misma maquinaria** —algo que se
propaga por una grilla y reacciona al viento y a la humedad—. Conviene construirlos
juntos.

---

## 9. El motor de dibujo

### Proyección

La cámara mira el suelo **inclinada**. El eje este-oeste se dibuja ancho y el
norte-sur comprimido; lo que tiene altura se levanta sobre su casilla y tapa lo que
queda detrás. Eso da la profundidad: 2.5D sin tres dimensiones.

Tres niveles de detalle, cada uno con su resolución:

| nivel | caracteres por metro | filas por metro | se ve |
|---|---|---|---|
| 1 · lejos | 9 | 3 | ~60 m |
| 2 · media | 18 | 6 | ~27 m |
| 3 · cerca | 36 | 12 | ~11 m |

Altura: 1,7 filas por cada fila de fondo. Norte arriba, sur abajo, este a la derecha.

**Todo se mide en metros, nunca en filas.** Una brizna mide 45 cm a 1,20 m; el motor
traduce a filas según el nivel. Si algo se escribe en filas fijas, se desfasa al
cambiar de zoom.

### La grilla apretada

El paso de la grilla es **menor que el tamaño del glifo**: 70% del ancho del
carácter y 54% de su alto. Los caracteres se montan unos sobre otros y forman
textura en vez de leerse como letras. Ese solape es lo que hace que de lejos se vea
pasto y de cerca se descubra que son letras.

### Luz

El sol está **al este y bajo**. Todo lo alto tira su sombra hacia el oeste, con
largo proporcional a su altura, y se desvanece hacia la punta. La cara este de los
objetos está iluminada, la oeste casi negra, con **filo duro** entre las dos: un
degradado suave convierte cualquier cosa en una bolita.

Las sombras no solo oscurecen: **ralean**. Lo que está en sombra baja un escalón en
su rampa de densidad.

### Las cuatro reglas del diccionario

1. **Mayúscula** es grande, cerca o denso. **Minúscula** es chico, lejos o ralo.
2. Cada material es una **rampa ordenada de ralo a tupido**; la luz elige el escalón.
3. El extremo ralo de toda rampa es `.` y `,` y eso se comparte. La identidad vive
   en el **extremo denso**, que sí es exclusivo dentro de su capa.
4. Entre capas distintas —suelo, sotobosque, copa— un glifo puede repetirse: la
   altura y el color ya los separan.

### Diccionario en uso

**Suelo**

| material | glifos | nota |
|---|---|---|
| pasto corto | `° *` | `°` rala, `*` tupida |
| pasto largo | `\|` cuerpo, `/` `\` inclinadas | base recta, se curva al subir |
| arena de río | `. : °` | grano fino |
| guijarral | `. : ° o c` | la orilla |
| agua somera | `. - ~` | se vadea |
| corriente | `- ~ =` | se vadea |

**Objetos**

| material | glifos | nota |
|---|---|---|
| piedra grande | `# % 8 0` al sol, `c o :` en sombra, `/ \ _` cantos | perfil escalonado |
| roca madre | `. : ^ A M` más `# %` y vetas `/ \` | estratos horizontales y dos tonos de piedra en manchas |
| tierra | `. , - _ =` con terrones `o` y guijas `°` | grano grueso |
| el vacío | casi nada: `.` y `:` sueltos sobre negro | la caída del acantilado |
| tronco en pie | `t h H` | `H` grueso, `h` medio, `t` fino |
| ramas | `y Y` | |
| tronco caído | `h H` | tendido de este a oeste |

**Copas**

| especie | follaje | borde | silueta |
|---|---|---|---|
| pino | `. : ; * A #` | `. : ^` | cónica, por pisos |
| encino | `. , o e 8 @` | `. , \` o` | ancha y redonda |
| álamo | `. " v o 8` | `. " v` | columnar, se mece mucho |

**Reservado** (acordado, fuera del mundo actual): musgo `° o`, tierra `° *`,
hojarasca `v u`, charco `- = ~`, helecho `f F`, zarza `x X`, hongos `n m`,
juncos `! j`, flores `*`.

### Color

Cuatro familias —verde, corteza, piedra, arena, agua— con **cuatro escalones de luz
cada una**. Nada de degradado continuo: el degradado ensucia y confunde.

### Viento

Una **onda que viaja**: entra por el este y tarda en cruzar, con un ruido lento de
intensidad encima, de modo que hay momentos calmos y momentos racheados. Cada brizna
tiene además su **propia inclinación**, sorteada al nacer y fija. El viento solo
empuja al conjunto.

Las briznas nacen dispersas dentro del metro y con la base repartida en la
profundidad. Si nacen alineadas, el pasto se lee como un campo arado.

---

## 8 bis. Cómo se camina

Tres formas, y las tres conviven:

- **Flechas o WASD**, un paso por pulsación. Mantener apretado camina sin parar,
  un paso cada 130 ms.
- **Tocar la pantalla**: el personaje va caminando hasta ahí, las veces que haga
  falta, rodeando lo que no se puede pisar. Una marca verde late en el destino
  mientras va. Cualquier orden manual corta la marcha.
- **Tocar lo que se tiene al lado** no camina: lo explora, igual que la tecla `E`.

No hay cruceta en pantalla: el toque la reemplaza, y la pantalla queda limpia.

**La interfaz es negra, blanca y de oro viejo**, y nada más: el lienzo tiene todos
los colores del bosque y la interfaz no le compite.

**La barra de información.** Un botón redondo con una `i`, abajo a la derecha
dentro de la escena, abre una barra de cajones justo encima. Al abrir un cajón, la barra se repliega y aparece un cuadro en el medio
de la pantalla, con fondo negro, letras blancas y marco blanco, con una `×` arriba
a la derecha para cerrarlo. Por ahora hay un solo cajón, *Controles*; los cuadros
se declaran en `CUADROS`, dentro de `src/juego/jugar.js`, y agregar uno es sumar
una entrada ahí y un cajón en el marcado.

El camino se busca con A* sobre la grilla de metros, en cuatro direcciones, igual
que camina el personaje. Si el toque cae sobre algo sólido, se busca la casilla
pisable más cercana.

**Cada terreno cuesta lo suyo de andar**, y de ahí sale una conducta que no está
programada: el personaje **usa los senderos solo**. No hay ninguna regla que diga
"seguir el camino"; simplemente andar por tierra pisada es más barato que abrirse
paso entre el pasto alto.

| terreno | coste |
|---|---|
| tierra pisada | 0,55 |
| hierba corta | 0,95 |
| guijarral | 1,05 |
| arena | 1,15 |
| duna | 1,3 |
| pasto alto | 1,45 |
| nieve | 1,5 |
| agua somera | 1,9 |
| corriente | 2,8 |

Medido sobre tres travesías largas del claro: el 35% del recorrido termina yendo
por el sendero, sin que nadie se lo indique.

## 9 bis. El reloj y el guardado

**El mundo tiene su propio reloj y corre sin nadie.** La fecha también: cada 100
minutos reales amanece y el calendario pasa de página. La hora no arranca al entrar:
sale del tiempo real, el mismo que tiene cualquier teléfono. Dos personas que
entran en el mismo instante, en cualquier parte, ven la misma hora, la misma fase
de las lunas, la misma marea y el mismo clima. Y si nadie entra en una semana, al
volver el bosque está siete días más viejo.

El bosque tampoco se sortea: se genera de una semilla, así que es idéntico siempre.

**Lo que se guarda** es la partida de quien juega: dónde está, hacia dónde mira, su
nivel de zoom y si tenía el mapa abierto. Vive en el navegador, así que vuelve
donde lo dejó en ese dispositivo. Al volver, el juego le dice cuánto tiempo pasó
afuera. Con `Mayús + R` se vuelve al claro de partida.

El guardado se descarta solo si cambia la semilla del mundo o si la posición ya no
es pisable: así, cuando el mundo cambie, nadie aparece dentro de un tronco.

**Pendiente:** un guardado de verdad, en servidor, para cuando haya varios
jugadores, muerte permanente y un bosque que recuerda.

## 10. Orden de trabajo

1. Paneles y ciclo de día y noche. Base de todo.
2. Clima y estaciones.
3. Animales: el primer sistema vivo.
4. Niebla y fuego, juntos.
5. Nativas, NPC con tareas propias, Lumivaâri.
6. Lobos y combate, que son consecuencia de lo anterior.
7. Multijugador, mucho después.

**Nota sobre el multijugador:** un mundo compartido, con niebla global, eventos que
corren solos y un servidor que se apaga, ya no es una página estática. Necesita un
servidor de verdad. Todo lo anterior se construye en solitario; el servidor llega
cuando el juego ya sea bueno para uno solo.

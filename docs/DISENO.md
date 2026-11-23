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

**La luz del fuego es continua, y le llega a todo.** El campo de calor vive en
una grilla de un valor por metro (`fuegoEn`), y dibujado tal cual la luz sale en
anillos cuadrados: con dieciocho casillas por metro, cada salto de metro movía el
rojo unos veinticinco niveles de golpe. Por eso hay dos formas de leerlo y no hay
que confundirlas:

- `fuegoEn(gx,gy)` es el dato: un valor por metro. Es lo que escribirá el fuego
  cuando se propague.
- `calorEn(wx,wy)` es lo que se dibuja: interpola entre los centros de los metros
  vecinos. En el centro de un metro da exactamente lo mismo que `fuegoEn`.
  `calorCerca(gx,gy)` es el descarte barato: solo los metros con una hoguera a la
  vista pagan la interpolación.

El **suelo** la calcula casilla por casilla (`prepararFuego` y `afinar` en
`dibujar.js`: nueve valores por metro, interpolación bilineal por casilla). Lo
que se **levanta del suelo** —árboles, rocas, muros— recibe el calor medido donde
pisa, y se lo da `put` a cada glifo que escribe mientras `NV.tinteFuego` está
activo. Cae con la altura: una hoguera a ras del suelo alumbra el pie de un
tronco, no la copa. A `TINTE_ALT` (1,8 m) vale la mitad y sigue cayendo con el
cuadrado. La hoguera no se tiñe a sí misma, y el personaje (ver más abajo) usa
el mismo `calorEn`, así que tampoco ve saltos al caminar.

Lo que **no** hace todavía: la luz no tiene dirección (un tronco se tiñe parejo a
ambos lados, no más del lado que mira al fuego), nada le hace sombra al fuego, y
hay una sola hoguera en el mundo. El tinte de los objetos es solo aditivo; el
suelo, además, sube de escalón de brillo. Cerca del fuego el color ya satura —el
brillo tiene techo (`TECHO`, 1,18) y el aditivo también (1,2)—, así que el
desnivel se ve en el tramo de transición, más allá de unos nueve metros.

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

**La proporción de pasto largo se mezcla en las costuras.** Cada bioma quería la
suya (`UMBRAL_G` en `generar.js`: 0,38 el desierto, 0,56 los pinos, 0,44 el bosque
viejo...) y entre dos paneles saltaba en seco: la costura del desierto tenía un
escalón de 48,8 puntos de pasto largo, peor que cualquier punto natural del prado
(el máximo medido dentro de un panel es 37,5). Ahora el umbral de cada panel es el
suyo en el centro y se acerca al del vecino en los 24 m (`BANDA_G`) pegados a la
costura; en la costura los dos lados valen lo mismo. Escalones medidos en franjas
de 3 m: 5,6 desierto, 11,5 pinos, 1,3 bosque viejo, 2,7 acantilado, todos dentro de
lo que ocurre en cualquier otro lugar del prado.

- Es sólo dibujo del suelo: **no consume el azar del generador**. Se comprobó con
  una huella de los árboles y piedras de los nueve paneles tomada antes del
  cambio: idéntica.
- El claro usaba otra escala de ruido (0,055) que los demás paneles (0,05), así que
  aunque el umbral coincidiera, el dibujo no continuaba al cruzar. Ahora es la misma.
- El corte del desierto **sigue siendo abrupto**, porque el diseño lo pide así.

**La densidad de árboles también se mezcla en las costuras** (decisión de Marcos:
"suavizar bosques"). `densidadArboles(gx,gy,L)` usa el mismo `mezclaPanel` que el
pasto largo, sobre `DENSIDAD_ARBOL`; ya no se pasa `densidad:` a cada llamada de
`arboles()`. Razón media entre un lado y el otro de la costura, contando franjas de
10 m: 2,0× antes, 1,5× ahora (el desierto contra el claro pasó de 2,6× a 1,2×).
Queda una costura más marcada, la del acantilado (2,3×), que tiene otras causas
(río, sendero, `hasta`) y está por investigar.

- **El bosque se sorteó de nuevo una sola vez**: el generador es secuencial, así que
  cambiar cuántos árboles nacen cambia todos. Es la única razón válida para volver
  a tomar la `HUELLA` de `pruebas/costuras.js`.
- Las pruebas que dependían de un árbol concreto (caminar, orilla, fuego-luz,
  costuras) ahora **construyen su propia escena** con árboles sintéticos. Un test no
  debe depender del bosque generado.

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

**El zoom es continuo**: no hay niveles ni escalones, y se puede dejar en
cualquier punto del rango que se le permite al jugador. La escala completa del
motor va de 9 a 72 metros de ancho de pantalla, pero **el jugador sólo recorre del
20 al 40 % de ella**, de 13,6 a 20,7 m (ver más abajo). El truco es que el zoom
**no cambia el tamaño de la letra —que se queda siempre en unos 7,5 píxeles—
sino cuántas letras entran en un metro**: de 42 caracteres por metro bien de
cerca a 6 bien de lejos. Así el mundo crece y se achica sin saltos, y la cantidad
de caracteres en pantalla se mantiene en unos 65.000, de modo que acercarse no
cuesta más que alejarse.

| ancho visible | caracteres por metro | filas por metro | fondo visible |
|---|---|---|---|
| 9 m (0 %, fuera del rango del jugador) | 42 | 14 | 12 m |
| **13,6 m (20 %, el más cerca)** | 27 | 9 | 19 m |
| **16,8 m (30 %, donde arranca)** | 22 | 7 | 24 m |
| **20,7 m (40 %, el más lejos)** | 18 | 6 | 28 m |
| 48 m (fuera del rango) | 8 | 3 | 59 m |
| 72 m (100 %, fuera del rango) | 6 | 2 | 99 m |

(Medido con una pantalla de 1.200 px de ancho.)

#### El rango del jugador: del 20 al 40 % del zoom

Cerca del mínimo (9 m) la letra se ve como un bloque y no hay terreno que mirar;
cerca del máximo (72 m) cada cosa queda en un puñado de celdas y el mundo se
vuelve un mapa. Ni uno ni otro sirve para jugar, así que el motor conserva la
escala completa —9 a 72 m— pero `zoomAbsoluto` sólo deja llegar a una ventana de
ella (`ZOOM_USO` en `lienzo.js`, expuesta como `NV.ZOOM`).

**El porcentaje se mide en escala logarítmica**, no lineal, porque así lee el ojo
un zoom (pasar de 10 a 9 m se siente igual que de 40 a 36). Con la escala
lineal el 20–40 % habría sido de 21,6 a 34,2 m; con la logarítmica es de 13,6 a
20,7 m. Si se quisiera lo otro, cambia la función `enEscala` y nada más.

- El juego **arranca en el medio del rango**, 16,8 m (30 %). Antes arrancaba a
  21 m, que ahora es el tope lejano. Con 7 filas por metro en vez de 6, el
  personaje gana un 17 % de filas, que es de donde sale el detalle.
- La partida guardada con un zoom viejo (45 m, por ejemplo) se recorta al tope al
  cargar; no hace falta migrar nada.
- En una pantalla angosta manda el tope de la pantalla si es menor
  (`metrosMaximos`), pero nunca baja del mínimo del rango.
- La rueda del ratón, `+`/`-` y el pellizco no cambiaron, y ahora recorren un
  rango más corto: de punta a punta son unos siete clics de rueda, y a las
  pruebas de suavidad (`zoom.js`, `suave.js`) les corresponde el nuevo rango.

**Los caracteres por metro son enteros; los píxeles por metro no.** Esa es la
distinción que hace que el zoom se sienta continuo y no a escalones. Cuántas
letras se escriben por metro tiene que ser un número entero —media letra no se
escribe—, pero lo que el ojo mide es cuántos píxeles ocupa un metro, y eso puede
moverse de a poco.

El error estaba en la **altura** de celda, que se calculaba a partir del ancho.
Como las filas por metro también se redondean, cuando pasaban de 2 a 3 el metro
pasaba de medir dos filas a medir tres y el terreno se estiraba un 50% en un
solo cuadro; después 3→4 era 33%, 4→5 era 25%, y al alejarse esos saltos caen uno
encima del otro. Ahora la altura de celda se calcula al revés —de los píxeles por
metro, dividida por las filas por metro—, así la escala vertical del mundo es
continua y lo que cambia con el redondeo es cuánto se solapan las letras entre
filas: textura, no geometría. Medido en todo el rango, el salto mayor pasó del
**18,3% al 1%**.

Dos cuidados más. Los caracteres por metro se eligen con **histéresis**: justo en
el límite entre dos valores el redondeo iba y venía cuadro a cuadro y la textura
titilaba. Y el acercamiento se amortigua en **escala logarítmica**, no en metros,
porque pasar de 40 a 36 metros y de 10 a 9 se sienten igual; con techo de
velocidad del 4,5% por cuadro, así que por más rápido que se gire la ruedita el
zoom planea hasta el destino en vez de resolverse de un salto. Catorce clics de
golpe se recorren en 35 cuadros, y antes se resolvían en 25 con tirones del 15%.

Las filas por metro son siempre un tercio de los caracteres por metro: de ahí
sale la inclinación de la cámara, y se mantiene igual en todo el rango.

**Nada de esto se le muestra al jugador.** No hay botones de nivel ni números: se
acerca con la rueda, el pellizco o las teclas `+` y `−`, y se queda donde lo
dejen.

**La cámara persigue al jugador, no salta con él.** Guarda su posición con
decimales y el dibujo se corre los píxeles que falten, así que caminar se ve como
un desplazamiento y no como un parpadeo de metro en metro. Cuando la cámara
alcanza al jugador y el zoom llega a su destino, el lazo de dibujo se apaga solo
y el juego vuelve a su latido lento.

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

### Las esquinas del mundo

El mundo eran cinco paneles en cruz, pero la cámara se mueve dentro del
rectángulo que los contiene: caminando en diagonal se llegaba a donde no hay
panel y la pantalla quedaba negra. Las cuatro esquinas continúan lo que tienen
al lado, y cada cosa sigue por donde corresponde: **el corte del desierto y la
nieve corren de este a oeste**, así que vienen del norte y del sur; **la costa
corre de norte a sur**, así que viene del este. Las dos esquinas de la derecha
llevan las dos cosas.

El arenal del oeste, la costa seca, los pinos del oeste y la costa helada.
Medido: 1.849 puntos repartidos dentro de los límites de la cámara, ninguno sin
suelo.

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
| pasto seco | `\|` tendido, familia hoja | el filo del desierto |
| pasto nevado | `° *` de manto, con briznas que asoman | entre el pasto y la nieve |
| arena de río | `. : ° ;` con onda corta | grano fino |
| arena de mar | `. : ° =` mojada y oscura | la desembocadura |
| barro | `: , - = ~` con charcos y costra | la orilla que se moja y se seca |
| guijarral | `. : ° o c` | la orilla del río |
| canto de mar | `: ° o c O` más grueso | donde el oleaje revuelve |
| agua somera | `. - ~` | se vadea |
| corriente | `- ~ =` | se vadea |
| lago | `_ = ~` quieto | el bosque viejo |
| mar abierto | `~ = _` con marejada | el acantilado |

**Objetos**

| material | glifos | nota |
|---|---|---|
| piedra, cuatro texturas | granito `o a 0 e 8 9 & # @` · arenisca `- : o 8 %` · pulido `: o 0 8` · basalto `c o a % 8 # H B` | en sombra cada una tiene su rampa propia |
| estrato | `=` y `~`, con filo `°` arriba y socavón `_` abajo | exclusivo: la arenisca perdió el `=` del grano para no tapárselo |
| grieta | `\| !` casi negro | |
| roca madre | `. : ^ A M` más `# %` y vetas `/ \` | estratos horizontales y dos tonos de piedra en manchas |
| tierra | `. , - _ =` con terrones `o` y guijas `°` | grano grueso |
| el vacío | casi nada: `.` y `:` sueltos sobre negro | la caída del acantilado |
| tronco en pie | `t h H` | el camino viejo: árbol místico y arbustos |
| ramas | `y Y` | |
| tronco caído | `h H` | tendido de este a oeste |

**Corteza** (una por especie; es el extremo denso y por eso es exclusiva)

| especie | placa | surco | nudo | refleja |
|---|---|---|---|---|
| pino | `H # %` | `\|` | `0 o` | normal |
| encino | `H % #` | `\|` | `@ 0` | menos: es oscura |
| álamo | `l \| I` | `-` | `o 0` | más: es lisa y clara, con lenticelas `-` |

**Copas**

| especie | follaje | borde | silueta |
|---|---|---|---|
| pino | `. : ; * A #` | `. : ^` | cónica, por pisos |
| encino | `. , o e 8 @` | `. , \` o` | ancha y redonda |
| álamo | `. " v o 8` | `. " v` | columnar, se mece mucho |

**Problema abierto**: el álamo y el encino comparten `8` en el extremo denso, y
la regla 3 pide que el extremo denso sea exclusivo dentro de la capa. Viene de
cuando se eligieron las rampas. `pruebas/arboles.js` lo informa en cada corrida.
Cambiarlo cambia la textura del álamo tupido, que Marcos ya aprobó, así que la
decisión es suya: queda anotado, no arreglado a escondidas.

### Los quince modelos de piedra

Un árbol es tronco más follaje. Una roca es otra cosa: **masa con caras
planas**. Lo que la hace leer como piedra y no como globo es que cada cara
reciba su propia luz —constante dentro de la cara— y que el filo entre dos caras
se vea. Un degradado suave da un almohadón; un escalón da una piedra.

| medida | los tres |
|---|---|
| chicas, medio metro o menos | canto rodado · lajas apiladas · piedra angulosa partida |
| medias, uno a uno y medio | bloque facetado con liquen · piedra hendida en dos · canto medio enterrado |
| grandes, dos a tres | bloque errático de techo plano · roca en voladizo · peñasco de estratos inclinados |
| gigantes del pie de monte, cuatro a siete y medio | torreón de grietas verticales · mole de lomo pulido · amontonamiento de bloques |
| acantilados de la costa | estratos horizontales · columnas fracturadas · repisas y derrumbe |

La categoría la elige la altura y la variante la semilla. Las doce primeras
llevan **silueta**: un perfil que va de la base izquierda, sube por arriba y
baja a la base derecha, en fracciones del alto.

**La silueta se parte en cadena izquierda y cadena derecha.** El punto más alto
la corta en dos y para cada fila se interpola una x en cada cadena. Tomar el
mínimo y el máximo de todos los cortes, que es lo primero que se hizo, rellena
las concavidades y mata el voladizo. Con cadenas el voladizo existe: medido, la
masa de la roca en voladizo mide 29 celdas en lo más ancho y 20 al pie.

**El grano va en dos octavas**: un manchón grande que le da forma y un temblor
celda a celda que lo desarma. Con una sola octava en bloques, la piedra salía a
cuadros, con tiradas de tres glifos iguales seguidos. Medido, el largo medio de
una tirada quedó entre 1,55 y 1,69 celdas.

**La silueta se lee por el color, no por un contorno.** Antes se dibujaba con un
paréntesis en cada fila y salía un caño. Ahora el oeste va casi negro y el este
encendido: medido, el tercio este de una piedra es tres veces más brillante que
el oeste.

**El filo entre caras se quiebra fila a fila.** Derecho era una raya de regla.

Las gigantes **ocupan lo que miden**: una de seis metros es casi ocho de ancho,
así que se marca todo su pie como macizo y no se puede pasar por adentro. En un
bosque cerrado casi nunca hay ocho metros libres seguidos, así que se insiste
hasta diez veces por cada gigante que se quiera plantar.

#### El acantilado: muro sintetizado

Los acantilados no llevan silueta dibujada a mano. Un muro de dieciséis metros
son más de doscientos caracteres de ancho, y una silueta a mano ahí da un panel
plano con tres bandas. Se sintetizan, y se dibujan en **tajadas**: una por cada
metro de norte a sur, cada una subiendo los metros que le toca. El ruido se
muestrea en coordenadas **del mundo** a lo largo del eje del filo, así que dos
tajadas vecinas calzan y la cara sale continua, sin que se note el molde —medido,
el salto mayor entre vecinas es de 0 a 6 filas sobre paredes de 7 a 12 metros—.
Donde el ruido sube hay un contrafuerte que recibe luz, donde baja hay una
canaleta en sombra: eso es lo que le da volumen a una pared.

Estratos y repisas van a altura **absoluta**. Atados a una fracción del borde de
arriba, que varía tajada a tajada, se corrían de fila en fila y se deshacían en
una franja de basura.

**Problema abierto: no hay dónde ponerlos todavía.** El dibujo está hecho y
probado, pero el filo de la costa corre norte-sur, y la cámara mira al norte: de
cualquier pared norte-sur se ve el canto este o el oeste, nunca la cara. Y la
cara del acantilado de la costa queda **por debajo** del filo, así que desde la
meseta no se ve: se ve el borde de roca y después el vacío. Una cara de
acantilado sólo se ve en esta proyección si mira al **sur**, hacia la cámara, lo
que pide una de dos cosas: que la costa doble y haya un tramo que corra
este-oeste, o que se pueda caminar por la playa al pie del paredón. Las dos son
decisiones de mundo, de Marcos, no de código.

### Los nueve modelos de árbol

Cada especie tiene **tres modelos**, y el árbol elige el suyo por su semilla.
Están en `MODELOS`, en el diccionario, y se miden en **fracciones del alto**, no
en metros: el generador sortea la altura y el modelo se estira solo, así el
mismo modelo sirve para un pino joven y para uno del bosque viejo.

| especie | los tres |
|---|---|
| pino | joven cerrado hasta abajo · adulto de fuste limpio · viejo descopado |
| encino | copa en dos lóbulos · bifurcado desde abajo · viejo de copa despareja |
| álamo | columnar joven · adulto de copa en llama · ladeado por el viento |

Un modelo dice: el grosor del tronco al pie, cuánto mide la copa a lo ancho,
hasta dónde sube el tronco antes de abrirse (la **horqueta**), hasta dónde sigue
la guía central afinándose, cuánto se corre el eje, a qué alturas quedaron
**nudos** —cicatrices de ramas caídas— y a qué alturas hay una **rama seca**.
Después, según la especie: el pino reparte sus ramas en **pisos** que caen, el
encino lleva una rama y una mancha de follaje por **lóbulo**, y el álamo apila
manchas angostas en **columna**.

Cuatro cosas hacen el realismo:

**La corteza son crestas verticales.** El glifo lo elige la columna, no la
celda, y se mantiene varias filas seguidas; cada tanto se corta y empieza otra.
Antes se sorteaba celda por celda y salía estática. El surco va más oscuro que
la cresta. Medido: la corteza repite el glifo de su columna en el 58% de las
filas en el álamo y el 84% en el pino; con ruido celda por celda eso daría un
tercio.

**Los nudos** llevan reborde: oscuro en el centro, con un filo claro arriba
donde pega la luz y una sombra abajo. Es lo que los hace leer como bulto.

**Las ramas tienen grosor que se afina**: dos o tres celdas junto a la horqueta,
una en la punta. Entran en la mancha de follaje y mueren adentro, así lo que
queda a la vista por debajo de la copa es corto y no un abanico de barras.

**El follaje son manchas separadas con cielo entre medio**, y los huecos se
agrupan por bloques en vez de salir salpicados como sal y pimienta. Cada especie
tiene su densidad: la aguja del pino es masa tupida y oscura, la hoja del álamo
es rala. Medido, la caja de la copa queda llena entre el 30% y el 46% según la
especie.

**El orden de dibujo hace el trabajo sin llevar cuenta de nada.** Dentro de una
capa, lo último que se escribe tapa lo anterior. Así que primero va el tronco de
arriba de la horqueta y las ramas; después el follaje, que los tapa donde es
tupido y los deja asomar por sus huecos —y eso es exactamente cómo se ve el
esqueleto de un árbol—; y al final el tronco de abajo de la horqueta y los
nudos, que no los tapa nada porque son lo que sostiene al árbol.

El follaje es el lazo más caliente del juego: una copa son miles de celdas y hay
decenas de copas por cuadro. Sin cuidado costaba 31 ms por cuadro contra los
16 de antes. Tres tablas lo bajaron a 19: la caída de densidad indexada por la
distancia **al cuadrado** (se evita una raíz por celda), la curva de cada
especie resuelta de antemano (eran dos `Math.pow` por celda, lo que más costaba)
y el azar de los huecos sorteado por bloque y por fila en vez de por celda.

**Reservado** (acordado, fuera del mundo actual): musgo `° o`, tierra `° *`,
hojarasca `v u`, charco `- = ~`, helecho `f F`, zarza `x X`, hongos `n m`,
juncos `! j`, flores `*`.

### El agua

El agua no es una textura: es una **superficie con altura**. Todo sale de un
campo de olas —la suma de dos o tres sinusoides que viajan, más ruido para que
el frente no salga peinado— y de ahí se deducen las tres cosas que la hacen
leer como agua:

- la **altura** elige el glifo: cresta tupida, valle liso;
- la **pendiente hacia el este** decide dónde pega el reflejo del sol;
- la **espuma** aparece donde la cresta es alta **y** empinada a la vez.

Sólo alta da una tela corrugada. Y el reflejo es lo que más vende el agua: sin
él, cualquier campo de ondas parece tela. Eso era exactamente el agua de antes,
una sinusoide de densidad sin brillo.

Nueve estados: agua tranquila, orilla de lago, somera, río, río profundo, mar en
calma, mar con olas, mar con tormenta y la rompiente. **El mar cambia de estado
con el tiempo que hace** —según la intensidad de la lluvia y la amplitud de la
marea—, así que no hay que elegirlo a mano en ningún lado.

El agua se resuelve **celda por celda**, no por metro: es lo que le da la onda
continua. Para que eso no cueste el cuadro, el motor lleva una tabla de 1.024
senos; el error de redondeo es menor que el salto entre dos glifos.

#### La orilla es un campo, no una letra por metro

El mundo guarda una letra de suelo por metro, así que la costa salía en
escalones de un metro. Ahora la orilla se **calcula**: se arma una máscara por
metro (agua = 1), se suaviza con el filtro binomial [1,3,3,1] en cada eje sobre
cuatro metros, y dentro de cada metro el valor se interpola. La costa es el
contorno en 0,5, con un poco de ruido **del mundo** para que no salga de regla.
Medido en tres pendientes: irregularidad de 0,31–0,35 m a 0,13–0,16 m, y el
salto mayor entre columnas vecinas de 0,84–0,98 m a 0,12–0,19 m.

La distancia al borde se saca en **metros** (el valor del campo dividido por la
norma de su gradiente, con piso en 0,12), no en unidades del campo: en unidades
del campo la franja de espuma engordaba en las diagonales.

- **Espuma**: banda de 0,13 a 0,22 m del lado del agua. Con 6 filas por metro
  son una o dos filas: es fina a propósito.
- **Arena mojada**: 0,24 m del lado de tierra, a 0,72 de luz. Medido, la tierra
  pegada al borde recibe el 74 % de la luz de la de más adentro.
- **No hay orilla donde hay caída**: si una `V` cae en el 3×3, no se calcula (la
  base de un acantilado no es playa).

#### Reflejos en el agua

Los árboles, rocas y la hoguera se reflejan en el agua. Cuando un objeto
reflejable se dibuja, el lienzo **graba** lo que `put` escribe (`NV.grabar`,
tope de 60.000 casillas por cuadro); después `dibujarReflejo` lo espeja respecto
de la fila de su base, **sólo sobre metros de agua**, en la capa 1 (entre el
suelo y los objetos).

- Las olas lo cortan y lo corren de lado; se apaga hacia la punta (`f` va de 0,85
  a 0,25 del pie a la copa).
- El color se enfría y se oscurece, y el brillo propio del agua se escala por la
  luz ambiente: de noche no hay reflejo más claro que el árbol.
- La capa 1 la lava la **niebla**, igual que lava el agua de al lado. Por eso la
  prueba la apaga: si no, la niebla tapa lo que se quiere medir.

**Lo que no hace**: el personaje no se refleja (no pasa por `drawTree`); no hay
luz direccional, así que el reflejo no depende de dónde esté el sol; los valores
de brillo (0,34/0,44/0,62 y los desfases 4/9/18) son estimados a ojo, no medidos
contra nada.

#### Dónde van los acantilados: las mesetas

Con altura real (ver "La altura", más abajo) el problema de arriba se resolvió **sin
cambiar la costa**: los acantilados son los bordes de **mesetas**, tierra alta de unos 5 m
repartida por el mundo, y se ven porque la cámara mira al norte y el borde sur de una meseta
mira hacia ella. Un borde de meseta baja hacia el sur como **pared** (`duro`, 1,2 m de ancho:
se dibuja de roca y no se pisa) o como **rampa** (`suave`, 24 m: se dibuja de suelo y se
sube andando), según un ruido que cambia a lo largo del borde (`MESETA` en `paneles.js`).

- Una meseta es donde un ruido de unos 45 m pasa de `corte` (0,63): alrededor del 8 % del
  mundo es meseta alta. El claro del centro (a menos de 60 m del punto de partida) no tiene.
- **Qué es pared lo decide un solo número**, `MESETA.pared` = 0,6 m de desnivel por metro:
  el metro es sólido (`NV.paredEn`, incluido en `NV.solidoEn`) y la cara se dibuja de roca
  (`caraDeRoca`). Lo que se ve como pared no se pisa y lo que se pisa no se ve como pared.
  La rampa más empinada que se camina llega a 0,6; por eso `suave` es 24 y no 9.
- **La cara es la roca madre** (`M`, glifos `. : ^ A M`) en **estratos a altura absoluta**
  (no se corren de columna a columna) y dos tonos de piedra en manchones.
- Medido: desde 68 % de los puntos de meseta se baja caminando. El resto son **mesetas
  aisladas**, rodeadas de pared por todos lados: quedan de escenografía. No es un error, pero
  si molesta se arregla forzando una rampa por meseta.
- La caída al mar de la costa este (`V`, el vacío) sigue como estaba: es un vacío, no un
  acantilado con altura.
- `pruebas/acantilados.js`.

### La textura del suelo

El suelo se sorteaba celda por celda: cada celda sacaba su densidad de un hash
propio. Eso da **estática**. La arena de verdad tiene ondas, la tierra tiene
terrones y grietas, el pasto crece en matas y la nieve se acumula en manchones,
y un hash por celda no puede dar nada de eso, porque todas esas cosas son
**coherencia espacial**.

Ahora la densidad sale de un ruido suave de dos octavas —un manchón grande que
le da forma y un temblor fino que lo desarma— más lo que cada material tenga
propio: la onda de la arena, el terrón y la grieta de la tierra, el charco y la
costra del barro, el calibre del canto rodado, la mata del pasto y el manto de
la nieve.

**El ruido se muestrea en metros del mundo, no en celdas.** En celdas la textura
cambiaba de tamaño con el zoom —porque los caracteres por metro cambian— y
además quedaba estirada tres veces a lo alto, porque un metro son CPM columnas
pero sólo RPM filas.

Dos cosas que hay que recordar al agregar un material:

- **El largo de una onda va en metros.** Puesto en celdas da un período de dos
  caracteres, que no se lee como onda sino como alternancia.
- **El umbral de una grieta tiene que ser chico.** Una grieta es una línea fina:
  con 0,06 toma una celda de cada diez y la tierra queda enrejada.

Medido: el largo medio de una tirada de glifos iguales va de 2,4 celdas en la
arena de río a 9,4 en la duna, donde la tirada larga *es* la onda. Y el pasto
sale con un desvío del 13% de briznas entre un metro y otro, en vez de parejo
como una cancha.

#### El relieve: lomas que sólo se ven por la luz

El mundo es plano —ningún panel guarda altura— y un suelo plano se ve igual de
iluminado en todas partes: ahí se notaba que el paisaje quedó atrás de
Myrella, que sí tiene luz de lado. El relieve es un campo de altura suave
(`NV.relieveEn`, dos octavas, onda de unos 28 m, en **metros del mundo**) que
**no cambia dónde se camina ni dónde va nada**: sólo decide cuánta luz recibe
cada metro de tierra. La pendiente que sube hacia el este mira al oeste, de
espaldas al sol, y queda en penumbra; la que baja hacia el este se ilumina
(`NV.luzRelieve`, de 0,72 a 1,28, promedio 1,00).

- El agua **no lo usa**: sus ondas ya llevan su propia luz.
- Se consulta **una vez por metro**, igual que el resto de la luz del suelo.
- Medido en un pasto parejo: lo que mira al oeste queda al 90 % de la
  luminosidad sin relieve, y lo que mira al este sube al 120 %. Entre metros
  vecinos el salto mayor es de 0,088, así que no hay escalones.

Los valores `ganancia`, `piso` y `techo` están en `RELIEVE` y son estimados.

#### La altura: el relieve hecho geometría (etapa 1: se dibuja, no se camina)

El relieve de arriba sólo sombreaba. Ahora el mismo campo **sube** el terreno:
`NV.alturaEn(x,y)` da **metros sobre el agua**, siempre ≥ 0, de 0 a unos 2,1 m
(`NV.ALTURA`: `amp` 5, `ribera0` 2 m, `ribera1` 14 m). Se aplana hacia el agua —cero a
menos de 2 m de una orilla, entero a más de 14— para que playas, riberas y el nivel
del agua queden como estaban. Se interpola entre metros enteros: en 25 cm no salta más
de 6 cm. La luz de la ladera y la altura salen del mismo campo, así que cuentan lo mismo.

**Cómo se dibuja.** Cada columna de celdas de cada metro sube `altura × HPM` filas
(`fijarAlza`, medido en la línea media del metro; `colAlza` en el motor). Todo lo que
se escribe con `put` pasa por ese desplazamiento: el suelo por columna, y cada objeto,
personaje y marcador de destino por un `alzaR` fijo, medido donde está parado.

- **Cara de la pendiente.** Donde el terreno baja hacia el sur queda un hueco entre un
  metro y el siguiente; `rellenarFrente` lo llena con el mismo suelo estirado hacia
  abajo (filas del propio metro, de atrás hacia adelante, para no repetir una raya).
  Donde sube hacia el sur, el de al sur simplemente tapa.
- **Orden de pintado.** La regla de capas (`fbL`) dejaba pasar a un árbol por delante de
  una loma que está al sur. Ahora cada celda guarda además la fila de metros que la
  escribió (`fbO`, `ordR`) y manda primero eso: lo del sur tapa lo del norte aunque sea de
  otra capa; dentro de una fila siguen valiendo las capas. Las pasadas de pantalla
  (lluvia, niebla) escriben con el orden máximo. El reflejo se escribe con el orden de la
  fila del agua donde cae, si no el agua de esa fila lo borraría.
- **La vista sube con el jugador** (`NV.camAlz`, amortiguado al 12 % por cuadro). Sin
  eso, al trepar una loma el jugador se iría hacia el borde de arriba. Se aplica entero
  en filas (`liftR`) y la parte fraccionaria en píxeles (`desplaceY`).
- **Metros de más.** Al norte se dibujan los que baja la vista, y al sur los que sube la
  loma más alta de la franja de abajo (se muestrea). En un llano son dos de cada lado.
- **Tocar la pantalla** (`NV.casillaEn`) deshace todo esto: busca el metro **más al sur**
  cuya franja (más su cara) contiene la celda, porque es el que se ve.
- La grabadora de reflejos anota las filas **sin** alza ni vista; el reflejo vive en el
  espacio sin desplazar. Consecuencia conocida: el reflejo de algo sobre una loma
  sale como si estuviera al nivel del agua. Cerca del agua la altura es cero, así que no
  se nota.
- Costo medido: un cuadro cuesta alrededor de un 10 % más que antes de la altura.

**Qué NO hace todavía (etapa 2):** no cambia dónde se camina, ni la velocidad, ni la
colisión: Myrella sube y baja la loma pero el paso es el mismo, y la sombra de un
árbol no sigue la pendiente. Los acantilados son los bordes de las mesetas (ver más arriba). Las pruebas que
miden otra cosa sobre un suelo inventado fijan `NV.alturaEn=()=>0`; la altura tiene la
suya (`pruebas/altura.js`).

#### Detalle suelto: flores, guijarros y hojarasca

Un pasto de pura brizna es un verde parejo que no tiene nada que mirar de cerca,
y con el zoom nuevo (13,6 a 20,7 m) se mira de bastante cerca. El pasto corto lleva
ahora tres detalles, el pasto largo y el seco dos (`DET` y `detalle` en el
diccionario):

| detalle | glifo | color | dónde |
|---|---|---|---|
| flores | `+` | `flor` (rosa) o `hoja` (ocre) | pasto corto |
| guijarros | `o` | `piedra` | pasto corto, largo y seco |
| hojarasca | `,` | `hoja` o `hongo` | pasto corto, largo y seco |

- **Salen en manchas**, de un solo color cada una, con un ruido en metros del
  mundo (la mancha de flores mide unos 2,6 m, la de guijarros 4,5). Medido contra
  la misma cantidad repartida al azar: el índice de dispersión por metro es de
  2,6 contra 1,0 en las flores, 2,3 contra 1,1 en los guijarros y 3,9 contra 0,9
  en la hojarasca.
- **La densidad es por metro cuadrado, no por celda.** Por celda, acercar el zoom
  llenaba el prado de flores. Medido en los mismos metros a los dos extremos del
  zoom: 1,43 contra 1,44 flores por m², 0,19 contra 0,18 guijarros, 1,36 contra 1,41
  de hojarasca.
- **No van en los metros que tocan otro material.** Ahí las celdas pueden ser de
  la arena o del agua de al lado y una flor en el agua no se puede. Se comprobó
  con una costa: cero detalles en el agua y cero en el metro que la toca, y sí en
  el metro de al lado.
- Siguen la luz: de noche una flor pasa de luminosidad 150 a 29.
- Glifos por la regla 3: `+` no lo usaba ningún suelo, `o` ya era la identidad
  del guijarral y `,` es el extremo ralo compartido.
- Cuesta lo mismo que no tenerlo: 10,2 ms contra 10,8 ms un cuadro de pasto, medido
  en el navegador simulado.

**Lo que no es**: son celdas del suelo, no objetos. No se pisan ni se pueden
recoger, y no se mecen con el viento como las briznas. Un primer ajuste tuvo
manchas que casi no se formaban (flores a 0,30 por m² en vez de 4): `tex2` se
concentra cerca de 0,5 y casi ninguna celda llegaba al centro de la mancha. Por
eso existe `borde`, que fija qué tan rápido satura.

### El borde entre dos materiales

Éste es el defecto que más se nota y el que ninguna textura arregla, porque no
está en la textura sino **en dónde se toma la decisión**.

El motor decide el material por **metro**: `sueloEn` devuelve una letra por
metro y después se rellenan las CPM×RPM celdas de ese metro con ella. Mientras
la orilla es recta no se nota. En cuanto el río dobla, el borde sale como una
**escalera de un metro de paso**: diez o catorce caracteres por escalón.

La salida: en los metros que tocan a otro material —y sólo en ésos, que son
pocos— se decide **celda por celda**. Cerca del límite se sortea entre el
material propio y el del vecino, con probabilidad según de qué lado cae la
celda. El borde deja de ser una línea y se vuelve una franja entreverada de unos
centímetros, que es como se entreveran de verdad la arena y el guijarral. Del
lado del pasto, el material de al lado asoma por debajo de las briznas.

Medido sobre la orilla del arroyo del claro: decidiendo por metro, el **100%**
de los bordes cae clavado justo donde empieza un metro, porque es ahí donde
cambia la letra. Decidiendo por celda, el 13%, contra el 8% que daría el puro
azar. El borde se soltó de la grilla.

**El metro sigue mandando** para caminar y para el camino que busca el personaje.
Lo que cambia es sólo quién decide el color de cada letra.

Las tres filas de material que hacen falta —la de arriba, la propia y la de
abajo— se traen una vez por fila. Preguntándolas de nuevo por celda, el cuadro
pasaba de 24 a 31 ms, porque cada consulta busca su panel.

### Los personajes

Un personaje es **cualquier cosa que se para en una casilla**, se dibuja con un
sprite, camina, mira hacia un lado y tiene nombre: el jugador, una nativa, un
lobo, un animal. Todo lo que costó afinar vive en `src/juego/personajes.js` y
no en el dibujo del jugador, así que **un personaje nuevo nace con todo hecho**:

- se dibuja entre casillas, interpolando el paso;
- la animación avanza por distancia caminada y funde un cuadro con el siguiente;
- lleva contorno, para despegarse del pasto;
- lleva sombra propia, que se estira al oeste;
- recibe la luz del cielo, la de las lunas y la del fuego que tenga cerca, y
  nunca se apaga del todo;
- lleva su nombre encima;
- y si el arte no cargó, se dibuja una figura de respaldo.

Un personaje es un objeto llano —`{arte, nombre, alto, x, y, desdeX, desdeY,
ultimoPaso, pasoMs, andado, mirando, zancada, color}`— y `NV.personajes` es la
lista de los que no son el jugador. El bucle de dibujo los pone en la fila que
les toca, igual que a los árboles, así que el que está más al sur tapa al que
está más al norte. El jugador es uno más: `jugar.js` lleva su estado y el
dibujo lo refleja.

#### Hacia dónde mira

**No se saca del último paso.** Un camino en diagonal sale en escalera —este,
norte, este, norte— y mirando sólo el último paso la dirección cambia cada 186
ms, así que el dibujo alterna entre el juego de poses del este y el del norte
sin parar. Eso es lo que se ve como poses sueltas que no vienen a cuento.

Se mira el desplazamiento **neto de los últimos cuatro pasos**, que en una
escalera apunta en diagonal y se queda quieto en el eje que más manda, con
**histéresis** —cuesta más salir del eje en el que ya está que quedarse— porque
una escalera perfecta empata y sin eso oscila. Y **darse vuelta cambia en el
acto**: es deliberado, y sin esa salida el personaje camina de espaldas tres
pasos hasta que la ventana se da vuelta.

Medido: una escalera al noreste, cero cambios de dirección en ocho pasos; una
vuelta en U, uno solo.

#### La luz de un personaje

Tres cosas se suman, y ninguna estaba:

**La del cielo, con piso.** Nunca baja de 0,16: de noche el personaje se ve
oscurecido, no desaparecido. Sin piso, a 0,07 de luz ambiente la figura era un
agujero negro.

**Ganancia de 1,34.** El arte viene con colores oscuros —verdes y ocres de
bosque— mientras que el suelo se pinta con los escalones más claros de su
familia. Sin ganancia el personaje queda la mitad de brillante que el pasto y
se lee como una sombra. No es aclararlo: es compensar que compite contra una
paleta que ya está en su escalón más alto.

**La del fuego.** Se mira el calor donde está parado —continuo, con `calorEn`, así
que caminando no salta al cruzar de un metro a otro— y se suma luz anaranjada, con
tope. El calor crudo llega a 2,4 al lado de la hoguera; sumado tal cual
multiplicaría la luz por más de uno y medio. Medido: de noche, al lado de la
hoguera el rojo pasa de 0,21 a 0,83, y queda casi el doble que el azul.

**Y las lunas ya alumbraban**, en el ambiente del cielo: medido, la noche más
clara tiene 0,52 de ambiente con las lunas altas y la más oscura 0,14 sin
ellas.

**El resplandor propio suma, no multiplica**, y es más fuerte cuanto más oscuro
está: 0,156 de noche contra 0,058 de día. Un seis por ciento de casi nada sigue
siendo casi nada, y de noche es justo cuando hace falta.

### El arte: de imagen a glifos

El arte de los personajes y las criaturas entra como **imagen**, no como ASCII,
y la diferencia manda. Un pack ASCII viene dibujado a un solo tamaño; al
achicarlo se deshace, porque **un glifo no se promedia**. Una imagen se achica
sola y se convierte a glifos al tamaño que haga falta, así el mismo dibujo sirve
de cerca y de lejos. Es lo que hace `src/motor/sprites.js`.

En la imagen van separadas **dos cosas que el ASCII trae pegadas**: el color de
la celda, en RGB, y la cobertura de su glifo, en el canal alfa. Al achicar, el
color se promedia pesado por su cobertura. Si se hornea la tinta dentro del
color, la figura se oscurece dos veces y queda un boceto apagado: fue el primer
intento y no servía.

El glifo lo elige el **brillo**, no el glifo que traía el original, como manda
la regla 2 del diccionario. El arte que llega de fuera usa los glifos como
decoración, y por eso se lee como ruido en vez de como volumen.

**Cada celda de un sprite se pinta con fondo además de letra.** Un glifo ralo
deja la celda casi vacía: el fondo es lo que le da masa a la figura. Sin él, un
personaje dibujado con puntos y comas no se ve sobre el negro. El fondo de
pantalla entera se probó y se descartó por costo; acá son los mil rectángulos de
un personaje y no los sesenta mil de la pantalla.

**La animación avanza por distancia caminada, no por reloj**: una zancada entera
cada 2,4 metros. Atada al reloj, las piernas van a su ritmo mientras el
personaje patina por el pasto.

**El personaje se dibuja entre casillas.** Camina de a un metro, pero dibujarlo
saltando un metro entero son dieciocho columnas de un cuadro al otro: no camina,
desaparece y reaparece más allá. Se guarda de qué casilla salió y el dibujo
interpola con el tiempo transcurrido del paso. Medido: a lo largo de un paso se
dibuja en once columnas distintas, con saltos de 1,7 columnas en vez de 18.

Y la fase de la animación incluye esa misma fracción. Contando sólo los metros
enteros, la pose se congelaba 186 ms y después saltaba una pose y media de
golpe: eso era el pie que se teletransportaba a la pierna extendida.

El lazo de dibujo sigue corriendo mientras el personaje está entre dos
casillas, aunque la cámara ya haya llegado.

**Un cuadro se funde con el siguiente.** La fase es continua, no un número de
cuadro: el motor dibuja la pose de ahora entera y la siguiente con
transparencia. Un sprite salta de pose en pose, y a esta resolución eso se lee
como si el personaje desapareciera y apareciera en otro lado. Fundidos, las
celdas se encienden y se apagan de a poco. La mezcla va en cuartos para que la
memoria no se dispare, y la memoria se limpia cuando cambia el tamaño pedido.

**El color NO se divide por la cobertura al leerlo.** `getImageData` ya devuelve
el color sin premultiplicar: el navegador mezcla en premultiplicado al achicar y
lo deshace al leer. Volver a dividirlo por el alfa —que es lo que hay que hacer
en una herramienta que mezcla a mano, y de ahí vino el error— lo multiplica por
dos y medio y deja al personaje gris claro.

Por lo mismo, **el piso de la cobertura en la hoja no puede ser bajo**: con alfa
chico, el redondeo de ocho bits que deshace el navegador se amplifica y salen
motas casi blancas por toda la figura. El piso es 0,42.

**La figura lleva contorno.** Las celdas vacías que tocan una celda dibujada se
limpian, así entre el personaje y el pasto queda una línea de fondo y la silueta
se despega en vez de confundirse con la hierba. Y lleva un resplandor del 6% en
un radio corto, apenas para remarcarla; más que eso parece que lleva linterna.

**En reposo se está QUIETA.** Una persona parada no se balancea sin parar: se
queda quieta un rato largo y de golpe cambia el peso de pie o mira a un costado.
El ciclo dura catorce segundos y el 74% es el primer cuadro, sin moverse. El
pack viene con ocho cuadros de reposo pensados para encadenarse a cinco por
segundo, y así se lee como si girara sobre sí misma.

**Los ocho cuadros se usan casi siempre.** Se habían recortado a dos y cuatro
para matar el temblor que daban los movimientos chicos del reposo al redondearse
a celdas enteras, pero eso lo resuelve la fundición: fundidos, las celdas se
encienden y se apagan de a poco en vez de prender y apagar. Sólo por debajo de
doce filas se recortan, donde ni fundiendo alcanza.

**La sombra del personaje** es una mancha a los pies que se estira al oeste
sobre varias filas y se afina con la distancia. De una sola fila y tres metros
de largo, como estaba, se leía como una barra gris tirada en el pasto.

El arte lleva su propio sello en el cargador —`?a=1`, que se sube a mano al
regenerarlo— porque pesa cientos de kilos y pedirlo con la hora, como al código,
lo bajaría entero en cada carga.

`taller/pack2hoja.py` convierte un pack `ascii-sprite-v1` en la hoja de imagen
más su manifiesto. Lo que el pack traiga flojo se corrige ahí: una curva de tono
levanta los claros y deja los oscuros, así la figura se despega del fondo.

### La interfaz

Dos reglas de forma, y la primera pesa más que todo lo demás.

**El mundo llega a los bordes.** No hay encabezado ni pie. Una página web tiene
encabezado, contenido y pie; un juego ocupa la pantalla entera y flota sus
paneles encima, pegados a las esquinas. Mientras el lienzo estuvo metido entre
dos barras, esto se leyó como un sitio por más que el color fuera el correcto.
Arriba a la izquierda, dónde estás y cómo está el día; arriba a la derecha, el
mapa; abajo a la izquierda, la estación y la fecha; abajo a la derecha, el botón
de información.

**Nada redondo, nada suelto.** Esquinas cuadradas, filetes de un píxel, letra de
nueve a once y relleno de dos a cuatro. La densidad es parte del aspecto: un
panel que respira es un widget, uno apretado es un HUD.

La interfaz sigue siendo HTML y no se dibuja adentro del lienzo. Se puede hacer
que el HTML parezca la grilla, y así se conservan los botones que se pueden
tocar, el texto nítido y —sobre todo— que un cambio de interfaz llegue al
instante sin esperar los diez minutos de la caché.

**Lo que no se copia de otros juegos del género**: el HUD lleno de números —vida,
maná, nivel, experiencia—. Acá no se muestran por diseño, y eso no es una
carencia: las esquinas dicen otras cosas, que son más difíciles de hacer bien y
más propias de este mundo.

**Pendiente**: el oro todavía hace de estructura. Tiene que bajar a acento —gris
apenas visible para los marcos, oro sólo para lo que está activo o lo que
importa— porque la escena es oscura con destellos cálidos, y el fuego, el sol
bajo y el tinte rojo del eclipse son información. Si el marco ya es dorado, esa
señal compite con la decoración.

### Color

**El multiplicador del brillo tiene techo** (1,18). Cuando la luz pasa de uno,
`step()` ya elige el escalón más claro de la familia; si además se sigue
multiplicando, el color se va a blanco y se pierde el dibujo. Pasaba con la cara
iluminada de las rocas, que llegaba a 1,67, y con el personaje, al que se le
aplicaba una curva de tono que la hoja ya traía.

**Toda textura se indexa en coordenadas DEL OBJETO, nunca de la pantalla.** Es
la trampa que más veces cayó. El grano de la piedra usaba la columna y la fila
de pantalla: al caminar, los manchones se arrastraban por encima de la roca, y
al hacer zoom la piedra parecía otra. Lo mismo vale para el muro del acantilado
—que se mide a lo largo del filo y en metros de altura— y para el suelo, cuyo
ruido va en metros del mundo. `pruebas/rocas.js` dibuja la misma piedra desde
dos cámaras y exige que salga idéntica.

Cuatro familias —verde, corteza, piedra, arena, agua— con **cuatro escalones de luz
cada una**. Nada de degradado continuo: el degradado ensucia y confunde.

**Referencia de atmósfera: bosque antiguo, frío y oscuro** (Ansenjeo). Los verdes
son azul-verdosos casi negros y **solo el escalón más alto de cada familia llega a
menta**; así el pasto claro resalta contra la sombra en vez de que todo sea verde
medio. Cortezas, tierra y hojarasca se desaturan hacia gris pardo; la piedra se
enfría hacia gris azulado. El suelo tiene más contraste (`lp` va de 0,58 a 1,38:
charcos de sombra y claros) y las puntas de las briznas llevan más luz que la
mata (×1,3 contra ×0,95). La arena es gris azulado de luna y el hongo gigante pálido y frío: eran lo único
beige que quedaba. La piedra mezcla dígitos y letras (`a e 9 & @`) en el medio de
la rampa, como la piedra de la referencia; el extremo denso sigue siendo
exclusivo (regla 3). Las sombras de árboles y rocas son más largas y hondas
(`0,16 + 0,66·d` en `calcularSombras`, antes `0,32 + 0,58·d`).
Los troncos son más gruesos (×1,7 encino, ×1,5 pino, ×1,35 álamo) y las copas
más ralas (`umbral` y `gamma` subidos en pino y encino): el bosque viejo se lee
por el fuste ancho, no por la copa. El árbol místico (`hueso`) es pálido de luna.
Hay dos menhires en los gigantes (`gig-4`, `gig-5`): columnas angostas de 5 a 6 m.
Si algo se ve «primavera», casi siempre es un verde
saturado de brillo medio: bajarlo, no subir otro color.

### Viento

Una **onda que viaja**: entra por el este y tarda en cruzar, con un ruido lento de
intensidad encima, de modo que hay momentos calmos y momentos racheados. Cada brizna
tiene además su **propia inclinación**, sorteada al nacer y fija. El viento solo
empuja al conjunto.

Las briznas nacen dispersas dentro del metro y con la base repartida en la
profundidad. Si nacen alineadas, el pasto se lee como un campo arado.

---

### Partículas

`src/juego/particulas.js`: cuatro cosas que flotan en el aire, y ninguna lleva número ni
medidor; se leen por lo que hacen.

| qué | cuándo sale | de dónde | cómo se mueve |
|---|---|---|---|
| **hojas** | encinos y álamos (los pinos no); sobre todo en otoño, poco el resto del año, menos con lluvia | de la copa de cada árbol en la vista | caen, el viento las lleva hacia el este y se mecen |
| **polvo** | sólo con viento racheado, sobre arena y tierra | celdas de 4 m del mundo | rasante, rápido, en rachas |
| **chispas** | de cada hoguera, siempre | del fuego | suben hasta unos 3,5 m, se van de lado y pasan de blanco-naranja a rojo apagado |
| **luciérnagas** | de noche, sin lluvia, sobre pasto y orillas | celdas de 5 m | vagan despacio y se encienden y apagan |

- **No guardan estado.** Cada partícula es una función del reloj: dado el instante y la semilla
  de su ranura (un árbol, una celda, una hoguera) se sabe dónde está y cuánto le queda de
  vida, igual que la lluvia. No hay nada que crezca, limpiar ni sincronizar, y una prueba puede
  pedir el mismo instante dos veces y obtener lo mismo.
- **Viven en metros** `(x, y, z)`, no en filas, así que el zoom no cambia dónde están.
- **Siguen el terreno**: se dibujan con la altura del suelo de ahí (`alzaR`) y con el orden de
  pintado de su fila, de modo que una loma o un árbol más al sur las tapa.
- Las chispas y las luciérnagas **emiten luz propia** (no se atenúan con la hora del día); las
  hojas y el polvo se pintan con la paleta del suelo y se apagan de noche con todo lo demás.
- El número de partículas se acota (hojas: 160 como mucho) y escala con `calidad`, así que en una
  máquina lenta baja solo.
- Pendiente: las chispas no alumbran lo que tienen cerca, y no hay nieve ni cenizas de volcán.
  `pruebas/particulas.js`; `pruebas/cargar.js` las arranca apagadas (`NV.particulas=false`), porque dependen del reloj y casi todas las pruebas comparan cuadros; `particulas.js` las enciende.

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

**La cuesta también cuesta** (`COSTE_SUBIDA` 2,5, `COSTE_BAJADA` 0,6, por metro de
altura ganada o perdida en un paso). Subir pesa y bajar casi no: una loma de 2 m
equivale a unos cinco pasos de más, así que un paso bajo cercano le gana a trepar, y
uno lejano no. Es sólo la **ruta**: la velocidad del paso y la colisión no cambian.
Con 4 el sendero dejaba de ser conveniente (el sendero generado no conoce las lomas y
sube por ellas); con 2,5 sigue pasando lo de antes (30 % por sendero). `pruebas/cuesta.js`.

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

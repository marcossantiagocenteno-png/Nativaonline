# Instrucciones del proyecto

Antes de tocar nada, leer `docs/DISENO.md`. Ese documento manda sobre el código.

## Reglas que no se rompen

- **Sin dependencias.** HTML, CSS y JavaScript puro. Nada de librerías, nada de
  compilación. El juego tiene que correr abriendo `index.html`.
- **Scripts clásicos, no módulos ES.** Los archivos de `src/` se cargan en orden
  desde `index.html` y comparten el objeto global `NV`. Con `import`/`export` el
  juego dejaría de abrirse como archivo local.
- **Nunca mostrar números al jugador.** Ni daño, ni vida, ni defensa, ni
  durabilidad. Todo se comunica por sensación. Ver la sección 2 del diseño.
- **Todo se mide en metros, no en filas.** El motor traduce metros a filas según el
  nivel de detalle. Escribir alturas en filas fijas rompe el zoom.
- **El diccionario de glifos se respeta y se amplía, no se improvisa.** Cualquier
  material nuevo entra por las cuatro reglas de la sección 9.
- **El azar siempre positivo.** `hash3` devuelve valores enmascarados a 31 bits; un
  índice negativo deja la pantalla en negro.

## Al trabajar

- La caché del navegador fue el error que más veces nos hizo creer que algo no
  funcionaba. `index.html` ya no enlaza los archivos directamente: un cargador los
  pide con la hora actual, así que aunque el HTML venga de la caché, el juego
  siempre es el último. Si se agrega un módulo, va en esa lista del cargador **y**
  en `pruebas/cargar.js`, en el mismo orden.
- Probar antes de publicar: `node pruebas/humo.js` carga los módulos en un
  navegador simulado, genera el mundo, dibuja un cuadro y camina 60 pasos.
- El juicio visual lo pone Marcos. Describir qué se cambió y por qué, no afirmar
  cómo se ve.
- Hablar en español, directo, sin relleno.

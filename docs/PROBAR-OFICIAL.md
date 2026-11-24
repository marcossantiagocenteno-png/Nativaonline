# Probar el modo oficial con tus ojos

Para cuando el servidor esté disponible. Todo es en tu PC, sin instalar nada más que `ws` (una vez).

## 1. Arrancar el servidor (terminal 1)
```
cd servidor
npm install                     # sólo la primera vez
NATIVA_ADMIN_TOKEN=pon-una-clave-de-16-o-mas-caracteres node iniciar.js
```
Dice «servidor del mundo oficial en el puerto 8787». Los datos quedan en la carpeta `datos/` (git no la sube). En Windows (PowerShell):
`$env:NATIVA_ADMIN_TOKEN="tu-clave-larga"; node iniciar.js`. Se apaga con Ctrl+C.

## 2. Abrir el juego
- **En la misma PC:** abre `index.html?oficial=ws://localhost:8787` (también vale `?oficial` solo en desarrollo).
- **En el teléfono (misma red wifi):** en otra terminal, desde la carpeta del juego, `python3 -m http.server 8080`; en el teléfono abre
  `http://IP-DE-TU-PC:8080/index.html?oficial=ws://IP-DE-TU-PC:8787` (la IP la da `ipconfig` / `ifconfig`; si no conecta, el cortafuegos de la PC
  tiene que dejar pasar los puertos 8080 y 8787). Con GitHub Pages (https) el teléfono necesita un servidor con `wss://`: eso llega al publicarlo.
- Añade `&dios` para abrir directo el Modo Dios.

## 3. Qué mirar
**Arriba a la izquierda**, bajo el nombre del mundo, una línea dorada: `mundo oficial · solo lectura` (jugador), `mundo oficial · administrador`, `… · sin conexión · solo lectura`.
Nunca lleva números.

**Modo Dios (Shift+G), arriba del panel:** la línea de estado con versión y código del mundo, y los botones `clave`, `copia`, `importar`.
1. Como jugador, el panel se ve apagado (opacidad baja) y dice «solo lectura». Prueba a colocar algo: aparece el aviso y no pasa nada.
2. Pulsa `clave`, escribe la clave del servidor (las letras no deben mover al personaje) y `entrar`. El panel se enciende, dice «administrador» y aparecen `copia` e `importar`.
3. Coloca una roca. Abre la misma dirección en el teléfono (o en otra pestaña): la roca aparece sola, sin recargar.
4. Deshacer (Ctrl+Z) también viaja: desaparece en el otro.
5. Cierra el servidor (Ctrl+C): el estado pasa a «sin conexión», el mundo sigue visible y el Modo Dios no deja editar. Vuelve a arrancarlo: se reconecta solo y todo lo construido sigue ahí.
6. `copia` baja `nativa-copia-vN.json` (todo el mundo y su historial). `importar` pide elegir un archivo y luego confirmar.

**Lo que NO debería ocurrir:** que lo construido desaparezca al reiniciar, que el personaje se mueva al escribir la clave, que el modo solitario (`index.html` sin `?oficial`) muestre la línea dorada o el panel de conexión.

## 4. Revisión rápida automática
`NODE_PATH=/tmp/pp/node_modules node pruebas/chrome-oficial.js` hace casi todo lo anterior en un Chrome de verdad (comprueba los datos, no cómo se ve).

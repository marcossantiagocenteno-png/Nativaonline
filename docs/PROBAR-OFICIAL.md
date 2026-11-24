# Probar el modo oficial con tus ojos

Para cuando el servidor esté disponible. Todo es en tu PC, sin instalar nada más que `ws` (una vez).

## 1. Arrancar el servidor (terminal 1)
```
cd servidor
npm install                     # sólo la primera vez
NATIVA_ADMIN_TOKEN=<tu clave de 16 o más caracteres> node iniciar.js
```
Dice «servidor del mundo oficial en el puerto 8787». Los datos quedan en la carpeta `datos/` (git no la sube). En Windows (PowerShell):
`$env:NATIVA_ADMIN_TOKEN="<tu clave>"; node iniciar.js`. Se apaga con Ctrl+C.

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

## 4. Probar a los otros jugadores (PC + teléfono)
Con el servidor andando (paso 1):
1. **PC:** abre `index.html?oficial=ws://localhost:8787` (o la dirección con la IP de tu PC, como en el paso 2).
2. **Teléfono:** abre `http://IP-DE-TU-PC:8080/index.html?oficial=ws://IP-DE-TU-PC:8787` (servidor de archivos del paso 2).
3. Cada uno ve **al otro** como un personaje con nombre encima (`Viajero-XXXX`). Tu propio personaje sigue mostrando el nombre de siempre.
4. Camina en uno: en el otro, el personaje se mueve solo, mirando hacia donde va. Camina los dos a la vez.
5. **Invitado:** nadie necesita clave para caminar y verse; la clave sólo da el Modo Dios con permisos.
6. Choca contra agua honda, rocas o muros: no se atraviesan. Si mantienes una flecha apretada, el ritmo es el del juego (un metro cada 186 ms).
7. **Obra sobre un jugador:** con la clave de administrador en la PC, coloca una roca justo donde está parado el personaje del teléfono: el servidor lo corre a una casilla libre cercana y aparece un aviso en el teléfono.
8. **Desconexión:** cierra la pestaña del teléfono: desaparece de la PC en un instante. Vuélvela a abrir: aparece con otro nombre, cerca del punto de partida (los jugadores son temporales; no se guarda nada).
9. **Lo que NO debería ocurrir:** dos personajes exactamente en la misma casilla al entrar, un personaje que se queda quieto en la pantalla del otro después de irse, o atravesar agua/rocas.
10. Nota: dentro de una cueva el jugador desaparece para los demás (las cuevas compartidas son de una etapa posterior). Con el modo solitario (`index.html` sin `?oficial`) nada de esto existe.

## 5. Revisión rápida automática
`NODE_PATH=/tmp/pp/node_modules node pruebas/chrome-oficial.js` (mundo, Modo Dios, clave, reconexión) y `NODE_PATH=/tmp/pp/node_modules node pruebas/chrome-jugadores.js` (tres navegadores que se ven caminar) hacen casi todo lo anterior en un Chrome de verdad (comprueban los datos, no cómo se ve). Sin navegador: `node pruebas/presencia.js` y `node pruebas/red-jugadores.js`.

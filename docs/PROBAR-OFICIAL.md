# Probar el modo oficial con tus ojos

Todo es en tu PC, sin instalar nada más que `ws` (una vez). **El servidor todavía no está publicado:** esto se prueba en local.

## 1. Arrancar el servidor (terminal 1)
Hacen falta dos secretos distintos: la **contraseña de administrador** y la **clave con que se firman las sesiones**. Para generar dos al azar (no guarda nada, solo los muestra):
```
cd servidor
npm install                     # sólo la primera vez
node generar-claves.js
```
Luego, con esos dos valores (la contraseña tiene que tener 16 o más caracteres; la de firma, 32 o más):
```
NATIVA_ADMIN_TOKEN=<la contraseña> NATIVA_SESION_CLAVE=<la clave de firma> node iniciar.js
```
Dice «servidor del mundo oficial en el puerto 8787». Los datos quedan en la carpeta `datos/` (git no la sube). En Windows (PowerShell):
`$env:NATIVA_ADMIN_TOKEN="<la contraseña>"; $env:NATIVA_SESION_CLAVE="<la clave de firma>"; node iniciar.js`. Se apaga con Ctrl+C.
Sin `NATIVA_SESION_CLAVE` también arranca (usa una al azar y avisa), pero las sesiones de administrador se pierden al reiniciar.

## 2. Abrir la portada
- **En la misma PC:** abre `index.html` (sin nada más). Te encuentras la portada. Si el servidor está en marcha, abajo dice «El mundo oficial responde.».
- **En el teléfono (misma red wifi):** en otra terminal, desde la carpeta del juego, `python3 -m http.server 8080`; en el teléfono abre
  `http://IP-DE-TU-PC:8080/index.html?servidor=ws://IP-DE-TU-PC:8787` (la IP la da `ipconfig` / `ifconfig`; `?servidor=` sólo se acepta si la página y el servidor están en tu PC o en tu red privada —IP 192.168.x.x, 10.x.x.x…—, nunca con un nombre de Internet; si no conecta, el cortafuegos de la PC
  tiene que dejar pasar los puertos 8080 y 8787). En ese caso la portada muestra también la dirección del servidor, para que veas a dónde va tu contraseña.
  Con GitHub Pages (https) el teléfono necesita un servidor con `wss://`: eso llega al publicar el servidor.

## 3. Qué mirar
1. **Portada:** el título NATIVA, ONLINE debajo, los botones INVITADO y ADMINISTRADOR, el estado del mundo oficial y, discreto, «Modo solitario (sin servidor)». Fíjate en cómo se ve a distintos
   tamaños (gira el teléfono; achica la ventana). Los botones y el campo son tocables y el campo de la contraseña esconde lo que escribes.
2. **Invitado:** entra directo al mundo oficial. Arriba a la izquierda dice `mundo oficial · solo lectura`. Camina; el Modo Dios (Shift+G) se ve apagado y no deja editar.
3. **Administrador:** pulsa ADMINISTRADOR, escribe la contraseña y ENTRAR (o Enter). Con una contraseña mala dice «Contraseña incorrecta.»; tras varios intentos seguidos dice
   «Demasiados intentos. Espera N minutos…» (y mientras dure, ni la buena entra). Con la buena entras, arriba dice `mundo oficial · administrador` y en el Modo Dios (Shift+G) aparecen
   `copia`, `importar` y `cerrar sesión`. **Ya no hay campo de contraseña dentro del Modo Dios.**
4. Coloca una roca como administrador. Abre la portada en el teléfono (u otra pestaña) como Invitado: la roca aparece sola, sin recargar. Deshacer (Ctrl+Z) también viaja.
5. **Cerrar sesión** vuelve a la portada. Cerrar la pestaña también acaba la sesión (se guarda sólo en esa pestaña, nunca la contraseña).
6. **Servidor sin clave de administrador:** arráncalo sin `NATIVA_ADMIN_TOKEN`: la portada lo dice («Este servidor todavía no tiene configurada la clave de administrador (variable NATIVA_ADMIN_TOKEN…)») y no deja intentar. Invitado sigue funcionando.
7. **Cierra el servidor** (Ctrl+C): el estado pasa a «sin conexión», el mundo sigue visible en solo lectura. Vuelve a arrancarlo: todos se reconectan solos y todo lo construido sigue ahí (si usaste la misma clave de firma, el administrador sigue siéndolo).
8. **Modo solitario:** el enlace de abajo (o `index.html?solitario`) abre el juego de siempre, sin servidor ni portada.
9. `copia` baja `nativa-copia-vN.json` (todo el mundo y su historial). `importar` pide elegir un archivo y luego confirmar.

**Lo que NO debería ocurrir:** que lo construido desaparezca al reiniciar; que un Invitado pueda editar; que la contraseña aparezca en la dirección del navegador o se quede escrita en el campo; que el modo solitario muestre
la línea dorada o el panel de conexión; que el juego arranque (se vea moverse el personaje) detrás de la portada.

## 4. Probar a los otros jugadores (PC + teléfono)
Con el servidor andando (paso 1):
1. **PC:** abre la portada (`index.html`) y pulsa INVITADO (o ADMINISTRADOR si quieres editar).
2. **Teléfono:** abre `http://IP-DE-TU-PC:8080/index.html?servidor=ws://IP-DE-TU-PC:8787` y pulsa INVITADO.
3. Cada uno ve **al otro** como un personaje con nombre encima (`Viajero-XXXX`). Tu propio personaje sigue mostrando el nombre de siempre.
4. Camina en uno: en el otro, el personaje se mueve solo, mirando hacia donde va. Camina los dos a la vez.
5. Choca contra agua honda, rocas o muros: no se atraviesan. Si mantienes una flecha apretada, el ritmo es el del juego (un metro cada 186 ms).
6. **Obra sobre un jugador:** como administrador en la PC, coloca una roca justo donde está parado el personaje del teléfono: el servidor lo corre a una casilla libre cercana y aparece un aviso en el teléfono.
7. **Desconexión:** cierra la pestaña del teléfono: desaparece de la PC en un instante. Vuélvela a abrir: aparece con otro nombre, cerca del punto de partida (los jugadores son temporales; no se guarda nada).
8. **Lo que NO debería ocurrir:** dos personajes exactamente en la misma casilla al entrar, un personaje que se queda quieto en la pantalla del otro después de irse, o atravesar agua/rocas.
9. Nota: dentro de una cueva el jugador desaparece para los demás (las cuevas compartidas son de una etapa posterior).

## 5. Revisión rápida automática
`NODE_PATH=/tmp/pp/node_modules node pruebas/chrome-portada.js` (portada en cinco tamaños, Invitado, Administrador, solitario; deja capturas en `/tmp/capturas`), `pruebas/chrome-oficial.js` (mundo, Modo Dios, sesión, reconexión)
y `pruebas/chrome-jugadores.js` (tres navegadores que se ven caminar) hacen casi todo lo anterior en un Chrome de verdad (comprueban los datos, no cómo se ve). Sin navegador: `node pruebas/acceso.js`
(contraseña, sesiones, freno), `node pruebas/presencia.js` y `node pruebas/red-jugadores.js`.

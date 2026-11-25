# Nativa Online — el servidor oficial en un PC con Windows

Preparado el 25/11/2026 para: Windows 11, Intel i5-7400, 8 GB. **Nada instalado, nada encendido, nada registrado.** Este documento manda sobre
`DESPLIEGUE.md` en lo que toca a Windows (ese manual era para Oracle, que se descartó por pedir tarjeta).

## 1. Cómo queda armado

```
 Jugadores (cualquier dispositivo)
   │  https://marcossantiagocenteno-png.github.io/Nativaonline/      ← el cliente, en GitHub Pages (ya publicado)
   │  wss://<tu-pc>.<tu-red>.ts.net                                   ← el servidor, por el túnel
   ▼
 Tailscale Funnel (HTTPS/WSS con certificado automático; sólo SALIDA desde tu PC, no se abre ningún puerto del router)
   ▼
 tu PC · 127.0.0.1:8787 · servidor/iniciar.js  (sólo loopback)  ·  datos\ (el mundo)  ·  respaldos → otra unidad
```
- El servidor escucha **sólo en 127.0.0.1**. No hace falta regla de firewall de entrada ni IP pública ni abrir el router.
- No hay cuentas ni progreso por jugador (ver §2). El administrador entra con la contraseña de `privado\juego.env`.

## 2. Qué se guarda de cada personaje (`servidor/personajes.js`)
Cada personaje es **un archivo** `datos\personajes\<identidad>.json` (escritura atómica con `fsync`, suma de control propia, formato versionado). Contiene:
identidad (12 caracteres derivados del dispositivo), nombre, ubicación (`x`, `y`, hacia dónde mira), nivel, experiencia, inventario, fecha de creación y de última vez visto.
- **Identidad:** es **el dispositivo/navegador** (el «token» de invitado que el juego ya guarda en `localStorage`; el servidor sólo conserva su hash). No hay cuentas ni contraseñas de jugador.
  Si alguien borra los datos del navegador o cambia de aparato, es otro personaje. Un administrador conserva su personaje de dispositivo; sus permisos vienen de la sesión, no del personaje.
- **Ubicación:** se guarda cada 15 s, al desconectarse y al apagar el servidor; al volver reaparece donde estaba (si esa casilla ya no es transitable por una obra, en la libre más cercana) y con su nombre.
- **Nivel, experiencia, inventario:** **ya se guardan y se respaldan**, con topes y validación (nivel 1–1000, 200 casillas de inventario, etc.). Hoy **ninguna mecánica los usa**: nacen en nivel 1, experiencia 0, sin objetos,
  y **ningún mensaje del cliente puede cambiarlos** (los intentos reciben «desconocido»; está en `pruebas/personajes-servidor.js`). Sólo código del servidor puede otorgarlos
  (`otorgarExperiencia`, `darObjeto`, `quitarObjeto`). Quedan preparados para cuando decidas mecánicas; el juego sigue sin mostrar números al jugador.
- **Segunda pestaña del mismo dispositivo:** entra como jugador temporal (no toca el personaje permanente). Si el disco no deja guardar, el jugador entra igual como temporal y queda anotado en el registro.
- **Un archivo dañado nunca se borra:** al abrir, si no pasa la validación se aparta como `<identidad>.json.danado-<hora>` y el jugador estrena personaje.
- **Límite conocido:** el nombre `Viajero-XXXX` se evita repetir sólo entre conectados; dos personajes desconectados podrían coincidir de nombre. No afecta a la identidad (es el hash).
- **Mundo (sin cambios):** cada edición del Modo Dios (diario `diario.ndjson`), instantáneas y sesiones revocadas. En el navegador, el *modo solitario* guarda su borrador local; es del navegador.

## 3. Persistencia y respaldos
- **Dependencia al día:** `ws` subió de 8.18.0 a 8.23.0 (`servidor/package.json` y `package-lock.json`). La 8.18.0 tenía un fallo de gravedad alta (CVE-2026-48779: un cliente puede agotar la memoria del servidor con fragmentos diminutos), que importa al exponer el servidor a Internet. `npm audit` ahora dice 0 vulnerabilidades.
- El mundo vive en `datos\` (el servidor ya lo usa por defecto; git lo ignora). Escrituras atómicas con `fsync`, diario con suma por renglón, reparación del último renglón
  si se corta la luz, candado `.lock` con detección de proceso muerto. Un apagón no corrompe el mundo; como mucho se pierde la última edición en curso.
- Los respaldos usan **el sistema existente sin relajar nada** (copia ordenada, auditoría completa en proceso hijo, cifrado `age`, ficha al final), con destino
  `carpeta:` en **otra unidad** (disco externo / segundo disco). Un respaldo en el mismo disco no protege de un disco roto.
- **Diferencias con la nube, dichas claras:** sin B2 no hay *Object Lock* (nadie impide que borres o que un virus borre la carpeta de respaldos); la clave
  **maestra y la de reserva de `age` se guardan fuera del PC** (gestor de contraseñas / USB aparte), nunca junto a los respaldos.
  B2 sigue siendo posible más adelante (`RESPALDOS.md` §7) si aceptas crear la cuenta.
- Cambio hecho para Windows: el `tar.exe` de Windows (bsdtar) lista los archivos con otro formato que GNU tar; `nombreDeLinea` en
  `operaciones/respaldos/lib/paquete.js` entiende los dos, y sigue rechazando enlaces y rutas raras. `pruebas/respaldos.js`: 123 bien, 0 mal.
- **Los personajes entran al respaldo:** `datos\\personajes\\` se copia (sólo los nombres finales y los `.danado-`; nunca temporales), el manifiesto los hashea, la auditoría los revisa **con el código de la propia copia**
  (`servidor/personajes.js`) y la ficha anota cuántos son. Un personaje alterado o cortado hace fallar el respaldo (no se sube). Si el código que viaja no incluye `personajes.js` (falta el commit), el respaldo se aborta
  a la vista en vez de subirse inauditable. Restaurar los devuelve idénticos. Probado: `pruebas/personajes-respaldo.js` (9 bien).
- El respaldo copia el código con `git ls-files`: **lo que no esté en git no entra en la copia** y el manifiesto marca «árbol sucio». Antes del primer respaldo
  real hay que hacer commit del código (lo decides tú); **incluye los archivos nuevos** (`servidor/personajes.js`, `servidor/parada.js`, `operaciones/windows/`).

## 4. Inicio, apagado, reinicio (`operaciones\windows\`)
Doble clic en `Nativa-iniciar.bat`, `Nativa-parar.bat`, `Nativa-reiniciar.bat`, `Nativa-estado.bat`, `Nativa-respaldar.bat`, `Nativa-verificar.bat`,
o `node operaciones\windows\nativa.js <orden>` (`verificar · claves · iniciar · parar · reiniciar · estado · respaldar · tareas · energia`).
- **iniciar:** un supervisor en segundo plano enciende el servidor y lo vuelve a encender si se cae (espera 3 s, 6 s, 12 s… hasta 60 s si se cae seguido).
- **parar:** crea un archivo (`privado\parar.ahora`) que el servidor vigila (`servidor/parada.js`, porque Windows no manda `SIGTERM`); cierra el almacén y suelta
  el candado. Si en 40 s no responde, lo fuerza (el mundo se repara solo al volver a abrir).
- **Siempre producción:** loopback, sólo el origen de GitHub Pages, contraseña ≥16 y clave de firma ≥32 distinta. `NATIVA_CONFIAR_PROXY` **apagado** hasta probar el túnel.
- **Arranque automático:** `nativa.js tareas --aplicar` crea dos tareas programadas: el servidor *al iniciar sesión* y el respaldo *cada 6 h*. Sin `--aplicar` sólo las muestra.
  Para que el servidor suba tras un reinicio sin que estés, Windows debe iniciar sesión solo (ajuste de tu cuenta) — decisión tuya, no se toca.
- **Que el PC no se duerma:** `nativa.js energia --aplicar` (suspensión e hibernación en 0 *enchufado*). Windows Update puede reiniciar el PC: usa «horas activas».
- Registros: `privado\registros\servidor.log` y `respaldo.log` (rotan a 5 MB, guardan 3). Sin secretos.

## 5. Acceso desde Internet sin IP pública ni tarjeta
**Elegido: Tailscale Funnel.** Cuenta gratuita (inicio con Google/Microsoft/GitHub), plan Personal gratis para uso no comercial. Da una dirección fija
`https://<equipo>.<red>.ts.net` con certificado automático; los jugadores no instalan nada. Funnel acepta los puertos 443, 8443 y 10000 y es compatible con WebSocket (es un proxy TCP).
- **Por qué no los otros:** Cloudflare *Quick Tunnel* cambia de dirección en cada arranque (el cliente tiene una dirección fija en `NV.SERVIDOR_OFICIAL`) y es sólo para pruebas; el
  Cloudflare *Tunnel* con nombre exige un dominio propio en Cloudflare (DuckDNS no sirve). ngrok con dominio fijo gratis podría ser plan B (**no verificado** en su documentación).
- **Lo que la documentación de Tailscale dice (leída antes de preparar esto):** Funnel es un proxy TCP a través de sus servidores de relevo (el tráfico llega a tu equipo y es tu nodo quien termina el TLS), está en *beta*, disponible en todos los planes, sólo en 443/8443/10000, con límites de ancho de banda **no configurables y sin cifra publicada**. No documenta un tope de conexiones simultáneas. Como es TCP, el WebSocket pasa tal cual (hay aplicaciones con WebSocket, como Home Assistant, funcionando detrás de Funnel) y el encabezado `Origin` llega intacto, que es lo que nuestro servidor valida.
- **Compatibilidad con nuestro servidor (análisis, no prueba real):** el servidor escucha sólo en `127.0.0.1:8787` y Funnel le entrega ahí las conexiones; el servidor manda un *ping* cada 20 s, que mantiene vivas las conexiones ociosas; admite hasta 200 clientes. Varios jugadores a la vez son varias conexiones WebSocket independientes: no hay nada en el diseño que exija una sola.
- **Consumo medido en mi entorno (bucle local, jugadores simulados que caminan sin parar, el peor caso):** mundo vacío, bienvenida de ~0,4 KB por jugador; por jugador, bajada de ~3,5 KB/s con 10 jugadores, ~9 KB/s con 25 y ~23 KB/s con 60 (crece porque cada uno recibe lo que hacen los demás); subida ~0,16 KB/s por jugador.
  Sumado en el servidor: ~34 KB/s con 10, ~230 KB/s con 25, ~1,3 MB/s con 60. Con pocos jugadores es poco; con decenas el cuello será tu subida de Internet y el tope no publicado de Funnel. La bienvenida crecerá con las obras que haga el Modo Dios. **No sé cuánto aguanta Funnel ni tu línea:** se mide en ACCIONAR.
- **Riesgo que hay que medir (y por eso `NATIVA_CONFIAR_PROXY` queda apagado):** detrás del túnel, el servidor ve todas las conexiones como `127.0.0.1`. El freno de intentos de contraseña
  es por red de origen; con todos «en la misma red», alguien que falle la contraseña muchas veces **bloquearía el acceso de administrador para todos** (no lo abre: sólo lo frena). Se resuelve
  si el túnel envía la IP real en `X-Forwarded-For` y pasa `operaciones/despliegue/probar-proxy.js`; si no, se vive con eso o se pone otra solución.
- **Lo que expone:** tu PC corre un servicio público. El servidor ya valida cada paso y cada edición, sólo el administrador edita, y hay límites; aun así, quien tenga la dirección puede conectarse. No hay datos
  personales ni cuentas que robar. Mantén Windows y Node actualizados.

## 6. ACCIONAR — orden de trabajo (lo que pide cuenta, instalación o tu mano está marcado)
1. **[TÚ]** Copia la carpeta completa como respaldo y extrae encima `nativa-windows-preparacion.zip`. Reemplaza `.gitignore`, `servidor\iniciar.js`, `servidor\presencia.js`, `servidor\red.js`, `operaciones\respaldos\lib\{paquete,copia,verificar}.js` y agrega `servidor\{personajes,parada}.js`, `operaciones\windows\`, `pruebas\{windows,personajes-servidor,personajes-respaldo}.js` y este manual. No toca `src\` ni el motor, los gráficos, el editor ni el Modo Dios.
2. **[TÚ]** En `cmd` dentro de la carpeta: `node -v` (necesita 22 o 20; si no está: instalar Node.js LTS desde nodejs.org) y `cd servidor` → `npm ci --omit=dev`.
3. `node operaciones\windows\nativa.js verificar` → **me pasas la salida** (no contiene secretos).
4. `node operaciones\windows\nativa.js claves` → abre `privado\juego.env`, guarda la contraseña de administrador en tu gestor. **No me la pases.**
5. **[TÚ, instalar]** Tailscale para Windows (tailscale.com/download), iniciar sesión, activar HTTPS y MagicDNS en su consola; luego `tailscale funnel --bg 8787` (el comando te da un enlace para habilitar Funnel; verifica la sintaxis con `tailscale funnel --help`).
6. `Nativa-iniciar.bat` → `Nativa-estado.bat` → desde el celular (datos móviles) abre `https://<tu-dirección>.ts.net/salud`.
7. Probar el proxy (`operaciones/despliegue/probar-proxy.js`) y decidir `NATIVA_CONFIAR_PROXY`.
8. Poner la dirección en `NV.SERVIDOR_OFICIAL` (`src/juego/destino.js`) como `wss://<tu-dirección>.ts.net`: es un cambio en `src/`, la regla del proyecto pide `./sellar.sh` y publicar en `multijugador`. **Se revisa qué toca `sellar.sh` antes de ejecutarlo.**
9. **[TÚ, instalar]** `age` y `age-keygen` (github.com/FiloSottile/age/releases); crear dos claves (maestra y reserva) y guardarlas fuera del PC; llenar `NATIVA_RESPALDO_*` en `juego.env`; hacer commit del código; primer `Nativa-respaldar.bat` y prueba de restauración en una carpeta de prueba.
10. `nativa.js tareas --aplicar` y `nativa.js energia --aplicar`.
11. Pruebas finales: dos dispositivos a la vez por Funnel (mover y ver al otro), un personaje que sobreviva a `Nativa-reiniciar.bat` (mismo nombre y lugar), edición del Modo Dios que sobreviva igual, y respaldo con personajes verificado y restaurado en carpeta de prueba.

## 7. Lo que NO se pudo probar (se hace en ACCIONAR)
`schtasks`, `powercfg`, `taskkill`, el `tar.exe` y el `age.exe` reales de Windows, el túnel (conexión real, cabecera `X-Forwarded-For`, tope de ancho de banda, varios jugadores a la vez) y el rendimiento en tu i5-7400.
Probado en Linux (mi entorno, no tu PC): `pruebas/windows.js` (40 bien), `pruebas/personajes-servidor.js` (56 bien), `pruebas/personajes-respaldo.js` (9 bien), `pruebas/respaldos.js` (123 bien), y las de red, presencia, acceso y almacén sin cambios (todas 0 mal).
Estimación (no medida en tu equipo): con 4 núcleos y 8 GB sobra para el servidor y un respaldo; en mis pruebas un respaldo llegó a ~230 MB de RAM.

# Nativa Online — estado del proyecto

> Foto del estado tras la **etapa 7 (respaldos) y la preparación de la etapa 8 (despliegue)** (24/11/2026). El detalle de cada decisión vive en `DISENO.md`, que manda sobre el código;
> este documento es el mapa para orientarse rápido. Si algo de aquí contradice a `DISENO.md`, gana `DISENO.md`.

## 1. Ramas y puntos de restauración
- **`main`**: intacta, en `6537e0e` (el juego solitario de antes del multijugador). Es lo que publica GitHub Pages hoy.
- **`multijugador`**: la base de desarrollo, subida a GitHub (`origin/multijugador`). Cierre de la etapa 6 = commit `12213e7`; etapa 7 (respaldos) = `1658ac5` (subido). Lo posterior (preparación de la etapa 8) está sólo en local hasta que se autorice el push.
- El repositorio en GitHub ahora se llama `…/Nativaonline` (GitHub redirige el nombre antiguo); ver `docs/PUBLICACION.md` §4.
- Etiqueta **`antes-multijugador`** = `6537e0e`: punto de restauración.
- Nada se integra a `main` sin una decisión expresa.

## 2. Etapas completadas
| Etapa | Qué dejó | Commit |
|---|---|---|
| 0 | Preparación: rama, etiqueta de restauración y respaldo | `antes-multijugador` |
| 1 | El servidor carga el mundo sin pantalla, con el mismo código del cliente (listas `NV_MODULOS_SERVIDOR` / `NV_MODULOS_SOLO_CLIENTE`) | `0068dcb` |
| 2 | Almacén del mundo oficial: diario de operaciones, instantáneas, respaldos, escritura atómica, protección ante actualizaciones del código | `8a68edb` |
| 3 | Servidor de red: WebSocket + HTTP, protocolo v1, topes, latidos, lista de orígenes | `ce155e9` |
| 4 | Cliente en modo oficial (`?oficial`): Modo Dios edita el mundo oficial, reconexión incremental, huella de integridad | `74f9b46` |
| 5 | Jugadores conectados y sincronizados (presencia temporal, el servidor valida cada paso) | `69bbf27` |
| 6 | Portada, acceso Invitado / Administrador, sesiones firmadas | `826b2a4` |
| 6 (cierre) | Revocaciones persistentes, freno por /64, destino único de conexión, servidor oficial pendiente | `12213e7` |
| 7 | Estudio de alojamientos y **sistema de respaldos automáticos** (B2 con tres buckets, cifrado `age`, vigilancia, ensayo, restauración) | `1658ac5` |
| 8 (preparación) | `NATIVA_HOST`, unidad corregida, guion de despliegue, verificaciones y manual; investigación de publicación y Actions. **Nada contratado ni desplegado.** | (local) |

## 3. Arquitectura actual
```
 Navegador (HTML/CSS/JS puro, sin dependencias)          Servidor (Node ≥ 20, única dependencia: ws 8.23.0)
 ┌──────────────────────────────────────────┐            ┌─────────────────────────────────────────────┐
 │ index.html (sólo cargador) → src/*.js    │            │ servidor/iniciar.js   arranque y variables  │
 │ juego/portada.js   pantalla de entrada   │  HTTPS     │ servidor/red.js       WebSocket + HTTP      │
 │ juego/destino.js   a qué servidor va     │ ─────────► │ servidor/identidad.js roles y permisos      │
 │ juego/oficial.js   modo oficial          │  POST      │ servidor/sesiones.js  sesiones y freno      │
 │ juego/jugadores.js los demás jugadores   │  /entrar   │ servidor/presencia.js jugadores temporales  │
 │ motores, Modo Dios, modo solitario       │            │ servidor/mundo-oficial.js  el mundo único   │
 │                                          │  WSS       │ servidor/almacen.js   diario + instantáneas │
 │ (sin servidor: ?solitario, todo local)   │ ◄────────► │ servidor/cargar-mundo.js  motores sin DOM   │
 └──────────────────────────────────────────┘            └──────────────┬──────────────────────────────┘
                                                                         │ NATIVA_DATOS (volumen persistente)
                                                          diario.ndjson · instantaneas/ · respaldos/ · sesiones-revocadas.json
```
- **El mundo** es la semilla (`claro-03`) más una lista de ediciones. La única fuente de verdad del mundo oficial es el servidor; GitHub guarda código y mundo base.
- **El servidor manda:** valida cada edición (solo el administrador edita) y cada paso (con el mismo código de colisión del cliente). Una instancia por carpeta de datos (candado `.lock`).
- **Acceso:** el invitado manda una identidad temporal y siempre es `jugador`. El administrador manda su contraseña **una vez** a `POST /entrar` y recibe una sesión firmada (12 h, clave de firma propia, atada a la contraseña vigente);
  esa sesión es el único camino a `admin`. Las sesiones cerradas quedan anotadas en disco y no reviven al reiniciar. Freno de intentos por bloque de red (IPv4 / IPv6 /64).
- **Destino de la conexión:** `NV.destino.elegir` es la única regla. Los parámetros de URL solo valen en páginas de prueba y hacia localhost o red privada.

## 4. Funcionalidades disponibles
- **Modo solitario** (`?solitario`): el juego completo, sin servidor ni red, con borrador local. Intacto.
- **Portada:** Invitado, Administrador y enlace discreto «Modo solitario (sin servidor)»; arte propio en canvas y SVG, sin imágenes ni tipografías externas; responsive. Muestra el estado del servidor oficial.
- **Mundo oficial persistente y compartido:** todos ven el mismo mundo; reinicios del servidor no lo pierden; historial, restauración de versiones, copia y importación (administrador).
- **Modo Dios** sobre el mundo oficial (solo administrador): terreno, objetos, caminos, aguas, rocas, estructuras, cuevas y Umbrales, ampliar parcelas; cada edición se guarda y se reparte a todos.
- **Jugadores simultáneos:** presencia en vivo, personaje temporal por conexión, corrección de pasos por el servidor, reubicación ante obras. Sin progreso permanente.
- **Seguridad:** contraseña mínima de 16 caracteres, clave de firma ≥ 32 y distinta, sesiones no falsificables ni reutilizables tras cerrarlas, revocaciones persistentes, freno de intentos, orígenes permitidos, registros sin secretos, producción con arranque exigente.
- **Pruebas:** `node pruebas/<archivo>.js` (cada una se corre sola; las nuevas: `respaldos.js`, `host.js`, `despliegue.js`). Las de Chrome real necesitan `NODE_PATH=/tmp/pp/node_modules` (`puppeteer-core`). `dorado.js` vigila que la imagen no cambie. Ver `PROBAR-OFICIAL.md` para probarlo en la PC y el teléfono.

## 5. Configuraciones pendientes
- **`NV.SERVIDOR_OFICIAL`** (`src/juego/destino.js`): vacía a propósito. Se rellena con `wss://…` al publicar. Mientras tanto la página publicada dice que el servidor oficial todavía no está disponible y no se conecta a nada.
- **Variables del servidor** que hay que fijar en el alojamiento (nunca en el repositorio): `NATIVA_ADMIN_TOKEN`, `NATIVA_SESION_CLAVE`, `NATIVA_ORIGENES`, `NATIVA_DATOS`, `NODE_ENV=production`, y `NATIVA_CONFIAR_PROXY` solo si se cumplen sus tres condiciones. `node servidor/generar-claves.js` genera dos valores al azar sin guardarlos. La contraseña provisional la cambia Marcos al publicar.
- **Alojamiento:** **elegido en principio Oracle Always Free + DuckDNS + Caddy + Backblaze B2**, pero **sin contratar, sin desplegar y sin configurar DNS**. Manual en `docs/DESPLIEGUE.md`.
- **Aún no hecho (etapas futuras):** cuentas definitivas y nombre propio del personaje; filtrar a quién se avisa por zona de interés; cuevas compartidas entre jugadores; aplicar la dirección artística de la portada a personajes, criaturas y escenarios; decidir cuándo (y si) `multijugador` se integra a `main`.

## 6. Requisitos para publicar el servidor
Lo que el alojamiento tiene que ofrecer (la etapa siguiente consiste en comparar proveedores contra esta lista):
1. **Node.js ≥ 20** y un proceso encendido de forma permanente (no «se duerme» por inactividad: hay conexiones WebSocket abiertas y latidos).
2. **Almacenamiento persistente** montado en `NATIVA_DATOS`, que sobreviva a reinicios y a nuevas versiones del código. Guarda el mundo (`diario.ndjson`, `instantaneas/`, `respaldos/`) y las sesiones cerradas. Con disco efímero se pierde el mundo.
3. **WSS** (TLS) con un nombre de dominio: la página de GitHub Pages es https y el navegador bloquea `ws://`. El servidor habla HTTP/WS plano en `PORT`; el cifrado lo pone el proveedor (proxy) o se añade delante.
4. **WebSocket con conexiones largas** permitido por el proxy del proveedor (sin cortes por tiempo muerto cortos).
5. **Una sola instancia** del servidor sobre esos datos (no hay escalado horizontal: el almacén usa un candado).
6. **Variables de entorno secretas** configurables desde el panel del proveedor, y el valor de `PORT` que asigne el proveedor.
7. **Apagado limpio:** el servidor atiende `SIGTERM` (cierra el almacén); el proveedor debe enviarlo antes de apagar.
8. **Respaldos** de la carpeta de datos (instantáneas del volumen o copia periódica) y `GET /copia` como respaldo manual.
9. **Proxy (si lo hay):** solo se enciende `NATIVA_CONFIAR_PROXY=1` tras comprobar con ese proveedor las tres condiciones de `DISENO.md` (un solo proxy, añade la IP real al final de `X-Forwarded-For`, el servidor no es alcanzable sin él).
10. **Chequeo de salud:** `GET /salud` (responde sin autenticación; solo informa si hay clave de administrador, sí o no).
11. **Orígenes:** `NATIVA_ORIGENES=https://marcossantiagocenteno-png.github.io` (esquema y dominio, sin ruta).
12. **Costo** sostenible para un proyecto personal, y un plan claro de qué pasa si el servicio cambia o se cae.

Pasos posteriores a elegir proveedor (no antes): desplegar con variables, rellenar `NV.SERVIDOR_OFICIAL`, publicar el cliente desde la rama que se decida, probar desde GitHub Pages con un teléfono, y verificar las condiciones del proxy.

## 7. Próxima etapa: etapa 8 — despliegue (preparado, sin ejecutar)
- **Hecho:** estudio de alojamiento (etapa 7), respaldos, `NATIVA_HOST=127.0.0.1`, unidad corregida, guion de instalación repetible, verificaciones de despliegue y del proxy, manual (`docs/DESPLIEGUE.md`), propuesta de publicación del cliente y de vigilancia sin fusionar ramas (`docs/PUBLICACION.md`). Probado **en local y en simulación**.
- **Sigue sin hacerse:** crear cuentas, la VM, el DNS, Caddy real, B2 real, los secretos, publicar el cliente y rellenar `NV.SERVIDOR_OFICIAL`. Cada paso manual está en `docs/DESPLIEGUE.md` (fases 1 a 7).
- **Decisiones abiertas** antes de contratar: tipo de VM (AMD Micro de 1 GB frente a Ampere A1) y región de Oracle; cómo publicar el cliente (recomendado: rama `publicado`); dónde correr la vigilancia (recomendado: repositorio aparte + aviso externo); Pay As You Go sí o no.

## 8. Sistema de respaldos (etapa 7, implementado; sin contratar nada)
- **Decisión aprobada:** tres buckets de B2 (2 / 7 / 28 días) en lugar de los dos de la propuesta inicial, para conservar exactamente los periodos de retención (`docs/RESPALDOS.md`).
- Código en `operaciones/respaldos/`, unidades en `operaciones/systemd/`, vigilancia en `.github/workflows/vigilancia-respaldos.yml` (apagada hasta `RESPALDOS_ACTIVOS=true`), pruebas en `pruebas/respaldos.js`.
- Diseño, claves, retención, restauración, pasos manuales y riesgos: `docs/RESPALDOS.md`. Cambio de nombre del servidor (DuckDNS → dominio propio): `docs/DOMINIO.md`.
- La etapa 7 **no modificó** el servidor, los motores, el sistema de jugadores ni el almacén oficial. Pendiente: configurar Oracle y Backblaze a mano y correr `verificar-b2.js` contra el B2 real.
- La preparación de la etapa 8 sólo tocó `servidor/iniciar.js` (variable `NATIVA_HOST`, con `pruebas/host.js`).

# Nombre del servidor: DuckDNS ahora, dominio propio después

## Qué ve el jugador y qué cambia de verdad
- **La URL del juego es la de la página** (GitHub Pages: `https://marcossantiagocenteno-png.github.io/…`). Esa no cambia nunca por esto.
- Lo que cambia al migrar es **la dirección del servidor**, `NV.SERVIDOR_OFICIAL` en `src/juego/destino.js` (`wss://NOMBRE.duckdns.org` hoy, `wss://juego.midominio.com` mañana). Es **una línea** y, como `index.html` es un cargador que pide cada archivo con la hora, llega a todos al instante.
- Nota de honestidad: el encargo pedía «sin cambiar la URL del juego». Con DuckDNS como primer nombre, **la dirección del servidor sí cambia una vez**; la URL que el jugador abre, no. Para que ni siquiera esa línea cambie nunca habría que tener el dominio propio desde el primer día (un dominio cuesta del orden de 10–15 USD al año; sin verificar el precio actual).
- Efecto en los jugadores al migrar: la sesión del juego vale sólo para el servidor que la dio y vive en `sessionStorage` de la pestaña; tras el cambio, **cada jugador tendrá que entrar otra vez** (no pierde su personaje ni el mundo: eso vive en el servidor). Conviene avisarlo.

## Qué NO depende del nombre
- `NATIVA_ORIGENES` es el origen de la **página** (GitHub Pages), no el del servidor: no se toca al migrar.
- Los datos, los respaldos y las claves (`NATIVA_SESION_CLAVE`, `NATIVA_ADMIN_TOKEN`) no llevan el nombre del servidor. Una migración de nombre **no invalida las sesiones por la clave**: sólo se descartan en el navegador por la comparación de dirección.
- Los respaldos no cambian: el nombre no figura en la carpeta de datos.

## Hoy (sin gasto): DuckDNS
1. En duckdns.org (con una cuenta de Google/GitHub, gratis) se reserva un subdominio `NOMBRE.duckdns.org` y se apunta a la IP pública de la VM. El *token* de DuckDNS vale para cambiar esa IP: va en un gestor de contraseñas, **no** en el repositorio ni en los respaldos.
2. Caddy (`operaciones/caddy/Caddyfile.ejemplo`) obtiene y renueva solo el certificado de Let's Encrypt para ese nombre y reenvía a `127.0.0.1:8787`. Necesita abiertos los puertos 80 y 443 en la VM **y** en la lista de seguridad de Oracle.
3. Riesgos de DuckDNS (sin verificar uno a uno): servicio gratuito sin contrato; si su DNS cae, el juego «desaparece» aunque el servidor esté vivo; los certificados de Let's Encrypt tienen límites por dominio base compartido (`duckdns.org`), que han llegado a agotarse en épocas de mucha demanda. Es una razón más para migrar pronto.
4. Si la IP pública de la VM cambia (por ejemplo al recrearla), hay que actualizar el registro: con la IP reservada de Oracle no cambia; si no se reserva, se actualiza con un `curl` a DuckDNS (el *token* se pasa por variable de entorno).

## Migración a dominio propio (pasos, sin interrupción)
1. Comprar el dominio y delegar el DNS (en el registrador o en un DNS gratuito). Crear `juego.midominio.com` como registro **A** con la misma IP (o **CNAME** a `NOMBRE.duckdns.org` mientras dure la transición).
2. En Caddy **agregar** el bloque del dominio nuevo **sin quitar el de DuckDNS** (ejemplo comentado en `Caddyfile.ejemplo`); `systemctl reload caddy`. Caddy emite el certificado nuevo solo. Comprobar `https://juego.midominio.com/salud`.
3. Cambiar `NV.SERVIDOR_OFICIAL` a `wss://juego.midominio.com` y publicar el cliente. Avisar de que habrá que volver a entrar.
4. Dejar el nombre de DuckDNS **redirigiendo** unas semanas (bloque `redir` del ejemplo) y luego retirarlo.
5. Revisar que `vigilar.js`/`ensayo.js` no mencionan el nombre (no lo hacen: sólo hablan con B2) y que los avisos HTTP, si apuntaban al nombre antiguo, se actualicen.

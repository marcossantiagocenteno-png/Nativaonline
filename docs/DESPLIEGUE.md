# Despliegue del servidor (etapa 8)

Estado: **preparado y probado en local, sin ejecutar nada real.** No hay cuentas, VM, DNS ni servicios contratados. Cada paso marcado **[TÚ]** lo haces tú a mano; cada uno marcado **[SCRIPT]** lo hace una pieza de `operaciones/despliegue/` y se probó **sólo en simulación** (`pruebas/despliegue.js`), nunca en una máquina real: la primera vez, léelo entero y córrelo con `--simular`.

Piezas:
| Archivo | Qué hace |
|---|---|
| `operaciones/despliegue/instalar.sh` | Prepara la VM: usuarios, carpetas y permisos, código **en un commit exacto**, `npm ci`, plantillas de configuración (sin secretos), unidades de systemd y Caddyfile. Repetible. No enciende nada sin `--habilitar`. |
| `operaciones/despliegue/verificar-despliegue.js` | Comprueba desde fuera: `/salud`, certificado, redirección, orígenes, WebSocket, puerto del juego cerrado. |
| `operaciones/despliegue/probar-proxy.js` (+ `eco-cabeceras.js`) | La prueba de la **condición 2** del proxy (qué `X-Forwarded-For` llega al servidor). |
| `operaciones/caddy/Caddyfile.plantilla` | Proxy con HTTPS automático. |
| `operaciones/systemd/*` | Juego, respaldo, temporizador, aviso de fallo. |
| `operaciones/publicacion/publicar.sh` | Publica un commit en la rama `publicado` (Pages). Ver `PUBLICACION.md`. |

## Decisiones ya tomadas
- El servidor escucha **sólo en `127.0.0.1`** (`NATIVA_HOST=127.0.0.1`, ya implementado y probado en `pruebas/host.js`); el único camino desde Internet es Caddy. Con eso la condición 3 de `NATIVA_CONFIAR_PROXY` se cumple **sin depender del cortafuegos**. El cortafuegos se configura igual (defensa en capas).
- Respaldos: tres buckets de B2 con Object Lock Compliance (`RESPALDOS.md`). Nombre: DuckDNS primero (`DOMINIO.md`). Cliente: rama `publicado` (`PUBLICACION.md`), a decidir.

## Decisiones que siguen abiertas antes de empezar
1. **Tipo de VM de Oracle.** AMD Micro (1 GB de RAM) frente a Ampere A1 (más memoria, pero la capacidad gratuita puede no estar disponible). Con 1 GB de RAM el juego, Caddy y la auditoría del respaldo (tope 384 MB, `MemoryMax=700M`) pueden quedarse sin memoria: se necesita **swap** y medir con el mundo real, o la A1.
2. **Región de Oracle** (no se puede cambiar; si Querétaro/Monterrey ofrecen la forma gratuita está **sin verificar**).
3. **Cómo se publica el cliente** (`PUBLICACION.md` §1) y **dónde corre la vigilancia** (`PUBLICACION.md` §2).
4. Si se pasa a *Pay As You Go* (tarjeta) para reducir el riesgo de reclamación de instancias inactivas: la documentación de Oracle se contradice; decidirlo con presupuesto y alerta de costos puestos.

## Orden de trabajo
### Fase 0 — antes de crear nada **[TÚ]**
- Gestor de contraseñas listo (secretos del juego, claves `age`, token de DuckDNS, claves de B2).
- El commit que se va a instalar está **subido a GitHub** y probado (`node pruebas/dorado.js`, suite). Anota su SHA completo (40 caracteres): `git rev-parse HEAD`.
- `NV.SERVIDOR_OFICIAL` (`src/juego/destino.js`) todavía está **vacío a propósito**: se rellena en la Fase 6, no antes.

### Fase 1 — Oracle **[TÚ]**
1. Crear la cuenta y elegir la región de origen. Activar 2FA. Poner un **presupuesto con alerta** (las alertas no frenan el gasto).
2. Crear la VM (Ubuntu LTS) con **IP pública reservada**.
3. Red (VCN → lista de seguridad / grupo de seguridad de red): entrada **22 sólo desde tu IP**, **80 y 443** desde cualquier lugar. **No abrir 8787.** Revisar también el cortafuegos de la propia VM (las imágenes de Oracle traen reglas de `iptables`; **sin verificar** cómo vienen en la imagen que elijas).
4. Con la VM de 1 GB: crear swap (instrucciones del sistema operativo elegido) antes de seguir.

### Fase 2 — DuckDNS **[TÚ]**
Subdominio `NOMBRE.duckdns.org` apuntando a la IP reservada; token en el gestor de contraseñas (no en el repositorio ni en la VM). Detalles y riesgos en `DOMINIO.md`.

### Fase 3 — Requisitos que el script no instala solo **[TÚ]**
- **Node.js ≥ 20** (por ejemplo desde el repositorio oficial de NodeSource) y **Caddy** (guía oficial de instalación, caddyserver.com/docs/install). El script se detiene con un mensaje claro si faltan: a propósito no descarga ni ejecuta instaladores por su cuenta.

### Fase 4 — Preparar la máquina **[SCRIPT]**
```
git clone https://github.com/marcossantiagocenteno-png/Nativaonline.git
cd Nativaonline
NV_RAIZ=/tmp/ensayo ./operaciones/despliegue/instalar.sh --simular --commit <SHA> --dominio NOMBRE.duckdns.org --repo "$PWD"   # ensayo: no cambia el sistema
sudo ./operaciones/despliegue/instalar.sh --commit <SHA de 40 caracteres> --dominio NOMBRE.duckdns.org
```
Deja: usuarios `nativa` y `nativa-respaldo`; `/opt/nativa` en ese commit (sólo lectura para el servicio) con `npm ci --omit=dev`; `/var/lib/nativa` (datos del mundo, 0750); `/etc/nativa/juego.env` y `/etc/nativa-respaldo/respaldo.env` (**0600, vacíos de secretos**); las unidades; `/etc/caddy/Caddyfile` validado. **No enciende nada.** Repetirlo no pisa tus archivos de configuración ni los datos.

### Fase 5 — Secretos y primera prueba **[TÚ]**
1. `node /opt/nativa/servidor/generar-claves.js` y guardar los dos valores en el gestor de contraseñas. Editar `/etc/nativa/juego.env` (quitar el «# » de las tres líneas y poner los valores y `NATIVA_ORIGENES`). Mientras estén comentadas el servidor **se niega a arrancar**.
2. **Probar el proxy (condición 2) con el juego APAGADO:**
   - en la VM: `node operaciones/despliegue/probar-proxy.js eco --ip-esperada <tu dirección pública>`
   - desde tu equipo: `node operaciones/despliegue/probar-proxy.js enviar https://NOMBRE.duckdns.org/prueba`
   - veredicto **BIEN** → seguir. **FALLA** → quitar `NATIVA_CONFIAR_PROXY=1` de la unidad antes de encender (el freno vería la dirección del proxy) y avisar. Esta prueba también deja ver que Caddy ya sirve HTTPS.
3. Encender: `sudo ./operaciones/despliegue/instalar.sh --commit <SHA> --dominio NOMBRE.duckdns.org --habilitar` (se niega si el archivo de secretos está incompleto).
4. **Verificar desde tu equipo:** `node operaciones/despliegue/verificar-despliegue.js --url https://NOMBRE.duckdns.org --origen https://marcossantiagocenteno-png.github.io --ip <IP pública de la VM>`. Todo debe salir «bien».

### Fase 6 — Cliente y primera partida **[TÚ]**
Rellenar `NV.SERVIDOR_OFICIAL` con `wss://NOMBRE.duckdns.org`, commit, publicar (`PUBLICACION.md`). Probar desde el teléfono (invitado y administrador). Un cambio de `src/` pide `./sellar.sh` antes del commit (regla del proyecto).

### Fase 7 — Respaldos **[TÚ] + [SCRIPT]**
Seguir `RESPALDOS.md` §7 (B2, claves `age`, `verificar-b2.js`). Después `instalar.sh … --habilitar-respaldos` (se niega si `respaldo.env` tiene valores de ejemplo). Primer respaldo a mano, ensayo con la clave maestra y falla provocada para ver llegar la alarma.

## Marcha atrás
- **Código:** `instalar.sh` con el SHA anterior (los datos no se tocan). El servidor **no arranca** si un código nuevo rehace distinto un cambio ya guardado (protección del almacén).
- **Cliente:** apuntar `publicado` a un commit anterior (`PUBLICACION.md`).
- **Apagar todo:** `sudo systemctl disable --now nativa-juego nativa-respaldo.timer`; los respaldos de B2 permanecen.
- **Datos:** restaurar con `RESPALDOS.md` §6.

## Lo que se probó y lo que no
Probado **en local** (`pruebas/despliegue.js`): el guion en simulación (idempotente, permisos 600, sin secretos, se niega a encender con configuración incompleta o con una rama en lugar de un SHA, no pisa configuración existente, respalda un Caddyfile anterior), la verificación contra un servidor de producción local (y que detecta uno mal configurado), el veredicto del experimento del proxy con cuatro proxys simulados, `publicar.sh` contra un repositorio local, y que cada ruta citada en estos documentos existe.
**No probado** (no hay máquina): `apt`, `useradd`, `systemctl`, `caddy validate`, `npm ci` y la clonación desde GitHub en una VM real; el comportamiento real de Caddy con `X-Forwarded-For`; certificados reales de Let's Encrypt para `duckdns.org`; el cortafuegos de Oracle.

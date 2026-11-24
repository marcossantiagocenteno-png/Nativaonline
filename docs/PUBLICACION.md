# Publicar el cliente y vigilar los respaldos sin fusionar `multijugador` en `main`

Investigación (24/11/2026). **No se cambió ninguna configuración de GitHub**: esto es la propuesta y las piezas inertes que la acompañan. Lo confirmado viene de la documentación oficial de GitHub (enlaces al final); lo que no pude comprobar está marcado «sin verificar».

## Punto de partida (comprobado)
- El repositorio es **público**, su rama por defecto es **`main`** y hoy se llama `marcossantiagocenteno-png/Nativaonline` (el remoto local todavía usa `nativaonline` y GitHub redirige; ver §4).
- Según `ESTADO.md`, **GitHub Pages publica `main`** (juego solitario). No pude leer la configuración real de Pages: el proxy de esta sesión no permite esa ruta de la API. **Sin verificar** hasta que lo mires en *Settings → Pages*.
- El workflow de vigilancia vive en `multijugador` y por eso **todavía no corre**: ver §2.

## 1. Publicar el cliente de `multijugador` en Pages, sin fusionar
Lo confirmado por la documentación de Pages:
- «The source branch can be any branch in your repository» y la carpeta puede ser la raíz (`/`) o `/docs`. La opción se elige en *Build and deployment → Source*: **Deploy from a branch** o **GitHub Actions**.
- Con un flujo propio, los pasos oficiales son `actions/upload-pages-artifact` + `actions/deploy-pages`, con permisos `pages: write` e `id-token: write`, y el entorno `github-pages`. GitHub recomienda una regla de despliegue para que **sólo la rama por defecto** pueda desplegar a ese entorno; para publicar desde otra rama habría que añadir una regla de rama (*Selected branches and tags*) a ese entorno.
- Límites de Pages: sitio publicado ≤ 1 GB; ancho de banda *soft* 100 GB/mes; la regla de 10 builds por hora no aplica a un flujo propio. Pages en repositorios privados requiere plan de pago; el nuestro es público.
- Pages no es para negocios en línea ni para «enviar contraseñas»: la página sólo es estática. **La contraseña de administrador nunca pasa por Pages**: va por HTTPS al servidor (`POST /entrar`).

Opciones, de menor a mayor complicación:
| Opción | Qué es | Pros | Contras |
|---|---|---|---|
| **A. Rama de publicación `publicado`** (recomendada) | Pages = *Deploy from a branch* → `publicado`, carpeta `/`. Se actualiza **a propósito** con `operaciones/publicacion/publicar.sh <commit>` (sube ese commit probado a `publicado`). | `main` intacta; sin flujos ni entornos; la publicación es un acto deliberado (un `push` a `multijugador` no cambia lo que ven los jugadores); marcha atrás = apuntar `publicado` a un commit anterior. | Una rama más; hay que acordarse de publicar. Pages sirve toda la raíz de esa rama (también `servidor/`, `docs/`…: ya es público). |
| B. Pages desde la rama `multijugador` | *Deploy from a branch* → `multijugador`. | Cero piezas nuevas. | Cada `push` de desarrollo se publica al instante; mezcla desarrollo y publicación. |
| C. Flujo propio (`deploy-pages`) que sólo despliega lo necesario | Plantilla en `operaciones/publicacion/pages-flujo.yml.ejemplo`. | Publicaría sólo `index.html` + `src/`, sin `servidor/` ni `docs/`. | Hay que habilitar «GitHub Actions» como fuente, **añadir `multijugador` (o tags) a las reglas de despliegue del entorno** y mantener el flujo; más superficie. |
**Recomendación: A.** Es la que menos toca (ninguna configuración salvo *Settings → Pages → rama `publicado`*), no integra nada a `main` y deja la publicación en tus manos.

Pasos de A (cuando decidas, no antes; **nada hecho**):
1. Probar el commit que se publicará: `node pruebas/dorado.js` y la suite.
2. `operaciones/publicacion/publicar.sh <commit>` (crea/actualiza `publicado`; nunca toca `main`; no fuerza).
3. En GitHub: *Settings → Pages → Source: Deploy from a branch → Branch `publicado`, `/ (root)`*. **Esto cambia lo que publica hoy `main`** (el juego solitario seguirá disponible en el nuevo cliente con `?solitario`).
4. Rellenar `NV.SERVIDOR_OFICIAL` (`src/juego/destino.js`) con `wss://…` **antes** de publicar (hoy está vacío a propósito) y fijar `NATIVA_ORIGENES` con el origen de la página (`https://marcossantiagocenteno-png.github.io`: sólo esquema y dominio).
5. Si algún día la página usa dominio propio, `NATIVA_ORIGENES` cambia con él (ver `DOMINIO.md`).

## 2. GitHub Actions (vigilancia de respaldos) sin fusionar
Lo confirmado (documentación de eventos):
- «Scheduled workflows run on the latest commit on the default branch» y sólo en la rama por defecto. **Un `schedule` dentro de `multijugador` no se ejecuta nunca.**
- El intervalo mínimo es 5 minutos; puede retrasarse bajo carga y, con carga alta, algún trabajo en cola puede perderse (de ahí que la vigilancia sea cada hora y que además la VM mande su propio aviso).
- En un repositorio público los flujos programados se **desactivan solos tras 60 días sin actividad** en el repositorio.
- `workflow_dispatch`: el botón «Run workflow» sólo aparece si el archivo está en la rama por defecto; una vez que el flujo ha corrido, se puede lanzar contra otra rama por la API o `gh`.

Opciones sin fusionar `multijugador`:
| Opción | Qué es | Toca `main` | Notas |
|---|---|---|---|
| **A. Repositorio aparte de vigilancia** (recomendada) | Un repositorio público pequeño (`nativa-vigilancia`) con **un solo archivo de flujo** (`operaciones/vigilancia/vigilancia-externa.yml.ejemplo`) que descarga el código de `multijugador` **anclado a un commit** y corre `vigilar.js`/`ensayo.js`. | **No** | Los secretos (clave de lectura de B2 y clave del verificador) viven **sólo ahí**, no en el repositorio del juego. Necesita su propia actividad cada <60 días (un `workflow_dispatch` manual o un commit trivial; el propio ensayo semanal no cuenta como actividad: documentación sin verificar para ese caso concreto). |
| B. Un único archivo en `main` | Añadir a `main` sólo `.github/workflows/vigilancia-respaldos.yml`, que hace `checkout` de `multijugador`. | Sí (un archivo) | No es una fusión, pero cambia `main`: requiere decisión expresa. |
| C. Aviso muerto («dead man's switch») externo | La VM llama a `NATIVA_LATIDO_URL` (por ejemplo healthchecks.io, **sin verificar**) tras cada respaldo; el servicio externo avisa si faltan latidos. | No | No mira el contenido de B2: complementa, no sustituye, a A. Es independiente de GitHub. |
**Recomendación: A + C.** A comprueba el contenido (sumas, cabeceras, ensayo); C avisa aunque GitHub falle. El flujo de `.github/workflows/` del repositorio del juego queda como plantilla inactiva (no corre desde `multijugador`).
- **Anclar a un commit:** el flujo corre con secretos y ejecuta código descargado; anclarlo a un SHA evita que un cambio posterior en la rama llegue a los secretos sin que lo actualices tú. Se actualiza a mano al cambiar los scripts de respaldo.
- Lo que cada secreto permite: la clave de lectura de B2 sólo lista y lee texto cifrado; la del verificador sólo abre el canario. Aun comprometidos, no abren el mundo real ni borran nada (`RESPALDOS.md` §3).

## 3. Lo que NO se hizo (a propósito)
Ninguna configuración de Pages, ninguna rama `publicado`, ningún repositorio de vigilancia, ningún secreto, ninguna variable de GitHub y ninguna cuenta. Lo preparado son archivos inertes: `operaciones/publicacion/publicar.sh` (probado contra un repositorio local de prueba), `pages-flujo.yml.ejemplo` y `operaciones/vigilancia/`.

## 4. Observación: el repositorio cambió de nombre
`git push` respondió «This repository moved» hacia `…/Nativaonline.git`, y la API devuelve `full_name: marcossantiagocenteno-png/Nativaonline`. El remoto local sigue funcionando por la redirección. Conviene actualizar el remoto (`git remote set-url`) y revisar si la URL de Pages cambió de mayúsculas (sin verificar); `NATIVA_ORIGENES` no depende de la ruta, sólo del dominio.

## Fuentes (documentación oficial de GitHub)
- Configurar la fuente de publicación de Pages: docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
- Flujos personalizados con Pages: docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- Eventos que activan flujos (`schedule`, `workflow_dispatch`): docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows
- Entornos de despliegue: docs.github.com/en/actions/managing-workflow-runs-and-deployments/managing-deployments/managing-environments-for-deployment
- Límites de Pages: docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits

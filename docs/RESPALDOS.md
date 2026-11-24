# Respaldos automáticos del mundo oficial

Estado: **implementado y probado contra carpetas y un Backblaze B2 simulado. Nada contratado, nada desplegado.** Lo que depende del servicio real está marcado «sin verificar» y se comprueba con `verificar-b2.js` al configurarlo.

## 1. Qué hace, en una página
Cada 6 horas (00, 06, 12, 18 UTC) un temporizador de systemd corre `operaciones/respaldos/respaldar.js` en la VM de Oracle:
1. **Copia la carpeta de datos del mundo** (`NATIVA_DATOS`: `meta.json`, `instantaneas/`, `diario.ndjson`, extras permitidos) **sólo leyéndola**. No abre el almacén, no toma su candado, no avisa al servidor: los jugadores conectados no notan nada.
2. **La audita** con el código del propio servidor (`mundo-oficial.js`: todas las huellas, todas las instantáneas, el diario sin huecos) en un proceso aparte, y compara la versión y la huella con las del **diario vivo** (leídas de los archivos). Exige además que abrir la copia no cambie ni un byte de ella.
3. Le suma **el código del commit** (`servidor/`, `src/`, `operaciones/`, sólo archivos de git) y un **manifiesto** (commit, versión de Node, arquitectura, versión del mundo, huella, suma de cada archivo).
4. Escanea que no lleve secretos, empaqueta, **vuelve a abrir el paquete y compara archivo por archivo**, y lo **cifra con age** para dos claves públicas (maestra y de reserva).
5. Lo sube a B2 y, **después**, sube su ficha `.json` (la ficha es la marca de «listo»).
Además: la copia **diaria** y la **semanal** (el mismo paquete, en su propio bucket, una vez por día/semana) y un **canario** (ver §4).

Si cualquier paso falla, **no se sube nada**, queda `estado/alerta.json`, un aviso HTTP opcional, y el servicio termina con error (systemd dispara `nativa-respaldo-fallo.service`).

## 2. Las condiciones del encargo, una por una
| Condición | Cómo se cumple | Dónde se prueba (`pruebas/respaldos.js`) |
|---|---|---|
| Todo el historial | Se respalda la **carpeta** (diario + instantáneas), no `GET /copia`: `/importar` colapsa el historial a la versión 1 (medido: 1 de 12 versiones; la carpeta restaura 12 de 12). | restauración: «60 de 60 versiones», idéntica byte por byte |
| No interrumpir al servidor | Sólo lectura, proceso aparte, `Nice=19`, `IOSchedulingClass=idle`, `MemoryMax`, datos montados de sólo lectura para el servicio; no toma `.lock`. | «NO modifica ni un byte de la carpeta de datos»; unidad systemd |
| Copia consistente con el servidor escribiendo | Orden de copia: meta → instantáneas → extras → **diario al final**, cortado en el último `\n`. Pero **no se confía en el orden**: cada copia se audita y, si no pasa, se reintenta (3 veces). | 8 respaldos con un escritor sin parar (>100 ediciones): 8 de 8 válidos, cada diario es **exactamente el comienzo** del diario vivo |
| Copia mala nunca se sube | La auditoría va antes de empaquetar y cifrar; nada se sube sin pasar por ella. | diario alterado, instantánea alterada, línea faltante, diario vacío, sin `meta.json`: 6 casos, 0 archivos subidos, alerta en todos |
| Alerta si falla o si deja de producir | (a) falla: registro + `alerta.json` + `OnFailure` + aviso HTTP. (b) deja de producir: **`vigilar.js` en GitHub Actions cada hora**, fuera de Oracle: alarma si la última copia de 6 h tiene > 8 h (diaria > 30 h, semanal > 200 h, canario > 8 h), si la versión retrocede, si falta la ficha/el archivo, si la suma no coincide, si hay otro número de destinatarios. | 7 escenarios de `vigilar` |
| Restaurar sin tocar el mundo oficial | `restaurar.js` **nunca** escribe sobre una carpeta con datos ni dentro de `NATIVA_DATOS` ni donde haya un servidor vivo; `--solo-verificar` no deja nada. Se abre con el código **del propio respaldo**. | 5 casos de rechazo; «ningún ensayo tocó el mundo en uso» |
| Repetible sin duplicar ni dañar | `estado.json` anota el periodo de cada nivel; un periodo hecho no se rehace (salvo `--forzar`); los destinos son de escritura única por nombre; candado de proceso con detección de candados viejos. | repetir, forzar el mismo nombre (falla sin pisar), candado vivo y muerto |
| Sin contraseñas, tokens ni claves de sesión | (1) La copia sólo toma **nombres permitidos**; lo desconocido (`.env`, `.pem`…) ni se lee y se anota en la ficha. (2) Un escaneo de **todo** el paquete aborta con patrones de secretos o con el **valor exacto** de `NATIVA_ADMIN_TOKEN`, `NATIVA_SESION_CLAVE` o claves de B2 del entorno. (3) Las unidades de respaldo no mencionan los secretos del juego. | `.env`/`.pem` plantados; secreto en archivo permitido; valor exacto del token |

## 3. Claves y credenciales (nada de esto va al repositorio)
| Clave | Dónde vive | Qué puede |
|---|---|---|
| **age maestra (privada)** | Fuera de GitHub y de Oracle: gestor de contraseñas **y** una copia impresa/en USB guardada aparte. | Abrir **todos** los respaldos. Sólo se pega a mano al restaurar. |
| **age de reserva (privada)** | En otro lugar físico distinto de la maestra. | Lo mismo; sirve si se pierde la maestra. |
| age públicas (maestra y reserva) | En `respaldo.env` de la VM. | Sólo **cifrar**. Si roban la VM no abren ningún respaldo. |
| **age del verificador (privada)** | Secreto de GitHub `NATIVA_VERIFICADOR_IDENTIDAD`. | Abre **sólo canarios** (datos sintéticos). Aunque se filtre, no abre nada del mundo real (probado: la maestra ni abre el canario y el verificador no abre un respaldo real). |
| B2 de **escritura** (`writeFiles`) | En `respaldo.env` de la VM (modo 600). | Subir. No lista, no lee, no borra. |
| B2 de **lectura** (`listFiles`, `readFiles`, `readFileRetentions`, `listBuckets`) | Secretos de GitHub `B2_ID_LECTURA`/`B2_CLAVE_LECTURA`. | Listar y leer lo cifrado. No sube ni borra. |
| B2 de administración | Sólo en el gestor de contraseñas; se usa a mano en la consola y para `verificar-b2.js`. Se puede revocar después de configurar. | Todo, **salvo** borrar lo que esté bajo retención Compliance. |
| `NATIVA_ADMIN_TOKEN`, `NATIVA_SESION_CLAVE` (del juego) | `/etc/nativa/juego.env` y el gestor de contraseñas. | **No están en ningún respaldo.** Hay que guardarlos aparte: sin ellos se restaura el mundo pero se invalidan sesiones/administración. |

### Cómo se verifica y se ensaya sin la clave maestra en GitHub (decisión 2)
- **Canario:** cada ciclo la VM genera un mundo sintético (30 ediciones), lo pasa por **el mismo camino** que uno real (copia → auditoría → paquete → cifrado) y lo cifra **sólo** para el verificador. GitHub lo descarga, lo descifra, lo restaura con el código y el Node que viajan dentro, audita y compara la huella con su manifiesto y su ficha (`ensayo.js`, lunes y a mano).
- **Respaldo real, sin descifrar:** `vigilar.js` baja la ficha y el `.age` real y comprueba existencia, suma SHA-256, cabecera age válida con el número exacto de destinatarios, auditoría ok, commit y Node anotados, huella verificada contra el mundo vivo, versión no retrocede.
- Lo que **no** prueba GitHub: que *la clave maestra concreta* abre el último respaldo real. Eso queda en un **ensayo humano trimestral** (§7). Es el precio de no exponer la clave.

## 4. Retención y borrado (decisión 1 y 3)
| Bucket | Qué guarda | Retención Compliance | Ciclo de vida (ocultar / borrar tras ocultar) |
|---|---|---|---|
| `nativa-seis-horas` | cada 6 h + canarios | 2 días | 3 d / 1 d |
| `nativa-diario` | 1 por día | 7 días | 8 d / 1 d |
| `nativa-semanal` | 1 por semana | 28 días | 29 d / 1 d |
- Object Lock **en modo Compliance**, activado **al crear** cada bucket, con retención por defecto. Nadie (ni el dueño ni B2) puede borrar o acortar antes: un fallo de la VM, un robo de la clave de escritura o un error nuestro **no pueden destruir copias**.
- Consecuencia que conviene tener presente: **tampoco podemos borrar a propósito** lo que se subió por error durante su retención (por ejemplo, un respaldo enorme). Por eso `vigilar.js` avisa si el tamaño se desploma y hay que vigilar el costo si crece; las claves sin permiso de borrado hacen que la limpieza la haga sólo el ciclo de vida.
- Las reglas de ciclo de vida corren una vez al día; lo ocultado y vencido se borra solo.
- **No se puede probar en minutos** que el ciclo de vida borre de verdad: se anota la fecha de la prueba de `_verificacion/` (2 días de retención + 1 de ciclo) y se revisa a mano pasados ~4 días (§7).

### Decisión: tres buckets (modifica la propuesta inicial de dos)
- **Qué se propuso y aprobó al principio:** dos buckets. **Qué se implementó:** tres, sin avisarlo en su momento; se señaló después y **Marcos aprobó mantener los tres** (2026-11-24).
- **Por qué tres:** la retención por defecto de Object Lock es **por bucket**, y se quieren tres periodos exactos: 2 días (6 h), 7 días (diarias) y 28 días (semanales). Con dos buckets habría que alargar uno de ellos: la alternativa evaluada (`corto` de 7 días con 6 h + diarias + canarios, y `semanal` de 28) deja las copias de 6 h bloqueadas ~8 días en vez de ~3 (≈32 copias en vez de 8) y rompe el «retención de dos días» aprobado.
- **Qué ganan tres:** retención exacta de cada nivel; menos copias almacenadas; y, como Compliance **no deja borrar antes**, un error que suba archivos enormes en el nivel de 6 h cuesta 2 días de almacenamiento y no 7. La seguridad contra borrados no cambia: es la misma con dos o con tres.
- **Qué cuestan tres:** un bucket más que configurar y verificar (`verificar-b2.js` revisa los tres) y elegir bucket por nivel al restaurar (el nombre del archivo ya dice el nivel).
- Si el mundo creciera a cientos de MB comprimidos o B2 no permitiera una clave limitada a tres buckets (sin verificar), se puede revisar; `destinos.js` concentra la correspondencia nivel → bucket.

### Función de cada bucket
| Bucket | Carpetas dentro | Quién escribe | Quién lo lee |
|---|---|---|---|
| `nativa-seis-horas` | `seis-horas/`, `canario/` | la VM (clave de escritura) | vigilancia y ensayo (clave de lectura); restauración de emergencia |
| `nativa-diario` | `diario/` | la VM | ídem |
| `nativa-semanal` | `semanal/` | la VM | ídem |
Un nivel = un bucket = una retención. El canario vive con el nivel de 6 h porque se hace al mismo ritmo y no necesita retener más.

### Qué impide borrar un respaldo antes de tiempo (cada capa se prueba)
1. **Object Lock Compliance con retención por defecto** en los tres buckets: ni dueño ni B2 pueden borrar ni acortar. `verificar-b2.js` comprueba el modo, los días y que un archivo recién subido quede bloqueado y no se deje borrar ni con la clave de administración.
2. **Ningún permiso de borrado ni de retención.** La clave de escritura es de **lista blanca**: sólo `writeFiles` (se tolera `listBuckets`, que muestra nombres); cualquier otro permiso, previsto o no (`deleteFiles`, `writeFileRetentions`, `listKeys`…), hace fallar la verificación. La de lectura sólo puede listar/leer. El cliente de subida ni siquiera tiene código para borrar.
3. **Ciclo de vida:** **todas** las reglas de cada bucket deben ocultar después de que venza la retención (2→3 d, 7→8 d, 28→29 d) y borrar un día después; una regla de prefijo más corta que la retención es falla, y tiene que existir una regla general que de verdad limpie.
4. **Nombres y versiones:** las rutas son `nivel/AAAAMMDDTHHMMSSZ-seqN-huella`, con fecha y huella, así que no se repiten. Si aun así se subiera dos veces el mismo nombre, B2 agrega una versión nueva y **no reemplaza ni desbloquea la anterior** (probado en el simulador; en B2 real, sin verificar). El destino local de pruebas, además, se niega a pisar.
5. **Sólo lo comprobable al instante:** que el ciclo de vida borre de verdad pasado el plazo se confirma a mano (§7, paso 7).

## 5. Dónde está cada cosa
```
operaciones/respaldos/
  respaldar.js          orquestador (--auto | --nivel seis-horas,diario,semanal,canario | --forzar | --ahora ISO)
  restaurar.js          restaurar / ensayar un paquete
  verificar-copia.js    audita una carpeta (proceso aparte)
  vigilar.js            vigilancia externa (GitHub Actions)
  ensayo.js             ensayo del canario (GitHub Actions / a mano)
  verificar-b2.js       comprueba la configuración real de B2
  respaldo.env.ejemplo  variables (sin valores)
  lib/                  copia, verificación, paquete, cifrado, B2, destinos, alertas, secretos, config
operaciones/systemd/    nativa-respaldo.{service,timer}, nativa-respaldo-fallo.service, nativa-juego.service (ejemplo)
operaciones/caddy/      Caddyfile.ejemplo
.github/workflows/vigilancia-respaldos.yml   apagado hasta definir la variable RESPALDOS_ACTIVOS=true
pruebas/respaldos.js    119 comprobaciones (≈50 s); pruebas/ayudas/{b2-falso,escritor}.js
```
Sólo hace falta `node ≥ 20` (ya requerido), `age` y `tar` (`apt install age`). Sin dependencias de npm.

## 6. Restaurar (el servidor, si Oracle apaga o elimina la máquina)
Los respaldos viven en B2, **no dependen de Oracle ni de tu computadora**; el servidor se reconstruye con el código que viaja dentro del respaldo.
1. **Máquina apagada pero existente:** encenderla. Nada que restaurar.
2. **VM eliminada, cuenta de Oracle viva:** crear otra VM (misma región), instalar `node`, `age`, Caddy; bajar el último `.tar.gz.age` y su `.json` de `nativa-seis-horas` (o diario/semanal) con la clave de lectura; pegar **a mano** la clave maestra en un archivo temporal; `node restaurar.js --archivo X.tar.gz.age --meta X.json --identidad clave.txt --datos /var/lib/nativa --codigo-destino /opt/nativa`; borrar la clave del disco; crear `/etc/nativa/juego.env` con `NATIVA_ADMIN_TOKEN` y `NATIVA_SESION_CLAVE` del gestor de contraseñas; arrancar `nativa-juego.service`; apuntar DuckDNS a la IP nueva (`docs/DOMINIO.md`).
3. **Cuenta de Oracle perdida:** igual en cualquier VPS con Linux (Node ≥ 20 y age); el respaldo no depende del proveedor.
- **Punto de recuperación (RPO):** se pierde lo editado desde la última copia: hasta 6 h (más lo que tarde en detectarse). Para bajarlo, se puede aumentar la frecuencia; cada copia extra cuesta sólo almacenamiento.
- `restaurar.js` abre el mundo con el código y el Node **del respaldo** y exige la misma huella; si el Node de la máquina nueva es de otra versión mayor, avisa.

## 7. Pasos manuales cuando se decida contratar (no hechos)
### Oracle
1. Crear cuenta, elegir la región de origen **(no se puede cambiar; las Always Free sólo viven allí; sin verificar si Querétaro/Monterrey ofrecen la forma gratis)**.
2. Crear la VM, **reservar IP pública**, abrir 80/443 y cerrar el resto (SSH sólo desde tu IP).
3. Usuarios `nativa` y `nativa-respaldo` (grupo `nativa`); `/var/lib/nativa` con `UMask=0027`; `apt install age`; copiar el repositorio a `/opt/nativa`.
4. Poner un **presupuesto/alerta de costos** y fijar a mano la edad de la VM: revisar el estado de «recuperación de instancias inactivas» (documentación contradictoria, ver estudio previo).
5. Instalar las unidades de `operaciones/systemd/`, `systemctl enable --now nativa-juego nativa-respaldo.timer`, y Caddy con el `Caddyfile`.
### Backblaze B2
1. Crear cuenta (puede pedir tarjeta; sin verificar). Activar **autenticación en dos pasos**.
2. Crear **tres buckets privados** con Object Lock **activado desde la creación**, modo **Compliance**, retención por defecto 2 / 7 / 28 días, y las reglas de ciclo de vida de la tabla del §4. *(La documentación se contradice sobre si Object Lock se puede activar después: por eso, desde la creación.)*
3. Crear las claves de aplicación de §3: **escritura** (sólo `writeFiles`) y **lectura** (listar/leer/leer retenciones/listar buckets); **sin `deleteFiles`, sin `writeFileRetentions`, sin `bypassGovernance`**. *(Sin verificar si B2 deja limitar una clave a tres buckets; si no, se usan tres claves o se ajusta `destinos.js`: `verificar-b2.js` lo dirá.)*
4. Generar **tres pares age** (`age-keygen`): maestra (offline), reserva (otro lugar), verificador. Guardar las privadas fuera de GitHub y de Oracle.
5. Poner las claves **públicas** y la clave de escritura en `/etc/nativa-respaldo/respaldo.env` (modo 600).
6. En GitHub: secretos `B2_ID_LECTURA`, `B2_CLAVE_LECTURA`, `NATIVA_VERIFICADOR_IDENTIDAD`; variable `RESPALDOS_ACTIVOS=true`.
7. **Correr `verificar-b2.js` con las tres claves** (la de administración puede ser una temporal) y **no seguir hasta que diga «TODO COMO SE ESPERABA»**; guardar la fecha para revisar el ciclo de vida a los ~4 días (el archivo `_verificacion/…` debe haberse ocultado y borrado).
8. Primera corrida a mano: `node respaldar.js --auto`; luego `vigilar.js`; después **un ensayo humano completo con la clave maestra** (`restaurar.js … --solo-verificar`) y repetirlo **cada trimestre** y tras cualquier cambio de claves.
9. Provocar una falla a propósito (apagar el temporizador un día) y comprobar que **llega** la alarma de GitHub. Un aviso que nunca se probó no cuenta.

## 8. Riesgos pendientes (honestos)
- **B2 real sin probar.** El cliente y `verificar-b2.js` se probaron contra un simulador escrito por mí a partir de la documentación; puede diferir del servicio. Sin verificar: claves limitadas a varios buckets; que una clave sin `deleteFiles` reciba exactamente 401 al borrar; el campo exacto de retención por defecto en `b2_list_buckets`; que la retención por defecto se aplique a las subidas de la API nativa tal como espero.
- **La clave maestra es un punto único de fallo humano:** perderla (y la de reserva) deja todos los respaldos ilegibles. Mitigación: dos claves, en dos sitios, y ensayo trimestral.
- **Retención Compliance = no se puede borrar un error.** Un bug que suba respaldos enormes costaría hasta que venza la retención.
- **Vigilancia dependiente de GitHub:** los flujos programados pueden retrasarse o, en repositorios públicos, desactivarse tras 60 días sin actividad. Mitigación: avisos de la propia VM y del aviso HTTP; ensayo semanal.
- **Oracle:** la política de recuperación de instancias inactivas y la disponibilidad Free Tier en México siguen sin confirmarse; la VM puede perderse sin aviso. Los respaldos están pensados para eso, con RPO de hasta 6 h.
- **Concurrencia no medida al extremo:** se probó con un escritor intenso pero no a velocidad máxima sostenida; el sistema depende de la auditoría + reintentos, no del orden de copia. Con un mundo mucho mayor, la auditoría tardará más y gastará más memoria (tope `NATIVA_RESPALDO_MEMORIA_MB`, 384 MB): medir con datos reales.
- **Fuera del respaldo a propósito:** secretos del juego, la configuración de Caddy/DNS y `respaldo.env`. Hay que tenerlos en el gestor de contraseñas.
- **Sin cobertura de errores lógicos del juego:** un respaldo conserva el historial tal cual, incluidos cambios no deseados de un jugador; deshacer/restaurar versiones del propio juego sigue siendo la herramienta para eso.

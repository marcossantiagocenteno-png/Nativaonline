#!/usr/bin/env bash
# Nativa Online — prepara una máquina Debian/Ubuntu para el servidor (Oracle u otro Linux). Repetible: correrlo otra vez no pisa nada que ya exista.
# NO crea cuentas, NO toca DNS, NO pone secretos, NO enciende nada salvo que se pida (--habilitar). Los secretos los pones tú a mano en /etc/nativa/juego.env.
#
#   sudo ./instalar.sh --commit <SHA completo de 40 caracteres> --dominio NOMBRE.duckdns.org [--repo URL] [--habilitar] [--habilitar-respaldos]
#
#   --commit   el commit EXACTO que se instala (un SHA, no una rama): lo que se probó es lo que corre.
#   --repo     de dónde bajar el código (por defecto el repositorio público de GitHub).
#   --habilitar            enciende el juego y Caddy, pero SÓLO si /etc/nativa/juego.env está completo (sin marcadores de ejemplo).
#   --habilitar-respaldos  enciende el temporizador de respaldos, pero SÓLO si respaldo.env está completo.
# Para pruebas (no hace nada en el sistema; muestra lo que haría y crea los archivos bajo una carpeta):
#   NV_RAIZ=/tmp/prueba ./instalar.sh --simular --commit ... --dominio ... --repo /ruta/a/un/repositorio
# SIN PROBAR en una máquina real: no hay VM todavía. La primera vez, leerlo entero y correrlo con --simular en la propia máquina.
set -euo pipefail

RAIZ="${NV_RAIZ:-}"; SIMULAR=0; HABILITAR=0; HABILITAR_RESP=0; COMMIT=""; DOMINIO=""; REPO="https://github.com/marcossantiagocenteno-png/Nativaonline.git"
while [ $# -gt 0 ]; do case "$1" in
  --commit) COMMIT="${2:-}"; shift 2;; --dominio) DOMINIO="${2:-}"; shift 2;; --repo) REPO="${2:-}"; shift 2;;
  --simular) SIMULAR=1; shift;; --habilitar) HABILITAR=1; shift;; --habilitar-respaldos) HABILITAR_RESP=1; shift;;
  *) echo "opción desconocida: $1" >&2; exit 2;; esac; done

die(){ echo "ERROR: $*" >&2; exit 1; }
p(){ echo "${RAIZ}$1"; }                                   # ruta bajo la raíz de pruebas (vacía = sistema real)
sistema(){ if [ "$SIMULAR" = 1 ]; then echo "[simular] $*"; else "$@"; fi; }   # lo que cambiaría el sistema real
[[ "$COMMIT" =~ ^[0-9a-f]{40}$ ]] || die "--commit tiene que ser un SHA completo de 40 caracteres (no una rama)"
[[ "$DOMINIO" =~ ^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}$ ]] || die "--dominio no parece un nombre de dominio (ej. nombre.duckdns.org)"
[ -n "$RAIZ" ] && [ "$SIMULAR" = 0 ] && die "NV_RAIZ sólo se usa con --simular"
if [ "$SIMULAR" = 0 ]; then [ "$(id -u)" = 0 ] || die "hay que correrlo como root (sudo)"; fi

# ---- requisitos que NO se instalan solos (para no descargar y ejecutar cosas sin que las revises)
if [ "$SIMULAR" = 0 ]; then
  command -v node >/dev/null || die "falta Node.js >= 20. Instálalo (por ejemplo desde el repositorio oficial de NodeSource o con tu gestor) y repite."
  [ "$(node -p 'process.versions.node.split(".")[0]')" -ge 20 ] || die "Node.js es demasiado viejo: hace falta >= 20 (hay $(node -v))"
  command -v caddy >/dev/null || die "falta Caddy. Instálalo siguiendo la guía oficial (caddyserver.com/docs/install) y repite."
  command -v age  >/dev/null || sistema apt-get install -y age
  command -v git  >/dev/null || sistema apt-get install -y git
  command -v tar  >/dev/null || sistema apt-get install -y tar
fi

# ---- usuarios y grupos (sin shell, sin carpeta personal)
sistema bash -c 'getent group nativa >/dev/null || groupadd --system nativa'
sistema bash -c 'id nativa >/dev/null 2>&1 || useradd --system --gid nativa --no-create-home --shell /usr/sbin/nologin nativa'
sistema bash -c 'id nativa-respaldo >/dev/null 2>&1 || useradd --system --gid nativa --no-create-home --shell /usr/sbin/nologin nativa-respaldo'

# ---- carpetas y permisos
mkdir -p "$(p /opt/nativa)" "$(p /var/lib/nativa)" "$(p /var/lib/nativa-respaldo)" "$(p /etc/nativa)" "$(p /etc/nativa-respaldo)" "$(p /etc/systemd/system)" "$(p /etc/caddy)"
chmod 0755 "$(p /opt/nativa)"; chmod 0750 "$(p /var/lib/nativa)" "$(p /var/lib/nativa-respaldo)"; chmod 0700 "$(p /etc/nativa)" "$(p /etc/nativa-respaldo)"
sistema chown nativa:nativa /var/lib/nativa; sistema chmod g+s /var/lib/nativa
sistema chown nativa-respaldo:nativa /var/lib/nativa-respaldo

# ---- código: ese commit exacto
if [ ! -d "$(p /opt/nativa)/.git" ]; then git clone --quiet "$REPO" "$(p /opt/nativa)"; else git -C "$(p /opt/nativa)" fetch --quiet origin 2>/dev/null || git -C "$(p /opt/nativa)" fetch --quiet "$REPO"; fi
git -C "$(p /opt/nativa)" cat-file -e "$COMMIT^{commit}" 2>/dev/null || die "el commit $COMMIT no está en $REPO (¿se subió?)"
git -C "$(p /opt/nativa)" checkout --quiet --detach "$COMMIT"
[ "$(git -C "$(p /opt/nativa)" rev-parse HEAD)" = "$COMMIT" ] || die "el código no quedó en el commit pedido"
[ -z "$(git -C "$(p /opt/nativa)" status --porcelain --untracked-files=no)" ] || die "/opt/nativa tiene cambios locales: el código instalado no es el del commit"
# única dependencia del servidor (ws). node_modules no viaja en los respaldos: se instala siempre así.
sistema bash -c "cd '/opt/nativa/servidor' && npm ci --omit=dev"
sistema chown -R root:root /opt/nativa

# ---- archivos de configuración: SÓLO si no existen (nunca se pisan) y siempre sin secretos
if [ ! -e "$(p /etc/nativa/juego.env)" ]; then
  ( umask 077; cat > "$(p /etc/nativa/juego.env)" ) <<'PLANTILLA'
# Secretos y configuración del juego. Modo 600, dueño root; NO va a ningún respaldo ni al repositorio.
# Genera los dos valores con:  node /opt/nativa/servidor/generar-claves.js   (los muestra por pantalla y no guarda nada)
# Guárdalos en tu gestor de contraseñas y quita el «# » de cada línea al rellenarla. Mientras estén comentadas el servidor se NIEGA a arrancar (a propósito).
# NATIVA_ADMIN_TOKEN=<la contraseña de administrador, mínimo 16 caracteres>
# NATIVA_SESION_CLAVE=<la clave de firma de sesiones, mínimo 32 caracteres y distinta de la contraseña>
# NATIVA_ORIGENES=https://marcossantiagocenteno-png.github.io
PLANTILLA
fi
if [ ! -e "$(p /etc/nativa-respaldo/respaldo.env)" ]; then cp "$(p /opt/nativa)/operaciones/respaldos/respaldo.env.ejemplo" "$(p /etc/nativa-respaldo/respaldo.env)"; chmod 0600 "$(p /etc/nativa-respaldo/respaldo.env)"; fi
chmod 0600 "$(p /etc/nativa/juego.env)" "$(p /etc/nativa-respaldo/respaldo.env)"

# ---- unidades de systemd (se copian del commit instalado)
for u in nativa-juego.service nativa-respaldo.service nativa-respaldo.timer nativa-respaldo-fallo.service; do
  cp "$(p /opt/nativa)/operaciones/systemd/$u" "$(p /etc/systemd/system/$u)"; chmod 0644 "$(p /etc/systemd/system/$u)"; done
sistema systemctl daemon-reload

# ---- Caddy: la plantilla con el nombre; se valida antes de recargar y se guarda copia del archivo anterior
NUEVO="$(p /etc/caddy/Caddyfile).nuevo"; sed "s/__DOMINIO__/$DOMINIO/g" "$(p /opt/nativa)/operaciones/caddy/Caddyfile.plantilla" > "$NUEVO"
if [ -e "$(p /etc/caddy/Caddyfile)" ] && ! cmp -s "$NUEVO" "$(p /etc/caddy/Caddyfile)"; then cp "$(p /etc/caddy/Caddyfile)" "$(p /etc/caddy/Caddyfile).anterior-$(date +%Y%m%d%H%M%S)"; fi
mv "$NUEVO" "$(p /etc/caddy/Caddyfile)"; chmod 0644 "$(p /etc/caddy/Caddyfile)"   # lo lee el usuario de Caddy
sistema caddy validate --config /etc/caddy/Caddyfile

# ---- encender (sólo si se pide y sólo si la configuración está completa)
# «incompleto» = no hay línea activa (sin «# »), o es más corta que el mínimo, o todavía trae un marcador <así>
vacio(){ ! { grep -E "^$1=" "$(p /etc/nativa/juego.env)" | grep -Ev "<" | grep -Eq "^$1=.{${2:-1},}"; }; }
if [ "$HABILITAR" = 1 ]; then
  vacio NATIVA_ADMIN_TOKEN 16 && die "NATIVA_ADMIN_TOKEN falta o es corto en /etc/nativa/juego.env: no se enciende"
  vacio NATIVA_SESION_CLAVE 32 && die "NATIVA_SESION_CLAVE falta o es corta en /etc/nativa/juego.env: no se enciende"
  vacio NATIVA_ORIGENES 8 && die "NATIVA_ORIGENES falta en /etc/nativa/juego.env: no se enciende"
  sistema systemctl enable --now nativa-juego.service; sistema systemctl reload-or-restart caddy
fi
if [ "$HABILITAR_RESP" = 1 ]; then
  grep -Eq 'age1_PUBLICA|^B2_ID_ESCRITURA=$|^B2_CLAVE_ESCRITURA=$' "$(p /etc/nativa-respaldo/respaldo.env)" && die "respaldo.env todavía tiene valores de ejemplo o vacíos: no se enciende el temporizador"
  sistema systemctl enable --now nativa-respaldo.timer
fi
echo "listo. Commit instalado: $COMMIT · dominio: $DOMINIO · juego encendido: $([ $HABILITAR = 1 ] && echo sí || echo no) · respaldos encendidos: $([ $HABILITAR_RESP = 1 ] && echo sí || echo no)"

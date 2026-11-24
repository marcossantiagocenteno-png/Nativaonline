#!/usr/bin/env bash
# Publica UN commit ya probado en la rama `publicado` (la que sirve GitHub Pages). Nunca toca `main`, nunca fuerza el push, nunca fusiona.
#   uso: operaciones/publicacion/publicar.sh <commit> [--si]     (sin --si sólo muestra qué haría)
# Variables para pruebas: NV_REMOTO (por defecto origin), NV_RAMA (por defecto publicado).
set -euo pipefail
REMOTO="${NV_REMOTO:-origin}"; RAMA="${NV_RAMA:-publicado}"
COMMIT="${1:-}"; SI="${2:-}"
[ -n "$COMMIT" ] || { echo "uso: publicar.sh <commit> [--si]" >&2; exit 2; }
case "$RAMA" in main|master) echo "NO: esta herramienta jamás publica sobre $RAMA" >&2; exit 1;; esac
git rev-parse --git-dir >/dev/null 2>&1 || { echo "no estás dentro de un repositorio" >&2; exit 1; }
SHA=$(git rev-parse --verify --quiet "$COMMIT^{commit}") || { echo "el commit «$COMMIT» no existe" >&2; exit 1; }
[ -z "$(git status --porcelain)" ] || { echo "hay cambios sin guardar: no se publica con el árbol sucio" >&2; exit 1; }
# el commit tiene que estar ya en el remoto (se publica lo que está subido y revisado, no algo local)
git fetch -q "$REMOTO" 2>/dev/null || true
if ! git branch -r --contains "$SHA" 2>/dev/null | grep -q "$REMOTO/"; then echo "el commit $SHA no está en ninguna rama de $REMOTO: súbelo primero" >&2; exit 1; fi
ACTUAL=$(git ls-remote --heads "$REMOTO" "$RAMA" | cut -f1 || true)
if [ -n "$ACTUAL" ] && ! git merge-base --is-ancestor "$ACTUAL" "$SHA" 2>/dev/null; then
  echo "«$RAMA» ($ACTUAL) no es un antecesor de $SHA: habría que forzar el push y esta herramienta no fuerza" >&2; exit 1; fi
echo "Publicaría $SHA en $REMOTO/$RAMA (hoy: ${ACTUAL:-no existe})"
git log -1 --format='  %h %s' "$SHA"
[ "$SI" = "--si" ] || { echo "(simulacro: no se hizo nada; repite con --si)"; exit 0; }
git push "$REMOTO" "$SHA:refs/heads/$RAMA"
echo "listo: $RAMA = $SHA"

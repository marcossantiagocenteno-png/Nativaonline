#!/bin/sh
# Pone la fecha y hora como versión visible en el pie del juego, para saber de un
# vistazo si lo que se está mirando es lo último. Correr antes de cada commit.
V=$(date +%d/%m\ %H:%M)
sed -i "s|NVi.VERSION='[^']*'|NVi.VERSION='$V'|" src/juego/interfaz.js
echo "sellado con $V"

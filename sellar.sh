#!/bin/sh
# Pone la fecha y hora como versión de cada archivo, para que ningún navegador
# sirva una copia vieja. Correr antes de cada commit que toque src/.
V=$(date +%Y%m%d%H%M)
sed -i "s/?v=[0-9]*\"/?v=$V\"/g" index.html
echo "sellado con $V"

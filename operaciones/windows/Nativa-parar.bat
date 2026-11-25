@echo off
rem Apaga el servidor de Nativa Online (limpio)
node "%~dp0nativa.js" parar %*
echo.
pause

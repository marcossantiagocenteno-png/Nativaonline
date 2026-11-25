@echo off
rem Qué hay y qué falta
node "%~dp0nativa.js" verificar %*
echo.
pause

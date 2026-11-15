@echo off
setlocal
cd /d "%~dp0"
call npm run demo:simulador --prefix data-kit
if errorlevel 1 goto error
start "" "%~dp0kawsay-simulador.html"
exit /b 0
:error
echo No se pudo generar el simulador. Se requiere Node.js 24.13 o superior.
pause

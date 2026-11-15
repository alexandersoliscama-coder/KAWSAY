@echo off
setlocal
cd /d "%~dp0"
node data-kit\scripts\demo-url.mjs --check
if not errorlevel 1 goto activo
call npm run build --prefix data-kit
if errorlevel 1 goto error
call npm run build:api --prefix data-kit
if errorlevel 1 goto error
echo Abre esta direccion:
node data-kit\scripts\demo-url.mjs
echo Manten esta ventana abierta. Ctrl+C para detener.
call npm run demo --prefix data-kit
goto error
:activo
echo El servidor ya esta activo. Abre:
node data-kit\scripts\demo-url.mjs
:error
pause

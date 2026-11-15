@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo No se encontro Node.js. Instala Node.js y vuelve a intentar.
  pause
  exit /b 1
)
echo Vista de astronauta y personal medico:
node data-kit\scripts\demo-url.mjs --users
node data-kit\scripts\demo-url.mjs --check
if not errorlevel 1 goto activo
call npm run build --prefix data-kit
if errorlevel 1 goto fin
call npm run build:api --prefix data-kit
if errorlevel 1 goto fin
echo Manten esta ventana abierta. Para detener: Ctrl+C.
call npm run demo --prefix data-kit
goto fin
:activo
echo KAWSAY ya esta activo. Abre la direccion indicada arriba.
:fin
pause

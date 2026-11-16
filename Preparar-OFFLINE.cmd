@echo off
rem Ejecutar UNA vez, CON internet. Deja todo listo para trabajar despues sin conexion.
setlocal
cd /d "%~dp0"
set MODELO=qwen3:4b
where node >nul 2>&1 || (echo Falta Node.js: https://nodejs.org & pause & exit /b 1)
where python >nul 2>&1 || (echo Falta Python: https://www.python.org/downloads/ & pause & exit /b 1)
where ollama >nul 2>&1 || (echo Falta Ollama: https://ollama.com/download & pause & exit /b 1)
echo [1/4] Instalando dependencias de Node...
call npm ci --prefix data-kit || (pause & exit /b 1)
echo [2/4] Compilando interfaz...
call npm run build --prefix data-kit || (pause & exit /b 1)
echo [3/4] Compilando API...
call npm run build:api --prefix data-kit || (pause & exit /b 1)
echo [4/4] Descargando el modelo de IA %MODELO% ^(unos 2.5 GB^)...
ollama pull %MODELO% || (pause & exit /b 1)
echo.
echo Listo. Desde ahora usa Iniciar-KAWSAY-OFFLINE.cmd, sin internet.
pause

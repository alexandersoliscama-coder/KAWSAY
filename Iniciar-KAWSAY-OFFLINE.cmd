@echo off
rem Inicia KAWSAY sin internet: interfaz, motor NEWS2, API SQL embebida y Monitor IA con Ollama local.
rem Requiere haber ejecutado Preparar-OFFLINE.cmd una vez con internet.
setlocal
cd /d "%~dp0"
set MODELO=qwen3:4b
where node >nul 2>&1 || (echo Falta Node.js & pause & exit /b 1)
where python >nul 2>&1 || (echo Falta Python & pause & exit /b 1)
if not exist "data-kit\node_modules" (echo Falta preparar. Ejecuta Preparar-OFFLINE.cmd una vez con internet. & pause & exit /b 1)
if not exist "data-kit\dist\index.html" (echo Falta compilar. Ejecuta Preparar-OFFLINE.cmd una vez con internet. & pause & exit /b 1)
if not exist "data-kit\.api-dist\demo.mjs" (echo Falta compilar la API. Ejecuta Preparar-OFFLINE.cmd una vez con internet. & pause & exit /b 1)
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\Ollama-Listo.ps1 -Model %MODELO%
if errorlevel 1 (echo.& echo La IA no esta lista. La interfaz funciona igual, pero sin reportes de IA. Continuar? & pause)
echo Iniciando el Monitor IA ^(Python^) en otra ventana...
start "KAWSAY - Monitor IA (Python)" cmd /k "cd /d %~dp0 && python llm-service/service.py --model %MODELO%"
echo.
echo KAWSAY sin internet: http://127.0.0.1:4180/
echo Manten abiertas las ventanas. Para detener: Ctrl+C en cada una.
start "" http://127.0.0.1:4180/
call npm run demo --prefix data-kit
pause

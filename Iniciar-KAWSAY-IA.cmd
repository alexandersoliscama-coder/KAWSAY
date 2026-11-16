@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1 || (echo No se encontro Node.js. Instalalo desde https://nodejs.org & pause & exit /b 1)
where python >nul 2>&1 || (echo No se encontro Python. Instalalo desde https://www.python.org/downloads/ & pause & exit /b 1)
where ollama >nul 2>&1 || (echo No se encontro Ollama. Instalalo desde https://ollama.com/download ^(la interfaz funciona sin el, pero no habra reportes de IA^))
if not exist "data-kit\node_modules" (
  echo Instalando dependencias...
  call npm ci --prefix data-kit || (pause & exit /b 1)
)
echo Compilando interfaz y API...
call npm run build --prefix data-kit || (pause & exit /b 1)
call npm run build:api --prefix data-kit || (pause & exit /b 1)
echo Iniciando el Monitor IA ^(Python + Ollama^) en otra ventana...
start "KAWSAY - Monitor IA (Python)" cmd /k "cd /d %~dp0 && python llm-service/service.py --model qwen3:4b"
echo.
echo KAWSAY integrado: interfaz, motor NEWS2 ^(borrador^), API SQL y Monitor IA en el mismo puerto.
echo Interfaz:   http://127.0.0.1:4180/
echo Laboratorio SQL: http://127.0.0.1:4180/pruebas.html
echo Manten abiertas las dos ventanas. Para detener: Ctrl+C en cada una.
start "" http://127.0.0.1:4180/
call npm run demo --prefix data-kit
pause

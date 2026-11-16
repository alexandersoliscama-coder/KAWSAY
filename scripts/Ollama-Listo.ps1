# Ollama-Listo.ps1 — Comprueba (sin internet) que Ollama y el modelo estén listos y precarga el modelo en memoria.
# Uso: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/Ollama-Listo.ps1 -Model qwen3:4b
param([string]$Model = "qwen3:4b", [int]$EsperaSegundos = 40)
$ErrorActionPreference = "Stop"
$api = "http://127.0.0.1:11434"
function Probar { try { Invoke-RestMethod "$api/api/tags" -TimeoutSec 2 -Proxy $null | Out-Null; return $true } catch { return $false } }

if (-not (Probar)) {
    if (-not (Get-Command ollama -ErrorAction SilentlyContinue)) {
        Write-Host "No se encontro Ollama. Instalalo con internet una vez: https://ollama.com/download"; exit 2
    }
    Write-Host "Iniciando Ollama local..."
    Start-Process -FilePath "ollama" -ArgumentList "serve" -WindowStyle Minimized
    $limite = (Get-Date).AddSeconds($EsperaSegundos)
    while (-not (Probar) -and (Get-Date) -lt $limite) { Start-Sleep -Seconds 1 }
    if (-not (Probar)) { Write-Host "Ollama no respondio en $EsperaSegundos s. Abre la aplicacion Ollama y vuelve a intentar."; exit 3 }
}

$modelos = (Invoke-RestMethod "$api/api/tags" -TimeoutSec 5 -Proxy $null).models | ForEach-Object { $_.name }
if (-not ($modelos -contains $Model)) {
    Write-Host "El modelo '$Model' no esta descargado. Con internet, una sola vez: ollama pull $Model"
    Write-Host "Modelos disponibles: $($modelos -join ', ')"; exit 4
}

Write-Host "Cargando '$Model' en memoria (la primera vez puede tardar)..."
$cuerpo = @{ model = $Model; keep_alive = "30m" } | ConvertTo-Json
try {
    Invoke-RestMethod "$api/api/generate" -Method Post -Body $cuerpo -ContentType "application/json" -TimeoutSec 300 -Proxy $null | Out-Null
    Write-Host "Modelo listo. Funciona sin internet, solo con los recursos de esta PC."
} catch {
    Write-Host "No se pudo precargar el modelo: $($_.Exception.Message). Se cargara en el primer reporte (puede tardar)."
}
exit 0

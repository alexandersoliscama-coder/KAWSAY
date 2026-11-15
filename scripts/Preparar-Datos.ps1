param([switch]$SkipInstall)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $projectRoot
try {
    python data-gen/generate.py
    if ($LASTEXITCODE -ne 0) { throw 'No se pudieron generar los datos.' }
    python data-gen/generate.py --check
    if ($LASTEXITCODE -ne 0) { throw 'Los datos no coinciden con el generador.' }
    python -m unittest discover -s data-gen -v
    if ($LASTEXITCODE -ne 0) { throw 'Fallaron las pruebas del generador.' }
    Push-Location -LiteralPath (Join-Path $projectRoot 'data-kit')
    try {
        if (-not $SkipInstall) {
            npm ci
            if ($LASTEXITCODE -ne 0) { throw 'No se pudieron instalar las dependencias.' }
        }
        foreach ($check in @('test', 'typecheck', 'build')) {
            npm run $check
            if ($LASTEXITCODE -ne 0) { throw "Fallo en npm run $check" }
        }
    } finally { Pop-Location }
    Write-Host 'Listo. Para abrir la vista: npm run preview --prefix data-kit'
} finally { Pop-Location }

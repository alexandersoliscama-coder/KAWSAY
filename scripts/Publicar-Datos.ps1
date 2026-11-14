# Run after restoring your own GitHub authentication / repository permissions.
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $projectRoot
try {
    $branch = git branch --show-current
    if ($LASTEXITCODE -ne 0 -or $branch -notin @('datos-generador', 'Datos-|-GENERADOR')) {
        throw 'Ejecuta este script desde la rama local de datos. Nunca publica main.'
    }
    $remote = git remote get-url origin
    if ($LASTEXITCODE -ne 0 -or $remote -notmatch '^https://github\.com/alexandersoliscama-coder/KAWSAY(?:\.git)?$') {
        throw 'origin no corresponde al repositorio KAWSAY del equipo.'
    }
    $dirty = git status --porcelain
    if ($dirty) { throw 'Hay cambios sin commit. Revísalos antes de publicar.' }
    git fetch origin 'refs/heads/Datos-|-GENERADOR'
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo leer la rama remota; revisa tu acceso.' }
    git merge-base --is-ancestor FETCH_HEAD HEAD
    if ($LASTEXITCODE -ne 0) { throw 'La rama remota avanzó. Integra sus cambios antes de publicar; no se sobrescribirá.' }
    git push origin 'HEAD:refs/heads/Datos-|-GENERADOR'
    if ($LASTEXITCODE -ne 0) { throw 'GitHub no aceptó el envío. Revisa autenticación y permisos de escritura.' }
    Write-Host 'Publicado en Datos-|-GENERADOR. main no fue modificado.'
} finally { Pop-Location }

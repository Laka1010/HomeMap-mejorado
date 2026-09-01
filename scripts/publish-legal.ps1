<#
  Publica los documentos legales (public/privacy-policy.html y public/terms.html)
  en la rama `gh-pages`, que GitHub Pages sirve como sitio estático.

      powershell -ExecutionPolicy Bypass -File scripts\publish-legal.ps1

  Qué hace:
    1. Copia los dos HTML + un index.html a un directorio temporal.
    2. Recrea la rama huérfana `gh-pages` con solo esos archivos.
    3. La sube a origin (fuerza, porque es una rama de una sola versión).

  Ejecútalo cada vez que cambies los textos legales. La primera vez, además,
  hay que activar Pages una sola vez:
    Settings > Pages > Deploy from a branch > gh-pages > / (root) > Save
#>
$ErrorActionPreference = 'Stop'

$repo = Split-Path $PSScriptRoot -Parent
$work = Join-Path $env:TEMP "haven-legal-$([guid]::NewGuid().ToString('N').Substring(0,8))"
New-Item -ItemType Directory -Path $work | Out-Null

Copy-Item (Join-Path $repo 'public\privacy-policy.html') $work
Copy-Item (Join-Path $repo 'public\terms.html') $work

@'
<!doctype html>
<html lang="es"><head><meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Haven — Documentos legales</title>
<style>body{font-family:Arial,Helvetica,sans-serif;margin:0;padding:24px;background:#f6f7f5;color:#1b1d1f;line-height:1.6}
.wrap{max-width:760px;margin:0 auto;background:#fff;border-radius:18px;padding:24px;box-shadow:0 6px 24px rgba(0,0,0,.06)}
h1{margin-top:0}ul{padding-left:20px}li{font-size:15px;margin:8px 0}a{color:#2f6f4f}.muted{color:#6b6b6b;font-size:13px}</style>
</head><body><div class="wrap"><h1>Haven</h1>
<p>Aplicación de organización del hogar. Documentos legales:</p>
<ul><li><a href="./privacy-policy.html">Política de privacidad</a></li>
<li><a href="./terms.html">Términos de servicio</a></li></ul>
<p class="muted">Contacto: <a href="mailto:havenhome.app1@gmail.com">havenhome.app1@gmail.com</a></p>
</div></body></html>
'@ | Set-Content -Encoding utf8 (Join-Path $work 'index.html')

New-Item -ItemType File -Path (Join-Path $work '.nojekyll') | Out-Null

Push-Location $repo
try {
  $current = git rev-parse --abbrev-ref HEAD
  git worktree add --force -B gh-pages (Join-Path $work '_wt') 2>&1 | Out-Null
  Get-ChildItem (Join-Path $work '_wt') -Force | Where-Object { $_.Name -ne '.git' } | Remove-Item -Recurse -Force
  Copy-Item (Join-Path $work '*.html') (Join-Path $work '_wt')
  Copy-Item (Join-Path $work '.nojekyll') (Join-Path $work '_wt')
  Push-Location (Join-Path $work '_wt')
  try {
    git add -A
    git commit -m "Actualiza documentos legales" --allow-empty | Out-Null
    git push -f origin gh-pages
  } finally { Pop-Location }
  git worktree remove --force (Join-Path $work '_wt')
  Write-Host "OK: gh-pages actualizada y subida." -ForegroundColor Green
  Write-Host "URLs (tras activar Pages una vez):" -ForegroundColor Green
  Write-Host "  https://laka1010.github.io/HomeMap-mejorado/privacy-policy.html"
  Write-Host "  https://laka1010.github.io/HomeMap-mejorado/terms.html"
} finally {
  Pop-Location
  Remove-Item -Recurse -Force $work -ErrorAction SilentlyContinue
}

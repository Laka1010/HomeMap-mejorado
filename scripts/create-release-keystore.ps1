<#
  Crea el keystore de firma de release para Haven (una sola vez).

  IMPORTANTE: ejecútalo en TU propia ventana de PowerShell, no con el botón
  "Run" del chat: keytool pide la contraseña de forma interactiva y hay que
  teclearla a mano.

      powershell -ExecutionPolicy Bypass -File scripts\create-release-keystore.ps1

  keytool te pedirá:
    - "Enter keystore password"  -> elige una (mín. 6 caracteres) y apúntala
    - "Re-enter new password"     -> repítela
    - "Enter key password for <haven-release>" -> pulsa ENTER para reutilizar
      la misma contraseña del almacén (recomendado)

  Después: edita android\keystore.properties y pon esa contraseña en
  storePassword y keyPassword. Guarda el .jks y la contraseña en un sitio
  seguro (gestor de contraseñas): sin ellos no podrás volver a actualizar la
  app en Google Play.
#>
$ErrorActionPreference = "Stop"

$keytool = "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe"
if (-not (Test-Path $keytool)) {
    $keytool = "keytool"  # fallback: usa el del PATH si Android Studio no está en la ruta por defecto
}

$repoRoot = Split-Path $PSScriptRoot -Parent
$out = Join-Path $repoRoot "android\release-keystore.jks"

if (Test-Path $out) {
    Write-Host "Ya existe $out - no se sobrescribe." -ForegroundColor Yellow
    Write-Host "Si de verdad quieres empezar de cero, borra ese archivo primero." -ForegroundColor Yellow
    exit 1
}

& $keytool -genkeypair -v `
    -keystore $out `
    -alias haven-release `
    -keyalg RSA -keysize 2048 -validity 10000 `
    -dname "CN=Haven"

if (-not (Test-Path $out)) {
    Write-Host ""
    Write-Host "El keystore NO se ha creado (keytool cancelado o contrasena invalida). Vuelve a ejecutar el script." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "OK: keystore creado en android\release-keystore.jks" -ForegroundColor Green
Write-Host "Siguiente paso: edita android\keystore.properties (storePassword y keyPassword) y ejecuta 'npm run android:bundle'." -ForegroundColor Green

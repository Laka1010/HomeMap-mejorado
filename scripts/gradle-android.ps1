<#
  Lanza una tarea de Gradle en android/ para los scripts `android:release`
  y `android:bundle` de package.json.

  El wrapper `gradlew.bat` necesita un JDK para arrancar (lee JAVA_HOME o
  `java` en el PATH). Si no hay ninguno definido, este script usa el JDK que
  trae Android Studio, para que `npm run android:bundle` funcione en una
  terminal limpia sin configurar nada.
#>
param([Parameter(Mandatory = $true)][string]$Task)

$ErrorActionPreference = 'Stop'

if (-not $env:JAVA_HOME) {
  $candidates = @(
    'C:\Program Files\Android\Android Studio\jbr',
    "$env:LOCALAPPDATA\Programs\Android Studio\jbr",
    'C:\Program Files\Android\Android Studio1\jbr'
  )
  $jbr = $candidates | Where-Object { Test-Path (Join-Path $_ 'bin\java.exe') } | Select-Object -First 1
  if ($jbr) {
    $env:JAVA_HOME = $jbr
    Write-Host "[gradle-android] JAVA_HOME -> $jbr"
  }
  else {
    Write-Error "No hay JAVA_HOME definido ni se encontró el JDK de Android Studio. Define JAVA_HOME (al JBR de Android Studio) o genera el bundle desde Android Studio: Build > Generate Signed Bundle / APK."
    exit 1
  }
}

Push-Location (Join-Path $PSScriptRoot '..\android')
try {
  & .\gradlew.bat $Task
  $code = $LASTEXITCODE
}
finally {
  Pop-Location
}
exit $code

# Preparación para Google Play Store

Este documento describe los pasos necesarios para preparar la app Haven para publicación en Google Play Store.

## 1. Firma de la app (release signing)

El proyecto ya contiene configuración de firma en `android/app/build.gradle` (lee `android/keystore.properties` si existe; si no, el build de release sale sin firmar).

1. **Crea el keystore** (una sola vez). En tu propia ventana de PowerShell:

   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts\create-release-keystore.ps1
   ```

   El script llama a `keytool` y crea `android/release-keystore.jks` con el alias `haven-release`. keytool te pedirá una contraseña de forma interactiva; apúntala.

2. **Rellena `android/keystore.properties`** (ya existe con placeholders): sustituye `PASSWORD_AQUI` por la contraseña que elegiste, en `storePassword` y `keyPassword`.

> `android/keystore.properties`, `*.jks` y `*.keystore` ya están en `.gitignore` (raíz y `android/.gitignore`). Guarda el keystore y la contraseña en un gestor de contraseñas: si los pierdes no podrás actualizar la app.

## 2. Generar el App Bundle firmado

Usa el siguiente comando desde la raíz del proyecto:

```powershell
npm run android:bundle
```

Esto ejecuta `npm run cap:sync` y luego `gradlew bundleRelease` en `android/`.

## 3. Ajustar versión para Play Store

Asegúrate de actualizar `versionCode` y `versionName` en `android/app/build.gradle` cada vez que subas una nueva versión.

## 4. Política de privacidad y términos

La app incluye `public/privacy-policy.html`, `public/terms.html` y
`public/eliminar-cuenta.html`, y **ya están publicados** en GitHub Pages
(rama `gh-pages`, generada por `scripts/publish-legal.ps1`):

- Política de privacidad: <https://laka1010.github.io/HomeMap-mejorado/privacy-policy.html>
- Términos: <https://laka1010.github.io/HomeMap-mejorado/terms.html>
- Eliminar cuenta (vía web externa a la app, exigida por Google Play): <https://laka1010.github.io/HomeMap-mejorado/eliminar-cuenta.html>

> Si editas los `.html` de `public/`, vuelve a ejecutar
> `powershell -ExecutionPolicy Bypass -File scripts/publish-legal.ps1` para
> republicar. Comprueba una vez que en GitHub → Settings → Pages la fuente sea
> `gh-pages` / `/ (root)`.

### Texto de la ficha (listo para pegar)

- **Nombre de la app:** `Haven`
- **Descripción corta (máx. 80):** `Organiza tu hogar: encuentra tus cosas y gestiona compras, tareas y gastos.`
- **Descripción larga:**

  ```
  Haven es la app para organizar tu casa y todo lo que pasa en ella, solo o en familia.

  • ¿Dónde está…? Registra habitaciones, zonas, cajas y objetos, y encuentra al instante dónde guardaste cada cosa.
  • Compras. Listas de la compra compartidas, con categorías e historial de lo que ya compraste.
  • Tareas. Reparte las tareas del hogar entre los miembros y no pierdas de vista lo pendiente.
  • Economía. Cuentas, gastos, ingresos y facturas recurrentes del hogar, con espacios separados y un espacio propio para los más pequeños.
  • Calendario. Pagos y eventos del hogar en un calendario que puedes suscribir desde Google o Apple Calendar.

  Comparte el acceso con tu familia o tus compañeros de piso con un código de invitación y cada quien ve lo que le corresponde según su rol.

  Disponible en español, catalán e inglés.
  ```

- **Categoría:** `Estilo de vida` (alternativa: `Productividad`)
- **Clasificación de contenido:** `Todos`
- **Correo de soporte:** `support@havenapp.es`
- **URL de política de privacidad:** `https://laka1010.github.io/HomeMap-mejorado/privacy-policy.html`
- **Data safety:** los datos (hogar, economía, compras) se almacenan en Supabase
  (proveedor de backend); no se comparten con terceros para publicidad; el
  usuario puede borrar su cuenta desde la propia app (Ajustes → Cuenta →
  Eliminar cuenta) o desde la web sin necesidad de acceder a la app
  (`eliminar-cuenta.html`, ver arriba).

## 5. Permisos y justificación

La app solo declara un permiso en `android/app/src/main/AndroidManifest.xml`:

- `android.permission.INTERNET`

(El Android Gradle Plugin añade automáticamente `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` en el manifest fusionado; es interno de la plataforma, no hay que declararlo ni justificarlo.)

No se piden cámara ni acceso a fotos: la función de fotos y el escaneo con IA se retiraron. Si en el futuro se reactiva el escaneo de tickets, habrá que volver a añadir `CAMERA` / `READ_MEDIA_IMAGES` y justificarlos en la ficha.

## 6. Checklist de publicación

Hecho:

- [x] Keystore creado y configurado (`android/release-keystore.jks`, en `.gitignore`)
- [x] `android/keystore.properties` con valores reales (fuera de git)
- [x] Página de privacidad, términos y eliminación de cuenta públicos (GitHub Pages, ver §4)
- [x] Datos de contacto y correo de soporte (`support@havenapp.es`)
- [x] Descripción corta y larga definidas (ver §4)
- [x] Versión sincronizada Android/iOS/`package.json` (`1.1.0`, `versionCode`/`build` 2)
- [x] Permisos revisados (solo `INTERNET`, ver §5)

Pendiente antes de subir:

- [ ] Build AAB generado y firmado (`npm run android:bundle`)
- [ ] Capturas de pantalla (mín. 2-4 por dispositivo; teléfono obligatorio)
- [ ] Icono de 512×512 y feature graphic de 1024×500
- [ ] Rellenar el formulario **Data safety** en Play Console (ver §4)
- [ ] Cuestionario de clasificación de contenido (IARC)
- [ ] **Supabase → Authentication → Policies:** activar *Leaked Password
      Protection* (comprobación contra HaveIBeenPwned). Es un toggle, sin
      cambio de código.
- [ ] Confirmar en GitHub → Settings → Pages que la fuente es `gh-pages` / root

## 7. Recursos de publicación

- Si necesitas una URL pública para la política de privacidad, puedes hostear `public/privacy-policy.html` en cualquier servicio de archivos estáticos (GitHub Pages, Netlify, Vercel, etc.).
- Sube el archivo generado `android/app/build/outputs/bundle/release/app-release.aab` a Play Console.

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

La app ya incluye:

- `public/privacy-policy.html`
- `public/terms.html`

Para la ficha de Play Store necesitarás una URL pública accesible por Google. Si no tienes hosting propio, puedes usar un servicio de páginas estáticas o vincular la app a una web pública que aloje estos archivos.

### Posible texto de la ficha

- Nombre de la app: `Haven`
- Descripción corta: `Organiza tu hogar, localiza tus objetos y gestiona compras, tareas y gastos.`
- Descripción larga: `Haven te ayuda a organizar habitaciones, cajas y objetos de tu hogar. Busca al instante dónde está cada cosa, comparte el acceso con tu familia o compañeros de piso y lleva las listas de la compra, las tareas y la economía del hogar en un solo sitio.`
- Categoría: `Productividad`
- Clasificación de contenido: `Todos`
- Correo de soporte: `havenhome.app1@gmail.com`
- URL de política de privacidad: `https://tudominio.com/privacy-policy.html`

## 5. Permisos y justificación

La app solo declara un permiso en `android/app/src/main/AndroidManifest.xml`:

- `android.permission.INTERNET`

(El Android Gradle Plugin añade automáticamente `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` en el manifest fusionado; es interno de la plataforma, no hay que declararlo ni justificarlo.)

No se piden cámara ni acceso a fotos: la función de fotos y el escaneo con IA se retiraron. Si en el futuro se reactiva el escaneo de tickets, habrá que volver a añadir `CAMERA` / `READ_MEDIA_IMAGES` y justificarlos en la ficha.

## 6. Checklist de publicación

- [ ] Keystore creado y configurado
- [ ] `android/keystore.properties` con valores reales
- [ ] Build AAB generado y firmado
- [ ] Capturas de pantalla de la app (mínimo 2-3)
- [ ] Icono adaptativo / feature graphic
- [ ] Página de privacidad pública
- [ ] Datos de contacto y correo de soporte
- [ ] Descripción corta y larga definidas
- [ ] Versión y `versionCode` actualizados
- [ ] Revisión de permisos y justificación correcta

## 7. Recursos de publicación

- Si necesitas una URL pública para la política de privacidad, puedes hostear `public/privacy-policy.html` en cualquier servicio de archivos estáticos (GitHub Pages, Netlify, Vercel, etc.).
- Sube el archivo generado `android/app/build/outputs/bundle/release/app-release.aab` a Play Console.

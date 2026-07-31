# Preparación para Google Play Store

Este documento describe los pasos necesarios para preparar la app Haven para publicación en Google Play Store.

## 1. Firma de la app (release signing)

El proyecto ya contiene configuración de firma en `android/app/build.gradle`. Antes de generar un build de producción:

1. Copia `android/keystore.properties.example` a `android/keystore.properties`.
2. Rellena con los valores reales de tu keystore:
   - `storeFile`: ruta al archivo JKS o keystore
   - `storePassword`: contraseña del almacén
   - `keyAlias`: alias de la clave
   - `keyPassword`: contraseña de la clave
3. Genera el archivo de firma (`.jks` o `.keystore`) si no lo tienes.

> El archivo `android/keystore.properties` y el keystore deben mantenerse fuera de control de versiones.

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
- Descripción corta: `Organiza tu hogar, localiza objetos y guarda fotos de cada habitación.`
- Descripción larga: `Haven te ayuda a organizar habitaciones, cajas y objetos de tu hogar. Busca rápidamente dónde está cada cosa, añade fotos a los objetos y guarda tu inventario de forma segura en tu dispositivo.`
- Categoría: `Productividad`
- Clasificación de contenido: `Todos`
- Correo de soporte: `soporte@homemap.app` (reemplaza por tu contacto real)
- URL de política de privacidad: `https://tudominio.com/privacy-policy.html`

## 5. Permisos y justificación

La app declara los siguientes permisos en `android/app/src/main/AndroidManifest.xml`:

- `android.permission.INTERNET`
- `android.permission.CAMERA`
- `android.permission.READ_MEDIA_IMAGES`
- `android.permission.READ_EXTERNAL_STORAGE` (para compatibilidad con Android 32 y anteriores)

Para Play Store debes justificarlos en la ficha de permisos cuando se solicite.

### Justificación sugerida

- Cámara: para permitir tomar una foto y asociarla a un objeto de tu inventario.
- Fotos/Imágenes: para seleccionar imágenes desde la galería y asociarlas a objetos.

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

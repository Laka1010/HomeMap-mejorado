# Haven Mejorado - Instrucciones de Inicio

## 📁 Tu Proyecto Actualizado

El proyecto Haven ha sido actualizado con todas las mejoras solicitadas.
**Ubicación**: `C:\Users\andre\Desktop\homemap-mejorado`

---

## 🚀 Cómo Iniciar

### Opción 1: Terminal Rápido (Recomendado)
```powershell
cd C:\Users\andre\Desktop\homemap-mejorado
npm run dev
```

El servidor estará disponible en: `http://localhost:5173`

### Opción 2: Abrir en VS Code
1. Abre VS Code
2. File → Open Folder
3. Selecciona `C:\Users\andre\Desktop\homemap-mejorado`
4. Abre Terminal (Ctrl+`)
5. Ejecuta `npm run dev`

---

## ✨ Qué es Nuevo

### 🔎 "¿Dónde está...?" Mejorado
- Búsqueda mucho más prominente en el Dashboard
- Resultados en tiempo real con scoring
- Muestra fotos de objetos si existen
- Ruta visual clara del objeto
- Búsqueda inteligente (tolera variaciones)

### 📷 Sistema de Fotografías
- Carga fotos de objetos directamente en el detalle
- Validación automática (5MB, JPG/PNG/WebP)
- Fotos se muestran en búsqueda y listados
- Click para cambiar o remover foto

### 🎯 Búsqueda Inteligente
- Búsqueda por nombre, categoría, ubicación
- Ranking automático de resultados
- Normaliza acentos y mayúsculas
- "Exacto", "Alto" o "Medio" relevancia

### 📍 Preparado para Historial
- Estructura lista para guardar cambios de ubicación
- Se muestra cuando hay cambios

---

## 🎮 Cómo Usarlo

### Buscar un Objeto
1. Ve a inicio
2. Verás sección "🔎 ¿Dónde está...?" prominente
3. Escribe (ej: "cargador", "apple", "habitacion")
4. Ves resultados en tiempo real
5. Click en resultado para ver detalles

### Subir Foto a Objeto
1. En página de objeto, verás sección "Foto del objeto"
2. Click en "Subir foto"
3. Selecciona imagen (JPG, PNG o WebP)
4. Max 5MB, se valida automáticamente
5. La foto aparece en búsqueda y listados

### Ver Detalles Completos
- Foto prominente del objeto
- Ubicación actual con opción de cambiar
- Información de categoría, precio, fecha
- Notas y descripción
- Historial de ubicaciones (cuando hay)

---

## 📊 Archivos Nuevos

```
src/
├── services/
│   ├── searchUtils.js   ← Búsqueda con scoring
│   ├── photoUtils.js    ← Utilidades de fotos
│   └── (otros existentes)
└── App.jsx             ← Actualizado con todas las mejoras
```

---

## 🔧 Tecnología

- **React 18** - UI component framework
- **Vite** - Build tool rápido
- **Lucide React** - Iconos
- **LocalStorage** - Almacenamiento local
- **Base64** - Fotos codificadas

---

## 📝 Estructura de Datos

### Objeto (Object)
```javascript
{
  id: "o-hdmi",
  name: "Cable HDMI",
  category: "Tecnología",
  photo: null, // ← base64 string si tiene foto
  locationHistory: [], // ← [{date, path}, ...]
  roomId: "r-habitacion",
  zoneId: "z-escritorio",
  containerId: "c-caja-negra",
  // ... otros campos
}
```

### Búsqueda
```javascript
// Automática en tiempo real
// Score 0-1, donde 1 = exacto
// Relevancia: 'exact' | 'high' | 'medium'
```

---

## 🐛 Debugging

Si algo no funciona:

1. **Limpia datos locales**
   ```javascript
   // En consola del navegador
   localStorage.clear()
   location.reload()
   ```

2. **Verifica navegador**
   - Chrome, Firefox, Safari, Edge (recientes)

3. **Verifica imágenes**
   - JPG, PNG o WebP
   - Máximo 5MB
   - No corrompidas

4. **Verifica puerto**
   - http://localhost:5173
   - Si está ocupado, cámbialo en vite.config.js

---

## 📚 Comandos npm

```bash
npm run dev       # Inicia servidor desarrollo
npm run build     # Build para producción
npm run preview   # Preview del build
```

## 📱 Publicación en Google Play

- Revisa `PLAY_STORE_PREPARATION.md` para los pasos de firma, AAB y requisitos de Play Store.
- Asegúrate de crear `android/keystore.properties` desde `android/keystore.properties.example`.
- Usa `npm run android:bundle` para generar el App Bundle firmado.

---

## 🎯 Próximas Mejoras Sugeridas

1. **Integrar Supabase Storage** - Para guardar fotos en servidor
2. **Cambiar Ubicación Modal** - Interfaz visual para mover objetos
3. **Fotos en Cajas/Habitaciones** - Ver espacios con fotos
4. **Sincronización** - Entre dispositivos
5. **Mobile App** - Versión nativa para teléfono

---

## 📞 Soporte

Documentación completa en `MEJORAS.md`

---

## ✅ Testing Recomendado

- [ ] Buscar por nombre
- [ ] Buscar por categoría  
- [ ] Subir foto JPG
- [ ] Subir foto PNG
- [ ] Intentar foto > 5MB (debe fallar)
- [ ] Ver objeto sin foto (muestra icono)
- [ ] Ver objeto con foto
- [ ] Remover foto
- [ ] Cambiar foto
- [ ] Crear nuevo objeto (debe tener campos foto + ubicación)

---

**Estado**: ✅ Listo para usar
**Versión**: 1.1.0
**Última modificación**: 21/07/2026

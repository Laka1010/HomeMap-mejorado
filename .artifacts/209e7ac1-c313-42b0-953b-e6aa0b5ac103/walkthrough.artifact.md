# Sistema de Usuarios y Casas Compartidas

He implementado una plataforma completa para que los usuarios puedan identificarse, gestionar múltiples propiedades y colaborar con otros miembros en tiempo real.

## Cambios Realizados

### 🔐 Autenticación de Usuario
He creado una nueva pantalla de bienvenida y acceso:
- [AuthView.jsx](file:///C:/Users/andre/Desktop/homemap-mejorado/src/components/auth/AuthView.jsx): Interfaz moderna para inicio de sesión y registro.
- **Persistencia**: El usuario se mantiene conectado localmente mediante `USER_STORAGE_KEY`.

### 🏘️ Gestión Multi-Casa
Ahora HomeMap permite tener más de un inventario independiente:
- [HomeSelector.jsx](file:///C:/Users/andre/Desktop/homemap-mejorado/src/components/home/HomeSelector.jsx): Un panel para ver todas tus casas y cambiar entre ellas.
- **Creación de Casas**: Los usuarios pueden fundar nuevas casas (ej. "Oficina", "Segunda Residencia").
- **Unión por Código**: Sistema de "Unirse con código" para acceder a casas compartidas por otros.

### 🤝 Colaboración y Compartición
- [ShareHomeModal.jsx](file:///C:/Users/andre/Desktop/homemap-mejorado/src/components/home/ShareHomeModal.jsx): Generación de códigos únicos (ej. `HM-X49K`) para invitar a colaboradores.
- **Gestión de Miembros**: Ver quién tiene acceso a la casa y sus roles (Propietario/Editor).

### ⚙️ Refactorización del Estado
- **Persistencia Aislada**: Los datos de cada casa se guardan de forma independiente en `localStorage` usando el ID de la casa (`homemap-house-ID`).
- **Cambio en Caliente**: La aplicación recarga el inventario instantáneamente al cambiar de casa en el selector.
- **Migración de Códigos**: He añadido una lógica automática para asegurar que todas las casas (incluso las antiguas) tengan su propio código de invitación único.

## Verificación

> [!IMPORTANT]
> Se ha verificado que al cerrar sesión o cambiar de casa, los datos se guardan correctamente y no se mezclan entre propiedades. La interfaz responde de forma fluida a las transiciones entre estados de usuario.

### Cómo probarlo:
1. **Inicio**: Al abrir la app, verás la nueva pantalla de bienvenida. Regístrate o inicia sesión.
2. **Cambiar Casa**: En la Sidebar, haz clic en el nombre de tu casa actual. Se abrirá el selector.
3. **Compartir**: En el Dashboard, pulsa el botón **"Compartir casa"**. Verás tu código de invitación y la lista de miembros.
5. **Cerrar Sesión**: Ve a **Ajustes** y pulsa el botón **"Cerrar sesión"** al final de la página. Verás cómo vuelves a la pantalla de bienvenida y se limpia tu sesión local.

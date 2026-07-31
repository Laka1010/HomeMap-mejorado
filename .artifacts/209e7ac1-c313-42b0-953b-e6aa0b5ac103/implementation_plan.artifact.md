# Implementación de Sistema de Usuarios y Casas Compartidas

Este plan detalla la arquitectura y el diseño para permitir que los usuarios se identifiquen, creen múltiples "Casas" y las compartan con otros colaboradores en tiempo real.

## User Review Required

> [!IMPORTANT]
> Este cambio requiere una transición de un modelo de datos local (`localStorage`) a un modelo centralizado. Aunque se implementará la interfaz y el flujo lógico, para que la persistencia sea real entre dispositivos distintos se recomienda integrar un backend como **Firebase** o **Supabase**. En esta fase, implementaremos la lógica y la interfaz con un servicio simulado.

## Proposed Changes

### [Component Name] Autenticación y Perfil
Se añadirán pantallas para gestionar la identidad del usuario.

#### [NEW] [AuthView.jsx](file:///C:/Users/andre/Desktop/homemap-mejorado/src/components/auth/AuthView.jsx)
- Pantalla de Bienvenida.
- Formulario de Inicio de Sesión / Registro.
- Recuperación de contraseña (UI).

#### [MODIFY] [App.jsx](file:///C:/Users/andre/Desktop/homemap-mejorado/src/App.jsx)
- Lógica de guardia: Si no hay usuario, mostrar `AuthView`.
- Refactorización de `useHomeMapState` para soportar la carga de datos por ID de Casa.

---

### [Component Name] Gestión de Casas (Home Management)
Nueva sección para gestionar las diferentes propiedades del usuario.

#### [NEW] [HomeSelector.jsx](file:///C:/Users/andre/Desktop/homemap-mejorado/src/components/home/HomeSelector.jsx)
- Lista de casas a las que el usuario tiene acceso.
- Botón "Crear nueva casa".
- Botón "Unirse a una casa" (mediante código de invitación).

#### [NEW] [ShareHomeModal.jsx](file:///C:/Users/andre/Desktop/homemap-mejorado/src/components/home/ShareHomeModal.jsx)
- Generación de códigos de invitación únicos.
- Gestión de miembros actuales de la casa (ver quién tiene acceso).
- Permisos básicos (Propietario vs. Editor).

---

### [Component Name] Refactorización de Datos
Modificación del esquema para permitir la multi-tenencia.

#### [MODIFY] [demoState.js](file:///C:/Users/andre/Desktop/homemap-mejorado/src/services/demoState.js)
- Separar el perfil del usuario de los datos de la casa.
- Nueva estructura: `User -> { Houses: [HouseID, ...] }` y `House -> { Rooms, Objects, ... }`.

## Experiencia de Usuario (UX)

### Flujo de Invitación
1. **Anfitrión**: En Ajustes de la Casa, pulsa "Compartir". Se genera un código como `HOME-1234`.
2. **Invitado**: En el Selector de Casas, pulsa "Unirse", pega el código y ¡listo! Ahora ambos ven los mismos objetos.

### Diseño
- Interfaz limpia y segura.
- Uso de avatares para los miembros de la casa.
- Notificaciones visuales cuando alguien edita algo (simulado).

## Verification Plan

### Manual Verification
1. Iniciar sesión con un usuario nuevo.
2. Crear una "Casa A" y añadir una habitación.
3. Crear una "Casa B" y verificar que los datos de la A no aparecen.
4. Simular la unión a una casa mediante un código y verificar que los datos se sincronizan.
5. Acceder a la sección de "Miembros" y ver la lista de colaboradores.

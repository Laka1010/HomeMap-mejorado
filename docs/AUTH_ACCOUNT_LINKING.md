# Política de vinculación de cuentas

**Estado:** decidido · 2026-09-01
**Alcance:** qué ocurre cuando una misma persona llega por dos vías de autenticación distintas.

## Por qué existe este documento

Hoy Haven tiene una sola vía de entrada: email + contraseña. No hay ningún
`signInWithOAuth` en el código. Mientras eso siga así, este problema no existe.

En el momento en que se active un proveedor social (Apple, Google), sí aparece:
una persona que ya se registró con `ana@gmail.com` y su contraseña, y que un día
pulsa "Continuar con Google" usando ese mismo correo, puede acabar con **dos
cuentas distintas**. Y en esta aplicación eso no es un inconveniente menor: cada
cuenta arrastra su propio espacio financiero personal, sus casas y sus
membresías. Dos cuentas significa datos partidos, una casa a la que no puede
volver, y un caso de soporte muy incómodo de resolver a posteriori.

La decisión hay que tomarla **antes** de abrir esa puerta, no después de tener
usuarios duplicados.

## Decisión

### 1. Una persona = una cuenta, con el correo verificado como clave

Se mantiene la vinculación automática de identidades por correo. Cuando alguien
entra con un proveedor social usando un correo que ya existe **y está
verificado**, esa identidad se adjunta al usuario existente en lugar de crear
uno nuevo. El `auth.uid()` no cambia, y por tanto no cambia nada de RLS, casas,
membresías ni espacios financieros.

### 2. La confirmación de correo es obligatoria

La vinculación automática solo es segura si el correo está verificado. Si se
permitieran altas con correo sin confirmar, cualquiera podría registrarse con el
correo de otra persona y quedarse esperando a que esa persona entrara con Google
para heredar su cuenta.

> **Verificado el 2026-09-01: la confirmación de correo ESTÁ activada.** No se
> puede leer la configuración de Auth desde fuera, pero los datos lo demuestran:
> de los 8 usuarios, ninguno tiene `email_confirmed_at` igual a su `created_at`
> —los 7 confirmados lo hicieron entre 2 y 45 segundos después del alta— y los 7
> tienen `confirmation_sent_at`. Con la confirmación desactivada, Supabase
> marcaría el correo como confirmado en el mismo instante y no enviaría nada.
> El octavo usuario se registró y nunca confirmó, así que no puede entrar: eso
> solo ocurre si la confirmación es obligatoria.
>
> **Riesgo asociado, pendiente:** si la confirmación es obligatoria, cada alta
> depende de que salga un correo. El servicio SMTP integrado de Supabase está
> limitado a unos pocos envíos por hora y no está pensado para producción. Con
> el volumen actual no se nota; el día del lanzamiento, a partir del tercer o
> cuarto registro en una hora el correo deja de llegar y esas personas no pueden
> entrar. Hay que configurar un SMTP propio en *Authentication → Emails → SMTP
> Settings* antes de publicar. Afecta también a la recuperación de contraseña,
> que ya está en uso.

### 3. Ningún proveedor que devuelva correos sin verificar

Solo se habilitan proveedores que garanticen que el correo que entregan está
verificado en su lado. Apple y Google lo hacen. Si algún día se valora otro,
esta es la comprobación previa.

### 4. "Ocultar mi correo" de Apple NO se puede vincular, y se acepta

Esto es una limitación inherente, no un fallo que se pueda corregir.

Cuando alguien usa Sign in with Apple con "Ocultar mi correo", Apple entrega una
dirección de reenvío del tipo `a1b2c3d4@privaterelay.appleid.com`. Ese correo no
coincide con el que la persona usó al registrarse, así que **no hay forma de
saber que son la misma persona**. Se creará una cuenta nueva. Es el
comportamiento correcto: lo contrario significaría adivinar identidades.

Consecuencias asumidas:

- Esa persona tendrá una cuenta vacía, sin sus casas.
- La vía de recuperación es la que ya existe: que un miembro de su casa le pase
  el código de invitación y se una desde la cuenta nueva. Sus datos personales
  antiguos (espacio personal) no se recuperan.
- Conviene decirlo en la pantalla de login, no en la letra pequeña: si la
  persona se registró con correo y contraseña, que entre por ahí.

### 5. No se ofrece vinculación manual en la interfaz, de momento

Supabase permite vincular identidades a mano (`linkIdentity`). No se va a usar
en la primera versión: es superficie de ataque adicional —un flujo mal protegido
de vinculación es una vía directa a apoderarse de una cuenta ajena— y no
resuelve el caso 4, que es el único que de verdad duele.

Si más adelante se añade, tendrá que exigir reautenticación reciente y quedar
registrado en `security_events`.

## Requisitos previos antes de activar cualquier proveedor social

En este orden:

1. **Hecho** — `handle_new_user` tolera que no llegue el nombre y no lo inventa a
   partir de un correo de reenvío. Ver
   `supabase/migrations/20260901_087_handle_new_user_tolerates_missing_name.sql`.
2. **Hecho** — existe `set_display_name(text)` para fijar el nombre después del
   alta. Hacía falta porque `profiles` solo tiene políticas de `SELECT`: el
   cliente no puede actualizar la fila por su cuenta.
3. **Pendiente** — un paso de onboarding que pida el nombre a quien entre sin él.
   Hoy no hace falta: el registro por email exige nombre y apellido (campos
   `required` en `AuthView`, con el botón deshabilitado sin ellos), así que
   ningún usuario llega sin nombre. En cuanto haya login social, sí.
4. **Pendiente** — confirmar la configuración de Auth descrita en el punto 2 de
   la decisión.
5. **Pendiente** — si se añade Google, Apple pasa a ser **obligatorio** en iOS
   por la directriz 4.8 de la App Store. No se puede añadir solo Google.

## Estado actual de los datos

En el momento de escribir esto: 8 usuarios, todos por email + contraseña,
ninguno con correo de reenvío y ninguno sin nombre. No hay ninguna cuenta
duplicada que arreglar. Se parte de cero, que es la situación cómoda para fijar
la política.

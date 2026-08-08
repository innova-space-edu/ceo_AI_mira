# Política de acceso de Innova Admin

## Inicio de sesión

La pantalla pública de acceso solo permite **Ingresar**. No existe registro autónomo desde la interfaz.

## Alta de usuarios

Solo el superadministrador puede crear cuentas desde **Usuarios**. Para cada alta se exige:

- nombre completo;
- correo electrónico;
- RUT chileno válido;
- rol de acceso.

La contraseña temporal se genera con los **primeros 6 dígitos del RUT**. El RUT se normaliza y no puede repetirse entre usuarios.

## Primer ingreso

Las cuentas nuevas se crean con `must_change_password = true`.

Mientras ese indicador esté activo, las políticas RLS de la plataforma impiden acceder a datos empresariales aunque el usuario conozca la contraseña temporal. Al ingresar se presenta un cambio obligatorio de contraseña.

La contraseña nueva debe tener al menos 8 caracteres y no puede ser igual a la contraseña temporal. Una vez actualizada, se registra `password_changed_at` y se habilita el acceso según el rol asignado.

## Configuración personal

Todos los usuarios activos pueden acceder a **Configuración** para cambiar su propia contraseña. Las opciones administrativas adicionales siguen limitadas por rol.

## Seguridad

- La creación y modificación de usuarios requiere sesión válida.
- La administración de usuarios exige rol `superadmin` y MFA AAL2.
- No se expone la `service_role` en el navegador.
- El cambio de contraseña se ejecuta mediante la Edge Function `company-user-admin`.
- Las tablas empresariales continúan protegidas con RLS.

# Inicio de sesión con Google

La plataforma usa Google Identity Services. No se almacena una contraseña para las cuentas creadas mediante Google; el backend valida el `id_token` directamente con Google y mantiene la sesión mediante cookies HttpOnly.

## Configuración local

1. En [Google Cloud Console](https://console.cloud.google.com/), crea un proyecto o selecciona el de la academia.
2. Configura la pantalla de consentimiento OAuth como aplicación externa y agrega los usuarios de prueba durante el desarrollo.
3. En **Credentials**, crea un cliente OAuth de tipo **Web application**.
4. En **Authorized JavaScript origins**, agrega `http://localhost:3002`.
5. Copia el Client ID en:

   - `backend/.env`: `GOOGLE_CLIENT_ID="..."`
   - `frontend/.env.local`: `NEXT_PUBLIC_GOOGLE_CLIENT_ID=...`

6. Si ejecutas Docker desde PowerShell, define también:

   ```powershell
   $env:GOOGLE_CLIENT_ID="tu-client-id.apps.googleusercontent.com"
   $env:NEXT_PUBLIC_GOOGLE_CLIENT_ID="tu-client-id.apps.googleusercontent.com"
   docker compose up -d --build
   ```

## Roles

- La primera cuenta no se convierte automáticamente en administradora.
- Las cuentas nuevas se crean con el rol `ESTUDIANTE`.
- El correo configurado en `INITIAL_ADMIN_EMAIL` (`luisenriquebautistacoz@gmail.com`) recibe el rol `ADMIN` al autenticarse correctamente por Google.
- Si el usuario ya existía, el sistema vincula su cuenta por correo y conserva su información académica.

## Producción

Agrega el dominio HTTPS real en **Authorized JavaScript origins** y configura las mismas variables en el proveedor de despliegue. No compartas el Client ID con un secreto: el Client ID es público; las cookies y el JWT permanecen gestionados por el backend.

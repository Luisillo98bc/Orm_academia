# Hardening de seguridad y protección de borde

Este repositorio aplica controles de seguridad dentro de la aplicación, pero
la protección contra DDoS volumétrico debe configurarse delante del frontend y
la API mediante un CDN/WAF (Cloudflare, Vercel, CloudFront o equivalente).

## Configuración mínima del CDN/WAF

- Activar proxy/WAF/DDoS para el dominio público.
- No publicar la IP/origen del backend directamente; restringir el origen al
  proveedor de borde cuando la plataforma lo permita.
- Cachear la landing, imágenes y catálogo público; no cachear respuestas de
  `/api/v1` que puedan contener datos de usuarios.
- Aplicar límites por IP y, cuando sea posible, por sesión:
  - `/api/v1/auth/login`, `/auth/google`: 5 por minuto.
  - `/api/v1/auth/forgot-password`, `/auth/reset-password`: 5 por minuto.
  - Registro, analytics y subidas: límite estricto y protección anti-bot.
  - API general: límite acorde al tráfico real y con alertas.
- No bloquear el webhook de pagos por reglas de navegador; validarlo por su
  firma/autenticación propia.
- Configurar alertas de tráfico, errores 5xx, consumo de CPU, memoria, ancho de
  banda, almacenamiento y correo.

## Configuración del backend

- Producción requiere `NODE_ENV=production`, HTTPS, `COOKIE_SECURE=true`, CORS
  exacto, `STORAGE_PROVIDER=minio` en la arquitectura VM actual y secretos fuera
  del repositorio.
- `TRUST_PROXY_HOPS` debe coincidir exactamente con los proxies confiables del
  proveedor. No aceptar cabeceras de proxy de clientes directos.
- Usar una sola arquitectura de jobs: `inline` o `worker`, nunca ambas.
- Mantener materiales y comprobantes en almacenamiento privado con URLs
  firmadas.
- No exponer PostgreSQL ni usar las credenciales del Compose local en Internet.
- Si se despliegan varias réplicas del backend, usar Redis administrado para
  rate limiting compartido y caché selectivo.

## Verificación previa a publicación

1. Ejecutar `npm audit` en backend y frontend y corregir los niveles high/critical.
2. Probar CSRF/orígenes, permisos por rol y acceso a objetos de otros usuarios.
3. Probar límites de subida, archivos malformados y cuotas por usuario.
4. Ejecutar un escaneo DAST/pentest en staging.
5. Confirmar que no existan secretos, backups, bases de datos ni endpoints de
   administración expuestos públicamente.

const PLACEHOLDER_VALUES = [
  'default-secret-change-me',
  'tu_jwt_secret_temporal_aqui',
  'sk_test_xxxxxxxxxxxxxxxx',
];

function required(config: Record<string, unknown>, name: string): string {
  const rawValue = config[name];
  if (typeof rawValue !== 'string' || !rawValue.trim()) {
    throw new Error(`La variable de entorno ${name} es obligatoria`);
  }
  return rawValue.trim();
}

export function validateEnvironment(config: Record<string, unknown>) {
  required(config, 'DATABASE_URL');
  const jwtSecret = required(config, 'JWT_SECRET');

  if (jwtSecret.length < 32 || PLACEHOLDER_VALUES.includes(jwtSecret)) {
    throw new Error(
      'JWT_SECRET debe ser una clave aleatoria de al menos 32 caracteres',
    );
  }

  const refreshTtl = Number(config.REFRESH_TOKEN_TTL_DAYS ?? 30);
  if (!Number.isInteger(refreshTtl) || refreshTtl < 1 || refreshTtl > 365) {
    throw new Error('REFRESH_TOKEN_TTL_DAYS debe ser un entero entre 1 y 365');
  }

  const trustProxyHops = Number(config.TRUST_PROXY_HOPS ?? 0);
  if (
    !Number.isInteger(trustProxyHops) ||
    trustProxyHops < 0 ||
    trustProxyHops > 5
  ) {
    throw new Error('TRUST_PROXY_HOPS debe ser un entero entre 0 y 5');
  }
  config.TRUST_PROXY_HOPS = trustProxyHops;

  const sameSite =
    typeof config.COOKIE_SAME_SITE === 'string'
      ? config.COOKIE_SAME_SITE.toLowerCase()
      : 'lax';
  if (!['lax', 'strict', 'none'].includes(sameSite)) {
    throw new Error('COOKIE_SAME_SITE debe ser lax, strict o none');
  }
  const cookieSecure =
    config.COOKIE_SECURE === true || config.COOKIE_SECURE === 'true';
  if (sameSite === 'none' && !cookieSecure) {
    throw new Error('COOKIE_SECURE debe ser true cuando COOKIE_SAME_SITE=none');
  }

  const nodeEnv =
    typeof config.NODE_ENV === 'string' ? config.NODE_ENV : 'development';
  const paymentsMode =
    typeof config.PAYMENTS_MODE === 'string'
      ? config.PAYMENTS_MODE.toLowerCase()
      : 'cash';
  if (!['cash', 'online'].includes(paymentsMode)) {
    throw new Error('PAYMENTS_MODE debe ser cash u online');
  }
  const storageProvider =
    typeof config.STORAGE_PROVIDER === 'string'
      ? config.STORAGE_PROVIDER.trim().toLowerCase()
      : 'local';
  config.STORAGE_PROVIDER = storageProvider;

  const clamavRequired =
    config.CLAMAV_REQUIRED === true || config.CLAMAV_REQUIRED === 'true';
  if (clamavRequired) {
    required(config, 'CLAMAV_HOST');
    const clamavPort = Number(required(config, 'CLAMAV_PORT'));
    if (
      !Number.isInteger(clamavPort) ||
      clamavPort < 1 ||
      clamavPort > 65_535
    ) {
      throw new Error('CLAMAV_PORT debe ser un puerto entero entre 1 y 65535');
    }
  }

  const scheduledJobsMode =
    typeof config.SCHEDULED_JOBS_MODE === 'string'
      ? config.SCHEDULED_JOBS_MODE.toLowerCase()
      : 'inline';
  if (!['inline', 'worker', 'disabled'].includes(scheduledJobsMode)) {
    throw new Error('SCHEDULED_JOBS_MODE debe ser inline, worker o disabled');
  }
  config.SCHEDULED_JOBS_MODE = scheduledJobsMode;

  if (storageProvider === 'supabase') {
    required(config, 'SUPABASE_URL');
    required(config, 'SUPABASE_SERVICE_ROLE_KEY');
  }

  if (storageProvider === 'minio') {
    required(config, 'MINIO_ENDPOINT');
    required(config, 'MINIO_ACCESS_KEY');
    required(config, 'MINIO_SECRET_KEY');
  }

  if (!['local', 'supabase', 'minio'].includes(storageProvider)) {
    throw new Error('STORAGE_PROVIDER debe ser local, supabase o minio');
  }

  const signedUrlTtl = Number(config.STORAGE_SIGNED_URL_TTL_SECONDS ?? 3600);
  if (
    !Number.isInteger(signedUrlTtl) ||
    signedUrlTtl < 60 ||
    signedUrlTtl > 86_400
  ) {
    throw new Error(
      'STORAGE_SIGNED_URL_TTL_SECONDS debe ser un entero entre 60 y 86400',
    );
  }

  const storageBucketQuotaBytes = Number(
    config.STORAGE_BUCKET_QUOTA_BYTES ?? 0,
  );
  if (
    !Number.isInteger(storageBucketQuotaBytes) ||
    storageBucketQuotaBytes < 0
  ) {
    throw new Error(
      'STORAGE_BUCKET_QUOTA_BYTES debe ser un entero mayor o igual a 0',
    );
  }
  config.STORAGE_BUCKET_QUOTA_BYTES = storageBucketQuotaBytes;

  if (nodeEnv === 'production') {
    const corsOrigin = required(config, 'CORS_ORIGIN');
    const frontendUrl = required(config, 'FRONTEND_URL');
    try {
      const url = new URL(frontendUrl);
      if (
        url.protocol !== 'https:' ||
        url.origin !== frontendUrl.replace(/\/$/, '')
      ) {
        throw new Error('invalid origin');
      }
    } catch {
      throw new Error(
        'FRONTEND_URL debe ser un único origen HTTPS, sin rutas ni listas',
      );
    }
    required(config, 'GOOGLE_CLIENT_ID');
    if (!clamavRequired) {
      throw new Error('CLAMAV_REQUIRED debe ser true en producción');
    }
    if (storageBucketQuotaBytes <= 0) {
      throw new Error(
        'STORAGE_BUCKET_QUOTA_BYTES debe ser mayor que 0 en producciÃ³n',
      );
    }
    const twoFactorEncryptionKey = required(
      config,
      'TWO_FACTOR_ENCRYPTION_KEY',
    );
    if (
      twoFactorEncryptionKey.length < 32 ||
      twoFactorEncryptionKey === jwtSecret
    ) {
      throw new Error(
        'TWO_FACTOR_ENCRYPTION_KEY debe tener al menos 32 caracteres y ser distinta de JWT_SECRET',
      );
    }
    if (!['supabase', 'minio'].includes(storageProvider)) {
      throw new Error(
        'STORAGE_PROVIDER debe ser minio o supabase en producción',
      );
    }
    if (!cookieSecure) {
      throw new Error('COOKIE_SECURE debe ser true en producción');
    }
    if (paymentsMode === 'online') {
      required(config, 'CULQI_SECRET_KEY');
    }

    if (corsOrigin === '*') {
      throw new Error('CORS_ORIGIN no puede ser * en producción');
    }

    const configuredOrigins = corsOrigin
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
    if (
      configuredOrigins.some((origin) => !origin.startsWith('https://')) ||
      !frontendUrl.startsWith('https://')
    ) {
      throw new Error(
        'FRONTEND_URL y CORS_ORIGIN deben usar HTTPS en producción',
      );
    }

    const scheduledJobsEnabled =
      config.ENABLE_SCHEDULED_JOBS === true ||
      config.ENABLE_SCHEDULED_JOBS === 'true';
    if (scheduledJobsEnabled && scheduledJobsMode !== 'disabled') {
      required(config, 'MAIL_HOST');
      const mailPort = Number(required(config, 'MAIL_PORT'));
      if (!Number.isInteger(mailPort) || mailPort < 1 || mailPort > 65_535) {
        throw new Error('MAIL_PORT debe ser un puerto entero entre 1 y 65535');
      }
      required(config, 'MAIL_USER');
      required(config, 'MAIL_PASS');
      required(config, 'MAIL_FROM');
    }
  }

  return config;
}

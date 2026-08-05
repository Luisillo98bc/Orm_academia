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
  const storageProvider =
    typeof config.STORAGE_PROVIDER === 'string'
      ? config.STORAGE_PROVIDER
      : 'local';

  if (storageProvider === 'supabase') {
    required(config, 'SUPABASE_URL');
    required(config, 'SUPABASE_SERVICE_ROLE_KEY');
  }

  if (nodeEnv === 'production') {
    const corsOrigin = required(config, 'CORS_ORIGIN');
    required(config, 'FRONTEND_URL');
    required(config, 'CULQI_SECRET_KEY');

    if (corsOrigin === '*') {
      throw new Error('CORS_ORIGIN no puede ser * en producción');
    }
  }

  return config;
}

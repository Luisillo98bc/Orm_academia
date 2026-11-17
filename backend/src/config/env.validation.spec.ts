import { validateEnvironment } from './env.validation';

function baseConfig(): Record<string, unknown> {
  return {
    DATABASE_URL: 'postgresql://localhost/academy',
    JWT_SECRET: 'a'.repeat(40),
    REFRESH_TOKEN_TTL_DAYS: 30,
    TRUST_PROXY_HOPS: 0,
    COOKIE_SAME_SITE: 'lax',
    COOKIE_SECURE: false,
    NODE_ENV: 'development',
    PAYMENTS_MODE: 'cash',
    STORAGE_PROVIDER: 'local',
    STORAGE_SIGNED_URL_TTL_SECONDS: 3600,
    STORAGE_BUCKET_QUOTA_BYTES: 0,
    SCHEDULED_JOBS_MODE: 'inline',
  };
}

describe('validateEnvironment', () => {
  it('normalizes a valid development environment', () => {
    const config = baseConfig();
    expect(validateEnvironment(config)).toBe(config);
    expect(config.TRUST_PROXY_HOPS).toBe(0);
    expect(config.STORAGE_PROVIDER).toBe('local');
    expect(config.STORAGE_BUCKET_QUOTA_BYTES).toBe(0);
  });

  it('rejects missing secrets and invalid numeric or enum values', () => {
    for (const patch of [
      { DATABASE_URL: '' },
      { JWT_SECRET: 'short' },
      { JWT_SECRET: 'default-secret-change-me' },
      { REFRESH_TOKEN_TTL_DAYS: 0 },
      { TRUST_PROXY_HOPS: 6 },
      { COOKIE_SAME_SITE: 'invalid' },
      { PAYMENTS_MODE: 'card' },
      { SCHEDULED_JOBS_MODE: 'bad' },
      { STORAGE_PROVIDER: 'cloud' },
      { STORAGE_SIGNED_URL_TTL_SECONDS: 59 },
      { STORAGE_BUCKET_QUOTA_BYTES: -1 },
    ]) {
      expect(() =>
        validateEnvironment({ ...baseConfig(), ...patch }),
      ).toThrow();
    }
  });

  it('validates ClamAV and provider-specific settings', () => {
    expect(() =>
      validateEnvironment({ ...baseConfig(), CLAMAV_REQUIRED: true }),
    ).toThrow();
    expect(() =>
      validateEnvironment({
        ...baseConfig(),
        CLAMAV_REQUIRED: true,
        CLAMAV_HOST: 'clamav',
        CLAMAV_PORT: 0,
      }),
    ).toThrow();
    expect(() =>
      validateEnvironment({
        ...baseConfig(),
        STORAGE_PROVIDER: 'supabase',
        SUPABASE_URL: 'https://supabase.example',
      }),
    ).toThrow();
    expect(() =>
      validateEnvironment({
        ...baseConfig(),
        STORAGE_PROVIDER: 'minio',
        MINIO_ENDPOINT: 'http://minio',
        MINIO_ACCESS_KEY: 'key',
      }),
    ).toThrow();
  });

  it('validates cookie mode and the remaining production hardening settings', () => {
    expect(() =>
      validateEnvironment({ ...baseConfig(), COOKIE_SAME_SITE: 'none' }),
    ).toThrow();
    expect(() =>
      validateEnvironment({
        ...baseConfig(),
        CLAMAV_REQUIRED: true,
        CLAMAV_HOST: 'clamav',
        CLAMAV_PORT: '70000',
      }),
    ).toThrow();

    const production = {
      ...baseConfig(),
      NODE_ENV: 'production',
      COOKIE_SECURE: true,
      CORS_ORIGIN: 'https://academy.example',
      FRONTEND_URL: 'https://academy.example',
      GOOGLE_CLIENT_ID: 'client-id',
      CLAMAV_REQUIRED: true,
      CLAMAV_HOST: 'clamav',
      CLAMAV_PORT: '3310',
      STORAGE_PROVIDER: 'supabase',
      SUPABASE_URL: 'https://supabase.example',
      SUPABASE_SERVICE_ROLE_KEY: 'key',
      STORAGE_BUCKET_QUOTA_BYTES: 1_000_000,
      TWO_FACTOR_ENCRYPTION_KEY: 'b'.repeat(40),
      PAYMENTS_MODE: 'online',
    };
    expect(() => validateEnvironment(production)).toThrow();
    expect(() =>
      validateEnvironment({ ...production, STORAGE_PROVIDER: 'local' }),
    ).toThrow();
    expect(() =>
      validateEnvironment({
        ...production,
        CULQI_SECRET_KEY: 'culqi',
        ENABLE_SCHEDULED_JOBS: true,
      }),
    ).toThrow();
    expect(() =>
      validateEnvironment({
        ...production,
        CULQI_SECRET_KEY: 'culqi',
        ENABLE_SCHEDULED_JOBS: true,
        MAIL_HOST: 'smtp',
        MAIL_PORT: '70000',
      }),
    ).toThrow();
    expect(() =>
      validateEnvironment({
        ...production,
        CULQI_SECRET_KEY: 'culqi',
        ENABLE_SCHEDULED_JOBS: true,
        MAIL_HOST: 'smtp',
        MAIL_PORT: '587',
        MAIL_USER: 'user',
        MAIL_PASS: 'pass',
      }),
    ).toThrow();
    expect(
      validateEnvironment({
        ...production,
        CULQI_SECRET_KEY: 'culqi',
        ENABLE_SCHEDULED_JOBS: true,
        MAIL_HOST: 'smtp',
        MAIL_PORT: '587',
        MAIL_USER: 'user',
        MAIL_PASS: 'pass',
        MAIL_FROM: 'Academia <noreply@example.com>',
      }),
    ).toBeDefined();
  });

  it('accepts a production configuration and rejects production hardening gaps', () => {
    const production = {
      ...baseConfig(),
      NODE_ENV: 'production',
      COOKIE_SECURE: true,
      CORS_ORIGIN: 'https://academy.example',
      FRONTEND_URL: 'https://academy.example',
      GOOGLE_CLIENT_ID: 'client-id',
      CLAMAV_REQUIRED: true,
      CLAMAV_HOST: 'clamav',
      CLAMAV_PORT: '3310',
      STORAGE_PROVIDER: 'supabase',
      SUPABASE_URL: 'https://supabase.example',
      SUPABASE_SERVICE_ROLE_KEY: 'key',
      STORAGE_BUCKET_QUOTA_BYTES: 1_000_000,
      TWO_FACTOR_ENCRYPTION_KEY: 'b'.repeat(40),
    };
    expect(validateEnvironment(production)).toBe(production);
    for (const patch of [
      { COOKIE_SECURE: false },
      { CORS_ORIGIN: '*' },
      { FRONTEND_URL: 'http://academy.example' },
      { FRONTEND_URL: 'https://academy.example,https://other.example' },
      { TWO_FACTOR_ENCRYPTION_KEY: 'a'.repeat(40) },
      { STORAGE_BUCKET_QUOTA_BYTES: 0 },
      { CLAMAV_REQUIRED: false },
    ]) {
      expect(() => validateEnvironment({ ...production, ...patch })).toThrow();
    }
  });
});

import { validateEnvironment } from './env.validation';

describe('validateEnvironment', () => {
  const validBase = {
    DATABASE_URL:
      'postgresql://postgres:postgres@localhost:5434/academia_virtual',
    JWT_SECRET: 'a-secure-development-secret-with-32-characters',
    NODE_ENV: 'development',
    STORAGE_PROVIDER: 'local',
  };

  it('accepts a valid development configuration', () => {
    expect(validateEnvironment({ ...validBase })).toMatchObject(validBase);
  });

  it('rejects a weak JWT secret', () => {
    expect(() =>
      validateEnvironment({ ...validBase, JWT_SECRET: 'short' }),
    ).toThrow('JWT_SECRET');
  });

  it('rejects wildcard CORS in production', () => {
    expect(() =>
      validateEnvironment({
        ...validBase,
        NODE_ENV: 'production',
        CORS_ORIGIN: '*',
        FRONTEND_URL: 'https://academia.example.com',
        CULQI_SECRET_KEY: 'sk_live_configured',
      }),
    ).toThrow('CORS_ORIGIN');
  });

  it('requires Supabase credentials when selected', () => {
    expect(() =>
      validateEnvironment({ ...validBase, STORAGE_PROVIDER: 'supabase' }),
    ).toThrow('SUPABASE_URL');
  });
});

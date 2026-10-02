import { envSchema, parseList } from './env.schema';

const base = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db?schema=public',
  JWT_ACCESS_SECRET: 'access-secret',
  JWT_REFRESH_SECRET: 'refresh-secret',
  ALLOWED_EMAIL_DOMAINS: 'ups.edu.ec,est.ups.edu.ec',
};

const production = {
  ...base,
  NODE_ENV: 'production',
  SMTP_HOST: 'smtp.example.com',
  SMTP_USER: 'user',
  SMTP_PASS: 'pass',
  SMTP_FROM: 'noreply@ups.edu.ec',
};

describe('envSchema', () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('applies defaults for optional variables', () => {
    const parsed = envSchema.parse(base);
    expect(parsed.NODE_ENV).toBe('development');
    expect(parsed.PORT).toBe(3000);
    expect(parsed.AUTH_DEV_EXPOSE_OTP).toBe(false);
    expect(parsed.SWAGGER_ENABLED).toBe(false);
    expect(parsed.TRUST_PROXY_HOPS).toBe(0);
  });

  it('requires database, JWT secrets and allowed domains', () => {
    expect(() => envSchema.parse({})).toThrow();
  });

  it('treats an empty APP_PUBLIC_URL as unset and rejects an invalid one', () => {
    expect(envSchema.parse({ ...base, APP_PUBLIC_URL: '' }).APP_PUBLIC_URL).toBeUndefined();
    expect(() => envSchema.parse({ ...base, APP_PUBLIC_URL: 'not-a-url' })).toThrow();
  });

  it('treats empty SMTP values (as injected by docker-compose) as unset outside production', () => {
    const parsed = envSchema.parse({ ...base, SMTP_HOST: '', SMTP_PORT: '', SMTP_USER: '', SMTP_PASS: '', SMTP_FROM: '' });
    expect(parsed.SMTP_HOST).toBeUndefined();
    expect(parsed.SMTP_PORT).toBeUndefined();
    expect(parsed.SMTP_FROM).toBeUndefined();
    expect(() => envSchema.parse({ ...base, SMTP_FROM: 'not-an-email' })).toThrow();
  });

  it('parses boolean flags from strings', () => {
    expect(envSchema.parse({ ...base, SWAGGER_ENABLED: 'true' }).SWAGGER_ENABLED).toBe(true);
    expect(envSchema.parse({ ...base, SWAGGER_ENABLED: '0' }).SWAGGER_ENABLED).toBe(false);
  });

  it('accepts a complete production configuration', () => {
    expect(() => envSchema.parse(production)).not.toThrow();
  });

  it.each([
    ['exposed dev OTP', { AUTH_DEV_EXPOSE_OTP: 'true' }],
    ['default access secret', { JWT_ACCESS_SECRET: 'change-me-access-secret' }],
    ['default refresh secret', { JWT_REFRESH_SECRET: 'change-me-refresh-secret' }],
    ['missing SMTP host', { SMTP_HOST: undefined }],
    ['missing SMTP user', { SMTP_USER: undefined }],
    ['missing SMTP password', { SMTP_PASS: undefined }],
    ['missing SMTP sender', { SMTP_FROM: undefined }],
  ])('rejects production with %s', (_label, override) => {
    expect(() => envSchema.parse({ ...production, ...override })).toThrow();
  });
});

describe('parseList', () => {
  it('lowercases, trims and drops empty items', () => {
    expect(parseList(' Ignacio@Gmail.com, ,a@ups.edu.ec,')).toEqual(['ignacio@gmail.com', 'a@ups.edu.ec']);
    expect(parseList('')).toEqual([]);
  });
});

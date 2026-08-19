import { z } from 'zod';

// Helper para parsear booleanos de variables de entorno
const parseBoolean = z
  .union([z.boolean(), z.string()])
  .transform((val) => {
    if (typeof val === 'boolean') return val;
    if (val === 'true' || val === '1') return true;
    if (val === 'false' || val === '0' || val === '') return false;
    return false;
  })
  .default(false);

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_NAME: z.string().default('UPS ExpresosApp API'),
  DATABASE_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  OTP_EXPIRES_MINUTES: z.coerce.number().int().positive().default(10),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  AUTH_DEV_EXPOSE_OTP: parseBoolean,
  ALLOWED_EMAIL_DOMAINS: z.string().min(1),
  SUPER_ADMIN_EMAILS: z.string().default(''),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  APP_PUBLIC_URL: z.string().url().optional(),
  SWAGGER_ENABLED: parseBoolean.default(false),
  SWAGGER_PATH: z.string().default('docs'),
  THROTTLE_TTL: z.coerce.number().int().positive().default(60000),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(60),
  THROTTLE_AUTH_TTL: z.coerce.number().int().positive().default(60000),
  THROTTLE_AUTH_LIMIT: z.coerce.number().int().positive().default(3),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_SECURE: parseBoolean,
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().email().optional(),
}).refine(
  (data) => {
    if (data.NODE_ENV === 'production') {
      if (data.AUTH_DEV_EXPOSE_OTP) {
        console.error('❌ AUTH_DEV_EXPOSE_OTP must be false in production');
        return false;
      }
      if (data.JWT_ACCESS_SECRET.startsWith('change-me')) {
        console.error('❌ JWT_ACCESS_SECRET cannot use default value in production');
        return false;
      }
      if (data.JWT_REFRESH_SECRET.startsWith('change-me')) {
        console.error('❌ JWT_REFRESH_SECRET cannot use default value in production');
        return false;
      }
      // En producción, SMTP es obligatorio
      if (!data.SMTP_HOST) {
        console.error('❌ SMTP_HOST is required in production');
        return false;
      }
      if (!data.SMTP_USER) {
        console.error('❌ SMTP_USER is required in production');
        return false;
      }
      if (!data.SMTP_PASS) {
        console.error('❌ SMTP_PASS is required in production');
        return false;
      }
      if (!data.SMTP_FROM) {
        console.error('❌ SMTP_FROM is required in production');
        return false;
      }
    }
    return true;
  },
  { message: 'Production environment validation failed. Check console for details.' },
);

export type EnvValidation = z.infer<typeof envSchema>;

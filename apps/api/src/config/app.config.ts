import { registerAs } from '@nestjs/config';
import { envSchema } from './env.schema';

export interface AppConfig {
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
  appName: string;
  database: {
    url: string;
  };
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessExpiresIn: string;
    refreshExpiresIn: string;
  };
  otp: {
    expiresMinutes: number;
    maxAttempts: number;
  };
  auth: {
    devExposeOtp: boolean;
    allowedDomains: string[];
    superAdminEmails: string[];
  };
  cors: {
    origins: string[];
  };
  trustProxyHops: number;
  swagger: {
    enabled: boolean;
    path: string;
  };
  throttle: {
    ttl: number;
    limit: number;
    auth: {
      ttl: number;
      limit: number;
    };
  };
  smtp: {
    host?: string;
    port?: number;
    secure: boolean;
    user?: string;
    pass?: string;
    from?: string;
  };
}

export const appConfig = registerAs<AppConfig>('app', () => {
  const parsed = envSchema.parse(process.env);

  return {
    nodeEnv: parsed.NODE_ENV,
    port: parsed.PORT,
    appName: parsed.APP_NAME,
    database: {
      url: parsed.DATABASE_URL,
    },
    jwt: {
      accessSecret: parsed.JWT_ACCESS_SECRET,
      refreshSecret: parsed.JWT_REFRESH_SECRET,
      accessExpiresIn: parsed.JWT_ACCESS_EXPIRES_IN,
      refreshExpiresIn: parsed.JWT_REFRESH_EXPIRES_IN,
    },
    otp: {
      expiresMinutes: parsed.OTP_EXPIRES_MINUTES,
      maxAttempts: parsed.OTP_MAX_ATTEMPTS,
    },
    auth: {
      devExposeOtp: parsed.AUTH_DEV_EXPOSE_OTP,
      allowedDomains: parsed.ALLOWED_EMAIL_DOMAINS.split(',').map((d) => d.trim()),
      superAdminEmails: parsed.SUPER_ADMIN_EMAILS
        ? parsed.SUPER_ADMIN_EMAILS.split(',').map((e) => e.trim())
        : [],
    },
    cors: {
      origins: parsed.CORS_ORIGINS.split(',').map((o) => o.trim()),
    },
    trustProxyHops: parsed.TRUST_PROXY_HOPS,
    swagger: {
      enabled: parsed.SWAGGER_ENABLED,
      path: parsed.SWAGGER_PATH,
    },
    throttle: {
      ttl: parsed.THROTTLE_TTL,
      limit: parsed.THROTTLE_LIMIT,
      auth: {
        ttl: parsed.THROTTLE_AUTH_TTL,
        limit: parsed.THROTTLE_AUTH_LIMIT,
      },
    },
    smtp: {
      host: parsed.SMTP_HOST,
      port: parsed.SMTP_PORT,
      secure: parsed.SMTP_SECURE,
      user: parsed.SMTP_USER,
      pass: parsed.SMTP_PASS,
      from: parsed.SMTP_FROM,
    },
  };
});

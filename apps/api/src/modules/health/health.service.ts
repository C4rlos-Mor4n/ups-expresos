import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/app.config';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  check(): Record<string, string> {
    const appConfig = this.configService.get<AppConfig>('app', { infer: true });
    const appName = appConfig?.appName ?? 'UPS GO API';

    return {
      status: 'ok',
      service: appName,
      timestamp: new Date().toISOString(),
    };
  }

  async checkDb(): Promise<Record<string, string>> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        database: 'connected',
      };
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'disconnected',
      });
    }
  }
}

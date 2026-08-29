import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { appConfig, AppConfig } from './config/app.config';
import { PrismaModule } from './database/prisma.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { StopsModule } from './modules/stops/stops.module';
import { VehiclesModule } from './modules/vehicles/vehicles.module';
import { DriversModule } from './modules/drivers/drivers.module';
import { CalendarModule } from './modules/calendar/calendar.module';
import { OperationalModule } from './modules/operational/operational.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig>) => {
        const app = configService.get<AppConfig>('app', { infer: true });
        const throttle = app?.throttle;

        return [
          {
            ttl: throttle?.ttl ?? 60000,
            limit: throttle?.limit ?? 60,
          },
          {
            name: 'auth',
            ttl: throttle?.auth.ttl ?? 60000,
            limit: throttle?.auth.limit ?? 3,
          },
        ];
      },
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    AuditLogsModule,
    StopsModule,
    VehiclesModule,
    DriversModule,
    CalendarModule,
    OperationalModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { appConfig, AppConfig } from './config/app.config';
import { PrismaModule } from './database/prisma.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { RoutesModule } from './modules/routes/routes.module';
import { StopsModule } from './modules/stops/stops.module';
import { SchedulesModule } from './modules/schedules/schedules.module';
import { VehiclesModule } from './modules/vehicles/vehicles.module';
import { DriversModule } from './modules/drivers/drivers.module';
import { NoticesModule } from './modules/notices/notices.module';
import { MobileModule } from './modules/mobile/mobile.module';
import { TripFeedbackModule } from './modules/trip-feedback/trip-feedback.module';
import { RouteAssignmentsModule } from './modules/route-assignments/route-assignments.module';
import { TripsModule } from './modules/trips/trips.module';
import { DriverOperationsModule } from './modules/driver-operations/driver-operations.module';
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
    RoutesModule,
    StopsModule,
    SchedulesModule,
    VehiclesModule,
    DriversModule,
    NoticesModule,
    MobileModule,
    TripFeedbackModule,
    RouteAssignmentsModule,
    TripsModule,
    DriverOperationsModule,
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

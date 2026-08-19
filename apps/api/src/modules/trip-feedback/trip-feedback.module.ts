import { Module } from '@nestjs/common';
import { TripFeedbackController } from './trip-feedback.controller';
import { TripFeedbackService } from './trip-feedback.service';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [AuditLogsModule],
  controllers: [TripFeedbackController],
  providers: [TripFeedbackService],
})
export class TripFeedbackModule {}

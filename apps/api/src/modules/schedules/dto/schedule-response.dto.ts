import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DayOfWeek, ScheduleStatus } from '@prisma/client';

export class ScheduleResponseDto {
  @ApiProperty({ format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' })
  routeId!: string;

  @ApiProperty({ enum: DayOfWeek, example: DayOfWeek.MONDAY })
  dayOfWeek!: DayOfWeek;

  @ApiProperty({ example: 'Norte' })
  direction!: string;

  @ApiProperty({ example: '07:30' })
  departureTime!: string;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'Approximate arrival time', example: '08:15' })
  approximateArrivalTime?: string | null;

  @ApiProperty({ enum: ScheduleStatus, example: ScheduleStatus.ACTIVE })
  status!: ScheduleStatus;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time' })
  updatedAt!: Date;
}

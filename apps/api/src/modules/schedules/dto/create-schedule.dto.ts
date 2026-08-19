import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DayOfWeek, ScheduleStatus } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, Matches } from 'class-validator';

export class CreateScheduleDto {
  @ApiProperty({ format: 'uuid', description: 'Route ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  @IsNotEmpty()
  routeId!: string;

  @ApiProperty({ description: 'Day of week', enum: DayOfWeek, example: DayOfWeek.MONDAY })
  @IsEnum(DayOfWeek)
  dayOfWeek!: DayOfWeek;

  @ApiProperty({ description: 'Direction', example: 'Norte' })
  @IsString()
  @IsNotEmpty()
  direction!: string;

  @ApiProperty({ description: 'Departure time in HH:mm format', example: '07:30' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'departureTime must be in HH:mm format' })
  departureTime!: string;

  @ApiPropertyOptional({ description: 'Approximate arrival time in HH:mm format', example: '08:15' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'approximateArrivalTime must be in HH:mm format' })
  @IsOptional()
  approximateArrivalTime?: string;

  @ApiPropertyOptional({ description: 'Schedule status', enum: ScheduleStatus, default: ScheduleStatus.ACTIVE })
  @IsEnum(ScheduleStatus)
  @IsOptional()
  status?: ScheduleStatus;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { DayOfWeek } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export class ScheduleFiltersDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Filter by route ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  @IsOptional()
  routeId?: string;

  @ApiPropertyOptional({ description: 'Filter by day of week', enum: DayOfWeek, example: DayOfWeek.MONDAY })
  @IsEnum(DayOfWeek)
  @IsOptional()
  dayOfWeek?: DayOfWeek;
}

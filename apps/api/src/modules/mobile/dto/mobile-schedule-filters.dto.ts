import { ApiPropertyOptional } from '@nestjs/swagger';
import { DayOfWeek } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class MobileScheduleFiltersDto {
  @ApiPropertyOptional({ description: 'Filter by day of week', enum: DayOfWeek, example: DayOfWeek.MONDAY })
  @IsEnum(DayOfWeek)
  @IsOptional()
  dayOfWeek?: DayOfWeek;

  @ApiPropertyOptional({ description: 'Filter by direction', example: 'Norte' })
  @IsString()
  @IsOptional()
  direction?: string;
}

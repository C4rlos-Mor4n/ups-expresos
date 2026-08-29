import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Direction } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsOptional, IsUUID, Matches, Max, Min } from 'class-validator';

export class StudentDepartureQueryDto {
  @ApiProperty({ example: '2026-09-01', format: 'date' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;

  @ApiPropertyOptional({ enum: Direction })
  @IsOptional()
  @IsEnum(Direction)
  direction?: Direction;
}

export class OperationalDateQueryDto {
  @ApiPropertyOptional({ example: '2026-09-01', format: 'date' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;
}

export class CreateServiceAssignmentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  scheduledDepartureId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  vehicleId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  driverId!: string;

  @ApiProperty({ format: 'uuid', description: 'Journey template owned by the scheduled departure source ScheduleTime' })
  @IsUUID()
  journeyTemplateId!: string;
}

export class AdminOperationalAssignmentsQueryDto extends OperationalDateQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  serviceLineId?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class AdminServiceLinesQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  campusId?: string;
}

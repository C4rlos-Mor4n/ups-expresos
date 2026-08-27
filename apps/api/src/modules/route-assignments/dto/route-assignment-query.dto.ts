import { ApiPropertyOptional } from '@nestjs/swagger';
import { TripStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class RouteAssignmentQueryDto {
  @ApiPropertyOptional({ description: 'Page number (1-based)', minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ type: 'string', format: 'date-time', description: 'Filter by service date', example: '2026-08-25' })
  @IsDateString()
  @IsOptional()
  serviceDate?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Filter by route ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  @IsOptional()
  routeId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Filter by driver ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  @IsOptional()
  driverId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Filter by vehicle ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  @IsOptional()
  vehicleId?: string;

  @ApiPropertyOptional({ enum: TripStatus, description: 'Filter by assignment status' })
  @IsEnum(TripStatus)
  @IsOptional()
  status?: TripStatus;
}
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateRouteAssignmentDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'New route ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  @IsOptional()
  routeId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'New driver ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  @IsOptional()
  driverId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'New vehicle ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  @IsOptional()
  vehicleId?: string;

  @ApiPropertyOptional({ type: 'string', format: 'date-time', description: 'New service date', example: '2026-08-25T00:00:00.000Z' })
  @IsDateString()
  @IsOptional()
  serviceDate?: string;

  @ApiPropertyOptional({ description: 'Operational notes', example: 'Asignación actualizada' })
  @IsString()
  @IsOptional()
  notes?: string;
}
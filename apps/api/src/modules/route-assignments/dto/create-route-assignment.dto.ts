import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateRouteAssignmentDto {
  @ApiProperty({ format: 'uuid', description: 'Route ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  @IsNotEmpty()
  routeId!: string;

  @ApiProperty({ format: 'uuid', description: 'Driver ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  @IsNotEmpty()
  driverId!: string;

  @ApiProperty({ format: 'uuid', description: 'Vehicle ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  @IsNotEmpty()
  vehicleId!: string;

  @ApiProperty({ type: 'string', format: 'date-time', description: 'Service date', example: '2026-08-25T00:00:00.000Z' })
  @IsDateString()
  @IsNotEmpty()
  serviceDate!: string;

  @ApiPropertyOptional({ description: 'Operational notes', example: 'Asignación para ruta norte en la mañana' })
  @IsString()
  @IsOptional()
  notes?: string;
}
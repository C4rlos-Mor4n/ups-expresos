import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TripStatus } from '@prisma/client';

export class RouteAssignmentResponseDto {
  @ApiProperty({ format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' })
  routeId!: string;

  @ApiProperty({ format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' })
  driverId!: string;

  @ApiProperty({ format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' })
  vehicleId!: string;

  @ApiProperty({ type: 'string', format: 'date-time', example: '2026-08-25T00:00:00.000Z' })
  serviceDate!: Date;

  @ApiProperty({ enum: TripStatus, example: TripStatus.SCHEDULED })
  status!: TripStatus;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'Asignación para ruta norte en la mañana' })
  notes?: string | null;

  @ApiProperty({ description: 'Whether the assignment is active', example: true })
  isActive!: boolean;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'Reason for suspension', example: 'Unidad en mantenimiento' })
  suspendReason?: string | null;

  @ApiPropertyOptional({ type: 'string', format: 'date-time', nullable: true, description: 'When the assignment was suspended' })
  suspendedAt?: Date | null;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ description: 'Route summary' })
  route!: {
    id: string;
    name: string;
    direction: string;
  };

  @ApiProperty({ description: 'Driver summary' })
  driver!: {
    id: string;
    name: string;
  };

  @ApiProperty({ description: 'Vehicle summary' })
  vehicle!: {
    id: string;
    plate: string;
    code: string;
  };
}

export class RouteAssignmentPaginatedResponseDto {
  @ApiProperty({ type: [RouteAssignmentResponseDto] })
  data!: RouteAssignmentResponseDto[];

  @ApiProperty({ description: 'Pagination metadata' })
  meta!: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
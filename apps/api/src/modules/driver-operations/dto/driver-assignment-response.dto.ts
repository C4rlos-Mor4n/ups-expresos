import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TripStatus } from '@prisma/client';

export class DriverAssignmentResponseDto {
  @ApiProperty({ format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' })
  routeId!: string;

  @ApiProperty({ type: 'string', format: 'date-time', example: '2026-08-25T00:00:00.000Z' })
  serviceDate!: Date;

  @ApiProperty({ enum: TripStatus, example: TripStatus.SCHEDULED })
  status!: TripStatus;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'Operational notes', example: 'Asignación para ruta norte en la mañana' })
  notes?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'Reason for suspension', example: 'Unidad en mantenimiento' })
  suspendReason?: string | null;

  @ApiProperty({ description: 'Assigned route' })
  route!: {
    id: string;
    name: string;
    description: string | null;
    direction: string;
  };

  @ApiProperty({ description: 'Assigned vehicle' })
  vehicle!: {
    id: string;
    plate: string;
    code: string;
    capacity: number;
  };

  @ApiProperty({ description: 'Driver profile' })
  driver!: {
    id: string;
    name: string;
    phone: string | null;
  };
}
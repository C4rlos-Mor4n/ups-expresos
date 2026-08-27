import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TripStatus } from '@prisma/client';

export class TripResponseDto {
  @ApiProperty({ format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' })
  assignmentId!: string;

  @ApiProperty({ format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' })
  routeId!: string;

  @ApiProperty({ format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' })
  driverId!: string;

  @ApiProperty({ format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' })
  vehicleId!: string;

  @ApiProperty({ enum: TripStatus, example: TripStatus.SCHEDULED })
  status!: TripStatus;

  @ApiPropertyOptional({ type: 'string', format: 'date-time', nullable: true, description: 'When the trip started' })
  startedAt?: Date | null;

  @ApiPropertyOptional({ type: 'string', format: 'date-time', nullable: true, description: 'When the trip finished' })
  endedAt?: Date | null;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'Notes recorded at start', example: 'Inicio de ruta sin novedades' })
  startNotes?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'Notes recorded at finish', example: 'Recorrido finalizado sin novedades' })
  endNotes?: string | null;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time' })
  updatedAt!: Date;
}

export class TripDetailResponseDto extends TripResponseDto {
  @ApiProperty({ description: 'Assignment summary' })
  assignment!: {
    id: string;
    serviceDate: Date;
    status: TripStatus;
  };

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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TripStatus } from '@prisma/client';

export class CurrentTripResponseDto {
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

  @ApiProperty({ enum: TripStatus, example: TripStatus.IN_PROGRESS })
  status!: TripStatus;

  @ApiPropertyOptional({ type: 'string', format: 'date-time', nullable: true })
  startedAt?: Date | null;

  @ApiPropertyOptional({ type: 'string', format: 'date-time', nullable: true })
  endedAt?: Date | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  startNotes?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  endNotes?: string | null;

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

  @ApiProperty({ description: 'Vehicle summary' })
  vehicle!: {
    id: string;
    plate: string;
    code: string;
  };

  @ApiProperty({ description: 'Assignment summary' })
  assignment!: {
    id: string;
    serviceDate: Date;
    status: TripStatus;
  };
}

export class CurrentTripWrapperDto {
  @ApiProperty({ type: CurrentTripResponseDto, nullable: true, description: 'Current in-progress trip, or null if the driver has no active trip' })
  data!: CurrentTripResponseDto | null;
}
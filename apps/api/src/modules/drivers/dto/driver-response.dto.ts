import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DriverStatus } from '@prisma/client';

export class DriverResponseDto {
  @ApiProperty({ format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ example: 'Juan Pérez' })
  name!: string;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'Phone number', example: '+593999999999' })
  phone?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'License number', example: 'LIC-123456' })
  licenseNumber?: string | null;

  @ApiProperty({ enum: DriverStatus, example: DriverStatus.ACTIVE })
  status!: DriverStatus;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true, description: 'Assigned vehicle ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  assignedVehicleId?: string | null;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true, description: 'Assigned route ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  assignedRouteId?: string | null;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time' })
  updatedAt!: Date;
}

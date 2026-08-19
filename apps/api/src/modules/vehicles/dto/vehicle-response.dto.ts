import { ApiProperty } from '@nestjs/swagger';
import { VehicleStatus } from '@prisma/client';

export class VehicleResponseDto {
  @ApiProperty({ format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ example: 'ABC-1234' })
  plate!: string;

  @ApiProperty({ example: 'V001' })
  code!: string;

  @ApiProperty({ example: 40 })
  capacity!: number;

  @ApiProperty({ enum: VehicleStatus, example: VehicleStatus.ACTIVE })
  status!: VehicleStatus;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time' })
  updatedAt!: Date;
}

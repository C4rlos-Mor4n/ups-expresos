import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VehicleStatus } from '@prisma/client';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateVehicleDto {
  @ApiProperty({ description: 'Vehicle license plate', example: 'ABC-1234' })
  @IsString()
  @IsNotEmpty()
  plate!: string;

  @ApiProperty({ description: 'Internal vehicle code', example: 'V001' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ description: 'Passenger capacity', minimum: 1, example: 40 })
  @IsInt()
  @Min(1)
  capacity!: number;

  @ApiPropertyOptional({ description: 'Vehicle status', enum: VehicleStatus, default: VehicleStatus.ACTIVE })
  @IsEnum(VehicleStatus)
  @IsOptional()
  status?: VehicleStatus;
}

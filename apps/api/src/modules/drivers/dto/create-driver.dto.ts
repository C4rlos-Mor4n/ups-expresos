import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DriverStatus } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateDriverDto {
  @ApiProperty({ description: 'Driver name', example: 'Juan Pérez' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ description: 'Driver phone number', example: '+593991234567' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ description: 'Driver license number', example: 'L123456789' })
  @IsString()
  @IsOptional()
  licenseNumber?: string;

  @ApiPropertyOptional({ description: 'Driver status', enum: DriverStatus, default: DriverStatus.ACTIVE })
  @IsEnum(DriverStatus)
  @IsOptional()
  status?: DriverStatus;

}

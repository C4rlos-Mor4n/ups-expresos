import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateStopDto {
  @ApiProperty({ description: 'Stop name', example: 'Parque de la Madre' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ description: 'Reference or address', example: 'Av. 12 de Abril y Loja' })
  @IsString()
  @IsOptional()
  reference?: string;

  @ApiProperty({ description: 'Latitude coordinate', minimum: -90, maximum: 90, example: -2.8975 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @ApiProperty({ description: 'Longitude coordinate', minimum: -180, maximum: 180, example: -79.0045 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @ApiPropertyOptional({ description: 'Whether the stop is active', default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

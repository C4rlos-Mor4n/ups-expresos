import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { RouteStatus } from '@prisma/client';

export class CreateRouteDto {
  @ApiProperty({ description: 'Route name', example: 'Norte - Salesiana' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ description: 'Route description', example: 'Ruta que cubre el norte de la ciudad' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Route direction', example: 'Norte' })
  @IsString()
  @IsNotEmpty()
  direction!: string;

  @ApiPropertyOptional({ description: 'Route status', enum: RouteStatus, default: RouteStatus.ACTIVE })
  @IsEnum(RouteStatus)
  @IsOptional()
  status?: RouteStatus;

  @ApiPropertyOptional({ description: 'Whether the route is active', default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

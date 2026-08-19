import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NoticeSeverity } from '@prisma/client';
import { IsBoolean, IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateNoticeDto {
  @ApiProperty({ description: 'Notice title', example: 'Cambio de ruta temporal' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({ description: 'Notice message', example: 'La ruta norte tendrá un desvío por obras.' })
  @IsString()
  @IsNotEmpty()
  message!: string;

  @ApiPropertyOptional({ description: 'Notice severity', enum: NoticeSeverity, default: NoticeSeverity.INFO })
  @IsEnum(NoticeSeverity)
  @IsOptional()
  severity?: NoticeSeverity;

  @ApiProperty({ format: 'date-time', description: 'Publication start date in ISO 8601 format', example: '2026-06-29T00:00:00.000Z' })
  @IsDateString()
  publishedFrom!: string;

  @ApiPropertyOptional({ format: 'date-time', description: 'Publication end date in ISO 8601 format', example: '2026-07-01T23:59:59.000Z' })
  @IsDateString()
  @IsOptional()
  publishedUntil?: string;

  @ApiPropertyOptional({ description: 'Whether the notice is active', default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

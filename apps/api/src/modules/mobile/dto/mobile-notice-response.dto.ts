import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NoticeSeverity } from '@prisma/client';

export class MobileNoticeResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ example: 'Cambio de ruta temporal' })
  title!: string;

  @ApiProperty({ example: 'La ruta norte tendrá un desvío por obras.' })
  message!: string;

  @ApiProperty({ enum: NoticeSeverity, example: NoticeSeverity.INFO })
  severity!: NoticeSeverity;

  @ApiProperty({ type: 'string', format: 'date-time' })
  publishedFrom!: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true, description: 'Publication end date', example: '2026-07-10T23:59:59.000Z' })
  publishedUntil?: Date | null;
}

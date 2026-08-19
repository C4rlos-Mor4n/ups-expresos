import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class StopResponseDto {
  @ApiProperty({ format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ example: 'Parque de la Madre' })
  name!: string;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'Location reference', example: 'Next to library' })
  reference?: string | null;

  @ApiProperty({ example: -2.8975 })
  latitude!: number;

  @ApiProperty({ example: -79.0045 })
  longitude!: number;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time' })
  updatedAt!: Date;
}

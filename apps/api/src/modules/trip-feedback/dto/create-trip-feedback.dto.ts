import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsInt, Min, Max, IsOptional, IsString, IsISO8601 } from 'class-validator';

export class CreateTripFeedbackDto {
  @ApiProperty({
    format: 'uuid',
    description: 'ID of the route being reviewed',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  routeId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'ID of the driver (optional)',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsOptional()
  @IsUUID()
  driverId?: string;

  @ApiProperty({
    description: 'Rating from 1 to 5',
    example: 4,
    minimum: 1,
    maximum: 5,
  })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiPropertyOptional({
    description: 'Optional comment',
    example: 'El servicio fue puntual y comodo',
  })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Date of travel (ISO 8601)',
    example: '2026-07-01T08:00:00.000Z',
  })
  @IsOptional()
  @IsISO8601()
  travelDate?: string;
}

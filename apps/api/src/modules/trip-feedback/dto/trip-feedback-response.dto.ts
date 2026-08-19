import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TripFeedbackResponseDto {
  @ApiProperty({ format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440001' })
  userId!: string;

  @ApiProperty({ format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440002' })
  routeId!: string;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true, description: 'Driver ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  driverId?: string | null;

  @ApiProperty({ example: 4 })
  rating!: number;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'Comment', example: 'Great service' })
  comment?: string | null;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'Travel date',
    example: '2026-07-05T10:00:00.000Z',
  })
  travelDate?: string | null;

  @ApiProperty({ format: 'date-time', example: '2026-07-01T10:00:00.000Z' })
  createdAt!: string;
}

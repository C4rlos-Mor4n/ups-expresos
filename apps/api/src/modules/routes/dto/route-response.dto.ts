import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RouteStatus } from '@prisma/client';

export class RouteResponseDto {
  @ApiProperty({ format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ example: 'Norte - Salesiana' })
  name!: string;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'Route description', example: 'Campus route' })
  description?: string | null;

  @ApiProperty({ example: 'Norte' })
  direction!: string;

  @ApiProperty({ enum: RouteStatus, example: RouteStatus.ACTIVE })
  status!: RouteStatus;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ type: 'string', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: 'string', format: 'date-time' })
  updatedAt!: Date;
}

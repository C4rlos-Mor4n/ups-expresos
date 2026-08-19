import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StopResponseDto } from '../../stops/dto/stop-response.dto';

export class MobileRouteStopResponseDto {
  @ApiProperty({ format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ example: 1 })
  stopOrder!: number;

  @ApiPropertyOptional({ type: Number, nullable: true, description: 'Estimated arrival time in minutes', example: 15 })
  estimatedArrivalMinutes?: number | null;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'Stop notes', example: 'Main stop' })
  notes?: string | null;

  @ApiProperty({ type: StopResponseDto })
  stop!: StopResponseDto;
}

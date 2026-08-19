import { PaginationDto } from '../../../common/dto/pagination.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class TripFeedbackQueryDto extends PaginationDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Filter by user ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Filter by route ID', example: '550e8400-e29b-41d4-a716-446655440001' })
  @IsUUID()
  @IsOptional()
  routeId?: string;
}

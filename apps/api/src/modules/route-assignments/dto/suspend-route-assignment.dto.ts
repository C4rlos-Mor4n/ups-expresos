import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class SuspendRouteAssignmentDto {
  @ApiPropertyOptional({ description: 'Reason for suspension', example: 'Unidad en mantenimiento' })
  @IsString()
  @IsOptional()
  reason?: string;
}
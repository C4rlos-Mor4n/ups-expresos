import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class FinishTripDto {
  @ApiPropertyOptional({ description: 'Notes recorded at finish', example: 'Recorrido finalizado sin novedades' })
  @IsString()
  @IsOptional()
  endNotes?: string;
}
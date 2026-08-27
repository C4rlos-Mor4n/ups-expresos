import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class StartTripDto {
  @ApiProperty({ format: 'uuid', description: 'Route assignment ID to start', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  @IsNotEmpty()
  assignmentId!: string;

  @ApiPropertyOptional({ description: 'Notes recorded at start', example: 'Inicio de ruta sin novedades' })
  @IsString()
  @IsOptional()
  startNotes?: string;
}
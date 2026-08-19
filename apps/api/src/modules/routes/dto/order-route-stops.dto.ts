import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';

export class RouteStopOrderItemDto {
  @ApiProperty({ format: 'uuid', description: 'Stop ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  @IsNotEmpty()
  stopId!: string;

  @ApiProperty({ description: 'Order of the stop in the route', example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stopOrder!: number;

  @ApiPropertyOptional({ description: 'Estimated arrival minutes from route start', example: 15 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  estimatedArrivalMinutes?: number;

  @ApiPropertyOptional({ description: 'Notes for this stop in the route', example: 'Parada principal' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class OrderRouteStopsDto {
  @ApiProperty({ description: 'Ordered stops', type: [RouteStopOrderItemDto] })
  @ValidateNested({ each: true })
  @Type(() => RouteStopOrderItemDto)
  @ArrayMinSize(1)
  stops!: RouteStopOrderItemDto[];
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RouteResponseDto } from '../../routes/dto/route-response.dto';
import { TripStatus } from '@prisma/client';

export class CurrentOperationResponseDto {
  @ApiProperty({ enum: TripStatus, example: TripStatus.IN_PROGRESS })
  status!: TripStatus;

  @ApiProperty({ description: 'Driver assigned to the current operation' })
  driver!: {
    id: string;
    name: string;
  };

  @ApiProperty({ description: 'Vehicle assigned to the current operation' })
  vehicle!: {
    id: string;
    plate: string;
    code: string;
  };

  @ApiPropertyOptional({ type: 'string', format: 'date-time', nullable: true, description: 'When the operation started' })
  startedAt?: Date | null;

  @ApiPropertyOptional({ format: 'uuid', description: 'Active trip ID if in progress' })
  tripId?: string;
}

export class MobileRouteResponseDto extends RouteResponseDto {
  @ApiPropertyOptional({
    type: CurrentOperationResponseDto,
    nullable: true,
    description: 'Current operational status of the route (null when no active operation)',
  })
  currentOperation?: CurrentOperationResponseDto | null;
}

export class MobileRoutePaginatedResponseDto {
  @ApiProperty({ type: [MobileRouteResponseDto] })
  data!: MobileRouteResponseDto[];

  @ApiProperty()
  meta!: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
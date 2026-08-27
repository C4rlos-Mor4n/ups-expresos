import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RouteResponseDto } from '../../routes/dto/route-response.dto';
import { ScheduleResponseDto } from '../../schedules/dto/schedule-response.dto';
import { MobileRouteStopResponseDto } from './mobile-route-stop-response.dto';
import { CurrentOperationResponseDto } from './mobile-route-response.dto';

export class MobileRouteDetailResponseDto {
  @ApiProperty({ type: RouteResponseDto })
  route!: RouteResponseDto;

  @ApiProperty({ type: [MobileRouteStopResponseDto] })
  stops!: MobileRouteStopResponseDto[];

  @ApiProperty({ type: [ScheduleResponseDto] })
  schedules!: ScheduleResponseDto[];

  @ApiPropertyOptional({
    type: CurrentOperationResponseDto,
    nullable: true,
    description: 'Current operational status of the route (null when no active operation)',
  })
  currentOperation?: CurrentOperationResponseDto | null;
}

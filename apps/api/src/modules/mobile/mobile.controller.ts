import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiParam, ApiBearerAuth, ApiUnauthorizedResponse, ApiForbiddenResponse, ApiNotFoundResponse } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { MobileService } from './mobile.service';
import { MobileRouteQueryDto } from './dto/mobile-route-query.dto';
import { MobileScheduleFiltersDto } from './dto/mobile-schedule-filters.dto';
import { MobileRouteDetailResponseDto } from './dto/mobile-route-detail-response.dto';
import { MobileRouteStopResponseDto } from './dto/mobile-route-stop-response.dto';
import { MobileNoticePaginatedResponseDto } from './dto/mobile-notice-paginated-response.dto';
import { RoutePaginatedResponseDto } from '../routes/dto/route-paginated-response.dto';
import { ScheduleResponseDto } from '../schedules/dto/schedule-response.dto';

@ApiBearerAuth()
@ApiTags('Mobile')
@Roles(UserRole.STUDENT, UserRole.DRIVER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('mobile')
@SkipThrottle({ auth: true })
export class MobileController {
  constructor(private readonly mobileService: MobileService) {}

  @Get('routes')
  @ApiOperation({ summary: 'List active routes for mobile app' })
  @ApiOkResponse({ type: RoutePaginatedResponseDto, description: 'Paginated list of active routes' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  findActiveRoutes(@Query() query: MobileRouteQueryDto): Promise<RoutePaginatedResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    return this.mobileService.findActiveRoutes(page, limit, query);
  }

  @Get('routes/:id')
  @ApiOperation({ summary: 'Get route detail with ordered stops and active schedules' })
  @ApiParam({ name: 'id', description: 'Route ID', format: 'uuid' })
  @ApiOkResponse({ type: MobileRouteDetailResponseDto, description: 'Route detail' })
  @ApiNotFoundResponse({ description: 'Route not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  findRouteDetail(@Param('id') id: string): Promise<MobileRouteDetailResponseDto> {
    return this.mobileService.findRouteDetail(id);
  }

  @Get('routes/:id/stops')
  @ApiOperation({ summary: 'Get ordered stops for a route' })
  @ApiParam({ name: 'id', description: 'Route ID', format: 'uuid' })
  @ApiOkResponse({ type: [MobileRouteStopResponseDto], description: 'Ordered route stops' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  findRouteStops(@Param('id') routeId: string): Promise<MobileRouteStopResponseDto[]> {
    return this.mobileService.findRouteStops(routeId);
  }

  @Get('routes/:id/schedules')
  @ApiOperation({ summary: 'Get active schedules for a route' })
  @ApiParam({ name: 'id', description: 'Route ID', format: 'uuid' })
  @ApiOkResponse({ type: [ScheduleResponseDto], description: 'Active route schedules' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  findRouteSchedules(
    @Param('id') routeId: string,
    @Query() filters: MobileScheduleFiltersDto,
  ): Promise<ScheduleResponseDto[]> {
    return this.mobileService.findRouteSchedules(routeId, filters);
  }

  @Get('notices')
  @ApiOperation({ summary: 'List active notices currently published' })
  @ApiOkResponse({ type: MobileNoticePaginatedResponseDto, description: 'Paginated list of active notices' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  findActiveNotices(@Query() pagination: PaginationDto): Promise<MobileNoticePaginatedResponseDto> {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    return this.mobileService.findActiveNotices(page, limit);
  }
}

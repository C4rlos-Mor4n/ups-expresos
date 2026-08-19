import { Controller, Patch, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiBody, ApiOkResponse, ApiBearerAuth, ApiUnauthorizedResponse, ApiForbiddenResponse, ApiNotFoundResponse, ApiBadRequestResponse } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RouteStopsService } from './route-stops.service';
import { OrderRouteStopsDto } from './dto/order-route-stops.dto';
import { OrderRouteStopsResponseDto } from './dto/order-route-stops-response.dto';

@ApiBearerAuth()
@ApiTags('Admin Routes')
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin/routes/:id/stops')
@SkipThrottle({ auth: true })
export class RouteStopsController {
  constructor(private readonly routeStopsService: RouteStopsService) {}

  @Patch('order')
  @ApiOperation({ summary: 'Order stops for a route' })
  @ApiParam({ name: 'id', description: 'Route ID', format: 'uuid' })
  @ApiBody({ type: OrderRouteStopsDto })
  @ApiOkResponse({ type: OrderRouteStopsResponseDto, description: 'Stops ordered successfully' })
  @ApiBadRequestResponse({ description: 'Invalid input' })
  @ApiNotFoundResponse({ description: 'Route not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  orderStops(
    @Param('id') routeId: string,
    @Body() dto: OrderRouteStopsDto,
    @CurrentUser('sub') actorId: string,
  ): Promise<{ message: string }> {
    return this.routeStopsService.orderStops(routeId, dto, actorId).then(() => ({ message: 'Stops ordered successfully' }));
  }
}

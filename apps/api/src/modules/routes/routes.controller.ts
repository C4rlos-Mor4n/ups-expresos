import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCreatedResponse, ApiOkResponse, ApiParam, ApiBody, ApiBearerAuth, ApiUnauthorizedResponse, ApiForbiddenResponse, ApiNotFoundResponse, ApiBadRequestResponse, ApiConflictResponse } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { RoutesService } from './routes.service';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateRouteDto } from './dto/update-route.dto';
import { RouteResponseDto } from './dto/route-response.dto';
import { RoutePaginatedResponseDto } from './dto/route-paginated-response.dto';

@ApiBearerAuth()
@ApiTags('Admin Routes')
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin/routes')
@SkipThrottle({ auth: true })
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new route' })
  @ApiBody({ type: CreateRouteDto })
  @ApiCreatedResponse({ type: RouteResponseDto, description: 'Route created successfully' })
  @ApiBadRequestResponse({ description: 'Invalid input' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiConflictResponse({ description: 'Route already exists' })
  create(
    @Body() dto: CreateRouteDto,
    @CurrentUser('sub') actorId: string,
  ): Promise<RouteResponseDto> {
    return this.routesService.create(dto, actorId);
  }

  @Get()
  @ApiOperation({ summary: 'List all routes with pagination' })
  @ApiOkResponse({ type: RoutePaginatedResponseDto, description: 'Paginated list of routes' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  findAll(@Query() pagination: PaginationDto): Promise<RoutePaginatedResponseDto> {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    return this.routesService.findAll(page, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get route details' })
  @ApiParam({ name: 'id', description: 'Route ID', format: 'uuid' })
  @ApiOkResponse({ type: RouteResponseDto, description: 'Route details' })
  @ApiNotFoundResponse({ description: 'Route not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  findOne(@Param('id') id: string): Promise<RouteResponseDto> {
    return this.routesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a route' })
  @ApiParam({ name: 'id', description: 'Route ID', format: 'uuid' })
  @ApiBody({ type: UpdateRouteDto })
  @ApiOkResponse({ type: RouteResponseDto, description: 'Route updated successfully' })
  @ApiBadRequestResponse({ description: 'Invalid input' })
  @ApiNotFoundResponse({ description: 'Route not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateRouteDto,
    @CurrentUser('sub') actorId: string,
  ): Promise<RouteResponseDto> {
    return this.routesService.update(id, dto, actorId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete a route' })
  @ApiParam({ name: 'id', description: 'Route ID', format: 'uuid' })
  @ApiOkResponse({ type: RouteResponseDto, description: 'Route deactivated successfully' })
  @ApiNotFoundResponse({ description: 'Route not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  remove(
    @Param('id') id: string,
    @CurrentUser('sub') actorId: string,
  ): Promise<RouteResponseDto> {
    return this.routesService.remove(id, actorId);
  }
}

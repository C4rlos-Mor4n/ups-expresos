import { Controller, Get, Post, Patch, Body, Param, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiBody,
  ApiBearerAuth,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RouteAssignmentsService } from './route-assignments.service';
import { CreateRouteAssignmentDto } from './dto/create-route-assignment.dto';
import { UpdateRouteAssignmentDto } from './dto/update-route-assignment.dto';
import { SuspendRouteAssignmentDto } from './dto/suspend-route-assignment.dto';
import { RouteAssignmentQueryDto } from './dto/route-assignment-query.dto';
import { RouteAssignmentResponseDto, RouteAssignmentPaginatedResponseDto } from './dto/route-assignment-response.dto';

@ApiBearerAuth()
@ApiTags('Admin Route Assignments')
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin/route-assignments')
@SkipThrottle({ auth: true })
export class RouteAssignmentsController {
  constructor(private readonly routeAssignmentsService: RouteAssignmentsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a route assignment (route, driver, vehicle, service date)' })
  @ApiBody({ type: CreateRouteAssignmentDto })
  @ApiCreatedResponse({ type: RouteAssignmentResponseDto, description: 'Route assignment created successfully' })
  @ApiBadRequestResponse({ description: 'Invalid input or inactive driver/vehicle' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiNotFoundResponse({ description: 'Route, driver or vehicle not found' })
  @ApiConflictResponse({ description: 'Conflicting assignment for the same date' })
  create(
    @Body() dto: CreateRouteAssignmentDto,
    @CurrentUser('sub') actorId: string,
  ): Promise<RouteAssignmentResponseDto> {
    return this.routeAssignmentsService.create(dto, actorId);
  }

  @Get()
  @ApiOperation({ summary: 'List route assignments with filters and pagination' })
  @ApiOkResponse({ type: RouteAssignmentPaginatedResponseDto, description: 'Paginated list of route assignments' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  findAll(@Query() query: RouteAssignmentQueryDto): Promise<RouteAssignmentPaginatedResponseDto> {
    return this.routeAssignmentsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get route assignment details' })
  @ApiParam({ name: 'id', description: 'Route assignment ID', format: 'uuid' })
  @ApiOkResponse({ type: RouteAssignmentResponseDto, description: 'Route assignment details' })
  @ApiNotFoundResponse({ description: 'Route assignment not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  findOne(@Param('id') id: string): Promise<RouteAssignmentResponseDto> {
    return this.routeAssignmentsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a route assignment (blocked if a trip is in progress)' })
  @ApiParam({ name: 'id', description: 'Route assignment ID', format: 'uuid' })
  @ApiBody({ type: UpdateRouteAssignmentDto })
  @ApiOkResponse({ type: RouteAssignmentResponseDto, description: 'Route assignment updated successfully' })
  @ApiBadRequestResponse({ description: 'Invalid input or inactive driver/vehicle' })
  @ApiNotFoundResponse({ description: 'Route assignment or referenced entity not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiConflictResponse({ description: 'Trip in progress or conflicting assignment' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateRouteAssignmentDto,
    @CurrentUser('sub') actorId: string,
  ): Promise<RouteAssignmentResponseDto> {
    return this.routeAssignmentsService.update(id, dto, actorId);
  }

  @Patch(':id/suspend')
  @ApiOperation({ summary: 'Suspend a route assignment' })
  @ApiParam({ name: 'id', description: 'Route assignment ID', format: 'uuid' })
  @ApiBody({ type: SuspendRouteAssignmentDto })
  @ApiOkResponse({ type: RouteAssignmentResponseDto, description: 'Route assignment suspended successfully' })
  @ApiNotFoundResponse({ description: 'Route assignment not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiConflictResponse({ description: 'Cannot suspend assignment while a trip is in progress' })
  suspend(
    @Param('id') id: string,
    @Body() dto: SuspendRouteAssignmentDto,
    @CurrentUser('sub') actorId: string,
  ): Promise<RouteAssignmentResponseDto> {
    return this.routeAssignmentsService.suspend(id, actorId, dto.reason);
  }
}
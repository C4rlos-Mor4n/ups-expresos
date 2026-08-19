import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCreatedResponse, ApiOkResponse, ApiParam, ApiBody, ApiBearerAuth, ApiUnauthorizedResponse, ApiForbiddenResponse, ApiNotFoundResponse, ApiBadRequestResponse, ApiConflictResponse } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { VehiclesService } from './vehicles.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { VehicleResponseDto } from './dto/vehicle-response.dto';
import { VehiclePaginatedResponseDto } from './dto/vehicle-paginated-response.dto';

@ApiBearerAuth()
@ApiTags('Admin Vehicles')
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin/vehicles')
@SkipThrottle({ auth: true })
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new vehicle' })
  @ApiBody({ type: CreateVehicleDto })
  @ApiCreatedResponse({ type: VehicleResponseDto, description: 'Vehicle created successfully' })
  @ApiBadRequestResponse({ description: 'Invalid input' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiConflictResponse({ description: 'Vehicle plate or code already exists' })
  create(
    @Body() dto: CreateVehicleDto,
    @CurrentUser('sub') actorId: string,
  ): Promise<VehicleResponseDto> {
    return this.vehiclesService.create(dto, actorId);
  }

  @Get()
  @ApiOperation({ summary: 'List all vehicles with pagination' })
  @ApiOkResponse({ type: VehiclePaginatedResponseDto, description: 'Paginated list of vehicles' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  findAll(@Query() pagination: PaginationDto): Promise<VehiclePaginatedResponseDto> {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    return this.vehiclesService.findAll(page, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get vehicle details' })
  @ApiParam({ name: 'id', description: 'Vehicle ID', format: 'uuid' })
  @ApiOkResponse({ type: VehicleResponseDto, description: 'Vehicle details' })
  @ApiNotFoundResponse({ description: 'Vehicle not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  findOne(@Param('id') id: string): Promise<VehicleResponseDto> {
    return this.vehiclesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a vehicle' })
  @ApiParam({ name: 'id', description: 'Vehicle ID', format: 'uuid' })
  @ApiBody({ type: UpdateVehicleDto })
  @ApiOkResponse({ type: VehicleResponseDto, description: 'Vehicle updated successfully' })
  @ApiBadRequestResponse({ description: 'Invalid input' })
  @ApiNotFoundResponse({ description: 'Vehicle not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateVehicleDto,
    @CurrentUser('sub') actorId: string,
  ): Promise<VehicleResponseDto> {
    return this.vehiclesService.update(id, dto, actorId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete a vehicle (set status to INACTIVE)' })
  @ApiParam({ name: 'id', description: 'Vehicle ID', format: 'uuid' })
  @ApiOkResponse({ type: VehicleResponseDto, description: 'Vehicle deactivated successfully' })
  @ApiNotFoundResponse({ description: 'Vehicle not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  remove(
    @Param('id') id: string,
    @CurrentUser('sub') actorId: string,
  ): Promise<VehicleResponseDto> {
    return this.vehiclesService.remove(id, actorId);
  }
}

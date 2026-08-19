import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCreatedResponse, ApiOkResponse, ApiParam, ApiBody, ApiBearerAuth, ApiUnauthorizedResponse, ApiForbiddenResponse, ApiNotFoundResponse, ApiBadRequestResponse } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { DriversService } from './drivers.service';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';
import { DriverResponseDto } from './dto/driver-response.dto';
import { DriverPaginatedResponseDto } from './dto/driver-paginated-response.dto';

@ApiBearerAuth()
@ApiTags('Admin Drivers')
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin/drivers')
@SkipThrottle({ auth: true })
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new driver' })
  @ApiBody({ type: CreateDriverDto })
  @ApiCreatedResponse({ type: DriverResponseDto, description: 'Driver created successfully' })
  @ApiBadRequestResponse({ description: 'Invalid input' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  create(
    @Body() dto: CreateDriverDto,
    @CurrentUser('sub') actorId: string,
  ): Promise<DriverResponseDto> {
    return this.driversService.create(dto, actorId);
  }

  @Get()
  @ApiOperation({ summary: 'List all drivers with pagination' })
  @ApiOkResponse({ type: DriverPaginatedResponseDto, description: 'Paginated list of drivers' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  findAll(@Query() pagination: PaginationDto): Promise<DriverPaginatedResponseDto> {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    return this.driversService.findAll(page, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get driver details' })
  @ApiParam({ name: 'id', description: 'Driver ID', format: 'uuid' })
  @ApiOkResponse({ type: DriverResponseDto, description: 'Driver details' })
  @ApiNotFoundResponse({ description: 'Driver not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  findOne(@Param('id') id: string): Promise<DriverResponseDto> {
    return this.driversService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a driver' })
  @ApiParam({ name: 'id', description: 'Driver ID', format: 'uuid' })
  @ApiBody({ type: UpdateDriverDto })
  @ApiOkResponse({ type: DriverResponseDto, description: 'Driver updated successfully' })
  @ApiBadRequestResponse({ description: 'Invalid input' })
  @ApiNotFoundResponse({ description: 'Driver not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDriverDto,
    @CurrentUser('sub') actorId: string,
  ): Promise<DriverResponseDto> {
    return this.driversService.update(id, dto, actorId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete a driver (set status to INACTIVE)' })
  @ApiParam({ name: 'id', description: 'Driver ID', format: 'uuid' })
  @ApiOkResponse({ type: DriverResponseDto, description: 'Driver deactivated successfully' })
  @ApiNotFoundResponse({ description: 'Driver not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  remove(
    @Param('id') id: string,
    @CurrentUser('sub') actorId: string,
  ): Promise<DriverResponseDto> {
    return this.driversService.remove(id, actorId);
  }
}

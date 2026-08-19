import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCreatedResponse, ApiOkResponse, ApiParam, ApiBody, ApiBearerAuth, ApiUnauthorizedResponse, ApiForbiddenResponse, ApiNotFoundResponse, ApiBadRequestResponse } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SchedulesService } from './schedules.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { ScheduleResponseDto } from './dto/schedule-response.dto';
import { SchedulePaginatedResponseDto } from './dto/schedule-paginated-response.dto';
import { ScheduleQueryDto } from './dto/schedule-query.dto';

@ApiBearerAuth()
@ApiTags('Admin Schedules')
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin/schedules')
@SkipThrottle({ auth: true })
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new schedule' })
  @ApiBody({ type: CreateScheduleDto })
  @ApiCreatedResponse({ type: ScheduleResponseDto, description: 'Schedule created successfully' })
  @ApiBadRequestResponse({ description: 'Invalid input' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  create(
    @Body() dto: CreateScheduleDto,
    @CurrentUser('sub') actorId: string,
  ): Promise<ScheduleResponseDto> {
    return this.schedulesService.create(dto, actorId);
  }

  @Get()
  @ApiOperation({ summary: 'List schedules with pagination and filters' })
  @ApiOkResponse({ type: SchedulePaginatedResponseDto, description: 'Paginated list of schedules' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  findAll(@Query() query: ScheduleQueryDto): Promise<SchedulePaginatedResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    return this.schedulesService.findAll(page, limit, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get schedule details' })
  @ApiParam({ name: 'id', description: 'Schedule ID', format: 'uuid' })
  @ApiOkResponse({ type: ScheduleResponseDto, description: 'Schedule details' })
  @ApiNotFoundResponse({ description: 'Schedule not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  findOne(@Param('id') id: string): Promise<ScheduleResponseDto> {
    return this.schedulesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a schedule' })
  @ApiParam({ name: 'id', description: 'Schedule ID', format: 'uuid' })
  @ApiBody({ type: UpdateScheduleDto })
  @ApiOkResponse({ type: ScheduleResponseDto, description: 'Schedule updated successfully' })
  @ApiBadRequestResponse({ description: 'Invalid input' })
  @ApiNotFoundResponse({ description: 'Schedule not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateScheduleDto,
    @CurrentUser('sub') actorId: string,
  ): Promise<ScheduleResponseDto> {
    return this.schedulesService.update(id, dto, actorId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a schedule' })
  @ApiParam({ name: 'id', description: 'Schedule ID', format: 'uuid' })
  @ApiOkResponse({ type: ScheduleResponseDto, description: 'Schedule deleted successfully' })
  @ApiNotFoundResponse({ description: 'Schedule not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  remove(
    @Param('id') id: string,
    @CurrentUser('sub') actorId: string,
  ): Promise<ScheduleResponseDto> {
    return this.schedulesService.remove(id, actorId);
  }
}

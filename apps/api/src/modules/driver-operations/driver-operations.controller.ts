import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
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
  ApiQuery,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { DriverOperationsService } from './driver-operations.service';
import { StartTripDto } from './dto/start-trip.dto';
import { FinishTripDto } from './dto/finish-trip.dto';
import { DriverAssignmentResponseDto } from './dto/driver-assignment-response.dto';
import { CurrentTripWrapperDto } from './dto/current-trip-response.dto';
import { TripDetailResponseDto } from '../trips/dto/trip-response.dto';

@ApiBearerAuth()
@ApiTags('Driver Operations')
@Roles(UserRole.DRIVER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('driver')
@SkipThrottle({ auth: true })
export class DriverOperationsController {
  constructor(private readonly driverOperationsService: DriverOperationsService) {}

  @Get('me/assignments/today')
  @ApiOperation({ summary: 'Get today active assignments for the authenticated driver' })
  @ApiQuery({ name: 'driverId', required: false, format: 'uuid', description: 'Driver ID (admin/super-admin only)' })
  @ApiOkResponse({ type: [DriverAssignmentResponseDto], description: 'Today assignments for the driver' })
  @ApiBadRequestResponse({ description: 'driverId required for non-driver roles' })
  @ApiNotFoundResponse({ description: 'Driver profile not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  getTodayAssignments(
    @CurrentUser() user: JwtPayload,
    @Query('driverId') driverId?: string,
  ): Promise<DriverAssignmentResponseDto[]> {
    return this.driverOperationsService.getTodayAssignments(user.sub, user.role, driverId);
  }

  @Post('trips/start')
  @ApiOperation({ summary: 'Start a trip for an active assignment (manual, no GPS)' })
  @ApiBody({ type: StartTripDto })
  @ApiCreatedResponse({ type: TripDetailResponseDto, description: 'Trip started successfully' })
  @ApiBadRequestResponse({ description: 'Assignment not active or suspended' })
  @ApiNotFoundResponse({ description: 'Assignment not found' })
  @ApiConflictResponse({ description: 'Driver or vehicle already has a trip in progress' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Assignment does not belong to the driver' })
  startTrip(
    @CurrentUser() user: JwtPayload,
    @Body() dto: StartTripDto,
  ): Promise<TripDetailResponseDto> {
    return this.driverOperationsService.startTrip(user.sub, user.role, dto);
  }

  @Post('trips/:id/finish')
  @ApiOperation({ summary: 'Finish a trip in progress' })
  @ApiParam({ name: 'id', description: 'Trip ID', format: 'uuid' })
  @ApiBody({ type: FinishTripDto })
  @ApiOkResponse({ type: TripDetailResponseDto, description: 'Trip finished successfully' })
  @ApiNotFoundResponse({ description: 'Trip not found' })
  @ApiConflictResponse({ description: 'Trip is not in progress' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Trip does not belong to the driver' })
  finishTrip(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: FinishTripDto,
  ): Promise<TripDetailResponseDto> {
    return this.driverOperationsService.finishTrip(user.sub, user.role, id, dto);
  }

  @Get('trips/current')
  @ApiOperation({ summary: 'Get the current in-progress trip for the authenticated driver (null if none)' })
  @ApiOkResponse({ type: CurrentTripWrapperDto, description: 'Current trip or data: null' })
  @ApiNotFoundResponse({ description: 'Driver profile not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  async getCurrentTrip(
    @CurrentUser() user: JwtPayload,
  ): Promise<CurrentTripWrapperDto> {
    const data = await this.driverOperationsService.getCurrentTrip(user.sub, user.role);
    return { data };
  }
}
import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Put, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  BindTrackingDeviceDto,
  DepartureLiveDto,
  FleetVehicleDto,
  LiveBusDto,
  TrackingAlertDto,
  TrackingAlertsQueryDto,
  TrackingDeviceDto,
  TrailPointDto,
  TrailQueryDto,
  UpdateTrackingDeviceDto,
} from './dto/tracking.dto';
import { TrackingLiveService } from './tracking-live.service';

@ApiBearerAuth()
@ApiTags('Student Operations')
@Roles(UserRole.STUDENT)
@Controller('student')
export class StudentTrackingController {
  constructor(private readonly live: TrackingLiveService) {}

  @Get('scheduled-departures/:id/live')
  @ApiOperation({
    summary: 'Live bus positions for a departure (only while the service is about to start or in progress)',
  })
  @ApiNotFoundResponse({ description: 'Scheduled departure not found' })
  @ApiOkResponse({ type: DepartureLiveDto })
  departureLive(@Param('id', ParseUUIDPipe) id: string) {
    return this.live.departureLive(id);
  }
}

@ApiBearerAuth()
@ApiTags('Driver Operations')
@Roles(UserRole.DRIVER)
@Controller('driver/operational')
export class DriverTrackingController {
  constructor(private readonly live: TrackingLiveService) {}

  @Get('assignments/:id/live')
  @ApiOperation({ summary: 'GPS status of the vehicle assigned to one of the authenticated driver assignments' })
  @ApiNotFoundResponse({ description: 'Assignment not found' })
  @ApiOkResponse({ type: LiveBusDto })
  assignmentLive(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.live.driverAssignmentLive(userId, id);
  }
}

@ApiBearerAuth()
@ApiTags('Admin Tracking')
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin/tracking')
export class AdminTrackingController {
  constructor(private readonly live: TrackingLiveService) {}

  @Get('devices')
  @ApiOperation({ summary: 'List AVL devices reported by Hunter (bound and unbound) with last position' })
  @ApiOkResponse({ type: TrackingDeviceDto, isArray: true })
  devices() {
    return this.live.listDevices();
  }

  @Put('devices/:id/vehicle')
  @ApiOperation({ summary: 'Bind an AVL device to a vehicle (or unbind with vehicleId null)' })
  @ApiNotFoundResponse({ description: 'Device or vehicle not found' })
  @ApiConflictResponse({ description: 'Vehicle already has another device' })
  @ApiOkResponse({ type: TrackingDeviceDto })
  bind(
    @CurrentUser('sub') actorId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BindTrackingDeviceDto,
  ) {
    return this.live.bindDevice(actorId, id, dto.vehicleId);
  }

  @Patch('devices/:id')
  @ApiOperation({ summary: 'Enable or disable an AVL device' })
  @ApiOkResponse({ type: TrackingDeviceDto })
  update(
    @CurrentUser('sub') actorId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTrackingDeviceDto,
  ) {
    return this.live.setDeviceActive(actorId, id, dto.isActive);
  }

  @Get('fleet')
  @ApiOperation({ summary: 'Live fleet: tracked vehicles, last position and current run' })
  @ApiOkResponse({ type: FleetVehicleDto, isArray: true })
  fleet() {
    return this.live.fleet();
  }

  @Get('alerts')
  @ApiOperation({ summary: 'Hunter alerts and critical events (panic, speeding, jamming, impacts) in the last N hours' })
  @ApiOkResponse({ type: TrackingAlertDto, isArray: true })
  alerts(@Query() query: TrackingAlertsQueryDto) {
    return this.live.alerts(query.hours ?? 24);
  }

  @Get('vehicles/:vehicleId/trail')
  @ApiOperation({ summary: 'Historical positions of a vehicle (max 24h window)' })
  @ApiOkResponse({ type: TrailPointDto, isArray: true })
  trail(@Param('vehicleId', ParseUUIDPipe) vehicleId: string, @Query() query: TrailQueryDto) {
    return this.live.trail(vehicleId, query.from, query.to);
  }
}

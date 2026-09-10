import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminScheduleService } from './admin-schedule.service';
import {
  AdminCalendarDetailDto,
  AdminCalendarListItemDto,
  AdminCalendarListQueryDto,
  AdminMaterializationResponseDto,
  AdminSchedulePatternDto,
  AdminScheduleTimeDto,
  AdminServiceExceptionDto,
  AdminTimetableQueryDto,
  AdminTimetableRowDto,
  CreateAdminCalendarDto,
  CreateAdminPatternDto,
  CreateJourneyTemplateDto,
  CreateScheduleTimeDto,
  CreateServiceExceptionDto,
  MaterializeAdminSchedulesDto,
  ReplaceJourneyStopTimesDto,
  ReplacePatternDaysDto,
  UpdateAdminCalendarDto,
  UpdateAdminPatternDto,
  UpdateJourneyTemplateDto,
  UpdateScheduleTimeDto,
  UpdateServiceExceptionDto,
} from './dto/admin-schedule.dto';

@ApiBearerAuth()
@ApiTags('Admin Schedules')
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin/schedules')
export class AdminScheduleController {
  constructor(private readonly scheduleService: AdminScheduleService) {}

  @Get('calendars')
  @ApiOperation({ summary: 'List administrative service calendars' })
  @ApiOkResponse({ type: AdminCalendarListItemDto, isArray: true })
  listCalendars(@Query() query: AdminCalendarListQueryDto): Promise<AdminCalendarListItemDto[]> {
    return this.scheduleService.listCalendars(query);
  }

  @Get('calendars/:id')
  @ApiOperation({ summary: 'Get complete calendar configuration' })
  @ApiOkResponse({ type: AdminCalendarDetailDto })
  getCalendar(@Param('id', ParseUUIDPipe) id: string): Promise<AdminCalendarDetailDto> {
    return this.scheduleService.getCalendar(id);
  }

  @Post('calendars')
  @ApiOperation({ summary: 'Create a DRAFT service calendar' })
  @ApiCreatedResponse({ type: AdminCalendarDetailDto })
  createCalendar(@Body() dto: CreateAdminCalendarDto, @CurrentUser('sub') actorId: string): Promise<AdminCalendarDetailDto> {
    return this.scheduleService.createCalendar(dto, actorId);
  }

  @Patch('calendars/:id')
  @ApiOperation({ summary: 'Update a DRAFT service calendar' })
  @ApiOkResponse({ type: AdminCalendarDetailDto })
  updateCalendar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAdminCalendarDto, @CurrentUser('sub') actorId: string): Promise<AdminCalendarDetailDto> {
    return this.scheduleService.updateCalendar(id, dto, actorId);
  }

  @Post('calendars/:id/publish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish a complete calendar configuration' })
  @ApiOkResponse({ type: AdminCalendarDetailDto })
  publishCalendar(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('sub') actorId: string): Promise<AdminCalendarDetailDto> {
    return this.scheduleService.publishCalendar(id, actorId);
  }

  @Post('calendars/:id/archive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive a service calendar' })
  @ApiOkResponse({ type: AdminCalendarDetailDto })
  archiveCalendar(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('sub') actorId: string): Promise<AdminCalendarDetailDto> {
    return this.scheduleService.archiveCalendar(id, actorId);
  }

  @Post('calendars/:calendarId/patterns')
  @ApiOperation({ summary: 'Create a regular schedule pattern' })
  @ApiCreatedResponse({ type: AdminSchedulePatternDto })
  createPattern(@Param('calendarId', ParseUUIDPipe) calendarId: string, @Body() dto: CreateAdminPatternDto, @CurrentUser('sub') actorId: string): Promise<AdminSchedulePatternDto> {
    return this.scheduleService.createPattern(calendarId, dto, actorId);
  }

  @Patch('patterns/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a schedule pattern' })
  @ApiOkResponse({ type: AdminSchedulePatternDto })
  updatePattern(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAdminPatternDto, @CurrentUser('sub') actorId: string): Promise<AdminSchedulePatternDto> {
    return this.scheduleService.updatePattern(id, dto, actorId);
  }

  @Put('patterns/:id/days')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Atomically replace pattern weekdays' })
  @ApiOkResponse({ type: AdminSchedulePatternDto })
  replacePatternDays(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReplacePatternDaysDto, @CurrentUser('sub') actorId: string): Promise<AdminSchedulePatternDto> {
    return this.scheduleService.replacePatternDays(id, dto, actorId);
  }

  @Post('patterns/:patternId/times')
  @ApiOperation({ summary: 'Create a recurrent civil schedule time' })
  @ApiCreatedResponse({ type: AdminScheduleTimeDto })
  createTime(@Param('patternId', ParseUUIDPipe) patternId: string, @Body() dto: CreateScheduleTimeDto, @CurrentUser('sub') actorId: string): Promise<AdminScheduleTimeDto> {
    return this.scheduleService.createTime(patternId, dto, actorId);
  }

  @Patch('times/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a schedule time' })
  @ApiOkResponse({ type: AdminScheduleTimeDto })
  updateTime(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateScheduleTimeDto, @CurrentUser('sub') actorId: string): Promise<AdminScheduleTimeDto> {
    return this.scheduleService.updateTime(id, dto, actorId);
  }

  @Delete('times/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a DRAFT schedule time' })
  @ApiNoContentResponse()
  removeTime(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('sub') actorId: string): Promise<void> {
    return this.scheduleService.removeTime(id, actorId);
  }

  @Post('times/:timeId/journeys')
  @ApiOperation({ summary: 'Attach a RoutePath journey template to a schedule time' })
  @ApiCreatedResponse({ type: AdminScheduleTimeDto })
  @HttpCode(HttpStatus.CREATED)
  createJourney(@Param('timeId', ParseUUIDPipe) timeId: string, @Body() dto: CreateJourneyTemplateDto, @CurrentUser('sub') actorId: string): Promise<AdminScheduleTimeDto> {
    return this.scheduleService.createJourney(timeId, dto, actorId);
  }

  @Patch('journeys/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change a journey RoutePath in a DRAFT calendar' })
  @ApiOkResponse({ type: AdminScheduleTimeDto })
  updateJourney(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateJourneyTemplateDto, @CurrentUser('sub') actorId: string): Promise<AdminScheduleTimeDto> {
    return this.scheduleService.updateJourney(id, dto, actorId);
  }

  @Delete('journeys/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove one journey template' })
  @ApiNoContentResponse()
  removeJourney(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('sub') actorId: string): Promise<void> {
    return this.scheduleService.removeJourney(id, actorId);
  }

  @Put('journeys/:id/stop-times')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Replace a journey itinerary and stop offsets atomically' })
  @ApiOkResponse({ type: AdminScheduleTimeDto })
  replaceStopTimes(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReplaceJourneyStopTimesDto, @CurrentUser('sub') actorId: string): Promise<AdminScheduleTimeDto> {
    return this.scheduleService.replaceStopTimes(id, dto, actorId);
  }

  @Get('calendars/:calendarId/exceptions')
  @ApiOperation({ summary: 'List calendar service exceptions' })
  @ApiOkResponse({ type: AdminServiceExceptionDto, isArray: true })
  listExceptions(@Param('calendarId', ParseUUIDPipe) calendarId: string): Promise<AdminServiceExceptionDto[]> {
    return this.scheduleService.listExceptions(calendarId);
  }

  @Post('calendars/:calendarId/exceptions')
  @ApiOperation({ summary: 'Create a DRAFT service exception' })
  @ApiCreatedResponse({ type: AdminServiceExceptionDto })
  createException(@Param('calendarId', ParseUUIDPipe) calendarId: string, @Body() dto: CreateServiceExceptionDto, @CurrentUser('sub') actorId: string): Promise<AdminServiceExceptionDto> {
    return this.scheduleService.createException(calendarId, dto, actorId);
  }

  @Post('exceptions/:exceptionId/patterns')
  @ApiOperation({ summary: 'Create a replacement/additional pattern for an exception' })
  @ApiCreatedResponse({ type: AdminSchedulePatternDto })
  createExceptionPattern(@Param('exceptionId', ParseUUIDPipe) exceptionId: string, @Body() dto: CreateAdminPatternDto, @CurrentUser('sub') actorId: string): Promise<AdminSchedulePatternDto> {
    return this.scheduleService.createExceptionPattern(exceptionId, dto, actorId);
  }

  @Get('exceptions/:id')
  @ApiOperation({ summary: 'Get a service exception' })
  @ApiOkResponse({ type: AdminServiceExceptionDto })
  getException(@Param('id', ParseUUIDPipe) id: string): Promise<AdminServiceExceptionDto> {
    return this.scheduleService.getExceptionDetail(id);
  }

  @Patch('exceptions/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a DRAFT service exception' })
  @ApiOkResponse({ type: AdminServiceExceptionDto })
  updateException(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateServiceExceptionDto, @CurrentUser('sub') actorId: string): Promise<AdminServiceExceptionDto> {
    return this.scheduleService.updateException(id, dto, actorId);
  }

  @Post('exceptions/:id/publish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish a complete service exception' })
  @ApiOkResponse({ type: AdminServiceExceptionDto })
  publishException(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('sub') actorId: string): Promise<AdminServiceExceptionDto> {
    return this.scheduleService.publishException(id, actorId);
  }

  @Post('exceptions/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a service exception' })
  @ApiOkResponse({ type: AdminServiceExceptionDto })
  cancelException(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('sub') actorId: string): Promise<AdminServiceExceptionDto> {
    return this.scheduleService.cancelException(id, actorId);
  }

  @Get('timetable')
  @ApiOperation({ summary: 'Query the complete administrative timetable' })
  @ApiOkResponse({ type: AdminTimetableRowDto, isArray: true })
  timetable(@Query() query: AdminTimetableQueryDto): Promise<AdminTimetableRowDto[]> {
    return this.scheduleService.timetable(query);
  }

  @Post('materialization')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Materialize scheduled departures for a date range' })
  @ApiOkResponse({ type: AdminMaterializationResponseDto })
  materialize(@Body() dto: MaterializeAdminSchedulesDto, @CurrentUser('sub') actorId: string): Promise<AdminMaterializationResponseDto> {
    return this.scheduleService.materialize(dto, actorId);
  }
}

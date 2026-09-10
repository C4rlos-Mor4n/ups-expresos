import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Direction, SchedulePatternType, SchedulePublicationStatus, ServiceExceptionEffect, ServiceExceptionReason, ServiceExceptionStatus, Weekday } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CalendarResolverService } from './calendar-resolver.service';
import { ScheduledDepartureMaterializerService } from './scheduled-departure-materializer.service';
import { MaterializerInputError } from './scheduled-departure-materializer.errors';
import {
  AdminCalendarDetailDto,
  AdminCalendarListItemDto,
  AdminCalendarListQueryDto,
  AdminJourneyTemplateDto,
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

const DEFAULT_TIMEZONE = 'America/Guayaquil';
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

const calendarInclude = Prisma.validator<Prisma.ServiceCalendarInclude>()({
  serviceLine: { select: { id: true, code: true, name: true, isActive: true } },
  patterns: {
    orderBy: { createdAt: 'asc' },
    include: {
      days: true,
      times: {
        orderBy: { departureTime: 'asc' },
        include: {
          journeyTemplates: {
            orderBy: { createdAt: 'asc' },
            include: {
              routePath: {
                include: {
                  stops: {
                    orderBy: { stopOrder: 'asc' },
                    include: { stop: true },
                  },
                },
              },
              stopTimes: {
                include: { routePathStop: { include: { stop: true } } },
              },
            },
          },
        },
      },
    },
  },
  exceptions: { orderBy: { serviceDate: 'asc' } },
});

type CalendarGraph = Prisma.ServiceCalendarGetPayload<{ include: typeof calendarInclude }>;
type PatternGraph = CalendarGraph['patterns'][number];
type TimeGraph = PatternGraph['times'][number];
type JourneyGraph = TimeGraph['journeyTemplates'][number];

const toCivilDate = (value: string): Date => {
  if (!DATE_PATTERN.test(value)) throw new BadRequestException('Date must use YYYY-MM-DD format');
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new BadRequestException('Date is not valid');
  }
  return date;
};

const isoDate = (value: Date): string => value.toISOString().slice(0, 10);
const isoTime = (value: Date): string => value.toISOString().slice(11, 19);

const toCivilTime = (value: string): Date => {
  if (!TIME_PATTERN.test(value)) throw new BadRequestException('Time must use HH:mm or HH:mm:ss format');
  const [hours, minutes, seconds = 0] = value.split(':').map(Number);
  return new Date(Date.UTC(1970, 0, 1, hours ?? 0, minutes ?? 0, seconds ?? 0));
};

const toPrismaError = (error: unknown): never => {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new ConflictException('The requested schedule configuration already exists');
  }
  throw error;
};

const assertTimezone = (timezone: string): void => {
  if (timezone !== DEFAULT_TIMEZONE) {
    throw new BadRequestException(`Only ${DEFAULT_TIMEZONE} is supported by CalendarResolver`);
  }
};

const assertDateRange = (from: string, until: string): void => {
  const start = toCivilDate(from);
  const end = toCivilDate(until);
  if (end < start) throw new BadRequestException('validUntil must not be before validFrom');
};

const issue = (code: string, message: string, details?: Record<string, string>) => ({ code, message, details });

@Injectable()
export class AdminScheduleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
    private readonly calendarResolver: CalendarResolverService,
    private readonly materializer: ScheduledDepartureMaterializerService,
  ) {}

  async listCalendars(query: AdminCalendarListQueryDto): Promise<AdminCalendarListItemDto[]> {
    const calendars = await this.prisma.serviceCalendar.findMany({
      where: {
        ...(query.serviceLineId ? { serviceLineId: query.serviceLineId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.effectiveDate
          ? { validFrom: { lte: toCivilDate(query.effectiveDate) }, validUntil: { gte: toCivilDate(query.effectiveDate) } }
          : {}),
      },
      orderBy: [{ validFrom: 'desc' }, { name: 'asc' }],
      include: { serviceLine: { select: { id: true, code: true, name: true } }, patterns: { include: { times: true } } },
    });
    return calendars.map((calendar) => ({
      id: calendar.id,
      name: calendar.name,
      serviceLine: calendar.serviceLine,
      validFrom: isoDate(calendar.validFrom),
      validUntil: isoDate(calendar.validUntil),
      timezone: calendar.timezone,
      status: calendar.status,
      patternCount: calendar.patterns.length,
      scheduleTimeCount: calendar.patterns.reduce((total, pattern) => total + pattern.times.length, 0),
      createdAt: calendar.createdAt,
      updatedAt: calendar.updatedAt,
    }));
  }

  async getCalendar(id: string): Promise<AdminCalendarDetailDto> {
    const calendar = await this.getCalendarGraph(id);
    return this.mapCalendar(calendar);
  }

  async createCalendar(dto: CreateAdminCalendarDto, actorId: string): Promise<AdminCalendarDetailDto> {
    assertDateRange(dto.validFrom, dto.validUntil);
    const timezone = dto.timezone ?? DEFAULT_TIMEZONE;
    assertTimezone(timezone);
    const line = await this.prisma.serviceLine.findUnique({ where: { id: dto.serviceLineId }, select: { id: true, isActive: true } });
    if (!line) throw new NotFoundException('ServiceLine not found');
    if (!line.isActive) throw new BadRequestException('ServiceLine is inactive');
    try {
      const calendar = await this.prisma.serviceCalendar.create({
        data: {
          serviceLineId: dto.serviceLineId,
          name: dto.name,
          validFrom: toCivilDate(dto.validFrom),
          validUntil: toCivilDate(dto.validUntil),
          timezone,
          status: SchedulePublicationStatus.DRAFT,
        },
        include: calendarInclude,
      });
      await this.auditLogsService.logAction(actorId, 'CREATE', 'ServiceCalendar', calendar.id, { serviceLineId: calendar.serviceLineId });
      return this.mapCalendar(calendar);
    } catch (error) {
      return toPrismaError(error);
    }
  }

  async updateCalendar(id: string, dto: UpdateAdminCalendarDto, actorId: string): Promise<AdminCalendarDetailDto> {
    const existing = await this.getCalendarGraph(id);
    if (existing.status !== SchedulePublicationStatus.DRAFT) {
      throw new ConflictException('Only DRAFT calendars are editable');
    }
    const validFrom = dto.validFrom ?? isoDate(existing.validFrom);
    const validUntil = dto.validUntil ?? isoDate(existing.validUntil);
    assertDateRange(validFrom, validUntil);
    const timezone = dto.timezone ?? existing.timezone;
    assertTimezone(timezone);
    try {
      const calendar = await this.prisma.serviceCalendar.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          validFrom: toCivilDate(validFrom),
          validUntil: toCivilDate(validUntil),
          timezone,
        },
        include: calendarInclude,
      });
      await this.auditLogsService.logAction(actorId, 'UPDATE', 'ServiceCalendar', id);
      return this.mapCalendar(calendar);
    } catch (error) {
      return toPrismaError(error);
    }
  }

  async publishCalendar(id: string, actorId: string): Promise<AdminCalendarDetailDto> {
    const calendar = await this.getCalendarGraph(id);
    if (calendar.status === SchedulePublicationStatus.ARCHIVED) throw new ConflictException('Archived calendars are immutable');
    const issues = this.validateCalendarForPublication(calendar);
    if (issues.length > 0) {
      throw new BadRequestException({ code: 'SCHEDULE_CONFIGURATION_INCOMPLETE', issues });
    }
    const published = await this.prisma.$transaction(async (tx) => {
      await tx.schedulePattern.updateMany({ where: { serviceCalendarId: id, exceptionId: null }, data: { status: SchedulePublicationStatus.PUBLISHED } });
      return tx.serviceCalendar.update({ where: { id }, data: { status: SchedulePublicationStatus.PUBLISHED }, include: calendarInclude });
    });
    await this.auditLogsService.logAction(actorId, 'PUBLISH', 'ServiceCalendar', id);
    return this.mapCalendar(published);
  }

  async archiveCalendar(id: string, actorId: string): Promise<AdminCalendarDetailDto> {
    const calendar = await this.getCalendarGraph(id);
    if (calendar.status === SchedulePublicationStatus.ARCHIVED) return this.mapCalendar(calendar);
    const archived = await this.prisma.serviceCalendar.update({
      where: { id },
      data: { status: SchedulePublicationStatus.ARCHIVED },
      include: calendarInclude,
    });
    await this.auditLogsService.logAction(actorId, 'ARCHIVE', 'ServiceCalendar', id);
    return this.mapCalendar(archived);
  }

  async createPattern(calendarId: string, dto: CreateAdminPatternDto, actorId: string, exceptionId?: string): Promise<AdminSchedulePatternDto> {
    const calendar = await this.getCalendarGraph(calendarId);
    if (dto.type && dto.type !== SchedulePatternType.EXPLICIT_TIMES) throw new BadRequestException('Unsupported schedule pattern type');
    if (exceptionId) {
      const exception = calendar.exceptions.find((item) => item.id === exceptionId);
      if (!exception) throw new NotFoundException('ServiceException not found in calendar');
      if (exception.status !== ServiceExceptionStatus.DRAFT || (calendar.status !== SchedulePublicationStatus.DRAFT && calendar.status !== SchedulePublicationStatus.PUBLISHED)) throw new ConflictException('Exception configuration is not editable');
      if ((dto.days ?? []).length > 0) throw new BadRequestException('Exception patterns must not contain weekdays');
    } else {
      this.assertDraftCalendar(calendar);
    }
    const pattern = await this.prisma.schedulePattern.create({
      data: {
        serviceCalendarId: calendarId,
        direction: dto.direction,
        type: SchedulePatternType.EXPLICIT_TIMES,
        status: SchedulePublicationStatus.DRAFT,
        name: dto.name ?? null,
        exceptionId: exceptionId ?? null,
        days: dto.days?.length ? { create: dto.days.map((weekday) => ({ weekday })) } : undefined,
      },
      include: { days: true, times: { include: { journeyTemplates: true } } },
    });
    await this.auditLogsService.logAction(actorId, 'CREATE', 'SchedulePattern', pattern.id, { calendarId });
    return this.mapPattern(pattern);
  }

  async updatePattern(id: string, dto: UpdateAdminPatternDto, actorId: string): Promise<AdminSchedulePatternDto> {
    const pattern = await this.getPattern(id);
    const calendar = await this.getCalendarGraph(pattern.serviceCalendarId);
    this.assertPatternEditable(pattern, calendar);
    const updated = await this.prisma.schedulePattern.update({
      where: { id },
      data: dto.name === undefined ? {} : { name: dto.name },
      include: { days: true, times: { include: { journeyTemplates: true } } },
    });
    await this.auditLogsService.logAction(actorId, 'UPDATE', 'SchedulePattern', id);
    return this.mapPattern(updated);
  }

  async replacePatternDays(id: string, dto: ReplacePatternDaysDto, actorId: string): Promise<AdminSchedulePatternDto> {
    const pattern = await this.getPattern(id);
    const calendar = await this.getCalendarGraph(pattern.serviceCalendarId);
    this.assertPatternEditable(pattern, calendar);
    if (pattern.exceptionId && dto.days.length > 0) throw new BadRequestException('Exception patterns must not contain weekdays');
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.schedulePatternDay.deleteMany({ where: { schedulePatternId: id } });
      await tx.schedulePatternDay.createMany({ data: dto.days.map((weekday) => ({ schedulePatternId: id, weekday })) });
      return tx.schedulePattern.findUniqueOrThrow({ where: { id }, include: { days: true, times: { include: { journeyTemplates: true } } } });
    });
    await this.auditLogsService.logAction(actorId, 'UPDATE_DAYS', 'SchedulePattern', id, { count: dto.days.length });
    return this.mapPattern(updated);
  }

  async createTime(patternId: string, dto: CreateScheduleTimeDto, actorId: string): Promise<AdminScheduleTimeDto> {
    const pattern = await this.getPattern(patternId);
    const calendar = await this.getCalendarGraph(pattern.serviceCalendarId);
    this.assertPatternEditable(pattern, calendar);
    try {
      const time = await this.prisma.scheduleTime.create({
        data: {
          schedulePatternId: patternId,
          departureTime: toCivilTime(dto.departureTime),
          approximateArrivalTime: dto.approximateArrivalTime ? toCivilTime(dto.approximateArrivalTime) : null,
        },
        include: { journeyTemplates: true },
      });
      await this.auditLogsService.logAction(actorId, 'CREATE', 'ScheduleTime', time.id, { patternId });
      return this.mapTime(time);
    } catch (error) {
      return toPrismaError(error);
    }
  }

  async updateTime(id: string, dto: UpdateScheduleTimeDto, actorId: string): Promise<AdminScheduleTimeDto> {
    const time = await this.getTime(id);
    const pattern = await this.getPattern(time.schedulePatternId);
    const calendar = await this.getCalendarGraph(pattern.serviceCalendarId);
    this.assertPatternEditable(pattern, calendar);
    try {
      const updated = await this.prisma.scheduleTime.update({
        where: { id },
        data: {
          ...(dto.departureTime !== undefined ? { departureTime: toCivilTime(dto.departureTime) } : {}),
          ...(dto.approximateArrivalTime !== undefined ? { approximateArrivalTime: dto.approximateArrivalTime === null ? null : toCivilTime(dto.approximateArrivalTime) } : {}),
        },
        include: { journeyTemplates: true },
      });
      await this.auditLogsService.logAction(actorId, 'UPDATE', 'ScheduleTime', id);
      return this.mapTime(updated);
    } catch (error) {
      return toPrismaError(error);
    }
  }

  async removeTime(id: string, actorId: string): Promise<void> {
    const time = await this.getTime(id);
    const pattern = await this.getPattern(time.schedulePatternId);
    const calendar = await this.getCalendarGraph(pattern.serviceCalendarId);
    this.assertPatternEditable(pattern, calendar);
    await this.prisma.scheduleTime.delete({ where: { id } }).catch(toPrismaError);
    await this.auditLogsService.logAction(actorId, 'DELETE', 'ScheduleTime', id);
  }

  async createJourney(timeId: string, dto: CreateJourneyTemplateDto, actorId: string): Promise<AdminScheduleTimeDto> {
    const time = await this.getTime(timeId);
    const pattern = await this.getPattern(time.schedulePatternId);
    const calendar = await this.getCalendarGraph(pattern.serviceCalendarId);
    this.assertPatternEditable(pattern, calendar);
    await this.assertRoutePath(dto.routePathId, calendar.serviceLineId, pattern.direction);
    try {
      await this.prisma.scheduleJourneyTemplate.create({ data: { scheduleTimeId: timeId, routePathId: dto.routePathId } });
    } catch (error) {
      return toPrismaError(error);
    }
    await this.auditLogsService.logAction(actorId, 'CREATE', 'ScheduleJourneyTemplate', timeId, { routePathId: dto.routePathId });
    return this.getMappedTime(timeId);
  }

  async updateJourney(id: string, dto: UpdateJourneyTemplateDto, actorId: string): Promise<AdminScheduleTimeDto> {
    const journey = await this.getJourney(id);
    const pattern = await this.getPattern(journey.scheduleTime.schedulePatternId);
    const calendar = await this.getCalendarGraph(pattern.serviceCalendarId);
    this.assertPatternEditable(pattern, calendar);
    await this.assertRoutePath(dto.routePathId, calendar.serviceLineId, pattern.direction);
    await this.prisma.scheduleJourneyTemplate.update({ where: { id }, data: { routePathId: dto.routePathId } });
    await this.auditLogsService.logAction(actorId, 'UPDATE', 'ScheduleJourneyTemplate', id);
    return this.getMappedTime(journey.scheduleTimeId);
  }

  async removeJourney(id: string, actorId: string): Promise<void> {
    const journey = await this.getJourney(id);
    const pattern = await this.getPattern(journey.scheduleTime.schedulePatternId);
    const calendar = await this.getCalendarGraph(pattern.serviceCalendarId);
    this.assertPatternEditable(pattern, calendar);
    await this.prisma.scheduleJourneyTemplate.delete({ where: { id } }).catch(toPrismaError);
    await this.auditLogsService.logAction(actorId, 'DELETE', 'ScheduleJourneyTemplate', id);
  }

  async replaceStopTimes(journeyId: string, dto: ReplaceJourneyStopTimesDto, actorId: string): Promise<AdminScheduleTimeDto> {
    const journey = await this.getJourney(journeyId);
    const pattern = await this.getPattern(journey.scheduleTime.schedulePatternId);
    const calendar = await this.getCalendarGraph(pattern.serviceCalendarId);
    this.assertPatternEditable(pattern, calendar);
    const routePath = await this.prisma.routePath.findUnique({ where: { id: journey.routePathId }, include: { stops: { orderBy: { stopOrder: 'asc' } } } });
    if (!routePath) throw new NotFoundException('RoutePath not found');
    const routeStopIds = new Set(routePath.stops.map((stop) => stop.id));
    const submitted = new Set<string>();
    for (const item of dto.stopTimes) {
      if (!routeStopIds.has(item.routePathStopId)) throw new BadRequestException('Every stop time must belong to the selected RoutePath');
      if (submitted.has(item.routePathStopId)) throw new BadRequestException('Duplicate RoutePathStop in itinerary');
      submitted.add(item.routePathStopId);
    }
    const ordered = routePath.stops.map((stop) => dto.stopTimes.find((item) => item.routePathStopId === stop.id));
    if (ordered.some((item) => !item) || ordered.length !== dto.stopTimes.length) throw new BadRequestException('Itinerary must cover every RoutePath stop exactly once');
    if (ordered[0]?.offsetMinutes !== 0) throw new BadRequestException('The first stop offset must be zero');
    for (let index = 1; index < ordered.length; index += 1) {
      const previous = ordered[index - 1]?.offsetMinutes;
      const current = ordered[index]?.offsetMinutes;
      if (previous === undefined || current === undefined || current < previous) throw new BadRequestException('Offsets must not decrease by stop order');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.scheduledStopTime.deleteMany({ where: { journeyTemplateId: journeyId } });
      await tx.scheduledStopTime.createMany({ data: dto.stopTimes.map((item) => ({ journeyTemplateId: journeyId, routePathStopId: item.routePathStopId, offsetMinutes: item.offsetMinutes })) });
    });
    await this.auditLogsService.logAction(actorId, 'UPDATE_STOP_TIMES', 'ScheduleJourneyTemplate', journeyId, { count: dto.stopTimes.length });
    return this.getMappedTime(journey.scheduleTimeId);
  }

  async listExceptions(calendarId: string): Promise<AdminServiceExceptionDto[]> {
    const calendar = await this.getCalendarGraph(calendarId);
    return calendar.exceptions.map((exception) => this.mapException(exception));
  }

  async getExceptionDetail(id: string): Promise<AdminServiceExceptionDto> {
    return this.mapException(await this.getException(id));
  }

  async createException(calendarId: string, dto: CreateServiceExceptionDto, actorId: string): Promise<AdminServiceExceptionDto> {
    const calendar = await this.getCalendarGraph(calendarId);
    if (calendar.status !== SchedulePublicationStatus.DRAFT && calendar.status !== SchedulePublicationStatus.PUBLISHED) {
      throw new ConflictException('Archived calendars are immutable');
    }
    const serviceDate = toCivilDate(dto.serviceDate);
    if (serviceDate < calendar.validFrom || serviceDate > calendar.validUntil) throw new BadRequestException('Exception date must be within calendar validity');
    try {
      const exception = await this.prisma.serviceException.create({ data: { serviceCalendarId: calendarId, serviceDate, direction: dto.direction ?? null, reason: dto.reason, effect: dto.effect, description: dto.description }, });
      await this.auditLogsService.logAction(actorId, 'CREATE', 'ServiceException', exception.id, { calendarId });
      return this.mapException(exception);
    } catch (error) {
      return toPrismaError(error);
    }
  }

  async updateException(id: string, dto: UpdateServiceExceptionDto, actorId: string): Promise<AdminServiceExceptionDto> {
    const exception = await this.getException(id);
    if (exception.status !== ServiceExceptionStatus.DRAFT) throw new ConflictException('Only DRAFT exceptions are editable');
    const updated = await this.prisma.serviceException.update({ where: { id }, data: { ...(dto.direction !== undefined ? { direction: dto.direction } : {}), ...(dto.reason !== undefined ? { reason: dto.reason } : {}), ...(dto.effect !== undefined ? { effect: dto.effect } : {}), ...(dto.description !== undefined ? { description: dto.description } : {}) } });
    await this.auditLogsService.logAction(actorId, 'UPDATE', 'ServiceException', id);
    return this.mapException(updated);
  }

  async createExceptionPattern(exceptionId: string, dto: CreateAdminPatternDto, actorId: string): Promise<AdminSchedulePatternDto> {
    const exception = await this.getException(exceptionId);
    return this.createPattern(exception.serviceCalendarId, { ...dto, days: [] }, actorId, exceptionId);
  }

  async publishException(id: string, actorId: string): Promise<AdminServiceExceptionDto> {
    const exception = await this.getException(id);
    const calendar = await this.getCalendarGraph(exception.serviceCalendarId);
    if (calendar.status !== SchedulePublicationStatus.PUBLISHED) throw new ConflictException('Calendar must be PUBLISHED before publishing an exception');
    const patterns = calendar.patterns.filter((pattern) => pattern.exceptionId === id);
    if (exception.effect !== ServiceExceptionEffect.NO_SERVICE) {
      const directions = exception.direction ? [exception.direction] : [...new Set(calendar.patterns.filter((pattern) => !pattern.exceptionId).map((pattern) => pattern.direction))];
      const issues = directions.flatMap((direction) => {
        const matches = patterns.filter((pattern) => pattern.direction === direction);
        if (matches.length !== 1) return [issue('EXCEPTION_PATTERN_REQUIRED', 'Exactly one replacement pattern is required for this direction', { direction })];
        const match = matches[0];
        return match ? this.validatePattern(match, calendar, true) : [];
      });
      if (issues.length > 0) throw new BadRequestException({ code: 'EXCEPTION_CONFIGURATION_INCOMPLETE', issues });
    }
    const published = await this.prisma.$transaction(async (tx) => {
      await tx.schedulePattern.updateMany({ where: { exceptionId: id }, data: { status: SchedulePublicationStatus.PUBLISHED } });
      return tx.serviceException.update({ where: { id }, data: { status: ServiceExceptionStatus.PUBLISHED } });
    });
    await this.auditLogsService.logAction(actorId, 'PUBLISH', 'ServiceException', id);
    return this.mapException(published);
  }

  async cancelException(id: string, actorId: string): Promise<AdminServiceExceptionDto> {
    await this.getException(id);
    const updated = await this.prisma.serviceException.update({ where: { id }, data: { status: ServiceExceptionStatus.CANCELLED } });
    await this.auditLogsService.logAction(actorId, 'CANCEL', 'ServiceException', id);
    return this.mapException(updated);
  }

  async timetable(query: AdminTimetableQueryDto): Promise<AdminTimetableRowDto[]> {
    const calendars = await this.prisma.serviceCalendar.findMany({
      where: {
        ...(query.calendarId ? { id: query.calendarId } : {}),
        ...(query.serviceLineId ? { serviceLineId: query.serviceLineId } : {}),
        ...(query.effectiveDate ? { validFrom: { lte: toCivilDate(query.effectiveDate) }, validUntil: { gte: toCivilDate(query.effectiveDate) } } : {}),
      },
      include: calendarInclude,
    });
    return calendars.flatMap((calendar) => calendar.patterns.filter((pattern) => !pattern.exceptionId && (!query.direction || pattern.direction === query.direction)).flatMap((pattern) => pattern.times.map((time) => ({
      scheduleTimeId: time.id,
      patternId: pattern.id,
      calendarId: calendar.id,
      serviceLineId: calendar.serviceLineId,
      direction: pattern.direction,
      days: pattern.days.map((day) => day.weekday),
      departureTime: isoTime(time.departureTime),
      journeyTemplates: time.journeyTemplates.map((journey) => this.mapJourney(journey)),
      status: pattern.status,
    }))));
  }

  async materialize(dto: MaterializeAdminSchedulesDto, actorId: string): Promise<AdminMaterializationResponseDto> {
    try {
      const result = await this.materializer.materialize(dto);
      await this.auditLogsService.logAction(actorId, 'MATERIALIZE', 'ScheduledDeparture', undefined, { serviceLineId: dto.serviceLineId, direction: dto.direction, fromDate: dto.fromDate, toDate: dto.toDate });
      return {
        serviceLineId: result.serviceLineId,
        direction: result.direction,
        fromDate: result.fromDate,
        toDate: result.toDate,
        totalDates: result.totalDates,
        processedDates: result.processedDates,
        noServiceDates: result.noServiceDates,
        created: result.created,
        existingSame: result.existingSame,
        existingDifferent: result.existingDifferent,
        missingFromCurrentResolution: result.missingFromCurrentResolution,
        errors: result.errors,
      };
    } catch (error) {
      if (error instanceof MaterializerInputError) throw new BadRequestException({ code: error.code, message: error.message });
      throw error;
    }
  }

  private async getCalendarGraph(id: string): Promise<CalendarGraph> {
    const calendar = await this.prisma.serviceCalendar.findUnique({ where: { id }, include: calendarInclude });
    if (!calendar) throw new NotFoundException('ServiceCalendar not found');
    return calendar;
  }

  private async getPattern(id: string): Promise<Prisma.SchedulePatternGetPayload<{ include: { days: true; times: { include: { journeyTemplates: true } } } }>> {
    const pattern = await this.prisma.schedulePattern.findUnique({ where: { id }, include: { days: true, times: { include: { journeyTemplates: true } } } });
    if (!pattern) throw new NotFoundException('SchedulePattern not found');
    return pattern;
  }

  private async getTime(id: string): Promise<Prisma.ScheduleTimeGetPayload<{ include: { journeyTemplates: true } }>> {
    const time = await this.prisma.scheduleTime.findUnique({ where: { id }, include: { journeyTemplates: true } });
    if (!time) throw new NotFoundException('ScheduleTime not found');
    return time;
  }

  private async getJourney(id: string): Promise<Prisma.ScheduleJourneyTemplateGetPayload<{ include: { scheduleTime: true } }>> {
    const journey = await this.prisma.scheduleJourneyTemplate.findUnique({ where: { id }, include: { scheduleTime: true } });
    if (!journey) throw new NotFoundException('ScheduleJourneyTemplate not found');
    return journey;
  }

  private async getException(id: string): Promise<Prisma.ServiceExceptionGetPayload<{}>> {
    const exception = await this.prisma.serviceException.findUnique({ where: { id } });
    if (!exception) throw new NotFoundException('ServiceException not found');
    return exception;
  }

  private assertDraftCalendar(calendar: CalendarGraph): void {
    if (calendar.status !== SchedulePublicationStatus.DRAFT) throw new ConflictException('Schedule configuration is editable only while the calendar is DRAFT');
  }

  private assertPatternEditable(pattern: { exceptionId: string | null }, calendar: CalendarGraph): void {
    if (calendar.status === SchedulePublicationStatus.DRAFT) return;
    if (calendar.status === SchedulePublicationStatus.PUBLISHED && pattern.exceptionId) {
      const exception = calendar.exceptions.find((item) => item.id === pattern.exceptionId);
      if (exception?.status === ServiceExceptionStatus.DRAFT) return;
    }
    throw new ConflictException('Schedule configuration is not editable in the current lifecycle state');
  }

  private async assertRoutePath(routePathId: string, serviceLineId: string, direction: Direction): Promise<void> {
    const routePath = await this.prisma.routePath.findUnique({ where: { id: routePathId }, select: { serviceLineId: true, direction: true, isActive: true } });
    if (!routePath) throw new NotFoundException('RoutePath not found');
    if (!routePath.isActive) throw new BadRequestException('RoutePath is inactive');
    if (routePath.serviceLineId !== serviceLineId) throw new BadRequestException('RoutePath does not belong to the calendar ServiceLine');
    if (routePath.direction !== direction) throw new BadRequestException('RoutePath direction does not match the SchedulePattern');
  }

  private validateCalendarForPublication(calendar: CalendarGraph): Array<{ code: string; message: string; details?: Record<string, string> }> {
    const issues: Array<{ code: string; message: string; details?: Record<string, string> }> = [];
    if (calendar.timezone !== DEFAULT_TIMEZONE) issues.push(issue('INVALID_TIMEZONE', `Only ${DEFAULT_TIMEZONE} is supported`));
    if (calendar.validUntil < calendar.validFrom) issues.push(issue('INVALID_VALIDITY', 'Calendar validUntil must not be before validFrom'));
    if (!calendar.serviceLine.isActive) issues.push(issue('INACTIVE_SERVICE_LINE', 'Calendar ServiceLine must be active'));
    const regular = calendar.patterns.filter((pattern) => pattern.exceptionId === null);
    if (regular.length === 0) issues.push(issue('PATTERN_REQUIRED', 'At least one regular pattern is required'));
    for (const pattern of regular) issues.push(...this.validatePattern(pattern, calendar, false));
    for (const direction of [Direction.IDA, Direction.RETORNO]) {
      const patterns = regular.filter((pattern) => pattern.direction === direction);
      const days = new Set<Weekday>();
      for (const pattern of patterns) for (const dayRecord of pattern.days) {
        const day = dayRecord.weekday;
        if (days.has(day)) issues.push(issue('AMBIGUOUS_PATTERN', 'Published patterns overlap on the same direction and weekday', { direction, weekday: day }));
        days.add(day);
      }
    }
    return issues;
  }

  private validatePattern(pattern: PatternGraph, calendar: CalendarGraph, exceptionPattern: boolean): Array<{ code: string; message: string; details?: Record<string, string> }> {
    const issues: Array<{ code: string; message: string; details?: Record<string, string> }> = [];
    if (pattern.type !== SchedulePatternType.EXPLICIT_TIMES) issues.push(issue('UNSUPPORTED_PATTERN_TYPE', 'Only EXPLICIT_TIMES is supported', { patternId: pattern.id }));
    if (pattern.status === SchedulePublicationStatus.ARCHIVED) issues.push(issue('ARCHIVED_PATTERN', 'Archived patterns cannot be published', { patternId: pattern.id }));
    if (exceptionPattern ? pattern.days.length > 0 : pattern.days.length === 0) issues.push(issue('INVALID_PATTERN_DAYS', exceptionPattern ? 'Exception patterns must not contain weekdays' : 'Regular patterns require at least one weekday', { patternId: pattern.id }));
    if (pattern.times.length === 0) issues.push(issue('SCHEDULE_TIME_REQUIRED', 'Pattern requires at least one ScheduleTime', { patternId: pattern.id }));
    for (const time of pattern.times) {
      if (time.journeyTemplates.length === 0) issues.push(issue('JOURNEY_REQUIRED', 'ScheduleTime requires at least one JourneyTemplate', { scheduleTimeId: time.id }));
      for (const journey of time.journeyTemplates) {
        if (journey.routePath.serviceLineId !== calendar.serviceLineId) issues.push(issue('FOREIGN_ROUTE_PATH_LINE', 'RoutePath belongs to another ServiceLine', { journeyTemplateId: journey.id }));
        if (journey.routePath.direction !== pattern.direction) issues.push(issue('WRONG_ROUTE_PATH_DIRECTION', 'RoutePath direction does not match Pattern direction', { journeyTemplateId: journey.id }));
        if (!journey.routePath.isActive) issues.push(issue('INACTIVE_ROUTE_PATH', 'RoutePath must be active', { routePathId: journey.routePathId }));
        const routeStops = [...journey.routePath.stops].sort((left, right) => left.stopOrder - right.stopOrder);
        const stopTimes = journey.stopTimes;
        if (stopTimes.length !== routeStops.length) {
          issues.push(issue('INCOMPLETE_STOP_COVERAGE', 'Journey must cover every RoutePath stop', { journeyTemplateId: journey.id }));
          continue;
        }
        const seen = new Set<string>();
        for (const stopTime of stopTimes) {
          if (!routeStops.some((routeStop) => routeStop.id === stopTime.routePathStopId)) issues.push(issue('FOREIGN_STOP', 'StopTime does not belong to the RoutePath', { journeyTemplateId: journey.id }));
          const routeStop = routeStops.find((candidate) => candidate.id === stopTime.routePathStopId);
          if (routeStop && !routeStop.stop.isActive) issues.push(issue('INACTIVE_STOP', 'Every scheduled stop must be active', { routePathStopId: routeStop.id }));
          if (seen.has(stopTime.routePathStopId)) issues.push(issue('DUPLICATE_STOP', 'Journey contains a duplicate RoutePathStop', { journeyTemplateId: journey.id }));
          seen.add(stopTime.routePathStopId);
        }
        const ordered = routeStops.map((routeStop) => stopTimes.find((stopTime) => stopTime.routePathStopId === routeStop.id));
        if (ordered.some((stopTime) => !stopTime)) continue;
        if (ordered[0]?.offsetMinutes !== 0) issues.push(issue('FIRST_OFFSET_NOT_ZERO', 'First stop offset must be zero', { journeyTemplateId: journey.id }));
        for (let index = 0; index < ordered.length; index += 1) {
          const current = ordered[index]?.offsetMinutes;
          const previous = ordered[index - 1]?.offsetMinutes;
          if (current === undefined || current < 0) issues.push(issue('NEGATIVE_OFFSET', 'Stop offsets must be non-negative', { journeyTemplateId: journey.id }));
          if (previous !== undefined && current !== undefined && current < previous) issues.push(issue('DECREASING_OFFSETS', 'Offsets must not decrease by RoutePath stop order', { journeyTemplateId: journey.id }));
        }
      }
    }
    return issues;
  }

  private mapCalendar(calendar: CalendarGraph): AdminCalendarDetailDto {
    return {
      id: calendar.id,
      name: calendar.name,
      serviceLine: calendar.serviceLine,
      validFrom: isoDate(calendar.validFrom),
      validUntil: isoDate(calendar.validUntil),
      timezone: calendar.timezone,
      status: calendar.status,
      patternCount: calendar.patterns.length,
      scheduleTimeCount: calendar.patterns.reduce((total, pattern) => total + pattern.times.length, 0),
      createdAt: calendar.createdAt,
      updatedAt: calendar.updatedAt,
      patterns: calendar.patterns.map((pattern) => this.mapPattern(pattern)),
      exceptions: calendar.exceptions.map((exception) => this.mapException(exception)),
    };
  }

  private mapPattern(pattern: { id: string; direction: Direction; type: SchedulePatternType; status: SchedulePublicationStatus; name: string | null; days: Array<{ weekday: Weekday }>; times: Array<{ id: string; departureTime: Date; approximateArrivalTime: Date | null; journeyTemplates: Array<{ id: string; scheduleTimeId: string; routePathId: string }> }> }): AdminSchedulePatternDto {
    return {
      id: pattern.id,
      direction: pattern.direction,
      type: pattern.type,
      status: pattern.status,
      name: pattern.name,
      days: pattern.days.map((day) => day.weekday),
      times: pattern.times.map((time) => this.mapTime(time)),
    };
  }

  private mapTime(time: TimeGraph | { id: string; departureTime: Date; approximateArrivalTime: Date | null; journeyTemplates: Array<{ id: string; scheduleTimeId: string; routePathId: string }> }): AdminScheduleTimeDto {
    return {
      id: time.id,
      departureTime: isoTime(time.departureTime),
      approximateArrivalTime: time.approximateArrivalTime ? isoTime(time.approximateArrivalTime) : null,
      journeyTemplates: time.journeyTemplates.map((journey) =>
        'routePath' in journey
          ? this.mapJourney(journey)
          : { id: journey.id, scheduleTimeId: journey.scheduleTimeId, routePathId: journey.routePathId, routePathCode: '', routePathDisplayName: '', direction: Direction.IDA, stopTimes: [] },
      ),
    };
  }

  private async getMappedTime(id: string): Promise<AdminScheduleTimeDto> {
    const time = await this.prisma.scheduleTime.findUnique({ where: { id }, include: { journeyTemplates: { include: { routePath: { include: { stops: { include: { stop: true } } } }, stopTimes: { include: { routePathStop: { include: { stop: true } } } } } } } });
    if (!time) throw new NotFoundException('ScheduleTime not found');
    return { id: time.id, departureTime: isoTime(time.departureTime), approximateArrivalTime: time.approximateArrivalTime ? isoTime(time.approximateArrivalTime) : null, journeyTemplates: time.journeyTemplates.map((journey) => this.mapJourney(journey)) };
  }

  private mapJourney(journey: JourneyGraph | { id: string; scheduleTimeId: string; routePathId: string; routePath: { code: string; displayName: string; direction: Direction; stops: Array<{ id: string; stopOrder: number; stop: { id: string; name: string } }> }; stopTimes: Array<{ id: string; routePathStopId: string; offsetMinutes: number; routePathStop: { stop: { id: string; name: string }; stopOrder: number } }> }): AdminJourneyTemplateDto {
    return {
      id: journey.id,
      scheduleTimeId: journey.scheduleTimeId,
      routePathId: journey.routePathId,
      routePathCode: journey.routePath.code,
      routePathDisplayName: journey.routePath.displayName,
      direction: journey.routePath.direction,
      stopTimes: [...journey.stopTimes].sort((left, right) => left.routePathStop.stopOrder - right.routePathStop.stopOrder).map((stopTime) => ({ id: stopTime.id, routePathStopId: stopTime.routePathStopId, stopOrder: stopTime.routePathStop.stopOrder, stopId: stopTime.routePathStop.stop.id, stopName: stopTime.routePathStop.stop.name, offsetMinutes: stopTime.offsetMinutes })),
    };
  }

  private mapException(exception: { id: string; serviceDate: Date; direction: Direction | null; reason: ServiceExceptionReason; effect: ServiceExceptionEffect; status: ServiceExceptionStatus; description: string }): AdminServiceExceptionDto {
    return { id: exception.id, serviceDate: isoDate(exception.serviceDate), direction: exception.direction, reason: exception.reason, effect: exception.effect, status: exception.status, description: exception.description };
  }
}

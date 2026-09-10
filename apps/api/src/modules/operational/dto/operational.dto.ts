import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  Direction,
  Prisma,
  SchedulePublicationStatus,
  ServiceAssignmentStatus,
  ServiceLineType,
  ServiceRunStatus,
  Weekday,
} from "@prisma/client";
import { Type } from "class-transformer";
import { IsEnum, IsOptional, IsUUID, Matches, Max, Min } from "class-validator";

export class StudentDepartureQueryDto {
  @ApiProperty({ example: "2026-09-01", format: "date" })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;

  @ApiPropertyOptional({ enum: Direction })
  @IsOptional()
  @IsEnum(Direction)
  direction?: Direction;
}

export class OperationalDateQueryDto {
  @ApiPropertyOptional({ example: "2026-09-01", format: "date" })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;
}

export class CreateServiceAssignmentDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  scheduledDepartureId!: string;

  @ApiProperty({ format: "uuid" })
  @IsUUID()
  vehicleId!: string;

  @ApiProperty({ format: "uuid" })
  @IsUUID()
  driverId!: string;

  @ApiProperty({
    format: "uuid",
    description:
      "Journey template owned by the scheduled departure source ScheduleTime",
  })
  @IsUUID()
  journeyTemplateId!: string;
}

export class AdminOperationalAssignmentsQueryDto extends OperationalDateQueryDto {
  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  serviceLineId?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class AdminServiceLinesQueryDto {
  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  campusId?: string;
}

export class OperationalCampusDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) address!:
    | string
    | null;
}

export class OperationalCampusSummaryDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
}

export class OperationalServiceLineDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) description!:
    | string
    | null;
}

export class OperationalServiceLineWithCampusDto extends OperationalServiceLineDto {
  @ApiProperty({ type: () => OperationalCampusSummaryDto })
  campus!: OperationalCampusSummaryDto;
}

export class OperationalVehicleWithIdDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() plate!: string;
  @ApiProperty() capacity!: number;
}

export class AdminOperationalCampusDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) address!:
    | string
    | null;
  @ApiProperty() isActive!: boolean;
  @ApiProperty({ type: String, format: "date-time" }) createdAt!: Date;
  @ApiProperty({ type: String, format: "date-time" }) updatedAt!: Date;
}

export class AdminOperationalServiceLineDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) description!:
    | string
    | null;
  @ApiProperty({ enum: ServiceLineType }) type!: ServiceLineType;
  @ApiProperty() isActive!: boolean;
  @ApiProperty({ type: () => OperationalCampusSummaryDto })
  campus!: OperationalCampusSummaryDto;
  @ApiPropertyOptional({ type: () => OperationalCampusSummaryDto, nullable: true })
  destinationCampus!: OperationalCampusSummaryDto | null;
}

export class AdminOperationalTimetableStopDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) reference!:
    | string
    | null;
}

export class AdminOperationalTimetablePathStopDto {
  @ApiProperty() stopOrder!: number;
  @ApiProperty({ type: () => AdminOperationalTimetableStopDto })
  stop!: AdminOperationalTimetableStopDto;
}

export class AdminOperationalTimetableRoutePathDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty({ enum: Direction }) direction!: Direction;
  @ApiProperty() isActive!: boolean;
  @ApiProperty({ type: () => AdminOperationalTimetablePathStopDto, isArray: true })
  stops!: AdminOperationalTimetablePathStopDto[];
}

export class AdminOperationalSchedulePatternDayDto {
  @ApiProperty({ enum: Weekday }) weekday!: Weekday;
}

export class AdminOperationalScheduleJourneyTemplateDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ format: "uuid" }) routePathId!: string;
}

export class AdminOperationalScheduleTimeDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ type: String, format: "date-time" }) departureTime!: Date;
  @ApiPropertyOptional({ type: String, format: "date-time", nullable: true })
  approximateArrivalTime!: Date | null;
  @ApiProperty({ type: () => AdminOperationalScheduleJourneyTemplateDto, isArray: true })
  journeyTemplates!: AdminOperationalScheduleJourneyTemplateDto[];
}

export class AdminOperationalSchedulePatternDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ enum: Direction }) direction!: Direction;
  @ApiProperty({ enum: SchedulePublicationStatus }) status!: SchedulePublicationStatus;
  @ApiProperty({ type: () => AdminOperationalSchedulePatternDayDto, isArray: true })
  days!: AdminOperationalSchedulePatternDayDto[];
  @ApiProperty({ type: () => AdminOperationalScheduleTimeDto, isArray: true })
  times!: AdminOperationalScheduleTimeDto[];
}

export class AdminOperationalServiceCalendarDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, format: "date-time" }) validFrom!: Date;
  @ApiProperty({ type: String, format: "date-time" }) validUntil!: Date;
  @ApiProperty() timezone!: string;
  @ApiProperty({ enum: SchedulePublicationStatus }) status!: SchedulePublicationStatus;
  @ApiProperty({ type: () => AdminOperationalSchedulePatternDto, isArray: true })
  patterns!: AdminOperationalSchedulePatternDto[];
}

export class AdminOperationalTimetableLineDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) description!:
    | string
    | null;
  @ApiProperty() isActive!: boolean;
  @ApiProperty({ type: () => OperationalCampusSummaryDto })
  campus!: OperationalCampusSummaryDto;
  @ApiProperty({ type: () => AdminOperationalTimetableRoutePathDto, isArray: true })
  paths!: AdminOperationalTimetableRoutePathDto[];
  @ApiProperty({ type: () => AdminOperationalServiceCalendarDto, isArray: true })
  calendars!: AdminOperationalServiceCalendarDto[];
}

export class AdminOperationalAssignmentStopDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) reference!:
    | string
    | null;
  @ApiPropertyOptional({ oneOf: [{ type: "number" }, { type: "string" }], nullable: true })
  latitude!: Prisma.Decimal | number | null;
  @ApiPropertyOptional({ oneOf: [{ type: "number" }, { type: "string" }], nullable: true })
  longitude!: Prisma.Decimal | number | null;
}

export class AdminOperationalRouteStopDto {
  @ApiProperty() stopOrder!: number;
  @ApiProperty({ type: () => AdminOperationalAssignmentStopDto })
  stop!: AdminOperationalAssignmentStopDto;
}

export class AdminOperationalAssignmentRoutePathDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty({ enum: Direction }) direction!: Direction;
  @ApiProperty({ type: () => AdminOperationalRouteStopDto, isArray: true })
  stops!: AdminOperationalRouteStopDto[];
}

export class AdminOperationalAssignmentDepartureDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ format: "date" }) serviceDate!: string;
  @ApiProperty({ example: "06:40" }) scheduledTime!: string;
  @ApiProperty({ enum: Direction }) direction!: Direction;
  @ApiProperty({ type: () => OperationalServiceLineWithCampusDto })
  serviceLine!: OperationalServiceLineWithCampusDto;
}

export class AdminOperationalAssignmentJourneyTemplateDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ type: () => AdminOperationalAssignmentRoutePathDto })
  routePath!: AdminOperationalAssignmentRoutePathDto;
}

export class AdminOperationalAssignmentDriverDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() name!: string;
}

export class AdminOperationalAssignmentOperationDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ enum: ServiceRunStatus }) status!: ServiceRunStatus;
  @ApiProperty({ type: String, format: "date-time" }) startedAt!: Date;
  @ApiPropertyOptional({ type: String, format: "date-time", nullable: true })
  completedAt!: Date | null;
}

export class AdminOperationalAssignmentDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ enum: ServiceAssignmentStatus }) status!: ServiceAssignmentStatus;
  @ApiProperty({ type: String, format: "date-time" }) plannedStartAt!: Date;
  @ApiProperty({ type: String, format: "date-time" }) plannedEndAt!: Date;
  @ApiProperty({ type: String, format: "date-time" }) createdAt!: Date;
  @ApiProperty({ type: String, format: "date-time" }) updatedAt!: Date;
  @ApiProperty({ type: () => AdminOperationalAssignmentDepartureDto })
  departure!: AdminOperationalAssignmentDepartureDto;
  @ApiProperty({ type: () => OperationalVehicleWithIdDto })
  vehicle!: OperationalVehicleWithIdDto;
  @ApiProperty({ type: () => AdminOperationalAssignmentDriverDto })
  driver!: AdminOperationalAssignmentDriverDto;
  @ApiProperty({ type: () => AdminOperationalAssignmentJourneyTemplateDto })
  journeyTemplate!: AdminOperationalAssignmentJourneyTemplateDto;
  @ApiPropertyOptional({ type: () => AdminOperationalAssignmentOperationDto, nullable: true })
  operation!: AdminOperationalAssignmentOperationDto | null;
}

export class AdminOperationalScheduledDepartureDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ example: "06:40" }) scheduledTime!: string;
  @ApiProperty({ enum: Direction }) direction!: Direction;
  @ApiProperty({ type: () => AdminOperationalAssignmentDto, isArray: true })
  assignments!: AdminOperationalAssignmentDto[];
}

export class AdminOperationalServiceLineTimetableDto {
  @ApiProperty({ format: "date" }) serviceDate!: string;
  @ApiProperty({ type: () => AdminOperationalTimetableLineDto })
  line!: AdminOperationalTimetableLineDto;
  @ApiProperty({ type: () => AdminOperationalScheduledDepartureDto, isArray: true })
  scheduledDepartures!: AdminOperationalScheduledDepartureDto[];
}

export class AdminOperationalPaginationMetaDto {
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() total!: number;
  @ApiProperty() totalPages!: number;
}

export class AdminOperationalAssignmentsResponseDto {
  @ApiProperty({ type: () => AdminOperationalAssignmentDto, isArray: true })
  data!: AdminOperationalAssignmentDto[];
  @ApiProperty({ type: () => AdminOperationalPaginationMetaDto })
  meta!: AdminOperationalPaginationMetaDto;
}

export class AssignedVehiclePreviewDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() plate!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) driverName!:
    | string
    | null;
}

export class OperationalDepartureSummaryDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ format: "date" }) serviceDate!: string;
  @ApiProperty({ example: "06:40" }) scheduledTime!: string;
  @ApiProperty({ enum: Direction }) direction!: Direction;
  @ApiProperty({ enum: ["SCHEDULED", "ASSIGNED", "IN_PROGRESS", "COMPLETED"] })
  state!: string;
  @ApiProperty() assignmentCount!: number;
  @ApiPropertyOptional({ type: String, nullable: true }) originStop?:
    | string
    | null;
  @ApiPropertyOptional({ type: String, nullable: true }) destinationStop?:
    | string
    | null;
  @ApiPropertyOptional({ type: Number }) stopsCount?: number;
  @ApiPropertyOptional({ type: () => AssignedVehiclePreviewDto, isArray: true })
  assignedVehicles?: AssignedVehiclePreviewDto[];
}

export class OperationalVehicleDto {
  @ApiPropertyOptional({ format: "uuid" }) id?: string;
  @ApiProperty() code!: string;
  @ApiProperty() plate!: string;
  @ApiProperty() capacity!: number;
}

export class OperationalJourneyStopDto {
  @ApiProperty() order!: number;
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) reference!:
    | string
    | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) latitude?:
    | number
    | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) longitude?:
    | number
    | null;
  @ApiProperty({
    example: 15,
    description: "Minutes from departure to this stop",
  })
  offsetMinutes!: number;
}

export class OperationalRunDto {
  @ApiPropertyOptional({ format: "uuid" }) id?: string;
  @ApiProperty({ enum: ["IN_PROGRESS", "COMPLETED"] }) status!: string;
  @ApiProperty({ format: "date-time" }) startedAt!: Date;
  @ApiPropertyOptional({ type: String, format: "date-time", nullable: true })
  completedAt!: Date | null;
}

export class StudentJourneyDto {
  @ApiProperty({ format: "uuid" }) routePathId!: string;
  @ApiProperty() code!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty({ enum: Direction }) direction!: Direction;
  @ApiProperty({ example: 65, description: "Total duration in minutes" })
  durationMinutes!: number;
  @ApiProperty({ type: () => OperationalJourneyStopDto, isArray: true })
  stops!: OperationalJourneyStopDto[];
}

export class StudentAssignmentDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ enum: ["ASSIGNED", "IN_PROGRESS", "COMPLETED"] })
  operationStatus!: string;
  @ApiProperty({ type: () => OperationalVehicleDto })
  vehicle!: OperationalVehicleDto;
  @ApiPropertyOptional({ type: String, nullable: true }) driverName!:
    | string
    | null;
  @ApiProperty({ format: "date-time" }) plannedStartAt!: Date;
  @ApiProperty({ format: "date-time" }) plannedEndAt!: Date;
  @ApiProperty({ type: () => StudentJourneyDto })
  journey!: StudentJourneyDto;
  @ApiPropertyOptional({ type: () => OperationalRunDto, nullable: true })
  run!: OperationalRunDto | null;
}

export class StudentDepartureDetailDto extends OperationalDepartureSummaryDto {
  @ApiProperty({ type: () => OperationalServiceLineWithCampusDto })
  serviceLine!: OperationalServiceLineWithCampusDto;
  @ApiPropertyOptional({ type: () => StudentJourneyDto, nullable: true })
  journey!: StudentJourneyDto | null;
  @ApiProperty({ type: () => StudentAssignmentDto, isArray: true })
  assignments!: StudentAssignmentDto[];
}

export class DriverStopDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) reference!:
    | string
    | null;
}

export class DriverRouteStopDto {
  @ApiProperty() stopOrder!: number;
  @ApiProperty({ type: () => DriverStopDto })
  stop!: DriverStopDto;
}

export class DriverRoutePathDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty({ enum: Direction }) direction!: Direction;
  @ApiProperty({ type: () => DriverRouteStopDto, isArray: true })
  stops!: DriverRouteStopDto[];
}

export class DriverJourneyDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ type: () => DriverRoutePathDto })
  routePath!: DriverRoutePathDto;
}

export class DriverDepartureDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ format: "date" }) serviceDate!: string;
  @ApiProperty({ example: "06:40" }) scheduledTime!: string;
  @ApiProperty({ enum: Direction }) direction!: Direction;
  @ApiProperty({ type: () => OperationalServiceLineWithCampusDto })
  serviceLine!: OperationalServiceLineWithCampusDto;
}

export class DriverAssignmentDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ enum: ["ASSIGNED", "IN_PROGRESS", "COMPLETED"] })
  operationalStatus!: string;
  @ApiProperty({ format: "date-time" }) plannedStartAt!: Date;
  @ApiProperty({ format: "date-time" }) plannedEndAt!: Date;
  @ApiProperty({ type: () => DriverDepartureDto })
  departure!: DriverDepartureDto;
  @ApiProperty({ type: () => OperationalVehicleWithIdDto })
  vehicle!: OperationalVehicleWithIdDto;
  @ApiProperty({ type: () => DriverJourneyDto }) journey!: DriverJourneyDto;
  @ApiPropertyOptional({ type: () => OperationalRunDto, nullable: true })
  run!: OperationalRunDto | null;
}

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Direction } from "@prisma/client";
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
  @ApiPropertyOptional({ type: String, nullable: true }) address!: string | null;
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
  @ApiPropertyOptional({ type: String, nullable: true }) description!: string | null;
}

export class OperationalServiceLineWithCampusDto extends OperationalServiceLineDto {
  @ApiProperty({ type: () => OperationalCampusSummaryDto })
  campus!: OperationalCampusSummaryDto;
}

export class OperationalDepartureSummaryDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ format: "date" }) serviceDate!: string;
  @ApiProperty({ example: "06:40" }) scheduledTime!: string;
  @ApiProperty({ enum: Direction }) direction!: Direction;
  @ApiProperty({ enum: ["SCHEDULED", "ASSIGNED", "IN_PROGRESS", "COMPLETED"] })
  state!: string;
  @ApiProperty() assignmentCount!: number;
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
  @ApiPropertyOptional({ type: String, nullable: true }) reference!: string | null;
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
  @ApiProperty({ type: () => OperationalJourneyStopDto, isArray: true })
  stops!: OperationalJourneyStopDto[];
}

export class StudentAssignmentDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ enum: ["ASSIGNED", "IN_PROGRESS", "COMPLETED"] })
  operationStatus!: string;
  @ApiProperty({ type: () => OperationalVehicleDto })
  vehicle!: OperationalVehicleDto;
  @ApiPropertyOptional({ type: String, nullable: true }) driverName!: string | null;
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
  @ApiProperty({ type: () => StudentAssignmentDto, isArray: true })
  assignments!: StudentAssignmentDto[];
}

export class OperationalVehicleWithIdDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() plate!: string;
  @ApiProperty() capacity!: number;
}

export class DriverStopDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) reference!: string | null;
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

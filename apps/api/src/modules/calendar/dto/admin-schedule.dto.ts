import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Direction,
  SchedulePatternType,
  SchedulePublicationStatus,
  ServiceExceptionEffect,
  ServiceExceptionReason,
  ServiceExceptionStatus,
  Weekday,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const CIVIL_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

export class AdminCalendarListQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  serviceLineId?: string;

  @ApiPropertyOptional({ enum: SchedulePublicationStatus })
  @IsOptional()
  @IsEnum(SchedulePublicationStatus)
  status?: SchedulePublicationStatus;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString({ strict: true })
  effectiveDate?: string;
}

export class CreateAdminCalendarDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  serviceLineId!: string;

  @ApiProperty({ example: 'Semestre 2026-A' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ format: 'date' })
  @IsDateString({ strict: true })
  validFrom!: string;

  @ApiProperty({ format: 'date' })
  @IsDateString({ strict: true })
  validUntil!: string;

  @ApiPropertyOptional({ default: 'America/Guayaquil' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;
}

export class UpdateAdminCalendarDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString({ strict: true })
  validFrom?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString({ strict: true })
  validUntil?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;
}

export class CreateAdminPatternDto {
  @ApiProperty({ enum: Direction })
  @IsEnum(Direction)
  direction!: Direction;

  @ApiPropertyOptional({ enum: SchedulePatternType, default: SchedulePatternType.EXPLICIT_TIMES })
  @IsOptional()
  @IsEnum(SchedulePatternType)
  type?: SchedulePatternType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ enum: Weekday, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(Weekday, { each: true })
  days?: Weekday[];
}

export class UpdateAdminPatternDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;
}

export class ReplacePatternDaysDto {
  @ApiProperty({ enum: Weekday, isArray: true })
  @IsArray()
  @ArrayUnique()
  @IsEnum(Weekday, { each: true })
  days!: Weekday[];
}

export class CreateScheduleTimeDto {
  @ApiProperty({ example: '06:40:00' })
  @Matches(CIVIL_TIME_PATTERN)
  departureTime!: string;

  @ApiPropertyOptional({ example: '07:45:00' })
  @IsOptional()
  @Matches(CIVIL_TIME_PATTERN)
  approximateArrivalTime?: string;
}

export class UpdateScheduleTimeDto {
  @ApiPropertyOptional({ example: '06:40:00' })
  @IsOptional()
  @Matches(CIVIL_TIME_PATTERN)
  departureTime?: string;

  @ApiPropertyOptional({ example: '07:45:00', nullable: true })
  @IsOptional()
  @Matches(CIVIL_TIME_PATTERN)
  approximateArrivalTime?: string | null;
}

export class CreateJourneyTemplateDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  routePathId!: string;
}

export class UpdateJourneyTemplateDto extends CreateJourneyTemplateDto {}

export class StopOffsetDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  routePathStopId!: string;

  @ApiProperty({ minimum: 0, example: 15 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offsetMinutes!: number;
}

export class ReplaceJourneyStopTimesDto {
  @ApiProperty({ type: () => StopOffsetDto, isArray: true })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => StopOffsetDto)
  stopTimes!: StopOffsetDto[];
}

export class CreateServiceExceptionDto {
  @ApiProperty({ format: 'date' })
  @IsDateString({ strict: true })
  serviceDate!: string;

  @ApiPropertyOptional({ enum: Direction, nullable: true })
  @IsOptional()
  @IsEnum(Direction)
  direction?: Direction | null;

  @ApiProperty({ enum: ServiceExceptionReason })
  @IsEnum(ServiceExceptionReason)
  reason!: ServiceExceptionReason;

  @ApiProperty({ enum: ServiceExceptionEffect })
  @IsEnum(ServiceExceptionEffect)
  effect!: ServiceExceptionEffect;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description!: string;
}

export class UpdateServiceExceptionDto {
  @ApiPropertyOptional({ enum: Direction, nullable: true })
  @IsOptional()
  @IsEnum(Direction)
  direction?: Direction | null;

  @ApiPropertyOptional({ enum: ServiceExceptionReason })
  @IsOptional()
  @IsEnum(ServiceExceptionReason)
  reason?: ServiceExceptionReason;

  @ApiPropertyOptional({ enum: ServiceExceptionEffect })
  @IsOptional()
  @IsEnum(ServiceExceptionEffect)
  effect?: ServiceExceptionEffect;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description?: string;
}

export class MaterializeAdminSchedulesDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  serviceLineId!: string;

  @ApiProperty({ enum: Direction })
  @IsEnum(Direction)
  direction!: Direction;

  @ApiProperty({ format: 'date' })
  @IsDateString({ strict: true })
  fromDate!: string;

  @ApiProperty({ format: 'date' })
  @IsDateString({ strict: true })
  toDate!: string;
}

export class AdminCalendarServiceLineDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
}

export class AdminCalendarListItemDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: () => AdminCalendarServiceLineDto }) serviceLine!: AdminCalendarServiceLineDto;
  @ApiProperty({ format: 'date' }) validFrom!: string;
  @ApiProperty({ format: 'date' }) validUntil!: string;
  @ApiProperty() timezone!: string;
  @ApiProperty({ enum: SchedulePublicationStatus }) status!: SchedulePublicationStatus;
  @ApiProperty() patternCount!: number;
  @ApiProperty() scheduleTimeCount!: number;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: Date;
}

export class AdminJourneyStopTimeDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) routePathStopId!: string;
  @ApiProperty() stopOrder!: number;
  @ApiProperty({ format: 'uuid' }) stopId!: string;
  @ApiProperty() stopName!: string;
  @ApiProperty() offsetMinutes!: number;
}

export class AdminJourneyTemplateDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) scheduleTimeId!: string;
  @ApiProperty({ format: 'uuid' }) routePathId!: string;
  @ApiProperty() routePathCode!: string;
  @ApiProperty() routePathDisplayName!: string;
  @ApiProperty({ enum: Direction }) direction!: Direction;
  @ApiProperty({ type: () => AdminJourneyStopTimeDto, isArray: true }) stopTimes!: AdminJourneyStopTimeDto[];
}

export class AdminScheduleTimeDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() departureTime!: string;
  @ApiPropertyOptional({ nullable: true }) approximateArrivalTime!: string | null;
  @ApiProperty({ type: () => AdminJourneyTemplateDto, isArray: true }) journeyTemplates!: AdminJourneyTemplateDto[];
}

export class AdminSchedulePatternDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: Direction }) direction!: Direction;
  @ApiProperty({ enum: SchedulePatternType }) type!: SchedulePatternType;
  @ApiProperty({ enum: SchedulePublicationStatus }) status!: SchedulePublicationStatus;
  @ApiPropertyOptional({ nullable: true }) name!: string | null;
  @ApiProperty({ enum: Weekday, isArray: true }) days!: Weekday[];
  @ApiProperty({ type: () => AdminScheduleTimeDto, isArray: true }) times!: AdminScheduleTimeDto[];
}

export class AdminServiceExceptionDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'date' }) serviceDate!: string;
  @ApiPropertyOptional({ enum: Direction, nullable: true }) direction!: Direction | null;
  @ApiProperty({ enum: ServiceExceptionReason }) reason!: ServiceExceptionReason;
  @ApiProperty({ enum: ServiceExceptionEffect }) effect!: ServiceExceptionEffect;
  @ApiProperty({ enum: ServiceExceptionStatus }) status!: ServiceExceptionStatus;
  @ApiProperty() description!: string;
}

export class AdminCalendarDetailDto extends AdminCalendarListItemDto {
  @ApiProperty({ type: () => AdminSchedulePatternDto, isArray: true }) patterns!: AdminSchedulePatternDto[];
  @ApiProperty({ type: () => AdminServiceExceptionDto, isArray: true }) exceptions!: AdminServiceExceptionDto[];
}

export class AdminTimetableRowDto {
  @ApiProperty({ format: 'uuid' }) scheduleTimeId!: string;
  @ApiProperty({ format: 'uuid' }) patternId!: string;
  @ApiProperty({ format: 'uuid' }) calendarId!: string;
  @ApiProperty({ format: 'uuid' }) serviceLineId!: string;
  @ApiProperty({ enum: Direction }) direction!: Direction;
  @ApiProperty({ enum: Weekday, isArray: true }) days!: Weekday[];
  @ApiProperty() departureTime!: string;
  @ApiProperty({ type: () => AdminJourneyTemplateDto, isArray: true }) journeyTemplates!: AdminJourneyTemplateDto[];
  @ApiProperty({ enum: SchedulePublicationStatus }) status!: SchedulePublicationStatus;
}

export class AdminTimetableQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  serviceLineId?: string;

  @ApiPropertyOptional({ enum: Direction })
  @IsOptional()
  @IsEnum(Direction)
  direction?: Direction;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  calendarId?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString({ strict: true })
  effectiveDate?: string;
}

export class AdminMaterializationResponseDto {
  @ApiProperty({ format: 'uuid' }) serviceLineId!: string;
  @ApiProperty({ enum: Direction }) direction!: Direction;
  @ApiProperty({ format: 'date' }) fromDate!: string;
  @ApiProperty({ format: 'date' }) toDate!: string;
  @ApiProperty() totalDates!: number;
  @ApiProperty() processedDates!: number;
  @ApiProperty() noServiceDates!: number;
  @ApiProperty() created!: number;
  @ApiProperty() existingSame!: number;
  @ApiProperty() existingDifferent!: number;
  @ApiProperty() missingFromCurrentResolution!: number;
  @ApiProperty() errors!: number;
}

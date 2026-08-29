-- CreateEnum
CREATE TYPE "Weekday" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateEnum
CREATE TYPE "SchedulePatternType" AS ENUM ('EXPLICIT_TIMES');

-- CreateEnum
CREATE TYPE "SchedulePublicationStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ServiceExceptionReason" AS ENUM ('HOLIDAY', 'VACATION', 'EXAM_PERIOD');

-- CreateEnum
CREATE TYPE "ServiceExceptionEffect" AS ENUM ('NO_SERVICE', 'REPLACE_TIMES', 'ADD_TIMES');

-- CreateEnum
CREATE TYPE "ServiceExceptionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED');

-- CreateTable
CREATE TABLE "service_calendars" (
    "id" UUID NOT NULL,
    "serviceLineId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "validFrom" DATE NOT NULL,
    "validUntil" DATE NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Guayaquil',
    "status" "SchedulePublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "service_calendars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_patterns" (
    "id" UUID NOT NULL,
    "serviceCalendarId" UUID NOT NULL,
    "direction" "Direction" NOT NULL,
    "type" "SchedulePatternType" NOT NULL DEFAULT 'EXPLICIT_TIMES',
    "status" "SchedulePublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "name" TEXT,
    "exceptionId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "schedule_patterns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_pattern_days" (
    "id" UUID NOT NULL,
    "schedulePatternId" UUID NOT NULL,
    "weekday" "Weekday" NOT NULL,

    CONSTRAINT "schedule_pattern_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_times" (
    "id" UUID NOT NULL,
    "schedulePatternId" UUID NOT NULL,
    "departureTime" TIME(0) NOT NULL,
    "approximateArrivalTime" TIME(0),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "schedule_times_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_journey_templates" (
    "id" UUID NOT NULL,
    "scheduleTimeId" UUID NOT NULL,
    "routePathId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "schedule_journey_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_stop_times" (
    "id" UUID NOT NULL,
    "journeyTemplateId" UUID NOT NULL,
    "routePathStopId" UUID NOT NULL,
    "offsetMinutes" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "scheduled_stop_times_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_exceptions" (
    "id" UUID NOT NULL,
    "serviceCalendarId" UUID NOT NULL,
    "serviceDate" DATE NOT NULL,
    "direction" "Direction",
    "reason" "ServiceExceptionReason" NOT NULL,
    "effect" "ServiceExceptionEffect" NOT NULL,
    "status" "ServiceExceptionStatus" NOT NULL DEFAULT 'DRAFT',
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "service_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_calendars_serviceLineId_validFrom_validUntil_status_idx" ON "service_calendars"("serviceLineId", "validFrom", "validUntil", "status");

-- CreateIndex
CREATE INDEX "schedule_patterns_serviceCalendarId_direction_status_idx" ON "schedule_patterns"("serviceCalendarId", "direction", "status");

-- CreateIndex
CREATE INDEX "schedule_patterns_exceptionId_direction_idx" ON "schedule_patterns"("exceptionId", "direction");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_pattern_days_schedulePatternId_weekday_key" ON "schedule_pattern_days"("schedulePatternId", "weekday");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_times_schedulePatternId_departureTime_key" ON "schedule_times"("schedulePatternId", "departureTime");

-- CreateIndex
CREATE INDEX "schedule_journey_templates_routePathId_idx" ON "schedule_journey_templates"("routePathId");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_journey_templates_scheduleTimeId_routePathId_key" ON "schedule_journey_templates"("scheduleTimeId", "routePathId");

-- CreateIndex
CREATE INDEX "scheduled_stop_times_journeyTemplateId_offsetMinutes_idx" ON "scheduled_stop_times"("journeyTemplateId", "offsetMinutes");

-- CreateIndex
CREATE UNIQUE INDEX "scheduled_stop_times_journeyTemplateId_routePathStopId_key" ON "scheduled_stop_times"("journeyTemplateId", "routePathStopId");

-- CreateIndex
CREATE INDEX "service_exceptions_serviceCalendarId_serviceDate_status_dir_idx" ON "service_exceptions"("serviceCalendarId", "serviceDate", "status", "direction");

-- CreateIndex
CREATE INDEX "service_exceptions_serviceDate_reason_effect_status_idx" ON "service_exceptions"("serviceDate", "reason", "effect", "status");

-- Additive domain invariants
ALTER TABLE "service_calendars"
    ADD CONSTRAINT "service_calendars_valid_range_check"
    CHECK ("validFrom" <= "validUntil");

ALTER TABLE "scheduled_stop_times"
    ADD CONSTRAINT "scheduled_stop_times_offset_minutes_check"
    CHECK ("offsetMinutes" >= 0);

-- Keep cancelled exception history while allowing only one active exception per scope.
CREATE UNIQUE INDEX "service_exceptions_active_global_uq"
    ON "service_exceptions"("serviceCalendarId", "serviceDate")
    WHERE "direction" IS NULL
      AND "status" IN ('DRAFT'::"ServiceExceptionStatus", 'PUBLISHED'::"ServiceExceptionStatus");

CREATE UNIQUE INDEX "service_exceptions_active_direction_uq"
    ON "service_exceptions"("serviceCalendarId", "serviceDate", "direction")
    WHERE "direction" IS NOT NULL
      AND "status" IN ('DRAFT'::"ServiceExceptionStatus", 'PUBLISHED'::"ServiceExceptionStatus");

-- AddForeignKey
ALTER TABLE "service_calendars" ADD CONSTRAINT "service_calendars_serviceLineId_fkey" FOREIGN KEY ("serviceLineId") REFERENCES "service_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_patterns" ADD CONSTRAINT "schedule_patterns_serviceCalendarId_fkey" FOREIGN KEY ("serviceCalendarId") REFERENCES "service_calendars"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_patterns" ADD CONSTRAINT "schedule_patterns_exceptionId_fkey" FOREIGN KEY ("exceptionId") REFERENCES "service_exceptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_pattern_days" ADD CONSTRAINT "schedule_pattern_days_schedulePatternId_fkey" FOREIGN KEY ("schedulePatternId") REFERENCES "schedule_patterns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_times" ADD CONSTRAINT "schedule_times_schedulePatternId_fkey" FOREIGN KEY ("schedulePatternId") REFERENCES "schedule_patterns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_journey_templates" ADD CONSTRAINT "schedule_journey_templates_scheduleTimeId_fkey" FOREIGN KEY ("scheduleTimeId") REFERENCES "schedule_times"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_journey_templates" ADD CONSTRAINT "schedule_journey_templates_routePathId_fkey" FOREIGN KEY ("routePathId") REFERENCES "route_paths"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_stop_times" ADD CONSTRAINT "scheduled_stop_times_journeyTemplateId_fkey" FOREIGN KEY ("journeyTemplateId") REFERENCES "schedule_journey_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_stop_times" ADD CONSTRAINT "scheduled_stop_times_routePathStopId_fkey" FOREIGN KEY ("routePathStopId") REFERENCES "route_path_stops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_exceptions" ADD CONSTRAINT "service_exceptions_serviceCalendarId_fkey" FOREIGN KEY ("serviceCalendarId") REFERENCES "service_calendars"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

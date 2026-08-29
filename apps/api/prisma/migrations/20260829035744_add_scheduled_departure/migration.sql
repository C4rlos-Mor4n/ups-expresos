-- CreateEnum
CREATE TYPE "ScheduledDepartureSource" AS ENUM ('REGULAR', 'EXCEPTION_REPLACE', 'EXCEPTION_ADD');

-- CreateTable
CREATE TABLE "scheduled_departures" (
    "id" UUID NOT NULL,
    "sourceScheduleTimeId" UUID NOT NULL,
    "serviceCalendarId" UUID NOT NULL,
    "serviceLineId" UUID NOT NULL,
    "serviceDate" DATE NOT NULL,
    "scheduledTime" TIME(0) NOT NULL,
    "direction" "Direction" NOT NULL,
    "source" "ScheduledDepartureSource" NOT NULL,
    "sourceExceptionId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scheduled_departures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scheduled_departures_serviceLineId_serviceDate_direction_sc_idx" ON "scheduled_departures"("serviceLineId", "serviceDate", "direction", "scheduledTime");

-- CreateIndex
CREATE INDEX "scheduled_departures_serviceCalendarId_serviceDate_idx" ON "scheduled_departures"("serviceCalendarId", "serviceDate");

-- CreateIndex
CREATE INDEX "scheduled_departures_sourceExceptionId_idx" ON "scheduled_departures"("sourceExceptionId");

-- CreateIndex
CREATE UNIQUE INDEX "scheduled_departures_sourceScheduleTimeId_serviceDate_key" ON "scheduled_departures"("sourceScheduleTimeId", "serviceDate");

-- AddForeignKey
ALTER TABLE "scheduled_departures" ADD CONSTRAINT "scheduled_departures_sourceScheduleTimeId_fkey" FOREIGN KEY ("sourceScheduleTimeId") REFERENCES "schedule_times"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_departures" ADD CONSTRAINT "scheduled_departures_serviceCalendarId_fkey" FOREIGN KEY ("serviceCalendarId") REFERENCES "service_calendars"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_departures" ADD CONSTRAINT "scheduled_departures_serviceLineId_fkey" FOREIGN KEY ("serviceLineId") REFERENCES "service_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_departures" ADD CONSTRAINT "scheduled_departures_sourceExceptionId_fkey" FOREIGN KEY ("sourceExceptionId") REFERENCES "service_exceptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

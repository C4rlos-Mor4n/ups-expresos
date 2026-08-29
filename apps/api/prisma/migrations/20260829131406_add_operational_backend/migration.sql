-- CreateEnum
CREATE TYPE "ServiceAssignmentStatus" AS ENUM ('ASSIGNED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ServiceRunStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateTable
CREATE TABLE "service_assignments" (
    "id" UUID NOT NULL,
    "scheduledDepartureId" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "driverId" UUID NOT NULL,
    "journeyTemplateId" UUID NOT NULL,
    "plannedStartAt" TIMESTAMPTZ(3) NOT NULL,
    "plannedEndAt" TIMESTAMPTZ(3) NOT NULL,
    "status" "ServiceAssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "service_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_runs" (
    "id" UUID NOT NULL,
    "serviceAssignmentId" UUID NOT NULL,
    "status" "ServiceRunStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMPTZ(3) NOT NULL,
    "completedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "service_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_assignments_scheduledDepartureId_idx" ON "service_assignments"("scheduledDepartureId");

-- CreateIndex
CREATE INDEX "service_assignments_vehicleId_plannedStartAt_idx" ON "service_assignments"("vehicleId", "plannedStartAt");

-- CreateIndex
CREATE INDEX "service_assignments_driverId_plannedStartAt_idx" ON "service_assignments"("driverId", "plannedStartAt");

-- CreateIndex
CREATE INDEX "service_assignments_status_idx" ON "service_assignments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "service_runs_serviceAssignmentId_key" ON "service_runs"("serviceAssignmentId");

-- CreateIndex
CREATE INDEX "service_runs_status_startedAt_idx" ON "service_runs"("status", "startedAt");

-- AddForeignKey
ALTER TABLE "service_assignments" ADD CONSTRAINT "service_assignments_scheduledDepartureId_fkey" FOREIGN KEY ("scheduledDepartureId") REFERENCES "scheduled_departures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_assignments" ADD CONSTRAINT "service_assignments_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_assignments" ADD CONSTRAINT "service_assignments_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_assignments" ADD CONSTRAINT "service_assignments_journeyTemplateId_fkey" FOREIGN KEY ("journeyTemplateId") REFERENCES "schedule_journey_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_runs" ADD CONSTRAINT "service_runs_serviceAssignmentId_fkey" FOREIGN KEY ("serviceAssignmentId") REFERENCES "service_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Keep resource-window integrity in PostgreSQL so concurrent requests cannot
-- assign the same vehicle or driver to overlapping planned windows.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "service_assignments"
  ADD CONSTRAINT "service_assignments_planned_window_check"
  CHECK ("plannedStartAt" < "plannedEndAt");

ALTER TABLE "service_assignments"
  ADD CONSTRAINT "service_assignments_vehicle_window_excl"
  EXCLUDE USING gist (
    "vehicleId" WITH =,
    tstzrange("plannedStartAt", "plannedEndAt", '[)') WITH &&
  )
  WHERE ("status" = 'ASSIGNED');

ALTER TABLE "service_assignments"
  ADD CONSTRAINT "service_assignments_driver_window_excl"
  EXCLUDE USING gist (
    "driverId" WITH =,
    tstzrange("plannedStartAt", "plannedEndAt", '[)') WITH &&
  )
  WHERE ("status" = 'ASSIGNED');

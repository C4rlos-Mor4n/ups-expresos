/*
  Warnings:

  - You are about to drop the column `assignedRouteId` on the `drivers` table. All the data in the column will be lost.
  - You are about to drop the column `assignedVehicleId` on the `drivers` table. All the data in the column will be lost.
  - You are about to drop the `notices` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `route_assignments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `route_stops` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `routes` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `schedules` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `trip_feedbacks` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `trips` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "drivers" DROP CONSTRAINT "drivers_assignedRouteId_fkey";

-- DropForeignKey
ALTER TABLE "drivers" DROP CONSTRAINT "drivers_assignedVehicleId_fkey";

-- DropForeignKey
ALTER TABLE "notices" DROP CONSTRAINT "notices_createdById_fkey";

-- DropForeignKey
ALTER TABLE "route_assignments" DROP CONSTRAINT "route_assignments_driverId_fkey";

-- DropForeignKey
ALTER TABLE "route_assignments" DROP CONSTRAINT "route_assignments_routeId_fkey";

-- DropForeignKey
ALTER TABLE "route_assignments" DROP CONSTRAINT "route_assignments_vehicleId_fkey";

-- DropForeignKey
ALTER TABLE "route_stops" DROP CONSTRAINT "route_stops_routeId_fkey";

-- DropForeignKey
ALTER TABLE "route_stops" DROP CONSTRAINT "route_stops_stopId_fkey";

-- DropForeignKey
ALTER TABLE "schedules" DROP CONSTRAINT "schedules_routeId_fkey";

-- DropForeignKey
ALTER TABLE "trip_feedbacks" DROP CONSTRAINT "trip_feedbacks_driverId_fkey";

-- DropForeignKey
ALTER TABLE "trip_feedbacks" DROP CONSTRAINT "trip_feedbacks_routeId_fkey";

-- DropForeignKey
ALTER TABLE "trip_feedbacks" DROP CONSTRAINT "trip_feedbacks_userId_fkey";

-- DropForeignKey
ALTER TABLE "trips" DROP CONSTRAINT "trips_assignmentId_fkey";

-- DropForeignKey
ALTER TABLE "trips" DROP CONSTRAINT "trips_driverId_fkey";

-- DropForeignKey
ALTER TABLE "trips" DROP CONSTRAINT "trips_routeId_fkey";

-- DropForeignKey
ALTER TABLE "trips" DROP CONSTRAINT "trips_vehicleId_fkey";

-- DropIndex
DROP INDEX "drivers_assignedRouteId_idx";

-- DropIndex
DROP INDEX "drivers_assignedVehicleId_idx";

-- AlterTable
ALTER TABLE "drivers" DROP COLUMN "assignedRouteId",
DROP COLUMN "assignedVehicleId";

-- DropTable
DROP TABLE "notices";

-- DropTable
DROP TABLE "route_assignments";

-- DropTable
DROP TABLE "route_stops";

-- DropTable
DROP TABLE "routes";

-- DropTable
DROP TABLE "schedules";

-- DropTable
DROP TABLE "trip_feedbacks";

-- DropTable
DROP TABLE "trips";

-- DropEnum
DROP TYPE "DayOfWeek";

-- DropEnum
DROP TYPE "NoticeSeverity";

-- DropEnum
DROP TYPE "RouteStatus";

-- DropEnum
DROP TYPE "ScheduleStatus";

-- DropEnum
DROP TYPE "TripStatus";

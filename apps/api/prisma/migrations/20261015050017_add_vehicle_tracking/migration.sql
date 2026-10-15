-- CreateEnum
CREATE TYPE "ServiceRunSource" AS ENUM ('DRIVER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "TrackingProvider" AS ENUM ('HUNTER');

-- CreateEnum
CREATE TYPE "TrackingPointKind" AS ENUM ('EVENT', 'ALERT');

-- AlterTable
ALTER TABLE "service_runs" ADD COLUMN     "completionSource" "ServiceRunSource",
ADD COLUMN     "startSource" "ServiceRunSource" NOT NULL DEFAULT 'DRIVER';

-- CreateTable
CREATE TABLE "tracking_devices" (
    "id" UUID NOT NULL,
    "provider" "TrackingProvider" NOT NULL,
    "externalId" TEXT NOT NULL,
    "alias" TEXT,
    "label" TEXT,
    "vehicleId" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastOccurredAt" TIMESTAMPTZ(3),
    "lastReceivedAt" TIMESTAMPTZ(3),
    "lastLatitude" DECIMAL(10,7),
    "lastLongitude" DECIMAL(10,7),
    "lastSpeedKph" DECIMAL(6,2),
    "lastHeading" INTEGER,
    "lastIgnition" BOOLEAN,
    "lastGpsQuality" INTEGER,
    "lastSatellites" INTEGER,
    "lastAddress" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tracking_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracking_points" (
    "id" UUID NOT NULL,
    "deviceId" UUID NOT NULL,
    "vehicleId" UUID,
    "kind" "TrackingPointKind" NOT NULL,
    "dedupKey" TEXT NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "speedKph" DECIMAL(6,2) NOT NULL,
    "heading" INTEGER,
    "altitudeMeters" INTEGER,
    "satellites" INTEGER,
    "gpsQuality" INTEGER,
    "ignition" BOOLEAN,
    "eventCode" INTEGER,
    "occurrenceCode" INTEGER,
    "description" TEXT,
    "raw" JSONB NOT NULL,

    CONSTRAINT "tracking_points_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tracking_devices_vehicleId_key" ON "tracking_devices"("vehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "tracking_devices_provider_externalId_key" ON "tracking_devices"("provider", "externalId");

-- CreateIndex
CREATE INDEX "tracking_points_vehicleId_occurredAt_idx" ON "tracking_points"("vehicleId", "occurredAt");

-- CreateIndex
CREATE INDEX "tracking_points_kind_occurredAt_idx" ON "tracking_points"("kind", "occurredAt");

-- CreateIndex
CREATE INDEX "tracking_points_receivedAt_idx" ON "tracking_points"("receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "tracking_points_deviceId_dedupKey_key" ON "tracking_points"("deviceId", "dedupKey");

-- AddForeignKey
ALTER TABLE "tracking_devices" ADD CONSTRAINT "tracking_devices_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking_points" ADD CONSTRAINT "tracking_points_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "tracking_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking_points" ADD CONSTRAINT "tracking_points_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

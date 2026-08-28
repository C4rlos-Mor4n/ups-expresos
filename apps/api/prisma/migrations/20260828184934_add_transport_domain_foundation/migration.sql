-- CreateEnum
CREATE TYPE "Direction" AS ENUM ('IDA', 'RETORNO');

-- CreateEnum
CREATE TYPE "ServiceLineType" AS ENUM ('CAMPUS_ROUTE', 'INTERCAMPUS');

-- CreateTable
CREATE TABLE "campuses" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_lines" (
    "id" UUID NOT NULL,
    "campusId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "ServiceLineType" NOT NULL DEFAULT 'CAMPUS_ROUTE',
    "destinationCampusId" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_paths" (
    "id" UUID NOT NULL,
    "serviceLineId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "direction" "Direction" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "route_paths_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_path_stops" (
    "id" UUID NOT NULL,
    "routePathId" UUID NOT NULL,
    "stopId" UUID NOT NULL,
    "stopOrder" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "route_path_stops_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "campuses_code_key" ON "campuses"("code");

-- CreateIndex
CREATE INDEX "campuses_isActive_idx" ON "campuses"("isActive");

-- CreateIndex
CREATE INDEX "service_lines_campusId_isActive_idx" ON "service_lines"("campusId", "isActive");

-- CreateIndex
CREATE INDEX "service_lines_destinationCampusId_idx" ON "service_lines"("destinationCampusId");

-- CreateIndex
CREATE UNIQUE INDEX "service_lines_campusId_code_key" ON "service_lines"("campusId", "code");

-- CreateIndex
CREATE INDEX "route_paths_serviceLineId_direction_isActive_idx" ON "route_paths"("serviceLineId", "direction", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "route_paths_serviceLineId_code_key" ON "route_paths"("serviceLineId", "code");

-- CreateIndex
CREATE INDEX "route_path_stops_stopId_idx" ON "route_path_stops"("stopId");

-- CreateIndex
CREATE UNIQUE INDEX "route_path_stops_routePathId_stopId_key" ON "route_path_stops"("routePathId", "stopId");

-- CreateIndex
CREATE UNIQUE INDEX "route_path_stops_routePathId_stopOrder_key" ON "route_path_stops"("routePathId", "stopOrder");

-- AddForeignKey
ALTER TABLE "service_lines" ADD CONSTRAINT "service_lines_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "campuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_lines" ADD CONSTRAINT "service_lines_destinationCampusId_fkey" FOREIGN KEY ("destinationCampusId") REFERENCES "campuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_paths" ADD CONSTRAINT "route_paths_serviceLineId_fkey" FOREIGN KEY ("serviceLineId") REFERENCES "service_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_path_stops" ADD CONSTRAINT "route_path_stops_routePathId_fkey" FOREIGN KEY ("routePathId") REFERENCES "route_paths"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_path_stops" ADD CONSTRAINT "route_path_stops_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "stops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

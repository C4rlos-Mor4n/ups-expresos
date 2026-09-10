-- CreateTable
CREATE TABLE "service_line_campuses" (
    "id" UUID NOT NULL,
    "serviceLineId" UUID NOT NULL,
    "campusId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_line_campuses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_line_campuses_campusId_idx" ON "service_line_campuses"("campusId");

-- CreateIndex
CREATE INDEX "service_line_campuses_serviceLineId_idx" ON "service_line_campuses"("serviceLineId");

-- CreateIndex
CREATE UNIQUE INDEX "service_line_campuses_serviceLineId_campusId_key" ON "service_line_campuses"("serviceLineId", "campusId");

-- AddForeignKey
ALTER TABLE "service_line_campuses" ADD CONSTRAINT "service_line_campuses_serviceLineId_fkey" FOREIGN KEY ("serviceLineId") REFERENCES "service_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_line_campuses" ADD CONSTRAINT "service_line_campuses_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "campuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

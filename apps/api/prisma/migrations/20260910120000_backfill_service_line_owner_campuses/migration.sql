-- Backfill the invariant that every service line serves its owner campus.
-- The deterministic UUID keeps this data migration idempotent without relying
-- on a UUID-generating extension that is not part of the database baseline.
INSERT INTO "service_line_campuses" ("id", "serviceLineId", "campusId")
SELECT
  md5('service-line-owner:' || sl."id"::text || ':' || sl."campusId"::text)::uuid,
  sl."id",
  sl."campusId"
FROM "service_lines" AS sl
ON CONFLICT ("serviceLineId", "campusId") DO NOTHING;

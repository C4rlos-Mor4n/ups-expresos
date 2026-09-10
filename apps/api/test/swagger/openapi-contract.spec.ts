import { strict as assert } from "node:assert";
import { NestFactory } from "@nestjs/core";
import { SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "../../src/app.module";
import { buildSwaggerDocumentConfig } from "../../src/config/swagger.config";

async function main() {
  const app = await NestFactory.create(AppModule, { logger: false });
  const config = buildSwaggerDocumentConfig();
  const document = SwaggerModule.createDocument(app, config);
  await app.close();

  const tags = (document.tags || []).map((tag) => tag.name);
  assert.equal(
    tags.includes("Users"),
    false,
    "Users tag should not be declared when unused",
  );

  const urls = (document.servers || []).map((server) => server.url);
  assert.equal(
    urls.includes("http://localhost:3000"),
    true,
    "Local development server should be documented",
  );
  assert.equal(
    urls.includes("https://staging-api.example.com"),
    false,
    "Placeholder staging server should be removed",
  );
  assert.equal(
    urls.includes("https://ups-api-sfq9.onrender.com"),
    false,
    "Legacy Render server should be removed",
  );
  assert.equal(
    urls.includes("https://robust-strong-cattle.ngrok-free.app"),
    false,
    "Legacy ngrok server should be removed",
  );

  const requestCodePath = document.paths["/auth/request-code"];
  assert.ok(requestCodePath, "/auth/request-code should be documented");
  const requestCodeResponses = requestCodePath.post?.responses;
  assert.ok(requestCodeResponses, "request-code should document responses");
  assert.ok(
    requestCodeResponses["400"],
    "request-code should document 400 responses",
  );
  assert.ok(
    requestCodeResponses["201"],
    "request-code should document 201 responses",
  );

  assert.equal(
    document.paths["/admin/routes/{id}/stops/order"],
    undefined,
    "Legacy route-order endpoint must not be resurrected in the operational API contract",
  );

  const targets = [
    ["get", "/health", "200"],
    ["get", "/health/db", "200"],
    ["post", "/auth/request-code", "201"],
    ["post", "/auth/logout", "200"],
    ["get", "/student/campuses", "200"],
    ["get", "/driver/operational/assignments/today", "200"],
    ["post", "/driver/operational/assignments/{id}/start", "200"],
    ["post", "/admin/operational/service-assignments", "201"],
  ] as const;

  for (const [method, path, code] of targets) {
    const operation = document.paths[path]?.[method];
    const response = operation?.responses?.[code] as
      | { content?: { "application/json"?: { schema?: unknown } } }
      | undefined;
    const schema = response?.content?.["application/json"]?.schema;
    assert.ok(
      schema,
      `${method.toUpperCase()} ${path} should have explicit application/json schema`,
    );
  }

  const adminOperationalResponses = [
    [
      "get",
      "/admin/operational/campuses",
      "#/components/schemas/AdminOperationalCampusDto",
      true,
    ],
    [
      "get",
      "/admin/operational/service-lines",
      "#/components/schemas/AdminOperationalServiceLineDto",
      true,
    ],
    [
      "get",
      "/admin/operational/service-lines/{id}/timetable",
      "#/components/schemas/AdminOperationalServiceLineTimetableDto",
      false,
    ],
    [
      "post",
      "/admin/operational/service-assignments",
      "#/components/schemas/AdminOperationalAssignmentDto",
      false,
    ],
    [
      "get",
      "/admin/operational/service-assignments",
      "#/components/schemas/AdminOperationalAssignmentsResponseDto",
      false,
    ],
    [
      "get",
      "/admin/operational/service-runs",
      "#/components/schemas/AdminOperationalAssignmentsResponseDto",
      false,
    ],
  ] as const;

  for (const [method, path, expectedRef, isArray] of adminOperationalResponses) {
    const operation = document.paths[path]?.[method];
    const response = operation?.responses?.[isArray ? "200" : method === "post" ? "201" : "200"] as
      | { content?: { "application/json"?: { schema?: { $ref?: string; type?: string; items?: { $ref?: string } } } } }
      | undefined;
    const schema = response?.content?.["application/json"]?.schema;

    assert.ok(schema, `${method.toUpperCase()} ${path} should have a response schema`);
    if (isArray) {
      assert.equal(schema.type, "array", `${method.toUpperCase()} ${path} should return an array`);
      assert.equal(schema.items?.$ref, expectedRef, `${method.toUpperCase()} ${path} should reference ${expectedRef}`);
    } else {
      assert.equal(schema.$ref, expectedRef, `${method.toUpperCase()} ${path} should reference ${expectedRef}`);
    }
  }

  const studentDetailPath =
    document.paths["/student/scheduled-departures/{id}"];
  assert.ok(
    studentDetailPath,
    "/student/scheduled-departures/{id} should be documented",
  );
  const studentDetailResponse = studentDetailPath.get?.responses?.["200"] as
    | {
        content?: { "application/json"?: { schema?: { $ref?: string } } };
      }
    | undefined;
  assert.ok(
    studentDetailResponse?.content?.[
      "application/json"
    ]?.schema?.$ref?.includes("StudentDepartureDetailDto"),
    "/student/scheduled-departures/{id} should return StudentDepartureDetailDto",
  );

  const schemas = document.components?.schemas as
    | Record<string, { properties?: Record<string, { type?: string }> }>
    | undefined;
  assert.ok(schemas, "components.schemas should be defined");

  const journeyStopSchema = schemas["OperationalJourneyStopDto"];
  assert.ok(
    journeyStopSchema?.properties?.["offsetMinutes"],
    "OperationalJourneyStopDto must expose offsetMinutes",
  );
  assert.equal(
    journeyStopSchema?.properties?.["offsetMinutes"]?.type,
    "number",
    "offsetMinutes must be number",
  );

  const studentJourneySchema = schemas["StudentJourneyDto"];
  assert.ok(
    studentJourneySchema?.properties?.["durationMinutes"],
    "StudentJourneyDto must expose durationMinutes",
  );
  assert.equal(
    studentJourneySchema?.properties?.["durationMinutes"]?.type,
    "number",
    "durationMinutes must be number",
  );

  console.log("openapi contract checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

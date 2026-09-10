import { NestFactory } from "@nestjs/core";
import { SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { buildSwaggerDocumentConfig } from "./config/swagger.config";
import * as fs from "node:fs";
import * as path from "node:path";

async function exportOpenApi(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });

  const document = SwaggerModule.createDocument(
    app,
    buildSwaggerDocumentConfig(),
  );

  const outputPath = path.resolve(__dirname, "../openapi-spec.json");
  fs.writeFileSync(outputPath, JSON.stringify(document, null, 2));
  console.log(`OpenAPI spec exported to ${outputPath}`);

  await app.close();
}

exportOpenApi();

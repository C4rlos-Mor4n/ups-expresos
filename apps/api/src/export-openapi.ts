import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { buildSwaggerDocumentConfig } from './config/swagger.config';
import * as fs from 'node:fs';

async function exportOpenApi(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });

  const document = SwaggerModule.createDocument(app, buildSwaggerDocumentConfig());
  
  fs.writeFileSync('./openapi-spec.json', JSON.stringify(document, null, 2));
  console.log('OpenAPI spec exported to openapi-spec.json');
  
  await app.close();
}

exportOpenApi();

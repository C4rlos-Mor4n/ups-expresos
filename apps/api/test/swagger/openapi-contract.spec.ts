import { strict as assert } from 'node:assert';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../../src/app.module';
import { buildSwaggerDocumentConfig } from '../../src/config/swagger.config';

async function main() {
  const app = await NestFactory.create(AppModule, { logger: false });
  const config = buildSwaggerDocumentConfig();
  const document = SwaggerModule.createDocument(app, config);
  await app.close();

  const tags = (document.tags || []).map((tag) => tag.name);
  assert.equal(tags.includes('Users'), false, 'Users tag should not be declared when unused');

  const urls = (document.servers || []).map((server) => server.url);
  assert.equal(urls.includes('http://localhost:3000'), true, 'Local development server should be documented');
  assert.equal(urls.includes('https://staging-api.example.com'), false, 'Placeholder staging server should be removed');
  assert.equal(urls.includes('https://ups-api-sfq9.onrender.com'), false, 'Legacy Render server should be removed');
  assert.equal(urls.includes('https://robust-strong-cattle.ngrok-free.app'), false, 'Legacy ngrok server should be removed');

  const requestCodePath = document.paths['/auth/request-code'];
  assert.ok(requestCodePath, '/auth/request-code should be documented');
  const requestCodeResponses = requestCodePath.post?.responses;
  assert.ok(requestCodeResponses, 'request-code should document responses');
  assert.ok(requestCodeResponses['400'], 'request-code should document 400 responses');
  assert.ok(requestCodeResponses['201'], 'request-code should document 201 responses');

  const targets = [
    ['get', '/health', '200'],
    ['get', '/health/db', '200'],
    ['post', '/auth/request-code', '201'],
    ['post', '/auth/logout', '200'],
    ['patch', '/admin/routes/{id}/stops/order', '200'],
  ] as const;

  for (const [method, path, code] of targets) {
    const operation = document.paths[path]?.[method];
    const response = operation?.responses?.[code] as { content?: { 'application/json'?: { schema?: unknown } } } | undefined;
    const schema = response?.content?.['application/json']?.schema;
    assert.ok(schema, `${method.toUpperCase()} ${path} should have explicit application/json schema`);
  }

  console.log('openapi contract checks passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
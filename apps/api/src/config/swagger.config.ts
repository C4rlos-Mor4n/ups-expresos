import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function buildSwaggerDocumentConfig(): Omit<ReturnType<DocumentBuilder['build']>, never> {
  const builder = new DocumentBuilder()
    .setTitle('UPS GO API')
    .setDescription(
      'Backend API for UPS GO, the operational transport system for Universidad Politécnica Salesiana. ' +
      'It exposes authentication, the scheduled transport domain, student read models, driver operations, and administrative operational planning.',
    )
    .setVersion('1.0.0')
    .addServer('http://localhost:3000', 'Local development')
    .addBearerAuth()
    .addTag('Health', 'Service health checks')
    .addTag('Auth', 'Authentication and OTP verification')
    .addTag('Admin Stops', 'Admin stop management')
    .addTag('Admin Vehicles', 'Admin vehicle management')
    .addTag('Admin Drivers', 'Admin driver management')
    .addTag('Student Operations', 'Student read-only API backed by the scheduled operational domain')
    .addTag('Driver Operational', 'Driver operational endpoints backed by ServiceAssignment and ServiceRun')
    .addTag('Admin Operational', 'Admin operational planning and ServiceRun monitoring');

  const publicUrl = process.env['APP_PUBLIC_URL']?.trim();
  if (publicUrl) {
    builder.addServer(publicUrl, 'Public environment');
  }

  return builder.build();
}

export function setupSwagger(app: INestApplication, enabled: boolean, path: string): void {
  if (!enabled) return;

  const document = SwaggerModule.createDocument(app, buildSwaggerDocumentConfig());
  SwaggerModule.setup(path, app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });
}

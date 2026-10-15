import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { Public } from '../../../common/decorators/public.decorator';
import { TrackingService } from '../tracking.service';
import {
  coerceHunterBody,
  HunterKind,
  HunterPayloadError,
  normalizeHunterPayload,
  NormalizedTrackingReport,
} from './hunter-payload';

/** Máximo de reportes por POST (Hunter envía uno por evento; se toleran lotes pequeños). */
const MAX_REPORTS_PER_REQUEST = 200;

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function presentedToken(request: Request): string | null {
  const header = request.headers['x-ups-go-token'];
  if (typeof header === 'string' && header) return header;
  const auth = request.headers.authorization;
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  const query = request.query.token;
  return typeof query === 'string' && query ? query : null;
}

/**
 * Webhook server-to-server de Hunter DataForward (eventos y alertas AVL).
 *
 * Seguridad: el documento de Hunter no define autenticación, así que UPS GO exige un secreto
 * compartido (`HUNTER_WEBHOOK_TOKEN`) en el header `X-UPS-GO-Token`, en `Authorization: Bearer` o,
 * si Hunter solo permite configurar una URL, como `?token=` en la URL. Opcionalmente se restringe
 * por IP de origen (`HUNTER_ALLOWED_IPS`). Sin token configurado el endpoint responde 503.
 *
 * No usa JWT de usuarios ni rate limiting por IP (todos los buses llegan desde la misma plataforma).
 */
@ApiExcludeController()
@Public()
@SkipThrottle()
@Controller('integrations/hunter/dataforward')
export class HunterWebhookController {
  private readonly logger = new Logger(HunterWebhookController.name);

  constructor(private readonly tracking: TrackingService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  receiveAny(@Req() request: Request, @Body() body: unknown) {
    return this.receive(request, body);
  }

  @Post('events')
  @HttpCode(HttpStatus.OK)
  receiveEvents(@Req() request: Request, @Body() body: unknown) {
    return this.receive(request, body, 'EVENT');
  }

  @Post('alerts')
  @HttpCode(HttpStatus.OK)
  receiveAlerts(@Req() request: Request, @Body() body: unknown) {
    return this.receive(request, body, 'ALERT');
  }

  private authorize(request: Request): void {
    const { hunterWebhookToken, hunterAllowedIps } = this.tracking.settings;
    if (!hunterWebhookToken) {
      throw new ServiceUnavailableException('Hunter integration is not configured');
    }
    if (hunterAllowedIps.length > 0 && !hunterAllowedIps.includes((request.ip ?? '').toLowerCase())) {
      this.logger.warn(`Rejected Hunter webhook from non-allowed IP ${request.ip}`);
      throw new ForbiddenException('Source IP not allowed');
    }
    const token = presentedToken(request);
    if (!token || !safeEqual(token, hunterWebhookToken)) {
      throw new UnauthorizedException('Invalid integration token');
    }
  }

  private async receive(request: Request, body: unknown, kind?: HunterKind) {
    this.authorize(request);

    let reports: NormalizedTrackingReport[];
    try {
      const items = coerceHunterBody(body);
      if (items.length > MAX_REPORTS_PER_REQUEST) {
        throw new HunterPayloadError(`At most ${MAX_REPORTS_PER_REQUEST} reports per request`);
      }
      reports = items.map((item) => normalizeHunterPayload(item, kind));
    } catch (error) {
      if (error instanceof HunterPayloadError) {
        this.logger.warn(`Rejected Hunter payload: ${error.message}`);
        throw new BadRequestException(error.message);
      }
      throw error;
    }

    const result = await this.tracking.ingest(reports);
    return { received: reports.length, ...result };
  }
}

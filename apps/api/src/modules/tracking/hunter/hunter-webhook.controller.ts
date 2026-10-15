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
import { Throttle } from '@nestjs/throttler';
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
const MAX_REPORTS_PER_REQUEST = 50;

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** API key: header `X-API-Key` (recomendado), `Authorization: Bearer` o `?api_key=` si solo se configura una URL. */
function presentedApiKey(request: Request): string | null {
  const header = request.headers['x-api-key'];
  if (typeof header === 'string' && header) return header;
  const auth = request.headers.authorization;
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  const query = request.query.api_key;
  return typeof query === 'string' && query ? query : null;
}

/**
 * Webhook server-to-server de Hunter DataForward (eventos y alertas AVL).
 *
 * Seguridad:
 * - API key (`HUNTER_WEBHOOK_TOKEN`) en `X-API-Key`, `Authorization: Bearer` o `?api_key=`.
 *   Sin API key configurada el endpoint responde 503.
 * - IP de origen opcional (`HUNTER_ALLOWED_IPS`).
 * - Solo se aceptan los campos documentados por Hunter, con tipos válidos y una fecha razonable
 *   (no futura, no más de 7 días atrás); cualquier otra cosa → 400.
 * - Límite propio de 1200 solicitudes/min (toda la flota llega desde la plataforma de Hunter).
 */
@ApiExcludeController()
@Public()
@Throttle({ default: { limit: 1200, ttl: 60_000 } })
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
    const token = presentedApiKey(request);
    if (!token || !safeEqual(token, hunterWebhookToken)) {
      throw new UnauthorizedException('Invalid API key');
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

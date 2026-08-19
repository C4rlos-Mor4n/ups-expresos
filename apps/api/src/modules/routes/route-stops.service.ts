import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { RouteStop } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { OrderRouteStopsDto, RouteStopOrderItemDto } from './dto/order-route-stops.dto';

@Injectable()
export class RouteStopsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async orderStops(routeId: string, dto: OrderRouteStopsDto, actorId: string): Promise<RouteStop[]> {
    const route = await this.prisma.route.findUnique({ where: { id: routeId } });
    if (!route) throw new NotFoundException(`Route with id ${routeId} not found`);

    if (dto.stops.length === 0) {
      throw new BadRequestException('At least one stop is required');
    }

    const stopIds = dto.stops.map((stop) => stop.stopId);
    const uniqueStopIds = new Set(stopIds);
    if (uniqueStopIds.size !== stopIds.length) {
      throw new BadRequestException('Duplicate stop IDs are not allowed');
    }

    const stopOrders = dto.stops.map((stop) => stop.stopOrder);
    const uniqueStopOrders = new Set(stopOrders);
    if (uniqueStopOrders.size !== stopOrders.length) {
      throw new BadRequestException('Duplicate stop orders are not allowed');
    }

    const existingStops = await this.prisma.stop.findMany({
      where: { id: { in: stopIds } },
      select: { id: true },
    });
    const existingStopIds = new Set(existingStops.map((stop) => stop.id));
    const missingStopIds = stopIds.filter((id) => !existingStopIds.has(id));
    if (missingStopIds.length > 0) {
      throw new BadRequestException(`Stop IDs not found: ${missingStopIds.join(', ')}`);
    }

    const routeStops = await this.prisma.$transaction(async (tx) => {
      await tx.routeStop.deleteMany({ where: { routeId } });
      return tx.routeStop.createManyAndReturn({
        data: dto.stops.map((stop) => this.buildRouteStopCreateInput(routeId, stop)),
      });
    });

    await this.auditLogsService.logAction(actorId, 'ORDER_STOPS', 'Route', routeId, {
      stopCount: routeStops.length,
    });

    return routeStops;
  }

  private buildRouteStopCreateInput(routeId: string, stop: RouteStopOrderItemDto): {
    routeId: string;
    stopId: string;
    stopOrder: number;
    estimatedArrivalMinutes: number | null;
    notes: string | null;
  } {
    return {
      routeId,
      stopId: stop.stopId,
      stopOrder: stop.stopOrder,
      estimatedArrivalMinutes: stop.estimatedArrivalMinutes ?? null,
      notes: stop.notes ?? null,
    };
  }
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsISO8601, IsOptional, IsUUID, Max, Min, ValidateIf } from 'class-validator';

export class LivePositionDto {
  @ApiProperty({ example: -2.1528 }) latitude!: number;
  @ApiProperty({ example: -79.8935 }) longitude!: number;
  @ApiProperty({ example: 32.5, description: 'km/h (convertido desde mph de Hunter)' }) speedKph!: number;
  @ApiPropertyOptional({ type: Number, nullable: true, description: '0-359 grados; null = detenido/desconocido' })
  heading!: number | null;
  @ApiProperty({ format: 'date-time', description: 'Hora del reporte GPS (UTC)' }) occurredAt!: Date;
  @ApiProperty({ example: 12, description: 'Antigüedad del reporte en segundos' }) ageSeconds!: number;
  @ApiProperty({ enum: ['LIVE', 'STALE', 'OFFLINE'] }) freshness!: 'LIVE' | 'STALE' | 'OFFLINE';
}

export class LiveTrackingDto {
  @ApiProperty({
    enum: ['AVAILABLE', 'NO_DEVICE', 'NO_SIGNAL', 'NOT_LIVE'],
    description:
      'AVAILABLE: hay posición; NO_DEVICE: el bus no tiene GPS vinculado; NO_SIGNAL: sin reportes recientes; NOT_LIVE: fuera de la ventana del servicio',
  })
  status!: 'AVAILABLE' | 'NO_DEVICE' | 'NO_SIGNAL' | 'NOT_LIVE';
  @ApiPropertyOptional({ type: () => LivePositionDto, nullable: true })
  position!: LivePositionDto | null;
}

export class LiveVehicleDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() plate!: string;
}

export class LiveBusDto {
  @ApiProperty({ format: 'uuid' }) assignmentId!: string;
  @ApiProperty({ type: () => LiveVehicleDto }) vehicle!: LiveVehicleDto;
  @ApiProperty({
    enum: ['IN_PROGRESS', 'BEFORE_START', 'NOT_LIVE'],
    description: 'IN_PROGRESS: recorrido iniciado; BEFORE_START: asignado y a ≤30 min de salir; NOT_LIVE: fuera de ventana',
  })
  phase!: 'IN_PROGRESS' | 'BEFORE_START' | 'NOT_LIVE';
  @ApiProperty({ format: 'date-time' }) plannedStartAt!: Date;
  @ApiProperty({ format: 'date-time' }) plannedEndAt!: Date;
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true }) startedAt!: Date | null;
  @ApiPropertyOptional({ enum: ['DRIVER', 'SYSTEM'], nullable: true }) startSource!: 'DRIVER' | 'SYSTEM' | null;
  @ApiProperty({ type: () => LiveTrackingDto }) tracking!: LiveTrackingDto;
}

export class DepartureLiveDto {
  @ApiProperty({ format: 'uuid' }) departureId!: string;
  @ApiProperty({ format: 'date-time' }) generatedAt!: Date;
  @ApiProperty({ example: 10, description: 'Segundos sugeridos antes de volver a consultar' })
  refreshAfterSeconds!: number;
  @ApiProperty({ type: () => LiveBusDto, isArray: true }) buses!: LiveBusDto[];
}

// ── Administración ────────────────────────────────────────────────────────────

export class TrackingDeviceDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: ['HUNTER'] }) provider!: string;
  @ApiProperty({ example: '4631511939' }) externalId!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) alias!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) label!: string | null;
  @ApiProperty() isActive!: boolean;
  @ApiPropertyOptional({ type: () => LiveVehicleDto, nullable: true }) vehicle!: LiveVehicleDto | null;
  @ApiPropertyOptional({ type: () => LivePositionDto, nullable: true }) position!: LivePositionDto | null;
  @ApiPropertyOptional({ type: Boolean, nullable: true }) ignition!: boolean | null;
  @ApiPropertyOptional({ type: String, nullable: true }) address!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
}

export class BindTrackingDeviceDto {
  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'null para desvincular' })
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  vehicleId!: string | null;
}

export class UpdateTrackingDeviceDto {
  @ApiProperty() @IsBoolean() isActive!: boolean;
}

export class FleetVehicleDto {
  @ApiProperty({ type: () => LiveVehicleDto }) vehicle!: LiveVehicleDto;
  @ApiProperty({ format: 'uuid' }) deviceId!: string;
  @ApiPropertyOptional({ type: () => LivePositionDto, nullable: true }) position!: LivePositionDto | null;
  @ApiPropertyOptional({ type: Boolean, nullable: true }) ignition!: boolean | null;
  @ApiPropertyOptional({
    nullable: true,
    description: 'Recorrido en curso del vehículo (si lo hay)',
    type: 'object',
    properties: {
      assignmentId: { type: 'string', format: 'uuid' },
      runId: { type: 'string', format: 'uuid' },
      serviceLineName: { type: 'string' },
      scheduledTime: { type: 'string' },
      direction: { type: 'string' },
      driverName: { type: 'string' },
      startSource: { type: 'string' },
    },
  })
  currentRun!: Record<string, unknown> | null;
}

export class TrackingAlertDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: ['EVENT', 'ALERT'] }) kind!: string;
  @ApiProperty({ format: 'date-time' }) occurredAt!: Date;
  @ApiPropertyOptional({ type: String, nullable: true }) description!: string | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) occurrenceCode!: number | null;
  @ApiProperty() latitude!: number;
  @ApiProperty() longitude!: number;
  @ApiProperty() speedKph!: number;
  @ApiPropertyOptional({ type: () => LiveVehicleDto, nullable: true }) vehicle!: LiveVehicleDto | null;
  @ApiPropertyOptional({ type: String, nullable: true }) deviceAlias!: string | null;
}

export class TrackingAlertsQueryDto {
  @ApiPropertyOptional({ default: 24, minimum: 1, maximum: 168 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(168)
  hours?: number;
}

export class TrailPointDto {
  @ApiProperty({ format: 'date-time' }) occurredAt!: Date;
  @ApiProperty() latitude!: number;
  @ApiProperty() longitude!: number;
  @ApiProperty() speedKph!: number;
  @ApiPropertyOptional({ type: Number, nullable: true }) heading!: number | null;
}

export class TrailQueryDto {
  @ApiProperty({ format: 'date-time' }) @IsISO8601() from!: string;
  @ApiProperty({ format: 'date-time' }) @IsISO8601() to!: string;
}

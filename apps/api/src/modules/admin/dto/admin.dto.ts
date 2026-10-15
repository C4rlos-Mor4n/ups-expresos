import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { UserRole } from '@prisma/client';

export class PageQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 25, minimum: 1, maximum: 100 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit?: number = 25;
}

export class AdminUsersQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: UserRole }) @IsOptional() @IsEnum(UserRole) role?: UserRole;
  @ApiPropertyOptional({ description: 'Busca en correo o nombre' })
  @IsOptional() @IsString() @MaxLength(80)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  search?: string;
}

export class AdminUserDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() email!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) name!: string | null;
  @ApiProperty({ enum: UserRole }) role!: UserRole;
  @ApiProperty() isActive!: boolean;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true }) lastLoginAt!: Date | null;
}

export class AdminUsersPageDto {
  @ApiProperty({ type: () => AdminUserDto, isArray: true }) items!: AdminUserDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
}

export class UpdateAdminUserDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional({
    enum: [UserRole.STUDENT, UserRole.ADMIN, UserRole.SUPER_ADMIN],
    description: 'DRIVER se asigna vinculando la cuenta a un conductor (/admin/drivers/:id/account)',
  })
  @IsOptional() @IsEnum(UserRole)
  role?: UserRole;
}

export class AuditLogsQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ example: 'ServiceAssignment' })
  @IsOptional() @IsString() @MaxLength(60)
  entity?: string;
}

export class AuditLogDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() action!: string;
  @ApiProperty() entity!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) entityId!: string | null;
  @ApiPropertyOptional({ type: Object, nullable: true }) metadata!: unknown;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
  @ApiPropertyOptional({ type: String, nullable: true, description: 'Correo del actor; null = sistema' })
  actorEmail!: string | null;
}

export class AuditLogsPageDto {
  @ApiProperty({ type: () => AuditLogDto, isArray: true }) items!: AuditLogDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
}

export class DashboardQueryDto {
  @ApiPropertyOptional({ format: 'date', description: 'Fecha civil de Guayaquil (por defecto hoy)' })
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;
}

export class DashboardDto {
  @ApiProperty({ format: 'date' }) date!: string;
  @ApiProperty() departures!: number;
  @ApiProperty({ description: 'Salidas sin ningún bus asignado' }) departuresWithoutBus!: number;
  @ApiProperty() assignments!: number;
  @ApiProperty() runsInProgress!: number;
  @ApiProperty() runsCompleted!: number;
  @ApiProperty() activeVehicles!: number;
  @ApiProperty() activeDrivers!: number;
  @ApiProperty({ description: 'Buses con GPS reportando en vivo' }) vehiclesLive!: number;
  @ApiProperty({ description: 'Equipos GPS reportando sin bus vinculado' }) unboundDevices!: number;
  @ApiProperty({ description: 'Alertas en las últimas 24 h' }) alerts24h!: number;
  @ApiProperty() users!: number;
}

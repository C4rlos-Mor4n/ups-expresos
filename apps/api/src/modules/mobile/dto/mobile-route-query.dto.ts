import { PaginationDto } from '../../../common/dto/pagination.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { RouteStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class MobileRouteQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by route status', enum: RouteStatus, example: RouteStatus.ACTIVE })
  @IsEnum(RouteStatus)
  @IsOptional()
  status?: RouteStatus;

  @ApiPropertyOptional({ description: 'Search by route name or direction', example: 'Norte' })
  @IsString()
  @IsOptional()
  search?: string;
}

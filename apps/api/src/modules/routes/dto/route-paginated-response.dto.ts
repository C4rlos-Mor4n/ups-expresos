import { ApiProperty } from '@nestjs/swagger';
import { PaginationMeta } from '../../../common/types/pagination.type';
import { RouteResponseDto } from './route-response.dto';

export class RoutePaginatedResponseDto {
  @ApiProperty({ type: [RouteResponseDto] })
  data!: RouteResponseDto[];

  @ApiProperty()
  meta!: PaginationMeta;
}

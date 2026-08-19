import { ApiProperty } from '@nestjs/swagger';
import { PaginationMeta } from '../../../common/types/pagination.type';
import { DriverResponseDto } from './driver-response.dto';

export class DriverPaginatedResponseDto {
  @ApiProperty({ type: [DriverResponseDto] })
  data!: DriverResponseDto[];

  @ApiProperty()
  meta!: PaginationMeta;
}

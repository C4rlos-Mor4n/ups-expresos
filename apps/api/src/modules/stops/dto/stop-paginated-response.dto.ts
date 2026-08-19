import { ApiProperty } from '@nestjs/swagger';
import { PaginationMeta } from '../../../common/types/pagination.type';
import { StopResponseDto } from './stop-response.dto';

export class StopPaginatedResponseDto {
  @ApiProperty({ type: [StopResponseDto] })
  data!: StopResponseDto[];

  @ApiProperty()
  meta!: PaginationMeta;
}

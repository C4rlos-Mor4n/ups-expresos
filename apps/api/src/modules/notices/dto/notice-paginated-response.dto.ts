import { ApiProperty } from '@nestjs/swagger';
import { PaginationMeta } from '../../../common/types/pagination.type';
import { NoticeResponseDto } from './notice-response.dto';

export class NoticePaginatedResponseDto {
  @ApiProperty({ type: [NoticeResponseDto] })
  data!: NoticeResponseDto[];

  @ApiProperty()
  meta!: PaginationMeta;
}

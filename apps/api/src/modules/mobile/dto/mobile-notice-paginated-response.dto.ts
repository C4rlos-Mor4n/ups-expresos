import { ApiProperty } from '@nestjs/swagger';
import { PaginationMeta } from '../../../common/types/pagination.type';
import { MobileNoticeResponseDto } from './mobile-notice-response.dto';

export class MobileNoticePaginatedResponseDto {
  @ApiProperty({ type: [MobileNoticeResponseDto] })
  data!: MobileNoticeResponseDto[];

  @ApiProperty()
  meta!: PaginationMeta;
}

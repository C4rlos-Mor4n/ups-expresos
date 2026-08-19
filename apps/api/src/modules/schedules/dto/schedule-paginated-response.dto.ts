import { ApiProperty } from '@nestjs/swagger';
import { PaginationMeta } from '../../../common/types/pagination.type';
import { ScheduleResponseDto } from './schedule-response.dto';

export class SchedulePaginatedResponseDto {
  @ApiProperty({ type: [ScheduleResponseDto] })
  data!: ScheduleResponseDto[];

  @ApiProperty()
  meta!: PaginationMeta;
}

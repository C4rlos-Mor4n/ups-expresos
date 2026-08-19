import { ApiProperty } from '@nestjs/swagger';
import { TripFeedbackResponseDto } from './trip-feedback-response.dto';
import { PaginationMeta } from '../../../common/types/pagination.type';

export class TripFeedbackPaginatedResponseDto {
  @ApiProperty({ type: [TripFeedbackResponseDto] })
  data!: TripFeedbackResponseDto[];

  @ApiProperty()
  meta!: PaginationMeta;
}

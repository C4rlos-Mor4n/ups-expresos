import { ApiProperty } from '@nestjs/swagger';
import { PaginationMeta } from '../../../common/types/pagination.type';
import { VehicleResponseDto } from './vehicle-response.dto';

export class VehiclePaginatedResponseDto {
  @ApiProperty({ type: [VehicleResponseDto] })
  data!: VehicleResponseDto[];

  @ApiProperty()
  meta!: PaginationMeta;
}

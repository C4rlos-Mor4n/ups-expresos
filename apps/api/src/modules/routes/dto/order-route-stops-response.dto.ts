import { ApiProperty } from '@nestjs/swagger';

export class OrderRouteStopsResponseDto {
  @ApiProperty({ example: 'Stops ordered successfully' })
  message!: string;
}

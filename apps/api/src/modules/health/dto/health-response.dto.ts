import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({ example: 'ok' })
  status!: string;

  @ApiProperty({ example: 'UPS GO API' })
  service!: string;

  @ApiProperty({ example: '2026-07-09T02:16:44.580Z' })
  timestamp!: string;
}

export class HealthDbResponseDto {
  @ApiProperty({ example: 'ok' })
  status!: string;

  @ApiProperty({ example: 'connected' })
  database!: string;
}

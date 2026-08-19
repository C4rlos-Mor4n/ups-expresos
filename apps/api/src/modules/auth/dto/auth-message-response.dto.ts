import { ApiProperty } from '@nestjs/swagger';

export class RequestCodeResponseDto {
  @ApiProperty({ example: 'Verification code sent' })
  message!: string;

  @ApiProperty({ required: false, example: '123456', description: 'Only exposed in development when configured.' })
  devCode?: string;
}

export class LogoutResponseDto {
  @ApiProperty({ example: 'Logged out' })
  message!: string;
}

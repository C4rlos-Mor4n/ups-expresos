import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length } from 'class-validator';

export class VerifyCodeDto {
  @ApiProperty({
    description: 'Institutional email address',
    example: 'student@est.ups.edu.ec',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    description: 'OTP verification code received via email',
    example: '123456',
  })
  @IsString()
  @Length(6, 6)
  code!: string;
}

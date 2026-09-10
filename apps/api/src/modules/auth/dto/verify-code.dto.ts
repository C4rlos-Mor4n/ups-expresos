import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length } from 'class-validator';

export class VerifyCodeDto {
  @ApiProperty({
    description: 'Institutional or registered email address',
    example: 'student@est.ups.edu.ec',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  email!: string;

  @ApiProperty({
    description: 'OTP verification code received via email',
    example: '123456',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(6, 6)
  code!: string;
}

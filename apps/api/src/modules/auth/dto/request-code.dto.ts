import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail } from 'class-validator';

export class RequestCodeDto {
  @ApiProperty({
    description: 'Institutional or registered email address used to request OTP verification',
    example: 'student@est.ups.edu.ec',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  email!: string;
}

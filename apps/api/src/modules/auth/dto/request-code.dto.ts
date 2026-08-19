import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class RequestCodeDto {
  @ApiProperty({
    description: 'Institutional email address used to request OTP verification',
    example: 'student@est.ups.edu.ec',
  })
  @IsEmail()
  email!: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AuthUserDto {
  @ApiProperty({ format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ example: 'student@est.ups.edu.ec' })
  email!: string;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'User full name', example: 'John Doe' })
  name?: string | null;

  @ApiProperty({ enum: ['STUDENT', 'ADMIN', 'SUPER_ADMIN', 'DRIVER'], example: 'STUDENT' })
  role!: string;

  @ApiProperty({ example: true })
  emailVerified!: boolean;

  @ApiProperty({ example: true })
  isActive!: boolean;
}

export class AuthTokensDto {
  @ApiProperty({ description: 'JWT access token' })
  accessToken!: string;

  @ApiProperty({ description: 'Refresh token for obtaining new access tokens' })
  refreshToken!: string;

  @ApiProperty({ type: AuthUserDto })
  user!: AuthUserDto;
}

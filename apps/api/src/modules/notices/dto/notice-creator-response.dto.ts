import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NoticeCreatorResponseDto {
  @ApiProperty({ format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ example: 'admin@ups.edu.ec' })
  email!: string;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'Creator full name', example: 'Admin User' })
  name?: string | null;
}

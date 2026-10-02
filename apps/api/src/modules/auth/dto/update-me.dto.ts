import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

export class UpdateMeDto {
  @ApiProperty({
    description: 'Nombre visible del usuario (se muestra en el saludo y el perfil)',
    example: 'Carlos Morán',
    minLength: 2,
    maxLength: 60,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value))
  @IsString()
  @Length(2, 60)
  name!: string;
}

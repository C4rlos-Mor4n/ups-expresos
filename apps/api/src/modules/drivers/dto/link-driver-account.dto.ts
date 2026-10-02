import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail } from 'class-validator';

export class LinkDriverAccountDto {
  @ApiProperty({
    description:
      'Correo con el que el conductor iniciará sesión en la app (cualquier dominio). Si no existe, se crea la cuenta con rol DRIVER.',
    example: 'conductor@gmail.com',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  email!: string;
}

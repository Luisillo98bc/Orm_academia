// ============================================================================
// LoginDto — Data Transfer Object de entrada para el Login
// ============================================================================

import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO de validación para la solicitud de login.
 * Utiliza class-validator para validar los datos de entrada
 * en la capa de presentación (Controllers / Pipes).
 */
export class LoginDto {
  @ApiProperty({
    example: 'admin@academia.edu',
    description: 'Correo electrónico registrado en la plataforma',
  })
  @IsEmail({}, { message: 'El email debe tener un formato válido' })
  @IsNotEmpty({ message: 'El email es requerido' })
  readonly email: string;

  @ApiProperty({
    example: 'Admin@1234',
    description: 'Contraseña del usuario (mínimo 8 caracteres)',
  })
  @IsString({ message: 'La contraseña debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La contraseña es requerida' })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  readonly password: string;
}

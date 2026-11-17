// ============================================================================
// LoginDto — Data Transfer Object de entrada para el Login
// ============================================================================

import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
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
    example: 'TuClaveSegura123!',
    description: 'Contraseña del usuario (mínimo 8 caracteres)',
  })
  @IsString({ message: 'La contraseña debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La contraseña es requerida' })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(72, { message: 'La contraseña no puede superar 72 caracteres' })
  readonly password: string;

  @ApiProperty({
    required: false,
    example: '123456',
    description: 'Código temporal de seis dígitos para administradores con 2FA',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/, { message: 'El código 2FA debe tener 6 dígitos' })
  readonly otpCode?: string;
}

// ============================================================================
// LoginUseCase — Caso de Uso de Autenticación
//
// Capa de Aplicación: orquesta la lógica de negocio sin conocer
// detalles de infraestructura. Depende únicamente de la interfaz
// abstracta IUserRepository (puerto del dominio).
// ============================================================================

import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import type { IUserRepository } from '../../domain/repositories/user.repository.interface';
import { USER_REPOSITORY } from '../../domain/repositories/user.repository.interface';
import { LoginResponseDto } from '../dtos/login-response.dto';

/**
 * Payload que se firmará dentro del JWT.
 */
interface JwtPayload {
  sub: string;
  email: string;
  roles: string[];
  permissions: string[];
}

/**
 * Caso de uso: Login de usuario.
 *
 * Flujo:
 * 1. Busca al usuario por email (respetando soft delete).
 * 2. Valida que la cuenta esté activa y operacional.
 * 3. Compara la contraseña contra el hash almacenado.
 * 4. Genera un JWT con los claims de roles y permisos.
 * 5. Registra la fecha del último login.
 * 6. Retorna el token y la información del usuario.
 */
@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Ejecuta el caso de uso de login.
   *
   * @param email - Email del usuario
   * @param password - Contraseña en texto plano
   * @returns LoginResponseDto con el token JWT y los permisos
   * @throws UnauthorizedException si las credenciales son inválidas
   */
  async execute(email: string, password: string): Promise<LoginResponseDto> {
    // 1. Buscar usuario por email (soft-delete aware)
    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // 2. Validar que la cuenta esté operacional
    if (!user.isOperational) {
      throw new UnauthorizedException(
        'La cuenta se encuentra deshabilitada. Contacte al administrador.',
      );
    }

    // 3. Comparar contraseña con el hash almacenado
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // 4. Construir payload JWT con roles y permisos
    const roleNames = user.roles.map((r) => r.name);
    const permissions = user.flatPermissions;

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      roles: roleNames,
      permissions,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    // 5. Registrar último login (fire-and-forget, no bloquea la respuesta)
    this.userRepository
      .updateLastLogin(user.id, new Date())
      .catch((err) =>
        console.error(
          `[LoginUseCase] Error actualizando lastLoginAt: ${err.message}`,
        ),
      );

    // 6. Retornar respuesta estructurada
    return new LoginResponseDto({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        roles: roleNames,
      },
      permissions,
    });
  }
}

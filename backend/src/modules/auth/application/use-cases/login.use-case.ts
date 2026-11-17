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
import { TwoFactorService } from '../../infrastructure/two-factor.service';

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
    private readonly twoFactorService: TwoFactorService,
  ) {}

  /**
   * Ejecuta el caso de uso de login.
   *
   * @param email - Email del usuario
   * @param password - Contraseña en texto plano
   * @returns LoginResponseDto con el token JWT y los permisos
   * @throws UnauthorizedException si las credenciales son inválidas
   */
  async execute(
    email: string,
    password: string,
    otpCode?: string,
  ): Promise<LoginResponseDto> {
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

    const isAdmin = user.roles.some((role) => role.name === 'ADMIN');
    if (isAdmin && user.twoFactorEnabled) {
      if (!otpCode) {
        throw new UnauthorizedException({
          message: 'Ingresa el código de tu aplicación autenticadora',
          code: 'TWO_FACTOR_REQUIRED',
        });
      }
      if (
        !user.twoFactorSecret ||
        !this.twoFactorService.verifyStoredCode(user.twoFactorSecret, otpCode)
      ) {
        throw new UnauthorizedException({
          message: 'El código 2FA no es válido o ya expiró',
          code: 'TWO_FACTOR_INVALID',
        });
      }
      void this.twoFactorService
        .upgradeLegacySecret(user.id, user.twoFactorSecret)
        .catch(() => undefined);
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
      .catch((err: unknown) =>
        console.error(
          `[LoginUseCase] Error actualizando lastLoginAt: ${err instanceof Error ? err.message : String(err)}`,
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

import {
  Inject,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import * as crypto from 'crypto';

import type { IUserRepository } from '../../domain/repositories/user.repository.interface';
import { USER_REPOSITORY } from '../../domain/repositories/user.repository.interface';
import { LoginResponseDto } from '../dtos/login-response.dto';

interface GoogleTokenPayload {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  given_name?: string;
  family_name?: string;
  name?: string;
  picture?: string;
}

@Injectable()
export class GoogleLoginUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async execute(credential: string): Promise<LoginResponseDto> {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID')?.trim();
    if (!clientId) {
      throw new InternalServerErrorException(
        'El inicio de sesión con Google aún no está configurado.',
      );
    }

    let payload: GoogleTokenPayload | undefined;
    try {
      const ticket = await new OAuth2Client(clientId).verifyIdToken({
        idToken: credential,
        audience: clientId,
      });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException(
        'No se pudo validar la cuenta de Google.',
      );
    }

    if (!payload?.sub || !payload.email || payload.email_verified !== true) {
      throw new UnauthorizedException(
        'La cuenta de Google no está verificada.',
      );
    }

    const email = payload.email.trim().toLowerCase();
    const initialAdminEmail = (
      this.configService.get<string>('INITIAL_ADMIN_EMAIL') ?? ''
    )
      .trim()
      .toLowerCase();

    let user = await this.userRepository.findByGoogleSubject(payload.sub);
    if (!user) {
      user = await this.userRepository.findByEmail(email);

      if (user?.googleSubject && user.googleSubject !== payload.sub) {
        throw new UnauthorizedException(
          'Esta cuenta ya está vinculada a otra cuenta de Google.',
        );
      }

      if (user) {
        user = await this.userRepository.linkGoogleSubject(
          user.id,
          payload.sub,
          payload.picture,
        );
      } else {
        const fullName = (payload.name ?? email.split('@')[0]).trim();
        const firstName = (payload.given_name ?? fullName.split(' ')[0]).trim();
        const lastName = (
          payload.family_name ?? fullName.split(' ').slice(1).join(' ')
        ).trim();

        user = await this.userRepository.create(
          {
            email,
            googleSubject: payload.sub,
            passwordHash: crypto.randomBytes(32).toString('hex'),
            firstName: firstName || 'Estudiante',
            lastName: lastName || 'Academia',
            profilePicture: payload.picture ?? null,
            emailVerifiedAt: new Date(),
          },
          email === initialAdminEmail ? 'ADMIN' : 'ESTUDIANTE',
        );
      }
    }

    if (!user.isOperational) {
      throw new UnauthorizedException(
        'La cuenta se encuentra deshabilitada. Contacte al administrador.',
      );
    }

    if (
      email === initialAdminEmail &&
      !user.roles.some((role) => role.name === 'ADMIN')
    ) {
      user = await this.userRepository.replaceRoles(user.id, 'ADMIN');
    }

    const roles = user.roles.map((role) => role.name);
    const permissions = user.flatPermissions;
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      roles,
      permissions,
    });

    this.userRepository
      .updateLastLogin(user.id, new Date())
      .catch((error: unknown) =>
        console.error(
          `[GoogleLoginUseCase] Error actualizando lastLoginAt: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );

    return new LoginResponseDto({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        roles,
      },
      permissions,
    });
  }
}

import {
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import type { IUserRepository } from '../../domain/repositories/user.repository.interface';
import { USER_REPOSITORY } from '../../domain/repositories/user.repository.interface';
import { RegisterDto } from '../dtos/register.dto';
import { UserEntity } from '../../domain/entities/user.entity';
import { MailService } from '../../../../shared/infrastructure/mail/mail.service';

@Injectable()
export class RegisterUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly mailService: MailService,
  ) {}

  async execute(dto: RegisterDto): Promise<{ user: Partial<UserEntity> }> {
    // Verificar si el correo ya existe
    const existingUser = await this.userRepository.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('El correo electrónico ya está en uso');
    }

    // Hashear la contraseña
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // Crear el usuario con el rol de ESTUDIANTE por defecto
    try {
      const user = await this.userRepository.create(
        {
          email: dto.email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
        },
        'ESTUDIANTE', // Rol por defecto
      );

      // Enviar email de bienvenida de forma asíncrona (sin bloquear)
      this.mailService
        .sendWelcomeEmail(user.email, user.firstName)
        .catch((e) => console.error('Error enviando email de bienvenida:', e));

      return {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          roles: user.roles,
        },
      };
    } catch (error: unknown) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? error.code
          : undefined;
      if (code === 'P2002') {
        throw new ConflictException(
          'El correo electrónico ya se encuentra registrado en el sistema',
        );
      }
      throw new InternalServerErrorException(
        'Error interno al registrar el usuario',
      );
    }
  }
}

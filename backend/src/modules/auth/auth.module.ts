// ============================================================================
// AuthModule — Módulo de Autenticación y RBAC
//
// Composición del módulo siguiendo Clean Architecture:
// - Domain:         Entidades y puertos (interfaces)
// - Application:    Casos de uso (LoginUseCase)
// - Infrastructure: Implementaciones concretas (PrismaUserRepository, JWT)
// - Presentation:   Controladores HTTP
// ============================================================================

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Domain — Puerto
import { USER_REPOSITORY } from './domain/repositories/user.repository.interface';

// Application — Casos de uso
import { LoginUseCase } from './application/use-cases/login.use-case';
import { RegisterUseCase } from './application/use-cases/register.use-case';
import { ListUsersUseCase } from './application/use-cases/list-users.use-case';
import { AdminCreateUserUseCase } from './application/use-cases/admin-create-user.use-case';

// Infrastructure — Implementaciones
import { PrismaUserRepository } from './infrastructure/repositories/prisma-user.repository';
import { JwtStrategy } from './infrastructure/strategies/jwt.strategy';
import { AuthCookiesService } from './infrastructure/auth-cookies.service';
import { RefreshSessionService } from './infrastructure/refresh-session.service';

// Presentation — Controladores
import { AuthController } from './presentation/controllers/auth.controller';
import { UserController } from './presentation/controllers/user.controller';

// Shared — Servicios compartidos
import { PrismaModule } from '../../shared/infrastructure/prisma/prisma.module';
import { MailService } from '../../shared/infrastructure/mail/mail.service';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get('JWT_EXPIRES_IN', '15m'),
        },
      }),
    }),
  ],
  controllers: [AuthController, UserController],
  providers: [
    // ── Casos de uso ──
    LoginUseCase,
    RegisterUseCase,
    ListUsersUseCase,
    AdminCreateUserUseCase,

    // ── Servicios compartidos ──
    MailService,

    // ── Estrategias Passport ──
    JwtStrategy,
    AuthCookiesService,
    RefreshSessionService,

    // ── Binding: Puerto → Adaptador (Inyección de Dependencias) ──
    // El dominio define IUserRepository (puerto).
    // La infraestructura proporciona PrismaUserRepository (adaptador).
    {
      provide: USER_REPOSITORY,
      useClass: PrismaUserRepository,
    },
  ],
  exports: [JwtModule, PassportModule, AuthCookiesService],
})
export class AuthModule {}

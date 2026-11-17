// ============================================================================
// AuthController — Capa de Presentación
//
// Expone los endpoints HTTP del módulo de autenticación.
// Delega toda la lógica al caso de uso correspondiente.
// ============================================================================

import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  Delete,
  UseGuards,
  Req,
  Res,
  BadRequestException,
  UnauthorizedException,
  Optional,
  Param,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { LoginUseCase } from '../../application/use-cases/login.use-case';
import { GoogleLoginUseCase } from '../../application/use-cases/google-login.use-case';
import { RegisterUseCase } from '../../application/use-cases/register.use-case';
import { LoginDto } from '../../application/dtos/login.dto';
import { RegisterDto } from '../../application/dtos/register.dto';
import { LoginResponseDto } from '../../application/dtos/login-response.dto';
import {
  ForgotPasswordDto,
  ResetPasswordDto,
} from '../../application/dtos/password-recovery.dto';
import { JwtAuthGuard } from '../../infrastructure/guards/jwt-auth.guard';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { MailService } from '../../../../shared/infrastructure/mail/mail.service';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import type { Request, Response } from 'express';
import { AuthCookiesService } from '../../infrastructure/auth-cookies.service';
import { RefreshSessionService } from '../../infrastructure/refresh-session.service';
import { TwoFactorService } from '../../infrastructure/two-factor.service';
import { Roles } from '../../infrastructure/guards/roles.decorator';
import { RolesGuard } from '../../infrastructure/guards/roles.guard';
import { Throttle } from '@nestjs/throttler';
import { AuditService } from '../../../audit/audit.service';
import { AuthRevocationService } from '../../infrastructure/auth-revocation.service';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { IsOptional, IsString } from 'class-validator';

class GoogleLoginBodyDto {
  @IsOptional()
  @IsString()
  credential?: string;

  @IsOptional()
  @IsString()
  otpCode?: string;
}

class TwoFactorCodeDto {
  @IsOptional()
  @IsString()
  code?: string;
}

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    roles: string[];
    permissions: string[];
  };
}

type PublicLoginResponse = Omit<LoginResponseDto, 'accessToken' | 'tokenType'>;
type TwoFactorRequiredResponse = {
  twoFactorRequired: true;
  user: LoginResponseDto['user'];
};

/**
 * Controlador de Autenticación.
 * Maneja los endpoints de inicio de sesión y registro.
 */
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly googleLoginUseCase: GoogleLoginUseCase,
    private readonly registerUseCase: RegisterUseCase,
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly authCookies: AuthCookiesService,
    private readonly refreshSessions: RefreshSessionService,
    private readonly twoFactorService: TwoFactorService,
    private readonly audit: AuditService,
    @Optional() private readonly authRevocations?: AuthRevocationService,
    @Optional() private readonly jwtService?: JwtService,
  ) {}

  /**
   * POST /auth/login
   *
   * Endpoint público para iniciar sesión.
   * Recibe email y password, devuelve el token JWT y datos básicos del usuario.
   */
  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión' })
  @ApiResponse({ status: 200, description: 'Login exitoso, devuelve JWT' })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  async login(
    @Body() loginDto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<Omit<LoginResponseDto, 'accessToken' | 'tokenType'>> {
    let result: LoginResponseDto;
    try {
      result = await this.loginUseCase.execute(
        loginDto.email,
        loginDto.password,
        loginDto.otpCode,
      );
    } catch (error) {
      void this.audit.log(
        { ipAddress: request.ip, userAgent: request.get('user-agent') },
        'LOGIN_FAILED',
        'Auth',
        undefined,
        undefined,
        { email: loginDto.email },
      );
      throw error;
    }
    const refreshToken = await this.refreshSessions.create(
      result.user.id,
      this.sessionMetadata(request),
    );
    const accessToken = await this.refreshSessions.bindAccessToken(
      result.accessToken,
      refreshToken,
    );
    this.authCookies.set(response, accessToken, refreshToken);
    void this.audit.log(
      {
        userId: result.user.id,
        ipAddress: request.ip,
        userAgent: request.get('user-agent'),
      },
      'LOGIN',
      'User',
      result.user.id,
    );

    return { user: result.user, permissions: result.permissions };
  }

  @Post('google')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión con Google' })
  @ApiResponse({ status: 200, description: 'Login de Google exitoso' })
  @ApiResponse({ status: 401, description: 'Credencial de Google inválida' })
  async googleLogin(
    @Body() body: GoogleLoginBodyDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<PublicLoginResponse | TwoFactorRequiredResponse> {
    if (!body.credential) {
      throw new BadRequestException('La credencial de Google es requerida');
    }

    const result = await this.googleLoginUseCase.execute(body.credential);
    const admin = await this.prisma.user.findUnique({
      where: { id: result.user.id },
      select: { twoFactorEnabled: true, twoFactorSecret: true },
    });
    if (admin?.twoFactorEnabled) {
      if (!body.otpCode) {
        return { twoFactorRequired: true, user: result.user };
      }
      if (
        !admin.twoFactorSecret ||
        !this.twoFactorService.verifyStoredCode(
          admin.twoFactorSecret,
          body.otpCode,
        )
      ) {
        throw new UnauthorizedException(
          'El código 2FA no es válido o ya expiró',
        );
      }
      if (admin.twoFactorSecret) {
        await this.twoFactorService.upgradeLegacySecret(
          result.user.id,
          admin.twoFactorSecret,
        );
      }
    }
    const refreshToken = await this.refreshSessions.create(
      result.user.id,
      this.sessionMetadata(request),
    );
    const accessToken = await this.refreshSessions.bindAccessToken(
      result.accessToken,
      refreshToken,
    );
    this.authCookies.set(response, accessToken, refreshToken);

    return { user: result.user, permissions: result.permissions };
  }

  @Post('2fa/setup')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Generar una clave 2FA para el administrador actual',
  })
  async setupTwoFactor(@Req() request: AuthenticatedRequest) {
    return this.twoFactorService.setup(request.user.id, request.user.email);
  }

  @Get('2fa/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Consultar el estado de 2FA del administrador actual',
  })
  async twoFactorStatus(@Req() request: AuthenticatedRequest) {
    return this.twoFactorService.status(request.user.id);
  }

  @Post('2fa/enable')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Activar 2FA verificando el código de la aplicación',
  })
  async enableTwoFactor(
    @Req() request: AuthenticatedRequest,
    @Body() body: TwoFactorCodeDto,
  ) {
    return this.twoFactorService.enable(request.user.id, body.code || '');
  }

  @Post('2fa/disable')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Desactivar 2FA verificando el código actual' })
  async disableTwoFactor(
    @Req() request: AuthenticatedRequest,
    @Body() body: TwoFactorCodeDto,
  ) {
    return this.twoFactorService.disable(request.user.id, body.code || '');
  }

  @Get('session')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Consultar si existe una sesión potencialmente activa sin generar error 401',
  })
  sessionStatus(@Req() request: Request): { authenticated: boolean } {
    const hasAccess = Boolean(this.authCookies.getAccessToken?.(request));
    const hasRefresh = Boolean(this.authCookies.getRefreshToken?.(request));
    return { authenticated: hasAccess || hasRefresh };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renovar la sesión' })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const currentToken = this.authCookies.getRefreshToken(request);
    if (!currentToken) {
      this.authCookies.clear(response);
      throw new UnauthorizedException('No existe una sesión renovable');
    }

    try {
      const tokens = await this.refreshSessions.rotate(
        currentToken,
        this.sessionMetadata(request),
      );
      this.authCookies.set(response, tokens.accessToken, tokens.refreshToken);
      return { message: 'Sesión renovada' };
    } catch (error) {
      this.authCookies.clear(response);
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cerrar sesión' })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const refreshToken = this.authCookies.getRefreshToken(request);
    let revokedUserId: string | null = null;
    if (refreshToken) {
      revokedUserId = await this.refreshSessions.revoke(refreshToken);
    }
    if (!revokedUserId && this.jwtService) {
      const accessToken = this.authCookies.getAccessToken?.(request);
      if (accessToken) {
        let claims: { sub?: string; sid?: string } | null = null;
        try {
          claims = await this.jwtService.verifyAsync<{
            sub?: string;
            sid?: string;
          }>(accessToken);
        } catch {
          claims = null;
        }
        if (claims)
          revokedUserId =
            await this.refreshSessions.revokeAccessSession(claims);
      }
    }
    if (revokedUserId) this.authRevocations?.revoke(revokedUserId);
    this.authCookies.clear(response);
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar sesiones activas del usuario' })
  listSessions(@Req() request: AuthenticatedRequest) {
    return this.refreshSessions.list(request.user.id);
  }

  @Delete('sessions/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revocar una sesión específica' })
  async revokeSession(
    @Req() request: AuthenticatedRequest,
    @Param('id') sessionId: string,
  ): Promise<void> {
    await this.refreshSessions.revokeById(request.user.id, sessionId);
  }

  @Delete('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revocar todas las sesiones activas' })
  async revokeAllSessions(@Req() request: AuthenticatedRequest): Promise<void> {
    await this.refreshSessions.revokeAll(request.user.id);
    this.authRevocations?.revoke(request.user.id);
  }

  /**
   * Endpoint público para registro de nuevos usuarios.
   * Por defecto, asigna el rol 'ESTUDIANTE'.
   *
   * @param registerDto Credenciales y datos del usuario
   * @returns Datos básicos del usuario creado
   */
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar nuevo usuario' })
  @ApiResponse({
    status: 201,
    description: 'Usuario registrado exitosamente (rol ESTUDIANTE)',
  })
  @ApiResponse({ status: 409, description: 'El correo ya está en uso' })
  async register(@Body() registerDto: RegisterDto) {
    return this.registerUseCase.execute(registerDto);
  }

  /**
   * GET /auth/profile
   *
   * Endpoint protegido que retorna la información del usuario autenticado.
   * Extrae el payload del JWT a través del Request.
   */
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener perfil (Deprecated, usar /users/me)' })
  @ApiResponse({ status: 200, description: 'Perfil obtenido exitosamente' })
  getProfile(@Req() req: AuthenticatedRequest) {
    return {
      statusCode: HttpStatus.OK,
      data: req.user,
    };
  }

  // ── RECUPERACIÓN DE CONTRASEÑA ──

  /**
   * POST /auth/forgot-password
   * Genera un token de recuperación y envía un email con el enlace.
   */
  @Post('forgot-password')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Solicitar recuperación de contraseña' })
  async forgotPassword(@Body() body: ForgotPasswordDto) {
    const normalizedEmail = body.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // Siempre devolver OK para no revelar si el email existe
    if (!user) {
      return {
        message: 'Si el correo existe, recibirás un enlace de recuperación.',
      };
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: tokenHash,
        resetTokenExpires: expires,
      },
    });

    await this.mailService.sendPasswordResetEmail(
      user.email,
      user.firstName,
      token,
    );

    return {
      message: 'Si el correo existe, recibirás un enlace de recuperación.',
    };
  }

  /**
   * POST /auth/reset-password
   * Valida el token y cambia la contraseña.
   */
  @Post('reset-password')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restablecer contraseña con token' })
  async resetPassword(@Body() body: ResetPasswordDto) {
    const tokenHash = crypto
      .createHash('sha256')
      .update(body.token)
      .digest('hex');

    const user = await this.prisma.user.findFirst({
      where: {
        resetToken: tokenHash,
        resetTokenExpires: { gte: new Date() },
        isActive: true,
        deletedAt: null,
      },
    });

    if (!user) {
      throw new BadRequestException('El token es inválido o ha expirado');
    }

    const hashedPassword = await bcrypt.hash(body.newPassword, 10);

    try {
      await this.prisma.user.update({
        where: {
          id: user.id,
          resetToken: tokenHash,
          resetTokenExpires: { gte: new Date() },
          isActive: true,
          deletedAt: null,
        },
        data: {
          passwordHash: hashedPassword,
          resetToken: null,
          resetTokenExpires: null,
          refreshSessions: {
            updateMany: {
              where: { revokedAt: null },
              data: { revokedAt: new Date() },
            },
          },
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new BadRequestException('El token es inválido o ha expirado');
      }
      throw error;
    }
    this.authRevocations?.revoke(user.id);

    return { message: 'Contraseña actualizada exitosamente' };
  }

  private sessionMetadata(request: Request) {
    return {
      userAgent: request.get('user-agent'),
      ipAddress: request.ip,
    };
  }
}

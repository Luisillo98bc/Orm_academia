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
  UseGuards,
  Req,
  Res,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { LoginUseCase } from '../../application/use-cases/login.use-case';
import { RegisterUseCase } from '../../application/use-cases/register.use-case';
import { LoginDto } from '../../application/dtos/login.dto';
import { RegisterDto } from '../../application/dtos/register.dto';
import { LoginResponseDto } from '../../application/dtos/login-response.dto';
import { JwtAuthGuard } from '../../infrastructure/guards/jwt-auth.guard';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { MailService } from '../../../../shared/infrastructure/mail/mail.service';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import type { Request, Response } from 'express';
import { AuthCookiesService } from '../../infrastructure/auth-cookies.service';
import { RefreshSessionService } from '../../infrastructure/refresh-session.service';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    roles: string[];
    permissions: string[];
  };
}

/**
 * Controlador de Autenticación.
 * Maneja los endpoints de inicio de sesión y registro.
 */
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly registerUseCase: RegisterUseCase,
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly authCookies: AuthCookiesService,
    private readonly refreshSessions: RefreshSessionService,
  ) {}

  /**
   * POST /auth/login
   *
   * Endpoint público para iniciar sesión.
   * Recibe email y password, devuelve el token JWT y datos básicos del usuario.
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión' })
  @ApiResponse({ status: 200, description: 'Login exitoso, devuelve JWT' })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  async login(
    @Body() loginDto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<Omit<LoginResponseDto, 'accessToken' | 'tokenType'>> {
    const result = await this.loginUseCase.execute(
      loginDto.email,
      loginDto.password,
    );
    const refreshToken = await this.refreshSessions.create(
      result.user.id,
      this.sessionMetadata(request),
    );
    this.authCookies.set(response, result.accessToken, refreshToken);

    return { user: result.user, permissions: result.permissions };
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
    if (refreshToken) await this.refreshSessions.revoke(refreshToken);
    this.authCookies.clear(response);
  }

  /**
   * Endpoint público para registro de nuevos usuarios.
   * Por defecto, asigna el rol 'ESTUDIANTE'.
   *
   * @param registerDto Credenciales y datos del usuario
   * @returns Datos básicos del usuario creado
   */
  @Post('register')
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
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Solicitar recuperación de contraseña' })
  async forgotPassword(@Body() body: { email: string }) {
    const user = await this.prisma.user.findUnique({
      where: { email: body.email },
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
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restablecer contraseña con token' })
  async resetPassword(@Body() body: { token: string; newPassword: string }) {
    if (!body.token || !body.newPassword) {
      throw new BadRequestException('Token y nueva contraseña son requeridos');
    }

    const tokenHash = crypto
      .createHash('sha256')
      .update(body.token)
      .digest('hex');

    const user = await this.prisma.user.findFirst({
      where: {
        resetToken: tokenHash,
        resetTokenExpires: { gte: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException('El token es inválido o ha expirado');
    }

    const hashedPassword = await bcrypt.hash(body.newPassword, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hashedPassword,
        resetToken: null,
        resetTokenExpires: null,
      },
    });

    await this.refreshSessions.revokeAll(user.id);

    return { message: 'Contraseña actualizada exitosamente' };
  }

  private sessionMetadata(request: Request) {
    return {
      userAgent: request.get('user-agent'),
      ipAddress: request.ip,
    };
  }
}

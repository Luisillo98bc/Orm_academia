import {
  Controller,
  BadRequestException,
  Get,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
  Query,
  Param,
  Req,
  Res,
  UseGuards,
  HttpException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../modules/auth/infrastructure/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../../modules/auth/infrastructure/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../../../modules/auth/infrastructure/strategies/current-user.decorator';
import type { AuthenticatedUser } from '../../../modules/auth/infrastructure/strategies/authenticated-user.type';
import { StorageService } from './storage.service';
import { Public } from '../../../modules/auth/infrastructure/decorators/public.decorator';

@ApiTags('Storage')
@ApiBearerAuth()
@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  private setPrivateDownloadHeaders(response: Response, reference: string) {
    const leaf = reference.split('/').pop() ?? '';
    const extension = leaf.match(/\.([a-z0-9]{1,5})$/i)?.[1]?.toLowerCase();
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="archivo${extension ? `.${extension}` : ''}"`,
    );
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
  }

  private setPublicAssetHeaders(response: Response) {
    response.setHeader('X-Content-Type-Options', 'nosniff');
  }

  @Get('public')
  @Public()
  @ApiOperation({ summary: 'Obtener una imagen pública de almacenamiento' })
  async publicAsset(
    @Query('ref') reference: string,
    @Res() response: Response,
  ) {
    if (!reference) throw new NotFoundException('Referencia no proporcionada');
    const target =
      await this.storageService.resolvePublicDownloadTarget(reference);
    this.setPublicAssetHeaders(response);
    if (target.kind === 'redirect') return response.redirect(target.url);
    if (target.kind === 'stream') {
      if (target.contentType) response.type(target.contentType);
      if (target.contentLength !== undefined) {
        response.setHeader('Content-Length', target.contentLength);
      }
      response.setHeader('Cache-Control', 'public, max-age=3600');
      return target.body.pipe(response);
    }
    return response.sendFile(target.filePath);
  }

  @Get('download')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Descargar un archivo protegido de la plataforma' })
  async download(
    @Query('ref') reference: string,
    @CurrentUser() user: { id: string; roles?: string[] },
    @Res() response: Response,
  ) {
    if (!reference) {
      throw new NotFoundException('Referencia de archivo no proporcionada');
    }

    try {
      await this.storageService.assertReferenceAccess(reference, user);
      const target = await this.storageService.resolveDownloadTarget(reference);
      this.setPrivateDownloadHeaders(response, reference);
      if (target.kind === 'redirect') {
        return response.redirect(target.url);
      }
      if (target.kind === 'stream') {
        if (target.contentType) response.type(target.contentType);
        if (target.contentLength !== undefined) {
          response.setHeader('Content-Length', target.contentLength);
        }
        return target.body.pipe(response);
      }
      return response.sendFile(target.filePath);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      if (error instanceof Error && error.message === 'Archivo no encontrado') {
        throw new NotFoundException(error.message);
      }
      if (
        error instanceof Error &&
        error.message === 'Referencia de almacenamiento inválida'
      ) {
        throw new BadRequestException(error.message);
      }
      throw new InternalServerErrorException('No se pudo descargar el archivo');
    }
  }
}

/**
 * Compatibilidad para referencias antiguas /uploads/:filename. Las imágenes
 * registradas como curso, cohorte o avatar siguen siendo públicas; cualquier
 * documento legacy debe pasar autorización antes de enviarse.
 */
@ApiTags('Public assets')
@Controller('uploads')
@UseGuards(OptionalJwtAuthGuard)
export class LegacyUploadController {
  constructor(private readonly storageService: StorageService) {}

  @Get(':filename')
  @ApiOperation({ summary: 'Servir un recurso legacy con control de acceso' })
  async downloadLegacy(
    @Param('filename') filename: string,
    @Req() request: Request & { user?: AuthenticatedUser },
    @Res() response: Response,
  ) {
    const reference = `/uploads/${filename}`;
    const isPublic =
      await this.storageService.isPublicLegacyReference(reference);

    if (!isPublic && !request.user) {
      throw new UnauthorizedException('Se requiere iniciar sesión');
    }
    if (!isPublic && request.user) {
      await this.storageService.assertReferenceAccess(reference, request.user);
    }

    try {
      const target = await this.storageService.resolveDownloadTarget(reference);
      if (target.kind !== 'local') {
        throw new NotFoundException('Archivo legacy no disponible');
      }
      if (isPublic) {
        response.setHeader('X-Content-Type-Options', 'nosniff');
      } else {
        const leaf = filename.match(/\.([a-z0-9]{1,5})$/i)?.[1]?.toLowerCase();
        response.setHeader(
          'Content-Disposition',
          `attachment; filename="archivo${leaf ? `.${leaf}` : ''}"`,
        );
        response.setHeader('Cache-Control', 'private, no-store');
        response.setHeader('X-Content-Type-Options', 'nosniff');
      }
      return response.sendFile(target.filePath);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      if (error instanceof Error && error.message === 'Archivo no encontrado') {
        throw new NotFoundException(error.message);
      }
      throw new BadRequestException('Referencia de archivo inválida');
    }
  }
}

import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Delete,
  Patch,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/infrastructure/guards/roles.guard';
import { Roles } from '../../../auth/infrastructure/guards/roles.decorator';
import { SyllabusService } from '../../application/services/syllabus.service';
import { ContentVersionService } from '../../application/services/content-version.service';
import { StorageService } from '../../../../shared/infrastructure/storage/storage.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { materialMulterConfig } from '../../../../shared/infrastructure/multer/multer.config';
import { Public } from '../../../auth/infrastructure/decorators/public.decorator';
import { CurrentUser } from '../../../auth/infrastructure/strategies/current-user.decorator';
import { MaterialType } from '@prisma/client';
import type { AuthenticatedUser } from '../../../auth/infrastructure/strategies/authenticated-user.type';
import {
  CreateClassSessionDto,
  CreateMaterialDto,
  CreateSyllabusModuleDto,
  UpdateClassSessionDto,
  UpdateMaterialDto,
  UpdateSyllabusModuleDto,
} from '../../application/dtos/syllabus-operations.dto';

@ApiTags('Syllabus')
@ApiBearerAuth()
@Controller('academic/cohorts')
export class SyllabusController {
  constructor(
    private readonly syllabusService: SyllabusService,
    private readonly storageService: StorageService,
    private readonly contentVersions: ContentVersionService,
  ) {}

  @Get('content/:entityType/:entityId/versions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'DOCENTE')
  @ApiOperation({ summary: 'Consultar historial de versiones del contenido' })
  async listContentVersions(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.syllabusService.assertContentManagerAccess(
      entityType,
      entityId,
      user,
    );
    return this.contentVersions.list(entityType.toUpperCase(), entityId);
  }

  @Patch('content/:entityType/:entityId/versions/:version/restore')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'DOCENTE')
  @ApiOperation({ summary: 'Restaurar una versión anterior del contenido' })
  async restoreContentVersion(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Param('version') version: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.syllabusService.assertContentManagerAccess(
      entityType,
      entityId,
      user,
    );
    if (!Number.isInteger(Number(version)) || Number(version) < 1)
      throw new BadRequestException('Versión inválida');
    return this.contentVersions.restore(
      entityType,
      entityId,
      Number(version),
      user.id,
    );
  }

  // ─── Rutas Estáticas de Módulos (Deben ir PRIMERO antes de :id/modules) ─────

  @Post('modules/:moduleId/materials/upload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'DOCENTE')
  @ApiOperation({
    summary: 'Subir archivo de material (PDF, Word, PPT, Excel, Zip, Video)',
  })
  @UseInterceptors(FileInterceptor('file', materialMulterConfig))
  async uploadMaterialFile(
    @Param('moduleId') moduleId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('title') title?: string,
    @Body('type') type?: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    if (!file) throw new BadRequestException('Archivo no adjuntado');
    await this.syllabusService.assertModuleManagerAccess(moduleId, user!);
    const fileUrl = await this.storageService.uploadFile(file, 'materials');

    // Detect type from extension if not explicitly provided
    let materialType: MaterialType = Object.values(MaterialType).includes(
      type as MaterialType,
    )
      ? (type as MaterialType)
      : MaterialType.PDF;
    const ext = file.originalname.split('.').pop()?.toLowerCase();
    if (
      ['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'pdf'].includes(ext || '')
    ) {
      materialType = MaterialType.PDF;
    } else if (['mp4', 'mov', 'avi', 'webm'].includes(ext || '')) {
      materialType = MaterialType.VIDEO;
    } else if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext || '')) {
      materialType = MaterialType.REPOSITORY;
    }

    return this.syllabusService.addMaterial(
      moduleId,
      {
        title: title || file.originalname,
        type: materialType,
        fileUrl,
      },
      user!,
    );
  }

  @Post('modules/:moduleId/materials')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'DOCENTE')
  @ApiOperation({ summary: 'Añadir un material a un módulo' })
  async addMaterial(
    @Param('moduleId') moduleId: string,
    @Body() body: CreateMaterialDto,
    @CurrentUser() user: { id: string; roles: string[] },
  ) {
    return this.syllabusService.addMaterial(moduleId, body, user);
  }

  @Post('modules/:moduleId/sessions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'DOCENTE')
  @ApiOperation({ summary: 'Programar una sesión sincrónica' })
  async addSession(
    @Param('moduleId') moduleId: string,
    @Body() body: CreateClassSessionDto,
    @CurrentUser() user: { id: string; roles: string[] },
  ) {
    return this.syllabusService.addSession(
      moduleId,
      {
        ...body,
        date: new Date(body.date),
      },
      user,
    );
  }

  @Patch('modules/:moduleId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'DOCENTE')
  @ApiOperation({ summary: 'Actualizar un módulo/semana' })
  async updateModule(
    @Param('moduleId') moduleId: string,
    @Body() body: UpdateSyllabusModuleDto,
    @CurrentUser() user: { id: string; roles: string[] },
  ) {
    return this.syllabusService.updateModule(moduleId, body, user);
  }

  @Delete('modules/:moduleId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'DOCENTE')
  @ApiOperation({ summary: 'Eliminar un módulo y todo su contenido' })
  async deleteModule(
    @Param('moduleId') moduleId: string,
    @CurrentUser() user: { id: string; roles: string[] },
  ) {
    return this.syllabusService.deleteModule(moduleId, user);
  }

  @Delete('materials/:materialId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'DOCENTE')
  @ApiOperation({ summary: 'Eliminar un material' })
  async deleteMaterial(
    @Param('materialId') materialId: string,
    @CurrentUser() user: { id: string; roles: string[] },
  ) {
    return this.syllabusService.deleteMaterial(materialId, user);
  }

  @Patch('materials/:materialId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'DOCENTE')
  @ApiOperation({ summary: 'Actualizar un material' })
  async updateMaterial(
    @Param('materialId') materialId: string,
    @Body() body: UpdateMaterialDto,
    @CurrentUser() user: { id: string; roles: string[] },
  ) {
    return this.syllabusService.updateMaterial(materialId, body, user);
  }

  @Delete('sessions/:sessionId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'DOCENTE')
  @ApiOperation({ summary: 'Eliminar una sesión' })
  async deleteSession(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: { id: string; roles: string[] },
  ) {
    return this.syllabusService.deleteSession(sessionId, user);
  }

  @Patch('sessions/:sessionId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'DOCENTE')
  @ApiOperation({ summary: 'Actualizar una sesión sincrónica' })
  async updateSession(
    @Param('sessionId') sessionId: string,
    @Body() body: UpdateClassSessionDto,
    @CurrentUser() user: { id: string; roles: string[] },
  ) {
    return this.syllabusService.updateSession(
      sessionId,
      {
        ...body,
        date: body.date ? new Date(body.date) : undefined,
      },
      user,
    );
  }

  // ─── Rutas Parametrizadas de Cohorte (Deben ir al FINAL) ────────────────

  @Post(':id/modules')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'DOCENTE')
  @ApiOperation({ summary: 'Crear un módulo/semana en la cohorte' })
  async createModule(
    @Param('id') cohortId: string,
    @Body() body: CreateSyllabusModuleDto,
    @CurrentUser() user: { id: string; roles: string[] },
  ) {
    return this.syllabusService.createModule(cohortId, body, user);
  }

  @Get('public/:id/modules')
  @Public()
  @ApiOperation({ summary: 'Listar módulos públicos de una cohorte' })
  async getPublicModules(@Param('id') cohortId: string) {
    return this.syllabusService.getPublicModulesByCohort(cohortId);
  }

  @Get(':id/modules')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'DOCENTE', 'ESTUDIANTE', 'RRHH')
  @ApiOperation({ summary: 'Listar módulos/semanas de una cohorte autorizada' })
  async getModules(
    @Param('id') cohortId: string,
    @CurrentUser() user: { id: string; roles: string[] },
  ) {
    await this.syllabusService.assertCohortViewAccess(cohortId, user);
    return this.syllabusService.getModulesByCohort(cohortId);
  }
}

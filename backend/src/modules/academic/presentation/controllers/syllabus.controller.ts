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
import { StorageService } from '../../../../shared/infrastructure/storage/storage.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { multerConfig } from '../../../../shared/infrastructure/multer/multer.config';
import { Public } from '../../../auth/infrastructure/decorators/public.decorator';

@ApiTags('Syllabus')
@ApiBearerAuth()
@Controller('academic/cohorts')
export class SyllabusController {
  constructor(
    private readonly syllabusService: SyllabusService,
    private readonly storageService: StorageService,
  ) {}

  // ─── Rutas Estáticas de Módulos (Deben ir PRIMERO antes de :id/modules) ─────

  @Post('modules/:moduleId/materials/upload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'DOCENTE', 'RRHH')
  @ApiOperation({
    summary: 'Subir archivo de material (PDF, Word, PPT, Excel, Zip, Video)',
  })
  @UseInterceptors(FileInterceptor('file', multerConfig))
  async uploadMaterialFile(
    @Param('moduleId') moduleId: string,
    @UploadedFile() file: any,
    @Body('title') title?: string,
    @Body('type') type?: string,
  ) {
    if (!file) throw new BadRequestException('Archivo no adjuntado');
    const fileUrl = await this.storageService.uploadFile(file, 'materials');

    // Detect type from extension if not explicitly provided
    let materialType = type || 'PDF';
    const ext = file.originalname.split('.').pop()?.toLowerCase();
    if (
      ['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'pdf'].includes(ext || '')
    ) {
      materialType = 'PDF';
    } else if (['mp4', 'mov', 'avi', 'webm'].includes(ext || '')) {
      materialType = 'VIDEO';
    } else if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext || '')) {
      materialType = 'IMAGE';
    }

    return this.syllabusService.addMaterial(moduleId, {
      title: title || file.originalname,
      type: materialType,
      fileUrl,
    });
  }

  @Post('modules/:moduleId/materials')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'DOCENTE', 'RRHH')
  @ApiOperation({ summary: 'Añadir un material a un módulo' })
  async addMaterial(
    @Param('moduleId') moduleId: string,
    @Body() body: { title: string; type: string; fileUrl: string },
  ) {
    return this.syllabusService.addMaterial(moduleId, body);
  }

  @Post('modules/:moduleId/sessions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'DOCENTE', 'RRHH')
  @ApiOperation({ summary: 'Programar una sesión sincrónica' })
  async addSession(
    @Param('moduleId') moduleId: string,
    @Body() body: { title: string; date: string; meetLink?: string },
  ) {
    return this.syllabusService.addSession(moduleId, {
      ...body,
      date: new Date(body.date),
    });
  }

  @Patch('modules/:moduleId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'DOCENTE', 'RRHH')
  @ApiOperation({ summary: 'Actualizar un módulo/semana' })
  async updateModule(
    @Param('moduleId') moduleId: string,
    @Body() body: { title?: string; description?: string; order?: number },
  ) {
    return this.syllabusService.updateModule(moduleId, body);
  }

  @Delete('modules/:moduleId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'DOCENTE', 'RRHH')
  @ApiOperation({ summary: 'Eliminar un módulo y todo su contenido' })
  async deleteModule(@Param('moduleId') moduleId: string) {
    return this.syllabusService.deleteModule(moduleId);
  }

  @Delete('materials/:materialId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'DOCENTE', 'RRHH')
  @ApiOperation({ summary: 'Eliminar un material' })
  async deleteMaterial(@Param('materialId') materialId: string) {
    return this.syllabusService.deleteMaterial(materialId);
  }

  @Delete('sessions/:sessionId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'DOCENTE', 'RRHH')
  @ApiOperation({ summary: 'Eliminar una sesión' })
  async deleteSession(@Param('sessionId') sessionId: string) {
    return this.syllabusService.deleteSession(sessionId);
  }

  // ─── Rutas Parametrizadas de Cohorte (Deben ir al FINAL) ────────────────

  @Post(':id/modules')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'DOCENTE', 'RRHH')
  @ApiOperation({ summary: 'Crear un módulo/semana en la cohorte' })
  async createModule(
    @Param('id') cohortId: string,
    @Body() body: { title: string; description?: string; order: number },
  ) {
    return this.syllabusService.createModule(cohortId, body);
  }

  @Get(':id/modules')
  @Public()
  @ApiOperation({ summary: 'Listar módulos/semanas de la cohorte' })
  async getModules(@Param('id') cohortId: string) {
    return this.syllabusService.getModulesByCohort(cohortId);
  }
}

import {
  ForbiddenException,
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MaterialType } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { ContentVersionService } from './content-version.service';

type SyllabusUser = { id: string; roles?: string[] };

@Injectable()
export class SyllabusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly versions: ContentVersionService,
  ) {}

  async assertCohortViewAccess(cohortId: string, user: SyllabusUser) {
    if (user.roles?.includes('ADMIN') || user.roles?.includes('RRHH')) {
      return;
    }

    const cohort = await this.prisma.cohort.findUnique({
      where: { id: cohortId },
      select: {
        id: true,
        teachers: { select: { id: true } },
        enrollments: {
          where: {
            userId: user.id,
            status: { in: ['ACTIVE', 'COMPLETED'] },
            deletedAt: null,
          },
          select: { id: true },
        },
      },
    });

    if (!cohort) throw new NotFoundException('Cohorte no encontrada');

    const isAssignedTeacher =
      user.roles?.includes('DOCENTE') &&
      cohort.teachers.some((teacher) => teacher.id === user.id);
    const isEnrolledStudent =
      user.roles?.includes('ESTUDIANTE') && cohort.enrollments.length > 0;

    if (!isAssignedTeacher && !isEnrolledStudent) {
      throw new ForbiddenException('No tienes permiso para ver esta cohorte');
    }
  }

  async assertCohortManagerAccess(cohortId: string, user: SyllabusUser) {
    if (user.roles?.includes('ADMIN')) {
      return;
    }

    const cohort = await this.prisma.cohort.findUnique({
      where: { id: cohortId },
      select: { id: true, teachers: { select: { id: true } } },
    });

    if (!cohort) throw new NotFoundException('Cohorte no encontrada');
    if (
      !user.roles?.includes('DOCENTE') ||
      !cohort.teachers.some((teacher) => teacher.id === user.id)
    ) {
      throw new ForbiddenException(
        'No tienes permiso para gestionar esta cohorte',
      );
    }
  }

  async assertModuleManagerAccess(moduleId: string, user: SyllabusUser) {
    const module = await this.prisma.syllabusModule.findUnique({
      where: { id: moduleId },
      select: { cohortId: true },
    });

    if (!module) throw new NotFoundException('Módulo no encontrado');
    await this.assertCohortManagerAccess(module.cohortId, user);
  }

  async assertContentManagerAccess(
    entityType: string,
    entityId: string,
    user: SyllabusUser,
  ) {
    const type = entityType.toUpperCase();
    if (type === 'MODULE')
      return this.assertModuleManagerAccess(entityId, user);
    const entity =
      type === 'MATERIAL'
        ? await this.prisma.material.findUnique({
            where: { id: entityId },
            select: { moduleId: true },
          })
        : type === 'SESSION'
          ? await this.prisma.classSession.findUnique({
              where: { id: entityId },
              select: { moduleId: true },
            })
          : null;
    if (!entity) throw new NotFoundException('Contenido no encontrado');
    return this.assertModuleManagerAccess(entity.moduleId, user);
  }

  private validateSession(data: {
    date?: Date;
    timeZone?: string;
    durationMinutes?: number;
    meetLink?: string;
    recordingUrl?: string;
  }) {
    if (data.date && Number.isNaN(data.date.getTime()))
      throw new BadRequestException('Fecha de clase inválida');
    if (
      data.durationMinutes !== undefined &&
      (!Number.isInteger(data.durationMinutes) ||
        data.durationMinutes < 5 ||
        data.durationMinutes > 720)
    )
      throw new BadRequestException('Duración permitida: 5 a 720 minutos');
    try {
      new Intl.DateTimeFormat('es-PE', {
        timeZone: data.timeZone || 'America/Lima',
      }).format();
    } catch {
      throw new BadRequestException('Zona horaria inválida');
    }
    for (const value of [data.meetLink, data.recordingUrl]) {
      if (value && !/^https?:\/\/[^\s]+$/i.test(value))
        throw new BadRequestException(
          'Los enlaces deben comenzar con https:// o http://',
        );
    }
  }

  async createModule(
    cohortId: string,
    data: { title: string; description?: string; order: number },
    user: SyllabusUser,
  ) {
    await this.assertCohortManagerAccess(cohortId, user);
    return this.prisma.syllabusModule.create({
      data: {
        cohortId,
        title: data.title,
        description: data.description,
        order: data.order,
      },
    });
  }

  async getModulesByCohort(cohortId: string) {
    return this.prisma.syllabusModule.findMany({
      where: { cohortId },
      orderBy: { order: 'asc' },
      include: {
        materials: true,
        sessions: true,
        // Quiz answers and unpublished instructions must never leave the management API.
        evaluations: {
          where: { isPublished: true, deletedAt: null },
          select: {
            id: true,
            title: true,
            description: true,
            weight: true,
            maxScore: true,
            dueDate: true,
            isPublished: true,
            kind: true,
          },
        },
      },
    });
  }

  async getPublicModulesByCohort(cohortId: string) {
    return this.prisma.syllabusModule.findMany({
      where: {
        cohortId,
        cohort: {
          isActive: true,
          deletedAt: null,
          endDate: { gte: new Date() },
          course: { isPublished: true, deletedAt: null },
        },
      },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        title: true,
        description: true,
        order: true,
      },
    });
  }

  async addMaterial(
    moduleId: string,
    data: { title: string; type: MaterialType; fileUrl: string },
    user: SyllabusUser,
  ) {
    await this.assertModuleManagerAccess(moduleId, user);
    return this.prisma.material.create({
      data: {
        moduleId,
        title: data.title,
        type: data.type,
        fileUrl: data.fileUrl,
      },
    });
  }

  async addSession(
    moduleId: string,
    data: {
      title: string;
      date: Date;
      meetLink?: string;
      recordingUrl?: string;
      durationMinutes?: number;
      timeZone?: string;
    },
    user: SyllabusUser,
  ) {
    await this.assertModuleManagerAccess(moduleId, user);
    data.meetLink = data.meetLink?.trim() || undefined;
    data.recordingUrl = data.recordingUrl?.trim() || undefined;
    this.validateSession(data);
    return this.prisma.classSession.create({
      data: {
        moduleId,
        title: data.title,
        date: new Date(data.date),
        meetLink: data.meetLink,
        recordingUrl: data.recordingUrl || null,
        durationMinutes: data.durationMinutes ?? 60,
        timeZone: data.timeZone || 'America/Lima',
      },
    });
  }

  async updateModule(
    moduleId: string,
    data: { title?: string; description?: string; order?: number },
    user: SyllabusUser,
  ) {
    await this.assertModuleManagerAccess(moduleId, user);
    const updated = await this.prisma.syllabusModule.update({
      where: { id: moduleId },
      data: {
        ...(data.title !== undefined ? { title: data.title.trim() } : {}),
        ...(data.description !== undefined
          ? { description: data.description.trim() }
          : {}),
        ...(data.order !== undefined ? { order: data.order } : {}),
      },
    });
    await this.versions.record('MODULE', updated.id, user.id, updated);
    return updated;
  }

  async updateMaterial(
    materialId: string,
    data: { title?: string; type?: MaterialType; fileUrl?: string },
    user: SyllabusUser,
  ) {
    const material = await this.prisma.material.findUnique({
      where: { id: materialId },
      select: { moduleId: true },
    });
    if (!material) throw new NotFoundException('Material no encontrado');
    await this.assertModuleManagerAccess(material.moduleId, user);

    const updated = await this.prisma.material.update({
      where: { id: materialId },
      data: {
        ...(data.title !== undefined ? { title: data.title.trim() } : {}),
        ...(data.type !== undefined ? { type: data.type } : {}),
        ...(data.fileUrl !== undefined ? { fileUrl: data.fileUrl.trim() } : {}),
      },
    });
    await this.versions.record('MATERIAL', updated.id, user.id, updated);
    return updated;
  }

  async updateSession(
    sessionId: string,
    data: {
      title?: string;
      date?: Date;
      meetLink?: string;
      recordingUrl?: string;
      durationMinutes?: number;
      timeZone?: string;
    },
    user: SyllabusUser,
  ) {
    const session = await this.prisma.classSession.findUnique({
      where: { id: sessionId },
      select: { moduleId: true },
    });
    if (!session) throw new NotFoundException('Sesión no encontrada');
    await this.assertModuleManagerAccess(session.moduleId, user);
    data.meetLink =
      data.meetLink?.trim() || (data.meetLink !== undefined ? '' : undefined);
    data.recordingUrl =
      data.recordingUrl?.trim() ||
      (data.recordingUrl !== undefined ? '' : undefined);
    this.validateSession(data);

    const updated = await this.prisma.classSession.update({
      where: { id: sessionId },
      data: {
        ...(data.title !== undefined ? { title: data.title.trim() } : {}),
        ...(data.date !== undefined ? { date: data.date } : {}),
        ...(data.meetLink !== undefined
          ? { meetLink: data.meetLink.trim() || null }
          : {}),
        ...(data.recordingUrl !== undefined
          ? { recordingUrl: data.recordingUrl.trim() || null }
          : {}),
        ...(data.durationMinutes !== undefined
          ? { durationMinutes: data.durationMinutes }
          : {}),
        ...(data.timeZone !== undefined ? { timeZone: data.timeZone } : {}),
      },
    });
    await this.versions.record('SESSION', updated.id, user.id, updated);
    return updated;
  }

  async deleteModule(moduleId: string, user: SyllabusUser) {
    await this.assertModuleManagerAccess(moduleId, user);
    return this.prisma.syllabusModule.delete({
      where: { id: moduleId },
    });
  }

  async deleteMaterial(materialId: string, user: SyllabusUser) {
    const material = await this.prisma.material.findUnique({
      where: { id: materialId },
      select: { moduleId: true },
    });
    if (!material) throw new NotFoundException('Material no encontrado');
    await this.assertModuleManagerAccess(material.moduleId, user);
    return this.prisma.material.delete({
      where: { id: materialId },
    });
  }

  async deleteSession(sessionId: string, user: SyllabusUser) {
    const session = await this.prisma.classSession.findUnique({
      where: { id: sessionId },
      select: { moduleId: true },
    });
    if (!session) throw new NotFoundException('Sesión no encontrada');
    await this.assertModuleManagerAccess(session.moduleId, user);
    return this.prisma.classSession.delete({
      where: { id: sessionId },
    });
  }
}

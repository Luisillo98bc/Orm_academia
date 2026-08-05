import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';

@Injectable()
export class SyllabusService {
  constructor(private readonly prisma: PrismaService) {}

  async createModule(
    cohortId: string,
    data: { title: string; description?: string; order: number },
  ) {
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
        evaluations: true,
      },
    });
  }

  async addMaterial(
    moduleId: string,
    data: { title: string; type: any; fileUrl: string },
  ) {
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
    data: { title: string; date: Date; meetLink?: string },
  ) {
    return this.prisma.classSession.create({
      data: {
        moduleId,
        title: data.title,
        date: new Date(data.date),
        meetLink: data.meetLink,
      },
    });
  }

  async updateModule(
    moduleId: string,
    data: { title?: string; description?: string; order?: number },
  ) {
    return this.prisma.syllabusModule.update({
      where: { id: moduleId },
      data,
    });
  }

  async deleteModule(moduleId: string) {
    return this.prisma.syllabusModule.delete({
      where: { id: moduleId },
    });
  }

  async deleteMaterial(materialId: string) {
    return this.prisma.material.delete({
      where: { id: materialId },
    });
  }

  async deleteSession(sessionId: string) {
    return this.prisma.classSession.delete({
      where: { id: sessionId },
    });
  }
}

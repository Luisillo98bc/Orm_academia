import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';

@Injectable()
export class ContentVersionService {
  constructor(private readonly prisma: PrismaService) {}

  private stringValue(value: unknown, fallback = ''): string {
    return typeof value === 'string' ? value : fallback;
  }

  async record(
    entityType: string,
    entityId: string,
    createdById: string,
    snapshot: unknown,
  ) {
    const latest = await this.prisma.contentVersion.findFirst({
      where: { entityType, entityId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    return this.prisma.contentVersion.create({
      data: {
        entityType,
        entityId,
        createdById,
        version: (latest?.version || 0) + 1,
        snapshot: snapshot as object,
      },
    });
  }

  async list(entityType: string, entityId: string) {
    return this.prisma.contentVersion.findMany({
      where: { entityType, entityId },
      orderBy: { version: 'desc' },
      include: {
        creator: { select: { firstName: true, lastName: true, email: true } },
      },
      take: 50,
    });
  }

  async restore(
    entityType: string,
    entityId: string,
    version: number,
    userId: string,
  ) {
    const record = await this.prisma.contentVersion.findFirst({
      where: { entityType: entityType.toUpperCase(), entityId, version },
    });
    if (!record)
      throw new NotFoundException('Versión de contenido no encontrada');
    const snapshot = record.snapshot as Record<string, unknown>;
    let restored: unknown;
    if (record.entityType === 'MODULE') {
      restored = await this.prisma.syllabusModule.update({
        where: { id: entityId },
        data: {
          title: this.stringValue(snapshot.title),
          description: this.stringValue(snapshot.description) || null,
          order: Number(snapshot.order || 0),
        },
      });
    } else if (record.entityType === 'MATERIAL') {
      restored = await this.prisma.material.update({
        where: { id: entityId },
        data: {
          title: this.stringValue(snapshot.title),
          type: snapshot.type as never,
          fileUrl: this.stringValue(snapshot.fileUrl),
        },
      });
    } else if (record.entityType === 'SESSION') {
      restored = await this.prisma.classSession.update({
        where: { id: entityId },
        data: {
          title: this.stringValue(snapshot.title),
          date: new Date(this.stringValue(snapshot.date)),
          meetLink: this.stringValue(snapshot.meetLink) || null,
        },
      });
    } else {
      throw new BadRequestException('Tipo de contenido no soportado');
    }
    await this.record(record.entityType, entityId, userId, restored);
    return restored;
  }
}

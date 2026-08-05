import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';

@Injectable()
export class PrismaWorkerRepository {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.worker.findMany({
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            isActive: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    return this.prisma.worker.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            isActive: true,
          },
        },
        contracts: { orderBy: { startDate: 'desc' } },
        payrolls: { orderBy: { period: 'desc' } },
      },
    });
  }

  async createWithUser(userData: any, workerData: any, roleId: string) {
    // Execute inside a transaction to ensure both user and worker are created
    return this.prisma.$transaction(async (tx) => {
      // 1. Create user
      const user = await tx.user.create({
        data: {
          ...userData,
          roles: {
            create: {
              roleId: roleId,
            },
          },
        },
      });

      // 2. Create worker profile
      const worker = await tx.worker.create({
        data: {
          ...workerData,
          userId: user.id,
        },
        include: { user: true },
      });

      return worker;
    });
  }

  async createForExistingUser(userId: string, workerData: any) {
    return this.prisma.worker.create({
      data: {
        ...workerData,
        userId,
      },
      include: { user: true },
    });
  }

  async createContract(workerId: string, contractData: any) {
    return this.prisma.contract.create({
      data: {
        ...contractData,
        workerId,
      },
    });
  }
}

import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';

@Injectable()
export class PrismaWorkerRepository {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.worker.findMany({
      where: { deletedAt: null },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            isActive: true,
            deletedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    return this.prisma.worker.findUnique({
      where: { id, deletedAt: null },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            isActive: true,
            deletedAt: true,
          },
        },
        contracts: { orderBy: { startDate: 'desc' } },
        payrolls: { orderBy: { period: 'desc' } },
      },
    });
  }

  async createWithUser(
    userData: Pick<
      Prisma.UserCreateInput,
      'email' | 'firstName' | 'lastName' | 'passwordHash'
    >,
    workerData: Omit<Prisma.WorkerUncheckedCreateInput, 'userId'>,
    roleId: string,
  ) {
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
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              isActive: true,
              deletedAt: true,
            },
          },
        },
      });

      return worker;
    });
  }

  async createForExistingUser(
    userId: string,
    workerData: Omit<Prisma.WorkerUncheckedCreateInput, 'userId'>,
  ) {
    return this.prisma.worker.create({
      data: { ...workerData, userId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            isActive: true,
            deletedAt: true,
          },
        },
      },
    });
  }

  async createContract(
    workerId: string,
    contractData: Omit<Prisma.ContractUncheckedCreateInput, 'workerId'>,
  ) {
    return this.prisma.contract.create({
      data: {
        ...contractData,
        workerId,
      },
    });
  }
}

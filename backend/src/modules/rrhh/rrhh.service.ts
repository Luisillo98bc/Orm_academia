import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaWorkerRepository } from './infrastructure/repositories/prisma-worker.repository';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { moneyToString, toMoney } from '../../shared/utils/money';
import { CreateWorkerDto } from './dtos/create-worker.dto';
import { CreateContractDto } from './dtos/create-contract.dto';

@Injectable()
export class RrhhService {
  constructor(
    private readonly workerRepo: PrismaWorkerRepository,
    private readonly prisma: PrismaService,
  ) {}

  async findAllWorkers() {
    return this.workerRepo.findAll();
  }

  async findWorkerById(id: string) {
    return this.workerRepo.findById(id);
  }

  async getAvailableUsers() {
    return this.prisma.user.findMany({
      where: {
        workerProfile: null,
        roles: {
          some: {
            role: {
              name: { in: ['DOCENTE', 'ADMIN', 'RRHH'] },
            },
          },
        },
        deletedAt: null,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        roles: {
          select: { role: { select: { name: true } } },
        },
      },
    });
  }

  async createWorker(createData: CreateWorkerDto) {
    const {
      userId,
      email,
      firstName,
      lastName,
      password,
      roleName = 'DOCENTE',
      ...workerData
    } = createData;

    // Normalizar fechas y conservar el salario como decimal exacto.
    const finalWorkerData = {
      ...workerData,
      hireDate: new Date(workerData.hireDate),
      baseSalary: toMoney(workerData.baseSalary),
    };

    try {
      if (userId) {
        return await this.workerRepo.createForExistingUser(
          userId,
          finalWorkerData,
        );
      }

      // 1. Verify role exists
      const role = await this.prisma.role.findUnique({
        where: { name: roleName },
      });
      if (!role) {
        throw new BadRequestException(`Role ${roleName} no encontrado`);
      }

      // 2. Hash password
      const passwordHash = await bcrypt.hash(password || 'Academia123!', 10);

      const userData = { email, firstName, lastName, passwordHash };

      return await this.workerRepo.createWithUser(
        userData,
        finalWorkerData,
        role.id,
      );
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new BadRequestException('El DNI ingresado ya está registrado.');
      }
      throw error;
    }
  }

  async createContract(workerId: string, contractData: CreateContractDto) {
    const finalContractData = {
      ...contractData,
      startDate: new Date(contractData.startDate),
      endDate: contractData.endDate ? new Date(contractData.endDate) : null,
      agreedSalary: toMoney(contractData.agreedSalary),
    };
    return this.workerRepo.createContract(workerId, finalContractData);
  }

  async findAllPayrolls() {
    return this.prisma.payroll.findMany({
      include: {
        worker: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
      },
      orderBy: { period: 'desc' },
    });
  }

  async generatePayroll(period: string) {
    // Generate payroll for active workers for a given period (e.g. "2024-11")
    const activeWorkers = await this.prisma.worker.findMany({
      where: { status: 'ACTIVE' },
    });

    const results = [];
    for (const worker of activeWorkers) {
      // Check if payroll already exists
      const existing = await this.prisma.payroll.findUnique({
        where: { workerId_period: { workerId: worker.id, period } },
      });

      if (!existing) {
        const payroll = await this.prisma.payroll.create({
          data: {
            workerId: worker.id,
            period,
            baseSalary: worker.baseSalary,
            totalAmount: worker.baseSalary,
            status: 'PENDING',
          },
        });
        results.push(payroll);
      }
    }
    return results;
  }

  async payPayroll(id: string) {
    return this.prisma.payroll.update({
      where: { id },
      data: {
        status: 'PAID',
        paymentDate: new Date(),
      },
    });
  }

  // ── DASHBOARD STATS ──

  async getDashboardStats() {
    const [
      totalWorkers,
      activeWorkers,
      inactiveWorkers,
      onVacation,
      pendingPayrolls,
      paidPayrolls,
      totalPayrollAmount,
    ] = await Promise.all([
      this.prisma.worker.count({ where: { deletedAt: null } }),
      this.prisma.worker.count({
        where: { status: 'ACTIVE', deletedAt: null },
      }),
      this.prisma.worker.count({
        where: { status: 'INACTIVE', deletedAt: null },
      }),
      this.prisma.worker.count({
        where: { status: 'VACATION', deletedAt: null },
      }),
      this.prisma.payroll.count({ where: { status: 'PENDING' } }),
      this.prisma.payroll.count({ where: { status: 'PAID' } }),
      this.prisma.payroll.aggregate({
        _sum: { totalAmount: true },
        where: { status: 'PAID' },
      }),
    ]);

    // Contratos próximos a vencer (30 días)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const expiringContracts = await this.prisma.contract.findMany({
      where: {
        isActive: true,
        endDate: { lte: thirtyDaysFromNow, gte: new Date() },
      },
      include: {
        worker: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
      },
    });

    // Distribución por departamento
    const workers = await this.prisma.worker.findMany({
      where: { deletedAt: null },
      select: { department: true },
    });
    const deptMap = new Map<string, number>();
    workers.forEach((w) => {
      deptMap.set(w.department, (deptMap.get(w.department) || 0) + 1);
    });
    const departments = Array.from(deptMap.entries()).map(([name, count]) => ({
      name,
      count,
    }));

    return {
      totalWorkers,
      activeWorkers,
      inactiveWorkers,
      onVacation,
      pendingPayrolls,
      paidPayrolls,
      totalPayrollPaid: moneyToString(totalPayrollAmount._sum.totalAmount ?? 0),
      expiringContracts: expiringContracts.map((c) => ({
        id: c.id,
        workerId: c.workerId,
        workerName: `${c.worker.user.firstName} ${c.worker.user.lastName}`,
        type: c.type,
        endDate: c.endDate,
      })),
      departments,
    };
  }

  // ── EXPORTACIÓN CSV ──

  async exportPayrollCsv(): Promise<string> {
    const payrolls = await this.prisma.payroll.findMany({
      include: {
        worker: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true } },
          },
        },
      },
      orderBy: [{ period: 'desc' }, { worker: { user: { lastName: 'asc' } } }],
    });

    const header =
      'Período,Nombre,Apellido,Email,Salario Base,Bonos,Deducciones,Total,Estado,Fecha Pago';
    const rows = payrolls.map((p) => {
      return [
        p.period,
        `"${p.worker.user.firstName}"`,
        `"${p.worker.user.lastName}"`,
        `"${p.worker.user.email}"`,
        p.baseSalary.toFixed(2),
        p.bonuses.toFixed(2),
        p.deductions.toFixed(2),
        p.totalAmount.toFixed(2),
        p.status,
        p.paymentDate
          ? new Date(p.paymentDate).toISOString().split('T')[0]
          : 'Pendiente',
      ].join(',');
    });

    return [header, ...rows].join('\n');
  }

  async getDailyAttendance(dateString: string) {
    const targetDate = new Date(dateString);
    targetDate.setUTCHours(0, 0, 0, 0);
    const nextDate = new Date(targetDate);
    nextDate.setDate(targetDate.getDate() + 1);

    const activeWorkers = await this.prisma.worker.findMany({
      where: { deletedAt: null },
      include: { user: { select: { firstName: true, lastName: true } } },
    });

    const records = await this.prisma.workAttendance.findMany({
      where: {
        date: {
          gte: targetDate,
          lt: nextDate,
        },
      },
    });

    return activeWorkers.map((worker) => {
      const record = records.find((r) => r.workerId === worker.id);
      return {
        worker: {
          id: worker.id,
          name: `${worker.user.firstName} ${worker.user.lastName}`,
          department: worker.department,
          position: worker.position,
        },
        attendance: record || null,
      };
    });
  }

  async markAttendance(data: {
    workerId: string;
    date: string;
    status: string;
    observation?: string;
  }) {
    const targetDate = new Date(data.date);
    targetDate.setUTCHours(0, 0, 0, 0);

    return this.prisma.workAttendance.upsert({
      where: {
        workerId_date: {
          workerId: data.workerId,
          date: targetDate,
        },
      },
      update: {
        status: data.status as any,
        observation: data.observation,
      },
      create: {
        workerId: data.workerId,
        date: targetDate,
        status: data.status as any,
        observation: data.observation,
        checkInTime:
          data.status === 'PRESENT' || data.status === 'LATE'
            ? new Date()
            : null,
      },
    });
  }
}

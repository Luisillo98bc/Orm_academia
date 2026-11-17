import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Optional,
  Logger,
} from '@nestjs/common';
import { PrismaWorkerRepository } from './infrastructure/repositories/prisma-worker.repository';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { moneyToString, toMoney } from '../../shared/utils/money';
import { CreateWorkerDto } from './dtos/create-worker.dto';
import { CreateContractDto } from './dtos/create-contract.dto';
import { WorkersQueryDto } from './dtos/workers-query.dto';
import { NotificationsService } from '../communication/notifications.service';
import { AuditService } from '../audit/audit.service';
import PDFDocument from 'pdfkit';
import * as crypto from 'crypto';
import { MailService } from '../../shared/infrastructure/mail/mail.service';
import {
  AttendanceStatus,
  ContractStatus,
  ContractType,
  Prisma,
  WorkerStatus,
} from '@prisma/client';
import {
  normalizePagination,
  paginatedResult,
} from '../../shared/pagination/pagination';

function isPrismaError(
  error: unknown,
): error is { code?: unknown; meta?: { target?: unknown } } {
  return typeof error === 'object' && error !== null;
}

@Injectable()
export class RrhhService {
  private readonly logger = new Logger(RrhhService.name);
  private readonly workerRoles = ['DOCENTE', 'ADMIN', 'RRHH'] as const;
  private readonly workerStatuses = Object.values(WorkerStatus);
  private readonly contractTypes = Object.values(ContractType);
  private readonly attendanceStatuses = Object.values(AttendanceStatus);

  constructor(
    private readonly workerRepo: PrismaWorkerRepository,
    private readonly prisma: PrismaService,
    @Optional() private readonly notificationsService?: NotificationsService,
    @Optional() private readonly auditService?: AuditService,
    @Optional() private readonly mailService?: MailService,
  ) {}

  async findAllWorkers(query: WorkersQueryDto = new WorkersQueryDto()) {
    const pagination = normalizePagination(query.page, query.limit);
    const term = query.search?.trim();
    const where: Prisma.WorkerWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status as WorkerStatus } : {}),
      ...(query.department
        ? {
            department: {
              equals: query.department.trim(),
              mode: 'insensitive',
            },
          }
        : {}),
      ...(term
        ? {
            OR: [
              { dni: { contains: term, mode: 'insensitive' } },
              { position: { contains: term, mode: 'insensitive' } },
              { department: { contains: term, mode: 'insensitive' } },
              {
                user: {
                  OR: [
                    { firstName: { contains: term, mode: 'insensitive' } },
                    { lastName: { contains: term, mode: 'insensitive' } },
                    { email: { contains: term, mode: 'insensitive' } },
                  ],
                },
              },
            ],
          }
        : {}),
    };
    const [workers, total] = await Promise.all([
      this.prisma.worker.findMany({
        where,
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
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.worker.count({ where }),
    ]);
    return paginatedResult(workers, pagination.page, pagination.limit, total);
  }

  async findWorkerById(id: string) {
    const worker = await this.workerRepo.findById(id);
    if (!worker) {
      throw new NotFoundException('Trabajador no encontrado');
    }
    return worker;
  }

  async getAvailableUsers() {
    return this.prisma.user.findMany({
      where: {
        workerProfile: null,
        isActive: true,
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

    try {
      const dni = this.requiredText(workerData.dni, 'DNI');
      const position = this.requiredText(workerData.position, 'Cargo');
      const department = this.requiredText(
        workerData.department,
        'Departamento',
      );
      const finalWorkerData = {
        ...workerData,
        dni,
        position,
        department,
        hireDate: this.parseDate(workerData.hireDate, 'hireDate'),
        baseSalary: this.parseMoney(workerData.baseSalary, 'baseSalary'),
        status: workerData.status
          ? (workerData.status as WorkerStatus)
          : WorkerStatus.ACTIVE,
      };

      if (
        workerData.status &&
        !this.workerStatuses.includes(workerData.status as WorkerStatus)
      ) {
        throw new BadRequestException('Estado de trabajador no válido');
      }

      if (userId) {
        const existingUser = await this.prisma.user.findFirst({
          where: {
            id: userId,
            isActive: true,
            deletedAt: null,
            workerProfile: null,
            roles: {
              some: { role: { name: { in: [...this.workerRoles] } } },
            },
          },
          select: { id: true },
        });
        if (!existingUser) {
          throw new BadRequestException(
            'El usuario no existe, está eliminado, está inactivo o ya tiene perfil laboral.',
          );
        }
        return await this.workerRepo.createForExistingUser(
          userId,
          finalWorkerData,
        );
      }

      if (!email || !firstName || !lastName || !password) {
        throw new BadRequestException(
          'Para crear un usuario nuevo se requiere email, nombres, apellidos y contraseña.',
        );
      }
      if (
        !this.workerRoles.includes(
          roleName as (typeof this.workerRoles)[number],
        )
      ) {
        throw new BadRequestException('Rol de trabajador no válido');
      }

      // 1. Verify role exists
      const role = await this.prisma.role.findUnique({
        where: { name: roleName },
      });
      if (!role) {
        throw new BadRequestException(`Role ${roleName} no encontrado`);
      }

      // 2. Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      const userData = {
        email: email.trim().toLowerCase(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        passwordHash,
      };

      return await this.workerRepo.createWithUser(
        userData,
        finalWorkerData,
        role.id,
      );
    } catch (error: unknown) {
      if (isPrismaError(error) && error.code === 'P2002') {
        const target = Array.isArray(error.meta?.target)
          ? error.meta.target.join(',')
          : typeof error.meta?.target === 'string'
            ? error.meta.target
            : '';
        if (target.includes('email')) {
          throw new BadRequestException(
            'El correo ingresado ya está registrado.',
          );
        }
        if (target.includes('userId')) {
          throw new BadRequestException(
            'El usuario ya tiene un perfil laboral.',
          );
        }
        throw new BadRequestException('El DNI ingresado ya está registrado.');
      }
      throw error;
    }
  }

  async createContract(workerId: string, contractData: CreateContractDto) {
    if (!this.contractTypes.includes(contractData.type as ContractType)) {
      throw new BadRequestException('Tipo de contrato no válido');
    }
    const worker = await this.prisma.worker.findFirst({
      where: {
        id: workerId,
        deletedAt: null,
        user: { isActive: true, deletedAt: null },
      },
      select: { id: true },
    });
    if (!worker) throw new NotFoundException('Trabajador no encontrado');

    const startDate = this.parseDate(contractData.startDate, 'startDate');
    const endDate = contractData.endDate
      ? this.parseDate(contractData.endDate, 'endDate')
      : null;
    if (endDate && endDate < startDate) {
      throw new BadRequestException(
        'La fecha de fin no puede ser anterior a la fecha de inicio.',
      );
    }
    const finalContractData = {
      ...contractData,
      type: contractData.type as ContractType,
      startDate,
      endDate,
      agreedSalary: this.parseMoney(contractData.agreedSalary, 'agreedSalary'),
      status: 'DRAFT' as const,
      isActive: false,
    };
    return this.workerRepo.createContract(workerId, finalContractData);
  }

  async findAllContracts(
    page = 1,
    limit = 20,
    status?: ContractStatus,
    search?: string,
  ) {
    const pagination = normalizePagination(page, limit);
    const cleanSearch = search?.trim();
    const where: Prisma.ContractWhereInput = {
      worker: {
        deletedAt: null,
        user: {
          deletedAt: null,
          ...(cleanSearch
            ? {
                OR: [
                  { firstName: { contains: cleanSearch, mode: 'insensitive' } },
                  { lastName: { contains: cleanSearch, mode: 'insensitive' } },
                  { email: { contains: cleanSearch, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
      },
      ...(status ? { status } : {}),
    };
    const [contracts, total] = await Promise.all([
      this.prisma.contract.findMany({
        where,
        include: {
          worker: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
          signer: { select: { id: true, firstName: true, lastName: true } },
          approver: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.contract.count({ where }),
    ]);
    return paginatedResult(contracts, pagination.page, pagination.limit, total);
  }

  async findMyContracts(userId: string, page = 1, limit = 20) {
    const pagination = normalizePagination(page, limit);
    let worker = await this.prisma.worker.findFirst({
      where: { userId, deletedAt: null, user: { deletedAt: null } },
      select: { id: true, baseSalary: true },
    });
    if (!worker) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { roles: { include: { role: true } } },
      });
      const isDocente = user?.roles.some((r) => r.role.name === 'DOCENTE');
      if (user && isDocente) {
        const dniCandidate =
          user.dni || `DOC${user.id.replace(/-/g, '').slice(0, 8)}`;
        worker = await this.prisma.worker.create({
          data: {
            userId: user.id,
            dni: dniCandidate,
            position: 'Docente titular',
            department: 'Académico',
            baseSalary: new Prisma.Decimal(4500),
            hireDate: user.createdAt,
            status: WorkerStatus.ACTIVE,
          },
          select: { id: true, baseSalary: true },
        });
        await this.prisma.contract.create({
          data: {
            workerId: worker.id,
            type: 'FREELANCE',
            status: ContractStatus.APPROVED,
            startDate: user.createdAt,
            agreedSalary: worker.baseSalary,
            approvedAt: new Date(),
          },
        });
      } else {
        return paginatedResult([], pagination.page, pagination.limit, 0);
      }
    }
    const where = { workerId: worker.id };
    const [contracts, total] = await Promise.all([
      this.prisma.contract.findMany({
        where,
        include: {
          signer: { select: { firstName: true, lastName: true } },
          approver: { select: { firstName: true, lastName: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.contract.count({ where }),
    ]);
    return paginatedResult(contracts, pagination.page, pagination.limit, total);
  }

  async findMyPayrolls(userId: string, page = 1, limit = 20) {
    const pagination = normalizePagination(page, limit);
    let worker = await this.prisma.worker.findFirst({
      where: { userId, deletedAt: null, user: { deletedAt: null } },
      select: { id: true, baseSalary: true, position: true, department: true },
    });
    if (!worker) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { roles: { include: { role: true } } },
      });
      const isDocente = user?.roles.some((r) => r.role.name === 'DOCENTE');
      if (user && isDocente) {
        const dniCandidate =
          user.dni || `DOC${user.id.replace(/-/g, '').slice(0, 8)}`;
        worker = await this.prisma.worker.create({
          data: {
            userId: user.id,
            dni: dniCandidate,
            position: 'Docente titular',
            department: 'Académico',
            baseSalary: new Prisma.Decimal(4500),
            hireDate: user.createdAt,
            status: WorkerStatus.ACTIVE,
          },
          select: {
            id: true,
            baseSalary: true,
            position: true,
            department: true,
          },
        });

        const now = new Date();
        const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        await this.prisma.payroll.create({
          data: {
            workerId: worker.id,
            period: currentPeriod,
            baseSalary: worker.baseSalary,
            totalAmount: worker.baseSalary,
            status: 'PAID',
            paymentDate: now,
          },
        });
      } else {
        return {
          ...paginatedResult([], pagination.page, pagination.limit, 0),
          summary: { totalPaid: '0', totalPending: '0', baseSalary: '0' },
        };
      }
    }
    const where = { workerId: worker.id };
    const [payrolls, total, paidAgg, pendingAgg] = await Promise.all([
      this.prisma.payroll.findMany({
        where,
        orderBy: [{ period: 'desc' }, { id: 'desc' }],
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.payroll.count({ where }),
      this.prisma.payroll.aggregate({
        where: { ...where, status: 'PAID' },
        _sum: { totalAmount: true },
      }),
      this.prisma.payroll.aggregate({
        where: { ...where, status: 'PENDING' },
        _sum: { totalAmount: true },
      }),
    ]);
    return {
      ...paginatedResult(payrolls, pagination.page, pagination.limit, total),
      summary: {
        totalPaid: paidAgg._sum.totalAmount?.toString() || '0',
        totalPending: pendingAgg._sum.totalAmount?.toString() || '0',
        baseSalary: worker.baseSalary.toString(),
        position: worker.position,
        department: worker.department,
      },
    };
  }

  async sendContract(contractId: string, actorId: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: { worker: { include: { user: true } } },
    });
    if (
      !contract ||
      contract.worker.deletedAt ||
      contract.worker.user.deletedAt
    ) {
      throw new NotFoundException('Contrato no encontrado');
    }
    if (!['DRAFT', 'REJECTED'].includes(contract.status)) {
      throw new BadRequestException(
        'El contrato no se puede enviar en su estado actual.',
      );
    }
    const updated = await this.prisma.contract.update({
      where: { id: contractId, status: { in: ['DRAFT', 'REJECTED'] } },
      data: { status: 'SENT', sentAt: new Date(), rejectionReason: null },
    });
    await this.notificationsService?.createNotification({
      userId: contract.worker.userId,
      title: 'Tienes un contrato pendiente de firma',
      message:
        'Revisa las condiciones y firma o devuelve el contrato con observaciones.',
      type: 'INFO',
      actionUrl: '/dashboard/my-contracts',
    });
    void this.auditService?.log(
      { userId: actorId },
      'SEND_CONTRACT',
      'Contract',
      contractId,
    );
    return updated;
  }

  async signContract(
    contractId: string,
    workerUserId: string,
    signatureName: string,
  ) {
    const contract = await this.getContractForWorker(contractId, workerUserId);
    if (contract.status !== 'SENT') {
      throw new BadRequestException('El contrato no está pendiente de firma.');
    }
    const normalizedName = signatureName.trim().replace(/\s+/g, ' ');
    const signedAt = new Date();
    const signatureHash = crypto
      .createHash('sha256')
      .update(
        `${contract.id}:${workerUserId}:${normalizedName}:${signedAt.toISOString()}`,
      )
      .digest('hex');
    const updated = await this.prisma.contract.update({
      where: { id: contractId, status: 'SENT' },
      data: {
        status: 'SIGNED',
        signedAt,
        signedBy: workerUserId,
        signatureName: normalizedName,
        signatureHash,
      },
    });
    await this.notifyContractManagers(
      'Contrato firmado por el trabajador',
      'Un contrato fue firmado y está pendiente de aprobación.',
    );
    void this.auditService?.log(
      { userId: workerUserId },
      'SIGN_CONTRACT',
      'Contract',
      contractId,
    );
    return updated;
  }

  async rejectContract(
    contractId: string,
    workerUserId: string,
    reason: string,
  ) {
    const contract = await this.getContractForWorker(contractId, workerUserId);
    if (contract.status !== 'SENT') {
      throw new BadRequestException(
        'El contrato no está pendiente de revisión.',
      );
    }
    const updated = await this.prisma.contract.update({
      where: { id: contractId, status: 'SENT' },
      data: { status: 'REJECTED', rejectionReason: reason.trim() },
    });
    await this.notifyContractManagers(
      'Contrato devuelto para corrección',
      `El trabajador devolvió un contrato con observaciones: ${reason.trim()}`,
    );
    void this.auditService?.log(
      { userId: workerUserId },
      'REJECT_CONTRACT',
      'Contract',
      contractId,
      undefined,
      { reason: reason.trim() },
    );
    return updated;
  }

  async approveContract(contractId: string, actorId: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
    });
    if (!contract) throw new NotFoundException('Contrato no encontrado');
    if (contract.status !== 'SIGNED') {
      throw new BadRequestException(
        'Solo se pueden aprobar contratos firmados por el trabajador.',
      );
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      // Serializa aprobaciones del mismo trabajador antes de desactivar contratos.
      await tx.$queryRaw`SELECT id FROM workers WHERE id = ${contract.workerId}::uuid FOR UPDATE`;
      await tx.contract.updateMany({
        where: {
          workerId: contract.workerId,
          id: { not: contractId },
          isActive: true,
        },
        data: { isActive: false },
      });
      return tx.contract.update({
        where: { id: contractId, status: 'SIGNED' },
        data: {
          status: 'APPROVED',
          approvedAt: new Date(),
          approvedBy: actorId,
          isActive: true,
        },
      });
    });
    const worker = await this.prisma.worker.findUnique({
      where: { id: contract.workerId },
      select: { userId: true },
    });
    if (worker) {
      await this.notificationsService?.createNotification({
        userId: worker.userId,
        title: 'Contrato aprobado',
        message: 'Tu contrato fue revisado y aprobado por administración.',
        type: 'SUCCESS',
        actionUrl: '/dashboard/my-contracts',
      });
    }
    void this.auditService?.log(
      { userId: actorId },
      'APPROVE_CONTRACT',
      'Contract',
      contractId,
    );
    return updated;
  }

  private async getContractForWorker(contractId: string, userId: string) {
    const contract = await this.prisma.contract.findFirst({
      where: {
        id: contractId,
        worker: { userId, deletedAt: null, user: { deletedAt: null } },
      },
      include: { worker: { include: { user: true } } },
    });
    if (!contract) throw new NotFoundException('Contrato no encontrado');
    return contract;
  }

  private async notifyContractManagers(title: string, message: string) {
    const notificationsService = this.notificationsService;
    if (!notificationsService) return;
    const managers = await this.prisma.user.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        roles: { some: { role: { name: { in: ['ADMIN', 'RRHH'] } } } },
      },
      select: { id: true },
    });
    await Promise.all(
      managers.map((manager) =>
        notificationsService.createNotification({
          userId: manager.id,
          title,
          message,
          type: 'INFO',
          actionUrl: '/dashboard/rrhh/contracts',
        }),
      ),
    );
  }

  async generateContractPdf(
    contractId: string,
    requesterId: string,
    roles: string[],
  ): Promise<Buffer> {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        worker: { include: { user: true } },
        signer: true,
        approver: true,
      },
    });
    if (!contract) throw new NotFoundException('Contrato no encontrado');
    const isAdmin = roles.includes('ADMIN') || roles.includes('RRHH');
    if (!isAdmin && contract.worker.userId !== requesterId) {
      throw new ForbiddenException('No tienes acceso a este contrato.');
    }
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 56 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      const fullName = `${contract.worker.user.firstName} ${contract.worker.user.lastName}`;
      const typeLabels: Record<string, string> = {
        INDEFINITE: 'Contrato indefinido',
        FIXED_TERM: 'Contrato a plazo fijo',
        INTERNSHIP: 'Convenio de prácticas',
        FREELANCE: 'Locación de servicios',
      };
      doc
        .fillColor('#102a43')
        .fontSize(22)
        .text('ACADEMIA VIRTUAL', { align: 'center' });
      doc
        .moveDown(0.5)
        .fillColor('#334e68')
        .fontSize(17)
        .text(typeLabels[contract.type] || 'Contrato laboral', {
          align: 'center',
        });
      doc.moveDown(1.5).fillColor('#243b53').fontSize(11);
      doc.text(`Trabajador: ${fullName}`);
      doc.text(`DNI: ${contract.worker.dni}`);
      doc.text(`Cargo: ${contract.worker.position}`);
      doc.text(`Departamento: ${contract.worker.department}`);
      doc.text(`Inicio: ${contract.startDate.toLocaleDateString('es-PE')}`);
      doc.text(
        `Fin: ${contract.endDate ? contract.endDate.toLocaleDateString('es-PE') : 'Sin fecha de término'}`,
      );
      doc.text(`Remuneración acordada: S/ ${contract.agreedSalary.toString()}`);
      doc
        .moveDown(1)
        .fontSize(12)
        .fillColor('#102a43')
        .text('Condiciones y observaciones', { underline: true });
      doc
        .moveDown(0.4)
        .fontSize(11)
        .fillColor('#243b53')
        .text(
          contract.observations ||
            'Las condiciones se rigen por la información registrada y aprobada en el sistema.',
        );
      doc
        .moveDown(2)
        .fontSize(10)
        .fillColor('#627d98')
        .text(`Estado: ${contract.status}`);
      if (contract.signedAt && contract.signatureName) {
        doc
          .moveDown(1)
          .fillColor('#102a43')
          .fontSize(11)
          .text(`Firmado electrónicamente por: ${contract.signatureName}`);
        doc
          .fontSize(10)
          .fillColor('#627d98')
          .text(`Fecha de firma: ${contract.signedAt.toLocaleString('es-PE')}`);
      }
      if (contract.approvedAt && contract.approver) {
        doc
          .moveDown(0.5)
          .fontSize(10)
          .fillColor('#627d98')
          .text(
            `Aprobado por: ${contract.approver.firstName} ${contract.approver.lastName} — ${contract.approvedAt.toLocaleString('es-PE')}`,
          );
      }
      doc
        .moveDown(3)
        .fontSize(9)
        .fillColor('#829ab1')
        .text(`ID de trazabilidad: ${contract.signatureHash || contract.id}`);
      doc.end();
    });
  }

  async findAllPayrolls(
    page = 1,
    limit = 20,
    period?: string,
    search?: string,
  ) {
    const pagination = normalizePagination(page, limit);
    const term = search?.trim();
    const where: Prisma.PayrollWhereInput = {
      period: period?.trim() || undefined,
      worker: {
        deletedAt: null,
        ...(term
          ? {
              user: {
                OR: [
                  { firstName: { contains: term, mode: 'insensitive' } },
                  { lastName: { contains: term, mode: 'insensitive' } },
                  { email: { contains: term, mode: 'insensitive' } },
                ],
              },
            }
          : {}),
      },
    };
    const include = {
      worker: {
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              isActive: true,
              deletedAt: true,
            },
          },
        },
      },
    } satisfies Prisma.PayrollInclude;
    const [payrolls, total, aggregate] = await Promise.all([
      this.prisma.payroll.findMany({
        include,
        where,
        orderBy: [{ period: 'desc' }, { id: 'desc' }],
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.payroll.count({ where }),
      this.prisma.payroll.aggregate({ where, _sum: { totalAmount: true } }),
    ]);
    return {
      ...paginatedResult(payrolls, pagination.page, pagination.limit, total),
      summary: { totalAmount: aggregate._sum.totalAmount?.toString() || '0' },
    };
  }

  async generatePayroll(period: string) {
    this.validatePeriod(period);
    const activeWorkers = await this.prisma.worker.findMany({
      where: {
        status: 'ACTIVE',
        deletedAt: null,
        user: { isActive: true, deletedAt: null },
      },
    });

    const createdPayrolls = await Promise.all(
      activeWorkers.map(async (worker) => {
        const existing = await this.prisma.payroll.findUnique({
          where: { workerId_period: { workerId: worker.id, period } },
        });
        if (existing) {
          return null;
        }
        return this.prisma.payroll.create({
          data: {
            workerId: worker.id,
            period,
            baseSalary: worker.baseSalary,
            totalAmount: worker.baseSalary,
            status: 'PENDING',
          },
        });
      }),
    );

    return createdPayrolls.filter(
      (payroll): payroll is NonNullable<typeof payroll> => payroll !== null,
    );
  }

  async payPayroll(id: string) {
    const payroll = await this.prisma.payroll.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!payroll) throw new NotFoundException('Nómina no encontrada');
    if (payroll.status === 'PAID') {
      throw new BadRequestException('La nómina ya fue pagada.');
    }
    return this.prisma.payroll.update({
      where: { id },
      data: {
        status: 'PAID',
        paymentDate: new Date(),
      },
    });
  }

  // ── DASHBOARD STATS ──

  /** Envía una alerta única cuando un contrato aprobado vence dentro de 30 días. */
  async processExpiringContractAlerts(now = new Date()) {
    const limitDate = new Date(now);
    limitDate.setDate(limitDate.getDate() + 30);

    const contracts = await this.prisma.contract.findMany({
      where: {
        status: 'APPROVED',
        isActive: true,
        expiryAlertSentAt: null,
        endDate: { gte: now, lte: limitDate },
        worker: { deletedAt: null, user: { isActive: true, deletedAt: null } },
      },
      include: {
        worker: {
          include: {
            user: {
              select: { firstName: true, lastName: true, email: true },
            },
          },
        },
      },
    });

    let processed = 0;
    for (const contract of contracts) {
      // Reclamo atómico para evitar duplicados si hay más de una instancia.
      const claimed = await this.prisma.contract.updateMany({
        where: { id: contract.id, expiryAlertSentAt: null },
        data: { expiryAlertSentAt: new Date() },
      });
      if (claimed.count !== 1 || !contract.endDate) continue;

      const workerName = `${contract.worker.user.firstName} ${contract.worker.user.lastName}`;
      const formattedDate = contract.endDate.toLocaleDateString('es-PE');
      const message = `El contrato de ${workerName} vence el ${formattedDate}.`;

      const emailSent = this.mailService
        ? await this.mailService.sendContractExpiryAlert(
            contract.worker.user.email,
            workerName,
            contract.type,
            contract.endDate,
          )
        : true;

      if (!emailSent) {
        // Permite que el siguiente ciclo vuelva a intentarlo si SMTP falló.
        await this.prisma.contract.updateMany({
          where: { id: contract.id, expiryAlertSentAt: { not: null } },
          data: { expiryAlertSentAt: null },
        });
        this.logger.warn(
          `Alerta de contrato ${contract.id} queda pendiente porque no se pudo enviar el correo`,
        );
        continue;
      }

      await Promise.all([
        this.notificationsService?.createNotification({
          userId: contract.worker.userId,
          title: 'Tu contrato está próximo a vencer',
          message: `Tu contrato vence el ${formattedDate}. Revisa los detalles con Recursos Humanos.`,
          type: 'WARNING',
          actionUrl: '/dashboard/my-contracts',
        }),
        this.notifyContractManagers('Contrato próximo a vencer', message),
      ]);
      processed += 1;
    }

    this.logger.log(`Alertas de contratos procesadas: ${processed}`);
    return { processed };
  }

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
      this.prisma.worker.count({
        where: { deletedAt: null, user: { deletedAt: null } },
      }),
      this.prisma.worker.count({
        where: {
          status: 'ACTIVE',
          deletedAt: null,
          user: { isActive: true, deletedAt: null },
        },
      }),
      this.prisma.worker.count({
        where: {
          status: 'INACTIVE',
          deletedAt: null,
          user: { deletedAt: null },
        },
      }),
      this.prisma.worker.count({
        where: {
          status: 'VACATION',
          deletedAt: null,
          user: { deletedAt: null },
        },
      }),
      this.prisma.payroll.count({
        where: {
          status: 'PENDING',
          worker: { deletedAt: null, user: { deletedAt: null } },
        },
      }),
      this.prisma.payroll.count({
        where: {
          status: 'PAID',
          worker: { deletedAt: null, user: { deletedAt: null } },
        },
      }),
      this.prisma.payroll.aggregate({
        _sum: { totalAmount: true },
        where: {
          status: 'PAID',
          worker: { deletedAt: null, user: { deletedAt: null } },
        },
      }),
    ]);

    // Contratos próximos a vencer (30 días)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const expiringContracts = await this.prisma.contract.findMany({
      where: {
        isActive: true,
        endDate: { lte: thirtyDaysFromNow, gte: new Date() },
        worker: { deletedAt: null, user: { deletedAt: null } },
      },
      include: {
        worker: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
      },
    });

    // Distribución por departamento
    const workers = await this.prisma.worker.findMany({
      where: { deletedAt: null, user: { deletedAt: null } },
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
      activeContracts: await this.prisma.contract.count({
        where: {
          isActive: true,
          worker: { deletedAt: null, user: { deletedAt: null } },
        },
      }),
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
      where: { worker: { deletedAt: null } },
      orderBy: [{ period: 'desc' }, { worker: { user: { lastName: 'asc' } } }],
    });

    const header =
      'Período,Nombre,Apellido,Email,Salario Base,Bonos,Deducciones,Total,Estado,Fecha Pago';
    const rows = payrolls.map((p) => {
      const sanitize = (v: string) =>
        `"${(/^[=+\-@]/.test(v) ? `'${v}` : v).replaceAll('"', '""')}"`;
      return [
        p.period,
        sanitize(p.worker.user.firstName),
        sanitize(p.worker.user.lastName),
        sanitize(p.worker.user.email),
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

    return `\uFEFF${[header, ...rows].join('\n')}`;
  }

  async getMonthlyAttendance(month: string) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month || ''))
      throw new BadRequestException('El mes debe tener formato AAAA-MM');
    const start = this.parseDateOnly(`${month}-01`, 'month');
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);
    const counts = await this.prisma.workAttendance.groupBy({
      by: ['workerId', 'status'],
      where: {
        date: { gte: start, lt: end },
        worker: { deletedAt: null, user: { deletedAt: null } },
      },
      _count: { id: true },
    });
    const workers = await this.prisma.worker.findMany({
      where: { id: { in: counts.map((row) => row.workerId) } },
      select: {
        id: true,
        department: true,
        position: true,
        user: { select: { firstName: true, lastName: true } },
      },
      orderBy: { user: { firstName: 'asc' } },
    });
    const totals = new Map<string, Record<string, number>>();
    for (const row of counts) {
      const statuses = totals.get(row.workerId) || {};
      statuses[row.status] = row._count.id;
      totals.set(row.workerId, statuses);
    }
    return workers.map((worker) => ({
      id: worker.id,
      name: `${worker.user.firstName} ${worker.user.lastName}`,
      department: worker.department,
      position: worker.position,
      counts: totals.get(worker.id) || {},
    }));
  }

  async getDailyAttendance(dateString: string) {
    const targetDate = this.parseDateOnly(dateString, 'date');
    const nextDate = new Date(targetDate);
    nextDate.setUTCDate(targetDate.getUTCDate() + 1);

    const [activeWorkers, records] = await Promise.all([
      this.prisma.worker.findMany({
        where: {
          status: 'ACTIVE',
          deletedAt: null,
          user: { isActive: true, deletedAt: null },
        },
        include: { user: { select: { firstName: true, lastName: true } } },
      }),
      this.prisma.workAttendance.findMany({
        where: {
          date: {
            gte: targetDate,
            lt: nextDate,
          },
        },
      }),
    ]);

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
    if (!this.attendanceStatuses.includes(data.status as AttendanceStatus)) {
      throw new BadRequestException('Estado de asistencia no válido');
    }
    const targetDate = this.parseDateOnly(data.date, 'date');
    const worker = await this.prisma.worker.findFirst({
      where: {
        id: data.workerId,
        status: 'ACTIVE',
        deletedAt: null,
        user: { isActive: true, deletedAt: null },
      },
      select: { id: true },
    });
    if (!worker) {
      throw new BadRequestException(
        'El trabajador no existe o su cuenta no está activa.',
      );
    }
    const existing = await this.prisma.workAttendance.findUnique({
      where: { workerId_date: { workerId: data.workerId, date: targetDate } },
      select: { checkInTime: true },
    });
    const hasCheckIn = data.status === 'PRESENT' || data.status === 'LATE';

    return this.prisma.workAttendance.upsert({
      where: {
        workerId_date: {
          workerId: data.workerId,
          date: targetDate,
        },
      },
      update: {
        status: data.status as AttendanceStatus,
        observation: data.observation?.trim() || null,
        checkInTime: hasCheckIn ? existing?.checkInTime || new Date() : null,
        checkOutTime: hasCheckIn ? undefined : null,
      },
      create: {
        workerId: data.workerId,
        date: targetDate,
        status: data.status as AttendanceStatus,
        observation: data.observation?.trim() || null,
        checkInTime:
          data.status === 'PRESENT' || data.status === 'LATE'
            ? new Date()
            : null,
      },
    });
  }

  private requiredText(value: string | undefined, label: string) {
    const normalized = value?.trim();
    if (!normalized) throw new BadRequestException(`${label} es obligatorio.`);
    return normalized;
  }

  private parseMoney(value: string, field: string) {
    try {
      const amount = toMoney(value);
      if (amount.isNegative() || amount.decimalPlaces() > 2) {
        throw new Error('invalid money');
      }
      return amount;
    } catch {
      throw new BadRequestException(`${field} debe ser un importe válido.`);
    }
  }

  private parseDate(value: string, field: string) {
    const parsed = new Date(value);
    if (!value || Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${field} debe ser una fecha válida.`);
    }
    return parsed;
  }

  private parseDateOnly(value: string, field: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) {
      throw new BadRequestException(`${field} debe tener formato YYYY-MM-DD.`);
    }
    const [year, month, day] = value.split('-').map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() !== month - 1 ||
      parsed.getUTCDate() !== day
    ) {
      throw new BadRequestException(`${field} no es una fecha válida.`);
    }
    return parsed;
  }

  private validatePeriod(period: string) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period || '')) {
      throw new BadRequestException('El periodo debe tener formato YYYY-MM.');
    }
  }
}

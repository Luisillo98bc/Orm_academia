import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import {
  normalizePagination,
  paginatedResult,
} from '../../../../shared/pagination/pagination';
import { escapeCsvText, withCsvBom } from '../../../../shared/utils/csv';
import { moneyToString } from '../../../../shared/utils/money';
import {
  EnrollmentCandidatesQueryDto,
  EnrollmentManagementQueryDto,
  UpdateEnrollmentStatusDto,
} from '../dtos/enrollment-management.dto';

const enrollmentSelect = {
  id: true,
  status: true,
  enrolledAt: true,
  reservationExpiresAt: true,
  completedAt: true,
  user: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      dni: true,
      phone: true,
      isActive: true,
    },
  },
  cohort: {
    select: {
      id: true,
      name: true,
      schedule: true,
      startDate: true,
      endDate: true,
      course: { select: { id: true, name: true } },
    },
  },
  payment: {
    select: {
      id: true,
      amount: true,
      method: true,
      status: true,
      voucherUrl: true,
    },
  },
} satisfies Prisma.EnrollmentSelect;

@Injectable()
export class EnrollmentManagementService {
  constructor(private readonly prisma: PrismaService) {}

  private where(
    query: EnrollmentManagementQueryDto,
  ): Prisma.EnrollmentWhereInput {
    const terms = query.search?.trim().split(/\s+/).filter(Boolean) || [];
    return {
      deletedAt: null,
      ...(query.cohortId ? { cohortId: query.cohortId } : {}),
      ...(query.studentId ? { userId: query.studentId } : {}),
      ...(terms.length
        ? {
            AND: terms.map((term) => ({
              OR: [
                {
                  user: {
                    OR: ['firstName', 'lastName', 'email', 'dni', 'phone'].map(
                      (field) => ({
                        [field]: { contains: term, mode: 'insensitive' },
                      }),
                    ),
                  },
                },
                { cohort: { name: { contains: term, mode: 'insensitive' } } },
                {
                  cohort: {
                    course: { name: { contains: term, mode: 'insensitive' } },
                  },
                },
              ],
            })),
          }
        : {}),
    };
  }

  async list(query: EnrollmentManagementQueryDto) {
    const pagination = normalizePagination(query.page, query.limit);
    const baseWhere = this.where(query);
    const where = {
      ...baseWhere,
      ...(query.status ? { status: query.status } : {}),
    };
    const [rows, total, grouped] = await Promise.all([
      this.prisma.enrollment.findMany({
        where,
        select: enrollmentSelect,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [{ enrolledAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.enrollment.count({ where }),
      this.prisma.enrollment.groupBy({
        by: ['status'],
        where: baseWhere,
        _count: { _all: true },
      }),
    ]);
    return {
      ...paginatedResult(
        rows.map((row) => ({
          ...row,
          payment: row.payment
            ? { ...row.payment, amount: moneyToString(row.payment.amount) }
            : null,
        })),
        pagination.page,
        pagination.limit,
        total,
      ),
      summary: {
        total: grouped.reduce((sum, item) => sum + item._count._all, 0),
        active:
          grouped.find((item) => item.status === 'ACTIVE')?._count._all || 0,
        pending:
          grouped.find((item) => item.status === 'PENDING_PAYMENT')?._count
            ._all || 0,
        completed:
          grouped.find((item) => item.status === 'COMPLETED')?._count._all || 0,
      },
    };
  }

  async candidates(query: EnrollmentCandidatesQueryDto) {
    const pagination = normalizePagination(query.page, query.limit);
    const terms = query.search?.trim().split(/\s+/).filter(Boolean) || [];
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(query.role !== 'ALL'
        ? {
            roles: {
              some: {
                role: { name: 'ESTUDIANTE', isActive: true, deletedAt: null },
              },
            },
          }
        : {}),
      ...(terms.length
        ? {
            AND: terms.map((term) => ({
              OR: ['firstName', 'lastName', 'email', 'dni', 'phone'].map(
                (field) => ({
                  [field]: { contains: term, mode: 'insensitive' },
                }),
              ),
            })),
          }
        : {}),
    };
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          dni: true,
          phone: true,
          isActive: true,
          roles: {
            where: { role: { isActive: true, deletedAt: null } },
            select: { role: { select: { name: true } } },
          },
        },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }, { id: 'asc' }],
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.user.count({ where }),
    ]);
    return paginatedResult(
      users.map((user) => ({
        ...user,
        roles: user.roles.map((item) => item.role.name),
      })),
      pagination.page,
      pagination.limit,
      total,
    );
  }

  /**
   * Cambia el estado académico de una matrícula. Las matrículas pendientes de
   * pago se gestionan desde Pagos; reactivar vuelve a comprobar el cupo bajo
   * bloqueo de fila para no superar la capacidad de la cohorte.
   */
  async updateStatus(id: string, dto: UpdateEnrollmentStatusDto) {
    const allowed: Record<string, string[]> = {
      ACTIVE: ['SUSPENDED', 'DROPPED', 'COMPLETED'],
      SUSPENDED: ['ACTIVE', 'DROPPED'],
      DROPPED: ['ACTIVE'],
      COMPLETED: ['ACTIVE'],
    };
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.enrollment.findFirst({
        where: { id, deletedAt: null },
        select: { id: true, status: true, cohortId: true },
      });
      if (!current) throw new NotFoundException('Matrícula no encontrada');
      if (current.status === 'PENDING_PAYMENT') {
        throw new BadRequestException(
          'Las matrículas por validar se aprueban o rechazan desde Pagos',
        );
      }
      if (current.status === dto.status) {
        throw new BadRequestException('La matrícula ya tiene ese estado');
      }
      if (!allowed[current.status]?.includes(dto.status)) {
        throw new BadRequestException('Cambio de estado no permitido');
      }

      const releasesSeat = ['SUSPENDED', 'DROPPED'].includes(current.status);
      if (dto.status === 'ACTIVE' && releasesSeat) {
        const cohorts = await tx.$queryRaw<Array<{ maxStudents: number }>>(
          Prisma.sql`
            SELECT max_students AS "maxStudents" FROM "cohorts"
            WHERE id = ${current.cohortId}::uuid AND deleted_at IS NULL
            FOR UPDATE
          `,
        );
        if (!cohorts[0]) throw new NotFoundException('Cohorte no encontrada');
        const occupied = await tx.enrollment.count({
          where: {
            cohortId: current.cohortId,
            deletedAt: null,
            OR: [
              { status: { in: ['ACTIVE', 'COMPLETED'] } },
              {
                status: 'PENDING_PAYMENT',
                reservationExpiresAt: { gt: new Date() },
              },
            ],
          },
        });
        if (occupied >= cohorts[0].maxStudents) {
          throw new BadRequestException(
            'La cohorte no tiene cupos para reactivar esta matrícula',
          );
        }
      }

      const updated = await tx.enrollment.update({
        where: { id },
        data: {
          status: dto.status,
          completedAt: dto.status === 'COMPLETED' ? new Date() : null,
        },
        select: enrollmentSelect,
      });
      return {
        previousStatus: current.status,
        enrollment: {
          ...updated,
          payment: updated.payment
            ? {
                ...updated.payment,
                amount: moneyToString(updated.payment.amount),
              }
            : null,
        },
      };
    });
  }

  async export(query: EnrollmentManagementQueryDto) {
    const where = {
      ...this.where(query),
      ...(query.status ? { status: query.status } : {}),
    };
    const lines = [
      [
        'Alumno',
        'Email',
        'DNI',
        'Teléfono',
        'Curso',
        'Cohorte',
        'Inscripción',
        'Estado',
        'EstadoPago',
        'Importe',
        'Método',
      ]
        .map(escapeCsvText)
        .join(','),
    ];
    let afterId: string | undefined;
    while (true) {
      const rows = await this.prisma.enrollment.findMany({
        where: { ...where, ...(afterId ? { id: { gt: afterId } } : {}) },
        select: enrollmentSelect,
        orderBy: { id: 'asc' },
        take: 500,
      });
      for (const row of rows)
        lines.push(
          [
            `${row.user.firstName} ${row.user.lastName}`,
            row.user.email,
            row.user.dni,
            row.user.phone,
            row.cohort.course.name,
            row.cohort.name,
            row.enrolledAt.toISOString(),
            row.status,
            row.payment?.status || 'SIN_PAGO',
            row.payment ? moneyToString(row.payment.amount) : '',
            row.payment?.method || '',
          ]
            .map(escapeCsvText)
            .join(','),
        );
      if (rows.length < 500) break;
      afterId = rows[rows.length - 1].id;
    }
    return withCsvBom(lines.join('\r\n'));
  }
}

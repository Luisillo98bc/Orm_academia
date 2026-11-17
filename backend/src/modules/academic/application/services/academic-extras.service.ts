import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { DeliverableStatus, GradeStatus, Prisma } from '@prisma/client';
import { NotificationsService } from '../../../communication/notifications.service';

type AttendanceUser = {
  id: string;
  roles?: string[];
};

type AttendanceInput = {
  studentId: string;
  sessionId: string;
  date: string;
  isPresent: boolean;
  isExcused?: boolean;
  observation?: string;
};

type StudentClassSummary = {
  id: string;
  title: string;
  date: Date;
  meetLink: string | null;
  cohortId: string;
  courseName: string;
};

type PendingEvaluationSummary = {
  id: string;
  title: string;
  dueDate: Date | null;
  cohortId: string;
  courseName: string;
};

type CalendarEvent = {
  id: string;
  type: 'class' | 'evaluation';
  title: string;
  date: Date | null;
  courseName: string;
  cohortName: string;
  meetLink?: string | null;
  weight?: number;
};

type StudentGradeSummary = {
  evaluationId: string;
  title: string;
  weight: number;
  maxScore: number;
  dueDate: Date | null;
  score: number | null;
  status: string;
  feedback: string | null;
};

@Injectable()
export class AcademicExtrasService {
  constructor(
    private prisma: PrismaService,
    private readonly notifications?: NotificationsService,
  ) {}

  async duplicateCohort(
    sourceId: string,
    user: AttendanceUser,
    input: {
      name: string;
      startDate: string;
      endDate: string;
      price?: string;
      maxStudents?: number;
    },
  ) {
    await this.assertCohortManagerAccess(sourceId, user);
    const source = await this.prisma.cohort.findUnique({
      where: { id: sourceId },
      include: {
        teachers: { select: { id: true } },
        syllabusModules: {
          orderBy: { order: 'asc' },
          include: { materials: true, sessions: true, evaluations: true },
        },
      },
    });
    if (!source) throw new NotFoundException('Cohorte no encontrada');
    const startDate = new Date(input.startDate);
    const endDate = new Date(input.endDate);
    if (
      !input.name?.trim() ||
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime()) ||
      endDate <= startDate
    )
      throw new BadRequestException('Nombre y fechas válidas son obligatorios');
    return this.prisma.$transaction(async (tx) => {
      const cohort = await tx.cohort.create({
        data: {
          courseId: source.courseId,
          name: input.name.trim().slice(0, 200),
          modality: source.modality,
          schedule: source.schedule,
          price: input.price ?? source.price,
          installments: source.installments ?? 1,
          imageUrl: source.imageUrl,
          maxStudents: input.maxStudents || source.maxStudents,
          startDate,
          endDate,
          discountPercentage: source.discountPercentage,
          teachers: {
            connect: source.teachers.map((teacher) => ({ id: teacher.id })),
          },
        },
      });
      const moduleMap = new Map<string, string>();
      for (const module of source.syllabusModules) {
        const createdModule = await tx.syllabusModule.create({
          data: {
            cohortId: cohort.id,
            title: module.title,
            description: module.description,
            order: module.order,
          },
        });
        moduleMap.set(module.id, createdModule.id);
        if (module.materials.length)
          await tx.material.createMany({
            data: module.materials.map((material) => ({
              moduleId: createdModule.id,
              title: material.title,
              type: material.type,
              fileUrl: material.fileUrl,
            })),
          });
        if (module.sessions.length)
          await tx.classSession.createMany({
            data: module.sessions.map((session) => ({
              moduleId: createdModule.id,
              title: session.title,
              date: session.date,
              meetLink: session.meetLink,
              recordingUrl: session.recordingUrl,
              durationMinutes: session.durationMinutes,
              timeZone: session.timeZone,
            })),
          });
      }
      for (const module of source.syllabusModules)
        for (const evaluation of module.evaluations)
          await tx.evaluation.create({
            data: {
              cohortId: cohort.id,
              moduleId: moduleMap.get(module.id),
              title: evaluation.title,
              description: evaluation.description,
              weight: evaluation.weight,
              maxScore: evaluation.maxScore,
              dueDate: evaluation.dueDate,
              isPublished: false,
              kind: evaluation.kind,
              allowResubmit: evaluation.allowResubmit,
              allowLate: evaluation.allowLate,
              rubric: evaluation.rubric ?? Prisma.JsonNull,
              quiz: evaluation.quiz ?? Prisma.JsonNull,
              maxAttempts: evaluation.maxAttempts,
              timeLimitMinutes: evaluation.timeLimitMinutes,
            },
          });
      return tx.cohort.findUnique({
        where: { id: cohort.id },
        include: {
          course: true,
          teachers: { select: { id: true, firstName: true, lastName: true } },
          syllabusModules: {
            include: { materials: true, sessions: true, evaluations: true },
          },
        },
      });
    });
  }

  private parseAttendanceDate(date: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException(
        'La fecha de asistencia debe tener el formato AAAA-MM-DD',
      );
    }

    const parsedDate = new Date(`${date}T00:00:00.000Z`);
    if (
      Number.isNaN(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== date
    ) {
      throw new BadRequestException('La fecha de asistencia no es válida');
    }

    return parsedDate;
  }

  async assertCohortManagerAccess(cohortId: string, user: AttendanceUser) {
    if (user.roles?.includes('ADMIN')) return;

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
        'No tienes permiso para gestionar la asistencia de esta cohorte',
      );
    }
  }

  async assertDeliverableManagerAccess(
    deliverableId: string,
    user: AttendanceUser,
  ) {
    const deliverable = await this.prisma.deliverable.findUnique({
      where: { id: deliverableId },
      select: { evaluation: { select: { cohortId: true } } },
    });

    if (!deliverable) {
      throw new NotFoundException('Entrega no encontrada');
    }

    await this.assertCohortManagerAccess(deliverable.evaluation.cohortId, user);
  }

  async assertEvaluationManagerAccess(
    evaluationId: string,
    user: AttendanceUser,
  ) {
    const evaluation = await this.prisma.evaluation.findFirst({
      where: { id: evaluationId, deletedAt: null },
      select: { cohortId: true },
    });

    if (!evaluation) {
      throw new NotFoundException('Evaluación no encontrada');
    }

    await this.assertCohortManagerAccess(evaluation.cohortId, user);
  }

  /**
   * Valida el acceso de lectura a una cohorte antes de devolver módulos,
   * evaluaciones o cualquier otro recurso académico asociado.
   */
  async assertCohortViewAccess(cohortId: string, user: AttendanceUser) {
    if (user.roles?.includes('ADMIN') || user.roles?.includes('RRHH')) {
      return;
    }

    if (user.roles?.includes('DOCENTE')) {
      await this.assertCohortManagerAccess(cohortId, user);
      return;
    }

    if (user.roles?.includes('ESTUDIANTE')) {
      const enrollment = await this.prisma.enrollment.findFirst({
        where: {
          cohortId,
          userId: user.id,
          status: { in: ['ACTIVE', 'COMPLETED'] },
          deletedAt: null,
        },
        select: { id: true },
      });

      if (!enrollment) {
        throw new ForbiddenException(
          'No tienes una matrícula activa en esta cohorte',
        );
      }
      return;
    }

    throw new ForbiddenException('No tienes permiso para ver esta cohorte');
  }

  private async assertStudentsEnrolled(cohortId: string, studentIds: string[]) {
    const uniqueStudentIds = [...new Set(studentIds)];
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        cohortId,
        userId: { in: uniqueStudentIds },
        status: { in: ['ACTIVE', 'COMPLETED'] },
        deletedAt: null,
      },
      select: { userId: true },
    });
    const enrolledIds = new Set(
      enrollments.map((enrollment) => enrollment.userId),
    );
    const invalidStudentIds = uniqueStudentIds.filter(
      (studentId) => !enrolledIds.has(studentId),
    );

    if (invalidStudentIds.length > 0) {
      throw new BadRequestException(
        'El estudiante no tiene una matrícula activa o completada en esta cohorte. Verifica que seleccionaste la cohorte correcta y que el pago haya sido aprobado.',
      );
    }
  }

  private async assertSessionBelongsToCohort(
    cohortId: string,
    sessionId: string,
    date: Date,
  ) {
    if (!sessionId || typeof sessionId !== 'string') {
      throw new BadRequestException(
        'Debes seleccionar una sesión de clase para registrar asistencia',
      );
    }

    const session = await this.prisma.classSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        date: true,
        timeZone: true,
        module: { select: { cohortId: true } },
      },
    });

    if (!session || session.module.cohortId !== cohortId) {
      throw new BadRequestException(
        'La sesión seleccionada no pertenece a esta cohorte',
      );
    }

    if (
      (session.timeZone
        ? new Intl.DateTimeFormat('en-CA', {
            timeZone: session.timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          }).format(session.date)
        : session.date.toISOString().slice(0, 10)) !==
      date.toISOString().slice(0, 10)
    ) {
      throw new BadRequestException(
        'La fecha no coincide con la fecha programada de la sesión',
      );
    }
  }

  async markAttendance(
    cohortId: string,
    data: AttendanceInput,
    user: AttendanceUser,
  ) {
    await this.assertCohortManagerAccess(cohortId, user);
    await this.assertStudentsEnrolled(cohortId, [data.studentId]);
    if (typeof data.isPresent !== 'boolean') {
      throw new BadRequestException('El estado de asistencia no es válido');
    }

    const parsedDate = this.parseAttendanceDate(data.date);
    await this.assertSessionBelongsToCohort(
      cohortId,
      data.sessionId,
      parsedDate,
    );
    const isExcused = data.isPresent ? false : data.isExcused === true;
    return this.prisma.classAttendance.upsert({
      where: {
        sessionId_studentId: {
          sessionId: data.sessionId,
          studentId: data.studentId,
        },
      },
      update: {
        isPresent: data.isPresent,
        isExcused,
        observation: data.observation?.trim() || null,
      },
      create: {
        cohortId,
        studentId: data.studentId,
        sessionId: data.sessionId,
        date: parsedDate,
        isPresent: data.isPresent,
        isExcused,
        observation: data.observation?.trim() || null,
      },
    });
  }

  async getCohortStudents(cohortId: string, user?: AttendanceUser) {
    if (user && user.roles?.includes('DOCENTE')) {
      await this.assertCohortManagerAccess(cohortId, user);
    }

    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        cohortId,
        status: { in: ['ACTIVE', 'COMPLETED'] },
        deletedAt: null,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            profilePicture: true,
          },
        },
      },
      orderBy: { user: { lastName: 'asc' } },
    });
    return enrollments.map((enrollment) => enrollment.user);
  }

  async markAttendanceBulk(
    cohortId: string,
    data: {
      sessionId: string;
      date: string;
      records: Array<{
        studentId: string;
        isPresent: boolean;
        isExcused?: boolean;
        observation?: string;
      }>;
    },
    user: AttendanceUser,
  ) {
    await this.assertCohortManagerAccess(cohortId, user);
    if (!Array.isArray(data.records) || data.records.length === 0) {
      throw new BadRequestException(
        'Debes marcar al menos un estudiante antes de guardar',
      );
    }

    const studentIds = data.records.map((record) => record.studentId);
    if (new Set(studentIds).size !== studentIds.length) {
      throw new BadRequestException(
        'La lista de asistencia contiene estudiantes duplicados',
      );
    }

    await this.assertStudentsEnrolled(cohortId, studentIds);
    const parsedDate = this.parseAttendanceDate(data.date);
    await this.assertSessionBelongsToCohort(
      cohortId,
      data.sessionId,
      parsedDate,
    );
    const operations = data.records.map((r) =>
      this.prisma.classAttendance.upsert({
        where: {
          sessionId_studentId: {
            sessionId: data.sessionId,
            studentId: r.studentId,
          },
        },
        update: {
          isPresent: r.isPresent,
          isExcused: r.isPresent ? false : r.isExcused === true,
          observation: r.observation?.trim() || null,
        },
        create: {
          cohortId,
          studentId: r.studentId,
          sessionId: data.sessionId,
          date: parsedDate,
          isPresent: r.isPresent,
          isExcused: r.isPresent ? false : r.isExcused === true,
          observation: r.observation?.trim() || null,
        },
      }),
    );
    return this.prisma.$transaction(operations);
  }

  async getAttendance(
    cohortId: string,
    date: string,
    sessionId: string | undefined,
    user: AttendanceUser,
  ) {
    const parsedDate = this.parseAttendanceDate(date);
    const isStudent =
      user.roles?.includes('ESTUDIANTE') && !user.roles.includes('ADMIN');
    const isManager =
      user.roles?.includes('ADMIN') || user.roles?.includes('DOCENTE');

    if (isStudent) {
      const enrollment = await this.prisma.enrollment.findFirst({
        where: {
          cohortId,
          userId: user.id,
          status: { in: ['ACTIVE', 'COMPLETED'] },
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!enrollment) {
        throw new ForbiddenException(
          'No tienes una matrícula activa en esta cohorte',
        );
      }
    } else if (isManager) {
      if (user.roles?.includes('DOCENTE')) {
        await this.assertCohortManagerAccess(cohortId, user);
      }
    } else {
      throw new ForbiddenException(
        'No tienes permiso para consultar asistencia',
      );
    }

    await this.assertSessionBelongsToCohort(
      cohortId,
      sessionId || '',
      parsedDate,
    );

    return this.prisma.classAttendance.findMany({
      where: {
        cohortId,
        sessionId,
        ...(isStudent ? { studentId: user.id } : {}),
      },
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  async getCohortGradesSummary(cohortId: string, user: AttendanceUser) {
    await this.assertCohortViewAccess(cohortId, user);

    // Ejecutar las 4 consultas independientes en paralelo
    const [students, evaluations, deliverables, attendances] =
      await Promise.all([
        this.getCohortStudents(cohortId, user),
        this.prisma.evaluation.findMany({
          where: { cohortId, deletedAt: null },
          orderBy: { createdAt: 'asc' },
        }),
        this.prisma.deliverable.findMany({
          where: { evaluation: { cohortId }, deletedAt: null },
          include: { grade: true },
        }),
        this.prisma.classAttendance.findMany({
          where: { cohortId },
        }),
      ]);

    const totalWeight = evaluations.reduce((acc, ev) => acc + ev.weight, 0);

    const studentsSummary = students.map((student) => {
      let weightedScore = 0;
      const gradesMap: Record<
        string,
        { score: number | null; feedback?: string | null; status: string }
      > = {};

      evaluations.forEach((ev) => {
        const deliverable = deliverables.find(
          (d) => d.evaluationId === ev.id && d.studentId === student.id,
        );
        const grade = deliverable?.grade;
        if (grade && grade.score !== undefined && grade.score !== null) {
          const normScore = (grade.score / ev.maxScore) * ev.weight;
          weightedScore += normScore;
          gradesMap[ev.id] = {
            score: grade.score,
            feedback: grade.feedback,
            status: grade.status,
          };
        } else if (deliverable) {
          gradesMap[ev.id] = {
            score: null,
            feedback: null,
            status: 'PENDING_GRADE',
          };
        } else {
          gradesMap[ev.id] = {
            score: null,
            feedback: null,
            status: 'NOT_SUBMITTED',
          };
        }
      });

      const finalGrade =
        totalWeight > 0
          ? Math.round((weightedScore / totalWeight) * 20 * 100) / 100
          : 0;

      const studentAttendances = attendances.filter(
        (a) => a.studentId === student.id,
      );
      const totalClasses = studentAttendances.length;
      const presentCount = studentAttendances.filter((a) => a.isPresent).length;
      const attendanceRate =
        totalClasses > 0
          ? Math.round((presentCount / totalClasses) * 100)
          : 100;

      return {
        student,
        gradesMap,
        finalGrade,
        isPassed: finalGrade >= 13,
        attendanceRate,
        totalClasses,
        presentCount,
      };
    });

    return {
      evaluations,
      studentsSummary,
      totalWeight,
    };
  }

  async importGrades(
    cohortId: string,
    evaluationId: string,
    rows: Array<{ studentEmail: string; score: number; feedback?: string }>,
    user: AttendanceUser,
  ) {
    await this.assertCohortManagerAccess(cohortId, user);

    if (!evaluationId || !Array.isArray(rows) || rows.length === 0) {
      throw new BadRequestException(
        'Selecciona una evaluación y agrega al menos una fila de notas',
      );
    }
    if (rows.length > 500) {
      throw new BadRequestException(
        'La carga masiva permite un máximo de 500 estudiantes por operación',
      );
    }

    const evaluation = await this.prisma.evaluation.findFirst({
      where: { id: evaluationId, cohortId, deletedAt: null },
      select: { id: true, title: true, maxScore: true, kind: true },
    });
    if (!evaluation) {
      throw new NotFoundException(
        'La evaluación no existe o no pertenece a esta cohorte',
      );
    }
    if (evaluation.kind === 'QUIZ') {
      throw new BadRequestException(
        'Los cuestionarios se califican automáticamente y no aceptan importación de notas',
      );
    }

    const normalizedRows = rows.map((row, index) => ({
      rowNumber: index + 2,
      email: String(row.studentEmail || '')
        .trim()
        .toLowerCase(),
      score: Number(row.score),
      feedback: String(row.feedback || '').trim() || null,
    }));
    const errors: string[] = [];
    const seenEmails = new Set<string>();
    normalizedRows.forEach((row) => {
      if (!row.email) errors.push(`Fila ${row.rowNumber}: falta el email`);
      if (seenEmails.has(row.email)) {
        errors.push(`Fila ${row.rowNumber}: el email está repetido`);
      }
      seenEmails.add(row.email);
      if (
        !Number.isFinite(row.score) ||
        row.score < 0 ||
        row.score > evaluation.maxScore
      ) {
        errors.push(
          `Fila ${row.rowNumber}: la nota debe estar entre 0 y ${evaluation.maxScore}`,
        );
      }
    });

    const users = await this.prisma.user.findMany({
      where: {
        email: {
          in: normalizedRows.map((row) => row.email),
          mode: 'insensitive',
        },
      },
      select: { id: true, email: true },
    });
    const usersByEmail = new Map(
      users.map((student) => [student.email.toLowerCase(), student]),
    );
    const userIds = users.map((student) => student.id);
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        cohortId,
        userId: { in: userIds },
        status: { in: ['ACTIVE', 'COMPLETED'] },
        deletedAt: null,
      },
      select: { userId: true },
    });
    const enrolledIds = new Set(
      enrollments.map((enrollment) => enrollment.userId),
    );

    normalizedRows.forEach((row) => {
      const student = usersByEmail.get(row.email);
      if (!student) {
        errors.push(`Fila ${row.rowNumber}: no existe el usuario ${row.email}`);
      } else if (!enrolledIds.has(student.id)) {
        errors.push(
          `Fila ${row.rowNumber}: ${row.email} no está matriculado en esta cohorte`,
        );
      }
    });

    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'La carga no se aplicó porque contiene errores',
        errors,
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await Promise.all(
        normalizedRows.map(async (row) => {
          const student = usersByEmail.get(row.email)!;
          const deliverable = await tx.deliverable.findUnique({
            where: {
              evaluationId_studentId: {
                evaluationId,
                studentId: student.id,
              },
            },
            include: { grade: true },
          });

          const savedDeliverable = deliverable
            ? await tx.deliverable.update({
                where: { id: deliverable.id },
                data: {
                  deletedAt: null,
                  status: DeliverableStatus.GRADED,
                },
                include: { grade: true },
              })
            : await tx.deliverable.create({
                data: {
                  evaluationId,
                  studentId: student.id,
                  fileUrl: 'manual://bulk-import',
                  fileName: 'Carga masiva de notas CSV',
                  status: DeliverableStatus.GRADED,
                },
                include: { grade: true },
              });

          if (savedDeliverable.grade) {
            await tx.grade.update({
              where: { id: savedDeliverable.grade.id },
              data: {
                graderId: user.id,
                score: row.score,
                ...(row.feedback !== null ? { feedback: row.feedback } : {}),
                status: GradeStatus.PUBLISHED,
                gradedAt: new Date(),
                deletedAt: null,
              },
            });
          } else {
            await tx.grade.create({
              data: {
                deliverableId: savedDeliverable.id,
                graderId: user.id,
                score: row.score,
                feedback: row.feedback,
                status: GradeStatus.PUBLISHED,
              },
            });
          }
        }),
      );
    });

    return {
      imported: normalizedRows.length,
      evaluation: { id: evaluation.id, title: evaluation.title },
    };
  }

  async evaluateTeacher(
    cohortId: string,
    studentId: string,
    data: { teacherId?: string; score: number; comment?: string },
  ) {
    await this.assertStudentsEnrolled(cohortId, [studentId]);
    if (!Number.isInteger(data.score) || data.score < 1 || data.score > 5)
      throw new BadRequestException('La valoración debe estar entre 1 y 5');
    const assigned = await this.prisma.cohort.findFirst({
      where: { id: cohortId, deletedAt: null },
      select: { teachers: { select: { id: true } } },
    });
    if (
      !assigned ||
      (data.teacherId &&
        !assigned.teachers.some((teacher) => teacher.id === data.teacherId))
    )
      throw new BadRequestException('Docente no asignado a esta cohorte');
    const targetTeacherId = data.teacherId || assigned.teachers[0]?.id;

    if (!targetTeacherId) {
      throw new BadRequestException(
        'No hay un docente asignado a esta cohorte para evaluar',
      );
    }

    return this.prisma.teacherEvaluation.upsert({
      where: {
        cohortId_studentId: {
          cohortId,
          studentId,
        },
      },
      update: {
        teacherId: targetTeacherId,
        score: data.score,
        comment: data.comment,
      },
      create: {
        cohortId,
        studentId,
        teacherId: targetTeacherId,
        score: data.score,
        comment: data.comment,
      },
    });
  }

  async getMyActiveCohorts(userId: string) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        userId,
        status: { in: ['ACTIVE', 'COMPLETED', 'PENDING_PAYMENT'] },
        deletedAt: null,
      },
      include: {
        cohort: {
          include: {
            course: true,
            teachers: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    return enrollments;
  }

  // ── CALENDARIO ACADÉMICO ──

  /**
   * Obtener eventos del calendario para el usuario autenticado.
   * Consolida sesiones de clase y evaluaciones con fecha de entrega.
   */
  async setMaterialProgress(
    userId: string,
    materialId: string,
    completed: boolean,
  ) {
    const material = await this.prisma.material.findFirst({
      where: {
        id: materialId,
        module: {
          cohort: {
            enrollments: {
              some: { userId, status: 'ACTIVE', deletedAt: null },
            },
          },
        },
      },
      select: { id: true },
    });
    if (!material)
      throw new BadRequestException(
        'Material no disponible para este estudiante',
      );
    return this.prisma.materialProgress.upsert({
      where: { userId_materialId: { userId, materialId } },
      update: { completedAt: completed ? new Date() : null },
      create: {
        userId,
        materialId,
        completedAt: completed ? new Date() : null,
      },
    });
  }

  async getLearningOverview(userId: string, includeEngagement = false) {
    const enrollmentsPromise = this.prisma.enrollment.findMany({
      where: {
        userId,
        status: { in: ['ACTIVE', 'COMPLETED'] },
        deletedAt: null,
      },
      include: {
        cohort: {
          include: {
            course: { select: { id: true, name: true, imageUrl: true } },
            syllabusModules: {
              orderBy: { order: 'asc' },
              include: {
                materials: { include: { progress: { where: { userId } } } },
                sessions: { orderBy: { date: 'asc' } },
                evaluations: {
                  where: { isPublished: true, deletedAt: null },
                  include: {
                    deliverables: {
                      where: { studentId: userId, deletedAt: null },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    const [enrollments, progress, attendance] = includeEngagement
      ? await Promise.all([
          enrollmentsPromise,
          this.prisma.materialProgress.findMany({
            where: { userId, completedAt: { not: null } },
            select: { updatedAt: true },
          }),
          this.prisma.classAttendance.findMany({
            where: { studentId: userId },
            select: { isPresent: true, isExcused: true },
          }),
        ])
      : [await enrollmentsPromise, [], []];
    const now = new Date();
    const classes: StudentClassSummary[] = [];
    const pendingEvaluations: PendingEvaluationSummary[] = [];
    const courses = enrollments.map(({ cohort, status }) => {
      let completedItems = 0;
      let totalItems = 0;
      let continueModuleId: string | null = null;
      cohort.syllabusModules.forEach((module) => {
        const done =
          module.materials.filter((m) => m.progress[0]?.completedAt).length +
          module.evaluations.filter((e) => e.deliverables.length > 0).length;
        const total = module.materials.length + module.evaluations.length;
        completedItems += done;
        totalItems += total;
        if (!continueModuleId && (total === 0 || done < total))
          continueModuleId = module.id;
        module.sessions
          .filter((s) => s.date >= now)
          .forEach((s) =>
            classes.push({
              id: s.id,
              title: s.title,
              date: s.date,
              meetLink: s.meetLink,
              cohortId: cohort.id,
              courseName: cohort.course.name,
            }),
          );
        module.evaluations
          .filter(
            (e) =>
              e.deliverables.length === 0 && (!e.dueDate || e.dueDate >= now),
          )
          .forEach((e) =>
            pendingEvaluations.push({
              id: e.id,
              title: e.title,
              dueDate: e.dueDate,
              cohortId: cohort.id,
              courseName: cohort.course.name,
            }),
          );
      });
      return {
        cohortId: cohort.id,
        cohortName: cohort.name,
        course: cohort.course,
        status,
        progressPercent: totalItems
          ? Math.round((completedItems / totalItems) * 100)
          : 0,
        completedItems,
        totalItems,
        continueModuleId,
        completionEligible:
          status === 'COMPLETED' ||
          (cohort.endDate <= now &&
            totalItems > 0 &&
            completedItems === totalItems),
        completionCriteria: {
          courseEnded: cohort.endDate <= now,
          allRequiredItemsCompleted:
            totalItems > 0 && completedItems === totalItems,
        },
      };
    });
    classes.sort((a, b) => a.date.getTime() - b.date.getTime());
    pendingEvaluations.sort(
      (a, b) =>
        (a.dueDate?.getTime() || Infinity) - (b.dueDate?.getTime() || Infinity),
    );
    const trimmedPending = pendingEvaluations.slice(0, 5);
    if (!includeEngagement) {
      return {
        courses,
        nextClass: classes[0] || null,
        pendingEvaluations: trimmedPending,
      };
    }
    const engagement = this.buildEngagementSummary(progress, attendance, {
      courses,
      pendingEvaluations: trimmedPending,
    });
    return {
      courses,
      nextClass: classes[0] || null,
      pendingEvaluations: trimmedPending,
      engagement,
    };
  }

  async getStudentEngagement(userId: string) {
    const overview = await this.getLearningOverview(userId, true);
    return overview.engagement!;
  }

  private buildEngagementSummary(
    progress: Array<{ updatedAt: Date }>,
    attendance: Array<{ isPresent: boolean; isExcused: boolean }>,
    overview: {
      courses: Array<{
        cohortId: string;
        status: string;
        progressPercent: number;
      }>;
      pendingEvaluations: Array<{ title: string; cohortId: string }>;
    },
  ) {
    const activeCourses = overview.courses.filter(
      (course) => course.status === 'ACTIVE',
    );
    const completedMaterials = progress.length;
    const completedCourses = overview.courses.filter(
      (course) =>
        course.status === 'COMPLETED' || course.progressPercent === 100,
    ).length;
    const points =
      completedMaterials * 10 +
      completedCourses * 100 +
      attendance.filter((item) => item.isPresent || item.isExcused).length * 5;
    const days = [
      ...new Set(
        progress.map((item) => item.updatedAt.toISOString().slice(0, 10)),
      ),
    ]
      .sort()
      .reverse();
    let streak = 0;
    const cursor = new Date();
    for (const day of days) {
      const expected = cursor.toISOString().slice(0, 10);
      if (day !== expected && streak === 0) {
        cursor.setDate(cursor.getDate() - 1);
        if (day !== cursor.toISOString().slice(0, 10)) break;
      } else if (day !== expected) break;
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    const badges = [
      ...(completedMaterials >= 1
        ? [
            {
              key: 'first-step',
              label: 'Primer paso',
              description: 'Completaste tu primer material',
            },
          ]
        : []),
      ...(completedMaterials >= 5
        ? [
            {
              key: 'consistent',
              label: 'Constante',
              description: 'Completaste 5 materiales',
            },
          ]
        : []),
      ...(completedCourses >= 1
        ? [
            {
              key: 'graduate',
              label: 'Logro académico',
              description: 'Completaste un curso',
            },
          ]
        : []),
      ...(streak >= 3
        ? [
            {
              key: 'streak',
              label: 'Racha de 3 días',
              description: 'Aprendiste durante 3 días seguidos',
            },
          ]
        : []),
    ];
    return {
      points,
      streak,
      badges,
      activeCourses: activeCourses.length,
      nextActivity: overview.pendingEvaluations[0]
        ? {
            type: 'evaluation',
            title: overview.pendingEvaluations[0].title,
            cohortId: overview.pendingEvaluations[0].cohortId,
          }
        : overview.courses.find((course) => course.progressPercent < 100)
          ? {
              type: 'course',
              title: 'Continúa el siguiente material',
              cohortId: overview.courses.find(
                (course) => course.progressPercent < 100,
              )!.cohortId,
            }
          : null,
    };
  }

  async getCalendarEvents(userId: string, role: string) {
    let cohortIds: string[] = [];

    if (role === 'ADMIN') {
      const cohorts = await this.prisma.cohort.findMany({
        where: { isActive: true, deletedAt: null },
        select: { id: true },
      });
      cohortIds = cohorts.map((c) => c.id);
    } else if (role === 'DOCENTE') {
      const cohorts = await this.prisma.cohort.findMany({
        where: { teachers: { some: { id: userId } }, isActive: true },
        select: { id: true },
      });
      cohortIds = cohorts.map((c) => c.id);
    } else {
      // ESTUDIANTE
      const enrollments = await this.prisma.enrollment.findMany({
        where: { userId, status: 'ACTIVE', deletedAt: null },
        select: { cohortId: true },
      });
      cohortIds = enrollments.map((e) => e.cohortId);
    }

    if (cohortIds.length === 0) return [];

    // Obtener sesiones de clase y evaluaciones en paralelo
    const [sessions, evaluations] = await Promise.all([
      this.prisma.classSession.findMany({
        where: {
          module: { cohortId: { in: cohortIds } },
        },
        include: {
          module: {
            include: {
              cohort: { include: { course: { select: { name: true } } } },
            },
          },
        },
      }),
      this.prisma.evaluation.findMany({
        where: {
          cohortId: { in: cohortIds },
          dueDate: { not: null },
          deletedAt: null,
        },
        include: {
          cohort: { include: { course: { select: { name: true } } } },
        },
      }),
    ]);

    const events: CalendarEvent[] = [];

    sessions.forEach((s) => {
      events.push({
        id: s.id,
        type: 'class',
        title: s.title,
        date: s.date,
        courseName: s.module.cohort.course.name,
        cohortName: s.module.cohort.name,
        meetLink: s.meetLink,
      });
    });

    evaluations.forEach((e) => {
      events.push({
        id: e.id,
        type: 'evaluation',
        title: e.title,
        date: e.dueDate,
        courseName: e.cohort.course.name,
        cohortName: e.cohort.name,
        weight: e.weight,
      });
    });

    return events.sort(
      (a, b) =>
        (a.date?.getTime() ?? Number.POSITIVE_INFINITY) -
        (b.date?.getTime() ?? Number.POSITIVE_INFINITY),
    );
  }

  // ── PROGRESO DEL ESTUDIANTE ──

  /**
   * Obtener métricas de progreso de un estudiante en una cohorte.
   */
  async getStudentProgress(userId: string, cohortId: string) {
    await this.assertCohortViewAccess(cohortId, {
      id: userId,
      roles: ['ESTUDIANTE'],
    });
    const [modules, evaluations, attendanceRecords] = await Promise.all([
      // 1. Módulos de la cohorte (materiales, progreso y entregas en una sola consulta)
      this.prisma.syllabusModule.findMany({
        where: { cohortId },
        orderBy: { order: 'asc' },
        select: {
          id: true,
          title: true,
          order: true,
          materials: { include: { progress: { where: { userId } } } },
          evaluations: {
            where: { deletedAt: null },
            include: {
              deliverables: { where: { studentId: userId, deletedAt: null } },
            },
          },
        },
      }),
      // 2. Evaluaciones y calificaciones del estudiante
      this.prisma.evaluation.findMany({
        where: { cohortId, deletedAt: null, isPublished: true },
        include: {
          deliverables: {
            where: { studentId: userId, deletedAt: null },
            include: { grade: true },
          },
        },
      }),
      // 3. Asistencia
      this.prisma.classAttendance.findMany({
        where: { cohortId, studentId: userId },
        orderBy: { date: 'asc' },
        include: {
          session: {
            select: {
              id: true,
              title: true,
              date: true,
              module: { select: { title: true } },
            },
          },
        },
      }),
    ]);

    let totalWeight = 0;
    let weightedScore = 0;
    const grades: StudentGradeSummary[] = [];

    evaluations.forEach((ev) => {
      const deliverable = ev.deliverables[0];
      const grade = deliverable?.grade;
      totalWeight += ev.weight;

      grades.push({
        evaluationId: ev.id,
        title: ev.title,
        weight: ev.weight,
        maxScore: ev.maxScore,
        dueDate: ev.dueDate,
        score:
          grade?.status === 'PUBLISHED' && !grade.deletedAt
            ? grade.score
            : null,
        status:
          grade?.status === 'PUBLISHED' && !grade.deletedAt
            ? 'PUBLISHED'
            : (deliverable?.status ??
              (deliverable ? 'PENDING' : 'NOT_SUBMITTED')),
        feedback:
          grade?.status === 'PUBLISHED' && !grade.deletedAt
            ? grade.feedback
            : null,
      });

      if (grade && grade.status === 'PUBLISHED' && !grade.deletedAt) {
        weightedScore += (grade.score / ev.maxScore) * ev.weight;
      }
    });

    const averageScore =
      totalWeight > 0 ? (weightedScore / totalWeight) * 20 : 0;

    const totalClasses = attendanceRecords.length;
    const presentCount = attendanceRecords.filter((a) => a.isPresent).length;
    const attendanceRate =
      totalClasses > 0 ? (presentCount / totalClasses) * 100 : 100;

    let completedModules = 0;
    modules.forEach((m) => {
      if (m.evaluations.length === 0 && m.materials.length === 0) return;
      const allSubmitted = m.evaluations.every(
        (e) => e.deliverables.length > 0,
      );
      const allMaterialsRead = m.materials.every((material) =>
        Boolean(material.progress[0]?.completedAt),
      );
      if (allSubmitted && allMaterialsRead) completedModules++;
    });

    return {
      modules: modules.length,
      completedModules,
      progressPercent:
        modules.length > 0
          ? Math.round((completedModules / modules.length) * 100)
          : 0,
      averageScore: Math.round(averageScore * 100) / 100,
      grades,
      materialProgress: modules.flatMap((module) =>
        module.materials.map((material) => ({
          materialId: material.id,
          completed: Boolean(material.progress[0]?.completedAt),
        })),
      ),
      attendance: {
        total: totalClasses,
        present: presentCount,
        absent: totalClasses - presentCount,
        rate: Math.round(attendanceRate * 100) / 100,
        records: attendanceRecords.map((a) => ({
          date: a.date,
          sessionId: a.sessionId,
          sessionTitle: a.session?.title ?? null,
          moduleTitle: a.session?.module.title ?? null,
          isPresent: a.isPresent,
          isExcused: a.isExcused,
        })),
      },
    };
  }

  async getTeacherAttention(userId: string, roles: string[] = []) {
    const cohorts = await this.prisma.cohort.findMany({
      where: {
        deletedAt: null,
        ...(roles.includes('ADMIN')
          ? {}
          : { teachers: { some: { id: userId } } }),
      },
      select: {
        id: true,
        name: true,
        course: { select: { name: true } },
        teachers: { select: { id: true } },
        enrollments: {
          where: { deletedAt: null, status: { in: ['ACTIVE', 'COMPLETED'] } },
          select: {
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
      },
    });

    const cohortIds = cohorts.map((cohort) => cohort.id);
    if (cohortIds.length === 0) {
      return {
        lowProgressStudents: [],
        pendingForums: [],
        totals: { lowProgress: 0, pendingForums: 0 },
      };
    }

    const [modules, evaluations, progress, forums] = await Promise.all([
      this.prisma.syllabusModule.findMany({
        where: { cohortId: { in: cohortIds } },
        select: {
          id: true,
          cohortId: true,
          materials: { select: { id: true } },
        },
      }),
      this.prisma.evaluation.findMany({
        where: { cohortId: { in: cohortIds }, deletedAt: null },
        select: {
          id: true,
          title: true,
          cohortId: true,
          deliverables: {
            where: { deletedAt: null },
            select: {
              id: true,
              studentId: true,
              submittedAt: true,
              status: true,
              grade: { select: { score: true } },
            },
          },
        },
      }),
      this.prisma.materialProgress.findMany({
        where: {
          completedAt: { not: null },
          material: { module: { cohortId: { in: cohortIds } } },
        },
        select: { userId: true, materialId: true },
      }),
      this.prisma.forum.findMany({
        where: { cohortId: { in: cohortIds }, isActive: true },
        select: {
          id: true,
          title: true,
          cohortId: true,
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { authorId: true, content: true, createdAt: true },
          },
        },
      }),
    ]);

    const lowProgressStudents = cohorts
      .flatMap((cohort) => {
        const cohortModules = modules.filter(
          (module) => module.cohortId === cohort.id,
        );
        const cohortEvaluations = evaluations.filter(
          (evaluation) => evaluation.cohortId === cohort.id,
        );
        const totalMaterials = cohortModules.reduce(
          (sum, module) => sum + module.materials.length,
          0,
        );
        const cohortStudents = cohort.enrollments.map(
          (enrollment) => enrollment.user,
        );

        return cohortStudents
          .map((student) => {
            const completedMaterials = progress.filter(
              (item) =>
                item.userId === student.id &&
                cohortModules.some((module) =>
                  module.materials.some(
                    (material) => material.id === item.materialId,
                  ),
                ),
            ).length;
            const submittedEvaluations = cohortEvaluations.reduce(
              (sum, evaluation) =>
                sum +
                (evaluation.deliverables.some(
                  (deliverable) => deliverable.studentId === student.id,
                )
                  ? 1
                  : 0),
              0,
            );
            const totalActivities = totalMaterials + cohortEvaluations.length;
            const completedActivities =
              completedMaterials + submittedEvaluations;
            const progressPercent =
              totalActivities > 0
                ? Math.round((completedActivities / totalActivities) * 100)
                : 0;
            return {
              studentId: student.id,
              studentName: `${student.firstName} ${student.lastName}`.trim(),
              email: student.email,
              cohortId: cohort.id,
              cohortName: cohort.name,
              courseName: cohort.course.name,
              progressPercent,
            };
          })
          .filter((student) => student.progressPercent < 50);
      })
      .sort((a, b) => a.progressPercent - b.progressPercent)
      .slice(0, 20);

    const teacherIds = new Set(
      cohorts.flatMap((cohort) => cohort.teachers.map((teacher) => teacher.id)),
    );
    const pendingForums = forums
      .filter((forum) => {
        const lastMessage = forum.messages[0];
        return Boolean(lastMessage && !teacherIds.has(lastMessage.authorId));
      })
      .map((forum) => ({
        id: forum.id,
        title: forum.title,
        cohortId: forum.cohortId,
        cohortName:
          cohorts.find((cohort) => cohort.id === forum.cohortId)?.name ??
          'Cohorte',
        lastMessage: forum.messages[0]?.content ?? '',
        lastActivityAt: forum.messages[0]?.createdAt ?? null,
      }))
      .slice(0, 20);

    const pendingDeliverables = evaluations
      .flatMap((evaluation) => {
        const cohort = cohorts.find((c) => c.id === evaluation.cohortId);
        return evaluation.deliverables
          .filter(
            (deliverable) =>
              deliverable.grade?.score === null ||
              deliverable.grade?.score === undefined,
          )
          .map((deliverable) => ({
            id: deliverable.id,
            studentId: deliverable.studentId,
            submittedAt: deliverable.submittedAt,
            status: deliverable.status,
            score: deliverable.grade?.score ?? null,
            evaluationTitle: evaluation.title,
            cohortId: evaluation.cohortId,
            cohortName: cohort?.name ?? 'Cohorte',
            courseName: cohort?.course.name ?? '',
          }));
      })
      .sort(
        (a, b) =>
          new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
      )
      .slice(0, 8);

    return {
      lowProgressStudents,
      pendingForums,
      pendingDeliverables,
      totals: {
        lowProgress: lowProgressStudents.length,
        pendingForums: pendingForums.length,
      },
    };
  }

  async remindLowProgressStudent(input: {
    teacherId: string;
    studentId: string;
    cohortId: string;
    roles?: string[];
  }) {
    const cohort = await this.prisma.cohort.findFirst({
      where: {
        id: input.cohortId,
        deletedAt: null,
        ...(input.roles?.includes('ADMIN')
          ? {}
          : { teachers: { some: { id: input.teacherId } } }),
        enrollments: {
          some: {
            userId: input.studentId,
            deletedAt: null,
            status: { in: ['ACTIVE', 'COMPLETED'] },
          },
        },
      },
      select: { name: true, course: { select: { name: true } } },
    });
    if (!cohort)
      throw new ForbiddenException(
        'No puedes contactar a este estudiante desde la cohorte indicada',
      );
    if (!this.notifications)
      throw new BadRequestException(
        'El servicio de notificaciones no está disponible',
      );
    await this.notifications.createNotification({
      userId: input.studentId,
      title: 'Tu docente quiere ayudarte a retomar el curso',
      message: `Revisa tu avance en ${cohort.course.name} · ${cohort.name} y continúa con la siguiente actividad. Si necesitas apoyo, responde a tu docente desde el campus.`,
      type: 'academic',
      actionUrl: `/dashboard/my-courses/${input.cohortId}`,
    });
    return { sent: true };
  }
}

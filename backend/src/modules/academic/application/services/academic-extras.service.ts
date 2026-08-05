import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';

@Injectable()
export class AcademicExtrasService {
  constructor(private prisma: PrismaService) {}

  async markAttendance(
    cohortId: string,
    data: { studentId: string; date: string; isPresent: boolean },
  ) {
    const parsedDate = new Date(data.date);
    return this.prisma.classAttendance.upsert({
      where: {
        cohortId_studentId_date: {
          cohortId,
          studentId: data.studentId,
          date: parsedDate,
        },
      },
      update: {
        isPresent: data.isPresent,
      },
      create: {
        cohortId,
        studentId: data.studentId,
        date: parsedDate,
        isPresent: data.isPresent,
      },
    });
  }

  async getCohortStudents(cohortId: string) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        cohortId,
        status: { in: ['ACTIVE', 'COMPLETED', 'PENDING_PAYMENT'] },
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
    return enrollments.map((e: any) => e.user);
  }

  async markAttendanceBulk(
    cohortId: string,
    data: {
      date: string;
      records: Array<{
        studentId: string;
        isPresent: boolean;
        isExcused?: boolean;
        observation?: string;
      }>;
    },
  ) {
    const parsedDate = new Date(data.date);
    const operations = data.records.map((r) =>
      this.prisma.classAttendance.upsert({
        where: {
          cohortId_studentId_date: {
            cohortId,
            studentId: r.studentId,
            date: parsedDate,
          },
        },
        update: {
          isPresent: r.isPresent,
          isExcused: r.isExcused || false,
          observation: r.observation || null,
        },
        create: {
          cohortId,
          studentId: r.studentId,
          date: parsedDate,
          isPresent: r.isPresent,
          isExcused: r.isExcused || false,
          observation: r.observation || null,
        },
      }),
    );
    return this.prisma.$transaction(operations);
  }

  async getAttendance(cohortId: string, date: string) {
    const parsedDate = new Date(date);
    return this.prisma.classAttendance.findMany({
      where: {
        cohortId,
        date: parsedDate,
      },
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  async getCohortGradesSummary(cohortId: string) {
    // 1. Estudiantes matriculados
    const students = await this.getCohortStudents(cohortId);

    // 2. Evaluaciones de la cohorte
    const evaluations = await this.prisma.evaluation.findMany({
      where: { cohortId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });

    // 3. Entregas y notas
    const deliverables = await this.prisma.deliverable.findMany({
      where: { evaluation: { cohortId }, deletedAt: null },
      include: { grade: true },
    });

    // 4. Asistencia acumulada por estudiante
    const attendances = await this.prisma.classAttendance.findMany({
      where: { cohortId },
    });

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

  async evaluateTeacher(
    cohortId: string,
    studentId: string,
    data: { teacherId?: string; score: number; comment?: string },
  ) {
    let targetTeacherId = data.teacherId;

    if (!targetTeacherId) {
      const cohort = await this.prisma.cohort.findUnique({
        where: { id: cohortId },
        include: { teachers: true },
      });
      targetTeacherId = cohort?.teachers?.[0]?.id;
    }

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
        status: 'ACTIVE',
        deletedAt: null,
      },
      include: {
        cohort: {
          include: {
            course: true,
            teachers: true,
          },
        },
      },
    });

    // Retornar las cohortes mapeadas
    return enrollments.map((e) => e.cohort);
  }

  // ── CALENDARIO ACADÉMICO ──

  /**
   * Obtener eventos del calendario para el usuario autenticado.
   * Consolida sesiones de clase y evaluaciones con fecha de entrega.
   */
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

    // Obtener sesiones de clase
    const sessions = await this.prisma.classSession.findMany({
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
    });

    // Obtener evaluaciones con fecha de entrega
    const evaluations = await this.prisma.evaluation.findMany({
      where: {
        cohortId: { in: cohortIds },
        dueDate: { not: null },
        deletedAt: null,
      },
      include: {
        cohort: { include: { course: { select: { name: true } } } },
      },
    });

    const events: any[] = [];

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
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
  }

  // ── PROGRESO DEL ESTUDIANTE ──

  /**
   * Obtener métricas de progreso de un estudiante en una cohorte.
   */
  async getStudentProgress(userId: string, cohortId: string) {
    // 1. Módulos de la cohorte
    const modules = await this.prisma.syllabusModule.findMany({
      where: { cohortId },
      orderBy: { order: 'asc' },
      select: { id: true, title: true, order: true },
    });

    // 2. Evaluaciones y calificaciones del estudiante
    const evaluations = await this.prisma.evaluation.findMany({
      where: { cohortId, deletedAt: null },
      include: {
        deliverables: {
          where: { studentId: userId, deletedAt: null },
          include: { grade: true },
        },
      },
    });

    let totalWeight = 0;
    let weightedScore = 0;
    let gradedCount = 0;
    const grades: any[] = [];

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
        score: grade?.score ?? null,
        status: grade?.status ?? (deliverable ? 'PENDING' : 'NOT_SUBMITTED'),
        feedback: grade?.feedback ?? null,
      });

      if (grade && grade.status === 'PUBLISHED') {
        weightedScore += (grade.score / ev.maxScore) * ev.weight;
        gradedCount++;
      }
    });

    const averageScore =
      totalWeight > 0 ? (weightedScore / totalWeight) * 20 : 0;

    // 3. Asistencia
    const attendanceRecords = await this.prisma.classAttendance.findMany({
      where: { cohortId, studentId: userId },
      orderBy: { date: 'asc' },
    });

    const totalClasses = attendanceRecords.length;
    const presentCount = attendanceRecords.filter((a) => a.isPresent).length;
    const attendanceRate =
      totalClasses > 0 ? (presentCount / totalClasses) * 100 : 100;

    // 4. Módulos completados (un módulo se completa si todas sus evaluaciones tienen entrega)
    const modulesWithEvals = await this.prisma.syllabusModule.findMany({
      where: { cohortId },
      include: {
        evaluations: {
          where: { deletedAt: null },
          include: {
            deliverables: { where: { studentId: userId, deletedAt: null } },
          },
        },
      },
    });

    let completedModules = 0;
    modulesWithEvals.forEach((m) => {
      if (m.evaluations.length === 0) return;
      const allSubmitted = m.evaluations.every(
        (e) => e.deliverables.length > 0,
      );
      if (allSubmitted) completedModules++;
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
      attendance: {
        total: totalClasses,
        present: presentCount,
        absent: totalClasses - presentCount,
        rate: Math.round(attendanceRate * 100) / 100,
        records: attendanceRecords.map((a) => ({
          date: a.date,
          isPresent: a.isPresent,
          isExcused: a.isExcused,
        })),
      },
    };
  }
}

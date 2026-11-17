import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { isDeepStrictEqual } from 'node:util';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { StorageService } from '../../../../shared/infrastructure/storage/storage.service';
import { AcademicExtrasService } from '../../../academic/application/services/academic-extras.service';
import {
  ClassroomEvaluationDto,
  ClassroomGradeDto,
  ClassroomPostDto,
  ClassroomSubmissionDto,
  QuestionDto,
} from '../dtos/classroom.dto';

type User = { id: string; roles?: string[] };
const person = { id: true, firstName: true, lastName: true } as const;
const json = (value: unknown) =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
export function validateQuestions(questions: QuestionDto[]) {
  if (!questions.length || questions.length > 100)
    throw new BadRequestException('Agrega entre 1 y 100 preguntas');
  for (const q of questions) {
    if (
      !q.prompt.trim() ||
      q.options.length < 2 ||
      q.options.length > 8 ||
      q.options.some((option) => !option.trim()) ||
      q.correctIndex >= q.options.length ||
      q.correctIndex < 0 ||
      !Number.isInteger(q.correctIndex) ||
      !Number.isFinite(q.points) ||
      q.points <= 0
    )
      throw new BadRequestException(
        'Revisa las opciones, respuesta correcta y puntos de cada pregunta',
      );
  }
}
export function quizScore(
  questions: QuestionDto[],
  answers: number[],
  maxScore: number,
) {
  const total = questions.reduce((sum, q) => sum + q.points, 0);
  const earned = questions.reduce(
    (sum, q, i) => sum + (answers[i] === q.correctIndex ? q.points : 0),
    0,
  );
  return Math.round((earned / total) * maxScore * 100) / 100;
}

@Injectable()
export class ClassroomService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AcademicExtrasService,
    private readonly storage: StorageService,
  ) {}

  private isManager(user: User) {
    return (
      user.roles?.some((role) => ['ADMIN', 'DOCENTE'].includes(role)) ?? false
    );
  }

  private async lock(
    tx: Prisma.TransactionClient,
    evaluationId: string,
    studentId?: string,
  ) {
    const key = `classroom:${evaluationId}`;
    if (studentId) {
      // Students proceed independently; content edits still wait for all active work.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(hashtext(${key}))`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${key}:${studentId}`}))`;
    } else {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
    }
  }

  private async evaluation(id: string, user: User, manage = false) {
    const evaluation = await this.prisma.evaluation.findFirst({
      where: { id, deletedAt: null },
    });
    if (!evaluation) throw new NotFoundException('Actividad no encontrada');
    if (manage)
      await this.access.assertCohortManagerAccess(evaluation.cohortId, user);
    else {
      await this.access.assertCohortViewAccess(evaluation.cohortId, user);
      if (!this.isManager(user) && !evaluation.isPublished)
        throw new NotFoundException('Actividad no publicada');
    }
    return evaluation;
  }

  private async studentEvaluation(id: string, user: User) {
    if (!user.roles?.includes('ESTUDIANTE'))
      throw new ForbiddenException('Esta acción corresponde al estudiante');
    const evaluation = await this.evaluation(id, user);
    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        cohortId: evaluation.cohortId,
        userId: user.id,
        status: 'ACTIVE',
        deletedAt: null,
      },
    });
    if (!enrollment)
      throw new ForbiddenException('Necesitas una matrícula activa');
    return evaluation;
  }

  async list(cohortId: string, user: User) {
    await this.access.assertCohortViewAccess(cohortId, user);
    const manager = this.isManager(user);
    const evaluations = await this.prisma.evaluation.findMany({
      where: {
        cohortId,
        deletedAt: null,
        ...(!manager ? { isPublished: true } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        deliverables: {
          where: {
            deletedAt: null,
            ...(!manager ? { studentId: user.id } : {}),
          },
          include: {
            student: { select: person },
            grade: true,
            revisions: { orderBy: { archivedAt: 'desc' } },
          },
        },
        quizAttempts: {
          where: manager ? {} : { studentId: user.id },
          orderBy: { number: 'asc' },
          select: {
            id: true,
            studentId: true,
            number: true,
            score: true,
            startedAt: true,
            expiresAt: true,
            submittedAt: true,
          },
        },
      },
    });
    return evaluations.map(({ quiz, ...evaluation }) => ({
      ...evaluation,
      questions: manager ? quiz : undefined,
      questionCount: Array.isArray(quiz) ? quiz.length : 0,
      deliverables: evaluation.deliverables.map((d) => ({
        ...d,
        returnFeedback: d.status === 'RETURNED' ? d.grade?.feedback : null,
        grade:
          !d.grade?.deletedAt && (manager || d.grade?.status === 'PUBLISHED')
            ? d.grade
            : null,
        revisions: d.revisions.map((r) => ({
          ...r,
          gradeSnapshot: manager
            ? r.gradeSnapshot
            : this.visibleGrade(r.gradeSnapshot),
        })),
      })),
    }));
  }

  private visibleGrade(value: Prisma.JsonValue | null) {
    return value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      value.status === 'PUBLISHED'
      ? value
      : null;
  }

  async saveEvaluation(
    cohortId: string,
    dto: ClassroomEvaluationDto,
    user: User,
    id?: string,
  ) {
    await this.access.assertCohortManagerAccess(cohortId, user);
    if (!dto.title.trim()) throw new BadRequestException('Escribe el título');
    if (
      dto.moduleId &&
      !(await this.prisma.syllabusModule.count({
        where: { id: dto.moduleId, cohortId },
      }))
    )
      throw new BadRequestException('El módulo no pertenece al curso');
    if (dto.kind === 'QUIZ') validateQuestions(dto.questions || []);
    const rubric = dto.rubric || [];
    if (
      rubric.some((c) => !c.title.trim()) ||
      (rubric.length &&
        Math.abs(rubric.reduce((sum, c) => sum + c.points, 0) - dto.maxScore) >
          0.001)
    )
      throw new BadRequestException(
        'La suma de la rúbrica debe coincidir con la nota máxima',
      );
    const existing = id ? await this.evaluation(id, user, true) : null;
    if (existing && existing.cohortId !== cohortId)
      throw new BadRequestException('Actividad de otro curso');
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, id || cohortId);
      if (
        existing &&
        ((await tx.deliverable.count({ where: { evaluationId: id } })) ||
          (await tx.quizAttempt.count({ where: { evaluationId: id } })))
      ) {
        if (
          dto.kind !== existing.kind ||
          dto.maxScore !== existing.maxScore ||
          !isDeepStrictEqual(json(dto.questions || []), existing.quiz || []) ||
          !isDeepStrictEqual(json(rubric), existing.rubric || [])
        )
          throw new ConflictException(
            'Con entregas o intentos registrados, conserva el tipo, preguntas, rúbrica y nota máxima. Puedes cambiar título, plazo o publicación.',
          );
      }
      const data = {
        cohortId,
        moduleId: dto.moduleId || null,
        title: dto.title.trim(),
        description: dto.description || null,
        kind: dto.kind,
        weight: dto.weight,
        maxScore: dto.maxScore,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        isPublished: dto.isPublished,
        allowLate: dto.allowLate ?? true,
        allowResubmit: dto.allowResubmit ?? true,
        rubric: json(rubric),
        quiz: json(dto.kind === 'QUIZ' ? dto.questions : []),
        maxAttempts: dto.maxAttempts ?? 1,
        timeLimitMinutes: dto.timeLimitMinutes ?? 30,
      };
      return id
        ? tx.evaluation.update({ where: { id }, data })
        : tx.evaluation.create({ data });
    });
  }

  async removeEvaluation(id: string, user: User) {
    await this.evaluation(id, user, true);
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, id);
      return tx.evaluation.update({
        where: { id },
        data: { isPublished: false, deletedAt: new Date() },
      });
    });
  }

  async legacyUpdate(
    id: string,
    changes: {
      title?: string;
      description?: string;
      weight?: number;
      maxScore?: number;
      dueDate?: Date;
      isPublished?: boolean;
    },
    user: User,
  ) {
    const current = await this.evaluation(id, user, true);
    return this.saveEvaluation(
      current.cohortId,
      {
        ...current,
        ...changes,
        kind: current.kind as 'ASSIGNMENT' | 'QUIZ',
        moduleId: current.moduleId || undefined,
        description: changes.description ?? current.description ?? undefined,
        dueDate:
          changes.dueDate?.toISOString() ?? current.dueDate?.toISOString(),
        rubric: (current.rubric ||
          []) as unknown as ClassroomEvaluationDto['rubric'],
        questions: (current.quiz || []) as unknown as QuestionDto[],
      },
      user,
      id,
    );
  }

  async posts(cohortId: string, user: User) {
    await this.access.assertCohortViewAccess(cohortId, user);
    return this.prisma.classroomPost.findMany({
      where: {
        cohortId,
        deletedAt: null,
        ...(!this.isManager(user) ? { publishedAt: { lte: new Date() } } : {}),
      },
      include: { author: { select: person } },
      orderBy: [{ pinned: 'desc' }, { publishedAt: 'desc' }],
      take: 100,
    });
  }

  async savePost(
    cohortId: string,
    dto: ClassroomPostDto,
    user: User,
    id?: string,
  ) {
    await this.access.assertCohortManagerAccess(cohortId, user);
    if (!dto.title.trim() || !dto.content.trim())
      throw new BadRequestException('Completa el título y el mensaje');
    if (
      id &&
      !(await this.prisma.classroomPost.count({
        where: { id, cohortId, deletedAt: null },
      }))
    )
      throw new NotFoundException('Anuncio no encontrado');
    const data = {
      title: dto.title.trim(),
      content: dto.content.trim(),
      pinned: dto.pinned ?? false,
      publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : new Date(),
    };
    return id
      ? this.prisma.classroomPost.update({ where: { id }, data })
      : this.prisma.classroomPost.create({
          data: { ...data, cohortId, authorId: user.id },
        });
  }

  async removePost(id: string, user: User) {
    const post = await this.prisma.classroomPost.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('Anuncio no encontrado');
    await this.access.assertCohortManagerAccess(post.cohortId, user);
    return this.prisma.classroomPost.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async questions(cohortId: string, user: User) {
    await this.access.assertCohortManagerAccess(cohortId, user);
    return this.prisma.classroomQuestion.findMany({
      where: { cohortId },
      orderBy: { createdAt: 'desc' },
    });
  }
  async saveQuestion(cohortId: string, dto: QuestionDto, user: User) {
    await this.access.assertCohortManagerAccess(cohortId, user);
    validateQuestions([dto]);
    return this.prisma.classroomQuestion.create({
      data: {
        cohortId,
        prompt: dto.prompt,
        options: json(dto.options),
        correctIndex: dto.correctIndex,
        points: dto.points,
      },
    });
  }
  async removeQuestion(id: string, user: User) {
    const q = await this.prisma.classroomQuestion.findUnique({ where: { id } });
    if (!q) throw new NotFoundException('Pregunta no encontrada');
    await this.access.assertCohortManagerAccess(q.cohortId, user);
    return this.prisma.classroomQuestion.delete({ where: { id } });
  }

  async submit(
    id: string,
    dto: ClassroomSubmissionDto,
    user: User,
    file?: Express.Multer.File,
  ) {
    const evaluation = await this.studentEvaluation(id, user);
    if (evaluation.kind !== 'ASSIGNMENT')
      throw new BadRequestException('Usa los intentos del cuestionario');
    if (
      evaluation.dueDate &&
      evaluation.dueDate < new Date() &&
      !evaluation.allowLate
    )
      throw new BadRequestException('La fecha límite ha vencido');
    if (!file) {
      try {
        const url = new URL(dto.fileUrl);
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
      } catch {
        throw new BadRequestException(
          'Adjunta un archivo o una URL http/https válida',
        );
      }
    }
    const fileUrl = file
      ? await this.storage.uploadFile(file, 'deliverables')
      : dto.fileUrl;
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, id, user.id);
      const evaluation = await tx.evaluation.findUniqueOrThrow({
        where: { id },
      });
      if (evaluation.deletedAt || !evaluation.isPublished)
        throw new NotFoundException('Actividad no publicada');
      if (evaluation.kind !== 'ASSIGNMENT')
        throw new BadRequestException('Usa los intentos del cuestionario');
      if (
        evaluation.dueDate &&
        evaluation.dueDate < new Date() &&
        !evaluation.allowLate
      )
        throw new BadRequestException('La fecha límite ha vencido');
      const existing = await tx.deliverable.findUnique({
        where: {
          evaluationId_studentId: { evaluationId: id, studentId: user.id },
        },
        include: { grade: true },
      });
      if (
        existing &&
        existing.status !== 'RETURNED' &&
        (!evaluation.allowResubmit || existing.grade?.status === 'PUBLISHED')
      )
        throw new ConflictException(
          'El docente debe devolver la tarea para permitir otra entrega',
        );
      if (existing) {
        await tx.submissionRevision.create({
          data: {
            deliverableId: existing.id,
            fileUrl: existing.fileUrl,
            fileName: existing.fileName,
            comment: existing.comment,
            status: existing.status,
            submittedAt: existing.submittedAt,
            gradeSnapshot: existing.grade
              ? json(existing.grade)
              : Prisma.JsonNull,
          },
        });
        if (existing.grade)
          await tx.grade.update({
            where: { id: existing.grade.id },
            data: { status: 'DRAFT', deletedAt: new Date() },
          });
      }
      const data = {
        fileUrl,
        fileName: file?.originalname || dto.fileName || 'Entrega por enlace',
        comment: dto.comment || null,
        status:
          evaluation.dueDate && evaluation.dueDate < new Date()
            ? ('LATE' as const)
            : ('PENDING' as const),
        submittedAt: new Date(),
        deletedAt: null,
      };
      return existing
        ? tx.deliverable.update({ where: { id: existing.id }, data })
        : tx.deliverable.create({
            data: { ...data, evaluationId: id, studentId: user.id },
          });
    });
  }

  async grade(id: string, dto: ClassroomGradeDto, user: User) {
    const delivery = await this.prisma.deliverable.findFirst({
      where: { id, deletedAt: null },
      include: { evaluation: true },
    });
    if (!delivery) throw new NotFoundException('Entrega no encontrada');
    await this.access.assertCohortManagerAccess(
      delivery.evaluation.cohortId,
      user,
    );
    if (delivery.evaluation.kind === 'QUIZ')
      throw new BadRequestException(
        'Los cuestionarios se califican automáticamente',
      );
    if (dto.score > delivery.evaluation.maxScore)
      throw new BadRequestException('La nota supera el máximo');
    const rubric = (delivery.evaluation.rubric || []) as {
      title: string;
      points: number;
    }[];
    let score = dto.score;
    if (rubric.length) {
      if (
        !dto.rubricScores ||
        dto.rubricScores.length !== rubric.length ||
        dto.rubricScores.some(
          (s, i) => !Number.isFinite(s) || s < 0 || s > rubric[i].points,
        )
      )
        throw new BadRequestException('Completa cada criterio de la rúbrica');
      score =
        Math.round(dto.rubricScores.reduce((sum, s) => sum + s, 0) * 100) / 100;
    }
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, delivery.evaluationId, delivery.studentId);
      const current = await tx.deliverable.findUniqueOrThrow({ where: { id } });
      if (current.status === 'RETURNED')
        throw new ConflictException('Espera el reenvío del estudiante');
      const data = {
        score,
        feedback: dto.feedback || null,
        status: dto.draft ? ('DRAFT' as const) : ('PUBLISHED' as const),
        graderId: user.id,
        gradedAt: new Date(),
        deletedAt: null,
        rubricScores: dto.rubricScores
          ? json(dto.rubricScores)
          : Prisma.JsonNull,
      };
      const grade = await tx.grade.upsert({
        where: { deliverableId: id },
        create: { ...data, deliverableId: id },
        update: data,
      });
      await tx.deliverable.update({
        where: { id },
        data: { status: dto.draft ? 'PENDING' : 'GRADED' },
      });
      await tx.notification.create({
        data: {
          userId: current.studentId,
          title: dto.draft ? 'Entrega en revisión' : 'Calificación publicada',
          message: delivery.evaluation.title,
          type: 'academic',
          actionUrl: `/dashboard/my-courses/${delivery.evaluation.cohortId}`,
        },
      });
      return grade;
    });
  }

  async returnSubmission(id: string, feedback: string, user: User) {
    const delivery = await this.prisma.deliverable.findFirst({
      where: { id, deletedAt: null },
      include: { evaluation: true },
    });
    if (!delivery) throw new NotFoundException('Entrega no encontrada');
    await this.access.assertCohortManagerAccess(
      delivery.evaluation.cohortId,
      user,
    );
    if (delivery.evaluation.kind !== 'ASSIGNMENT')
      throw new BadRequestException('No se devuelve un cuestionario');
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, delivery.evaluationId, delivery.studentId);
      await tx.grade.upsert({
        where: { deliverableId: id },
        create: {
          deliverableId: id,
          graderId: user.id,
          score: 0,
          feedback,
          status: 'DRAFT',
        },
        update: { feedback, status: 'DRAFT', deletedAt: null },
      });
      await tx.notification.create({
        data: {
          userId: delivery.studentId,
          title: 'Tarea devuelta para corregir',
          message: feedback,
          type: 'academic',
          actionUrl: `/dashboard/my-courses/${delivery.evaluation.cohortId}`,
        },
      });
      return tx.deliverable.update({
        where: { id },
        data: { status: 'RETURNED', comment: delivery.comment },
      });
    });
  }

  async startQuiz(id: string, user: User) {
    const evaluation = await this.studentEvaluation(id, user);
    if (evaluation.kind !== 'QUIZ' || !evaluation.isPublished)
      throw new BadRequestException('Cuestionario no disponible');
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, id, user.id);
      const evaluation = await tx.evaluation.findUniqueOrThrow({
        where: { id },
      });
      if (
        evaluation.deletedAt ||
        !evaluation.isPublished ||
        evaluation.kind !== 'QUIZ'
      )
        throw new NotFoundException('Cuestionario no disponible');
      const attempts = await tx.quizAttempt.findMany({
        where: { evaluationId: id, studentId: user.id },
        orderBy: { number: 'desc' },
      });
      if (attempts[0] && !attempts[0].submittedAt)
        return this.publicAttempt(attempts[0]);
      if (evaluation.dueDate && evaluation.dueDate < new Date())
        throw new BadRequestException('El cuestionario está cerrado');
      if (
        !(await tx.cohort.count({
          where: { id: evaluation.cohortId, teachers: { some: {} } },
        }))
      )
        throw new BadRequestException('El curso necesita un docente asignado');
      if (attempts.length >= evaluation.maxAttempts)
        throw new BadRequestException('Ya usaste todos los intentos');
      const questions = evaluation.quiz as unknown as QuestionDto[];
      validateQuestions(questions);
      const expiresAt = new Date(
        Math.min(
          Date.now() + evaluation.timeLimitMinutes * 60_000,
          evaluation.dueDate?.getTime() ?? Infinity,
        ),
      );
      const attempt = await tx.quizAttempt.create({
        data: {
          evaluationId: id,
          studentId: user.id,
          number: attempts.length + 1,
          questions: json(questions),
          answers: json(questions.map(() => -1)),
          maxScore: evaluation.maxScore,
          expiresAt,
        },
      });
      return this.publicAttempt(attempt);
    });
  }

  private publicAttempt(attempt: {
    id: string;
    questions: Prisma.JsonValue;
    answers: Prisma.JsonValue;
    expiresAt: Date;
    number: number;
    submittedAt: Date | null;
    score: number | null;
  }) {
    const questions = attempt.questions as unknown as QuestionDto[];
    return {
      id: attempt.id,
      number: attempt.number,
      questions: questions.map((q) => ({
        prompt: q.prompt,
        options: q.options,
        points: q.points,
      })),
      answers: attempt.answers,
      expiresAt: attempt.expiresAt,
      submittedAt: attempt.submittedAt,
      score: attempt.score,
      serverTime: new Date(),
    };
  }

  async answerQuiz(
    attemptId: string,
    answers: number[],
    user: User,
    finish = false,
  ) {
    const attempt = await this.prisma.quizAttempt.findUnique({
      where: { id: attemptId },
    });
    if (!attempt || attempt.studentId !== user.id)
      throw new NotFoundException('Intento no encontrado');
    await this.studentEvaluation(attempt.evaluationId, user);
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, attempt.evaluationId, user.id);
      const currentEvaluation = await tx.evaluation.findUniqueOrThrow({
        where: { id: attempt.evaluationId },
      });
      if (currentEvaluation.deletedAt || !currentEvaluation.isPublished)
        throw new NotFoundException('Actividad no publicada');
      const current = await tx.quizAttempt.findUniqueOrThrow({
        where: { id: attemptId },
      });
      if (current.submittedAt) return this.publicAttempt(current);
      const questions = current.questions as unknown as QuestionDto[];
      if (
        answers.length !== questions.length ||
        answers.some(
          (answer, i) =>
            !Number.isInteger(answer) ||
            answer < -1 ||
            answer >= questions[i].options.length,
        )
      )
        throw new BadRequestException('Respuestas inválidas');
      const expired = current.expiresAt <= new Date();
      const savedAnswers = expired ? (current.answers as number[]) : answers;
      if (!finish && !expired)
        return this.publicAttempt(
          await tx.quizAttempt.update({
            where: { id: attemptId },
            data: { answers: json(savedAnswers) },
          }),
        );
      const score = quizScore(questions, savedAnswers, current.maxScore);
      const submitted = await tx.quizAttempt.update({
        where: { id: attemptId },
        data: { answers: json(savedAnswers), score, submittedAt: new Date() },
      });
      const best = await tx.quizAttempt.findFirstOrThrow({
        where: {
          evaluationId: current.evaluationId,
          studentId: user.id,
          submittedAt: { not: null },
        },
        orderBy: { score: 'desc' },
      });
      const delivery = await tx.deliverable.upsert({
        where: {
          evaluationId_studentId: {
            evaluationId: current.evaluationId,
            studentId: user.id,
          },
        },
        create: {
          evaluationId: current.evaluationId,
          studentId: user.id,
          fileUrl: 'quiz://automatic',
          fileName: 'Cuestionario',
          status: 'GRADED',
        },
        update: { status: 'GRADED', deletedAt: null },
      });
      const evaluation = await tx.evaluation.findUniqueOrThrow({
        where: { id: current.evaluationId },
        include: { cohort: { select: { teachers: { select: { id: true } } } } },
      });
      const graderId = evaluation.cohort.teachers[0]?.id;
      if (!graderId)
        throw new BadRequestException(
          'Asigna un docente al curso antes de iniciar evaluaciones',
        );
      await tx.grade.upsert({
        where: { deliverableId: delivery.id },
        create: {
          deliverableId: delivery.id,
          graderId,
          score: best.score!,
          feedback: 'Mejor intento del cuestionario',
          status: 'PUBLISHED',
        },
        update: {
          score: best.score!,
          status: 'PUBLISHED',
          deletedAt: null,
          gradedAt: new Date(),
        },
      });
      return this.publicAttempt(submitted);
    });
  }
}

/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AcademicController } from './academic.controller';

describe('AcademicController', () => {
  const manageCourse = {
    createCourse: jest.fn(),
    getAllCourses: jest.fn(),
    getPublicCourses: jest.fn(),
    updateCourse: jest.fn(),
    getTrashCourses: jest.fn(),
    restoreCourse: jest.fn(),
    deleteCourse: jest.fn(),
  };
  const manageCohort = {
    createCohort: jest.fn(),
    getTrashCohorts: jest.fn(),
    restoreCohort: jest.fn(),
    getCohortsForTeacher: jest.fn(),
    getAllCohorts: jest.fn(),
    getCohortById: jest.fn(),
    updateCohort: jest.fn(),
    deleteCohort: jest.fn(),
  };
  const enrollStudent = { execute: jest.fn() };
  const extras = {
    duplicateCohort: jest.fn(),
    assertCohortViewAccess: jest.fn(),
    getMyActiveCohorts: jest.fn(),
    getTeacherAttention: jest.fn(),
    remindLowProgressStudent: jest.fn(),
    getCohortStudents: jest.fn(),
    markAttendance: jest.fn(),
    markAttendanceBulk: jest.fn(),
    getAttendance: jest.fn(),
    getCohortGradesSummary: jest.fn(),
    importGrades: jest.fn(),
    evaluateTeacher: jest.fn(),
    getCalendarEvents: jest.fn(),
    getStudentProgress: jest.fn(),
    getLearningOverview: jest.fn(),
    getStudentEngagement: jest.fn(),
    setMaterialProgress: jest.fn(),
  };
  const metrics = {
    getDashboardMetrics: jest.fn(),
    getDataQualitySummary: jest.fn(),
    getStudentsExportData: jest.fn(),
    getEnrollmentsPage: jest.fn(),
    getPublicStats: jest.fn(),
  };
  const syllabus = { addMaterial: jest.fn() };
  const storage = { uploadFile: jest.fn() };
  const prisma = {
    cohortFavorite: {
      findMany: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    cohort: { findFirst: jest.fn() },
    teacherEvaluation: { findMany: jest.fn(), update: jest.fn() },
  };
  let controller: AcademicController;

  beforeEach(() => {
    jest.resetAllMocks();
    controller = new AcademicController(
      manageCourse as never,
      manageCohort as never,
      enrollStudent as never,
      extras as never,
      metrics as never,
      syllabus as never,
      storage as never,
      prisma as never,
    );
  });

  it('gestiona favoritos, métricas, cursos públicos y testimonios', async () => {
    prisma.cohortFavorite.findMany.mockResolvedValue([
      { cohortId: 'cohort-1' },
    ]);
    prisma.cohortFavorite.upsert.mockResolvedValue({ cohortId: 'cohort-1' });
    prisma.cohortFavorite.deleteMany.mockResolvedValue({ count: 1 });
    prisma.cohort.findFirst.mockResolvedValue({ id: 'cohort-1' });
    await expect(controller.getFavorites({ id: 'student-1' })).resolves.toEqual(
      [{ cohortId: 'cohort-1' }],
    );
    await expect(
      controller.addFavorite('cohort-1', { id: 'student-1' }),
    ).resolves.toEqual({
      cohortId: 'cohort-1',
    });
    await expect(
      controller.removeFavorite('cohort-1', { id: 'student-1' }),
    ).resolves.toEqual({
      cohortId: 'cohort-1',
      saved: false,
    });
    prisma.cohort.findFirst.mockResolvedValue(null);
    await expect(
      controller.addFavorite('missing', { id: 'student-1' }),
    ).rejects.toBeInstanceOf(NotFoundException);

    metrics.getDashboardMetrics.mockResolvedValue({ total: 1 });
    metrics.getDataQualitySummary.mockResolvedValue({ issues: 0 });
    metrics.getStudentsExportData.mockResolvedValue('csv');
    metrics.getEnrollmentsPage.mockResolvedValue({ data: [] });
    metrics.getPublicStats.mockResolvedValue({ courses: 2 });
    await expect(controller.getDashboardMetrics()).resolves.toEqual({
      total: 1,
    });
    await expect(controller.getDataQuality()).resolves.toEqual({ issues: 0 });
    await expect(controller.exportStudents()).resolves.toBe('csv');
    await expect(
      controller.getEnrollments({ page: 1, limit: 10, search: 'ana' } as never),
    ).resolves.toEqual({ data: [] });
    await expect(controller.getPublicStats()).resolves.toEqual({ courses: 2 });

    const course = {
      id: 'course-1',
      code: 'C1',
      name: 'Curso',
      description: 'Desc',
      promotionalVideoUrl: null,
      whatYouWillLearn: [],
      requirements: [],
      targetAudience: [],
      level: 'BASIC',
      durationHours: 10,
      imageUrl: null,
    };
    manageCourse.getPublicCourses.mockResolvedValue([course]);
    manageCourse.createCourse.mockResolvedValue(course);
    manageCourse.getAllCourses.mockResolvedValue([course]);
    manageCourse.updateCourse.mockResolvedValue({ ...course, name: 'Nuevo' });
    await expect(controller.getPublicCourses()).resolves.toEqual([course]);
    await expect(
      controller.createCourse({ name: 'Curso' } as never),
    ).resolves.toEqual(course);
    await expect(controller.getAllCourses()).resolves.toEqual([course]);
    await expect(
      controller.updateCourse('course-1', { name: 'Nuevo' } as never),
    ).resolves.toEqual({ ...course, name: 'Nuevo' });

    prisma.teacherEvaluation.findMany.mockResolvedValue([
      { score: 5, comment: 'Excelente', cohort: { course: { name: 'Curso' } } },
    ]);
    await expect(controller.getPublicTestimonials('course-1')).resolves.toEqual(
      [
        {
          score: 5,
          comment: 'Excelente',
          programName: 'Curso',
          author: 'Estudiante de la academia',
        },
      ],
    );
    await expect(controller.getTestimonialsForModeration()).resolves.toEqual([
      { score: 5, comment: 'Excelente', cohort: { course: { name: 'Curso' } } },
    ]);
    prisma.teacherEvaluation.update.mockResolvedValue({
      id: 'evaluation-1',
      isPublished: true,
    });
    await expect(
      controller.updateTestimonialPublication('evaluation-1', {
        isPublished: true,
      }),
    ).resolves.toEqual({
      id: 'evaluation-1',
      isPublished: true,
    });
    await expect(
      controller.updateTestimonialPublication('evaluation-1', {}),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('administra cursos y cohortes, incluyendo imágenes y papelera', async () => {
    manageCourse.getTrashCourses.mockResolvedValue([{ id: 'deleted-course' }]);
    manageCohort.getTrashCohorts.mockResolvedValue([{ id: 'deleted-cohort' }]);
    manageCourse.restoreCourse.mockResolvedValue({ id: 'course-1' });
    manageCohort.restoreCohort.mockResolvedValue({ id: 'cohort-1' });
    manageCourse.deleteCourse.mockResolvedValue({ id: 'course-1' });
    manageCohort.deleteCohort.mockResolvedValue({ id: 'cohort-1' });
    manageCohort.createCohort.mockResolvedValue({ id: 'cohort-1' });
    manageCohort.updateCohort.mockResolvedValue({
      id: 'cohort-1',
      name: 'Nuevo',
    });
    await expect(controller.getTrashItems()).resolves.toEqual({
      courses: [{ id: 'deleted-course' }],
      cohorts: [{ id: 'deleted-cohort' }],
    });
    await expect(controller.restoreCourse('course-1')).resolves.toEqual({
      id: 'course-1',
    });
    await expect(controller.restoreCohort('cohort-1')).resolves.toEqual({
      id: 'cohort-1',
    });
    await expect(controller.deleteCourse('course-1')).resolves.toEqual({
      id: 'course-1',
    });
    await expect(controller.deleteCohort('cohort-1')).resolves.toEqual({
      id: 'cohort-1',
    });
    await expect(
      controller.createCohort({ name: 'Cohorte' } as never),
    ).resolves.toEqual({ id: 'cohort-1' });
    await expect(
      controller.updateCohort('cohort-1', { name: 'Nuevo' } as never),
    ).resolves.toEqual({ id: 'cohort-1', name: 'Nuevo' });

    const file = { originalname: 'cover.png' } as Express.Multer.File;
    storage.uploadFile.mockResolvedValue('storage://local/courses/cover.png');
    manageCourse.updateCourse.mockResolvedValue({
      imageUrl: 'storage://local/courses/cover.png',
    });
    manageCohort.updateCohort.mockResolvedValue({
      imageUrl: 'storage://local/cohorts/cover.png',
    });
    await expect(
      controller.uploadCourseImage('course-1', file),
    ).resolves.toEqual({
      message: 'Imagen del curso actualizada',
      imageUrl: 'storage://local/courses/cover.png',
    });
    await expect(
      controller.uploadCohortImage('cohort-1', file),
    ).resolves.toEqual({
      message: 'Imagen de la cohorte actualizada',
      imageUrl: 'storage://local/cohorts/cover.png',
    });
    await expect(
      controller.uploadCourseImage('course-1', undefined as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      controller.uploadCohortImage('cohort-1', undefined as never),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      controller.uploadMaterial(
        { id: 'teacher-1', roles: ['DOCENTE'] },
        undefined as never,
        'module-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      controller.uploadMaterial(
        { id: 'teacher-1', roles: ['DOCENTE'] },
        { originalname: 'material.pdf' } as never,
        '',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    storage.uploadFile.mockResolvedValue('storage://local/materials/file');
    syllabus.addMaterial.mockImplementation((moduleId: string, body: unknown) =>
      Promise.resolve({ moduleId, body }),
    );
    await controller.uploadMaterial(
      { id: 'teacher-1', roles: ['DOCENTE'] },
      { originalname: 'material.pdf' } as never,
      'module-1',
      undefined,
      'PDF',
    );
    await controller.uploadMaterial(
      { id: 'teacher-1', roles: ['DOCENTE'] },
      { originalname: 'recording.mp4' } as never,
      'module-1',
    );
    await controller.uploadMaterial(
      { id: 'teacher-1', roles: ['DOCENTE'] },
      { originalname: 'image.png' } as never,
      'module-1',
    );

    const cohort = {
      id: 'cohort-1',
      courseId: 'course-1',
      name: 'Cohorte',
      modality: 'ONLINE',
      schedule: 'Lunes',
      price: '100.00',
      maxStudents: 20,
      startDate: new Date(Date.now() + 86_400_000),
      endDate: new Date(Date.now() + 10 * 86_400_000),
      isActive: true,
      discountPercentage: 0,
      discountEndsAt: null,
      imageUrl: null,
      enrollmentCount: 1,
      course: {
        id: 'course-1',
        code: 'C1',
        name: 'Curso',
        description: null,
        promotionalVideoUrl: null,
        whatYouWillLearn: [],
        requirements: [],
        targetAudience: [],
        level: 'BASIC',
        durationHours: 10,
        imageUrl: null,
        isAvailable: true,
      },
      teachers: [
        {
          id: 'teacher-1',
          firstName: 'Ana',
          lastName: 'Docente',
          profilePicture: null,
        },
      ],
      isOperational: true,
      hasCapacity: true,
    };
    manageCohort.getAllCohorts.mockResolvedValue([cohort]);
    manageCohort.getCohortsForTeacher.mockResolvedValue([cohort]);
    await expect(
      controller.getAllCohorts({ id: 'teacher-1', roles: ['DOCENTE'] }),
    ).resolves.toEqual([cohort]);
    await expect(
      controller.getAllCohorts({ id: 'admin-1', roles: ['ADMIN'] }),
    ).resolves.toEqual([cohort]);
    await expect(controller.getPublicCohorts()).resolves.toHaveLength(1);
  });

  it('delega operaciones de cohorte, matrículas, asistencia y progreso', async () => {
    const user = { id: 'teacher-1', roles: ['DOCENTE'] };
    const cohort = { id: 'cohort-1' };
    manageCohort.getCohortById.mockResolvedValue(cohort);
    await expect(controller.getCohortById('cohort-1', user)).resolves.toEqual(
      cohort,
    );
    manageCohort.getCohortById.mockResolvedValue(null);
    await expect(
      controller.getCohortById('missing', user),
    ).rejects.toBeInstanceOf(NotFoundException);
    extras.duplicateCohort.mockResolvedValue({ id: 'new-cohort' });
    await expect(
      controller.duplicateCohort(
        'cohort-1',
        { name: 'Nueva', startDate: '2026-01-01', endDate: '2026-02-01' },
        user,
      ),
    ).resolves.toEqual({ id: 'new-cohort' });

    extras.getMyActiveCohorts.mockResolvedValue([cohort]);
    extras.getTeacherAttention.mockResolvedValue({ lowProgressStudents: [] });
    extras.remindLowProgressStudent.mockResolvedValue({ sent: true });
    extras.getCohortStudents.mockResolvedValue([]);
    extras.markAttendance.mockResolvedValue({ id: 'attendance' });
    extras.markAttendanceBulk.mockResolvedValue([]);
    extras.getAttendance.mockResolvedValue([]);
    extras.getCohortGradesSummary.mockResolvedValue({ studentsSummary: [] });
    extras.importGrades.mockResolvedValue({ imported: 1 });
    extras.evaluateTeacher.mockResolvedValue({ id: 'teacher-evaluation' });
    extras.getCalendarEvents.mockResolvedValue([]);
    extras.getStudentProgress.mockResolvedValue({ modules: 1 });
    extras.getLearningOverview.mockResolvedValue({ courses: [] });
    extras.getStudentEngagement.mockResolvedValue({ points: 0 });
    extras.setMaterialProgress.mockResolvedValue({ completedAt: new Date() });
    enrollStudent.execute.mockResolvedValue({ id: 'enrollment-1' });
    await expect(
      controller.getMyCourses({ id: 'student-1' } as never),
    ).resolves.toEqual([cohort]);
    await expect(controller.getTeacherAttention(user)).resolves.toEqual({
      lowProgressStudents: [],
    });
    await expect(
      controller.remindLowProgressStudent(user, {
        studentId: 'student-1',
        cohortId: 'cohort-1',
      }),
    ).resolves.toEqual({ sent: true });
    await expect(
      controller.enrollStudentAdmin({
        studentId: 'student-1',
        cohortId: 'cohort-1',
      }),
    ).resolves.toEqual({ id: 'enrollment-1' });
    await expect(
      controller.getCohortStudents('cohort-1', user),
    ).resolves.toEqual([]);
    await expect(
      controller.markAttendance(user, 'cohort-1', {
        studentId: 'student-1',
        sessionId: 'session-1',
        date: '2026-08-26',
        isPresent: true,
      }),
    ).resolves.toEqual({ id: 'attendance' });
    await expect(
      controller.markAttendanceBulk(user, 'cohort-1', {
        sessionId: 'session-1',
        date: '2026-08-26',
        records: [],
      }),
    ).resolves.toEqual([]);
    await expect(
      controller.getAttendance(user, 'cohort-1', '2026-08-26', 'session-1'),
    ).resolves.toEqual([]);
    await expect(
      controller.getCohortGradesSummary('cohort-1', user),
    ).resolves.toEqual({ studentsSummary: [] });
    await expect(
      controller.importGrades(
        'cohort-1',
        { evaluationId: 'evaluation-1', rows: [] },
        user,
      ),
    ).resolves.toEqual({ imported: 1 });
    await expect(
      controller.importGrades('cohort-1', {} as never, user),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      controller.evaluateTeacher({ id: 'student-1' } as never, 'cohort-1', {
        teacherId: 'teacher-1',
        score: 5,
      }),
    ).resolves.toEqual({ id: 'teacher-evaluation' });
    await expect(
      controller.getCalendarEvents({
        id: 'student-1',
        roles: ['ESTUDIANTE'],
      } as never),
    ).resolves.toEqual([]);
    await expect(
      controller.getMyProgress({ id: 'student-1' } as never, 'cohort-1'),
    ).resolves.toEqual({ modules: 1 });
    await expect(
      controller.getLearningOverview({ id: 'student-1' }),
    ).resolves.toEqual({ courses: [] });
    await expect(
      controller.getStudentEngagement({ id: 'student-1' }),
    ).resolves.toEqual({ points: 0 });
    await expect(
      controller.setMaterialProgress(
        'material-1',
        { completed: true },
        { id: 'student-1' },
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        completedAt: expect.any(Date) as jest.AsymmetricMatcher,
      }),
    );
    await expect(
      controller.setMaterialProgress('material-1', {} as never, {
        id: 'student-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

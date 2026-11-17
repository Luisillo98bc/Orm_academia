import { ManageCohortUseCase } from './manage-cohort.use-case';
import { ManageCourseUseCase } from './manage-course.use-case';

describe('academic management use cases', () => {
  it('delegates all course operations to the repository', async () => {
    const repository = {
      create: jest.fn().mockResolvedValue({ id: 'course-1' }),
      findAll: jest.fn().mockResolvedValue([]),
      findPublic: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({ id: 'course-1' }),
      softDelete: jest.fn().mockResolvedValue(undefined),
      findTrash: jest.fn().mockResolvedValue([]),
      restore: jest.fn().mockResolvedValue({ id: 'course-1' }),
    };
    const useCase = new ManageCourseUseCase(repository as never);
    await useCase.createCourse({ name: 'Course' } as never);
    await useCase.getAllCourses();
    await useCase.getPublicCourses();
    await useCase.updateCourse('course-1', { name: 'Updated' });
    await useCase.deleteCourse('course-1');
    await useCase.getTrashCourses();
    await useCase.restoreCourse('course-1');
    expect(repository.create).toHaveBeenCalled();
    expect(repository.update).toHaveBeenCalledWith('course-1', {
      name: 'Updated',
    });
    expect(repository.softDelete).toHaveBeenCalledWith('course-1');
    expect(repository.restore).toHaveBeenCalledWith('course-1');
  });

  it('delegates all cohort operations to the repository', async () => {
    const repository = {
      create: jest.fn().mockResolvedValue({ id: 'cohort-1' }),
      findAll: jest.fn().mockResolvedValue([]),
      findByTeacherId: jest.fn().mockResolvedValue([]),
      findById: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({ id: 'cohort-1' }),
      softDelete: jest.fn().mockResolvedValue(undefined),
      findTrash: jest.fn().mockResolvedValue([]),
      restore: jest.fn().mockResolvedValue({ id: 'cohort-1' }),
    };
    const useCase = new ManageCohortUseCase(repository);
    await useCase.createCohort({ name: 'Cohort' } as never);
    await useCase.getAllCohorts();
    await useCase.getCohortsForTeacher('teacher-1');
    await useCase.getCohortById('cohort-1');
    await useCase.updateCohort('cohort-1', { name: 'Updated' });
    await useCase.deleteCohort('cohort-1');
    await useCase.getTrashCohorts();
    await useCase.restoreCohort('cohort-1');
    expect(repository.findByTeacherId).toHaveBeenCalledWith('teacher-1');
    expect(repository.update).toHaveBeenCalledWith('cohort-1', {
      name: 'Updated',
    });
    expect(repository.softDelete).toHaveBeenCalledWith('cohort-1');
  });
});

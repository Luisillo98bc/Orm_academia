import { Inject, Injectable } from '@nestjs/common';
import { EVALUATION_REPOSITORY } from '../../domain/repositories/evaluation.repository.interface';
import type { IEvaluationRepository } from '../../domain/repositories/evaluation.repository.interface';
import type { EvaluationEntity } from '../../domain/entities/evaluation.entity';

@Injectable()
export class UpdateEvaluationUseCase {
  constructor(
    @Inject(EVALUATION_REPOSITORY)
    private readonly evaluationRepository: IEvaluationRepository,
  ) {}

  execute(
    id: string,
    data: Partial<
      Pick<
        EvaluationEntity,
        | 'title'
        | 'description'
        | 'weight'
        | 'maxScore'
        | 'dueDate'
        | 'isPublished'
      >
    >,
  ) {
    const updateData = { ...data };
    if (data.title !== undefined) updateData.title = data.title.trim();
    if (data.description !== undefined) {
      updateData.description = data.description?.trim() || null;
    }
    return this.evaluationRepository.update(id, updateData);
  }
}

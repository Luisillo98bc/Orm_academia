import { Inject, Injectable } from '@nestjs/common';
import { EVALUATION_REPOSITORY } from '../../domain/repositories/evaluation.repository.interface';
import type { IEvaluationRepository } from '../../domain/repositories/evaluation.repository.interface';

@Injectable()
export class DeleteEvaluationUseCase {
  constructor(
    @Inject(EVALUATION_REPOSITORY)
    private readonly evaluationRepository: IEvaluationRepository,
  ) {}

  execute(id: string) {
    return this.evaluationRepository.softDelete(id);
  }
}

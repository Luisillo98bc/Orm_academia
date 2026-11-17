// ============================================================================
// EvaluationModule — Módulo de Evaluaciones, Entregas y Calificaciones
//
// Importa AcademicModule para acceder a IEnrollmentRepository.
// Compone los bindings Puerto → Adaptador para todos los repositorios
// y servicios del dominio de evaluaciones.
// ============================================================================

import { Module } from '@nestjs/common';

import { AcademicModule } from '../academic/academic.module';
import { CommunicationModule } from '../communication/communication.module';

// Domain — Puertos
import { EVALUATION_REPOSITORY } from './domain/repositories/evaluation.repository.interface';
import { DELIVERABLE_REPOSITORY } from './domain/repositories/deliverable.repository.interface';
import { GRADE_REPOSITORY } from './domain/repositories/grade.repository.interface';
import { STORAGE_SERVICE } from './domain/services/storage.service.interface';

// Application — Casos de uso
import {
  SubmitDeliverableUseCase,
  GradeDeliverableUseCase,
  CreateEvaluationUseCase,
  GetCohortEvaluationsUseCase,
  UpdateEvaluationUseCase,
  DeleteEvaluationUseCase,
} from './application/use-cases';

// Infrastructure — Implementaciones
import { PrismaEvaluationRepository } from './infrastructure/repositories/prisma-evaluation.repository';
import { PrismaDeliverableRepository } from './infrastructure/repositories/prisma-deliverable.repository';
import { PrismaGradeRepository } from './infrastructure/repositories/prisma-grade.repository';
import { LocalStorageService } from './infrastructure/services/local-storage.service';

// Presentation — Controladores
import { EvaluationController } from './presentation/controllers/evaluation.controller';
import { ClassroomController } from './presentation/controllers/classroom.controller';
import { ClassroomService } from './application/services/classroom.service';

@Module({
  imports: [
    // Importar AcademicModule para acceder a ENROLLMENT_REPOSITORY
    AcademicModule,
    CommunicationModule,
  ],
  controllers: [EvaluationController, ClassroomController],
  providers: [
    ClassroomService,
    // ── Casos de uso ──
    SubmitDeliverableUseCase,
    GradeDeliverableUseCase,
    CreateEvaluationUseCase,
    GetCohortEvaluationsUseCase,
    UpdateEvaluationUseCase,
    DeleteEvaluationUseCase,

    // ── Bindings: Puerto → Adaptador ──
    {
      provide: EVALUATION_REPOSITORY,
      useClass: PrismaEvaluationRepository,
    },
    {
      provide: DELIVERABLE_REPOSITORY,
      useClass: PrismaDeliverableRepository,
    },
    {
      provide: GRADE_REPOSITORY,
      useClass: PrismaGradeRepository,
    },
    {
      provide: STORAGE_SERVICE,
      useClass: LocalStorageService,
    },
  ],
})
export class EvaluationModule {}

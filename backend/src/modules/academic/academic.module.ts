// ============================================================================
// AcademicModule — Módulo de gestión de Cursos, Cohortes y Matrículas
//
// Exporta el binding de IEnrollmentRepository para que otros módulos
// (como EvaluationModule) puedan inyectarlo.
// ============================================================================

import { Module } from '@nestjs/common';

import { ENROLLMENT_REPOSITORY } from './domain/repositories/enrollment.repository.interface';
import { COURSE_REPOSITORY } from './domain/repositories/course.repository.interface';
import { COHORT_REPOSITORY } from './domain/repositories/cohort.repository.interface';
import { PrismaEnrollmentRepository } from './infrastructure/repositories/prisma-enrollment.repository';
import { PrismaCourseRepository } from './infrastructure/repositories/prisma-course.repository';
import { PrismaCohortRepository } from './infrastructure/repositories/prisma-cohort.repository';
import { ManageCourseUseCase } from './application/use-cases/manage-course.use-case';
import { ManageCohortUseCase } from './application/use-cases/manage-cohort.use-case';
import { EnrollStudentUseCase } from './application/use-cases/enroll-student.use-case';
import { AcademicController } from './presentation/controllers/academic.controller';
import { PaymentsController } from './presentation/controllers/payments.controller';
import { SyllabusController } from './presentation/controllers/syllabus.controller';
import { SearchController } from './presentation/controllers/search.controller';
import { ReportsController } from './presentation/controllers/reports.controller';
import { AcademicExtrasService } from './application/services/academic-extras.service';
import { PaymentsService } from './application/services/payments.service';
import { SyllabusService } from './application/services/syllabus.service';
import { SearchService } from './application/services/search.service';
import { ReportsService } from './application/services/reports.service';
import { AcademicMetricsService } from './application/services/academic-metrics.service';
import { ConversionAnalyticsService } from './application/services/conversion-analytics.service';
import { ConversionAnalyticsController } from './presentation/controllers/conversion-analytics.controller';
import { PrismaModule } from '../../shared/infrastructure/prisma/prisma.module';
import { CommunicationModule } from '../communication/communication.module';
import { AcademicReminderSchedulerService } from './academic-reminder-scheduler.service';
import { ContentVersionService } from './application/services/content-version.service';
import { PaymentReconciliationSchedulerService } from './payment-reconciliation-scheduler.service';
import { EnrollmentManagementService } from './application/services/enrollment-management.service';
import { EnrollmentManagementController } from './presentation/controllers/enrollment-management.controller';

import { ProspectsModule } from '../prospects/prospects.module';

@Module({
  imports: [PrismaModule, CommunicationModule, ProspectsModule],
  controllers: [
    EnrollmentManagementController,
    AcademicController,
    PaymentsController,
    SyllabusController,
    SearchController,
    ReportsController,
    ConversionAnalyticsController,
  ],
  providers: [
    EnrollmentManagementService,
    ManageCourseUseCase,
    ManageCohortUseCase,
    EnrollStudentUseCase,
    AcademicExtrasService,
    PaymentsService,
    SyllabusService,
    SearchService,
    ReportsService,
    AcademicMetricsService,
    ConversionAnalyticsService,
    AcademicReminderSchedulerService,
    ContentVersionService,
    PaymentReconciliationSchedulerService,
    // ── Binding: Puerto → Adaptador ──
    {
      provide: ENROLLMENT_REPOSITORY,
      useClass: PrismaEnrollmentRepository,
    },
    {
      provide: COURSE_REPOSITORY,
      useClass: PrismaCourseRepository,
    },
    {
      provide: COHORT_REPOSITORY,
      useClass: PrismaCohortRepository,
    },
  ],
  exports: [
    // Exportar el binding para que otros módulos lo inyecten
    ENROLLMENT_REPOSITORY,
    AcademicExtrasService,
    AcademicReminderSchedulerService,
    PaymentReconciliationSchedulerService,
  ],
})
export class AcademicModule {}

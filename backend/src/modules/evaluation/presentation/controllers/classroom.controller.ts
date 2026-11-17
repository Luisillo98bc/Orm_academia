import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/infrastructure/guards/roles.guard';
import { Roles } from '../../../auth/infrastructure/guards/roles.decorator';
import { CurrentUser } from '../../../auth/infrastructure/strategies/current-user.decorator';
import type { AuthenticatedUser } from '../../../auth/infrastructure/strategies/authenticated-user.type';
import { ClassroomService } from '../../application/services/classroom.service';
import {
  ClassroomEvaluationDto,
  ClassroomGradeDto,
  ClassroomPostDto,
  ClassroomSubmissionDto,
  QuestionDto,
  QuizAnswersDto,
  ReturnSubmissionDto,
} from '../../application/dtos/classroom.dto';
import { materialMulterConfig } from '../../../../shared/infrastructure/multer/multer.config';

@Controller('classroom')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'DOCENTE', 'ESTUDIANTE')
export class ClassroomController {
  constructor(private readonly classroom: ClassroomService) {}

  @Get('cohorts/:id/evaluations')
  list(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.classroom.list(id, user);
  }
  @Post('cohorts/:id/evaluations')
  @Roles('ADMIN', 'DOCENTE')
  create(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ClassroomEvaluationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.classroom.saveEvaluation(id, dto, user);
  }
  @Patch('cohorts/:cohortId/evaluations/:id')
  @Roles('ADMIN', 'DOCENTE')
  update(
    @Param('cohortId', ParseUUIDPipe) cohortId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ClassroomEvaluationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.classroom.saveEvaluation(cohortId, dto, user, id);
  }
  @Delete('evaluations/:id')
  @Roles('ADMIN', 'DOCENTE')
  removeEvaluation(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.classroom.removeEvaluation(id, user);
  }

  @Get('cohorts/:id/posts')
  posts(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.classroom.posts(id, user);
  }
  @Post('cohorts/:id/posts')
  @Roles('ADMIN', 'DOCENTE')
  createPost(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ClassroomPostDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.classroom.savePost(id, dto, user);
  }
  @Patch('cohorts/:cohortId/posts/:id')
  @Roles('ADMIN', 'DOCENTE')
  updatePost(
    @Param('cohortId', ParseUUIDPipe) cohortId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ClassroomPostDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.classroom.savePost(cohortId, dto, user, id);
  }
  @Delete('posts/:id')
  @Roles('ADMIN', 'DOCENTE')
  removePost(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.classroom.removePost(id, user);
  }

  @Get('cohorts/:id/questions')
  @Roles('ADMIN', 'DOCENTE')
  questions(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.classroom.questions(id, user);
  }
  @Post('cohorts/:id/questions')
  @Roles('ADMIN', 'DOCENTE')
  saveQuestion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: QuestionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.classroom.saveQuestion(id, dto, user);
  }
  @Delete('questions/:id')
  @Roles('ADMIN', 'DOCENTE')
  removeQuestion(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.classroom.removeQuestion(id, user);
  }

  @Post('evaluations/:id/submit')
  @Roles('ESTUDIANTE')
  submit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ClassroomSubmissionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.classroom.submit(id, dto, user);
  }
  @Post('evaluations/:id/upload')
  @Roles('ESTUDIANTE')
  @UseInterceptors(FileInterceptor('file', materialMulterConfig))
  upload(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('comment') comment: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) throw new BadRequestException('Adjunta un archivo');
    if (comment && (typeof comment !== 'string' || comment.length > 10000))
      throw new BadRequestException('Comentario demasiado largo');
    return this.classroom.submit(id, { fileUrl: '', comment }, user, file);
  }
  @Post('deliverables/:id/grade')
  @Roles('ADMIN', 'DOCENTE')
  grade(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ClassroomGradeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.classroom.grade(id, dto, user);
  }
  @Post('deliverables/:id/return')
  @Roles('ADMIN', 'DOCENTE')
  returnSubmission(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReturnSubmissionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.classroom.returnSubmission(id, dto.feedback, user);
  }
  @Post('evaluations/:id/attempts')
  @Roles('ESTUDIANTE')
  start(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.classroom.startQuiz(id, user);
  }
  @Patch('attempts/:id')
  @Roles('ESTUDIANTE')
  answers(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: QuizAnswersDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.classroom.answerQuiz(id, dto.answers, user);
  }
  @Post('attempts/:id/finish')
  @Roles('ESTUDIANTE')
  finish(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: QuizAnswersDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.classroom.answerQuiz(id, dto.answers, user, true);
  }
}

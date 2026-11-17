import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class QuestionDto {
  @IsString() @MinLength(1) @MaxLength(4000) prompt: string;
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @MaxLength(1000, { each: true })
  options: string[];
  @IsInt() @Min(0) @Max(7) correctIndex: number;
  @IsNumber() @Min(0.01) @Max(100) points: number;
}
export class RubricCriterionDto {
  @IsString() @MinLength(1) @MaxLength(200) title: string;
  @IsNumber() @Min(0.01) @Max(100) points: number;
}
export class ClassroomEvaluationDto {
  @IsString() @MinLength(1) @MaxLength(300) title: string;
  @IsOptional() @IsString() @MaxLength(20000) description?: string;
  @IsIn(['ASSIGNMENT', 'QUIZ']) kind: 'ASSIGNMENT' | 'QUIZ';
  @IsOptional() @IsUUID() moduleId?: string;
  @IsNumber() @Min(0) @Max(100) weight: number;
  @IsNumber() @Min(1) @Max(100) maxScore: number;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsBoolean() isPublished: boolean;
  @IsOptional() @IsBoolean() allowLate?: boolean;
  @IsOptional() @IsBoolean() allowResubmit?: boolean;
  @IsOptional() @IsInt() @Min(1) @Max(10) maxAttempts?: number;
  @IsOptional() @IsInt() @Min(1) @Max(240) timeLimitMinutes?: number;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => RubricCriterionDto)
  rubric?: RubricCriterionDto[];
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => QuestionDto)
  questions?: QuestionDto[];
}
export class ClassroomPostDto {
  @IsString() @MinLength(1) @MaxLength(200) title: string;
  @IsString() @MinLength(1) @MaxLength(10000) content: string;
  @IsOptional() @IsBoolean() pinned?: boolean;
  @IsOptional() @IsDateString() publishedAt?: string;
}
export class ClassroomSubmissionDto {
  @IsString() @MinLength(1) @MaxLength(1000) fileUrl: string;
  @IsOptional() @IsString() @MaxLength(255) fileName?: string;
  @IsOptional() @IsString() @MaxLength(10000) comment?: string;
}
export class ClassroomGradeDto {
  @IsNumber() @Min(0) @Max(100) score: number;
  @IsOptional() @IsString() @MaxLength(10000) feedback?: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsNumber({}, { each: true })
  rubricScores?: number[];
  @IsOptional() @IsBoolean() draft?: boolean;
}
export class ReturnSubmissionDto {
  @IsString() @MinLength(1) @MaxLength(10000) feedback: string;
}
export class QuizAnswersDto {
  @IsArray()
  @ArrayMaxSize(100)
  @IsInt({ each: true })
  @Min(-1, { each: true })
  @Max(7, { each: true })
  answers: number[];
}

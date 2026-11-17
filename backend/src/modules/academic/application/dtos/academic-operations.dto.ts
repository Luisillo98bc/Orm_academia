import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateTestimonialPublishDto {
  @IsBoolean({ message: 'isPublished debe ser booleano' })
  isPublished?: boolean;
}

export class DuplicateCohortDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  startDate: string;

  @IsString()
  @IsNotEmpty()
  endDate: string;

  @IsOptional()
  @IsString()
  price?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxStudents?: number;
}

export class StudentCohortActionDto {
  @IsUUID()
  @IsNotEmpty()
  studentId: string;

  @IsUUID()
  @IsNotEmpty()
  cohortId: string;
}

export class MarkAttendanceDto {
  @IsUUID()
  @IsNotEmpty()
  studentId: string;

  @IsUUID()
  @IsNotEmpty()
  sessionId: string;

  @IsString()
  @IsNotEmpty()
  date: string;

  @IsBoolean()
  isPresent: boolean;

  @IsOptional()
  @IsBoolean()
  isExcused?: boolean;

  @IsOptional()
  @IsString()
  observation?: string;
}

export class AttendanceRecordItemDto {
  @IsUUID()
  @IsNotEmpty()
  studentId: string;

  @IsBoolean()
  isPresent: boolean;

  @IsOptional()
  @IsBoolean()
  isExcused?: boolean;

  @IsOptional()
  @IsString()
  observation?: string;
}

export class MarkAttendanceBulkDto {
  @IsUUID()
  @IsNotEmpty()
  sessionId: string;

  @IsString()
  @IsNotEmpty()
  date: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttendanceRecordItemDto)
  records: AttendanceRecordItemDto[];
}

export class ImportGradeRowDto {
  @IsString()
  @IsNotEmpty()
  studentEmail: string;

  @Type(() => Number)
  @IsNumber()
  score: number;

  @IsOptional()
  @IsString()
  feedback?: string;
}

export class ImportGradesDto {
  @IsUUID()
  @IsNotEmpty()
  evaluationId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportGradeRowDto)
  rows: ImportGradeRowDto[];
}

export class EvaluateTeacherDto {
  @IsOptional()
  @IsUUID()
  teacherId?: string;

  @Type(() => Number)
  @IsNumber()
  score: number;

  @IsOptional()
  @IsString()
  comment?: string;
}

export class SetMaterialProgressDto {
  @IsBoolean({ message: 'completed debe ser booleano' })
  completed: boolean;
}

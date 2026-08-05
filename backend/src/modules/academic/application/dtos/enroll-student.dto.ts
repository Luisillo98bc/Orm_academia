import { IsNotEmpty, IsUUID } from 'class-validator';

export class EnrollStudentDto {
  @IsUUID()
  @IsNotEmpty()
  cohortId: string;
}

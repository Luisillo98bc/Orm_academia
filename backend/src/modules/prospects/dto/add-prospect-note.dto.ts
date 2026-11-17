import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class AddProspectNoteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  readonly content!: string;
}

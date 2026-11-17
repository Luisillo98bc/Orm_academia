import { IsString, Length } from 'class-validator';

export class RejectContractDto {
  @IsString()
  @Length(5, 500)
  reason: string;
}

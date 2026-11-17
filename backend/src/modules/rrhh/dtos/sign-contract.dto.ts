import { IsString, Length } from 'class-validator';

export class SignContractDto {
  @IsString()
  @Length(3, 200)
  signatureName: string;
}

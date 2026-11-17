import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpsertForumDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  readonly title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  readonly description?: string;
}

export class CreateForumMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  readonly content!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  readonly parentId?: string;
}

export class SendDirectMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  readonly receiverId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  readonly content!: string;
}

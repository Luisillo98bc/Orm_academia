import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class SupportTicketQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  readonly status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  readonly priority?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  readonly search?: string;

  @IsOptional()
  @IsString()
  @MaxLength(12)
  readonly page?: string;
}

export class CreateSupportTicketDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  readonly subject!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  readonly description!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  readonly category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  readonly priority?: string;
}

export class AddSupportMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  readonly body!: string;

  @IsOptional()
  @IsBoolean()
  readonly internalNote?: boolean;
}

export class UpdateSupportTicketDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  readonly status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  readonly priority?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  readonly assigneeId?: string | null;
}

import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  isURL,
  MaxLength,
  MinLength,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { PartialType } from '@nestjs/swagger';

@ValidatorConstraint({ name: 'announcementCtaUrl', async: false })
class AnnouncementCtaUrlConstraint implements ValidatorConstraintInterface {
  validate(value: unknown) {
    if (typeof value !== 'string' || !value.trim()) return false;
    return value.startsWith('/')
      ? /^\/(?!\/)/.test(value)
      : /^https?:\/\//i.test(value) && isURL(value, { require_tld: false });
  }

  defaultMessage() {
    return 'ctaUrl debe ser una ruta interna o una URL válida.';
  }
}

export class CreateAnnouncementDto {
  @IsString() @MinLength(3) @MaxLength(200) title!: string;
  @IsString() @MinLength(3) @MaxLength(5000) content!: string;
  @IsOptional() @IsIn(['ALL', 'STUDENTS', 'TEACHERS']) targetAudience?: string;
  @IsOptional() @IsString() @MaxLength(50) type?: string;
  @IsOptional() @IsUrl({ require_tld: false }) imageUrl?: string;
  @IsOptional() @IsString() @MaxLength(100) ctaText?: string;
  @IsOptional()
  @Validate(AnnouncementCtaUrlConstraint)
  ctaUrl?: string;
  @IsOptional() @IsBoolean() showOnLanding?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsDateString() landingStartsAt?: string | null;
  @IsOptional() @IsDateString() landingEndsAt?: string | null;
}
export class UpdateAnnouncementDto extends PartialType(CreateAnnouncementDto) {}

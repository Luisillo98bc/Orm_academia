import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  academyName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  legalName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  taxId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  tagline?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  faviconUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  primaryColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  whatsappNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  supportEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  salesEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  facebookUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  instagramUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  linkedinUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  youtubeUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  tiktokUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  xUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  heroEyebrow?: string;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  heroTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  heroSubtitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  termsUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  privacyUrl?: string;

  @IsOptional()
  @IsObject()
  certificateTemplate?: Record<string, unknown>;
}

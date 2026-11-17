import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

const CONVERSION_EVENTS = [
  'LANDING_VIEW',
  'PROGRAM_VIEW',
  'WHATSAPP_CLICK',
  'REGISTRATION_STARTED',
  'CHECKOUT_STARTED',
  'PAYMENT_METHOD_SELECTED',
  'CHECKOUT_CREATED',
  'VOUCHER_SUBMITTED',
  'PAYMENT_COMPLETED',
  'CHECKOUT_FAILED',
] as const;

export class TrackConversionDto {
  @IsIn(CONVERSION_EVENTS)
  event!: string;

  @Matches(/^[A-Za-z0-9_-]{8,64}$/)
  sessionId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  path?: string;

  @IsOptional()
  @IsUUID()
  cohortId?: string;

  @IsOptional()
  @IsUUID()
  paymentId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

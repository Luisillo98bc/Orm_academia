import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateCulqiOrderDto {
  @IsString()
  @IsNotEmpty({ message: 'paymentId es requerido' })
  @MaxLength(64)
  readonly paymentId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  readonly phone?: string;
}

export class ChargeTokenDto {
  @IsString()
  @IsNotEmpty({ message: 'paymentId es requerido' })
  @MaxLength(64)
  readonly paymentId!: string;

  @IsString()
  @IsNotEmpty({ message: 'tokenId es requerido' })
  @MaxLength(128)
  readonly tokenId!: string;
}

export class NextInstallmentDto {
  @IsOptional()
  @IsIn(['TARJETA', 'YAPE', 'PLIN', 'EFECTIVO'], {
    message: 'Método de pago inválido',
  })
  readonly method?: 'TARJETA' | 'YAPE' | 'PLIN' | 'EFECTIVO';
}

export class RejectPaymentDto {
  @IsString()
  @IsNotEmpty({ message: 'El motivo de rechazo es obligatorio' })
  @MaxLength(500)
  readonly reason!: string;
}

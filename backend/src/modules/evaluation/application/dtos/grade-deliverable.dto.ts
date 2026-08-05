// ============================================================================
// GradeDeliverableDto — DTO para calificar un entregable
// ============================================================================

import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

/**
 * DTO de validación para la calificación de un entregable.
 *
 * @example
 * {
 *   "deliverableId": "b2c3d4e5-f6a7-8901-bcde-f23456789012",
 *   "score": 17.5,
 *   "feedback": "Excelente implementación de colisiones. El código está bien estructurado. Sugerencia: usar funciones para organizar mejor la lógica del ogro."
 * }
 */
export class GradeDeliverableDto {
  /** UUID del entregable a calificar */
  @IsUUID('4', { message: 'El deliverableId debe ser un UUID v4 válido' })
  @IsNotEmpty({ message: 'El deliverableId es requerido' })
  readonly deliverableId: string;

  /**
   * Nota numérica en escala vigesimal (0–20).
   * @example 17.5
   */
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'La nota debe ser un número con máximo 2 decimales' },
  )
  @Min(0, { message: 'La nota mínima es 0' })
  @Max(20, { message: 'La nota máxima es 20' })
  readonly score: number;

  /**
   * Retroalimentación cualitativa para el estudiante.
   * @example "Excelente implementación de colisiones. Sugerencia: usar funciones para organizar la lógica."
   */
  @IsString({ message: 'El feedback debe ser una cadena de texto' })
  @IsOptional()
  readonly feedback?: string;
}

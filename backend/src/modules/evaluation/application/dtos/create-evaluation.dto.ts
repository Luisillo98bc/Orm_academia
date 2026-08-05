// ============================================================================
// CreateEvaluationDto — DTO para crear una evaluación
// Incluye ejemplos Swagger en los comentarios.
// ============================================================================

import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MaxLength,
  IsDateString,
} from 'class-validator';

/**
 * DTO de validación para la creación de una evaluación.
 *
 * @example
 * {
 *   "cohortId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
 *   "title": "Proyecto Final: Batalla del Caballero y el Ogro",
 *   "description": "Desarrollar un juego en Python usando la librería Turtle donde un caballero lucha contra un ogro. Incluir movimiento, colisiones y puntuación.",
 *   "weight": 30,
 *   "maxScore": 20,
 *   "dueDate": "2026-07-15T23:59:59.000Z",
 *   "isPublished": false
 * }
 */
export class CreateEvaluationDto {
  /** UUID de la cohorte a la que se asigna la evaluación */
  @IsUUID('4', { message: 'El cohortId debe ser un UUID v4 válido' })
  @IsNotEmpty({ message: 'El cohortId es requerido' })
  readonly cohortId: string;

  /**
   * Título descriptivo de la evaluación.
   * @example "Proyecto Final: Batalla del Caballero y el Ogro"
   */
  @IsString({ message: 'El título debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El título es requerido' })
  @MaxLength(300, { message: 'El título no puede exceder 300 caracteres' })
  readonly title: string;

  /**
   * Instrucciones detalladas para el estudiante.
   * @example "Desarrollar un juego en Python con Turtle. Requisitos: 1) Movimiento con flechas, 2) Detección de colisiones, 3) Sistema de puntuación."
   */
  @IsString({ message: 'La descripción debe ser una cadena de texto' })
  @IsOptional()
  readonly description?: string;

  /**
   * Peso porcentual sobre la nota final de la cohorte (0–100).
   * @example 30
   */
  @IsNumber({}, { message: 'El peso debe ser un número' })
  @Min(0, { message: 'El peso mínimo es 0' })
  @Max(100, { message: 'El peso máximo es 100' })
  readonly weight: number;

  /**
   * Nota máxima posible (escala vigesimal por defecto: 0–20).
   * @example 20
   */
  @IsNumber({}, { message: 'La nota máxima debe ser un número' })
  @Min(1, { message: 'La nota máxima mínima es 1' })
  @Max(100, { message: 'La nota máxima no puede exceder 100' })
  @IsOptional()
  readonly maxScore?: number;

  /**
   * Fecha límite de entrega en formato ISO 8601.
   * @example "2026-07-15T23:59:59.000Z"
   */
  @IsDateString(
    {},
    { message: 'La fecha límite debe estar en formato ISO 8601' },
  )
  @IsOptional()
  readonly dueDate?: string;

  /**
   * Indica si la evaluación es visible para los estudiantes.
   * @example false
   */
  @IsBoolean({ message: 'isPublished debe ser un booleano' })
  @IsOptional()
  readonly isPublished?: boolean;
}

// ============================================================================
// SubmitDeliverableDto — DTO para la entrega de un estudiante
// ============================================================================

import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  MaxLength,
} from 'class-validator';

/**
 * DTO de validación para la entrega de un estudiante.
 *
 * @example
 * {
 *   "evaluationId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
 *   "fileUrl": "https://github.com/alumno123/batalla-caballero-ogro",
 *   "fileName": "batalla_caballero_ogro.py",
 *   "comment": "Implementé colisiones con bounding boxes y un sistema de vidas. El ogro se mueve aleatoriamente."
 * }
 */
export class SubmitDeliverableDto {
  /** UUID de la evaluación a la que se entrega */
  @IsUUID('4', { message: 'El evaluationId debe ser un UUID v4 válido' })
  @IsNotEmpty({ message: 'El evaluationId es requerido' })
  readonly evaluationId: string;

  /**
   * URL del repositorio o archivo de código.
   * @example "https://github.com/alumno123/batalla-caballero-ogro"
   */
  @IsUrl({}, { message: 'El fileUrl debe ser una URL válida' })
  @IsNotEmpty({ message: 'El fileUrl es requerido' })
  @MaxLength(1000, { message: 'La URL no puede exceder 1000 caracteres' })
  readonly fileUrl: string;

  /**
   * Nombre original del archivo (opcional si es un enlace a repo).
   * @example "batalla_caballero_ogro.py"
   */
  @IsString({ message: 'El fileName debe ser una cadena de texto' })
  @IsOptional()
  @MaxLength(255, {
    message: 'El nombre del archivo no puede exceder 255 caracteres',
  })
  readonly fileName?: string;

  /**
   * Comentario del estudiante sobre su entrega.
   * @example "Implementé colisiones con bounding boxes y un sistema de vidas."
   */
  @IsString({ message: 'El comentario debe ser una cadena de texto' })
  @IsOptional()
  readonly comment?: string;
}

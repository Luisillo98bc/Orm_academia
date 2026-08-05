// ============================================================================
// LocalStorageService — Implementación simulada de IStorageService
//
// En esta fase simula el almacenamiento de archivos/URLs.
// En producción se reemplazará por S3StorageService, GCSStorageService, etc.
// ============================================================================

import { Injectable, Logger } from '@nestjs/common';
import {
  IStorageService,
  StorageResult,
} from '../../domain/services/storage.service.interface';

/**
 * Implementación simulada del servicio de almacenamiento.
 *
 * Para URLs externas (repos GitHub, enlaces a archivos):
 * - Valida el formato de la URL
 * - Registra la operación en logs
 * - Retorna la misma URL como resultado
 *
 * Para archivos binarios (Buffer):
 * - Simula el upload generando una URL ficticia
 * - En producción se subiría a un bucket de cloud storage
 */
@Injectable()
export class LocalStorageService implements IStorageService {
  private readonly logger = new Logger(LocalStorageService.name);

  async upload(
    fileOrUrl: Buffer | string,
    path: string,
    originalName: string,
  ): Promise<StorageResult> {
    // Si es una URL (string), la validamos y retornamos
    if (typeof fileOrUrl === 'string') {
      this.logger.log(
        `[Storage] Registrando URL externa: ${fileOrUrl} → ${path}/${originalName}`,
      );

      return {
        url: fileOrUrl,
        fileName: originalName,
      };
    }

    // Si es un Buffer, simulamos el upload
    const simulatedUrl = `https://storage.academia.edu/${path}/${Date.now()}_${originalName}`;

    this.logger.log(
      `[Storage] Simulando upload de archivo: ${originalName} (${fileOrUrl.length} bytes) → ${simulatedUrl}`,
    );

    return {
      url: simulatedUrl,
      fileName: originalName,
      size: fileOrUrl.length,
    };
  }

  async isAccessible(url: string): Promise<boolean> {
    // Simulación: siempre accesible en desarrollo
    this.logger.debug(`[Storage] Verificando accesibilidad de: ${url}`);

    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}

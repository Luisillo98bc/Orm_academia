// ============================================================================
// IStorageService — Puerto de Infraestructura para almacenamiento de archivos
//
// Abstracción que permite al dominio trabajar con URLs de archivos
// sin conocer el proveedor de almacenamiento concreto (S3, GCS, local, etc.).
// ============================================================================

/**
 * Resultado de la operación de almacenamiento.
 */
export interface StorageResult {
  /** URL pública o firmada del archivo almacenado */
  readonly url: string;
  /** Nombre del archivo almacenado */
  readonly fileName: string;
  /** Tamaño en bytes */
  readonly size?: number;
}

/**
 * Puerto de infraestructura para el servicio de almacenamiento.
 *
 * En esta fase simula el guardado; en producción se implementará
 * con AWS S3, Google Cloud Storage, o similar.
 */
export interface IStorageService {
  /**
   * Almacena un archivo o enlace y retorna la URL de acceso.
   *
   * @param fileOrUrl - Buffer del archivo o URL del enlace (e.g. repo GitHub)
   * @param path - Ruta de destino dentro del bucket/contenedor
   * @param originalName - Nombre original del archivo
   * @returns StorageResult con la URL y metadata
   */
  upload(
    fileOrUrl: Buffer | string,
    path: string,
    originalName: string,
  ): Promise<StorageResult>;

  /**
   * Verifica si una URL es accesible/válida.
   *
   * @param url - URL a verificar
   * @returns true si la URL es accesible
   */
  isAccessible(url: string): Promise<boolean>;
}

export const STORAGE_SERVICE = Symbol('IStorageService');

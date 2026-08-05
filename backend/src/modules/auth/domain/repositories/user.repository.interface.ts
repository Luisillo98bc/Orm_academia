// ============================================================================
// IUserRepository — Puerto del Dominio
// Interfaz abstracta que define el contrato para la persistencia de usuarios.
// La implementación concreta vive en la capa de infraestructura.
// ============================================================================

import { UserEntity } from '../entities/user.entity';

/**
 * Puerto (interfaz) del repositorio de usuarios.
 *
 * Define las operaciones que la capa de aplicación necesita
 * para interactuar con la persistencia de usuarios, sin acoplarse
 * a ninguna tecnología específica (Prisma, TypeORM, etc.).
 */
export interface IUserRepository {
  /**
   * Busca un usuario por email incluyendo sus roles y permisos.
   * Respeta soft delete (excluye registros con deletedAt != null).
   *
   * @param email - Correo electrónico del usuario
   * @returns La entidad User o null si no existe / está eliminado
   */
  findByEmail(email: string): Promise<UserEntity | null>;

  /**
   * Busca un usuario por ID incluyendo sus roles y permisos.
   * Respeta soft delete.
   *
   * @param id - UUID del usuario
   * @returns La entidad User o null si no existe / está eliminado
   */
  findById(id: string): Promise<UserEntity | null>;

  /**
   * Actualiza la fecha del último login del usuario.
   *
   * @param userId - UUID del usuario
   * @param date - Fecha del login
   */
  updateLastLogin(userId: string, date: Date): Promise<void>;

  /**
   * Crea un nuevo usuario y le asigna el rol indicado.
   *
   * @param data - Datos para la creación del usuario
   * @param roleName - Nombre del rol a asignar por defecto (ej. 'ESTUDIANTE')
   * @returns La entidad User creada
   */
  create(
    data: {
      email: string;
      passwordHash: string;
      firstName: string;
      lastName: string;
      profilePicture?: string | null;
    },
    roleName: string,
  ): Promise<UserEntity>;

  /**
   * Busca usuarios por nombre de rol.
   *
   * @param roleName - Nombre del rol (ej. 'PROFESOR')
   */
  findByRole(roleName: string): Promise<UserEntity[]>;

  /**
   * Lista todos los usuarios.
   */
  findAll(): Promise<UserEntity[]>;

  /**
   * Actualiza los datos de un usuario.
   */
  update(
    id: string,
    data: {
      firstName?: string;
      lastName?: string;
      email?: string;
      profilePicture?: string | null;
      isActive?: boolean;
    },
  ): Promise<UserEntity>;

  /**
   * Soft-delete de un usuario.
   */
  softDelete(id: string): Promise<void>;

  findTrash(): Promise<UserEntity[]>;

  restore(id: string): Promise<UserEntity>;
}

/**
 * Token de inyección de dependencias para el repositorio de usuarios.
 * Se usa como identificador en el contenedor de NestJS.
 */
export const USER_REPOSITORY = Symbol('IUserRepository');

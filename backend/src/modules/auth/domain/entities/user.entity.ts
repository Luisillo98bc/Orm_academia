// ============================================================================
// User Entity — Capa de Dominio
// Entidad de dominio pura, sin dependencias de infraestructura.
// ============================================================================

/**
 * Representa un permiso asociado a un rol del usuario.
 */
export interface UserPermission {
  readonly action: string;
  readonly subject: string;
}

/**
 * Representa un rol asignado al usuario, incluyendo sus permisos.
 */
export interface UserRole {
  readonly id: string;
  readonly name: string;
  readonly permissions: UserPermission[];
}

/**
 * Entidad de dominio User.
 *
 * Contiene la lógica de negocio del usuario independiente de
 * cualquier framework o librería de infraestructura.
 */
export class UserEntity {
  readonly id: string;
  readonly email: string;
  readonly googleSubject: string | null;
  readonly passwordHash: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly profilePicture: string | null;
  readonly dni: string | null;
  readonly phone: string | null;
  readonly address: string | null;
  readonly district: string | null;
  readonly province: string | null;
  readonly department: string | null;
  readonly isActive: boolean;
  readonly emailVerifiedAt: Date | null;
  readonly lastLoginAt: Date | null;
  readonly twoFactorEnabled: boolean;
  readonly twoFactorSecret: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
  readonly roles: UserRole[];

  constructor(props: {
    id: string;
    email: string;
    googleSubject?: string | null;
    passwordHash: string;
    firstName: string;
    lastName: string;
    profilePicture?: string | null;
    dni?: string | null;
    phone?: string | null;
    address?: string | null;
    district?: string | null;
    province?: string | null;
    department?: string | null;
    isActive: boolean;
    emailVerifiedAt?: Date | null;
    lastLoginAt?: Date | null;
    twoFactorEnabled?: boolean;
    twoFactorSecret?: string | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date | null;
    roles?: UserRole[];
  }) {
    this.id = props.id;
    this.email = props.email;
    this.googleSubject = props.googleSubject ?? null;
    this.passwordHash = props.passwordHash;
    this.firstName = props.firstName;
    this.lastName = props.lastName;
    this.profilePicture = props.profilePicture ?? null;
    this.dni = props.dni ?? null;
    this.phone = props.phone ?? null;
    this.address = props.address ?? null;
    this.district = props.district ?? null;
    this.province = props.province ?? null;
    this.department = props.department ?? null;
    this.isActive = props.isActive;
    this.emailVerifiedAt = props.emailVerifiedAt ?? null;
    this.lastLoginAt = props.lastLoginAt ?? null;
    this.twoFactorEnabled = props.twoFactorEnabled ?? false;
    this.twoFactorSecret = props.twoFactorSecret ?? null;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.deletedAt = props.deletedAt ?? null;
    this.roles = props.roles ?? [];
  }

  /** Nombre completo del usuario. */
  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }

  /** Verifica si la cuenta está habilitada para operaciones. */
  get isOperational(): boolean {
    return this.isActive && this.deletedAt === null;
  }

  /**
   * Extrae la lista plana de permisos únicos del usuario
   * a partir de todos sus roles asignados.
   */
  get flatPermissions(): string[] {
    const permSet = new Set<string>();
    for (const role of this.roles) {
      for (const perm of role.permissions) {
        permSet.add(`${perm.subject}:${perm.action}`);
      }
    }
    return Array.from(permSet);
  }
}

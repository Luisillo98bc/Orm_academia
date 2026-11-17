// ============================================================================
// PrismaUserRepository — Implementación concreta del puerto IUserRepository
//
// Capa de Infraestructura: implementa la interfaz del dominio utilizando
// Prisma como ORM. Aplica soft-delete en todas las consultas.
// ============================================================================

import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import {
  normalizePagination,
  paginatedResult,
  type PaginatedResult,
} from '../../../../shared/pagination/pagination';
import { IUserRepository } from '../../domain/repositories/user.repository.interface';
import { UserEntity } from '../../domain/entities/user.entity';

type UserRolePermission = {
  permission: { action: string; subject: string };
};

type UserRoleRecord = {
  role: {
    id: string;
    name: string;
    permissions?: UserRolePermission[];
  };
};

type UserRecord = Prisma.UserGetPayload<Prisma.UserDefaultArgs> & {
  roles?: UserRoleRecord[];
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

/**
 * Implementación de IUserRepository usando Prisma.
 *
 * Todas las queries incluyen el filtro `deletedAt: null` para
 * respetar la estrategia de soft delete definida en la arquitectura.
 */
@Injectable()
export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Busca un usuario por email incluyendo roles y permisos.
   * Excluye usuarios con soft delete (deletedAt != null).
   */
  async findByEmail(email: string): Promise<UserEntity | null> {
    const user = await this.prisma.user.findFirst({
      where: {
        email: normalizeEmail(email),
        deletedAt: null, // 🔒 Soft delete filter
      },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                  // Solo incluir permisos no eliminados
                  where: {
                    permission: { deletedAt: null },
                  },
                },
              },
            },
          },
          // Solo incluir roles no eliminados
          where: {
            role: { deletedAt: null },
          },
        },
      },
    });

    if (!user) return null;

    return this.toDomainEntity(user);
  }

  async findByGoogleSubject(subject: string): Promise<UserEntity | null> {
    const user = await this.prisma.user.findFirst({
      where: { googleSubject: subject, deletedAt: null },
      include: this.userWithPermissionsInclude(),
    });

    return user ? this.toDomainEntity(user) : null;
  }

  async linkGoogleSubject(
    userId: string,
    subject: string,
    profilePicture?: string | null,
  ): Promise<UserEntity> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        googleSubject: subject,
        emailVerifiedAt: new Date(),
        ...(profilePicture ? { profilePicture } : {}),
      },
      include: this.userWithPermissionsInclude(),
    });

    return this.toDomainEntity(user);
  }

  async replaceRoles(userId: string, roleName: string): Promise<UserEntity> {
    const role = await this.prisma.role.findUnique({
      where: { name: roleName },
    });
    if (!role) throw new Error(`Role ${roleName} not found`);

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        roles: {
          deleteMany: {},
          create: { roleId: role.id },
        },
      },
      include: this.userWithPermissionsInclude(),
    });

    return this.toDomainEntity(user);
  }

  /**
   * Busca un usuario por ID incluyendo roles y permisos.
   * Excluye usuarios con soft delete (deletedAt != null).
   */
  async findById(id: string): Promise<UserEntity | null> {
    const user = await this.prisma.user.findFirst({
      where: {
        id,
        deletedAt: null, // 🔒 Soft delete filter
      },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                  where: {
                    permission: { deletedAt: null },
                  },
                },
              },
            },
          },
          where: {
            role: { deletedAt: null },
          },
        },
      },
    });

    if (!user) return null;

    return this.toDomainEntity(user);
  }

  /**
   * Actualiza la fecha del último login del usuario.
   */
  async updateLastLogin(userId: string, date: Date): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: date },
    });
  }

  /**
   * Busca usuarios por rol.
   */
  async findByRole(roleName: string): Promise<UserEntity[]> {
    const users = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        roles: {
          some: {
            role: {
              name: roleName,
            },
          },
        },
      },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return users.map((u) => this.toDomainEntity(u));
  }

  /**
   * Lista todos los usuarios (excluyendo eliminados).
   */
  async findAll(): Promise<UserEntity[]> {
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
      },
    });
    return users.map((u) => this.toDomainEntity(u));
  }

  async findPage(
    roleName: string | undefined,
    page: number,
    limit: number,
    search?: string,
  ): Promise<PaginatedResult<UserEntity>> {
    const pagination = normalizePagination(page, limit);
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(roleName ? { roles: { some: { role: { name: roleName } } } } : {}),
      ...(search?.trim()
        ? {
            OR: ['firstName', 'lastName', 'email', 'dni', 'phone'].map(
              (field) => ({
                [field]: {
                  contains: search.trim(),
                  mode: 'insensitive' as const,
                },
              }),
            ),
          }
        : {}),
    };
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: {
          roles: {
            include: {
              role: {
                include: {
                  permissions: {
                    include: { permission: true },
                  },
                },
              },
            },
          },
        },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }, { id: 'asc' }],
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return paginatedResult(
      users.map((user) => this.toDomainEntity(user)),
      pagination.page,
      pagination.limit,
      total,
    );
  }

  /**
   * Actualiza los datos de un usuario.
   */
  async update(
    id: string,
    data: {
      firstName?: string;
      lastName?: string;
      email?: string;
      profilePicture?: string | null;
      googleSubject?: string | null;
      emailVerifiedAt?: Date | null;
      isActive?: boolean;
      dni?: string | null;
      phone?: string | null;
      address?: string | null;
      district?: string | null;
      province?: string | null;
      department?: string | null;
      passwordHash?: string;
      roles?: string[];
    },
  ): Promise<UserEntity> {
    const { roles, ...updateData } = data;
    const normalizedUpdateData = {
      ...updateData,
      ...(updateData.email ? { email: normalizeEmail(updateData.email) } : {}),
    };
    let rolesConfig: Prisma.UserUpdateInput['roles'];

    if (roles) {
      const requestedRoles = [...new Set(roles)];
      const dbRoles = await this.prisma.role.findMany({
        where: {
          name: { in: requestedRoles },
          isActive: true,
          deletedAt: null,
        },
      });
      if (dbRoles.length !== requestedRoles.length) {
        throw new BadRequestException('Uno o más roles no son válidos');
      }
      rolesConfig = {
        deleteMany: {}, // Clear existing roles mapping
        create: dbRoles.map((r) => ({ roleId: r.id })),
      };
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...normalizedUpdateData,
        ...(data.passwordHash || data.isActive === false || roles
          ? {
              refreshSessions: {
                updateMany: {
                  where: { revokedAt: null },
                  data: { revokedAt: new Date() },
                },
              },
            }
          : {}),
        ...(rolesConfig ? { roles: rolesConfig } : {}),
      },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
      },
    });
    return this.toDomainEntity(user);
  }

  /**
   * Soft-delete de un usuario.
   */
  async softDelete(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  async findTrash(): Promise<UserEntity[]> {
    const users = await this.prisma.user.findMany({
      where: { deletedAt: { not: null } },
      include: {
        roles: {
          include: { role: true },
        },
      },
      orderBy: { deletedAt: 'desc' },
    });
    return users.map((u) => this.toDomainEntity(u));
  }

  async restore(id: string): Promise<UserEntity> {
    const user = await this.prisma.user.update({
      where: { id },
      data: { deletedAt: null, isActive: true },
      include: {
        roles: {
          include: { role: true },
        },
      },
    });
    return this.toDomainEntity(user);
  }

  /**
   * Crea un nuevo usuario y le asigna un rol por defecto.
   */
  async create(
    data: {
      email: string;
      passwordHash: string;
      firstName: string;
      lastName: string;
      profilePicture?: string | null;
      googleSubject?: string | null;
      emailVerifiedAt?: Date | null;
    },
    roleName: string,
  ): Promise<UserEntity> {
    // Buscar el rol
    const role = await this.prisma.role.findUnique({
      where: { name: roleName },
    });

    if (!role) {
      throw new Error(`Role ${roleName} not found`);
    }

    const user = await this.prisma.user.create({
      data: {
        email: normalizeEmail(data.email),
        passwordHash: data.passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        profilePicture: data.profilePicture ?? null,
        googleSubject: data.googleSubject ?? null,
        emailVerifiedAt: data.emailVerifiedAt ?? null,
        isActive: true,
        roles: {
          create: {
            roleId: role.id,
          },
        },
      },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return this.toDomainEntity(user);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Mapper privado: Prisma Model → Domain Entity
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Transforma el resultado crudo de Prisma (con includes anidados)
   * a la entidad de dominio UserEntity.
   *
   * Este mapper es el único punto donde la infraestructura "toca"
   * al dominio — y lo hace mediante el constructor público de la entidad.
   */
  private toDomainEntity(raw: UserRecord): UserEntity {
    return new UserEntity({
      id: raw.id,
      email: raw.email,
      googleSubject: raw.googleSubject,
      passwordHash: raw.passwordHash,
      firstName: raw.firstName,
      lastName: raw.lastName,
      profilePicture: raw.profilePicture,
      dni: raw.dni,
      phone: raw.phone,
      address: raw.address,
      district: raw.district,
      province: raw.province,
      department: raw.department,
      isActive: raw.isActive,
      emailVerifiedAt: raw.emailVerifiedAt,
      lastLoginAt: raw.lastLoginAt,
      twoFactorEnabled: raw.twoFactorEnabled,
      twoFactorSecret: raw.twoFactorSecret,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      deletedAt: raw.deletedAt,
      roles:
        raw.roles?.map((userRole) => ({
          id: userRole.role.id,
          name: userRole.role.name,
          permissions:
            userRole.role.permissions?.map((rolePermission) => ({
              action: rolePermission.permission.action,
              subject: rolePermission.permission.subject,
            })) ?? [],
        })) ?? [],
    });
  }

  private userWithPermissionsInclude() {
    return {
      roles: {
        include: {
          role: {
            include: {
              permissions: { include: { permission: true } },
            },
          },
        },
      },
    } as const;
  }
}

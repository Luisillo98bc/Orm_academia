// ============================================================================
// PrismaUserRepository — Implementación concreta del puerto IUserRepository
//
// Capa de Infraestructura: implementa la interfaz del dominio utilizando
// Prisma como ORM. Aplica soft-delete en todas las consultas.
// ============================================================================

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { IUserRepository } from '../../domain/repositories/user.repository.interface';
import { UserEntity } from '../../domain/entities/user.entity';

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
        email,
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
      isActive?: boolean;
      roles?: string[];
    },
  ): Promise<UserEntity> {
    const updateData: any = { ...data };
    let rolesConfig;

    if (updateData.roles) {
      const dbRoles = await this.prisma.role.findMany({
        where: { name: { in: updateData.roles } },
      });
      rolesConfig = {
        deleteMany: {}, // Clear existing roles mapping
        create: dbRoles.map((r) => ({ roleId: r.id })),
      };
      delete updateData.roles;
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...updateData,
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
        email: data.email,
        passwordHash: data.passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        profilePicture: data.profilePicture ?? null,
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
  private toDomainEntity(raw: any): UserEntity {
    return new UserEntity({
      id: raw.id,
      email: raw.email,
      passwordHash: raw.passwordHash,
      firstName: raw.firstName,
      lastName: raw.lastName,
      profilePicture: raw.profilePicture,
      isActive: raw.isActive,
      emailVerifiedAt: raw.emailVerifiedAt,
      lastLoginAt: raw.lastLoginAt,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      deletedAt: raw.deletedAt,
      roles:
        raw.roles?.map((ur: any) => ({
          id: ur.role.id,
          name: ur.role.name,
          permissions:
            ur.role.permissions?.map((rp: any) => ({
              action: rp.permission.action,
              subject: rp.permission.subject,
            })) ?? [],
        })) ?? [],
    });
  }
}

import { Inject, Injectable } from '@nestjs/common';
import type { IUserRepository } from '../../domain/repositories/user.repository.interface';
import { USER_REPOSITORY } from '../../domain/repositories/user.repository.interface';
import type { PaginatedResult } from '../../../../shared/pagination/pagination';
import { normalizePagination } from '../../../../shared/pagination/pagination';

export interface UserListItem {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  roles: string[];
}

@Injectable()
export class ListUsersUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(
    role?: string,
    page = 1,
    limit = 20,
    search?: string,
  ): Promise<PaginatedResult<UserListItem>> {
    const pagination = normalizePagination(page, limit);
    const result = await this.userRepository.findPage(
      role && role !== 'Todos' ? role : undefined,
      pagination.page,
      pagination.limit,
      ...(search?.trim() ? [search.trim()] : []),
    );

    return {
      data: result.data.map((user) => ({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isActive: user.isActive,
        roles: user.roles.map((r) => r.name),
      })),
      pagination: result.pagination,
    };
  }
}

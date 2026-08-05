import { Inject, Injectable } from '@nestjs/common';
import type { IUserRepository } from '../../domain/repositories/user.repository.interface';
import { USER_REPOSITORY } from '../../domain/repositories/user.repository.interface';

@Injectable()
export class ListUsersUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(role?: string) {
    let users = [];
    if (role && role !== 'Todos') {
      users = await this.userRepository.findByRole(role);
    } else {
      users = await this.userRepository.findAll();
    }

    // Retornamos mapeando entidades
    return users.map((user) => ({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isActive: user.isActive,
      roles: user.roles.map((r) => r.name),
    }));
  }
}

import {
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { RegisterUseCase } from './register.use-case';
import { UserEntity } from '../../domain/entities/user.entity';

jest.mock('bcrypt', () => ({ hash: jest.fn() }));

function createdUser() {
  return new UserEntity({
    id: 'user-2',
    email: 'new@example.com',
    passwordHash: 'hashed',
    firstName: 'Luis',
    lastName: 'Nuevo',
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    roles: [],
  });
}

describe('RegisterUseCase', () => {
  const hash = bcrypt.hash as unknown as jest.Mock;
  const dto = {
    email: 'new@example.com',
    password: 'secret',
    firstName: 'Luis',
    lastName: 'Nuevo',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    hash.mockResolvedValue('hashed');
  });

  it('rejects an existing email', async () => {
    const repository = {
      findByEmail: jest.fn().mockResolvedValue(createdUser()),
    };
    const service = new RegisterUseCase(repository as never, {} as never);

    await expect(service.execute(dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(hash).not.toHaveBeenCalled();
  });

  it('creates a student and sends the welcome email asynchronously', async () => {
    const account = createdUser();
    const repository = {
      findByEmail: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(account),
    };
    const mail = { sendWelcomeEmail: jest.fn().mockResolvedValue(undefined) };
    const service = new RegisterUseCase(repository as never, mail as never);

    await expect(service.execute(dto)).resolves.toMatchObject({
      user: { id: 'user-2', email: 'new@example.com' },
    });
    expect(repository.create).toHaveBeenCalledWith(
      {
        email: dto.email,
        passwordHash: 'hashed',
        firstName: dto.firstName,
        lastName: dto.lastName,
      },
      'ESTUDIANTE',
    );
    expect(mail.sendWelcomeEmail).toHaveBeenCalledWith(
      account.email,
      account.firstName,
    );

    mail.sendWelcomeEmail.mockRejectedValue(new Error('mail down'));
    await expect(service.execute(dto)).resolves.toMatchObject({
      user: { id: 'user-2' },
    });
    await Promise.resolve();
  });

  it('maps unique constraint failures to conflict and unknown failures to 500', async () => {
    const duplicate = Object.assign(new Error('duplicate'), { code: 'P2002' });
    const repository = {
      findByEmail: jest.fn().mockResolvedValue(null),
      create: jest
        .fn()
        .mockRejectedValueOnce(duplicate)
        .mockRejectedValueOnce(new Error('down')),
    };
    const service = new RegisterUseCase(repository as never, {} as never);

    await expect(service.execute(dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
    await expect(service.execute(dto)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });
});

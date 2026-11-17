/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { UserController } from './user.controller';

describe('UserController', () => {
  const listUsers = { execute: jest.fn() };
  const adminCreate = { execute: jest.fn() };
  const repository = {
    findById: jest.fn(),
    update: jest.fn(),
    findTrash: jest.fn(),
    restore: jest.fn(),
    softDelete: jest.fn(),
  };
  const storage = { uploadFile: jest.fn() };
  let controller: UserController;
  const profile = {
    id: 'user-1',
    email: 'user@test.com',
    firstName: 'Ana',
    lastName: 'Prueba',
    profilePicture: null,
    dni: '12345678',
    phone: '999999999',
    address: 'Calle 1',
    district: 'Lima',
    province: 'Lima',
    department: 'Lima',
    roles: [{ name: 'ESTUDIANTE' }],
    flatPermissions: ['READ'],
    isActive: true,
    deletedAt: null,
  };

  beforeEach(() => {
    jest.resetAllMocks();
    controller = new UserController(
      listUsers as never,
      adminCreate as never,
      repository as never,
      storage as never,
    );
  });

  it('devuelve el perfil completo y rechaza usuarios inexistentes', async () => {
    repository.findById.mockResolvedValue(profile);
    await expect(
      controller.getProfile({ id: 'user-1' } as never),
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'user-1',
        roles: ['ESTUDIANTE'],
        permissions: ['READ'],
        profileComplete: true,
      }),
    );
    repository.findById.mockResolvedValue(null);
    await expect(
      controller.getProfile({ id: 'missing' } as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('delega listado y creación administrativa', async () => {
    listUsers.execute.mockResolvedValue({ data: [] });
    adminCreate.execute.mockResolvedValue({ id: 'user-2' });
    await expect(
      controller.getUsers({ role: 'DOCENTE', page: 1, limit: 10 } as never),
    ).resolves.toEqual({ data: [] });
    await expect(
      controller.createUser({ email: 'new@test.com' } as never),
    ).resolves.toEqual({ id: 'user-2' });
  });

  it('actualiza perfil con y sin contraseña', async () => {
    repository.update.mockResolvedValue(profile);
    await expect(
      controller.updateProfile(
        { id: 'user-1' } as never,
        {
          firstName: 'Ana',
          password: 'new-password',
        } as never,
      ),
    ).resolves.toEqual(
      expect.objectContaining({ id: 'user-1', profileComplete: true }),
    );
    await expect(
      controller.updateProfile(
        { id: 'user-1' } as never,
        { phone: '911111111' } as never,
      ),
    ).resolves.toEqual(expect.objectContaining({ id: 'user-1' }));
    expect(repository.update).toHaveBeenCalled();
  });

  it('sube avatar y valida que exista archivo', async () => {
    storage.uploadFile.mockResolvedValue('storage://local/avatars/avatar.png');
    repository.update.mockResolvedValue({
      ...profile,
      profilePicture: 'storage://local/avatars/avatar.png',
    });
    await expect(
      controller.uploadAvatar(
        { id: 'user-1' } as never,
        { originalname: 'avatar.png' } as Express.Multer.File,
      ),
    ).resolves.toEqual({
      message: 'Foto de perfil actualizada',
      profilePicture: 'storage://local/avatars/avatar.png',
    });
    await expect(
      controller.uploadAvatar({ id: 'user-1' } as never, undefined as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('actualiza, lista, restaura y elimina usuarios administrativos', async () => {
    repository.update.mockResolvedValue(profile);
    await expect(
      controller.updateUser('user-1', {
        firstName: 'Nuevo',
        isActive: false,
      } as never),
    ).resolves.toEqual({
      id: 'user-1',
      email: profile.email,
      firstName: 'Ana',
      lastName: 'Prueba',
      isActive: true,
      roles: ['ESTUDIANTE'],
    });
    await controller.updateUser('user-1', {
      firstName: 'Ana',
      lastName: 'Prueba',
      email: 'user@test.com',
      isActive: true,
      roles: ['ESTUDIANTE'],
    } as never);
    expect(repository.update).toHaveBeenLastCalledWith('user-1', {
      firstName: 'Ana',
      lastName: 'Prueba',
      email: 'user@test.com',
      isActive: true,
      roles: ['ESTUDIANTE'],
    });
    repository.findTrash.mockResolvedValue([profile]);
    await expect(controller.getTrashUsers()).resolves.toEqual([
      expect.objectContaining({ id: 'user-1', roles: ['ESTUDIANTE'] }),
    ]);
    repository.restore.mockResolvedValue(profile);
    await expect(controller.restoreUser('user-1')).resolves.toEqual({
      id: 'user-1',
      email: profile.email,
      firstName: 'Ana',
      lastName: 'Prueba',
      isActive: true,
    });
    repository.softDelete.mockResolvedValue({ id: 'user-1' });
    await expect(controller.deleteUser('user-1')).resolves.toEqual({
      id: 'user-1',
    });
  });
});

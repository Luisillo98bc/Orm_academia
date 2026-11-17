import {
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { UserEntity } from '../../domain/entities/user.entity';
import { GoogleLoginUseCase } from './google-login.use-case';

jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn(),
}));

const mockedOAuth2Client = OAuth2Client as jest.MockedClass<
  typeof OAuth2Client
>;

function makeUser(
  overrides: Partial<ConstructorParameters<typeof UserEntity>[0]> = {},
) {
  return new UserEntity({
    id: 'user-1',
    email: 'user@example.com',
    passwordHash: 'hash',
    firstName: 'Ada',
    lastName: 'Lovelace',
    isActive: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-02'),
    roles: [
      {
        id: 'role-1',
        name: 'ESTUDIANTE',
        permissions: [{ subject: 'courses', action: 'read' }],
      },
    ],
    ...overrides,
  });
}

describe('GoogleLoginUseCase', () => {
  const config = { get: jest.fn() } as unknown as ConfigService;
  const jwt = { signAsync: jest.fn().mockResolvedValue('access-token') };
  const userRepository = {
    findByGoogleSubject: jest.fn(),
    findByEmail: jest.fn(),
    linkGoogleSubject: jest.fn(),
    create: jest.fn(),
    replaceRoles: jest.fn(),
    updateLastLogin: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    config.get = jest.fn((key: string) => {
      if (key === 'GOOGLE_CLIENT_ID') return 'client-id';
      if (key === 'INITIAL_ADMIN_EMAIL') return 'admin@example.com';
      return undefined;
    }) as never;
    mockedOAuth2Client.mockImplementation(
      () => ({ verifyIdToken: jest.fn() }) as never,
    );
  });

  it('requires Google configuration and rejects invalid credentials', async () => {
    config.get = jest.fn().mockReturnValue(undefined) as never;
    const useCase = new GoogleLoginUseCase(
      userRepository as never,
      jwt as never,
      config,
    );
    await expect(useCase.execute('credential')).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );

    config.get = jest.fn((key: string) =>
      key === 'GOOGLE_CLIENT_ID' ? 'client-id' : undefined,
    ) as never;
    const verifyIdToken = jest.fn().mockRejectedValue(new Error('invalid'));
    mockedOAuth2Client.mockImplementation(() => ({ verifyIdToken }) as never);
    await expect(useCase.execute('credential')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects unverified or incomplete Google profiles', async () => {
    const verifyIdToken = jest.fn().mockResolvedValue({
      getPayload: () => ({ email: 'user@example.com', email_verified: false }),
    });
    mockedOAuth2Client.mockImplementation(() => ({ verifyIdToken }) as never);
    const useCase = new GoogleLoginUseCase(
      userRepository as never,
      jwt as never,
      config,
    );
    await expect(useCase.execute('credential')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('logs in an existing Google user and updates the last login', async () => {
    const user = makeUser({ googleSubject: 'google-1' });
    userRepository.findByGoogleSubject.mockResolvedValue(user);
    const verifyIdToken = jest.fn().mockResolvedValue({
      getPayload: () => ({
        sub: 'google-1',
        email: 'USER@example.com',
        email_verified: true,
      }),
    });
    mockedOAuth2Client.mockImplementation(() => ({ verifyIdToken }) as never);
    const useCase = new GoogleLoginUseCase(
      userRepository as never,
      jwt as never,
      config,
    );

    await expect(useCase.execute('credential')).resolves.toMatchObject({
      accessToken: 'access-token',
      user: { id: 'user-1', roles: ['ESTUDIANTE'] },
      permissions: ['courses:read'],
    });
    expect(jwt.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 'user-1', roles: ['ESTUDIANTE'] }),
    );
    expect(userRepository.updateLastLogin).toHaveBeenCalled();
  });

  it('tolerates a failed last-login update', async () => {
    const account = makeUser({ googleSubject: 'google-failure' });
    userRepository.findByGoogleSubject.mockResolvedValue(account);
    userRepository.updateLastLogin.mockRejectedValue(
      new Error('database down'),
    );
    const verifyIdToken = jest.fn().mockResolvedValue({
      getPayload: () => ({
        sub: 'google-failure',
        email: 'user@example.com',
        email_verified: true,
      }),
    });
    mockedOAuth2Client.mockImplementation(() => ({ verifyIdToken }) as never);
    const useCase = new GoogleLoginUseCase(
      userRepository as never,
      jwt as never,
      config,
    );

    await expect(useCase.execute('credential')).resolves.toMatchObject({
      accessToken: 'access-token',
    });
  });

  it('links an existing email, rejects conflicting links and disabled users', async () => {
    const existing = makeUser({ googleSubject: null });
    userRepository.findByGoogleSubject.mockResolvedValue(null);
    userRepository.findByEmail.mockResolvedValue(existing);
    userRepository.linkGoogleSubject.mockResolvedValue(
      makeUser({ googleSubject: 'google-2' }),
    );
    const verifyIdToken = jest.fn().mockResolvedValue({
      getPayload: () => ({
        sub: 'google-2',
        email: 'user@example.com',
        email_verified: true,
        picture: 'picture.jpg',
      }),
    });
    mockedOAuth2Client.mockImplementation(() => ({ verifyIdToken }) as never);
    const useCase = new GoogleLoginUseCase(
      userRepository as never,
      jwt as never,
      config,
    );
    await expect(useCase.execute('credential')).resolves.toMatchObject({
      accessToken: 'access-token',
    });
    expect(userRepository.linkGoogleSubject).toHaveBeenCalledWith(
      'user-1',
      'google-2',
      'picture.jpg',
    );

    userRepository.findByEmail.mockResolvedValue(
      makeUser({ googleSubject: 'other' }),
    );
    await expect(useCase.execute('credential')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    userRepository.findByGoogleSubject.mockResolvedValue(
      makeUser({ googleSubject: 'google-1', isActive: false }),
    );
    await expect(useCase.execute('credential')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('creates new users, grants the initial admin role and fills fallback names', async () => {
    userRepository.findByGoogleSubject.mockResolvedValue(null);
    userRepository.findByEmail.mockResolvedValue(null);
    const created = makeUser({
      email: 'admin@example.com',
      googleSubject: 'google-new',
      roles: [{ id: 'role-admin', name: 'ADMIN', permissions: [] }],
    });
    userRepository.create.mockResolvedValue(created);
    userRepository.replaceRoles.mockResolvedValue(created);
    const verifyIdToken = jest.fn().mockResolvedValue({
      getPayload: () => ({
        sub: 'google-new',
        email: 'ADMIN@example.com',
        email_verified: true,
        name: 'Admin',
      }),
    });
    mockedOAuth2Client.mockImplementation(() => ({ verifyIdToken }) as never);
    const useCase = new GoogleLoginUseCase(
      userRepository as never,
      jwt as never,
      config,
    );

    await expect(useCase.execute('credential')).resolves.toMatchObject({
      user: { roles: ['ADMIN'] },
    });
    expect(userRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'admin@example.com',
        firstName: 'Admin',
        lastName: 'Academia',
        passwordHash: expect.any(String) as jest.AsymmetricMatcher,
      }),
      'ADMIN',
    );

    const nonAdmin = makeUser({
      email: 'admin@example.com',
      googleSubject: 'google-existing',
    });
    userRepository.findByGoogleSubject.mockResolvedValue(nonAdmin);
    userRepository.replaceRoles.mockResolvedValue(
      makeUser({
        email: 'admin@example.com',
        googleSubject: 'google-existing',
        roles: [{ id: 'role-admin', name: 'ADMIN', permissions: [] }],
      }),
    );
    await useCase.execute('credential');
    expect(userRepository.replaceRoles).toHaveBeenCalledWith('user-1', 'ADMIN');
  });
});

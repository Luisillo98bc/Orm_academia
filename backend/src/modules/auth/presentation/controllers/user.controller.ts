import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../infrastructure/guards/roles.guard';
import { Roles } from '../../infrastructure/guards/roles.decorator';
import { CurrentUser } from '../../infrastructure/strategies/current-user.decorator';
import { ListUsersUseCase } from '../../application/use-cases/list-users.use-case';
import { AdminCreateUserUseCase } from '../../application/use-cases/admin-create-user.use-case';
import { AdminCreateUserDto } from '../../application/dtos/admin-create-user.dto';
import { AdminUpdateUserDto } from '../../application/dtos/admin-update-user.dto';
import { UserListQueryDto } from '../../application/dtos/user-list-query.dto';
import { Inject } from '@nestjs/common';
import type { IUserRepository } from '../../domain/repositories/user.repository.interface';
import { USER_REPOSITORY } from '../../domain/repositories/user.repository.interface';
import { FileInterceptor } from '@nestjs/platform-express';
import { multerConfig } from '../../../../shared/infrastructure/multer/multer.config';
import { UpdateProfileDto } from '../../application/dtos/update-profile.dto';
import * as bcrypt from 'bcrypt';
import { StorageService } from '../../../../shared/infrastructure/storage/storage.service';
import type { UserEntity } from '../../domain/entities/user.entity';
import type { AuthenticatedUser } from '../../infrastructure/strategies/authenticated-user.type';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UserController {
  constructor(
    private readonly listUsersUseCase: ListUsersUseCase,
    private readonly adminCreateUserUseCase: AdminCreateUserUseCase,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly storageService: StorageService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Obtener mi perfil' })
  async getProfile(@CurrentUser() user: AuthenticatedUser) {
    const fullUser = await this.userRepository.findById(user.id);
    if (!fullUser) throw new UnauthorizedException('Usuario no encontrado');

    return this.toProfileResponse(fullUser);
  }

  private toProfileResponse(fullUser: UserEntity) {
    return {
      id: fullUser.id,
      email: fullUser.email,
      firstName: fullUser.firstName,
      lastName: fullUser.lastName,
      profilePicture: fullUser.profilePicture,
      dni: fullUser.dni,
      phone: fullUser.phone,
      address: fullUser.address,
      district: fullUser.district,
      province: fullUser.province,
      department: fullUser.department,
      roles: fullUser.roles.map((r: { name: string }) => r.name),
      permissions: fullUser.flatPermissions,
      profileComplete: Boolean(
        fullUser.dni &&
        fullUser.phone &&
        fullUser.address &&
        fullUser.district &&
        fullUser.province &&
        fullUser.department,
      ),
    };
  }

  @Get()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Listar usuarios (Filtro por rol opcional)' })
  @ApiQuery({ name: 'role', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getUsers(@Query() query: UserListQueryDto) {
    return this.listUsersUseCase.execute(
      query.role,
      query.page,
      query.limit,
      ...(query.search?.trim() ? [query.search.trim()] : []),
    );
  }

  @Post()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Crear usuario desde el panel de admin' })
  createUser(@Body() dto: AdminCreateUserDto) {
    return this.adminCreateUserUseCase.execute(dto);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Actualizar mi perfil' })
  async updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateProfileDto,
  ) {
    const { password, ...profileData } = body;

    // Si envían contraseña, se hashea
    const updateData = {
      ...profileData,
      ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
    };

    const updated = await this.userRepository.update(user.id, updateData);
    return this.toProfileResponse(updated);
  }

  @Post('me/avatar')
  @ApiOperation({ summary: 'Subir foto de perfil' })
  @UseInterceptors(FileInterceptor('file', multerConfig))
  async uploadAvatar(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException(
        'Ningún archivo fue subido o el formato es incorrecto',
      );
    }

    const profilePictureUrl = await this.storageService.uploadFile(
      file,
      'avatars',
    );
    const updated = await this.userRepository.update(user.id, {
      profilePicture: profilePictureUrl,
    });

    return {
      message: 'Foto de perfil actualizada',
      profilePicture: updated.profilePicture,
    };
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Actualizar un usuario (Solo Admin)' })
  async updateUser(@Param('id') id: string, @Body() body: AdminUpdateUserDto) {
    const updateData: AdminUpdateUserDto = {};
    if (body.firstName !== undefined) updateData.firstName = body.firstName;
    if (body.lastName !== undefined) updateData.lastName = body.lastName;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;
    if (body.roles !== undefined) updateData.roles = body.roles;

    const updated = await this.userRepository.update(id, updateData);
    return {
      id: updated.id,
      email: updated.email,
      firstName: updated.firstName,
      lastName: updated.lastName,
      isActive: updated.isActive,
      roles: updated.roles.map((r) => r.name),
    };
  }

  @Get('trash')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Listar usuarios eliminados (Solo Admin)' })
  async getTrashUsers() {
    const users = await this.userRepository.findTrash();
    return users.map((u) => ({
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      deletedAt: u.deletedAt,
      roles: u.roles.map((r) => r.name),
    }));
  }

  @Patch(':id/restore')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Restaurar usuario eliminado (Solo Admin)' })
  async restoreUser(@Param('id') id: string) {
    const restored = await this.userRepository.restore(id);
    return {
      id: restored.id,
      email: restored.email,
      firstName: restored.firstName,
      lastName: restored.lastName,
      isActive: restored.isActive,
    };
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar un usuario (Solo Admin)' })
  async deleteUser(@Param('id') id: string) {
    return this.userRepository.softDelete(id);
  }
}

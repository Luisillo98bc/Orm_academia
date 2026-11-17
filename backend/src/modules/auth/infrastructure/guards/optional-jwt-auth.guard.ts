import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Intenta identificar al usuario, pero permite continuar sin sesión para
 * recursos que pueden ser públicos. El controlador decide después si la
 * referencia concreta requiere autenticación.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      return Boolean(await super.canActivate(context));
    } catch {
      return true;
    }
  }
}

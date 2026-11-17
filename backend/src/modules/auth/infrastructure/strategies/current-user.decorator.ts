import { createParamDecorator, ExecutionContext } from '@nestjs/common';

interface CurrentUserPayload {
  id: string;
  email: string;
  roles: string[];
  permissions: string[];
}

interface AuthenticatedRequest {
  user: CurrentUserPayload;
}

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.user;
  },
);

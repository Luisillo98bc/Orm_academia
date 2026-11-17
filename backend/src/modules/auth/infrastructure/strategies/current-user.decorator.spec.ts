import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { CurrentUser } from './current-user.decorator';

describe('CurrentUser decorator', () => {
  it('extrae el usuario autenticado del request HTTP', () => {
    class TestController {
      handler() {}
    }

    CurrentUser()(TestController.prototype, 'handler', 0);
    const metadata = Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      TestController,
      'handler',
    ) as Record<
      string,
      { factory: (_data: unknown, context: unknown) => unknown }
    >;
    const argument = Object.values(metadata)[0];
    const user = {
      id: 'user-1',
      email: 'user@example.com',
      roles: ['ADMIN'],
      permissions: [],
    };

    expect(
      argument.factory(undefined, {
        switchToHttp: () => ({ getRequest: () => ({ user }) }),
      }),
    ).toEqual(user);
  });
});

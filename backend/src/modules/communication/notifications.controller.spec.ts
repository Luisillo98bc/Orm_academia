import { NotificationsController } from './notifications.controller';
import type { NotificationsService } from './notifications.service';

describe('NotificationsController', () => {
  it('delegates user and admin notification endpoints with normalized queries', async () => {
    const service = {
      getUnreadNotifications: jest.fn().mockResolvedValue([]),
      getAllNotifications: jest.fn().mockResolvedValue([]),
      getNotificationPage: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      getPreferences: jest.fn().mockResolvedValue({}),
      updatePreferences: jest.fn().mockResolvedValue({}),
      markAsRead: jest.fn().mockResolvedValue(undefined),
      markAllAsRead: jest.fn().mockResolvedValue(undefined),
      listDeliveries: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      retryFailedDeliveries: jest
        .fn()
        .mockResolvedValue({ inspected: 0, sent: 0 }),
    };
    const controller = new NotificationsController(
      service as unknown as NotificationsService,
    );
    const user = {
      id: 'user-1',
      email: 'u@example.com',
      roles: ['ADMIN'],
      permissions: [],
    };

    await controller.getUnread(user);
    await controller.getAll(user);
    await controller.getPage(user, '2', '10', 'true');
    await controller.getPreferences(user);
    await controller.updatePreferences(user, {
      emailEnabled: true,
      pushEnabled: 'invalid' as never,
    });
    await controller.markAsRead('notification-1', user);
    await controller.markAllAsRead(user);
    await controller.listDeliveries('2', '10', 'EMAIL', 'SENT');
    await controller.retryDeliveries('5');

    expect(service.getNotificationPage).toHaveBeenCalledWith('user-1', {
      page: 2,
      limit: 10,
      unreadOnly: true,
    });
    expect(service.updatePreferences).toHaveBeenCalledWith('user-1', {
      emailEnabled: true,
    });
    expect(service.listDeliveries).toHaveBeenCalledWith({
      page: 2,
      limit: 10,
      channel: 'EMAIL',
      status: 'SENT',
    });
    expect(service.retryFailedDeliveries).toHaveBeenCalledWith(5);
  });
});

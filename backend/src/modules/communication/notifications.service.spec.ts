import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  const prisma = {
    notificationPreference: { findUnique: jest.fn(), upsert: jest.fn() },
    user: { findUnique: jest.fn() },
    notification: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
    },
    notificationDelivery: {
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };
  const gateway = { sendNotificationToUser: jest.fn() };
  const mail = { sendTransactionalEmail: jest.fn() };
  const config = { get: jest.fn() };
  let service: NotificationsService;

  beforeEach(() => {
    jest.resetAllMocks();
    gateway.sendNotificationToUser.mockResolvedValue(undefined);
    config.get.mockReturnValue(undefined);
    prisma.notificationPreference.findUnique.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.notification.create.mockResolvedValue({
      id: 'notification-1',
      deliveries: [],
    });
    prisma.notificationDelivery.create.mockResolvedValue({ id: 'delivery-1' });
    prisma.notificationDelivery.update.mockResolvedValue({ id: 'delivery-1' });
    service = new NotificationsService(
      prisma as never,
      gateway as never,
      mail as never,
      config as never,
    );
  });

  it('respeta preferencias push y crea notificaciones internas', async () => {
    prisma.notificationPreference.findUnique.mockResolvedValue({
      pushEnabled: false,
    });
    await expect(
      service.createNotification({ userId: 'user-1', title: 'Aviso' }),
    ).resolves.toBeNull();
    expect(prisma.notification.create).not.toHaveBeenCalled();

    prisma.notificationPreference.findUnique.mockResolvedValue({
      pushEnabled: true,
      emailEnabled: false,
      whatsappEnabled: false,
    });
    prisma.user.findUnique.mockResolvedValue({
      email: 'user@test.com',
      phone: null,
      firstName: 'Ana',
      lastName: 'Prueba',
    });
    await expect(
      service.createNotification({
        userId: 'user-1',
        title: 'Aviso',
        message: 'Mensaje',
        type: 'INFO',
        actionUrl: '/dashboard',
      }),
    ).resolves.toEqual({ id: 'notification-1' });
    expect(gateway.sendNotificationToUser).toHaveBeenCalledWith('user-1', {
      id: 'notification-1',
    });
    const [created] = prisma.notification.create.mock.calls[0] as [
      {
        data: {
          deliveries: { createMany: { data: Array<{ channel: string }> } };
        };
      },
    ];
    expect(created.data.deliveries.createMany.data).toContainEqual(
      expect.objectContaining({ channel: 'INTERNAL' }),
    );
  });

  it('lista y reintenta entregas fallidas de correo y WhatsApp', async () => {
    prisma.notificationDelivery.findMany.mockResolvedValue([
      {
        id: 'email-delivery',
        channel: 'EMAIL',
        attempts: 1,
        user: { email: 'user@test.com', phone: null },
        notification: {
          title: 'Aviso',
          message: 'Mensaje',
          actionUrl: '/home',
        },
      },
      {
        id: 'whatsapp-delivery',
        channel: 'WHATSAPP',
        attempts: 2,
        user: { email: null, phone: '+51999999999' },
        notification: {
          title: 'Aviso',
          message: 'Mensaje',
          actionUrl: '/home',
        },
      },
    ]);
    mail.sendTransactionalEmail.mockResolvedValue(true);
    await expect(service.retryFailedDeliveries(200)).resolves.toEqual({
      inspected: 2,
      sent: 1,
    });
    expect(prisma.notificationDelivery.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          attempts: { lt: 3 },
          OR: [
            { status: 'FAILED' },
            { status: 'PENDING', updatedAt: { lt: expect.any(Date) as Date } },
          ],
        },
      }),
    );
    expect(mail.sendTransactionalEmail).toHaveBeenCalledWith(
      'user@test.com',
      'Aviso',
      'Mensaje',
      '/home',
    );
    expect(prisma.notificationDelivery.update).toHaveBeenCalled();

    prisma.notificationDelivery.findMany.mockResolvedValue([]);
    await expect(
      service.listDeliveries({
        page: 2,
        limit: 200,
        channel: 'INVALID',
        status: 'INVALID',
      }),
    ).resolves.toEqual({
      data: [],
      total: undefined,
      page: 2,
      limit: 100,
    });
  });

  it('registra los canales junto con el aviso antes de enviar correo', async () => {
    prisma.user.findUnique.mockResolvedValue({
      email: 'user@test.com',
      phone: null,
      firstName: 'Ana',
      lastName: 'Prueba',
    });
    prisma.notification.create.mockResolvedValue({
      id: 'notification-1',
      deliveries: [{ id: 'email-1', channel: 'EMAIL' }],
    });
    mail.sendTransactionalEmail.mockResolvedValue(true);
    await service.createNotification({ userId: 'user-1', title: 'Aviso' });
    const [created] = prisma.notification.create.mock.calls[0] as [
      {
        data: {
          deliveries: {
            createMany: {
              data: Array<{ channel: string; recipient?: string }>;
            };
          };
        };
      },
    ];
    expect(created.data.deliveries.createMany.data).toContainEqual(
      expect.objectContaining({ channel: 'EMAIL', recipient: 'user@test.com' }),
    );
    expect(prisma.notificationDelivery.create).not.toHaveBeenCalled();
  });

  it('obtiene páginas, preferencias y marca notificaciones', async () => {
    prisma.notification.findMany.mockResolvedValue([{ id: 'notification-1' }]);
    prisma.notification.count.mockResolvedValueOnce(4).mockResolvedValueOnce(2);
    await expect(service.getUnreadNotifications('user-1')).resolves.toEqual([
      { id: 'notification-1' },
    ]);
    await expect(service.getAllNotifications('user-1')).resolves.toEqual([
      { id: 'notification-1' },
    ]);
    await expect(
      service.getNotificationPage('user-1', {
        page: 2,
        limit: 5,
        unreadOnly: true,
      }),
    ).resolves.toEqual({
      data: [{ id: 'notification-1' }],
      total: 4,
      unread: 2,
      page: 2,
      limit: 5,
    });

    prisma.notificationPreference.upsert
      .mockResolvedValueOnce({ userId: 'user-1' })
      .mockResolvedValueOnce({ userId: 'user-1', emailEnabled: false });
    await expect(service.getPreferences('user-1')).resolves.toEqual({
      userId: 'user-1',
    });
    await expect(
      service.updatePreferences('user-1', { emailEnabled: false }),
    ).resolves.toEqual({
      userId: 'user-1',
      emailEnabled: false,
    });
    prisma.notification.updateMany.mockResolvedValue({ count: 1 });
    await expect(
      service.markAsRead('notification-1', 'user-1'),
    ).resolves.toEqual({ count: 1 });
    await expect(service.markAllAsRead('user-1')).resolves.toEqual({
      count: 1,
    });
  });

  it('cubre entregas de correo y WhatsApp exitosas, omitidas y fallidas', async () => {
    const internal = service as unknown as {
      dispatchEmail: (input: unknown) => Promise<void>;
      dispatchWhatsApp: (input: unknown) => Promise<void>;
    };
    mail.sendTransactionalEmail.mockResolvedValueOnce(true);
    await internal.dispatchEmail({
      userId: 'user-1',
      notificationId: 'notification-1',
      email: 'user@test.com',
      title: 'Title',
      message: 'Message',
    });
    mail.sendTransactionalEmail.mockResolvedValueOnce(false);
    await internal.dispatchEmail({
      userId: 'user-1',
      notificationId: 'notification-2',
      email: 'user@test.com',
      title: 'Title',
      message: 'Message',
    });
    mail.sendTransactionalEmail.mockRejectedValueOnce(new Error('SMTP down'));
    await internal.dispatchEmail({
      userId: 'user-1',
      notificationId: 'notification-3',
      email: 'user@test.com',
      title: 'Title',
      message: 'Message',
    });

    config.get.mockReturnValue(undefined);
    await internal.dispatchWhatsApp({
      userId: 'user-1',
      notificationId: 'notification-4',
      phone: '+51999999999',
      title: 'Title',
      message: 'Message',
    });
    config.get.mockReturnValue('https://whatsapp.example/send');
    const fetchMock = jest.spyOn(global, 'fetch');
    fetchMock.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve('provider-1'),
    } as Response);
    await internal.dispatchWhatsApp({
      userId: 'user-1',
      notificationId: 'notification-5',
      phone: '+51999999999',
      title: 'Title',
      message: 'Message',
    });
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve('error'),
    } as Response);
    await internal.dispatchWhatsApp({
      userId: 'user-1',
      notificationId: 'notification-6',
      phone: '+51999999999',
      title: 'Title',
      message: 'Message',
    });
    fetchMock.mockRestore();
    expect(prisma.notificationDelivery.update).toHaveBeenCalled();
  });

  it('reintenta entregas sin notificación, correo omitido y WhatsApp configurado', async () => {
    prisma.notificationDelivery.findMany.mockResolvedValue([
      {
        id: 'missing-notification',
        channel: 'EMAIL',
        attempts: 1,
        user: { email: 'user@test.com', phone: null },
        notification: null,
      },
      {
        id: 'email-skipped',
        channel: 'EMAIL',
        attempts: 1,
        user: { email: 'user@test.com', phone: null },
        notification: { title: 'Title', message: null, actionUrl: null },
      },
      {
        id: 'whatsapp-ok',
        channel: 'WHATSAPP',
        attempts: 1,
        user: { email: null, phone: '+51999999999' },
        notification: { title: 'Title', message: 'Message', actionUrl: null },
      },
    ]);
    mail.sendTransactionalEmail.mockResolvedValue(false);
    config.get.mockReturnValue('https://whatsapp.example/send');
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('ok'),
    } as Response);
    await expect(service.retryFailedDeliveries(0)).resolves.toEqual({
      inspected: 3,
      sent: 1,
    });
    fetchMock.mockRestore();
  });

  it('despacha canales externos habilitados', async () => {
    const internal = service as unknown as {
      dispatchExternalChannels: (input: unknown) => Promise<void>;
    };
    mail.sendTransactionalEmail.mockResolvedValue(true);
    config.get.mockReturnValue('https://whatsapp.example/send');
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('ok'),
    } as Response);

    await internal.dispatchExternalChannels({
      userId: 'user-1',
      notificationId: 'notification-7',
      email: 'user@test.com',
      phone: '+51999999999',
      name: 'User',
      title: 'Title',
      message: 'Message',
      emailEnabled: true,
      whatsappEnabled: true,
    });

    expect(mail.sendTransactionalEmail).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalled();
    fetchMock.mockRestore();
  });
});

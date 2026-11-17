import { PrismaClient } from '@prisma/client';
import { NotificationsService } from '../src/modules/communication/notifications.service';

describe('Recuperación de notificaciones con PostgreSQL', () => {
  it('registra la entrega y recupera un envío pendiente tras una interrupción', async () => {
    const prisma = new PrismaClient();
    const user = await prisma.user.create({
      data: {
        email: `fixture-${Date.now()}@example.invalid`,
        passwordHash: 'fixture',
        firstName: 'Prueba',
        lastName: 'Prueba',
      },
    });
    const mail = {
      sendTransactionalEmail: jest
        .fn()
        .mockImplementationOnce(() => new Promise(() => {}))
        .mockResolvedValueOnce(true),
    };
    const service = new NotificationsService(
      prisma as never,
      {
        sendNotificationToUser: jest.fn().mockResolvedValue(undefined),
      } as never,
      mail as never,
      { get: jest.fn() } as never,
    );
    try {
      const notification = await service.createNotification({
        userId: user.id,
        title: 'Aviso de prueba',
      });
      const delivery = await prisma.notificationDelivery.findFirstOrThrow({
        where: { notificationId: notification!.id, channel: 'EMAIL' },
      });
      expect(delivery.status).toBe('PENDING');
      await prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: { updatedAt: new Date(Date.now() - 11 * 60_000) },
      });
      await service.retryFailedDeliveries();
      expect(
        (
          await prisma.notificationDelivery.findUniqueOrThrow({
            where: { id: delivery.id },
          })
        ).status,
      ).toBe('SENT');
    } finally {
      await prisma.user.delete({ where: { id: user.id } });
      await prisma.$disconnect();
    }
  });
});

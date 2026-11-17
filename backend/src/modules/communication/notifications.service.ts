import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { NotificationsGateway } from './notifications.gateway';
import { Prisma } from '@prisma/client';
import { MailService } from '../../shared/infrastructure/mail/mail.service';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsGateway: NotificationsGateway,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {}

  private readonly logger = new Logger(NotificationsService.name);

  async createNotification(data: {
    userId: string;
    title: string;
    message?: string;
    type?: string;
    actionUrl?: string;
  }) {
    const [preferences, user] = await Promise.all([
      this.prisma.notificationPreference.findUnique({
        where: { userId: data.userId },
        select: {
          pushEnabled: true,
          emailEnabled: true,
          whatsappEnabled: true,
        },
      }),
      this.prisma.user.findUnique({
        where: { id: data.userId },
        select: { email: true, phone: true, firstName: true, lastName: true },
      }),
    ]);
    if (preferences && !preferences.pushEnabled) return null;

    const deliveries: Prisma.NotificationDeliveryCreateManyNotificationInput[] =
      [
        {
          userId: data.userId,
          channel: 'INTERNAL',
          status: 'SENT',
          recipient: data.userId,
          sentAt: new Date(),
          attempts: 1,
        },
      ];
    if (user && (preferences?.emailEnabled ?? true) && user.email) {
      deliveries.push({
        userId: data.userId,
        channel: 'EMAIL',
        recipient: user.email,
      });
    }
    if (user && (preferences?.whatsappEnabled ?? true) && user.phone) {
      deliveries.push({
        userId: data.userId,
        channel: 'WHATSAPP',
        recipient: user.phone,
      });
    }
    const created = await this.prisma.notification.create({
      data: {
        userId: data.userId,
        title: data.title,
        message: data.message,
        type: data.type || 'info',
        actionUrl: data.actionUrl,
        deliveries: { createMany: { data: deliveries } },
      },
      include: { deliveries: true },
    });
    const { deliveries: createdDeliveries, ...notification } = created;

    // Emite el evento en tiempo real
    // La entrega en vivo no debe impedir registrar los canales persistentes.
    void this.notificationsGateway
      .sendNotificationToUser(data.userId, notification)
      .catch((error: unknown) =>
        this.logger.warn(`No se pudo emitir la notificación: ${String(error)}`),
      );

    if (user) {
      void this.dispatchExternalChannels({
        userId: data.userId,
        notificationId: notification.id,
        email: user.email,
        phone: user.phone,
        name: `${user.firstName} ${user.lastName}`.trim(),
        title: data.title,
        message: data.message || '',
        actionUrl: data.actionUrl,
        emailEnabled: preferences?.emailEnabled ?? true,
        whatsappEnabled: preferences?.whatsappEnabled ?? true,
        emailDeliveryId: createdDeliveries.find(
          (item) => item.channel === 'EMAIL',
        )?.id,
        whatsappDeliveryId: createdDeliveries.find(
          (item) => item.channel === 'WHATSAPP',
        )?.id,
      });
    }

    return notification;
  }

  private async dispatchExternalChannels(input: {
    userId: string;
    notificationId: string;
    email: string;
    phone?: string | null;
    name: string;
    title: string;
    message: string;
    actionUrl?: string;
    emailEnabled: boolean;
    whatsappEnabled: boolean;
    emailDeliveryId?: string;
    whatsappDeliveryId?: string;
  }) {
    const deliveries: Promise<unknown>[] = [];
    if (input.emailEnabled && input.email) {
      deliveries.push(
        this.dispatchEmail({ ...input, deliveryId: input.emailDeliveryId }),
      );
    }
    if (input.whatsappEnabled && input.phone) {
      deliveries.push(
        this.dispatchWhatsApp({
          userId: input.userId,
          notificationId: input.notificationId,
          phone: input.phone,
          title: input.title,
          message: input.message,
          deliveryId: input.whatsappDeliveryId,
        }),
      );
    }
    await Promise.allSettled(deliveries);
  }

  private async dispatchEmail(input: {
    userId: string;
    notificationId: string;
    email: string;
    title: string;
    message: string;
    actionUrl?: string;
    deliveryId?: string;
  }) {
    const delivery = input.deliveryId
      ? { id: input.deliveryId }
      : await this.prisma.notificationDelivery.create({
          data: {
            userId: input.userId,
            notificationId: input.notificationId,
            channel: 'EMAIL',
            status: 'PENDING',
            recipient: input.email,
          },
        });
    try {
      const sent = await this.mailService.sendTransactionalEmail(
        input.email,
        input.title,
        input.message,
        input.actionUrl,
      );
      await this.prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: {
          status: sent ? 'SENT' : 'SKIPPED',
          attempts: 1,
          sentAt: sent ? new Date() : null,
          errorMessage: sent ? null : 'SMTP no configurado o deshabilitado',
        },
      });
    } catch (error) {
      await this.prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: {
          status: 'FAILED',
          attempts: 1,
          errorMessage: String(error).slice(0, 500),
        },
      });
    }
  }

  private async dispatchWhatsApp(input: {
    userId: string;
    notificationId: string;
    phone: string;
    title: string;
    message: string;
    deliveryId?: string;
  }) {
    const delivery = input.deliveryId
      ? { id: input.deliveryId }
      : await this.prisma.notificationDelivery.create({
          data: {
            userId: input.userId,
            notificationId: input.notificationId,
            channel: 'WHATSAPP',
            status: 'PENDING',
            recipient: input.phone,
          },
        });
    const endpoint = this.configService.get<string>('WHATSAPP_API_URL');
    const token = this.configService.get<string>('WHATSAPP_API_TOKEN');
    if (!endpoint) {
      await this.prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: {
          status: 'SKIPPED',
          attempts: 0,
          errorMessage: 'WHATSAPP_API_URL no configurado',
        },
      });
      return;
    }
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          to: input.phone,
          message: `${input.title}\n\n${input.message}`,
        }),
      });
      const responseText = await response.text();
      if (!response.ok)
        throw new Error(
          `Proveedor WhatsApp ${response.status}: ${responseText.slice(0, 300)}`,
        );
      await this.prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: {
          status: 'SENT',
          attempts: 1,
          sentAt: new Date(),
          providerMessageId: responseText.slice(0, 255) || null,
        },
      });
    } catch (error) {
      this.logger.warn(
        `No se pudo enviar WhatsApp a ${input.phone}: ${String(error)}`,
      );
      await this.prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: {
          status: 'FAILED',
          attempts: 1,
          errorMessage: String(error).slice(0, 500),
        },
      });
    }
  }

  async listDeliveries(
    options: {
      page?: number;
      limit?: number;
      channel?: string;
      status?: string;
    } = {},
  ) {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(100, Math.max(1, options.limit ?? 25));
    const where: Prisma.NotificationDeliveryWhereInput = {
      channel:
        options.channel &&
        ['INTERNAL', 'EMAIL', 'WHATSAPP'].includes(options.channel)
          ? (options.channel as never)
          : undefined,
      status:
        options.status &&
        ['PENDING', 'SENT', 'FAILED', 'SKIPPED'].includes(options.status)
          ? (options.status as never)
          : undefined,
    };
    const [data, total] = await Promise.all([
      this.prisma.notificationDelivery.findMany({
        where,
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
          notification: { select: { title: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notificationDelivery.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async retryFailedDeliveries(limit = 25) {
    const deliveries = await this.prisma.notificationDelivery.findMany({
      where: {
        attempts: { lt: 3 },
        OR: [
          { status: 'FAILED' },
          // Allow in-flight sends to finish before recovering abandoned deliveries.
          {
            status: 'PENDING',
            updatedAt: { lt: new Date(Date.now() - 10 * 60_000) },
          },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: Math.min(Math.max(limit, 1), 100),
      include: {
        user: { select: { email: true, phone: true } },
        notification: true,
      },
    });
    let sent = 0;
    for (const delivery of deliveries) {
      const notification = delivery.notification;
      if (!notification) continue;
      const attempts = delivery.attempts + 1;
      try {
        if (delivery.channel === 'EMAIL' && delivery.user.email) {
          const ok = await this.mailService.sendTransactionalEmail(
            delivery.user.email,
            notification.title,
            notification.message || '',
            notification.actionUrl || undefined,
          );
          await this.prisma.notificationDelivery.update({
            where: { id: delivery.id },
            data: {
              status: ok ? 'SENT' : 'SKIPPED',
              attempts,
              sentAt: ok ? new Date() : null,
              errorMessage: ok ? null : 'SMTP no disponible',
            },
          });
          if (ok) sent++;
        } else if (delivery.channel === 'WHATSAPP' && delivery.user.phone) {
          const endpoint = this.configService.get<string>('WHATSAPP_API_URL');
          if (!endpoint) {
            await this.prisma.notificationDelivery.update({
              where: { id: delivery.id },
              data: {
                status: 'SKIPPED',
                attempts,
                errorMessage: 'Proveedor WhatsApp no configurado',
              },
            });
            continue;
          }
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              ...(this.configService.get<string>('WHATSAPP_API_TOKEN')
                ? {
                    authorization: `Bearer ${this.configService.get<string>('WHATSAPP_API_TOKEN')}`,
                  }
                : {}),
            },
            body: JSON.stringify({
              to: delivery.user.phone,
              message: `${notification.title}\n\n${notification.message || ''}`,
            }),
          });
          if (!response.ok) throw new Error(`WhatsApp ${response.status}`);
          await this.prisma.notificationDelivery.update({
            where: { id: delivery.id },
            data: {
              status: 'SENT',
              attempts,
              sentAt: new Date(),
              errorMessage: null,
            },
          });
          sent++;
        }
      } catch (error) {
        await this.prisma.notificationDelivery.update({
          where: { id: delivery.id },
          data: {
            status: 'FAILED',
            attempts,
            errorMessage: String(error).slice(0, 500),
          },
        });
      }
    }
    return { inspected: deliveries.length, sent };
  }

  async getUnreadNotifications(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId, isRead: false },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  async getAllNotifications(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async getNotificationPage(
    userId: string,
    options: { page?: number; limit?: number; unreadOnly?: boolean } = {},
  ) {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(100, Math.max(1, options.limit ?? 20));
    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(options.unreadOnly ? { isRead: false } : {}),
    };
    const [data, total, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);
    return { data, total, unread, page, limit };
  }

  async getPreferences(userId: string) {
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }

  async updatePreferences(
    userId: string,
    data: Partial<{
      emailEnabled: boolean;
      whatsappEnabled: boolean;
      pushEnabled: boolean;
      contractAlerts: boolean;
      academicAlerts: boolean;
      paymentAlerts: boolean;
    }>,
  ) {
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  }

  async markAsRead(notificationId: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }
}

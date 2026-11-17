import { MailService } from './mail.service';
import * as nodemailer from 'nodemailer';

jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));

const mockCreateTransport = nodemailer.createTransport as jest.Mock;

describe('MailService', () => {
  const baseConfig = (overrides: Record<string, unknown> = {}) => {
    const values: Record<string, unknown> = {
      NODE_ENV: 'development',
      MAIL_HOST: 'smtp.example.com',
      MAIL_USER: 'mailer@example.com',
      MAIL_PASS: 'secret',
      MAIL_PORT: 587,
      MAIL_RETRY_ATTEMPTS: 1,
      MAIL_RETRY_DELAY_MS: 100,
      FRONTEND_URL: 'https://academy.example',
      ...overrides,
    };
    return {
      get: jest.fn(
        (key: string, fallback?: unknown) => values[key] ?? fallback,
      ),
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateTransport.mockReturnValue({
      sendMail: jest.fn().mockResolvedValue({ messageId: 'message-1' }),
      verify: jest.fn().mockResolvedValue(true),
      close: jest.fn(),
    });
  });

  it('does nothing when mail is disabled or not configured', async () => {
    const disabled = new MailService(baseConfig({ NODE_ENV: 'test' }) as never);
    await expect(
      disabled.sendWelcomeEmail('user@example.com', 'Ada'),
    ).resolves.toBe(false);
    await expect(disabled.verifyConnection()).resolves.toBe(false);
    await disabled.onModuleDestroy();

    const missing = new MailService(
      baseConfig({
        MAIL_HOST: undefined,
        MAIL_USER: undefined,
        MAIL_PASS: undefined,
      }) as never,
    );
    await expect(
      missing.sendTransactionalEmail('user@example.com', 'Subject', 'Hello'),
    ).resolves.toBe(false);
    expect(mockCreateTransport).not.toHaveBeenCalled();
  });

  it('sends transactional and notification templates with sanitized content', async () => {
    const config = baseConfig();
    const service = new MailService(config as never);
    const transport = mockCreateTransport.mock.results[0].value as {
      sendMail: jest.Mock<Promise<unknown>, [Record<string, unknown>]>;
    };
    await expect(service.verifyConnection()).resolves.toBe(true);

    await expect(
      service.sendTransactionalEmail(
        'user@example.com',
        '<Subject>',
        '<script>alert(1)</script>\nHello & bye',
        'https://academy.example/action',
      ),
    ).resolves.toBe(true);
    await service.sendWelcomeEmail('user@example.com', 'Ada');
    await service.sendEnrollmentConfirmation(
      'user@example.com',
      'Ada',
      'Course',
      'Cohort',
    );
    await service.sendPaymentApproved('user@example.com', 'Ada', 99.9);
    await service.sendNewGradeNotification(
      'user@example.com',
      'Ada',
      'Exam',
      18,
    );
    await service.sendNewDeliverableNotification(
      'teacher@example.com',
      'Prof',
      'Ada',
      'Exam',
    );
    await service.sendPasswordResetEmail('user@example.com', 'Ada', 'token');
    await service.sendCertificateEmail(
      'user@example.com',
      'Ada',
      'Course',
      'CERT-1',
    );
    await service.sendContractExpiryAlert(
      'user@example.com',
      'Ada',
      'FULL_TIME',
      new Date('2026-12-31'),
    );

    expect(transport.sendMail).toHaveBeenCalledTimes(9);
    expect(transport.sendMail.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        to: 'user@example.com',
        subject: '<Subject>',
        html: expect.stringContaining(
          '&lt;script&gt;',
        ) as jest.AsymmetricMatcher,
      }),
    );
  });

  it('retries failed sends, verifies SMTP and closes the transport', async () => {
    const transport = {
      sendMail: jest.fn().mockRejectedValue(new Error('temporary failure')),
      verify: jest.fn().mockRejectedValue(new Error('offline')),
      close: jest.fn(),
    };
    mockCreateTransport.mockReturnValue(transport);
    const service = new MailService(
      baseConfig({ MAIL_RETRY_ATTEMPTS: 2, MAIL_RETRY_DELAY_MS: 100 }) as never,
    );

    await expect(
      service.sendPaymentApproved('user@example.com', 'Ada', 10),
    ).resolves.toBe(false);
    expect(transport.sendMail).toHaveBeenCalledTimes(2);
    await expect(service.verifyConnection()).resolves.toBe(false);
    await service.onModuleDestroy();
    expect(transport.close).toHaveBeenCalled();
  });
});

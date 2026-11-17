import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { moneyToString, type MonetaryValue } from '../../utils/money';

@Injectable()
export class MailService implements OnModuleDestroy {
  private transporter: nodemailer.Transporter | null = null;
  private readonly pendingSends = new Set<Promise<boolean>>();
  private readonly logger = new Logger(MailService.name);
  private readonly maxAttempts: number;
  private readonly retryDelayMs: number;

  constructor(private configService: ConfigService) {
    const configuredAttempts = Number(
      this.configService.get<number>('MAIL_RETRY_ATTEMPTS', 3),
    );
    const configuredDelay = Number(
      this.configService.get<number>('MAIL_RETRY_DELAY_MS', 1000),
    );
    this.maxAttempts = Number.isFinite(configuredAttempts)
      ? Math.min(5, Math.max(1, Math.floor(configuredAttempts)))
      : 3;
    this.retryDelayMs = Number.isFinite(configuredDelay)
      ? Math.min(30_000, Math.max(100, Math.floor(configuredDelay)))
      : 1000;

    if (this.configService.get('NODE_ENV', 'development') === 'test') {
      this.logger.log('Correo deshabilitado durante las pruebas');
      return;
    }

    const host = this.configService.get<string>('MAIL_HOST');
    const user = this.configService.get<string>('MAIL_USER');
    const pass = this.configService.get<string>('MAIL_PASS');
    const port = Number(
      this.configService.get<string | number>('MAIL_PORT', 587),
    );

    if (!host || !user || !pass) {
      this.logger.warn(
        'Correo deshabilitado: configura MAIL_HOST, MAIL_USER y MAIL_PASS',
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port: Number.isInteger(port) && port > 0 ? port : 587,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
    });
  }

  async onModuleDestroy(): Promise<void> {
    this.transporter?.close();
    await Promise.allSettled([...this.pendingSends]);
    this.transporter = null;
  }

  private sendMail(
    to: string,
    subject: string,
    html: string,
  ): Promise<boolean> {
    const pending = this.sendMailInternal(to, subject, html);
    this.pendingSends.add(pending);
    void pending.then(
      () => this.pendingSends.delete(pending),
      () => this.pendingSends.delete(pending),
    );
    return pending;
  }

  private async sendMailInternal(
    to: string,
    subject: string,
    html: string,
  ): Promise<boolean> {
    if (!this.transporter) {
      this.logger.warn(
        `Correo omitido para ${to}: transporte SMTP no configurado`,
      );
      return false;
    }

    const from =
      this.configService.get<string>('MAIL_FROM') ||
      '"Academia Virtual" <noreply@academia.com>';

    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      try {
        const info = (await this.transporter.sendMail({
          from,
          to,
          subject,
          html,
        })) as unknown;
        const messageId =
          typeof info === 'object' &&
          info !== null &&
          'messageId' in info &&
          typeof (info as { messageId?: unknown }).messageId === 'string'
            ? (info as { messageId: string }).messageId
            : 'desconocido';
        this.logger.log(
          `Email enviado a ${to}: ${messageId} (intento ${attempt})`,
        );
        return true;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        if (attempt < this.maxAttempts) {
          this.logger.warn(
            `Error enviando email a ${to} (intento ${attempt}/${this.maxAttempts}): ${errorMessage}. Reintentando...`,
          );
          await this.wait(this.retryDelayMs * attempt);
        } else {
          this.logger.error(
            `Email agotó sus reintentos para ${to}: ${errorMessage}`,
          );
        }
      }
    }

    return false;
  }

  /** Verifica credenciales y conectividad SMTP sin enviar un correo. */
  async verifyConnection(): Promise<boolean> {
    if (!this.transporter) {
      this.logger.warn('No se puede verificar SMTP: transporte no configurado');
      return false;
    }

    try {
      await this.transporter.verify();
      this.logger.log('Conexión SMTP verificada correctamente');
      return true;
    } catch (error) {
      this.logger.error(
        'No se pudo verificar la conexión SMTP',
        error instanceof Error ? error.message : String(error),
      );
      return false;
    }
  }

  /** Envía un mensaje transaccional con la misma política de reintentos del correo institucional. */
  async sendTransactionalEmail(
    to: string,
    subject: string,
    message: string,
    actionUrl?: string,
  ): Promise<boolean> {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const safeMessage = message
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replace(/\n/g, '<br />');
    const safeUrl =
      actionUrl && /^https?:\/\//i.test(actionUrl)
        ? actionUrl
        : `${frontendUrl}/dashboard`;
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;padding:24px;color:#172033">
        <div style="border-bottom:3px solid #f5b700;padding-bottom:12px;margin-bottom:20px"><strong>Academia Virtual</strong></div>
        <h2 style="margin:0 0 12px">${subject.replace(/[<>]/g, '')}</h2>
        <p style="line-height:1.6">${safeMessage}</p>
        <p style="margin:24px 0"><a href="${safeUrl}" style="background:#173f72;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700">Abrir campus</a></p>
        <p style="font-size:12px;color:#64748b">Puedes cambiar tus preferencias de comunicación desde tu perfil.</p>
      </div>`;
    return this.sendMail(to, subject, html);
  }

  private wait(milliseconds: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, milliseconds);
      timer.unref();
    });
  }

  async sendWelcomeEmail(to: string, name: string) {
    const subject = '¡Bienvenido a la Academia Virtual!';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px;">
        <h2 style="color: #0ea5e9;">¡Hola, ${name}! 👋</h2>
        <p>Bienvenido a la <strong>Academia Virtual</strong>. Estamos muy emocionados de tenerte con nosotros.</p>
        <p>Tu cuenta ha sido creada exitosamente. Ya puedes iniciar sesión y explorar todos nuestros cursos.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000'}/login" style="background-color: #0ea5e9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Ir al Dashboard</a>
        </div>
        <p style="color: #666; font-size: 12px;">Si tienes alguna duda, responde a este correo.</p>
      </div>
    `;
    return this.sendMail(to, subject, html);
  }

  async sendEnrollmentConfirmation(
    to: string,
    name: string,
    courseName: string,
    cohortName: string,
  ) {
    const subject = `Matrícula Confirmada: ${courseName}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px;">
        <h2 style="color: #10b981;">¡Matrícula Exitosa! 🎉</h2>
        <p>Hola ${name},</p>
        <p>Te has matriculado exitosamente en el curso:</p>
        <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin: 0; color: #334155;">${courseName}</h3>
          <p style="margin: 5px 0 0 0; color: #64748b;">Cohorte: ${cohortName}</p>
        </div>
        <p>¡Prepárate para empezar a aprender!</p>
      </div>
    `;
    return this.sendMail(to, subject, html);
  }

  async sendPaymentApproved(to: string, name: string, amount: MonetaryValue) {
    const subject = 'Tu pago ha sido aprobado ✅';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px;">
        <h2 style="color: #10b981;">Pago Confirmado</h2>
        <p>Hola ${name},</p>
        <p>Hemos validado y aprobado tu pago por <strong>S/ ${moneyToString(amount)}</strong>.</p>
        <p>Tu matrícula ya está activa en el sistema.</p>
      </div>
    `;
    return this.sendMail(to, subject, html);
  }

  async sendNewGradeNotification(
    to: string,
    studentName: string,
    evaluationTitle: string,
    score: number,
  ) {
    const subject = `Nueva Calificación en: ${evaluationTitle}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px;">
        <h2 style="color: #8b5cf6;">Calificación Publicada 📝</h2>
        <p>Hola ${studentName},</p>
        <p>Tu profesor ha publicado una nota para la evaluación <strong>${evaluationTitle}</strong>.</p>
        <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center;">
          <h1 style="margin: 0; color: #334155; font-size: 36px;">${score}</h1>
        </div>
        <p>Revisa el dashboard para más detalles y feedback.</p>
      </div>
    `;
    return this.sendMail(to, subject, html);
  }

  async sendNewDeliverableNotification(
    to: string,
    teacherName: string,
    studentName: string,
    evaluationTitle: string,
  ) {
    const subject = `Nueva Entrega: ${evaluationTitle}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px;">
        <h2 style="color: #f59e0b;">Nueva Entrega Recibida 📁</h2>
        <p>Hola ${teacherName},</p>
        <p>El estudiante <strong>${studentName}</strong> ha enviado una nueva entrega para la evaluación:</p>
        <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin: 0; color: #334155;">${evaluationTitle}</h3>
        </div>
        <p>Puedes revisarla en el panel de evaluaciones.</p>
      </div>
    `;
    return this.sendMail(to, subject, html);
  }

  async sendPasswordResetEmail(to: string, name: string, token: string) {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const resetLink = `${frontendUrl}/reset-password?token=${token}`;
    const subject = 'Recuperación de Contraseña — Academia Virtual';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px;">
        <h2 style="color: #f59e0b;">Recuperar Contraseña 🔑</h2>
        <p>Hola ${name},</p>
        <p>Recibimos una solicitud para restablecer tu contraseña. Haz clic en el siguiente botón para crear una nueva:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" style="background-color: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Restablecer Contraseña</a>
        </div>
        <p style="color: #666; font-size: 12px;">Este enlace expira en 1 hora. Si no solicitaste este cambio, ignora este correo.</p>
      </div>
    `;
    return this.sendMail(to, subject, html);
  }

  async sendCertificateEmail(
    to: string,
    name: string,
    courseName: string,
    certificateCode: string,
  ) {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const verifyLink = `${frontendUrl}/verify/${certificateCode}`;
    const subject = `¡Felicidades! Tu certificado de ${courseName} está listo 🎓`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px;">
        <h2 style="color: #0ea5e9;">¡Felicidades, ${name}! 🎉</h2>
        <p>Has completado exitosamente el curso:</p>
        <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center;">
          <h3 style="margin: 0; color: #334155;">${courseName}</h3>
        </div>
        <p>Tu certificado ya está disponible. Puedes descargarlo desde tu panel de estudiante o verificarlo públicamente con el código: <strong>${certificateCode}</strong></p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verifyLink}" style="background-color: #0ea5e9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Verificar Certificado</a>
        </div>
      </div>
    `;
    return this.sendMail(to, subject, html);
  }

  async sendContractExpiryAlert(
    to: string,
    name: string,
    contractType: string,
    endDate: Date,
  ) {
    const formattedDate = endDate.toLocaleDateString('es-PE');
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const subject = `Aviso: tu contrato vence el ${formattedDate}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #fde68a; border-radius: 10px;">
        <h2 style="color: #b45309;">Contrato próximo a vencer</h2>
        <p>Hola ${name},</p>
        <p>Tu contrato <strong>${contractType}</strong> tiene como fecha de término el <strong>${formattedDate}</strong>.</p>
        <p>Comunícate con Recursos Humanos para revisar su renovación o cierre.</p>
        <div style="text-align: center; margin: 30px 0;"><a href="${frontendUrl}/dashboard/my-contracts" style="background-color: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Ver mi contrato</a></div>
      </div>
    `;
    return this.sendMail(to, subject, html);
  }
}

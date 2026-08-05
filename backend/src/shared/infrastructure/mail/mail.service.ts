import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { moneyToString, type MonetaryValue } from '../../utils/money';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter | null = null;
  private readonly logger = new Logger(MailService.name);

  constructor(private configService: ConfigService) {
    const host = this.configService.get<string>('MAIL_HOST');
    const user = this.configService.get<string>('MAIL_USER');
    const pass = this.configService.get<string>('MAIL_PASS');

    if (!host || !user || !pass) {
      this.logger.warn(
        'Correo deshabilitado: configura MAIL_HOST, MAIL_USER y MAIL_PASS',
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port: this.configService.get<number>('MAIL_PORT') || 2525,
      auth: {
        user,
        pass,
      },
    });
  }

  private async sendMail(to: string, subject: string, html: string) {
    if (!this.transporter) {
      this.logger.warn(
        `Correo omitido para ${to}: transporte SMTP no configurado`,
      );
      return;
    }

    try {
      const from =
        this.configService.get<string>('MAIL_FROM') ||
        '"Academia Virtual" <noreply@academia.com>';
      const info = await this.transporter.sendMail({
        from,
        to,
        subject,
        html,
      });
      this.logger.log(`Email enviado a ${to}: ${info.messageId}`);
    } catch (error) {
      this.logger.error(`Error enviando email a ${to}`, error);
    }
  }

  async sendWelcomeEmail(to: string, name: string) {
    const subject = '¡Bienvenido a la Academia Virtual!';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px;">
        <h2 style="color: #0ea5e9;">¡Hola, ${name}! 👋</h2>
        <p>Bienvenido a la <strong>Academia Virtual</strong>. Estamos muy emocionados de tenerte con nosotros.</p>
        <p>Tu cuenta ha sido creada exitosamente. Ya puedes iniciar sesión y explorar todos nuestros cursos.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${this.configService.get('FRONTEND_URL') || 'http://localhost:3000'}/login" style="background-color: #0ea5e9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Ir al Dashboard</a>
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
      this.configService.get('FRONTEND_URL') || 'http://localhost:3000';
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
      this.configService.get('FRONTEND_URL') || 'http://localhost:3000';
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
}

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { MailService } from '../../../../shared/infrastructure/mail/mail.service';
import * as crypto from 'crypto';
import PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';
import {
  DEFAULT_CERTIFICATE_TEMPLATE,
  SettingsService,
} from '../../../settings/application/settings.service';
import type { CertificateTemplateSettings } from '../../../settings/domain/platform-settings.entity';

@Injectable()
export class CertificateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly settingsService: SettingsService,
  ) {}

  /**
   * Genera un certificado manualmente por un Administrador
   */
  async generateManualCertificate(
    enrollmentId: string,
    issuerId: string,
    type: 'COMPLETION' | 'GRADES' = 'COMPLETION',
    issuerRoles: string[] = [],
  ) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        certificates: true,
        user: true,
        cohort: {
          include: { course: true, teachers: { select: { id: true } } },
        },
      },
    });

    if (!enrollment) throw new NotFoundException('Matrícula no encontrada');
    if (
      enrollment.certificates.some((certificate) => certificate.type === type)
    )
      throw new BadRequestException(
        'El estudiante ya cuenta con este tipo de certificado para este curso',
      );

    if (
      issuerRoles.includes('DOCENTE') &&
      !enrollment.cohort.teachers.some((teacher) => teacher.id === issuerId)
    ) {
      throw new BadRequestException(
        'Solo el docente asignado a la cohorte puede emitir este certificado.',
      );
    }

    const snapshot = await this.getAcademicSnapshot(enrollment.id);
    const template = await this.getTemplate();
    if (type === 'GRADES' && !snapshot.readyForGradesCertificate) {
      throw new BadRequestException(
        snapshot.reason || 'Aún no se pueden emitir las notas finales.',
      );
    }
    if (type === 'COMPLETION' && !snapshot.readyForCompletionCertificate) {
      throw new BadRequestException(
        snapshot.reason ||
          'El estudiante todavía no cumple los requisitos de finalización.',
      );
    }

    if (type === 'COMPLETION' && enrollment.status !== 'COMPLETED') {
      await this.prisma.enrollment.update({
        where: { id: enrollmentId },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
    }

    const code = this.generateUniqueCode();

    const certificate = await this.prisma.certificate.create({
      data: {
        code,
        enrollmentId,
        type,
        issuedBy: issuerId,
        finalGrade: snapshot.finalGrade,
        attendanceRate: snapshot.attendanceRate,
        templateVersion: template.version,
      },
    });

    // Enviar email al alumno
    this.mailService
      .sendCertificateEmail(
        enrollment.user.email,
        enrollment.user.firstName,
        enrollment.cohort.course?.name || 'Curso',
        code,
      )
      .catch((e) => console.error(e));

    return certificate;
  }

  /**
   * Genera un certificado automáticamente si cumple los requisitos
   */
  async generateAutoCertificate(enrollmentId: string) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        certificates: true,
        user: true,
        cohort: {
          include: { course: true, teachers: { select: { id: true } } },
        },
      },
    });

    if (!enrollment) throw new NotFoundException('Matrícula no encontrada');
    const existing = enrollment.certificates.find(
      (certificate) => certificate.type === 'COMPLETION',
    );
    if (existing) return existing; // Ya lo tiene

    if (enrollment.status !== 'COMPLETED') {
      throw new BadRequestException('La matrícula todavía no está completada.');
    }
    const snapshot = await this.getAcademicSnapshot(enrollment.id);
    const template = await this.getTemplate();
    if (!snapshot.readyForCompletionCertificate) {
      throw new BadRequestException(
        snapshot.reason ||
          'El estudiante todavía no cumple los requisitos de finalización.',
      );
    }

    const code = this.generateUniqueCode();

    const certificate = await this.prisma.certificate.create({
      data: {
        code,
        enrollmentId,
        type: 'COMPLETION',
        issuedBy: null, // Automático
        finalGrade: snapshot.finalGrade,
        attendanceRate: snapshot.attendanceRate,
        templateVersion: template.version,
      },
    });

    // Enviar email al alumno
    this.mailService
      .sendCertificateEmail(
        enrollment.user.email,
        enrollment.user.firstName,
        enrollment.cohort.course?.name || 'Curso',
        code,
      )
      .catch((e) => console.error(e));

    return certificate;
  }

  private getPrimaryFrontendUrl(): string {
    const raw = process.env.FRONTEND_URL || 'http://localhost:3000';
    const origins = raw
      .split(',')
      .map((item) => item.trim().replace(/\/+$/, ''))
      .filter(Boolean);
    return (
      origins.find((origin) => origin.startsWith('https://')) ||
      origins[0] ||
      'http://localhost:3000'
    );
  }

  /**
   * Genera el buffer PDF del certificado con QR de verificación
   */
  async generateCertificatePdf(certificateCode: string): Promise<Buffer> {
    const cert = await this.verifyCertificate(certificateCode);
    const template = await this.getTemplate();
    const frontendUrl = this.getPrimaryFrontendUrl();
    const verifyUrl = `${frontendUrl}/verify-certificate/${cert.code}`;

    const qrBuffer = await QRCode.toBuffer(verifyUrl, {
      margin: 1,
      width: 150,
      color: { dark: '#0f172a', light: '#ffffff' },
    });

    return new Promise((resolve, reject) => {
      try {
        // Formato landscape
        const doc = new PDFDocument({
          size: 'A4',
          layout: 'landscape',
          margin: 0,
        });

        const buffers: Buffer[] = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          resolve(Buffer.concat(buffers));
        });

        // Rediseño visual: composición limpia, institucional y fácil de verificar.
        const styledWidth = doc.page.width;
        const styledHeight = doc.page.height;
        const styledPrimary = template.primaryColor;
        const styledInk = '#172033';
        const styledMuted = '#64748b';
        const styledPaper = '#f8fafc';
        const styledTitle =
          cert.type === 'GRADES'
            ? template.gradesTitle
            : template.completionTitle;
        const styledStudentName = `${cert.enrollment.user.firstName} ${cert.enrollment.user.lastName}`;
        const styledCourseName = cert.enrollment.cohort.course?.name || 'Curso';
        const styledIssueDate = new Date(cert.issueDate).toLocaleDateString(
          'es-ES',
          {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          },
        );

        doc.rect(0, 0, styledWidth, styledHeight).fill(styledPaper);
        doc.rect(0, 0, styledWidth, 13).fill(styledPrimary);
        doc.rect(0, styledHeight - 13, styledWidth, 13).fill(styledPrimary);
        doc
          .roundedRect(20, 20, styledWidth - 40, styledHeight - 40, 14)
          .lineWidth(4)
          .stroke(styledPrimary);
        doc
          .roundedRect(32, 32, styledWidth - 64, styledHeight - 64, 10)
          .lineWidth(1)
          .stroke('#cbd5e1');

        // Sello de marca.
        doc.circle(76, 76, 33).fill(styledPrimary);
        doc.circle(76, 76, 25).lineWidth(1.5).stroke('#ffffff');
        doc
          .font('Helvetica-Bold')
          .fontSize(15)
          .fillColor('#ffffff')
          .text('AV', 51, 68, { width: 50, align: 'center' });

        // Encabezado.
        doc
          .font('Helvetica-Bold')
          .fontSize(9)
          .fillColor(styledMuted)
          .text('DOCUMENTO OFICIAL - CERTIFICACION ACADEMICA', 125, 48, {
            width: styledWidth - 250,
            align: 'center',
            characterSpacing: 1.5,
          });
        doc
          .font('Helvetica-Bold')
          .fontSize(23)
          .fillColor(styledPrimary)
          .text(template.academyLabel.toUpperCase(), 125, 66, {
            width: styledWidth - 250,
            align: 'center',
          });
        doc
          .moveTo(styledWidth / 2 - 70, 101)
          .lineTo(styledWidth / 2 + 70, 101)
          .lineWidth(1.5)
          .stroke(styledPrimary);
        doc.circle(styledWidth / 2, 101, 3.5).fill(styledPrimary);
        doc
          .font('Helvetica-Bold')
          .fontSize(28)
          .fillColor(styledInk)
          .text(styledTitle, 70, 122, {
            width: styledWidth - 140,
            align: 'center',
            lineGap: 2,
          });

        // Panel principal.
        doc
          .roundedRect(70, 202, styledWidth - 140, 173, 12)
          .fill('#ffffff')
          .lineWidth(1)
          .stroke('#e2e8f0');
        doc
          .font('Helvetica')
          .fontSize(12)
          .fillColor(styledMuted)
          .text('Se otorga el presente certificado a', 90, 225, {
            width: styledWidth - 180,
            align: 'center',
          });
        doc
          .font('Helvetica-Bold')
          .fontSize(29)
          .fillColor(styledInk)
          .text(styledStudentName, 90, 249, {
            width: styledWidth - 180,
            align: 'center',
          });
        doc
          .moveTo(styledWidth / 2 - 105, 296)
          .lineTo(styledWidth / 2 + 105, 296)
          .lineWidth(1)
          .stroke('#cbd5e1');
        doc
          .font('Helvetica')
          .fontSize(11)
          .fillColor(styledMuted)
          .text(
            cert.type === 'GRADES'
              ? 'Por las calificaciones obtenidas satisfactoriamente en'
              : 'Por haber completado satisfactoriamente el curso',
            90,
            310,
            { width: styledWidth - 180, align: 'center' },
          );
        doc
          .font('Helvetica-Bold')
          .fontSize(19)
          .fillColor(styledPrimary)
          .text(styledCourseName, 100, 333, {
            width: styledWidth - 200,
            align: 'center',
            lineGap: 1,
          });

        if (cert.type === 'GRADES' && cert.finalGrade !== null) {
          doc
            .roundedRect(styledWidth / 2 - 57, 365, 114, 25, 12)
            .fill(styledPrimary);
          doc
            .font('Helvetica-Bold')
            .fontSize(10)
            .fillColor('#ffffff')
            .text(
              `NOTA ${cert.finalGrade.toFixed(2)} / 20`,
              styledWidth / 2 - 57,
              373,
              {
                width: 114,
                align: 'center',
              },
            );
        }

        // Pie con fecha, QR y código.
        const styledFooterY = 418;
        doc
          .font('Helvetica-Bold')
          .fontSize(8)
          .fillColor(styledMuted)
          .text('FECHA DE EMISION', 80, styledFooterY, { width: 220 });
        doc
          .font('Helvetica')
          .fontSize(11)
          .fillColor(styledInk)
          .text(styledIssueDate, 80, styledFooterY + 14, { width: 220 });
        doc
          .font('Helvetica-Bold')
          .fontSize(8)
          .fillColor(styledMuted)
          .text('CODIGO DE VERIFICACION', styledWidth - 300, styledFooterY, {
            width: 220,
            align: 'right',
          });
        doc
          .font('Helvetica-Bold')
          .fontSize(11)
          .fillColor(styledInk)
          .text(cert.code, styledWidth - 300, styledFooterY + 14, {
            width: 220,
            align: 'right',
          });

        const styledQrX = styledWidth / 2 - 37;
        doc.image(qrBuffer, styledQrX, styledFooterY - 4, {
          width: 74,
          height: 74,
        });
        doc
          .font('Helvetica-Bold')
          .fontSize(7)
          .fillColor(styledPrimary)
          .text('ESCANEA PARA VERIFICAR', styledQrX - 28, styledFooterY + 75, {
            width: 130,
            align: 'center',
            characterSpacing: 0.5,
          });

        doc
          .moveTo(styledWidth / 2 - 75, styledHeight - 69)
          .lineTo(styledWidth / 2 + 75, styledHeight - 69)
          .lineWidth(1)
          .stroke('#cbd5e1');
        doc
          .font('Helvetica')
          .fontSize(10)
          .fillColor(styledInk)
          .text(
            template.signatureLabel,
            styledWidth / 2 - 100,
            styledHeight - 58,
            {
              width: 200,
              align: 'center',
            },
          );

        doc.end();
      } catch (err) {
        reject(
          err instanceof Error
            ? err
            : new Error('No se pudo generar el certificado'),
        );
      }
    });
  }

  /**
   * Obtiene los certificados del estudiante actual
   */
  async getMyCertificates(studentId: string) {
    return this.prisma.certificate.findMany({
      where: {
        enrollment: {
          userId: studentId,
        },
      },
      include: {
        enrollment: {
          include: {
            cohort: {
              include: { course: true },
            },
          },
        },
      },
      orderBy: { issueDate: 'desc' },
    });
  }

  /**
   * Verifica un certificado por su código único público
   */
  async verifyCertificate(code: string) {
    const certificate = await this.prisma.certificate.findUnique({
      where: { code },
      include: {
        enrollment: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true } },
            cohort: {
              include: { course: true },
            },
          },
        },
      },
    });

    if (!certificate)
      throw new NotFoundException('Certificado inválido o no encontrado');
    return certificate;
  }

  /** Genera el QR público para validar el certificado desde cualquier lector. */
  async generateVerificationQr(code: string): Promise<Buffer> {
    const certificate = await this.verifyCertificate(code);
    const frontendUrl = this.getPrimaryFrontendUrl();
    return QRCode.toBuffer(
      `${frontendUrl}/verify-certificate/${certificate.code}`,
      {
        margin: 2,
        width: 280,
        color: { dark: '#172033', light: '#ffffff' },
      },
    );
  }

  /**
   * Busca un certificado por su ID primario (para descarga PDF)
   */
  async verifyCertificateById(id: string) {
    const certificate = await this.prisma.certificate.findUnique({
      where: { id },
      include: {
        enrollment: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true } },
            cohort: {
              include: { course: true },
            },
          },
        },
      },
    });

    if (!certificate) throw new NotFoundException('Certificado no encontrado');
    return certificate;
  }

  /**
   * Lista todos los certificados (para administrador)
   */
  async getAllCertificates() {
    return this.prisma.certificate.findMany({
      include: {
        enrollment: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            cohort: {
              include: {
                course: { select: { id: true, name: true, code: true } },
              },
            },
          },
        },
        issuer: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { issueDate: 'desc' },
    });
  }

  /**
   * Obtiene matrículas completadas SIN certificado (para emisión)
   */
  async getCompletedEnrollmentsWithoutCertificate(
    afterId?: string,
    limit?: number,
  ) {
    return this.prisma.enrollment.findMany({
      where: {
        status: 'COMPLETED',
        certificates: { none: { type: 'COMPLETION' } },
        deletedAt: null,
        ...(afterId ? { id: { gt: afterId } } : {}),
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        cohort: {
          include: { course: { select: { id: true, name: true, code: true } } },
        },
      },
      orderBy: limit ? { id: 'asc' } : { completedAt: 'desc' },
      ...(limit ? { take: limit } : {}),
    });
  }

  async getCertificateTemplates() {
    const template = await this.getTemplate();
    return [
      {
        version: template.version,
        type: 'COMPLETION',
        name: 'Certificado de finalización',
        description:
          'Reconoce que el estudiante completó satisfactoriamente la cohorte.',
      },
      {
        version: template.version,
        type: 'GRADES',
        name: 'Certificado de notas',
        description: 'Muestra la nota final registrada y el curso aprobado.',
      },
    ];
  }

  private async getTemplate(): Promise<CertificateTemplateSettings> {
    const settings = await this.settingsService.getSettings();
    const template =
      settings.certificateTemplate ?? DEFAULT_CERTIFICATE_TEMPLATE;
    return {
      ...DEFAULT_CERTIFICATE_TEMPLATE,
      ...template,
      primaryColor: /^#[0-9a-f]{6}$/i.test(template.primaryColor)
        ? template.primaryColor
        : DEFAULT_CERTIFICATE_TEMPLATE.primaryColor,
    };
  }

  async generateForStudent(
    cohortId: string,
    studentId: string,
    issuerId: string,
    type: 'COMPLETION' | 'GRADES',
    issuerRoles: string[],
  ) {
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { cohortId, userId: studentId, deletedAt: null },
      select: { id: true },
    });
    if (!enrollment)
      throw new NotFoundException(
        'El estudiante no está matriculado en esta cohorte.',
      );
    return this.generateManualCertificate(
      enrollment.id,
      issuerId,
      type,
      issuerRoles,
    );
  }

  private async getAcademicSnapshot(enrollmentId: string) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      select: { userId: true, cohortId: true },
    });
    if (!enrollment) throw new NotFoundException('Matrícula no encontrada');

    const evaluations = await this.prisma.evaluation.findMany({
      where: { cohortId: enrollment.cohortId, deletedAt: null },
      select: {
        id: true,
        weight: true,
        maxScore: true,
        deliverables: {
          where: { studentId: enrollment.userId, deletedAt: null },
          select: {
            grade: { select: { score: true, status: true, deletedAt: true } },
          },
        },
      },
    });
    const missing = evaluations.filter((evaluation) => {
      const grade = evaluation.deliverables[0]?.grade;
      return !grade || grade.deletedAt || grade.status !== 'PUBLISHED';
    });
    const totalWeight = evaluations.reduce(
      (sum, evaluation) => sum + evaluation.weight,
      0,
    );
    const weightedScore = evaluations.reduce((sum, evaluation) => {
      const grade = evaluation.deliverables[0]?.grade;
      if (!grade || grade.deletedAt || grade.status !== 'PUBLISHED') return sum;
      return (
        sum + (grade.score / (evaluation.maxScore || 20)) * evaluation.weight
      );
    }, 0);
    const finalGrade =
      totalWeight > 0
        ? Math.round((weightedScore / totalWeight) * 20 * 100) / 100
        : null;
    const attendances = await this.prisma.classAttendance.findMany({
      where: { cohortId: enrollment.cohortId, studentId: enrollment.userId },
      select: { isPresent: true },
    });
    const attendanceRate =
      attendances.length > 0
        ? Math.round(
            (attendances.filter((attendance) => attendance.isPresent).length /
              attendances.length) *
              10000,
          ) / 100
        : 100;
    const ready =
      evaluations.length === 0 ||
      (missing.length === 0 && (finalGrade ?? 0) >= 13);
    return {
      finalGrade,
      attendanceRate,
      readyForGradesCertificate: evaluations.length > 0 && ready,
      readyForCompletionCertificate: ready,
      reason:
        missing.length > 0
          ? `Faltan ${missing.length} calificación(es) publicada(s).`
          : finalGrade !== null && finalGrade < 13
            ? 'La nota final mínima para aprobar es 13.'
            : undefined,
    };
  }

  private generateUniqueCode(): string {
    // ej: CERT-A1B2C3D4
    const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `CERT-${randomHex}`;
  }
}

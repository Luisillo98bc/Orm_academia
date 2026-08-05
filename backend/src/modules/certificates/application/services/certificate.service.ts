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

@Injectable()
export class CertificateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  /**
   * Genera un certificado manualmente por un Administrador
   */
  async generateManualCertificate(enrollmentId: string, issuerId: string) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        certificate: true,
        user: true,
        cohort: { include: { course: true } },
      },
    });

    if (!enrollment) throw new NotFoundException('Matrícula no encontrada');
    if (enrollment.certificate)
      throw new BadRequestException(
        'El estudiante ya cuenta con un certificado para este curso',
      );

    const code = this.generateUniqueCode();

    const certificate = await this.prisma.certificate.create({
      data: {
        code,
        enrollmentId,
        issuedBy: issuerId,
      },
    });

    // Actualizar estado de matrícula si no estaba completada
    if (enrollment.status !== 'COMPLETED') {
      await this.prisma.enrollment.update({
        where: { id: enrollmentId },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
    }

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
        certificate: true,
        user: true,
        cohort: { include: { course: true } },
      },
    });

    if (!enrollment) throw new NotFoundException('Matrícula no encontrada');
    if (enrollment.certificate) return enrollment.certificate; // Ya lo tiene

    const code = this.generateUniqueCode();

    const certificate = await this.prisma.certificate.create({
      data: {
        code,
        enrollmentId,
        issuedBy: null, // Automático
      },
    });

    if (enrollment.status !== 'COMPLETED') {
      await this.prisma.enrollment.update({
        where: { id: enrollmentId },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
    }

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
   * Genera el buffer PDF del certificado con QR de verificación
   */
  async generateCertificatePdf(certificateCode: string): Promise<Buffer> {
    const cert = await this.verifyCertificate(certificateCode);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
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
          margin: 50,
        });

        const buffers: Buffer[] = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          resolve(Buffer.concat(buffers));
        });

        // Borde decorativo
        doc
          .rect(20, 20, doc.page.width - 40, doc.page.height - 40)
          .lineWidth(10)
          .stroke('#0ea5e9');

        doc
          .rect(35, 35, doc.page.width - 70, doc.page.height - 70)
          .lineWidth(2)
          .stroke('#e2e8f0');

        // Título de la Academia
        doc
          .fontSize(24)
          .fillColor('#0ea5e9')
          .text('ACADEMIA VIRTUAL', { align: 'center' })
          .moveDown(1);

        // Subtítulo
        doc
          .fontSize(36)
          .fillColor('#334155')
          .text('CERTIFICADO DE FINALIZACIÓN', { align: 'center' })
          .moveDown(1);

        // Otorga a
        doc
          .fontSize(16)
          .fillColor('#64748b')
          .text('Se otorga el presente certificado a:', { align: 'center' })
          .moveDown(0.5);

        // Nombre del Alumno
        const studentName = `${cert.enrollment.user.firstName} ${cert.enrollment.user.lastName}`;
        doc
          .fontSize(32)
          .fillColor('#0f172a')
          .text(studentName, { align: 'center' })
          .moveDown(0.5);

        // Por haber completado
        doc
          .fontSize(16)
          .fillColor('#64748b')
          .text('Por haber completado satisfactoriamente el curso de:', {
            align: 'center',
          })
          .moveDown(0.5);

        // Nombre del Curso
        const courseName = cert.enrollment.cohort.course?.name || 'Curso';
        doc
          .fontSize(24)
          .fillColor('#0ea5e9')
          .text(courseName, { align: 'center' })
          .moveDown(1.5);

        // Footer info (Fecha y Código)
        const issueDate = new Date(cert.issueDate).toLocaleDateString('es-ES', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });

        const bottomY = doc.page.height - 120;

        doc
          .fontSize(12)
          .fillColor('#94a3b8')
          .text(`Fecha de Emisión: ${issueDate}`, 50, bottomY, {
            align: 'left',
          });

        // Estampar Código QR de verificación
        doc.image(qrBuffer, doc.page.width / 2 - 35, bottomY - 30, {
          width: 70,
          height: 70,
        });

        doc
          .fontSize(12)
          .fillColor('#94a3b8')
          .text(
            `ID de Certificado: ${cert.code}`,
            doc.page.width - 250,
            bottomY,
            { align: 'right' },
          );

        doc.end();
      } catch (err) {
        reject(err);
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
  async getCompletedEnrollmentsWithoutCertificate() {
    return this.prisma.enrollment.findMany({
      where: {
        status: 'COMPLETED',
        certificate: null,
        deletedAt: null,
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        cohort: {
          include: { course: { select: { id: true, name: true, code: true } } },
        },
      },
      orderBy: { completedAt: 'desc' },
    });
  }

  private generateUniqueCode(): string {
    // ej: CERT-A1B2C3D4
    const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `CERT-${randomHex}`;
  }
}

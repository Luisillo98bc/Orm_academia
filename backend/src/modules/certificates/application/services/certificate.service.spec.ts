import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CertificateService } from './certificate.service';

describe('CertificateService', () => {
  const prisma = {
    enrollment: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    certificate: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    evaluation: { findMany: jest.fn() },
    classAttendance: { findMany: jest.fn() },
  };
  const mailService = { sendCertificateEmail: jest.fn() };
  const settingsService = { getSettings: jest.fn() };
  let service: CertificateService;

  const settings = {
    certificateTemplate: {
      version: 'v2',
      primaryColor: '#123456',
      academyLabel: 'Academia Virtual',
      completionTitle: 'Certificado de finalización',
      gradesTitle: 'Certificado de notas',
      signatureLabel: 'Dirección Académica',
    },
  };

  beforeEach(() => {
    jest.resetAllMocks();
    settingsService.getSettings.mockResolvedValue(settings);
    mailService.sendCertificateEmail.mockResolvedValue(true);
    service = new CertificateService(
      prisma as never,
      mailService as never,
      settingsService as never,
    );
  });

  it('consulta certificados públicos, propios y administrativos', async () => {
    prisma.certificate.findMany
      .mockResolvedValueOnce([{ id: 'mine' }])
      .mockResolvedValueOnce([{ id: 'all' }])
      .mockResolvedValueOnce([{ id: 'pending' }]);
    prisma.certificate.findUnique
      .mockResolvedValueOnce({ id: 'certificate-1' })
      .mockResolvedValueOnce({ id: 'certificate-2' });
    prisma.enrollment.findMany.mockResolvedValue([{ id: 'enrollment-1' }]);

    await expect(service.getMyCertificates('student-1')).resolves.toEqual([
      { id: 'mine' },
    ]);
    await expect(service.verifyCertificate('CERT-1234')).resolves.toEqual({
      id: 'certificate-1',
    });
    await expect(
      service.verifyCertificateById('certificate-2'),
    ).resolves.toEqual({
      id: 'certificate-2',
    });
    await expect(service.getAllCertificates()).resolves.toEqual([
      { id: 'all' },
    ]);
    await expect(
      service.getCompletedEnrollmentsWithoutCertificate(),
    ).resolves.toEqual([{ id: 'enrollment-1' }]);
  });

  it('rechaza certificados inexistentes y duplicados', async () => {
    prisma.certificate.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    await expect(service.verifyCertificate('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      service.verifyCertificateById('missing'),
    ).rejects.toBeInstanceOf(NotFoundException);

    prisma.enrollment.findUnique.mockResolvedValue({
      certificates: [{ type: 'COMPLETION' }],
      user: {},
      cohort: { teachers: [], course: {} },
    });
    await expect(
      service.generateManualCertificate('enrollment-1', 'admin-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('expone las plantillas y normaliza un color inválido', async () => {
    settingsService.getSettings.mockResolvedValue({
      certificateTemplate: {
        ...settings.certificateTemplate,
        primaryColor: 'red',
      },
    });

    await expect(service.getCertificateTemplates()).resolves.toEqual([
      expect.objectContaining({ version: 'v2', type: 'COMPLETION' }),
      expect.objectContaining({ version: 'v2', type: 'GRADES' }),
    ]);
  });

  it('genera un certificado manual y actualiza una matrícula pendiente', async () => {
    prisma.enrollment.findUnique
      .mockResolvedValueOnce({
        id: 'enrollment-1',
        status: 'ACTIVE',
        certificates: [],
        user: { email: 'student@test.com', firstName: 'Ana' },
        cohort: {
          course: { name: 'Curso 1' },
          teachers: [{ id: 'teacher-1' }],
        },
      })
      .mockResolvedValueOnce({ userId: 'student-1', cohortId: 'cohort-1' });
    prisma.evaluation.findMany.mockResolvedValue([]);
    prisma.classAttendance.findMany.mockResolvedValue([]);
    prisma.enrollment.update.mockResolvedValue({ id: 'enrollment-1' });
    prisma.certificate.create.mockResolvedValue({ code: 'CERT-ABCD1234' });
    mailService.sendCertificateEmail.mockRejectedValue(new Error('smtp down'));

    await expect(
      service.generateManualCertificate(
        'enrollment-1',
        'admin-1',
        'COMPLETION',
        ['ADMIN'],
      ),
    ).resolves.toEqual({ code: 'CERT-ABCD1234' });
    expect(prisma.enrollment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'enrollment-1' },
        data: expect.objectContaining({
          status: 'COMPLETED',
        }) as jest.AsymmetricMatcher,
      }),
    );
    expect(mailService.sendCertificateEmail).toHaveBeenCalled();
  });

  it('genera automáticamente solo cuando la matrícula cumple requisitos', async () => {
    const enrollment = {
      status: 'COMPLETED',
      certificates: [],
      user: { email: 'student@test.com', firstName: 'Ana' },
      cohort: { course: { name: 'Curso 1' }, teachers: [] },
    };
    prisma.enrollment.findUnique
      .mockResolvedValueOnce(enrollment)
      .mockResolvedValueOnce({ userId: 'student-1', cohortId: 'cohort-1' });
    prisma.evaluation.findMany.mockResolvedValue([]);
    prisma.classAttendance.findMany.mockResolvedValue([]);
    prisma.certificate.create.mockResolvedValue({ code: 'CERT-AUTO123' });

    await expect(
      service.generateAutoCertificate('enrollment-1'),
    ).resolves.toEqual({
      code: 'CERT-AUTO123',
    });

    prisma.enrollment.findUnique.mockResolvedValue({
      ...enrollment,
      certificates: [{ type: 'COMPLETION', code: 'CERT-OLD' }],
    });
    await expect(
      service.generateAutoCertificate('enrollment-1'),
    ).resolves.toEqual({
      type: 'COMPLETION',
      code: 'CERT-OLD',
    });
  });

  it('genera certificados de notas y tolera fallos del correo', async () => {
    prisma.enrollment.findFirst.mockResolvedValue({ id: 'enrollment-1' });
    prisma.enrollment.findUnique
      .mockResolvedValueOnce({
        id: 'enrollment-1',
        status: 'COMPLETED',
        certificates: [],
        user: { email: 'student@test.com', firstName: 'Ana' },
        cohort: { course: { name: 'Curso 1' }, teachers: [] },
      })
      .mockResolvedValueOnce({ userId: 'student-1', cohortId: 'cohort-1' });
    prisma.evaluation.findMany.mockResolvedValue([
      {
        weight: 100,
        maxScore: 20,
        deliverables: [
          { grade: { score: 18, status: 'PUBLISHED', deletedAt: null } },
        ],
      },
    ]);
    prisma.classAttendance.findMany.mockResolvedValue([{ isPresent: true }]);
    prisma.certificate.create.mockResolvedValue({ code: 'CERT-GRADES123' });
    mailService.sendCertificateEmail.mockRejectedValue(new Error('smtp down'));

    await expect(
      service.generateForStudent('cohort-1', 'student-1', 'admin-1', 'GRADES', [
        'ADMIN',
      ]),
    ).resolves.toEqual({ code: 'CERT-GRADES123' });
  });

  it('genera un PDF verificable con QR y datos de notas', async () => {
    prisma.certificate.findUnique.mockResolvedValue({
      code: 'CERT-PDF1234',
      type: 'GRADES',
      finalGrade: 18.5,
      issueDate: new Date('2026-08-26T00:00:00.000Z'),
      enrollment: {
        user: { firstName: 'Ana', lastName: 'Prueba' },
        cohort: { course: { name: 'Curso 1' } },
      },
    });

    const pdf = await service.generateCertificatePdf('CERT-PDF1234');

    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.length).toBeGreaterThan(100);
  });

  it('cubre permisos, matrículas incompletas y certificados de notas no listos', async () => {
    prisma.enrollment.findUnique.mockResolvedValue(null);
    const getAcademicSnapshot = (
      service as unknown as {
        getAcademicSnapshot: (id: string) => Promise<unknown>;
      }
    ).getAcademicSnapshot.bind(service);
    await expect(getAcademicSnapshot('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    prisma.enrollment.findFirst.mockResolvedValue(null);
    await expect(
      service.generateForStudent(
        'cohort-1',
        'student-1',
        'admin-1',
        'COMPLETION',
        ['ADMIN'],
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    prisma.enrollment.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.generateManualCertificate('missing', 'admin-1'),
    ).rejects.toBeInstanceOf(NotFoundException);

    prisma.enrollment.findUnique.mockResolvedValueOnce({
      id: 'enrollment-1',
      certificates: [],
      user: { email: 'student@test.com', firstName: 'Ana' },
      cohort: { course: { name: 'Course' }, teachers: [{ id: 'teacher-1' }] },
    });
    await expect(
      service.generateManualCertificate(
        'enrollment-1',
        'other-teacher',
        'COMPLETION',
        ['DOCENTE'],
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    prisma.enrollment.findUnique
      .mockResolvedValueOnce({
        id: 'enrollment-1',
        status: 'ACTIVE',
        certificates: [],
        user: { email: 'student@test.com', firstName: 'Ana' },
        cohort: { course: { name: 'Course' }, teachers: [] },
      })
      .mockResolvedValueOnce({ userId: 'student-1', cohortId: 'cohort-1' });
    prisma.evaluation.findMany.mockResolvedValue([
      { weight: 1, maxScore: 20, deliverables: [{ grade: null }] },
    ]);
    prisma.classAttendance.findMany.mockResolvedValue([]);
    await expect(
      service.generateManualCertificate(
        'enrollment-1',
        'admin-1',
        'COMPLETION',
        ['ADMIN'],
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    prisma.enrollment.findUnique
      .mockResolvedValueOnce({
        id: 'enrollment-1',
        certificates: [],
        user: { email: 'student@test.com', firstName: 'Ana' },
        cohort: { course: { name: 'Course' }, teachers: [] },
      })
      .mockResolvedValueOnce({ userId: 'student-1', cohortId: 'cohort-1' });
    prisma.evaluation.findMany.mockResolvedValue([
      { weight: 1, maxScore: 20, deliverables: [{ grade: null }] },
    ]);
    prisma.classAttendance.findMany.mockResolvedValue([{ isPresent: false }]);
    await expect(
      service.generateManualCertificate('enrollment-1', 'admin-1', 'GRADES', [
        'ADMIN',
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);

    prisma.enrollment.findUnique.mockResolvedValue({
      status: 'ACTIVE',
      certificates: [],
      user: { email: 'student@test.com', firstName: 'Ana' },
      cohort: { course: { name: 'Course' }, teachers: [] },
    });
    await expect(
      service.generateAutoCertificate('enrollment-1'),
    ).rejects.toBeInstanceOf(BadRequestException);

    prisma.enrollment.findUnique
      .mockResolvedValueOnce({
        status: 'COMPLETED',
        certificates: [],
        user: { email: 'student@test.com', firstName: 'Ana' },
        cohort: { course: { name: 'Course' }, teachers: [] },
      })
      .mockResolvedValueOnce({ userId: 'student-1', cohortId: 'cohort-1' });
    prisma.evaluation.findMany.mockResolvedValue([
      { weight: 1, maxScore: 20, deliverables: [{ grade: null }] },
    ]);
    await expect(
      service.generateAutoCertificate('enrollment-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('genera un QR PNG para la verificaciÃ³n pÃºblica', async () => {
    jest
      .spyOn(service, 'verifyCertificate')
      .mockResolvedValue({ code: 'CERT-QR-123' } as never);
    const qr = await service.generateVerificationQr('CERT-QR-123');
    expect(qr.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  });
});

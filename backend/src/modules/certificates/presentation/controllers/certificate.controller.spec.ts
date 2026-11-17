import { BadRequestException } from '@nestjs/common';
import { CertificateController } from './certificate.controller';
import type { CertificateService } from '../../application/services/certificate.service';

describe('CertificateController', () => {
  let controller: CertificateController;
  let service: Record<string, jest.Mock>;
  const user = {
    id: 'user-1',
    email: 'user@example.com',
    roles: ['ADMIN'],
    permissions: [],
  };

  beforeEach(() => {
    service = {
      getAllCertificates: jest.fn().mockResolvedValue([]),
      getCompletedEnrollmentsWithoutCertificate: jest
        .fn()
        .mockResolvedValue([]),
      getCertificateTemplates: jest.fn().mockResolvedValue([]),
      generateManualCertificate: jest
        .fn()
        .mockResolvedValue({ code: 'CERT-1' }),
      generateForStudent: jest.fn().mockResolvedValue({ code: 'CERT-2' }),
      generateAutoCertificate: jest.fn().mockResolvedValue({ code: 'CERT-3' }),
      getMyCertificates: jest.fn().mockResolvedValue([]),
      generateCertificatePdf: jest.fn().mockResolvedValue(Buffer.from('pdf')),
      verifyCertificate: jest.fn().mockResolvedValue({ valid: true }),
    };
    controller = new CertificateController(
      service as unknown as CertificateService,
    );
  });

  it('delegates certificate listings and templates', async () => {
    await expect(controller.getAll()).resolves.toMatchObject({
      statusCode: 200,
      data: [],
    });
    await expect(controller.getPending()).resolves.toMatchObject({
      statusCode: 200,
      data: [],
    });
    await expect(controller.getTemplates()).resolves.toMatchObject({
      statusCode: 200,
      data: [],
    });
    await expect(controller.getMyCertificates(user)).resolves.toMatchObject({
      statusCode: 200,
      data: [],
    });
    expect(service.getMyCertificates).toHaveBeenCalledWith('user-1');
  });

  it('issues manual, student and automatic certificates', async () => {
    await expect(
      controller.issueManualCertificate('enrollment-1', 'GRADES', user),
    ).resolves.toMatchObject({ statusCode: 201 });
    await expect(
      controller.issueForStudent('cohort-1', 'student-1', 'COMPLETION', user),
    ).resolves.toMatchObject({ statusCode: 201 });
    await expect(
      controller.issueAutoCertificate('enrollment-1'),
    ).resolves.toMatchObject({ statusCode: 201 });
    expect(service.generateManualCertificate).toHaveBeenCalledWith(
      'enrollment-1',
      'user-1',
      'GRADES',
      ['ADMIN'],
    );
    expect(service.generateForStudent).toHaveBeenCalledWith(
      'cohort-1',
      'student-1',
      'user-1',
      'COMPLETION',
      ['ADMIN'],
    );
    expect(service.generateAutoCertificate).toHaveBeenCalledWith(
      'enrollment-1',
    );
  });

  it('rejects invalid certificate types', async () => {
    await expect(
      controller.issueManualCertificate(
        'enrollment-1',
        'INVALID' as never,
        user,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      controller.issueForStudent(
        'cohort-1',
        'student-1',
        'INVALID' as never,
        user,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('writes PDF responses and verifies public certificates', async () => {
    const response = { set: jest.fn(), end: jest.fn() };
    await controller.downloadPdf('CERT-1', response as never);
    await expect(controller.verifyCertificate('CERT-1')).resolves.toMatchObject(
      { statusCode: 200, data: { valid: true } },
    );
    expect(response.set).toHaveBeenCalledWith(
      expect.objectContaining({
        'Content-Type': 'application/pdf',
        'Content-Length': 3,
      }),
    );
    expect(response.end).toHaveBeenCalledWith(Buffer.from('pdf'));
    expect(service.verifyCertificate).toHaveBeenCalledWith('CERT-1');
  });
});

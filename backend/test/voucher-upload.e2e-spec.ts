import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import type {
  CanActivate,
  ExecutionContext,
  INestApplication,
} from '@nestjs/common';
import { createServer, type Server, type Socket } from 'node:net';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { PaymentsController } from '../src/modules/academic/presentation/controllers/payments.controller';
import { PaymentsService } from '../src/modules/academic/application/services/payments.service';
import { StorageService } from '../src/shared/infrastructure/storage/storage.service';
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { JwtAuthGuard } from '../src/modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../src/modules/auth/infrastructure/guards/roles.guard';
import { PermissionsGuard } from '../src/modules/auth/infrastructure/guards/permissions.guard';

describe('Voucher multipart and antivirus integration', () => {
  let app: INestApplication;
  let scanner: Server | undefined;
  let root: string;
  let closeWithoutResult = false;
  const sockets = new Set<Socket>();
  const uploadVoucher = jest
    .fn<Promise<{ voucherUrl: string }>, [string, string, string]>()
    .mockImplementation((_id, voucherUrl) => Promise.resolve({ voucherUrl }));

  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), 'academia-voucher-test-'));
    let port = Number(process.env.CLAMAV_E2E_PORT || 3310);
    if (!process.env.CLAMAV_E2E_HOST) {
      scanner = createServer((socket) => {
        sockets.add(socket);
        socket.on('close', () => sockets.delete(socket));
        let data = Buffer.alloc(0);
        socket.on('data', (chunk) => {
          if (closeWithoutResult) {
            socket.end();
            return;
          }
          data = Buffer.concat([data, chunk]);
          const command = Buffer.from('zINSTREAM\0');
          if (data.length < command.length + 4) return;
          if (!data.subarray(0, command.length).equals(command)) {
            socket.end('UNKNOWN COMMAND\0');
            return;
          }
          const length = data.readUInt32BE(command.length);
          if (data.length >= command.length + 4 + length + 4)
            socket.end('stream: OK\0');
        });
      });
      await new Promise<void>((resolve) =>
        scanner!.listen(0, '127.0.0.1', resolve),
      );
      port = (scanner.address() as { port: number }).port;
    }
    const guard: CanActivate = {
      canActivate(context: ExecutionContext) {
        context
          .switchToHttp()
          .getRequest<{ user: { id: string; roles: string[] } }>().user = {
          id: 'fixture-student',
          roles: ['ESTUDIANTE'],
        };
        return true;
      },
    };
    const module = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        StorageService,
        {
          provide: ConfigService,
          useValue: new ConfigService({
            STORAGE_PROVIDER: 'local',
            PRIVATE_STORAGE_DIR: root,
            CLAMAV_REQUIRED: 'true',
            CLAMAV_HOST: process.env.CLAMAV_E2E_HOST || '127.0.0.1',
            CLAMAV_PORT: port,
          }),
        },
        { provide: PrismaService, useValue: {} },
        {
          provide: PaymentsService,
          useValue: {
            uploadVoucher,
            assertVoucherUploadAllowed: jest
              .fn()
              .mockResolvedValue({ voucherUrl: null }),
          },
        },
        { provide: AuditService, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(guard)
      .overrideGuard(RolesGuard)
      .useValue(guard)
      .overrideGuard(PermissionsGuard)
      .useValue(guard)
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    for (const socket of sockets) socket.destroy();
    if (scanner)
      await new Promise<void>((resolve) => scanner!.close(() => resolve()));
    rmSync(root, { recursive: true, force: true });
  });

  it.each([
    [
      'voucher.pdf',
      'application/pdf',
      Buffer.from('%PDF-1.7\nfixture payment receipt\n%%EOF'),
    ],
    [
      'voucher.png',
      'image/png',
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8x8AAAAASUVORK5CYII=',
        'base64',
      ),
    ],
  ])(
    'scans and saves %s before returning success',
    async (name, contentType, buffer) => {
      const response = await request(
        app.getHttpServer() as Parameters<typeof request>[0],
      )
        .post('/api/v1/payments/fixture-payment/voucher')
        .attach('file', buffer, { filename: name, contentType })
        .timeout(10000)
        .expect(201);
      const body = response.body as { voucherUrl: string };
      expect(body.voucherUrl).toMatch(/^storage:\/\/local\/vouchers\//);
      expect(
        readFileSync(join(root, 'vouchers', body.voucherUrl.split('/').pop()!)),
      ).toEqual(buffer);
      expect(uploadVoucher).toHaveBeenLastCalledWith(
        'fixture-payment',
        body.voucherUrl,
        'fixture-student',
      );
    },
  );

  (process.env.CLAMAV_E2E_HOST ? it.skip : it)(
    'returns 503 promptly when the scanner closes without a result',
    async () => {
      closeWithoutResult = true;
      try {
        await request(app.getHttpServer() as Parameters<typeof request>[0])
          .post('/api/v1/payments/fixture-payment/voucher')
          .attach('file', Buffer.from('%PDF-1.7\nfixture'), {
            filename: 'voucher.pdf',
            contentType: 'application/pdf',
          })
          .timeout(2000)
          .expect(503);
      } finally {
        closeWithoutResult = false;
      }
    },
  );
});

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { EnrollmentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as net from 'net';

export type StorageDownloadTarget =
  | { kind: 'redirect'; url: string }
  | { kind: 'local'; filePath: string }
  | {
      kind: 'stream';
      body: NodeJS.ReadableStream;
      contentType?: string;
      contentLength?: number;
    };

export const PUBLIC_STORAGE_BUCKETS = new Set([
  'avatars',
  'courses',
  'cohorts',
]);
const PRIVATE_STORAGE_BUCKETS = new Set([
  'materials',
  'vouchers',
  'deliverables',
]);

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private supabaseClient: SupabaseClient | null = null;
  private minioClient: S3Client | null = null;
  private provider: 'local' | 'supabase' | 'minio' = 'local';
  private readonly privateStorageRoot: string;
  private readonly clamavHost: string | undefined;
  private readonly clamavPort: number;
  private readonly clamavRequired: boolean;
  private readonly storageBucketQuotaBytes: number;

  constructor(
    private configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.clamavHost =
      this.configService.get<string>('CLAMAV_HOST')?.trim() || undefined;
    this.clamavPort = Number(this.configService.get('CLAMAV_PORT', 3310));
    this.clamavRequired =
      this.configService.get<string>('CLAMAV_REQUIRED', 'false') === 'true';
    this.storageBucketQuotaBytes = Number(
      this.configService.get('STORAGE_BUCKET_QUOTA_BYTES', 0),
    );
    this.privateStorageRoot = path.resolve(
      this.configService.get<string>(
        'PRIVATE_STORAGE_DIR',
        path.join(process.cwd(), 'private-uploads'),
      ),
    );
    const provider = this.configService
      .get<string>('STORAGE_PROVIDER', 'local')
      .trim()
      .toLowerCase();
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey =
      this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') ||
      this.configService.get<string>('SUPABASE_ANON_KEY');

    if (provider === 'supabase' && supabaseUrl && supabaseKey) {
      this.provider = 'supabase';
      this.supabaseClient = createClient(supabaseUrl, supabaseKey);
      this.logger.log('✅ StorageService inicializado con Supabase Storage');
    } else if (provider === 'minio') {
      const endpoint = this.configService.get<string>('MINIO_ENDPOINT');
      const accessKey = this.configService.get<string>('MINIO_ACCESS_KEY');
      const secretKey = this.configService.get<string>('MINIO_SECRET_KEY');
      if (endpoint && accessKey && secretKey) {
        this.provider = 'minio';
        this.minioClient = new S3Client({
          endpoint,
          region: this.configService.get<string>('MINIO_REGION', 'us-east-1'),
          forcePathStyle:
            this.configService.get<string>('MINIO_FORCE_PATH_STYLE', 'true') ===
            'true',
          credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
        });
        this.logger.log('✅ StorageService inicializado con MinIO/S3');
      } else {
        throw new Error(
          'STORAGE_PROVIDER=minio requiere MINIO_ENDPOINT, MINIO_ACCESS_KEY y MINIO_SECRET_KEY',
        );
      }
    } else {
      this.provider = 'local';
      this.logger.log(
        '📁 StorageService inicializado con Almacenamiento Local (uploads/)',
      );
    }
  }

  async uploadFile(
    file: Express.Multer.File,
    bucketName: string = 'uploads',
  ): Promise<string> {
    this.validateFile(file);
    await this.scanWithClamAv(file);
    await this.assertBucketQuota(file, bucketName);
    const extension = path.extname(file.originalname);
    const fileName = `${crypto.randomUUID()}${extension}`;

    if (this.provider === 'supabase' && this.supabaseClient) {
      const fileBuffer = file.buffer || fs.readFileSync(file.path);
      const { error } = await this.supabaseClient.storage
        .from(bucketName)
        .upload(fileName, fileBuffer, {
          contentType: file.mimetype,
          upsert: true,
        });

      if (error) {
        this.logger.error(
          `Error subiendo archivo a Supabase Storage bucket [${bucketName}]: ${error.message}`,
        );
        throw error;
      }

      this.removeTemporaryUpload(file);
      return `storage://supabase/${bucketName}/${fileName}`;
    } else if (this.provider === 'minio' && this.minioClient) {
      const bodyStreamOrBuffer = file.buffer || fs.createReadStream(file.path);
      try {
        await this.minioClient.send(
          new PutObjectCommand({
            Bucket: bucketName,
            Key: fileName,
            Body: bodyStreamOrBuffer,
            ContentType: file.mimetype,
            ...(typeof file.size === 'number' && file.size > 0
              ? { ContentLength: file.size }
              : {}),
          }),
        );
        return `storage://minio/${bucketName}/${fileName}`;
      } finally {
        this.removeTemporaryUpload(file);
      }
    } else {
      const uploadDir = path.join(this.privateStorageRoot, bucketName);
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const filePath = path.join(uploadDir, fileName);
      if (file.buffer) {
        fs.writeFileSync(filePath, file.buffer);
      } else if (
        file.path &&
        path.resolve(file.path) !== path.resolve(filePath)
      ) {
        try {
          fs.renameSync(file.path, filePath);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error;
          // Uploads and private storage can live on separate Docker volumes.
          fs.copyFileSync(file.path, filePath, fs.constants.COPYFILE_EXCL);
          fs.unlinkSync(file.path);
        }
      }

      return `storage://local/${bucketName}/${fileName}`;
    }
  }

  async deleteFile(reference: string): Promise<void> {
    const parsed = this.parseReference(reference);
    if (parsed.provider !== this.provider) {
      throw new BadRequestException(
        'El archivo pertenece a otro almacenamiento',
      );
    }
    if (this.provider === 'minio' && this.minioClient) {
      await this.minioClient.send(
        new DeleteObjectCommand({ Bucket: parsed.bucket, Key: parsed.key }),
      );
    } else if (this.provider === 'supabase' && this.supabaseClient) {
      const { error } = await this.supabaseClient.storage
        .from(parsed.bucket)
        .remove([parsed.key]);
      if (error) throw error;
    } else {
      await fs.promises.rm(
        path.join(this.privateStorageRoot, parsed.bucket, parsed.key),
        { force: true },
      );
    }
  }

  private voucherReferenceFilter(reference: string) {
    return {
      OR: [
        { voucherUrl: reference },
        { installmentHistory: { array_contains: [{ voucherUrl: reference }] } },
      ],
    };
  }

  private async assertBucketQuota(
    file: Express.Multer.File,
    bucketName: string,
  ): Promise<void> {
    if (
      this.storageBucketQuotaBytes <= 0 ||
      this.provider !== 'minio' ||
      !this.minioClient
    ) {
      return;
    }

    const fileSize = file.size ?? file.buffer?.length ?? 0;
    let totalBytes = 0;
    let continuationToken: string | undefined;

    try {
      do {
        const result = await this.minioClient.send(
          new ListObjectsV2Command({
            Bucket: bucketName,
            ContinuationToken: continuationToken,
          }),
        );
        totalBytes += (result.Contents ?? []).reduce(
          (sum, object) => sum + (object.Size ?? 0),
          0,
        );
        continuationToken = result.IsTruncated
          ? result.NextContinuationToken
          : undefined;
      } while (continuationToken);
    } catch (error) {
      this.removeTemporaryUpload(file);
      throw new ServiceUnavailableException(
        `No se pudo comprobar la cuota de almacenamiento: ${error instanceof Error ? error.message : 'error desconocido'}`,
      );
    }

    if (totalBytes + fileSize > this.storageBucketQuotaBytes) {
      this.removeTemporaryUpload(file);
      throw new PayloadTooLargeException(
        `La cuota de almacenamiento del bucket ${bucketName} fue excedida`,
      );
    }
  }

  private async scanWithClamAv(file: Express.Multer.File): Promise<void> {
    if (!this.clamavHost) {
      if (this.clamavRequired) {
        throw new ServiceUnavailableException(
          'El antivirus de archivos no está configurado',
        );
      }
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const socket = net.createConnection({
        host: this.clamavHost,
        port: this.clamavPort,
      });
      let source: fs.ReadStream | null = null;
      let response = '';
      let settled = false;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        source?.destroy();
        socket.destroy();
        if (error) reject(error);
        else resolve();
      };

      socket.setTimeout(120_000, () =>
        finish(
          new ServiceUnavailableException(
            'El antivirus agotó el tiempo de espera',
          ),
        ),
      );
      socket.on('data', (chunk: Buffer) => {
        response += chunk.toString('utf8');
        if (/FOUND/i.test(response)) {
          finish(
            new BadRequestException(
              'El archivo fue rechazado por el antivirus',
            ),
          );
        } else if (/ERROR/i.test(response)) {
          finish(
            new ServiceUnavailableException(
              'El antivirus no pudo analizar el archivo',
            ),
          );
        } else if (/OK/i.test(response)) {
          finish();
        }
      });
      socket.on('error', (error) => {
        finish(
          new ServiceUnavailableException(
            `No se pudo contactar al antivirus: ${error.message}`,
          ),
        );
      });
      socket.on('close', () => {
        if (!settled) {
          finish(
            new ServiceUnavailableException(
              'El antivirus cerró la conexión sin confirmar el análisis. Intenta subir el archivo nuevamente.',
            ),
          );
        }
      });
      socket.on('connect', () => {
        if (settled) return;
        socket.write('zINSTREAM\0');
        source = file.buffer
          ? null
          : file.path
            ? fs.createReadStream(file.path)
            : null;
        const sendChunk = (chunk: Buffer) => {
          const size = Buffer.alloc(4);
          size.writeUInt32BE(chunk.length, 0);
          socket.write(size);
          socket.write(chunk);
        };
        if (file.buffer) {
          sendChunk(file.buffer);
          socket.write(Buffer.alloc(4));
        } else if (source) {
          source.on('data', sendChunk);
          source.on('end', () => socket.write(Buffer.alloc(4)));
          source.on('error', (error) => finish(error));
        } else {
          finish(new BadRequestException('El archivo no pudo ser leído'));
        }
      });
    });
  }

  private readHeaderBytes(filePath: string, maxBytes = 4096): Buffer | null {
    if (!fs.existsSync(filePath)) return null;
    const fd = fs.openSync(filePath, 'r');
    try {
      const buffer = Buffer.alloc(maxBytes);
      const bytesRead = fs.readSync(fd, buffer, 0, maxBytes, 0);
      return buffer.subarray(0, bytesRead);
    } finally {
      fs.closeSync(fd);
    }
  }

  /**
   * Valida que el contenido real coincida con la extensión declarada.
   * Multer valida MIME/extensión, pero ambos valores pueden falsificarse.
   */
  validateFile(file: Express.Multer.File): void {
    const extension = path.extname(file.originalname).slice(1).toLowerCase();
    const bytes = file.buffer
      ? file.buffer
      : file.path
        ? this.readHeaderBytes(file.path, 4096)
        : null;

    if (!bytes || bytes.length === 0) {
      this.rejectFile(file, 'El archivo está vacío o no pudo leerse');
    }

    const startsWith = (...signature: number[]) =>
      signature.every((value, index) => bytes[index] === value);
    const asciiAt = (offset: number, value: string) =>
      Buffer.from(value).every((byte, index) => bytes[offset + index] === byte);

    const validBySignature =
      extension === 'pdf'
        ? asciiAt(0, '%PDF-')
        : ['jpg', 'jpeg'].includes(extension)
          ? startsWith(0xff, 0xd8, 0xff)
          : extension === 'png'
            ? startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)
            : extension === 'gif'
              ? asciiAt(0, 'GIF8')
              : extension === 'webp'
                ? asciiAt(0, 'RIFF') && asciiAt(8, 'WEBP')
                : ['doc', 'xls', 'ppt'].includes(extension)
                  ? startsWith(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1)
                  : ['docx', 'xlsx', 'pptx', 'zip'].includes(extension)
                    ? startsWith(0x50, 0x4b)
                    : ['mp4', 'mov'].includes(extension)
                      ? asciiAt(4, 'ftyp')
                      : extension === 'avi'
                        ? asciiAt(0, 'RIFF') && asciiAt(8, 'AVI ')
                        : extension === 'webm'
                          ? startsWith(0x1a, 0x45, 0xdf, 0xa3)
                          : extension === 'svg'
                            ? /<svg[\s>]/i.test(bytes.toString('utf8', 0, 4096))
                            : ['csv', 'txt'].includes(extension);

    if (!validBySignature) {
      this.rejectFile(
        file,
        `El contenido no coincide con la extensión .${extension}.`,
      );
    }
  }

  async resolveDownloadTarget(
    reference: string,
  ): Promise<StorageDownloadTarget> {
    if (reference.startsWith('/uploads/')) {
      const fileName = reference.slice('/uploads/'.length);
      if (
        !fileName ||
        fileName.includes('..') ||
        fileName.includes('\\') ||
        fileName.includes('/')
      ) {
        throw new BadRequestException('Referencia de almacenamiento inválida');
      }

      const uploadsRoot = path.resolve(process.cwd(), 'uploads');
      const filePath = path.resolve(uploadsRoot, fileName);
      if (!filePath.startsWith(`${uploadsRoot}${path.sep}`)) {
        throw new BadRequestException('Referencia de almacenamiento inválida');
      }
      if (!fs.existsSync(filePath)) {
        throw new NotFoundException('Archivo no encontrado');
      }
      return { kind: 'local', filePath };
    }

    const parsed = this.parseReference(reference);

    if (parsed.provider === 'supabase') {
      if (!this.supabaseClient) {
        throw new BadRequestException('Supabase Storage no está configurado');
      }

      const expiresIn = Number(
        this.configService.get('STORAGE_SIGNED_URL_TTL_SECONDS', 3600),
      );
      const { data, error } = await this.supabaseClient.storage
        .from(parsed.bucket)
        .createSignedUrl(parsed.key, expiresIn);
      if (error || !data?.signedUrl) {
        throw (
          error ||
          new NotFoundException('No se pudo generar el enlace temporal')
        );
      }
      return { kind: 'redirect', url: data.signedUrl };
    }

    if (parsed.provider === 'minio') {
      if (!this.minioClient) {
        throw new BadRequestException('MinIO no está configurado');
      }
      const result = await this.minioClient.send(
        new GetObjectCommand({ Bucket: parsed.bucket, Key: parsed.key }),
      );
      if (!result.Body) throw new NotFoundException('Archivo no encontrado');
      return {
        kind: 'stream',
        body: result.Body as NodeJS.ReadableStream,
        contentType: result.ContentType,
        contentLength: result.ContentLength,
      };
    }

    const uploadsRoot = this.privateStorageRoot;
    const filePath = path.resolve(uploadsRoot, parsed.bucket, parsed.key);
    if (!filePath.startsWith(`${uploadsRoot}${path.sep}`)) {
      throw new BadRequestException('Referencia de almacenamiento inválida');
    }
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Archivo no encontrado');
    }
    return { kind: 'local', filePath };
  }

  async resolvePublicDownloadTarget(
    reference: string,
  ): Promise<StorageDownloadTarget> {
    const parsed = this.parseReference(reference);
    if (!PUBLIC_STORAGE_BUCKETS.has(parsed.bucket)) {
      throw new NotFoundException('Recurso público no encontrado');
    }

    if (parsed.provider === 'minio') {
      if (!this.minioClient) throw new Error('MinIO no está configurado');
      const result = await this.minioClient.send(
        new GetObjectCommand({ Bucket: parsed.bucket, Key: parsed.key }),
      );
      if (!result.Body) throw new NotFoundException('Archivo no encontrado');
      return {
        kind: 'stream',
        body: result.Body as NodeJS.ReadableStream,
        contentType: result.ContentType,
        contentLength: result.ContentLength,
      };
    }

    if (parsed.provider === 'supabase') {
      if (!this.supabaseClient) throw new Error('Supabase no está configurado');
      const { data, error } = await this.supabaseClient.storage
        .from(parsed.bucket)
        .createSignedUrl(parsed.key, this.signedUrlTtl);
      if (error || !data?.signedUrl) {
        throw error || new Error('No se pudo generar el enlace temporal');
      }
      return { kind: 'redirect', url: data.signedUrl };
    }

    const filePath = path.resolve(
      this.privateStorageRoot,
      parsed.bucket,
      parsed.key,
    );
    if (!filePath.startsWith(`${this.privateStorageRoot}${path.sep}`)) {
      throw new BadRequestException('Referencia de almacenamiento inválida');
    }
    if (!fs.existsSync(filePath))
      throw new NotFoundException('Archivo no encontrado');
    return { kind: 'local', filePath };
  }

  async assertReferenceAccess(
    reference: string,
    user: { id: string; roles?: string[] },
  ): Promise<void> {
    if (reference.startsWith('/uploads/')) {
      await this.assertLegacyUploadAccess(reference, user);
      return;
    }

    const parsed = this.parseReference(reference);
    const roles = user.roles ?? [];

    if (roles.includes('ADMIN')) return;

    if (parsed.bucket === 'deliverables') {
      const submission = await this.prisma.deliverable.findFirst({
        where: {
          OR: [
            { fileUrl: reference },
            { revisions: { some: { fileUrl: reference } } },
          ],
        },
        select: { studentId: true, evaluation: { select: { cohortId: true } } },
      });
      if (!submission) throw new NotFoundException('Entrega no encontrada');
      if (submission.studentId === user.id) return;
      if (
        roles.includes('DOCENTE') &&
        (await this.prisma.cohort.count({
          where: {
            id: submission.evaluation.cohortId,
            teachers: { some: { id: user.id } },
          },
        }))
      )
        return;
      throw new ForbiddenException('No tienes acceso a esta entrega');
    }

    if (parsed.bucket === 'materials') {
      const material = await this.prisma.material.findFirst({
        where: { fileUrl: reference },
        select: { module: { select: { cohortId: true } } },
      });
      if (!material) throw new NotFoundException('Archivo no encontrado');

      const cohortId = material.module.cohortId;
      const [isAssignedTeacher, activeEnrollment] = await Promise.all([
        roles.includes('DOCENTE')
          ? this.prisma.cohort.count({
              where: { id: cohortId, teachers: { some: { id: user.id } } },
            })
          : Promise.resolve(0),
        roles.includes('ESTUDIANTE')
          ? this.prisma.enrollment.count({
              where: {
                userId: user.id,
                cohortId,
                status: {
                  in: [EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED],
                },
                deletedAt: null,
              },
            })
          : Promise.resolve(0),
      ]);

      if (isAssignedTeacher > 0 || activeEnrollment > 0) return;
      throw new ForbiddenException('No tienes acceso a este material');
    }

    const payment = await this.prisma.payment.findFirst({
      where: this.voucherReferenceFilter(reference),
      select: { enrollment: { select: { userId: true } } },
    });
    if (!payment) throw new NotFoundException('Comprobante no encontrado');
    if (payment.enrollment.userId === user.id || roles.includes('RRHH')) return;
    throw new ForbiddenException('No tienes acceso a este comprobante');
  }

  async isPublicLegacyReference(reference: string): Promise<boolean> {
    const [privateMaterial, privateVoucher, privateDeliverable, publicImage] =
      await Promise.all([
        this.prisma.material.count({ where: { fileUrl: reference } }),
        this.prisma.payment.count({
          where: this.voucherReferenceFilter(reference),
        }),
        this.prisma.deliverable.count({
          where: { fileUrl: reference, deletedAt: null },
        }),
        Promise.all([
          this.prisma.course.count({ where: { imageUrl: reference } }),
          this.prisma.cohort.count({ where: { imageUrl: reference } }),
          this.prisma.user.count({ where: { profilePicture: reference } }),
        ]).then((counts) => counts.reduce((sum, count) => sum + count, 0)),
      ]);

    return (
      privateMaterial + privateVoucher + privateDeliverable === 0 &&
      publicImage > 0
    );
  }

  /**
   * Compatibilidad controlada para archivos creados antes de StorageService.
   * Las imágenes públicas siguen usando /uploads directamente; documentos,
   * comprobantes y entregas antiguas pasan por este endpoint autenticado.
   */
  private async assertLegacyUploadAccess(
    reference: string,
    user: { id: string; roles?: string[] },
  ): Promise<void> {
    const roles = user.roles ?? [];
    if (roles.includes('ADMIN')) return;

    const material = await this.prisma.material.findFirst({
      where: { fileUrl: reference },
      select: { module: { select: { cohortId: true } } },
    });
    if (material) {
      const cohortId = material.module.cohortId;
      const [assignedTeacher, enrolledStudent] = await Promise.all([
        roles.includes('DOCENTE')
          ? this.prisma.cohort.count({
              where: { id: cohortId, teachers: { some: { id: user.id } } },
            })
          : Promise.resolve(0),
        roles.includes('ESTUDIANTE')
          ? this.prisma.enrollment.count({
              where: {
                cohortId,
                userId: user.id,
                status: { in: ['ACTIVE', 'COMPLETED'] },
                deletedAt: null,
              },
            })
          : Promise.resolve(0),
      ]);
      if (assignedTeacher > 0 || enrolledStudent > 0) return;
      throw new ForbiddenException('No tienes acceso a este material');
    }

    const payment = await this.prisma.payment.findFirst({
      where: this.voucherReferenceFilter(reference),
      select: { enrollment: { select: { userId: true } } },
    });
    if (payment) {
      if (payment.enrollment.userId === user.id || roles.includes('RRHH')) {
        return;
      }
      throw new ForbiddenException('No tienes acceso a este comprobante');
    }

    const deliverable = await this.prisma.deliverable.findFirst({
      where: {
        OR: [
          { fileUrl: reference },
          { revisions: { some: { fileUrl: reference } } },
        ],
        deletedAt: null,
      },
      select: { studentId: true, evaluation: { select: { cohortId: true } } },
    });
    if (deliverable) {
      if (deliverable.studentId === user.id) return;
      if (
        roles.includes('DOCENTE') &&
        (await this.prisma.cohort.count({
          where: {
            id: deliverable.evaluation.cohortId,
            teachers: { some: { id: user.id } },
          },
        })) > 0
      ) {
        return;
      }
      throw new ForbiddenException('No tienes acceso a esta entrega');
    }

    throw new NotFoundException('Archivo no encontrado');
  }

  private parseReference(reference: string): {
    provider: 'local' | 'supabase' | 'minio';
    bucket: string;
    key: string;
  } {
    const match = /^storage:\/\/(local|supabase|minio)\/([^/]+)\/(.+)$/.exec(
      reference,
    );
    const knownBuckets = new Set([
      ...PUBLIC_STORAGE_BUCKETS,
      ...PRIVATE_STORAGE_BUCKETS,
    ]);
    if (
      !match ||
      !knownBuckets.has(match[2]) ||
      match[3].includes('..') ||
      match[3].includes('\\')
    ) {
      throw new BadRequestException('Referencia de almacenamiento inválida');
    }
    return {
      provider: match[1] as 'local' | 'supabase' | 'minio',
      bucket: match[2],
      key: match[3],
    };
  }

  private get signedUrlTtl(): number {
    return Number(
      this.configService.get('STORAGE_SIGNED_URL_TTL_SECONDS', 3600),
    );
  }

  private removeTemporaryUpload(file: Express.Multer.File) {
    if (file.path && fs.existsSync(file.path)) {
      fs.rmSync(file.path, { force: true });
    }
  }

  private rejectFile(file: Express.Multer.File, message: string): never {
    this.removeTemporaryUpload(file);
    throw new BadRequestException(message);
  }
}

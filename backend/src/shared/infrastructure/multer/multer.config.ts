import { diskStorage, memoryStorage } from 'multer';
import { extname } from 'path';
import * as crypto from 'crypto';
import { HttpException, HttpStatus } from '@nestjs/common';
import type { Request } from 'express';
import type { FileFilterCallback } from 'multer';

const storage = diskStorage({
  destination: './uploads',
  filename: (req, file, cb) => {
    const filename = `${crypto.randomUUID()}${extname(file.originalname)}`;
    cb(null, filename);
  },
});

// SVG se excluye porque puede contener scripts y contenido activo.
const imageExtensions = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp']);
const materialExtensions = new Set([
  ...imageExtensions,
  'pdf',
  'doc',
  'docx',
  'ppt',
  'pptx',
  'xls',
  'xlsx',
  'csv',
  'txt',
  'mp4',
  'mov',
  'avi',
  'webm',
  'zip',
]);

const imageMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

const materialMimeTypes = new Set([
  ...imageMimeTypes,
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'application/csv',
  'text/plain',
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/webm',
  'application/zip',
]);

function createFileFilter(
  allowedExtensions: Set<string>,
  allowedMimeTypes: Set<string>,
  label: string,
) {
  return (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    const extension = extname(file.originalname).slice(1).toLowerCase();
    const browserMimeIsGeneric =
      !file.mimetype || file.mimetype === 'application/octet-stream';
    const isAllowed =
      allowedExtensions.has(extension) &&
      (browserMimeIsGeneric || allowedMimeTypes.has(file.mimetype));

    if (isAllowed) {
      cb(null, true);
    } else {
      cb(
        new HttpException(
          `Tipo de archivo no permitido para ${label}. Revisa la extensión del archivo.`,
          HttpStatus.BAD_REQUEST,
        ),
      );
    }
  };
}

const imageLimits = { fileSize: 10 * 1024 * 1024 };
const materialLimits = { fileSize: 100 * 1024 * 1024 };
const voucherLimits = { fileSize: 15 * 1024 * 1024 };

/** Configuración para imágenes de perfil, cursos, cohortes y avatares. */
export const multerConfig = {
  storage,
  limits: imageLimits,
  fileFilter: createFileFilter(imageExtensions, imageMimeTypes, 'imágenes'),
};

/** Configuración para documentos, imágenes, CSV y videos del temario. */
export const materialMulterConfig = {
  storage,
  limits: materialLimits,
  fileFilter: createFileFilter(
    materialExtensions,
    materialMimeTypes,
    'materiales académicos',
  ),
};

/** Configuración para comprobantes de pago. */
export const voucherMulterConfig = {
  storage: memoryStorage(),
  limits: voucherLimits,
  fileFilter: createFileFilter(
    new Set(['jpg', 'jpeg', 'png', 'webp', 'pdf']),
    new Set([...imageMimeTypes, 'application/pdf']),
    'comprobantes',
  ),
};

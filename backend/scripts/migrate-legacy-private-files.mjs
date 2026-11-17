import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const prisma = new PrismaClient();
const applyChanges = process.argv.includes('--apply');
const provider = (process.env.STORAGE_PROVIDER || 'local').toLowerCase();
const legacyRoots = [path.resolve(path.join(process.cwd(), 'uploads'))];
if (process.env.LEGACY_UPLOADS_DIR) {
  legacyRoots.push(path.resolve(process.env.LEGACY_UPLOADS_DIR));
}
const privateRoot = path.resolve(
  process.env.PRIVATE_STORAGE_DIR || path.join(process.cwd(), 'private-uploads'),
);
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase =
  provider === 'supabase' && supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey)
    : null;

const mimeTypes = {
  '.csv': 'text/csv',
  '.doc': 'application/msword',
  '.docx':
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx':
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx':
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.zip': 'application/zip',
};

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function sourcePathFromReference(reference) {
  if (!reference || !reference.startsWith('/uploads/')) {
    throw new Error(`Referencia no soportada: ${reference || '(vacía)'}`);
  }

  const encodedName = reference.slice('/uploads/'.length);
  const fileName = decodeURIComponent(encodedName);
  if (
    !fileName ||
    fileName === '.' ||
    fileName === '..' ||
    fileName.includes('/') ||
    fileName.includes('\\') ||
    fileName.includes('..')
  ) {
    throw new Error(`Nombre de archivo legacy no seguro: ${encodedName}`);
  }

  for (const legacyRoot of legacyRoots) {
    const sourcePath = path.resolve(legacyRoot, fileName);
    if (!sourcePath.startsWith(`${legacyRoot}${path.sep}`)) {
      continue;
    }
    if (fs.existsSync(sourcePath)) {
      return { fileName, sourcePath };
    }
  }

  return {
    fileName,
    sourcePath: path.resolve(legacyRoots[0], fileName),
  };
}

function privateKey(recordId, fileName) {
  const extension = path.extname(fileName).toLowerCase();
  const digest = crypto
    .createHash('sha256')
    .update(`${recordId}:${fileName}`)
    .digest('hex')
    .slice(0, 24);
  return `${recordId}-${digest}${extension}`;
}

async function copyToPrivateStorage({ recordId, fileName, sourcePath, bucket }) {
  const key = privateKey(recordId, fileName);
  const contentType =
    mimeTypes[path.extname(fileName).toLowerCase()] ||
    'application/octet-stream';

  if (provider === 'supabase') {
    if (!supabase) {
      throw new Error(
        'STORAGE_PROVIDER=supabase requiere SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY',
      );
    }
    const fileBuffer = fs.readFileSync(sourcePath);
    const { error } = await supabase.storage.from(bucket).upload(key, fileBuffer, {
      contentType,
      upsert: true,
    });
    if (error) {
      throw new Error(`Supabase ${bucket}/${key}: ${error.message}`);
    }
    return `storage://supabase/${bucket}/${key}`;
  }

  const targetDirectory = path.join(privateRoot, bucket);
  const targetPath = path.join(targetDirectory, key);
  fs.mkdirSync(targetDirectory, { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
  return `storage://local/${bucket}/${key}`;
}

async function migrateRecord({ table, id, reference, bucket, update }) {
  const { fileName, sourcePath } = sourcePathFromReference(reference);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`No existe el archivo original: ${sourcePath}`);
  }
  const sourceStat = fs.statSync(sourcePath);
  if (!sourceStat.isFile() || sourceStat.size === 0) {
    throw new Error(`El archivo original está vacío o no es un archivo: ${sourcePath}`);
  }

  const key = privateKey(id, fileName);
  if (!applyChanges) {
    console.log(`[SIMULACIÓN] ${table}/${id}: ${reference} -> ${bucket}/${key}`);
    return false;
  }

  const newReference = await copyToPrivateStorage({
    recordId: id,
    fileName,
    sourcePath,
    bucket,
  });
  await update(newReference);
  console.log(`[MIGRADO] ${table}/${id}: ${reference} -> ${newReference}`);
  return true;
}

async function main() {
  const [materials, payments, deliverables] = await Promise.all([
    prisma.material.findMany({
      where: { fileUrl: { startsWith: '/uploads/' } },
      select: { id: true, fileUrl: true },
    }),
    prisma.payment.findMany({
      where: { voucherUrl: { startsWith: '/uploads/' } },
      select: { id: true, voucherUrl: true },
    }),
    prisma.deliverable.findMany({
      where: { fileUrl: { startsWith: '/uploads/' } },
      select: { id: true, fileUrl: true },
    }),
  ]);

  const jobs = [
    ...materials.map((record) => ({
      table: 'materials',
      id: record.id,
      reference: record.fileUrl,
      bucket: 'materials',
      update: (newReference) =>
        prisma.material.update({
          where: { id: record.id },
          data: { fileUrl: newReference },
        }),
    })),
    ...payments.map((record) => ({
      table: 'payments',
      id: record.id,
      reference: record.voucherUrl,
      bucket: 'vouchers',
      update: (newReference) =>
        prisma.payment.update({
          where: { id: record.id },
          data: { voucherUrl: newReference },
        }),
    })),
    ...deliverables.map((record) => ({
      table: 'deliverables',
      id: record.id,
      reference: record.fileUrl,
      bucket: 'deliverables',
      update: (newReference) =>
        prisma.deliverable.update({
          where: { id: record.id },
          data: { fileUrl: newReference },
        }),
    })),
  ];

  console.log(`Proveedor: ${provider}`);
  console.log(`Modo: ${applyChanges ? 'APLICAR CAMBIOS' : 'SIMULACIÓN'}`);
  console.log(`Fuentes legacy: ${legacyRoots.join(' | ')}`);
  console.log(`Archivos encontrados: ${jobs.length}`);
  if (!applyChanges) {
    console.log(
      'Para ejecutar la migración usa: node scripts/migrate-legacy-private-files.mjs --apply',
    );
  }

  let migrated = 0;
  let failed = 0;
  for (const job of jobs) {
    try {
      if (await migrateRecord(job)) migrated += 1;
    } catch (error) {
      failed += 1;
      console.error(`[ERROR] ${job.table}/${job.id}: ${errorMessage(error)}`);
    }
  }

  console.log(
    `${applyChanges ? 'Resultado' : 'Resultado de simulación'}: ${migrated} migrados, ${failed} con error, ${jobs.length - migrated - failed} pendientes.`,
  );
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(`[FATAL] ${errorMessage(error)}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

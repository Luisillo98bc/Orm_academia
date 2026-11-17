import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const endpoint = process.env.MINIO_ENDPOINT;
const accessKey = process.env.MINIO_ACCESS_KEY;
const secretKey = process.env.MINIO_SECRET_KEY;
const dryRun = process.env.MIGRATION_DRY_RUN === 'true';
const legacyRoot = path.resolve(
  process.env.LEGACY_UPLOADS_DIR || path.join(process.cwd(), 'uploads'),
);
const privateRoot = path.resolve(
  process.env.PRIVATE_STORAGE_DIR ||
    path.join(process.cwd(), 'private-uploads'),
);

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain && (!endpoint || !accessKey || !secretKey)) {
  throw new Error(
    'MINIO_ENDPOINT, MINIO_ACCESS_KEY y MINIO_SECRET_KEY son obligatorios',
  );
}

const s3 = new S3Client({
  endpoint,
  region: process.env.MINIO_REGION || 'us-east-1',
  forcePathStyle: process.env.MINIO_FORCE_PATH_STYLE !== 'false',
  credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
});

const targets = [
  { model: 'user', field: 'profilePicture', bucket: 'avatars' },
  { model: 'course', field: 'imageUrl', bucket: 'courses' },
  { model: 'cohort', field: 'imageUrl', bucket: 'cohorts' },
  { model: 'material', field: 'fileUrl', bucket: 'materials' },
  { model: 'payment', field: 'voucherUrl', bucket: 'vouchers' },
  { model: 'deliverable', field: 'fileUrl', bucket: 'deliverables' },
  { model: 'submissionRevision', field: 'fileUrl', bucket: 'deliverables' },
];

function contentType(fileName) {
  const extension = path.extname(fileName).toLowerCase();
  return (
    {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf',
      '.mp4': 'video/mp4',
      '.mov': 'video/quicktime',
      '.webm': 'video/webm',
      '.zip': 'application/zip',
    }[extension] || 'application/octet-stream'
  );
}

function safePath(root, relativePath) {
  const resolved = path.resolve(root, relativePath);
  if (!resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error(`Ruta fuera del directorio permitido: ${relativePath}`);
  }
  return resolved;
}

function parseReference(reference, defaultBucket) {
  if (reference.startsWith('/uploads/')) {
    const filename = path.basename(reference.slice('/uploads/'.length));
    return {
      bucket: defaultBucket,
      key: `legacy/${filename}`,
      source: safePath(legacyRoot, filename),
    };
  }

  const match = /^storage:\/\/local\/([^/]+)\/(.+)$/.exec(reference);
  if (!match || match[2].includes('..') || match[2].includes('\\')) {
    return null;
  }
  return {
    bucket: match[1],
    key: match[2],
    source: safePath(privateRoot, path.join(match[1], match[2])),
  };
}

export async function migrate({
  database = prisma,
  client = s3,
  simulate = dryRun,
} = {}) {
  const migrated = new Map();
  let uploaded = 0,
    skipped = 0,
    missing = 0,
    referencesUpdated = 0;

  async function migrateReference(reference, bucket, label) {
    if (!reference || reference.startsWith('storage://minio/')) {
      skipped += 1;
      return reference;
    }
    const parsed = parseReference(reference, bucket);
    if (!parsed || parsed.bucket !== bucket) {
      skipped += 1;
      return reference;
    }
    const cacheKey = `${parsed.bucket}/${parsed.key}`;
    if (migrated.has(cacheKey)) return migrated.get(cacheKey);
    try {
      const body = await fs.readFile(parsed.source);
      const nextReference = `storage://minio/${parsed.bucket}/${parsed.key}`;
      if (!simulate)
        await client.send(
          new PutObjectCommand({
            Bucket: parsed.bucket,
            Key: parsed.key,
            Body: body,
            ContentType: contentType(parsed.key),
          }),
        );
      migrated.set(cacheKey, nextReference);
      uploaded += 1;
      return nextReference;
    } catch (error) {
      missing += 1;
      console.error(
        `[ERROR] ${label}: no se pudo leer/subir el archivo`,
        error instanceof Error ? error.message : error,
      );
      return reference;
    }
  }

  for (const target of targets) {
    const rows = await database[target.model].findMany({
      where: { [target.field]: { not: null } },
      select: { id: true, [target.field]: true },
    });
    for (const row of rows) {
      const reference = row[target.field];
      const nextReference = await migrateReference(
        reference,
        target.bucket,
        `${target.model}/${row.id}`,
      );
      if (!simulate && nextReference !== reference) {
        await database[target.model].update({
          where: { id: row.id, [target.field]: reference },
          data: { [target.field]: nextReference },
        });
        referencesUpdated += 1;
      }
    }
  }

  const payments = await database.payment.findMany({
    select: { id: true, installmentHistory: true },
  });
  for (const payment of payments) {
    if (!Array.isArray(payment.installmentHistory)) continue;
    let changes = 0;
    const history = [];
    for (const receipt of payment.installmentHistory) {
      if (
        !receipt ||
        typeof receipt !== 'object' ||
        typeof receipt.voucherUrl !== 'string'
      ) {
        history.push(receipt);
        continue;
      }
      const next = await migrateReference(
        receipt.voucherUrl,
        'vouchers',
        `payment/${payment.id}/history`,
      );
      if (next !== receipt.voucherUrl) changes += 1;
      history.push({ ...receipt, voucherUrl: next });
    }
    if (!simulate && changes) {
      await database.payment.update({
        where: {
          id: payment.id,
          installmentHistory: { equals: payment.installmentHistory },
        },
        data: { installmentHistory: history },
      });
      referencesUpdated += changes;
    }
  }
  return { dryRun: simulate, uploaded, referencesUpdated, skipped, missing };
}

if (isMain) {
  try {
    const result = await migrate();
    console.log(JSON.stringify(result, null, 2));
    if (result.missing > 0) process.exitCode = 2;
  } finally {
    await prisma.$disconnect();
    s3.destroy();
  }
}

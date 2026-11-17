import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

test('MinIO migration preserves historical vouchers and revisions and supports a dry run', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'academia-migrate-'));
  const previousRoot = process.env.PRIVATE_STORAGE_DIR;
  process.env.PRIVATE_STORAGE_DIR = root;
  try {
    for (const bucket of ['vouchers', 'deliverables'])
      await mkdir(path.join(root, bucket));
    for (const relative of [
      'vouchers/current.pdf',
      'vouchers/previous.pdf',
      'deliverables/revision.pdf',
    ]) {
      await writeFile(path.join(root, relative), 'fixture');
    }
    const current = 'storage://local/vouchers/current.pdf';
    const history = [
      {
        installmentNumber: 1,
        voucherUrl: 'storage://local/vouchers/previous.pdf',
      },
      { installmentNumber: 2, voucherUrl: current },
    ];
    const writes = [],
      uploads = [];
    const database = Object.fromEntries(
      [
        'user',
        'course',
        'cohort',
        'material',
        'payment',
        'deliverable',
        'submissionRevision',
      ].map((model) => [
        model,
        {
          findMany: async ({ select }) =>
            model === 'payment'
              ? select.installmentHistory
                ? [{ id: 'payment', installmentHistory: history }]
                : [{ id: 'payment', voucherUrl: current }]
              : model === 'submissionRevision'
                ? [
                    {
                      id: 'revision',
                      fileUrl: 'storage://local/deliverables/revision.pdf',
                    },
                  ]
                : [],
          update: async (value) => {
            writes.push({ model, ...value });
          },
        },
      ]),
    );
    const client = {
      send: async (command) => {
        uploads.push(command.input);
      },
    };
    const { migrate } = await import('./migrate-to-minio.mjs');
    const simulated = await migrate({ database, client, simulate: true });
    assert.equal(simulated.uploaded, 3);
    assert.equal(simulated.referencesUpdated, 0);
    assert.equal(uploads.length, 0);
    assert.equal(writes.length, 0);
    const applied = await migrate({ database, client, simulate: false });
    assert.equal(applied.missing, 0);
    assert.equal(applied.uploaded, 3);
    assert.equal(applied.referencesUpdated, 4);
    assert.equal(uploads.length, 3);
    assert.equal(
      writes.find((row) => row.data.fileUrl)?.data.fileUrl,
      'storage://minio/deliverables/revision.pdf',
    );
    const updatedHistory = writes.find((row) => row.data.installmentHistory);
    assert.equal(
      updatedHistory.data.installmentHistory[0].voucherUrl,
      'storage://minio/vouchers/previous.pdf',
    );
    assert.deepEqual(updatedHistory.where.installmentHistory.equals, history);
    assert.equal(
      await readFile(path.join(root, 'vouchers/previous.pdf'), 'utf8'),
      'fixture',
    );
  } finally {
    if (previousRoot === undefined) delete process.env.PRIVATE_STORAGE_DIR;
    else process.env.PRIVATE_STORAGE_DIR = previousRoot;
    await rm(root, { recursive: true, force: true });
  }
});

import { PrismaClient, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { ClassroomService } from '../src/modules/evaluation/application/services/classroom.service';

describe('Concurrencia del aula con PostgreSQL', () => {
  it('permite alumnos distintos y conserva la exclusión para el mismo alumno y las ediciones', async () => {
    const db = new PrismaClient();
    const service = new ClassroomService(db as never, {} as never, {} as never);
    const lock = (
      tx: Prisma.TransactionClient,
      evaluationId: string,
      studentId?: string,
    ) =>
      (
        service as unknown as {
          lock: (
            tx: Prisma.TransactionClient,
            id: string,
            student?: string,
          ) => Promise<void>;
        }
      ).lock(tx, evaluationId, studentId);
    const evaluationId = randomUUID();
    let release!: () => void;
    let started!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    const running = db.$transaction(
      async (tx) => {
        await lock(tx, evaluationId, 'student-a');
        started();
        await gate;
      },
      { timeout: 10_000 },
    );
    try {
      await ready;
      await db.$transaction(async (tx) => {
        await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '1500ms'");
        await lock(tx, evaluationId, 'student-b');
        const same = await tx.$queryRaw<
          Array<{ acquired: boolean }>
        >`SELECT pg_try_advisory_xact_lock(hashtext(${`classroom:${evaluationId}:student-a`})) AS acquired`;
        expect(same[0].acquired).toBe(false);
        const edit = await tx.$queryRaw<
          Array<{ acquired: boolean }>
        >`SELECT pg_try_advisory_xact_lock(hashtext(${`classroom:${evaluationId}`})) AS acquired`;
        expect(edit[0].acquired).toBe(false);
      });
      release();
      await running;
      await db.$transaction(async (tx) => {
        await lock(tx, evaluationId);
      });
    } finally {
      release();
      await running.catch(() => undefined);
      await db.$disconnect();
    }
  }, 15_000);
});

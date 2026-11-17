import { ProspectsController } from './prospects.controller';
import type { ProspectsService } from './prospects.service';
import type { AuditService } from '../audit/audit.service';

describe('ProspectsController', () => {
  let controller: ProspectsController;
  let prospects: Record<string, jest.Mock>;
  let audit: Record<string, jest.Mock>;
  const user = {
    id: 'admin-1',
    email: 'admin@example.com',
    roles: ['ADMIN'],
    permissions: [],
  };
  const request = {
    ip: '127.0.0.1',
    headers: { 'user-agent': 'jest' },
  } as never;

  beforeEach(() => {
    prospects = {
      create: jest.fn().mockResolvedValue({ id: 'prospect-1' }),
      createManual: jest.fn().mockResolvedValue({ id: 'prospect-manual-1' }),
      list: jest.fn().mockResolvedValue([]),
      stats: jest.fn().mockResolvedValue({ total: 0 }),
      findOne: jest.fn().mockResolvedValue({ id: 'prospect-1', status: 'NEW' }),
      update: jest
        .fn()
        .mockResolvedValue({ id: 'prospect-1', status: 'CONTACTED' }),
      addNote: jest.fn().mockResolvedValue({ id: 'note-1', content: 'hello' }),
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    controller = new ProspectsController(
      prospects as unknown as ProspectsService,
      audit as unknown as AuditService,
    );
  });

  it('delegates public creation, listing and stats', async () => {
    await expect(
      controller.create({ email: 'lead@example.com', name: 'Lead' } as never),
    ).resolves.toMatchObject({ id: 'prospect-1' });
    await expect(
      controller.createManual(user, request, {
        name: 'Manual Lead',
        email: 'manual@lead.com',
      }),
    ).resolves.toMatchObject({ id: 'prospect-manual-1' });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'admin-1' }),
      'CREATE_PROSPECT_MANUAL',
      'Prospect',
      'prospect-manual-1',
      undefined,
      expect.objectContaining({ id: 'prospect-manual-1' }),
    );
    await expect(controller.list({ page: 1, limit: 10 })).resolves.toEqual([]);
    await expect(controller.stats()).resolves.toEqual({ total: 0 });
    expect(prospects.list).toHaveBeenCalledWith({ page: 1, limit: 10 });
  });

  it('updates prospects and audits the previous and new values', async () => {
    await expect(
      controller.update('prospect-1', user, request, { status: 'CONTACTED' }),
    ).resolves.toMatchObject({ status: 'CONTACTED' });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'admin-1', ipAddress: '127.0.0.1' }),
      'UPDATE_PROSPECT',
      'Prospect',
      'prospect-1',
      expect.objectContaining({ status: 'NEW' }),
      expect.objectContaining({ status: 'CONTACTED' }),
    );
  });

  it('adds notes and audits the note id', async () => {
    await expect(
      controller.addNote('prospect-1', user, request, {
        content: 'Call tomorrow',
      }),
    ).resolves.toMatchObject({ id: 'note-1' });
    expect(prospects.addNote).toHaveBeenCalledWith(
      'prospect-1',
      'admin-1',
      'Call tomorrow',
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.anything(),
      'ADD_PROSPECT_NOTE',
      'Prospect',
      'prospect-1',
      undefined,
      { noteId: 'note-1' },
    );
  });
});

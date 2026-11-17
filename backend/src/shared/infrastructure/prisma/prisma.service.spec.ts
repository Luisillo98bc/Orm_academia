import { PrismaService } from './prisma.service';

describe('PrismaService lifecycle', () => {
  it('connects and disconnects through Prisma lifecycle hooks', async () => {
    const service = new PrismaService();
    const connect = jest
      .spyOn(service, '$connect')
      .mockResolvedValue(undefined);
    const disconnect = jest
      .spyOn(service, '$disconnect')
      .mockResolvedValue(undefined);
    await service.onModuleInit();
    await service.onApplicationShutdown();
    expect(connect).toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalled();
    await service.$disconnect();
  });
});

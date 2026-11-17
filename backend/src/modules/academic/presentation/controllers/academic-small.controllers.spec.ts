import { ConversionAnalyticsController } from './conversion-analytics.controller';
import { SearchController } from './search.controller';
import type { ConversionAnalyticsService } from '../../application/services/conversion-analytics.service';
import type { SearchService } from '../../application/services/search.service';

describe('Academic small controllers', () => {
  it('delegates conversion analytics with default and explicit periods', async () => {
    const analytics = {
      track: jest.fn().mockResolvedValue({ ok: true }),
      getFunnel: jest.fn().mockResolvedValue({}),
      getConversionByProgram: jest.fn().mockResolvedValue([]),
      getRetention: jest.fn().mockResolvedValue([]),
      getOperationalOverview: jest.fn().mockResolvedValue({}),
    };
    const controller = new ConversionAnalyticsController(
      analytics as unknown as ConversionAnalyticsService,
    );
    await controller.track({ event: 'page_view' } as never);
    await controller.getConversion();
    await controller.getConversionByProgram('7');
    await controller.getRetention();
    await controller.getOperationalOverview('14');
    expect(analytics.getFunnel).toHaveBeenCalledWith(30);
    expect(analytics.getConversionByProgram).toHaveBeenCalledWith(7);
    expect(analytics.getRetention).toHaveBeenCalledWith(180);
    expect(analytics.getOperationalOverview).toHaveBeenCalledWith(14);
  });

  it('delegates global search with the authenticated user', async () => {
    const search = {
      globalSearch: jest.fn().mockResolvedValue({ courses: [] }),
    };
    const controller = new SearchController(search as unknown as SearchService);
    const user = { id: 'user-1', roles: ['ESTUDIANTE'] };
    await expect(controller.globalSearch('math', user)).resolves.toEqual({
      courses: [],
    });
    expect(search.globalSearch).toHaveBeenCalledWith('math', user);
  });
});

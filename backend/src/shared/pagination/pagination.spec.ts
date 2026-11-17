import {
  createPaginationMeta,
  normalizePagination,
  paginatedResult,
} from './pagination';

describe('pagination helpers', () => {
  it('normalizes missing, invalid and out-of-range values', () => {
    expect(normalizePagination()).toEqual({ page: 1, limit: 20, skip: 0 });
    expect(normalizePagination(2.9, 150)).toEqual({
      page: 2,
      limit: 100,
      skip: 100,
    });
    expect(normalizePagination(-3, 0)).toEqual({ page: 1, limit: 1, skip: 0 });
    expect(normalizePagination(Number.NaN, Number.POSITIVE_INFINITY)).toEqual({
      page: 1,
      limit: 20,
      skip: 0,
    });
  });

  it('creates metadata and paginated results', () => {
    expect(createPaginationMeta(2, 10, 21)).toEqual({
      page: 2,
      limit: 10,
      total: 21,
      totalPages: 3,
    });
    expect(createPaginationMeta(1, 10, 0).totalPages).toBe(1);
    expect(paginatedResult(['a', 'b'], 1, 10, 2)).toEqual({
      data: ['a', 'b'],
      pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
    });
  });
});

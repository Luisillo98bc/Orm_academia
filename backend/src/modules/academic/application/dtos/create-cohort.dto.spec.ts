import { plainToInstance } from 'class-transformer';
import { CreateCohortDto } from './create-cohort.dto';

describe('CreateCohortDto', () => {
  it('normalizes numeric prices before validation', () => {
    const dto = plainToInstance(CreateCohortDto, { price: 125 });
    expect(dto.price).toBe('125');
  });
});

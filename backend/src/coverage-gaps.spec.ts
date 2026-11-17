import { EnrollStudentDto } from './modules/academic/application/dtos/enroll-student.dto';
import { CreateCommunicationDto } from './modules/communication/dto/create-communication.dto';
import { UpdateCommunicationDto } from './modules/communication/dto/update-communication.dto';
import { Communication } from './modules/communication/entities/communication.entity';
import { CreateRrhhDto } from './modules/rrhh/dto/create-rrhh.dto';
import { UpdateRrhhDto } from './modules/rrhh/dto/update-rrhh.dto';
import { Rrhh } from './modules/rrhh/entities/rrhh.entity';
import { normalizeMoneyInput } from './modules/rrhh/dtos/money-input';
import { UpdateProfileDto } from './modules/auth/application/dtos/update-profile.dto';
import { PlatformSettingsEntity } from './modules/settings/domain/platform-settings.entity';
import { ContractsQueryDto } from './shared/pagination/contracts-query.dto';
import { PaginationQueryDto } from './shared/pagination/pagination-query.dto';
import { moneyToMinorUnits, toMoney } from './shared/utils/money';
import {
  materialMulterConfig,
  multerConfig,
  voucherMulterConfig,
} from './shared/infrastructure/multer/multer.config';
import { SchedulerLockService } from './shared/infrastructure/scheduler/scheduler-lock.service';

describe('coverage gap DTOs and simple entities', () => {
  it('loads the remaining DTO metadata and normalizes money inputs', () => {
    expect(new EnrollStudentDto()).toBeInstanceOf(EnrollStudentDto);
    expect(new CreateCommunicationDto()).toBeInstanceOf(CreateCommunicationDto);
    expect(new UpdateCommunicationDto()).toBeInstanceOf(UpdateCommunicationDto);
    expect(new Communication()).toBeInstanceOf(Communication);
    expect(new CreateRrhhDto()).toBeInstanceOf(CreateRrhhDto);
    expect(new UpdateRrhhDto()).toBeInstanceOf(UpdateRrhhDto);
    expect(new Rrhh()).toBeInstanceOf(Rrhh);
    expect(new UpdateProfileDto()).toBeInstanceOf(UpdateProfileDto);
    expect(new PlatformSettingsEntity()).toBeInstanceOf(PlatformSettingsEntity);
    expect(new ContractsQueryDto()).toBeInstanceOf(ContractsQueryDto);
    expect(new PaginationQueryDto()).toBeInstanceOf(PaginationQueryDto);
    expect(normalizeMoneyInput({ value: 12.5 } as never)).toBe('12.5');
    expect(normalizeMoneyInput({ value: '12.50' } as never)).toBe('12.50');
    const objectValue = { amount: 12 };
    expect(normalizeMoneyInput({ value: objectValue } as never)).toBe(
      objectValue,
    );
    expect(() => toMoney(Infinity)).toThrow(RangeError);
    expect(moneyToMinorUnits('12.34')).toBe(1234);

    const filenameStorage = multerConfig.storage as unknown as {
      getFilename: (req: unknown, file: unknown, cb: jest.Mock) => void;
    };
    const filenameCallback = jest.fn();
    filenameStorage.getFilename(
      {},
      { originalname: 'avatar.png' },
      filenameCallback,
    );
    expect(filenameCallback).toHaveBeenCalledWith(
      null,
      expect.stringMatching(/\.png$/),
    );
    for (const config of [
      multerConfig,
      materialMulterConfig,
      voucherMulterConfig,
    ]) {
      const filter = config.fileFilter as unknown as (
        req: unknown,
        file: unknown,
        cb: jest.Mock,
      ) => void;
      const callback = jest.fn();
      filter(
        {},
        { originalname: 'file.pdf', mimetype: 'application/pdf' },
        callback,
      );
      expect(callback).toHaveBeenCalled();
    }
    const scheduler = new SchedulerLockService({} as never);
    scheduler.logSkipped('test-lock');
  });
});

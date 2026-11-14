jest.mock('../datasource', () => ({ db_config: {} }));
import { bootstrapAdmin } from '../scripts/bootstrap-admin';

describe('First admin bootstrap', () => {
  let source: any;
  let runner: any;
  let users: any;
  beforeEach(() => {
    users = {
      exists: jest.fn().mockResolvedValue(false),
      findOneBy: jest.fn().mockResolvedValue({ id: 'student', role: 'student' }),
      save: jest.fn(),
    };
    runner = {
      connect: jest.fn(), startTransaction: jest.fn(), commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(), release: jest.fn(), isTransactionActive: true,
      query: jest.fn().mockResolvedValue([{ acquired: 1 }]),
      manager: { getRepository: jest.fn(() => users), update: jest.fn() },
    };
    source = {
      initialize: jest.fn(), destroy: jest.fn(), createQueryRunner: jest.fn(() => runner),
    };
  });
  it('promotes a registered account and revokes previous sessions', async () => {
    await bootstrapAdmin(source, 'student@example.com');
    expect(users.save).toHaveBeenCalledWith(expect.objectContaining({ role: 'admin' }));
    expect(runner.manager.update).toHaveBeenCalled();
    expect(runner.commitTransaction).toHaveBeenCalled();
    expect(runner.release).toHaveBeenCalled();
    expect(source.destroy).toHaveBeenCalled();
  });
  it('refuses bootstrap when any admin already exists', async () => {
    users.exists.mockResolvedValue(true);
    await expect(bootstrapAdmin(source, 'student@example.com')).rejects.toThrow('admin already exists');
    expect(users.save).not.toHaveBeenCalled();
    expect(runner.rollbackTransaction).toHaveBeenCalled();
  });
  it('refuses unregistered accounts', async () => {
    users.findOneBy.mockResolvedValue(null);
    await expect(bootstrapAdmin(source, 'missing@example.com')).rejects.toThrow('Register');
    expect(users.save).not.toHaveBeenCalled();
  });
  it('refuses to proceed without the database lock', async () => {
    runner.query.mockResolvedValue([{ acquired: 0 }]);
    await expect(bootstrapAdmin(source, 'student@example.com')).rejects.toThrow('bootstrap lock');
    expect(users.save).not.toHaveBeenCalled();
    expect(source.destroy).toHaveBeenCalled();
  });
});

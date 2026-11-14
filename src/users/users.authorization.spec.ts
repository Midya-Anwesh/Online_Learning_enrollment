import { ForbiddenException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UsersService } from './users.service';
import { CreateUserDto } from './dtos/create-user.dto';
import { JwtTokenList } from '../auth/jwtTokenList/jwtTokenList.entity';

describe('Registration and profile authorization', () => {
  let service: UsersService;
  let repo: any;
  let manager: any;
  const caller = { sub: 'caller', tokenIdentifier: 'session' };

  beforeEach(() => {
    manager = {
      save: jest.fn(async (_entity, value) => value),
      update: jest.fn(),
    };
    repo = {
      findOne: jest.fn(), findOneBy: jest.fn(),
      create: jest.fn(value => value), save: jest.fn(value => value),
      manager: { transaction: jest.fn(fn => fn(manager)) },
    };
    service = new UsersService(repo);
  });

  it.each(['admin', 'instructor'])('rejects public signup role %s at validation', async role => {
    const dto = plainToInstance(CreateUserDto, {
      name: 'Student', email: 'student@example.com', password: 'test-only', role,
    });
    expect((await validate(dto)).some(e => e.property === 'role')).toBe(true);
  });

  it.each([undefined, 'student'])('accepts student signup role %s', async role => {
    const dto = plainToInstance(CreateUserDto, {
      name: 'Student', email: 'student@example.com', password: 'test-only', role,
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('forces student even if DTO validation is bypassed', async () => {
    const user = await service.createUser({
      name: 'Student', email: 'student@example.com', password: 'hash', role: 'admin',
    });
    expect(user.role).toBe('student');
  });

  it.each(['student', 'instructor'])('denies %s modifying another account', async role => {
    repo.findOneBy.mockImplementation(async ({email}) => email
      ? { id: 'victim', email: 'victim@example.com' }
      : { id: 'caller', role });
    await expect(service.updateUser({
      oldEmail: 'victim@example.com', name: 'Changed',
    } as any, caller)).rejects.toBeInstanceOf(ForbiddenException);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('allows an owner to update their name without revoking sessions', async () => {
    repo.findOneBy.mockResolvedValue({ id: 'caller', email: 'self@example.com', role: 'student' });
    const result = await service.updateUser({
      oldEmail: 'self@example.com', name: 'New name',
    } as any, caller);
    expect(result.name).toBe('New name');
    expect(result).not.toHaveProperty('oldEmail');
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('allows admins to edit another account and revokes sessions when email changes', async () => {
    repo.findOneBy.mockImplementation(async ({email}) => email
      ? { id: 'victim', email: 'old@example.com' }
      : { id: 'caller', role: 'admin' });
    await service.updateUser({
      oldEmail: 'old@example.com', email: 'new@example.com',
    } as any, caller);
    expect(manager.update).toHaveBeenCalledWith(
      JwtTokenList, { user: { id: 'victim' } }, { blockListed: true },
    );
  });

  it('revokes all target sessions on role change', async () => {
    repo.findOneBy.mockResolvedValue({ id: 'target', role: 'student' });
    const user = await service.assignRole({ email: 'target@example.com', role: 'instructor' });
    expect(user.role).toBe('instructor');
    expect(manager.update).toHaveBeenCalledWith(
      JwtTokenList, { user: { id: 'target' } }, { blockListed: true },
    );
  });
});

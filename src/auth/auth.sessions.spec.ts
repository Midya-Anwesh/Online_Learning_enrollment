import { hash } from 'argon2';
import { AuthService } from './auth.service';
import { JwtTokenSerive } from './jwtTokenList/jwtTokenService';

describe('Session invalidation', () => {
  const caller = { sub: 'caller', tokenIdentifier: 'old-session' };
  it('revokes every old session after a password change and returns a new login', async () => {
    const user = {
      id: 'caller', role: 'student', email: 'self@example.com',
      password: await hash('old-test-password'),
    };
    const users: any = { findUser: jest.fn(async () => user), saveUser: jest.fn() };
    const tokens: any = { blockToken: jest.fn() };
    const service = new AuthService(users, tokens);
    const login = jest.spyOn(service, 'login').mockResolvedValue({ accessToken: 'new-session' } as any);
    await service.updatePassword({
      email: user.email, oldPassword: 'old-test-password', newPassword: 'new-test-password',
    }, caller);
    expect(tokens.blockToken).toHaveBeenCalledWith('', 'caller', true);
    expect(login).toHaveBeenCalledWith({ email: user.email, password: 'new-test-password' });
  });

  it('revokes the target user sessions on email change', async () => {
    const users: any = {
      findByEmail: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({
        id: 'target', email: 'old@example.com', role: 'student',
      }),
      findUser: jest.fn().mockResolvedValue({ id: 'caller', email: 'admin@example.com', role: 'admin' }),
      saveUser: jest.fn(user => user),
    };
    const tokens: any = { blockToken: jest.fn() };
    await new AuthService(users, tokens).updateEmail({
      oldEmail: 'old@example.com', newEmail: 'new@example.com',
    }, caller);
    expect(tokens.blockToken).toHaveBeenCalledWith('', 'target', true);
  });

  it('scopes bulk token blocking to the user foreign-key column', async () => {
    const query: any = {};
    for (const method of ['update', 'set', 'where']) query[method] = jest.fn(() => query);
    query.execute = jest.fn();
    const tokens = new JwtTokenSerive(
      { createQueryBuilder: jest.fn(() => query) } as any, {} as any, {} as any,
    );
    await tokens.blockToken('', 'caller', true);
    expect(query.where).toHaveBeenCalledWith('userId = :userId', { userId: 'caller' });
  });
});

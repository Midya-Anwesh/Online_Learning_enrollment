import { ForbiddenException } from '@nestjs/common';
import { EnrollmentsService } from './enrollments.service';

describe('Enrollment privacy', () => {
  let users: any;
  let query: any;
  let service: EnrollmentsService;
  const caller = { sub: 'self', tokenIdentifier: 'session' };
  beforeEach(() => {
    users = { findUser: jest.fn() };
    query = {};
    for (const method of ['innerJoin', 'select', 'where']) query[method] = jest.fn(() => query);
    query.getRawMany = jest.fn().mockResolvedValue([]);
    service = new EnrollmentsService({ createQueryBuilder: jest.fn(() => query) } as any, users, {} as any);
  });
  it.each(['student', 'instructor'])('denies %s reading the full report', async role => {
    users.findUser.mockResolvedValue({ id: 'self', role });
    await expect(service.getEnrollments('*', caller)).rejects.toBeInstanceOf(ForbiddenException);
    expect(query.getRawMany).not.toHaveBeenCalled();
  });
  it.each(['student', 'instructor'])('denies %s reading another learner', async role => {
    users.findUser.mockResolvedValue({ id: 'self', role });
    await expect(service.getEnrollments('other', caller)).rejects.toBeInstanceOf(ForbiddenException);
  });
  it.each(['student', 'instructor', 'admin'])('allows %s reading their own enrollments', async role => {
    users.findUser.mockResolvedValue({ id: 'self', role });
    await service.getEnrollments('self', caller);
    expect(query.where).toHaveBeenCalledWith('user.id = :id', { id: 'self' });
  });
  it('allows admins reading all enrollments', async () => {
    users.findUser.mockResolvedValue({ id: 'self', role: 'admin' });
    await service.getEnrollments('*', caller);
    expect(query.getRawMany).toHaveBeenCalled();
  });
});

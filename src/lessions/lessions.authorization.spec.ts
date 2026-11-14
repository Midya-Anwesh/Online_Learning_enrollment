import { ForbiddenException } from '@nestjs/common';
import { LessionsService } from './lessions.service';

describe('Lesson ownership and visibility', () => {
  let service: LessionsService;
  let repo: any;
  let users: any;
  let query: any;
  const caller = { sub: 'caller', tokenIdentifier: 'session' };
  const body = { name: 'Intro', code: 'INTRO', desc: 'Description', courseId: 'course' };
  beforeEach(() => {
    query = {};
    for (const method of ['innerJoin', 'addSelect', 'leftJoin', 'where', 'andWhere']) {
      query[method] = jest.fn(() => query);
    }
    query.getMany = jest.fn().mockResolvedValue([]);
    repo = {
      manager: { exists: jest.fn().mockResolvedValue(false) },
      create: jest.fn(value => value),
      save: jest.fn(value => value),
      findOne: jest.fn().mockResolvedValue({
        id: 'lesson', name: 'Original', code: 'ORIG', description: 'Keep this',
        course: { id: 'course' },
      }),
      createQueryBuilder: jest.fn(() => query),
    };
    users = { findUser: jest.fn() };
    service = new LessionsService(repo, { findCourse: jest.fn().mockResolvedValue({ id: 'course' }) } as any, users);
  });

  it.each(['student', 'instructor'])('denies %s creating a lesson without assignment', async role => {
    users.findUser.mockResolvedValue({ id: 'caller', role });
    await expect(service.createLession(body, caller)).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.save).not.toHaveBeenCalled();
  });
  it('allows an assigned instructor creating a lesson', async () => {
    users.findUser.mockResolvedValue({ id: 'caller', role: 'instructor' });
    repo.manager.exists.mockResolvedValue(true);
    await service.createLession(body, caller);
    expect(repo.save).toHaveBeenCalled();
  });
  it('allows an unassigned admin creating and updating lessons', async () => {
    users.findUser.mockResolvedValue({ id: 'caller', role: 'admin' });
    await service.createLession(body, caller);
    const result = await service.updateLession({ id: 'lesson', name: 'Changed' } as any, caller);
    expect(result).toMatchObject({ name: 'Changed', code: 'ORIG', description: 'Keep this' });
    expect(repo.manager.exists).not.toHaveBeenCalled();
  });
  it('denies unassigned instructor updates', async () => {
    users.findUser.mockResolvedValue({ id: 'caller', role: 'instructor' });
    await expect(service.updateLession({ id: 'lesson', desc: 'Changed' } as any, caller))
      .rejects.toBeInstanceOf(ForbiddenException);
  });
  it('allows assigned instructor updates and maps desc to description', async () => {
    users.findUser.mockResolvedValue({ id: 'caller', role: 'instructor' });
    repo.manager.exists.mockResolvedValue(true);
    const result = await service.updateLession({ id: 'lesson', desc: 'Changed' } as any, caller);
    expect(result.description).toBe('Changed');
    expect(result).not.toHaveProperty('desc');
  });
  it.each(['student', 'instructor'])('filters %s lesson reads and retains the course filter', async role => {
    users.findUser.mockResolvedValue({ id: 'caller', role });
    expect(await service.getLessionsByCourse('course', caller)).toEqual({});
    expect(query.leftJoin).toHaveBeenCalledTimes(2);
    expect(query.where).toHaveBeenCalledWith(
      expect.stringContaining('enrollment.id IS NOT NULL'),
      { isInstructor: role === 'instructor' ? 1 : 0 },
    );
    expect(query.andWhere).toHaveBeenCalledWith('course.id = :courseId', { courseId: 'course' });
  });
  it('does not restrict admin lesson reads', async () => {
    users.findUser.mockResolvedValue({ id: 'caller', role: 'admin' });
    await service.getLessionsByCourse('*', caller);
    expect(query.leftJoin).not.toHaveBeenCalled();
    expect(query.where).not.toHaveBeenCalled();
  });
});

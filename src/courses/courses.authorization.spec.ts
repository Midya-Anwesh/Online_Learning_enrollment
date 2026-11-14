import { ForbiddenException } from '@nestjs/common';
import { CoursesService } from './courses.service';

describe('Course ownership', () => {
  let service: CoursesService;
  let repo: any;
  let users: any;
  let dataSource: any;
  let instructors: any;
  beforeEach(() => {
    repo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue({ id: 'course', instructors: [] }),
      save: jest.fn(value => value),
    };
    users = { findUser: jest.fn() };
    instructors = { createInstructor: jest.fn() };
    const manager = { create: jest.fn((_entity, value) => value), save: jest.fn(value => value) };
    dataSource = { transaction: jest.fn(fn => fn(manager)) };
    service = new CoursesService(repo, instructors, dataSource, users);
  });
  const caller = { sub: 'caller', tokenIdentifier: 'session' };

  it.each(['student', 'unknown'])('denies %s creating a course', async role => {
    users.findUser.mockResolvedValue({ id: 'caller', role });
    await expect(service.createCourse({ title: 'Course', instructors: ['caller'] }, caller))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });
  it('denies an instructor assigning someone else during creation', async () => {
    users.findUser.mockResolvedValue({ id: 'caller', role: 'instructor' });
    await expect(service.createCourse({ title: 'Course', instructors: ['other'] }, caller))
      .rejects.toBeInstanceOf(ForbiddenException);
  });
  it.each(['admin', 'instructor'])('allows %s creating a self-assigned course', async role => {
    users.findUser.mockResolvedValue({ id: 'caller', role });
    await service.createCourse({ title: 'Course', instructors: ['caller'] }, caller);
    expect(instructors.createInstructor).toHaveBeenCalled();
  });
  it('allows admins creating courses for other instructors', async () => {
    users.findUser.mockResolvedValue({ id: 'caller', role: 'admin' });
    await service.createCourse({ title: 'Course', instructors: ['other'] }, caller);
    expect(instructors.createInstructor).toHaveBeenCalled();
  });
  it('allows an unassigned admin to rename a course', async () => {
    users.findUser.mockResolvedValue({ id: 'caller', role: 'admin' });
    expect((await service.updateCourse('course', 'Renamed', caller)).title).toBe('Renamed');
  });
  it('denies an unassigned instructor renaming a course', async () => {
    users.findUser.mockResolvedValue({ id: 'caller', role: 'instructor' });
    await expect(service.updateCourse('course', 'Renamed', caller))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.save).not.toHaveBeenCalled();
  });
  it('allows an assigned instructor to rename a course', async () => {
    users.findUser.mockResolvedValue({ id: 'caller', role: 'instructor' });
    repo.findOne.mockResolvedValue({ instructors: [{ instructor: { id: 'caller' } }] });
    await service.updateCourse('course', 'Renamed', caller);
    expect(repo.save).toHaveBeenCalled();
  });
});

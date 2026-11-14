import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Users } from '../src/users/users.entity';
import { JwtTokenList } from '../src/auth/jwtTokenList/jwtTokenList.entity';
import { bootstrapAdmin } from '../scripts/bootstrap-admin';
import { db_config } from '../datasource';

// Requires an EMPTY, migrated, disposable MySQL database. Never truncates tables.
// The explicit opt-in name check runs before any connection or writes.
describe('MySQL-backed authorization lifecycle', () => {
  let app: INestApplication;
  let source: DataSource;
  const accounts: Record<string, { token: string; id: string; email: string }> = {};
  const password = 'integration-test-password';
  let courseId: string;
  let otherCourseId: string;
  let lessonId: string;

  beforeAll(async () => {
    if (!process.env.DB_NAME?.startsWith('online_learning_test_')) {
      throw new Error('Use a disposable DB_NAME beginning online_learning_test_');
    }
    // Bootstrap through the same local operator function, on a dedicated source.
    const bootstrapSource = new DataSource(db_config.options);
    await bootstrapSource.initialize();
    if (await bootstrapSource.getRepository(Users).count()) {
      await bootstrapSource.destroy();
      throw new Error('Integration database must be empty');
    }
    await bootstrapSource.destroy();

    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    source = module.get(DataSource);
  });
  afterAll(async () => { await app?.close(); });

  async function login(name: string) {
    const email = accounts[name]?.email ?? `${name}@example.com`;
    const result = await request(app.getHttpServer()).post('/auth/login').send({ email, password }).expect(201);
    accounts[name] = { token: result.body.accessToken, id: result.body.sub, email };
  }
  function getAs(path: string, name: string) {
    return request(app.getHttpServer()).get(path).auth(accounts[name].token, { type: 'bearer' });
  }
  function writeAs(method: string, path: string, name: string, body = {}) {
    return request(app.getHttpServer())[method](path).auth(accounts[name].token, { type: 'bearer' }).send(body);
  }

  it('rejects privilege escalation and registers only students', async () => {
    for (const role of ['admin', 'instructor']) {
      await request(app.getHttpServer()).post('/auth/signup').send({
        name: 'Attacker', role, email: 'attacker@example.com', password,
      }).expect(400);
    }
    for (const name of ['admin', 'instructor', 'other', 'student']) {
      const result = await request(app.getHttpServer()).post('/auth/signup').send({
        name, email: `${name}@example.com`, password,
      }).expect(201);
      expect(result.body.role).toBe('student');
      await login(name);
    }
  });

  it('bootstraps exactly one admin and invalidates their old student session', async () => {
    await bootstrapAdmin(new DataSource(db_config.options), accounts.admin.email);
    await getAs('/users/all', 'admin').expect(400);
    await login('admin');
    await getAs('/users/all', 'admin').expect(200);
    await expect(bootstrapAdmin(new DataSource(db_config.options), accounts.other.email))
      .rejects.toThrow('admin already exists');
  });

  it('allows only admins to promote roles and revokes previous target sessions', async () => {
    await writeAs('post', '/users/assign_role', 'student', {
      email: accounts.student.email, role: 'admin',
    }).expect(403);
    for (const name of ['instructor', 'other']) {
      await writeAs('post', '/users/assign_role', 'admin', {
        email: accounts[name].email, role: 'instructor',
      }).expect(201);
      await getAs('/users/profile', name).expect(400);
      await login(name);
    }
  });

  it('prevents cross-account profile writes and preserves the victim', async () => {
    await writeAs('patch', '/users', 'student', {
      oldEmail: accounts.instructor.email, name: 'Hijacked',
    }).expect(403);
    expect((await source.getRepository(Users).findOneByOrFail({ id: accounts.instructor.id })).name)
      .toBe('instructor');
  });

  it('limits course creation to instructors/admins and self-assignment for instructors', async () => {
    await writeAs('post', '/courses', 'student', { title: 'Bad', instructors: [accounts.instructor.id] }).expect(403);
    await writeAs('post', '/courses', 'instructor', { title: 'Bad', instructors: [accounts.other.id] }).expect(403);
    const course = await writeAs('post', '/courses', 'instructor', {
      title: 'Protected Course', instructors: [accounts.instructor.id],
    }).expect(201);
    courseId = course.body.id;
    const other = await writeAs('post', '/courses', 'admin', {
      title: 'Other Course', instructors: [accounts.other.id],
    }).expect(201);
    otherCourseId = other.body.id;
  });

  it('enforces course ownership while allowing admin override', async () => {
    await writeAs('patch', '/courses', 'other', { id: courseId, newTitle: 'Hijacked' }).expect(403);
    await writeAs('patch', '/courses', 'instructor', { id: courseId, newTitle: 'Updated Course' }).expect(200);
    await writeAs('patch', '/courses', 'admin', { id: courseId, newTitle: 'Admin Updated Course' }).expect(200);
  });

  it('checks assignment on lesson creation and allows admin lesson management', async () => {
    const body = { name: 'Intro', code: 'INTRO', desc: 'Original content', courseId };
    await writeAs('post', '/lessions', 'other', body).expect(403);
    const lesson = await writeAs('post', '/lessions', 'instructor', body).expect(201);
    lessonId = lesson.body.id;
    await writeAs('patch', '/lessions', 'other', { id: lessonId, desc: 'Hijacked' }).expect(403);
    const update = await writeAs('patch', '/lessions', 'admin', { id: lessonId, name: 'Admin Intro' }).expect(200);
    // A partial update must not erase the previously stored description.
    expect(update.body.name).toBe('Admin Intro');
    await writeAs('post', '/lessions', 'admin', {
      ...body, code: 'OTHER', courseId: otherCourseId,
    }).expect(201);
  });

  it('keeps the catalog public but restricts lesson content by enrollment/assignment', async () => {
    await request(app.getHttpServer()).get('/courses').expect(200);
    await request(app.getHttpServer()).get('/lessions').expect(401);
    expect((await getAs(`/lessions?courseId=${courseId}`, 'student').expect(200)).body).toEqual({});
    expect((await getAs(`/lessions?courseId=${courseId}`, 'other').expect(200)).body).toEqual({});
    expect(Object.keys((await getAs('/lessions', 'instructor').expect(200)).body)).toEqual(['Admin Updated Course']);
    expect(Object.keys((await getAs('/lessions', 'admin').expect(200)).body)).toHaveLength(2);
    await writeAs('post', '/enrollments', 'student', { courseId }).expect(201);
    const visible = (await getAs('/lessions', 'student').expect(200)).body;
    expect(Object.keys(visible)).toEqual(['Admin Updated Course']);
    expect(visible['Admin Updated Course'][0].description).toBe('Original content');
    // Specific course filtering must not overwrite the authorization predicate.
    expect((await getAs(`/lessions?courseId=${otherCourseId}`, 'student').expect(200)).body).toEqual({});
  });

  it('protects enrollment and user reports, permitting self enrollment reads', async () => {
    for (const path of ['/users?role=student', '/enrollments', `/enrollments/${accounts.student.id}`]) {
      await request(app.getHttpServer()).get(path).expect(401);
    }
    await getAs('/enrollments', 'student').expect(403);
    await getAs(`/enrollments/${accounts.instructor.id}`, 'student').expect(403);
    const own = await getAs(`/enrollments/${accounts.student.id}`, 'student').expect(200);
    expect(own.body).toHaveLength(1);
    await getAs('/enrollments', 'admin').expect(200);
    await getAs('/users?role=student', 'student').expect(403);
  });

  it('removes lesson visibility after unenrollment', async () => {
    await writeAs('delete', `/enrollments/${courseId}`, 'student').expect(200);
    expect((await getAs('/lessions', 'student').expect(200)).body).toEqual({});
  });

  it('does not let a demoted instructor reuse stale assignments', async () => {
    await writeAs('post', '/users/assign_role', 'admin', {
      email: accounts.instructor.email, role: 'student',
    }).expect(201);
    await getAs('/lessions', 'instructor').expect(400);
    await login('instructor');
    expect((await getAs('/lessions', 'instructor').expect(200)).body).toEqual({});
    await writeAs('patch', '/courses', 'instructor', {
      id: courseId, newTitle: 'Not authorized',
    }).expect(403);
  });

  it('blocks every old session after email and password changes', async () => {
    await login('student');
    const oldToken = accounts.student.token;
    const oldEmail = accounts.student.email;
    await writeAs('patch', '/auth/update/email', 'student', {
      oldEmail, newEmail: 'renamed-student@example.com',
    }).expect(200);
    await request(app.getHttpServer()).get('/users/profile').auth(oldToken, { type: 'bearer' }).expect(400);
    accounts.student.email = 'renamed-student@example.com';
    await login('student');
    const tokenOne = accounts.student.token;
    await login('student');
    const tokenTwo = accounts.student.token;
    const changed = await writeAs('post', '/auth/update_password', 'student', {
      email: accounts.student.email, oldPassword: password, newPassword: 'changed-integration-password',
    }).expect(201);
    for (const token of [tokenOne, tokenTwo]) {
      await request(app.getHttpServer()).get('/users/profile').auth(token, { type: 'bearer' }).expect(400);
    }
    await request(app.getHttpServer()).get('/users/profile')
      .auth(changed.body.accessToken, { type: 'bearer' }).expect(200);
    expect(await source.getRepository(JwtTokenList).count({ where: {
      user: { id: accounts.student.id }, blockListed: true,
    } })).toBeGreaterThanOrEqual(3);
  });
});

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PassportModule } from '@nestjs/passport';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { UsersController } from './users/users.controller';
import { UsersService } from './users/users.service';
import { EnrollmentsController } from './enrollments/enrollments.controller';
import { EnrollmentsService } from './enrollments/enrollments.service';
import { CoursesController } from './courses/courses.controller';
import { CoursesService } from './courses/courses.service';
import { LessionsController } from './lessions/lessions.controller';
import { LessionsService } from './lessions/lessions.service';
import { jwtValidationStrategy } from './auth/strategies/jwt.strategy';
import { JwtTokenSerive } from './auth/jwtTokenList/jwtTokenService';

// Real HTTP controllers, validation, Passport JWT verification and role guard.
// Persistence/service behavior is covered separately; these doubles isolate routing.
describe('HTTP authorization boundaries', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const roles = new Map([
    ['student', 'student'], ['instructor', 'instructor'], ['admin', 'admin'],
  ]);
  const users = {
    findUser: jest.fn(async id => roles.has(id) ? { id, role: roles.get(id) } : null),
    getUserByRole: jest.fn(() => []), getAllUsers: jest.fn(() => []),
    assignRole: jest.fn(() => ({})), updateUser: jest.fn(() => ({})),
    enrolledCourses: jest.fn(() => []), viewProfile: jest.fn(() => ({})),
  };
  const auth = { signup: jest.fn(() => ({})) };
  const enrollments = { getEnrollments: jest.fn(() => []) };
  const courses = {
    getAllCourses: jest.fn(() => []), createCourse: jest.fn(() => ({})),
    updateCourse: jest.fn(() => ({})), deleteCourse: jest.fn(() => ({})),
    addInstructors: jest.fn(() => ({})),
  };
  const lessions = {
    getLessionsByCourse: jest.fn(() => ({})), createLession: jest.fn(() => ({})),
    updateLession: jest.fn(() => ({})), deleteLession: jest.fn(() => ({})),
  };

  beforeAll(async () => {
    const secret = randomUUID(); // Ephemeral test-only key; never logged.
    const module = await Test.createTestingModule({
      imports: [
        PassportModule,
        JwtModule.register({ secret }),
        ThrottlerModule.forRoot([{ ttl: 60000, limit: 1000 }]),
      ],
      controllers: [AuthController, UsersController, EnrollmentsController, CoursesController, LessionsController],
      providers: [
        jwtValidationStrategy,
        { provide: ConfigService, useValue: { getOrThrow: () => secret } },
        { provide: UsersService, useValue: users },
        { provide: AuthService, useValue: auth },
        { provide: CoursesService, useValue: courses },
        { provide: EnrollmentsService, useValue: enrollments },
        { provide: LessionsService, useValue: lessions },
        { provide: JwtTokenSerive, useValue: {
          isBlocked: jest.fn(async identifier => identifier === 'revoked'),
        } },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    jwt = module.get(JwtService);
  });
  afterAll(async () => { await app?.close(); });

  const privateReads = ['/users?role=student', '/users/all', '/users/profile', '/enrollments', '/enrollments/student', '/lessions'];
  it.each(privateReads)('rejects anonymous GET %s', async path => {
    await request(app.getHttpServer()).get(path).expect(401);
  });

  it.each(['admin', 'instructor'])('rejects %s at public signup', async role => {
    await request(app.getHttpServer()).post('/auth/signup').send({
      name: 'Visitor', email: 'visitor@example.com', password: 'test-only', role,
    }).expect(400);
    expect(auth.signup).not.toHaveBeenCalled();
  });

  it('allows registration without a role', async () => {
    await request(app.getHttpServer()).post('/auth/signup').send({
      name: 'Visitor', email: 'visitor@example.com', password: 'test-only',
    }).expect(201);
  });

  it.each(['student', 'instructor'])('denies %s access to admin-only reads', async role => {
    const token = jwt.sign({ sub: role, tokenIdentifier: 'valid' });
    for (const path of ['/users?role=student', '/users/all', '/enrollments']) {
      await request(app.getHttpServer()).get(path).auth(token, { type: 'bearer' }).expect(403);
    }
  });

  it.each(['student', 'instructor'])('denies %s assigning roles', async role => {
    const token = jwt.sign({ sub: role, tokenIdentifier: 'valid' });
    await request(app.getHttpServer()).post('/users/assign_role')
      .auth(token, { type: 'bearer' })
      .send({ email: 'other@example.com', role: 'admin' }).expect(403);
  });

  it.each(['student', 'instructor', 'admin'])('allows %s to request filtered lesson reads', async role => {
    const token = jwt.sign({ sub: role, tokenIdentifier: 'valid' });
    await request(app.getHttpServer()).get('/lessions')
      .auth(token, { type: 'bearer' }).expect(200);
    expect(lessions.getLessionsByCourse).toHaveBeenCalledWith('*', expect.objectContaining({ sub: role }));
  });

  it('allows admins to read the enrollment report and assign roles', async () => {
    const token = jwt.sign({ sub: 'admin', tokenIdentifier: 'valid' });
    await request(app.getHttpServer()).get('/enrollments').auth(token, { type: 'bearer' }).expect(200);
    await request(app.getHttpServer()).post('/users/assign_role').auth(token, { type: 'bearer' })
      .send({ email: 'other@example.com', role: 'instructor' }).expect(201);
  });

  it('uses the current DB role rather than a stale admin JWT claim', async () => {
    const token = jwt.sign({ sub: 'student', role: 'admin', tokenIdentifier: 'valid' });
    await request(app.getHttpServer()).get('/users/all').auth(token, { type: 'bearer' }).expect(403);
  });

  it.each(['expired', 'revoked', 'deleted'])('rejects %s sessions', async kind => {
    const token = jwt.sign({
      sub: kind === 'deleted' ? 'missing' : 'admin',
      tokenIdentifier: kind === 'revoked' ? 'revoked' : 'valid',
    }, { expiresIn: kind === 'expired' ? -1 : 60 });
    const response = await request(app.getHttpServer()).get('/users/all').auth(token, { type: 'bearer' });
    expect(response.status).toBe(kind === 'expired' ? 401 : kind === 'revoked' ? 400 : 404);
  });

  it('keeps course discovery public', async () => {
    await request(app.getHttpServer()).get('/courses').expect(200);
  });

  it.each(['post', 'patch', 'delete'])('denies student lesson %s requests', async method => {
    const token = jwt.sign({ sub: 'student', tokenIdentifier: 'valid' });
    await request(app.getHttpServer())[method](method === 'delete' ? '/lessions/lesson' : '/lessions')
      .auth(token, { type: 'bearer' }).send({}).expect(403);
  });

  it('does not allow instructors to delete courses', async () => {
    const token = jwt.sign({ sub: 'instructor', tokenIdentifier: 'valid' });
    await request(app.getHttpServer()).delete('/courses/course')
      .auth(token, { type: 'bearer' }).expect(403);
  });
});

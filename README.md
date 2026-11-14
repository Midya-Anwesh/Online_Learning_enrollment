# Online Learning Enrollment API

A NestJS REST API for managing users, courses, instructor assignments, lessons, and course enrollments. Built with TypeScript, Express, TypeORM, and MySQL, with Passport authentication, Argon2 password hashing, and database-backed JWT tracking.

This repository contains the backend only: there is no frontend, Swagger UI, general-purpose seed script, or Docker configuration. A local first-admin bootstrap command is included.

> **Development project — review before deployment.** Public signup creates students only. Personal-data endpoints require authorization, lesson visibility is enrollment/assignment-based, and admins can manage all courses. See [Security and implementation limitations](#security-and-implementation-limitations) for remaining work.

For a before-and-after explanation, file-by-file inventory, verification results, and rollout notes, see the [change guide](docs/AUTHORIZATION_CHANGES.md).

## Contents

- [How it works](#how-it-works)
- [Local setup](#local-setup)
- [Accounts and authentication](#accounts-and-authentication)
- [Roles and permissions](#roles-and-permissions)
- [API reference](#api-reference)
- [Example workflow](#example-workflow)
- [Development commands](#development-commands)
- [Troubleshooting](#troubleshooting)
- [Security and implementation limitations](#security-and-implementation-limitations)
- [Project structure](#project-structure)

## How it works

The application follows NestJS's controller → service → TypeORM repository pattern:

1. Controllers define HTTP routes, request DTOs, and route-level guards.
2. A global `ValidationPipe` validates decorated DTO fields, strips unrecognized fields (`whitelist: true`), and enables transformation.
3. Services implement business rules, including course assignment and enrollment ownership checks.
4. TypeORM stores data in MySQL. Schema changes are applied with migrations; `synchronize` is disabled.
5. Serialization interceptors on the user/auth controllers and enrollment creation expose selected response fields rather than raw password hashes.

### Data model

| Entity/table | Purpose | Important relationships and constraints |
| --- | --- | --- |
| `Users` / `users` | Account, role, email, Argon2 password hash | UUID ID; unique email; name column limited to 50 characters |
| `Courses` / `courses` | Course title | Has enrollments, instructor assignments, and lessons |
| `Instructors` / `instructors` | Assigns a user to a course | Unique instructor/course pair; assigned users cannot have the `student` role |
| `Enrollments` / `enrollments` | Assigns a learner to a course | Unique user/course pair; enrollment timestamp |
| `Lessions` / `lessions` | Lesson name, code, description, parent course | Unique code/course pair; code length at most 10 |
| `JwtTokenList` / `jwt_token_list` | Tracks issued token identifiers and blocklist state | Unique user/token-identifier pair |

Deleting a course cascades to its lessons, instructor assignments, and enrollments. Deleting a user cascades to their instructor assignments and enrollments; token rows retain a nullable user reference (`ON DELETE SET NULL`).

**Naming compatibility:** the code and API spell lessons as **`lessions`** and an individual lesson as **`lession`**. Use those spellings in requests; `/lessons` is not an implemented route.

## Local setup

### Prerequisites

- Node.js **20 or newer** (required by the locked NestJS/cross-env packages); a supported LTS release is recommended.
- npm.
- A running MySQL server and an account allowed to create/alter tables in the application's database.
- Git.

### 1. Get the source

```bash
git clone https://github.com/Midya-Anwesh/Online_Learning_enrollment.git
cd Online_Learning_enrollment
npm ci
```

### 2. Create an empty database

Run this in your MySQL client using an appropriately privileged account:

```sql
CREATE DATABASE online_learning CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Configure a dedicated database user locally. Do not use a production database for initial setup or tests.

### 3. Configure the environment

Create `.env.development` in the repository root:

```dotenv
DB_TYPE=mysql
DB_NAME=online_learning
USER_NAME=
PASSWORD=
JWT_SECRET=
JWT_EXPIRES_IN=1d
PORT=3000
TTL=60000
LIMIT=1
```

Fill in the empty database credentials and a strong, randomly generated JWT signing secret locally. Keep them out of version control. The repository ignores `.env.*` files.

| Variable | Meaning and current behavior |
| --- | --- |
| `DB_TYPE` | Set to `mysql`; the installed driver is `mysql2` |
| `DB_NAME` | Database created in the previous step |
| `USER_NAME` | MySQL username — this is **not** `DB_USER` |
| `PASSWORD` | MySQL password — this is **not** `DB_PASSWORD` |
| `JWT_SECRET` | JWT signing/verification secret; set explicitly |
| `JWT_EXPIRES_IN` | Signing lifetime; defaults to `1d` |
| `PORT` | HTTP listening port; defaults to `3000` |
| `TTL` | Throttling window in milliseconds; defaults to `60000` |
| `LIMIT` | Requests per throttling window; defaults to `1` |
| `NODE_ENV` | npm start/TypeORM scripts set this to `development`; test scripts set `test` |

`datasource.ts` only configures database credentials/entities for `NODE_ENV=development`. It does **not** read host/port variables: it relies on the MySQL driver's local connection defaults (normally `localhost:3306`). A remote database or non-default port requires a code change to the data source.

Throttling is applied only to `PATCH /users`, not globally. Environment values are read without explicit numeric conversion; a TypeScript `get<number>()` annotation does not itself coerce an environment string.

### 4. Apply migrations

```bash
npm run typeorm -- migration:show -d datasource.ts
npm run typeorm -- migration:run -d datasource.ts
```

Migrations create the tables, indexes, and foreign keys. Do not turn on schema synchronization as a substitute.

### 5. Start the API

```bash
npm run start:dev
```

The default base URL is `http://localhost:3000`, with **no `/api` prefix**.

```bash
curl http://localhost:3000/
```

Expected root response: `Hello World!`

The build, regression tests, all eight migrations, and database-backed authorization tests have been verified in an isolated MariaDB environment. Configure and test your own database separately; this does not establish production readiness.

## Accounts and authentication

### Create an account

Send `POST /auth/signup` with these JSON fields (`role` is optional and may only be `student`):

```json
{
  "name": "Demo Student",
  "role": "student",
  "email": "student@example.com",
  "password": "<choose a local password>"
}
```

Accounts have one of three roles: `student`, `instructor`, or `admin`. Public signup always stores `student`; requests specifying privileged roles are rejected. Email must be valid and unique. Passwords are hashed with Argon2; there is no DTO-enforced minimum password length.

Signup returns selected account fields, **not an access token or the account UUID**. Log in next to obtain the UUID in `sub`.

### Create the first admin and instructor accounts

Register the intended administrator as a normal student, then run this **locally on the server** using the configured database:

```bash
npm run bootstrap:admin -- admin@example.com
```

The command promotes an existing account only when no admin exists, serializes concurrent bootstrap commands with a MySQL advisory lock, and revokes that account's existing sessions. It is not an HTTP endpoint and requires database access. Log in again afterward.

Once an admin exists, use authenticated `POST /users/assign_role` to promote registered accounts to instructor/admin. The bootstrap command refuses to create additional admins. Role changes revoke the target's sessions; that user must log in again.

On an existing installation, review previously created admin accounts before deploying: preventing privileged signup does not remove old privileged accounts or retroactively repair malicious profile changes.

### Log in

Send `POST /auth/login`:

```json
{
  "email": "student@example.com",
  "password": "<the password chosen at signup>"
}
```

The serialized login response exposes `accessToken`, `sub` (user UUID), `mail`, and `role`. Other exposed-but-unset fields may be omitted. The internal `tokenIdentifier` is not included by the response serializer.

Use the returned token for guarded routes:

```http
Authorization: Bearer <accessToken>
```

Do not send a stale or invalid Authorization header to public endpoints: middleware validates supplied tokens on most routes even where login is not required.

### Authentication and RBAC internals

1. `PassportLocalGuard` invokes the local strategy, which reads `email` and `password`, verifies the Argon2 hash, and issues a signed JWT.
2. JWT claims include `sub`, `tokenIdentifier`, `mail`, and `role`. A matching, non-blocklisted token record is saved in MySQL.
3. `CurrentUsersMiddleware` verifies supplied JWTs and attaches the payload to `req.currUser`. It does not reject requests simply because a token is absent.
4. Routes using `jwtAuthGuard` run the JWT strategy, which checks the token record/blocklist, then reload the user from the database.
5. `@Roles(...)` stores allowed-role metadata. The guard compares it against the user's **current database role**, not merely the role embedded in an old token.
6. Services additionally check the caller's identity or course assignment. Admins can manage any course and lesson; instructors need assignment to the relevant course.

Both middleware and the Passport JWT strategy enforce expiration. `JWT_SECRET` must be configured explicitly; there is no strategy fallback secret.

Password changes require the caller's old password, update the caller's account, block **all** of their existing sessions, and return a new login response. Email changes (through either profile or auth routes) and role changes also revoke all target-user sessions; log in again. Name-only updates do not revoke sessions. There is no logout or refresh-token endpoint.

## Roles and permissions

This matrix describes the **current controller and service checks**. “Assigned” means the user has an `instructors` row for the relevant course, not just the `instructor` role.

| Action | Anonymous | Student | Instructor | Admin |
| --- | --- | --- | --- | --- |
| Browse/search courses and course statistics | Yes | Yes | Yes | Yes |
| Read another instructor's course list (name and course titles) | Yes | Yes | Yes | Yes |
| Read lesson content | No | Enrolled courses | Enrolled or assigned courses | All courses |
| Read enrollment records | No | Own only | Own only | Any/all users |
| List users by role or list all users | No | No | No | Yes |
| View own token identity, profile, and enrolled courses | No | Yes | Yes | Yes |
| Change own password | No | Yes | Yes | Yes |
| Change email via `/auth/update/email` | No | Own only | Own only | Own or another user's |
| Update name/email via `PATCH /users` | No | Own only | Own only | Own or another user's |
| Delete an account | No | Own only | Own only | Own or another user's |
| Create a course and provide initial instructor assignments | No | No | Self-assignment only | Any eligible instructors |
| Rename a course | No | No | Assigned courses only | Any course |
| Add/remove instructors on an existing course | No | No | No | Yes |
| Delete a course | No | No | No | Yes |
| Create a lesson | No | No | Assigned parent course only | Any existing course |
| Update a lesson | No | No | Assigned parent course only | Any lesson |
| Delete a lesson | No | No | No | Yes |
| Enroll/unenroll | No | Self only | Self only | Self or another user |
| Assign a role or use `GET /users/all` | No | No | No | Yes |

Additional rules:

- Creating a course requires at least one instructor UUID. Each assigned account must exist and must not currently be a student. Admin accounts can be assigned as instructors.
- Course creation and instructor assignment are transactional. An instructor creating a course must supply exactly their own UUID; admins may assign any eligible accounts and need not assign themselves.
- For non-admin enrollment creation, a supplied `userId` is ignored and the caller is enrolled instead.
- Instructors and admins can themselves enroll as learners.
- Lesson reads require authentication and return only authorized courses. A query for an inaccessible course returns an empty object, not its lessons. Unenrollment removes enrollment-based visibility immediately.
- Role changes revoke existing tokens and take effect through database lookup. They do not remove existing assignment rows; a demoted student cannot use stale instructor assignments to manage lessons or read them without enrollment.

## API reference

All paths are relative to the base URL. Request bodies are JSON (`Content-Type: application/json`). IDs are UUIDs; examples below use placeholders that must be replaced.

### Public routes

| Method | Path | Input / result |
| --- | --- | --- |
| GET | `/` | Returns `Hello World!` |
| POST | `/auth/signup` | Body: `name`, `email`, `password`; optional `role` must be `student` |
| POST | `/auth/login` | Body: `email`, `password`; returns token and identity |
| GET | `/courses?term=Nest` | Searches course titles with SQL `LIKE`; omitted term lists matching nonempty titles |
| GET | `/courses/stat` | Optional `courseId`, `page` (default `1`), `limit` (`10`), `sort` (`1`), `order` (`ASC`/`DESC`); sorts by enrollment count when enabled |
| GET | `/courses/student_count?id=<courseId>` | Enrollment count per course; omit `id` for all courses; includes enrolled users of any role |
| GET | `/courses/lession_count?id=<courseId>` | Lesson count per course; omit `id` for all |
| GET | `/instructors/<userId>/courses` | Assigned course titles for a user |

### Authenticated account routes

| Method | Path | JSON body / behavior |
| --- | --- | --- |
| GET | `/auth/me` | Token-derived identity; not a fresh profile lookup |
| GET | `/users/profile` | Own name, assigned course titles, enrolled course titles |
| GET | `/users/enrolled_courses` | Own enrollment course titles/dates |
| PATCH | `/users` | Required `oldEmail`; optional `name`, `email`; throttled; self or admin only |
| POST | `/auth/update_password` | `email`, `oldPassword`, `newPassword`; updates caller only, including for admins |
| PATCH | `/auth/update/email` | `oldEmail`, `newEmail`; only admins may target a different account |
| DELETE | `/auth/delete` | Deletes self; admin may add `?userId=<targetId>` |
| POST | `/users/assign_role` | Admin only; `email`, `role` |
| GET | `/users/all` | Admin only; serialized account list |
| GET | `/users?role=student` | Admin only; serialized users by role |
| GET | `/enrollments` | Admin only; all enrollment records |
| GET | `/enrollments/<userId>` | Own records, or any user's records for admins |
| GET | `/lessions?courseId=<courseId>` | Only enrolled/assigned courses, or all for admins; omit `courseId` for all visible courses |

For password changes, non-admins must supply their own email; admins still update only their own password and must provide their own old password.

### Course, instructor, lesson, and enrollment writes

| Method | Path | JSON body | Access |
| --- | --- | --- | --- |
| POST | `/courses` | `{"title":"NestJS Basics","instructors":["<instructorId>"]}` | Instructor assigning self only, or admin |
| PATCH | `/courses` | `{"id":"<courseId>","newTitle":"NestJS Essentials"}` | Assigned instructor, or any admin |
| DELETE | `/courses/<courseId>` | None | Admin |
| POST | `/courses/<courseId>/assign_instructors` | `{"instructorIds":["<userId>"]}` | Admin |
| DELETE | `/courses/<courseId>/remove_instructors` | `{"instructorIds":["<userId>"]}` | Admin; body is required even on DELETE |
| GET | `/instructors/myCourses` | None | Instructor/admin; lists own assignments |
| POST | `/lessions` | `{"name":"Introduction","code":"INTRO","desc":"Getting started","courseId":"<courseId>"}` | Assigned instructor, or any admin |
| PATCH | `/lessions` | `{"id":"<lessionId>","name":"Updated name","code":"INTRO2","desc":"Updated description"}` | Assigned instructor, or any admin |
| DELETE | `/lessions/<lessionId>` | None | Admin |
| POST | `/enrollments` | `{"courseId":"<courseId>"}`; admin may also supply `userId` | Any authenticated role |
| DELETE | `/enrollments/<courseId>` | None; admin may add `?userId=<targetId>` | Self, or admin acting for another user |

Lesson creation requires nonempty `name`, `code`, and `desc`; `code` is at most 10 characters. Lesson updates require `id`; omitted editable fields are preserved. `desc` is stored as `description`.

### Response and error notes

- The user/auth serializer excludes password hashes and account `id`; login exposes the user UUID as `sub`. User lists therefore cannot currently be used to discover account UUIDs.
- Save course/lesson UUIDs from their creation responses. `GET /lessions` deliberately removes lesson IDs, and there is no separate lesson-detail endpoint.
- `GET /lessions` groups by **title**, so different courses with the same title share an output group.
- Enrollment creation is serialized to `id`, `enrolledOn`, selected user fields, and course `id`/`title`. Enrollment reads return raw report rows with display labels.
- SQL failures are converted to HTTP `400` with `msg`, `sql_err_code`, and `sql_err`. Duplicate emails, enrollment pairs, instructor pairs, and lesson code/course pairs can trigger uniqueness errors.
- Role, profile ownership, course/lesson management, and enrollment-read denials produce `403`. Older account/enrollment-write ownership checks still use `400`. Missing resources commonly produce `404`; missing authentication normally produces `401`. Invalid/blocked token records can produce `400` or `404`.

## Example workflow

Use a local API client such as Postman, Insomnia, or curl. Store tokens/passwords privately; do not commit request collections containing them.

1. **Create test accounts:** call `/auth/signup` for three normal student accounts with different emails. Bootstrap one as the first admin using the local command above.
2. **Promote and log in:** log in as admin and promote one account to instructor with `/users/assign_role`. Log in each account after its final role change; save each token privately and each `sub` UUID.
3. **Create a course as the instructor:** `POST /courses` with the instructor's `sub` in `instructors`. Save the returned course `id`.
4. **Add a lesson as the instructor:** `POST /lessions` with that course ID. Save the returned lesson `id`.
5. **Browse as an anonymous visitor:** call `/courses` and `/courses/stat` without a token. Lesson reads require login and enrollment/assignment.
6. **Enroll as the student:** `POST /enrollments` with `courseId`, then inspect `/users/enrolled_courses` and `/lessions?courseId=<courseId>` using the student's token.
7. **Try access boundaries:** a student cannot create courses or modify another account; an unassigned instructor cannot rename a course or create/edit its lessons. Unenrolled users cannot read its lessons.
8. **Manage as admin:** use `/users/assign_role`, instructor-assignment routes, or enrollment `userId` targeting. Admins can rename courses and manage lessons without being assigned.
9. **Unenroll as the student:** `DELETE /enrollments/<courseId>`. Account/course deletion is destructive and also removes related records as described above.

Example authenticated read, assuming `ACCESS_TOKEN` was set privately in your shell:

```bash
curl http://localhost:3000/users/enrolled_courses \
  -H "Authorization: Bearer ${ACCESS_TOKEN}"
```

## Development commands

| Command | Purpose / caveat |
| --- | --- |
| `npm ci` | Install the locked dependency versions |
| `npm run start` | Start with `NODE_ENV=development` |
| `npm run start:dev` | Start in watch mode |
| `npm run start:debug` | Start in debug/watch mode |
| `npm run build` | Compile with Nest CLI |
| `npm run start:prod` | Attempts `node dist/main`, but still forces `NODE_ENV=development`; not a ready production configuration |
| `npm test -- --runInBand` | Unit tests |
| `npm run test:watch` | Watch unit tests |
| `npm run test:cov` | Unit-test coverage |
| `npm run test:e2e` | End-to-end tests; database/test configuration needs work |
| `npm run test:security:integration` | Database-backed authorization lifecycle tests; requires an empty, migrated, disposable development-config database |
| `npm run bootstrap:admin -- admin@example.com` | Promote a registered account only if no admin exists; requires local database access |
| `npm run lint` | Runs ESLint with `--fix`; checked-in rules are commented out |
| `npm run format` | Formats source and test TypeScript files |
| `npm run typeorm -- migration:show -d datasource.ts` | Inspect migration status |
| `npm run typeorm -- migration:run -d datasource.ts` | Apply pending migrations |

`npm test -- --runInBand` includes service-level authorization, HTTP guard/validation, session-revocation, and admin-bootstrap regression tests without a database. The separate integration suite uses the full Nest app, real Passport authentication, actual migrations, and database persistence.

To run the integration suite, create a fresh database whose name begins **`online_learning_test_`**, set `DB_NAME` to it along with the development connection settings and `JWT_SECRET`, apply migrations, then run:

```bash
npm run typeorm -- migration:run -d datasource.ts
npm run test:security:integration
```

The suite refuses other database-name prefixes and nonempty user tables, never truncates tables, and leaves synthetic records for inspection. It covers signup escalation, first-admin bootstrap, role/session changes, cross-account writes, course/lesson ownership, filtered reads, unenrollment, and password/email session revocation. Use a new disposable database for each run. Validation used MariaDB (MySQL-compatible), not a production server.

The original `test:e2e` starter script still sets `NODE_ENV=test`, but `datasource.ts` has no test configuration branch. Use the dedicated security integration command above; an `.env.test` file alone does not fix the original starter suite.

Production also requires checking the compiled entry point and absolute-import resolution (`datasource`, `src/...`) against the actual build output. Do not assume `start:prod` is verified simply because the script exists.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Database connection refused | MySQL must be reachable at the data source's local defaults; host/port environment settings are not currently wired up |
| Access denied / unknown database | Verify `USER_NAME`, `PASSWORD`, `DB_NAME`, database existence, and grants |
| Missing table or index | Run pending migrations against the intended development database |
| `Unknown environment: test` | Data source currently supports only development; add explicit isolated test configuration |
| Unauthorized / bad token | Send `Authorization: Bearer …`; use the correct signing configuration and a current login token |
| Blocklisted/missing token entry | Log in again; do not manually invent JWTs or token rows |
| Cannot read lesson content | Log in and enroll or obtain instructor assignment; admins have full visibility |
| Instructor cannot create/edit a lesson | An instructor role alone is insufficient; the caller must be assigned to the parent course |
| Cannot assign a student as instructor | Change the account's role to instructor/admin first |
| Duplicate enrollment/instructor/lesson | Check the unique pairs listed in the data model; choose a new lesson code within the same course |
| `429` when updating users | `PATCH /users` has a default limit of one request per 60 seconds |
| Lesson route returns `404` | Use `/lessions`, not `/lessons` |
| Cannot find lesson/account UUIDs in lists | Keep IDs from creation (lessons) and login `sub` (accounts) |

## Security and implementation limitations

- **Existing deployments need review:** audit old elevated accounts and any unauthorized profile changes. New signup restrictions do not retroactively clean existing data. Existing tokens are not globally revoked just by upgrading.
- **Public catalog metadata:** course reports and instructor-course listings (including instructor names) remain public by design. Review this against your privacy requirements.
- **No logout/refresh flow:** account changes revoke sessions, but there is no explicit logout endpoint or refresh-token lifecycle.
- **No production/test data source:** environment support and compiled startup need attention before production use or reliable e2e tests.
- **Limited input hardening:** DTOs have no password-strength policy, some strings have no maximum length, and report pagination accepts insufficiently bounded numbers.
- **Limited abuse/error protection:** throttling only covers one route; login/signup are not throttled by this configuration. SQL error responses include database details.
- **Remaining test scope:** authorization and revocation have regression coverage, but course duplicate detection, cascade deletion, production startup, concurrency outside first-admin bootstrap, and broader input hardening still need dedicated checks.

## Project structure

```text
datasource.ts                  TypeORM connection and migration configuration
scripts/bootstrap-admin.ts     Local-only first-admin promotion
migrations/                    Versioned MySQL schema changes
src/
  main.ts                      Bootstrap, global validation, HTTP port
  app.module.ts                Module wiring, JWT/config/throttling, middleware
  auth/                        Signup/login, email/password changes, deletion
    strategies/                Passport local and JWT strategies
    jwtTokenList/              Issued-token persistence and blocklisting
  decorators/                  @Roles metadata
  guards/                      Passport authentication and role checks
  middlewares/                 Optional bearer-token verification
  users/                       User queries, profile updates, role assignment
  courses/                     Courses, reporting, assignment coordination
  instructors/                 User-to-course instructor assignments
  lessions/                    Lesson CRUD (existing project spelling)
  enrollments/                 Enrollment creation, reports, self/admin removal
  exceptionFilters/            SQL failure → HTTP 400 translation
test/                          Starter e2e plus database-backed security tests
```

## License

`package.json` currently declares this project `UNLICENSED`. No project license file is included; the NestJS framework's license is not a license grant for this application.

# Online Learning Enrollment API

A NestJS REST API for managing users, courses, instructor assignments, lessons, and course enrollments. Built with TypeScript, Express, TypeORM, and MySQL, with Passport authentication, Argon2 password hashing, and database-backed JWT tracking.

This repository contains the backend only: there is no frontend, Swagger UI, seed script, or Docker configuration.

> **Development project — review security before deployment.** This README documents the code as implemented, not an idealized permission model. Public signup currently allows users to choose `admin`, several data endpoints are public, and profile updates have an authorization defect. See [Security and implementation limitations](#security-and-implementation-limitations).

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

> Setup instructions are derived from the checked-in configuration. They are not a claim that database-backed startup or end-to-end behavior has been verified in your environment. See the build/test caveats below.

## Accounts and authentication

### Create an account

Send `POST /auth/signup` with these required JSON fields:

```json
{
  "name": "Demo Student",
  "role": "student",
  "email": "student@example.com",
  "password": "<choose a local password>"
}
```

Valid role strings are exactly `student`, `instructor`, and `admin`. Email must be valid and unique. Passwords are hashed with Argon2; there is no DTO-enforced minimum password length.

Signup returns selected account fields, **not an access token or the account UUID**. Log in next to obtain the UUID in `sub`.

**Creating the first admin:** there is no seed/bootstrap command. In the current implementation, public signup accepts `"role": "admin"` directly. This works for isolated local evaluation but is a privilege-escalation risk on any publicly reachable deployment. The same endpoint can create instructor accounts. For an existing account, an authenticated admin can use `POST /users/assign_role`.

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
6. Some services additionally check the caller's identity or course assignment. Being an admin is **not** a universal ownership-check bypass.

The JWT strategy sets `ignoreExpiration: true`, but middleware normally checks expiration first. This inconsistent configuration should be corrected rather than relied on.

Password changes require the caller's old password, update the caller's account, block the token used for that request, and return a new login response. They do **not** revoke all other sessions. There is no logout or refresh-token endpoint.

## Roles and permissions

This matrix describes the **current controller and service checks**. “Assigned” means the user has an `instructors` row for the relevant course, not just the `instructor` role.

| Action | Anonymous | Student | Instructor | Admin |
| --- | --- | --- | --- | --- |
| Browse/search courses and course statistics | Yes | Yes | Yes | Yes |
| Read lessons, enrollments, users by role, or another instructor's course list | Yes | Yes | Yes | Yes |
| View own token identity, profile, and enrolled courses | No | Yes | Yes | Yes |
| Change own password | No | Yes | Yes | Yes |
| Change email via `/auth/update/email` | No | Own only | Own only | Own or another user's |
| Update name/email via `PATCH /users` | No | Any account currently* | Any account currently* | Any account currently* |
| Delete an account | No | Own only | Own only | Own or another user's |
| Create a course and provide initial instructor assignments | No | No | Yes, not restricted to self | Yes |
| Rename a course | No | No | Assigned courses only | Assigned courses only |
| Add/remove instructors on an existing course | No | No | No | Yes |
| Delete a course | No | No | No | Yes |
| Create a lesson | No | No | Any existing course | Any existing course |
| Update a lesson | No | No | Assigned parent course only | Assigned parent course only |
| Delete a lesson | No | No | No | Yes |
| Enroll/unenroll | No | Self only | Self only | Self or another user |
| Assign a role or use `GET /users/all` | No | No | No | Yes |

*`PATCH /users` has a broken ownership check: it looks up the target by `oldEmail`, then compares `oldEmail` to that same target's email, without comparing the caller's identity. Do not interpret this as intended cross-account access.

Additional rules:

- Creating a course requires at least one instructor UUID. Each assigned account must exist and must not currently be a student. Admin accounts can be assigned as instructors.
- Course creation and instructor assignment are transactional. The creator is not automatically assigned; include their UUID if they should be able to edit the course.
- For non-admin enrollment creation, a supplied `userId` is ignored and the caller is enrolled instead.
- Instructors and admins can themselves enroll as learners.
- Public lesson reads do not require enrollment. There is no enrollment-based content access control.
- Role changes take effect for guarded requests through database lookup, but do not automatically remove existing course assignments or revoke tokens.

## API reference

All paths are relative to the base URL. Request bodies are JSON (`Content-Type: application/json`). IDs are UUIDs; examples below use placeholders that must be replaced.

### Public routes

| Method | Path | Input / result |
| --- | --- | --- |
| GET | `/` | Returns `Hello World!` |
| POST | `/auth/signup` | Body: `name`, `role`, `email`, `password` |
| POST | `/auth/login` | Body: `email`, `password`; returns token and identity |
| GET | `/users?role=student` | Lists serialized users matching a role; use `instructor` or `admin` as needed |
| GET | `/courses?term=Nest` | Searches course titles with SQL `LIKE`; omitted term lists matching nonempty titles |
| GET | `/courses/stat` | Optional `courseId`, `page` (default `1`), `limit` (`10`), `sort` (`1`), `order` (`ASC`/`DESC`); sorts by enrollment count when enabled |
| GET | `/courses/student_count?id=<courseId>` | Enrollment count per course; omit `id` for all courses; includes enrolled users of any role |
| GET | `/courses/lession_count?id=<courseId>` | Lesson count per course; omit `id` for all |
| GET | `/lessions?courseId=<courseId>` | Lessons grouped by course title; omit `courseId` for all |
| GET | `/enrollments` | All enrollments, including learner names/emails |
| GET | `/enrollments/<userId>` | Enrollment records for one user, including name/email |
| GET | `/instructors/<userId>/courses` | Assigned course titles for a user |

### Authenticated account routes

| Method | Path | JSON body / behavior |
| --- | --- | --- |
| GET | `/auth/me` | Token-derived identity; not a fresh profile lookup |
| GET | `/users/profile` | Own name, assigned course titles, enrolled course titles |
| GET | `/users/enrolled_courses` | Own enrollment course titles/dates |
| PATCH | `/users` | Required `oldEmail`; optional `name`, `email`; throttled; **ownership defect noted above** |
| POST | `/auth/update_password` | `email`, `oldPassword`, `newPassword`; updates caller only, including for admins |
| PATCH | `/auth/update/email` | `oldEmail`, `newEmail`; only admins may target a different account |
| DELETE | `/auth/delete` | Deletes self; admin may add `?userId=<targetId>` |
| POST | `/users/assign_role` | Admin only; `email`, `role` |
| GET | `/users/all` | Admin only; serialized account list |

For password changes, non-admins must supply their own email; admins still update only their own password and must provide their own old password.

### Course, instructor, lesson, and enrollment writes

| Method | Path | JSON body | Access |
| --- | --- | --- | --- |
| POST | `/courses` | `{"title":"NestJS Basics","instructors":["<instructorId>"]}` | Instructor/admin |
| PATCH | `/courses` | `{"id":"<courseId>","newTitle":"NestJS Essentials"}` | Instructor/admin assigned to this course |
| DELETE | `/courses/<courseId>` | None | Admin |
| POST | `/courses/<courseId>/assign_instructors` | `{"instructorIds":["<userId>"]}` | Admin |
| DELETE | `/courses/<courseId>/remove_instructors` | `{"instructorIds":["<userId>"]}` | Admin; body is required even on DELETE |
| GET | `/instructors/myCourses` | None | Instructor/admin; lists own assignments |
| POST | `/lessions` | `{"name":"Introduction","code":"INTRO","desc":"Getting started","courseId":"<courseId>"}` | Instructor/admin; no assignment check |
| PATCH | `/lessions` | `{"id":"<lessionId>","name":"Updated name","code":"INTRO2","desc":"Updated description"}` | Instructor/admin assigned to parent course |
| DELETE | `/lessions/<lessionId>` | None | Admin |
| POST | `/enrollments` | `{"courseId":"<courseId>"}`; admin may also supply `userId` | Any authenticated role |
| DELETE | `/enrollments/<courseId>` | None; admin may add `?userId=<targetId>` | Self, or admin acting for another user |

Lesson creation requires nonempty `name`, `code`, and `desc`; `code` is at most 10 characters. Lesson updates require `id`; the other fields are optional. `desc` is stored as `description`. Prefer sending all three editable fields when updating until partial-update behavior has dedicated tests.

### Response and error notes

- The user/auth serializer excludes password hashes and account `id`; login exposes the user UUID as `sub`. User lists therefore cannot currently be used to discover account UUIDs.
- Save course/lesson UUIDs from their creation responses. `GET /lessions` deliberately removes lesson IDs, and there is no separate lesson-detail endpoint.
- `GET /lessions` groups by **title**, so different courses with the same title share an output group.
- Enrollment creation is serialized to `id`, `enrolledOn`, selected user fields, and course `id`/`title`. Enrollment reads return raw report rows with display labels.
- SQL failures are converted to HTTP `400` with `msg`, `sql_err_code`, and `sql_err`. Duplicate emails, enrollment pairs, instructor pairs, and lesson code/course pairs can trigger uniqueness errors.
- Guard role rejection normally produces `403`; service-level ownership failures often use `400`. Missing resources commonly produce `404`; missing authentication normally produces `401`. Do not assume every access denial has the same status.

## Example workflow

Use a local API client such as Postman, Insomnia, or curl. Store tokens/passwords privately; do not commit request collections containing them.

1. **Create test accounts:** call `/auth/signup` for one admin, one instructor, and one student, using different emails. Direct role selection is for isolated evaluation only.
2. **Log in each account:** save each `accessToken` privately and each `sub` UUID. Signup/user lists do not expose UUIDs.
3. **Create a course as the instructor:** `POST /courses` with the instructor's `sub` in `instructors`. Save the returned course `id`.
4. **Add a lesson as the instructor:** `POST /lessions` with that course ID. Save the returned lesson `id`.
5. **Browse as an anonymous visitor:** call `/courses`, `/courses/stat`, and `/lessions?courseId=<courseId>` without an Authorization header.
6. **Enroll as the student:** `POST /enrollments` with `courseId`, then inspect `/users/enrolled_courses` with the student's token.
7. **Try access boundaries:** a student cannot create courses; an unassigned instructor cannot rename this course or edit its lessons. An unassigned admin also cannot rename it or edit its lessons.
8. **Manage as admin:** use `/users/assign_role`, the instructor-assignment routes, or enrollment `userId` targeting. Assign the admin to a course first if they need to rename it or edit its lessons.
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
| `npm run lint` | Runs ESLint with `--fix`; checked-in rules are commented out |
| `npm run format` | Formats source and test TypeScript files |
| `npm run typeorm -- migration:show -d datasource.ts` | Inspect migration status |
| `npm run typeorm -- migration:run -d datasource.ts` | Apply pending migrations |

There are only starter root-controller unit/e2e tests, not an RBAC or enrollment test suite. Test scripts set `NODE_ENV=test`, but `datasource.ts` has no test configuration branch. An `.env.test` file alone does not solve that; configure a separate test data source first.

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
| Admin cannot rename course/edit lesson | Assign that admin to the parent course first; both service methods require assignment |
| Cannot assign a student as instructor | Change the account's role to instructor/admin first |
| Duplicate enrollment/instructor/lesson | Check the unique pairs listed in the data model; choose a new lesson code within the same course |
| `429` when updating users | `PATCH /users` has a default limit of one request per 60 seconds |
| Lesson route returns `404` | Use `/lessions`, not `/lessons` |
| Cannot find lesson/account UUIDs in lists | Keep IDs from creation (lessons) and login `sub` (accounts) |

## Security and implementation limitations

These are source-level findings, not a claim that every issue has been reproduced against a running server. This documentation change does not fix application behavior.

- **Public privilege selection:** `/auth/signup` accepts `admin` and `instructor`. Restrict public registration to students and implement a controlled first-admin bootstrap before exposing the API.
- **Broken profile-update ownership:** `UsersService.updateUser()` never verifies that `req.currUser.sub` owns the target account. Any authenticated role can currently target another user's name/email with `oldEmail`. Fix this before deployment.
- **Public personal data:** enrollment reads expose names/emails without authentication. Users-by-role and instructor/course listings are also public. Add explicit privacy requirements and guards.
- **Uneven course ownership rules:** course/lesson updates require assignments even for admins, but lesson creation has no assignment check, and course creators may initially assign any eligible users. Decide the intended policy and enforce it consistently.
- **Token configuration inconsistencies:** middleware verifies expiry, the Passport JWT strategy ignores it, and that strategy has a fallback secret. Require one explicit secret and consistent expiration enforcement.
- **Incomplete session revocation:** password changes revoke only the token used for that request. Role/email changes do not revoke tokens; token identity fields can be stale even though guarded role checks use the database. There is no logout/refresh flow.
- **No production/test data source:** environment support and compiled startup need attention before production use or reliable e2e tests.
- **Limited input hardening:** DTOs have no password-strength policy, some strings have no maximum length, and report pagination accepts insufficiently bounded numbers. Instructor assignment DTOs lack an explicit array validator.
- **Limited abuse/error protection:** throttling only covers one route; login/signup are not throttled by this configuration. SQL error responses include database details.
- **Limited verification:** starter tests do not cover authorization, ownership, migrations, token revocation, or cascading deletes. Course duplicate detection and lesson partial updates also need regression coverage.

## Project structure

```text
datasource.ts                  TypeORM connection and migration configuration
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
test/                          Starter e2e test and Jest configuration
```

## License

`package.json` currently declares this project `UNLICENSED`. No project license file is included; the NestJS framework's license is not a license grant for this application.

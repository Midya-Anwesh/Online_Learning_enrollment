# Change guide: README, authorization, and regression tests

This guide records what was changed or added while documenting and securing this project. It explains the differences from the original implementation, the affected files, client-visible changes, and verification results.

Related changes:

- [PR #1 — project README](https://github.com/Midya-Anwesh/Online_Learning_enrollment/pull/1): replaced the generic NestJS starter README with project-specific documentation.
- [PR #2 — authorization fixes](https://github.com/Midya-Anwesh/Online_Learning_enrollment/pull/2): corrected authorization behavior, added tests and a first-admin command, and updated the README.

Both PRs were merged before this guide was written. Merging code does not prove that a running deployment has been updated.

For the current setup instructions and complete API reference, see the [README](../README.md).

## 1. README replacement

The original README described the NestJS starter template, rather than this application's behavior. It was replaced with:

- The backend's architecture, modules, entities, relationships, and uniqueness rules.
- Node.js/MySQL prerequisites, exact environment-variable names, migrations, and startup steps.
- Signup/login instructions, token response fields, and bearer-token usage.
- A role-permission matrix and an explanation of guards versus service-level ownership checks.
- All 32 existing HTTP routes, their inputs, and their access requirements.
- A walkthrough for account creation, instructor promotion, course/lesson creation, enrollment, and administration.
- Troubleshooting, test commands, production/test configuration caveats, and remaining security work.
- The application's actual `UNLICENSED` status instead of the starter README's framework-license wording.

Initially the README documented the original access-control defects explicitly. After PR #2, it was updated to describe the corrected behavior. Existing route spellings such as `/lessions` were preserved.

## 2. Authorization: before and after

| Area | Before PR #2 | After PR #2 |
| --- | --- | --- |
| Public signup | Required a role and accepted `student`, `instructor`, or `admin` | Role is optional; only `student` is accepted, and the service always stores `student` |
| First administrator | Could be created through public signup | Must be promoted by a local database-backed bootstrap command when no admin exists |
| Profile name/email updates | Ownership check compared the target email to itself, allowing another account to be targeted | Caller must own the target account or currently be an admin |
| Users-by-role directory | Public | Admin only |
| All-enrollment report | Public, including learner names/emails | Admin only |
| One user's enrollment report | Public | That user or an admin only |
| Instructor course creation | Could provide other eligible users as initial instructors | Must initially assign exactly themselves; admins may provide any eligible instructors |
| Course title updates | Both admins and instructors needed course assignment | Assigned instructors or any admin |
| Lesson creation | Any instructor/admin could create a lesson in any course | Assigned instructors or any admin |
| Lesson updates | Both admins and instructors needed parent-course assignment | Assigned instructors or any admin |
| Lesson reads | Public and not enrollment-restricted | Authenticated users see enrolled courses; instructors also see assigned courses; admins see all |
| Demoted instructor's old assignments | No dedicated lesson-read protection based on current role | Old assignment rows alone cannot grant lesson access to a demoted student |
| Passport JWT expiry | JWT strategy ignored expiration | JWT strategy enforces expiration, matching middleware verification |
| JWT secret | Strategy had a fallback secret | Explicit configuration is required; fallback removed |
| Password change | Blocked only the token used for the request | Blocks all prior sessions and returns a fresh login token |
| Email or role change | Existing sessions remained valid | All target-user sessions are blocked; user must log in again |

### Deliberately unchanged access rules

- Course discovery, course statistics/counts, and instructor-course listings remain public. Instructor-course listings include instructor names and course titles, not an enrollment report.
- Students cannot create courses or modify lesson content.
- Only admins can delete courses/lessons or add/remove instructors on an existing course.
- All three roles may enroll or unenroll themselves; only admins may do so for another user.
- All three roles may change their own password; even admins still change only their own password through the existing password-change endpoint.
- Account deletion remains self-or-admin.
- The existing `jwtAuthGuard` still reloads the database user and checks their current role. The `@Roles` decorator and guard implementation were not replaced.

## 3. How the fixes work

### Registration and first-admin setup

`CreateUserDto` rejects privileged signup roles. `UsersService.createUser()` also sets `role: 'student'` explicitly, so bypassing controller validation does not allow a caller-supplied elevated role to be stored.

A new local command promotes a registered account:

```bash
npm run bootstrap:admin -- admin@example.com
```

The command:

1. Connects using the development TypeORM configuration.
2. Acquires a MySQL advisory lock to serialize simultaneous bootstrap attempts.
3. Refuses to proceed if an administrator already exists or the requested account does not exist.
4. Promotes the account and blocks its existing sessions in a transaction.
5. Releases database resources; command failures do not print raw driver/credential details.

This is **not** an HTTP endpoint. Once an admin exists, further promotions use authenticated `POST /users/assign_role`. The promoted user must log in again.

### Profile ownership and session invalidation

Profile updates now compare the caller's database identity with the target user's ID, allowing cross-account edits only for admins. Only `name` and `email` are copied into the entity; the lookup field `oldEmail` is not persisted.

Profile email updates and role changes save the account change and block the target's tokens in a database transaction. Name-only profile updates do not invalidate sessions.

The existing auth email/password flows now also block all affected user's prior sessions. Password changes return a newly issued token. Email changes require another login.

### Enrollment privacy

The report routes now have JWT/role guards:

- `GET /enrollments`: admin only.
- `GET /enrollments/:userId`: authenticated; service additionally enforces self-or-admin.
- `GET /users?role=...`: admin only.

The enrollment service checks the caller's current database role before running the report query. It no longer treats possession of a target user ID as permission to read that user's enrollments.

### Course and lesson ownership

Course creation now receives the caller identity. An instructor cannot create a course that initially assigns other people; admins retain assignment control.

Course title and lesson write services reload the caller's database role and enforce assignment for instructors, while allowing an admin override. Lesson creation now performs the assignment check it previously lacked.

Lesson reads use database query joins to include only courses where the caller is enrolled or is a currently authorized instructor with an assignment. Admin reads are unrestricted. An explicit `courseId` filter is combined with, rather than replacing, the visibility condition.

An inaccessible lesson query returns `{}`. Removing an enrollment removes enrollment-based lesson visibility on the next read. A course assignment does not give a user with the current `student` role instructor privileges.

## 4. Supporting corrections

| Change | Reason |
| --- | --- |
| Bulk token revocation uses `userId = :userId` | Corrects the token-table update predicate; all-session revocation now targets the actual foreign-key column |
| Lesson PATCH applies only provided editable fields | Preserves omitted fields and maps request `desc` to stored `description`, without copying request-only properties |
| Instructor arrays require an array, at least one item, and unique items | Rejects malformed/duplicate assignment input; course creation also rejects duplicate instructor IDs |
| Entity discovery is limited to `src/**/*.entity.{ts,js}` relative to the data source | Avoids loading both source and compiled entity copies when `dist` exists |
| Jest maps `src/...` imports | Allows the added unit/HTTP regression suites to resolve the application's existing absolute imports |
| Two locked transitive packages were updated | The package firewall blocked the old versions; `proxy-addr` moved from `2.0.7` to `2.0.8`, and `handlebars` from `4.7.8` to `4.7.10` |

No direct dependency versions were changed. No entities or database migration files were changed, and no new schema migration is required by PR #2.

## 5. File-by-file inventory for PR #2

PR #2 changed **19 existing files** and added **10 files**.

### Existing files changed

| File | What changed |
| --- | --- |
| [`README.md`](../README.md) | Updated setup, bootstrap, role matrix, API access, test instructions, and remaining limitations |
| [`datasource.ts`](../datasource.ts) | Narrowed entity discovery to the application's `src` tree |
| [`package.json`](../package.json) | Added bootstrap/integration commands and Jest import mapping |
| [`package-lock.json`](../package-lock.json) | Updated the two blocked transitive package versions |
| [`src/app.module.ts`](../src/app.module.ts) | Requires explicitly configured JWT secret |
| [`src/auth/auth.service.ts`](../src/auth/auth.service.ts) | Revokes all affected sessions after password/email changes |
| [`src/auth/jwtTokenList/jwtTokenService.ts`](../src/auth/jwtTokenList/jwtTokenService.ts) | Fixed the bulk token-blocking predicate |
| [`src/auth/strategies/jwt.strategy.ts`](../src/auth/strategies/jwt.strategy.ts) | Enforces expiry and removes fallback signing secret |
| [`src/users/dtos/create-user.dto.ts`](../src/users/dtos/create-user.dto.ts) | Allows only optional `student` signup role |
| [`src/users/users.controller.ts`](../src/users/users.controller.ts) | Makes users-by-role listing admin-only |
| [`src/users/users.service.ts`](../src/users/users.service.ts) | Forces student signup, fixes ownership, limits persisted fields, and revokes sessions on email/role changes |
| [`src/enrollments/enrollments.controller.ts`](../src/enrollments/enrollments.controller.ts) | Guards reports and passes caller identity to the service |
| [`src/enrollments/enrollments.service.ts`](../src/enrollments/enrollments.service.ts) | Enforces self/admin enrollment-report access |
| [`src/courses/courses.controller.ts`](../src/courses/courses.controller.ts) | Passes caller identity into course creation |
| [`src/courses/courses.service.ts`](../src/courses/courses.service.ts) | Restricts initial instructor assignments and adds admin override for course title updates |
| [`src/courses/dtos/create-course.dto.ts`](../src/courses/dtos/create-course.dto.ts) | Rejects duplicate initial instructor IDs |
| [`src/instructors/dtos/assignOrRemove.instructors.dto.ts`](../src/instructors/dtos/assignOrRemove.instructors.dto.ts) | Validates nonempty, unique instructor arrays |
| [`src/lessions/lessions.controller.ts`](../src/lessions/lessions.controller.ts) | Guards lesson reads and passes caller identity to read/create operations |
| [`src/lessions/lessions.service.ts`](../src/lessions/lessions.service.ts) | Enforces lesson visibility/ownership, supports admin override, and preserves partial-update fields |

### New files

| File | Purpose |
| --- | --- |
| [`scripts/bootstrap-admin.ts`](../scripts/bootstrap-admin.ts) | Local-only, first-admin promotion command |
| [`src/bootstrap-admin.spec.ts`](../src/bootstrap-admin.spec.ts) | Bootstrap success/refusal/resource-cleanup tests |
| [`src/users/users.authorization.spec.ts`](../src/users/users.authorization.spec.ts) | Signup validation, ownership, and role/email revocation tests |
| [`src/courses/courses.authorization.spec.ts`](../src/courses/courses.authorization.spec.ts) | Course creation/assignment and title-update authorization tests |
| [`src/lessions/lessions.authorization.spec.ts`](../src/lessions/lessions.authorization.spec.ts) | Lesson management, visibility-filter construction, and partial-update tests |
| [`src/enrollments/enrollments.authorization.spec.ts`](../src/enrollments/enrollments.authorization.spec.ts) | Enrollment report self/admin privacy tests |
| [`src/auth/auth.sessions.spec.ts`](../src/auth/auth.sessions.spec.ts) | Password/email session revocation and token-update predicate tests |
| [`src/security.authorization.spec.ts`](../src/security.authorization.spec.ts) | Real HTTP controller/validation/Passport/guard tests with persistence doubles |
| [`test/authorization.e2e-spec.ts`](../test/authorization.e2e-spec.ts) | Full-app database-backed authorization lifecycle tests |
| [`test/jest-security-e2e.json`](../test/jest-security-e2e.json) | Dedicated database-backed suite configuration |

## 6. Tests and evidence

These results were recorded while implementing PR #2, before it was merged:

| Check | Result | Scope |
| --- | --- | --- |
| `npm run build` | Passed | TypeScript/Nest compilation |
| `npm test -- --runInBand` | 70 tests passed across 8 suites | Includes the existing starter test plus new unit/HTTP regression tests; no database needed |
| All 8 existing migrations | Applied successfully | Fresh, disposable MariaDB databases |
| `npm run test:security:integration` | 12 tests passed | Full Nest app, real JWT authentication, TypeORM queries, and database persistence |
| Bootstrap command refusal | Verified | Invalid argument and existing-admin failure paths; nonzero exit status |

The 12 database-backed scenarios cover:

- Rejection of privileged public signup and student-only account creation.
- First-admin promotion and invalidation of its previous student session.
- Admin-only role changes and invalidation of the target's old sessions.
- Rejection of cross-account profile writes, with the target unchanged.
- Course creation restrictions and instructor self-assignment.
- Course ownership checks and admin override.
- Lesson creation/update ownership, admin override, and preservation of omitted fields.
- Public catalog access versus filtered lesson visibility.
- Protection of user/enrollment reports, with allowed self reads.
- Loss of lesson visibility after unenrollment.
- Loss of instructor access after demotion, even with old assignment rows.
- Revocation of multiple old sessions after email/password changes, with the fresh password-change token still usable.

**Verification boundaries:** MariaDB was used as a MySQL-compatible test server. No production database was accessed. No production deployment or GitHub Actions workflow was created by these PRs. The original starter `test:e2e` command still needs environment configuration work; use the dedicated security integration command for the new database-backed tests.

To repeat the checks, follow the [README development commands](../README.md#development-commands). The integration suite requires a fresh, migrated, disposable database whose name starts with `online_learning_test_`. It refuses other prefixes and nonempty user tables, does not truncate tables, and leaves synthetic records behind; use a new database for each run.

## 7. Client-visible changes and rollout checklist

Existing clients must account for the following:

1. **Signup:** omit `role` or send `student`. Create privileged accounts through bootstrap/admin promotion, not public registration.
2. **Protected reads:** send a bearer token for lesson and enrollment reads. User directories and all-enrollment reports require admin privileges.
3. **Instructor actions:** create self-assigned courses and obtain assignment before creating/updating lessons or renaming a course.
4. **Lesson visibility:** expect `{}` when no accessible lessons match. Enrollment or instructor assignment is required unless the caller is an admin.
5. **Account changes:** require a new login after email/role changes. Password changes return a replacement token and invalidate all prior sessions.
6. **Deployment review:** audit pre-existing admins/instructors and investigate prior unauthorized profile changes before exposing the updated API.
7. **Session review:** upgrading does not globally revoke every pre-existing token. Review outstanding sessions as part of rollout; no automatic cleanup or production mutation was performed.
8. **Database:** no new migration is required for these fixes; existing installations must still have all original migrations applied.

New ownership/report checks use `403`. Existing auth/enrollment write paths still use some `400` ownership errors, and blocked/missing token records may produce `400`/`404`; clients should not assume every authorization failure has one status code.

## 8. Not changed or not yet solved

These PRs do **not** claim complete production security:

- Production entry-point/import resolution and environment-specific database configuration still need attention.
- The old starter end-to-end script still lacks a working `NODE_ENV=test` data-source configuration.
- Password-strength requirements, broader length/pagination validation, and login/signup throttling remain follow-ups.
- SQL errors still expose database details and need safer response handling.
- There is still no logout endpoint or refresh-token flow.
- Course duplicate-detection behavior, cascade deletion, and concurrency beyond first-admin bootstrap need more dedicated tests.
- Existing data was not cleaned, old elevated accounts were not removed, and deployments were not changed.
- Route spelling, entity relationships, existing schema migrations, and direct dependency versions were not renamed or redesigned.

This guide itself adds documentation only; it does not change application behavior.

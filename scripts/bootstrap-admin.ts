import { db_config } from '../datasource';
import { Users } from '../src/users/users.entity';
import { JwtTokenList } from '../src/auth/jwtTokenList/jwtTokenList.entity';

// Local operator command, never an HTTP endpoint. Register a student first.
export async function bootstrapAdmin(
  source: typeof db_config,
  email: string,
): Promise<void> {
  await source.initialize();
  const runner = source.createQueryRunner();
  let locked = false;
  try {
    await runner.connect();
    // Serialize simultaneous bootstrap commands on this MySQL database.
    const rows = await runner.query(
      "SELECT GET_LOCK(CONCAT(DATABASE(), ':first-admin'), 10) AS acquired",
    );
    locked = Number(rows[0]?.acquired) === 1;
    if (!locked) throw new Error('Could not acquire the bootstrap lock');
    await runner.startTransaction();
    const users = runner.manager.getRepository(Users);
    if (await users.exists({ where: { role: 'admin' } })) {
      throw new Error('An admin already exists; use authenticated role assignment');
    }
    const user = await users.findOneBy({ email });
    if (!user) throw new Error('Register this account through signup first');
    user.role = 'admin';
    await users.save(user);
    await runner.manager.update(
      JwtTokenList, { user: { id: user.id } }, { blockListed: true },
    );
    await runner.commitTransaction();
  } catch (error) {
    if (runner.isTransactionActive) await runner.rollbackTransaction();
    throw error;
  } finally {
    if (locked) {
      await runner.query("SELECT RELEASE_LOCK(CONCAT(DATABASE(), ':first-admin'))");
    }
    await runner.release();
    await source.destroy();
  }
}

if (require.main === module) {
  const email = process.argv[2];
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error('Usage: npm run bootstrap:admin -- registered-email@example.com');
    process.exitCode = 1;
  } else {
    bootstrapAdmin(db_config, email)
      .then(() => console.log('First admin created. Log in again to continue.'))
      .catch(() => {
        // Do not expose driver errors, connection details, or credentials.
        console.error('Bootstrap failed. Check the account, existing admins, migrations, and database configuration.');
        process.exitCode = 1;
      });
  }
}

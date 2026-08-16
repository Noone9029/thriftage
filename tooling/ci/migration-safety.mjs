import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const migrationsRoot = join('packages', 'db', 'prisma', 'migrations');
const migrationNames = readdirSync(migrationsRoot)
  .filter((name) => statSync(join(migrationsRoot, name)).isDirectory())
  .sort();

if (migrationNames.length === 0) throw new Error('No Prisma migrations were found.');

const destructivePattern = /\b(?:DROP\s+(?:TABLE|COLUMN|TYPE)|TRUNCATE|DELETE\s+FROM)\b/i;
const findings = [];
for (const name of migrationNames) {
  if (!/^\d{14}_[a-z0-9_]+$/.test(name)) {
    findings.push(`${name}: migration directory must use YYYYMMDDHHMMSS_snake_case.`);
  }
  const migrationPath = join(migrationsRoot, name, 'migration.sql');
  let sql;
  try {
    sql = readFileSync(migrationPath, 'utf8');
  } catch {
    findings.push(`${name}: migration.sql is missing or unreadable.`);
    continue;
  }
  for (const [index, line] of sql.split(/\r?\n/).entries()) {
    if (destructivePattern.test(line) && !/migration-safety:\s*approved/i.test(line)) {
      findings.push(
        `${migrationPath.replaceAll('\\', '/')}:${index + 1} destructive SQL requires an inline migration-safety approval and recovery plan.`,
      );
    }
  }
}

if (findings.length > 0) {
  console.error('Migration safety check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exitCode = 1;
} else {
  console.log(`Migration safety check passed (${migrationNames.length} migrations inspected).`);
}

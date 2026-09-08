import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(appRoot, '..');
const binDir = 'C:\\Program Files\\PostgreSQL\\18\\bin';
const dataDir = path.join(appRoot, '.pgdata');
const envPath = path.join(repoRoot, 'backend', '.env');

function databaseUrlFromEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return process.env.DATABASE_URL || '';
  const match = fs.readFileSync(filePath, 'utf8').match(/^DATABASE_URL=(.+)$/m);
  return (match ? match[1].trim() : '') || process.env.DATABASE_URL || '';
}

function isLoopbackDatabaseUrl(url) {
  try {
    const host = new URL(String(url).replace(/^postgresql:/i, 'https:')).hostname;
    return !host || host === 'localhost' || host === '127.0.0.1' || host === '::1';
  } catch {
    return true;
  }
}

function devPostgresConfig() {
  const configuredUrl = databaseUrlFromEnvFile(envPath) || process.env.DATABASE_URL || '';
  if (configuredUrl) {
    try {
      const parsed = new URL(String(configuredUrl).replace(/^postgresql:/i, 'https:'));
      const password = decodeURIComponent(parsed.password || '');
      if (!password) {
        throw new Error('DATABASE_URL is missing a password for the local Postgres bootstrap.');
      }
      return {
        user: decodeURIComponent(parsed.username || process.env.DEV_POSTGRES_USER || 'connecthub_user'),
        password,
        port: parsed.port || process.env.DEV_POSTGRES_PORT || '5433',
        database: parsed.pathname.replace(/^\//, '') || process.env.DEV_POSTGRES_DB || 'connecthub',
      };
    } catch (error) {
      if (error.message.includes('missing a password')) throw error;
    }
  }

  const password = process.env.DEV_POSTGRES_PASSWORD || '';
  if (!password) {
    throw new Error(
      'Set DATABASE_URL in backend/.env or DEV_POSTGRES_PASSWORD before starting the local Postgres cluster.'
    );
  }

  return {
    user: process.env.DEV_POSTGRES_USER || 'connecthub_user',
    password,
    port: process.env.DEV_POSTGRES_PORT || '5433',
    database: process.env.DEV_POSTGRES_DB || 'connecthub',
  };
}

const configuredUrl = databaseUrlFromEnvFile(envPath);
if (configuredUrl && !isLoopbackDatabaseUrl(configuredUrl)) {
  console.log('DATABASE_URL points at a remote Postgres host. Skipping the local cluster on 5433.');
  process.exit(0);
}

const { user, password, port, database } = devPostgresConfig();

function bin(name) {
  return path.join(binDir, name);
}

function run(name, args, extra = {}) {
  const result = spawnSync(bin(name), args, {
    encoding: 'utf8',
    env: { ...process.env, PGPASSWORD: password, ...extra.env },
  });
  if (result.status !== 0) {
    const output = `${result.stdout || ''}\n${result.stderr || ''}`.trim();
    throw new Error(`${name} failed: ${output || `exit ${result.status}`}`);
  }
  return result;
}

function isReady() {
  const result = spawnSync(bin('pg_isready.exe'), ['-h', '127.0.0.1', '-p', port], { encoding: 'utf8' });
  return result.status === 0;
}

function psql(databaseName, sql) {
  return run('psql.exe', ['-h', '127.0.0.1', '-p', port, '-U', user, '-d', databaseName, '-v', 'ON_ERROR_STOP=1', '-tAc', sql]);
}

if (!fs.existsSync(bin('initdb.exe'))) {
  throw new Error('PostgreSQL 18 binaries not found under C:\\Program Files\\PostgreSQL\\18\\bin');
}

if (!fs.existsSync(path.join(dataDir, 'PG_VERSION'))) {
  fs.mkdirSync(dataDir, { recursive: true });
  const pwfile = path.join(os.tmpdir(), `connecthub-initdb-${process.pid}.txt`);
  fs.writeFileSync(pwfile, `${password}\n`, { encoding: 'utf8' });
  try {
    console.log(`Creating a private Postgres data directory for ConnectHub (port ${port})...`);
    run('initdb.exe', [
      '-D',
      dataDir,
      '-U',
      user,
      '--pwfile',
      pwfile,
      '--auth=scram-sha-256',
      '--encoding=UTF8',
      '--no-locale',
    ]);
  } finally {
    fs.rmSync(pwfile, { force: true });
  }
}

if (!isReady()) {
  console.log(`Starting ConnectHub Postgres on 127.0.0.1:${port}...`);
  const started = spawnSync(
    bin('pg_ctl.exe'),
    ['-D', dataDir, '-l', path.join(dataDir, 'postgres.log'), '-o', `-p ${port} -h 127.0.0.1`, '-w', 'start'],
    { encoding: 'utf8', timeout: 20000, env: { ...process.env, PGPASSWORD: password } }
  );
  if (started.status && started.status !== 0 && started.error?.code !== 'ETIMEDOUT') {
    throw new Error(`pg_ctl start failed: ${(started.stderr || started.stdout || '').trim()}`);
  }
  for (let i = 0; i < 20 && !isReady(); i += 1) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
  }
  if (!isReady()) throw new Error(`Postgres started but is not ready on port ${port}`);
}

const maintenanceDb = 'postgres';
const exists = psql(maintenanceDb, `SELECT 1 FROM pg_database WHERE datname = '${database}'`).stdout.trim();
if (exists !== '1') {
  psql(maintenanceDb, `CREATE DATABASE ${database} OWNER ${user}`);
}

if (fs.existsSync(envPath)) {
  const current = fs.readFileSync(envPath, 'utf8');
  const next = current.replace(
    /^(DATABASE_URL=postgresql:\/\/connecthub_user:[^@]+@)(?:localhost|127\.0\.0\.1):\d+(\/connecthub.*)$/m,
    `$1localhost:${port}$2`
  );
  if (next !== current) {
    fs.writeFileSync(envPath, next);
    console.log(`Updated server/.env DATABASE_URL to port ${port} (Windows service on 5432 stays untouched).`);
  }
}

console.log(`ConnectHub Postgres is ready on localhost:${port}`);

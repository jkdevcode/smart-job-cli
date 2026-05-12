import fs from 'node:fs';
import path from 'node:path';
import sqlite3 from 'sqlite3';

sqlite3.verbose();

const DEFAULT_DB_PATH = './data/jobs.db';

let dbInstance;

function resolveDbPath() {
  return path.resolve(process.cwd(), process.env.JOB_DB_PATH || DEFAULT_DB_PATH);
}

function ensureDbDirectory(dbPath) {
  const directory = path.dirname(dbPath);
  fs.mkdirSync(directory, { recursive: true });
}

export async function initDB() {
  if (dbInstance) {
    return dbInstance;
  }

  const dbPath = resolveDbPath();
  ensureDbDirectory(dbPath);

  dbInstance = await new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(db);
    });
  });

  await run(`
    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      company TEXT,
      link TEXT UNIQUE,
      location TEXT,
      modality TEXT DEFAULT 'unknown',
      language TEXT DEFAULT 'unknown',
      languageConfidence REAL DEFAULT 0,
      englishRequirement TEXT DEFAULT 'unknown',
      languageEvidence TEXT,
      score INTEGER DEFAULT 0,
      lastSeenAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      source TEXT DEFAULT 'linkedin',
      seniority TEXT DEFAULT 'unknown',
      redFlags TEXT DEFAULT '',
      status TEXT DEFAULT 'new',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const columns = await all('PRAGMA table_info(jobs)');

  if (!columns.some((column) => column.name === 'modality')) {
    await run("ALTER TABLE jobs ADD COLUMN modality TEXT DEFAULT 'unknown'");
  }

  if (!columns.some((column) => column.name === 'location')) {
    await run('ALTER TABLE jobs ADD COLUMN location TEXT');
  }

  if (!columns.some((column) => column.name === 'language')) {
    await run("ALTER TABLE jobs ADD COLUMN language TEXT DEFAULT 'unknown'");
  }

  if (!columns.some((column) => column.name === 'languageConfidence')) {
    await run('ALTER TABLE jobs ADD COLUMN languageConfidence REAL DEFAULT 0');
  }

  if (!columns.some((column) => column.name === 'englishRequirement')) {
    await run("ALTER TABLE jobs ADD COLUMN englishRequirement TEXT DEFAULT 'unknown'");
  }

  if (!columns.some((column) => column.name === 'languageEvidence')) {
    await run('ALTER TABLE jobs ADD COLUMN languageEvidence TEXT');
  }

  if (!columns.some((column) => column.name === 'score')) {
    await run('ALTER TABLE jobs ADD COLUMN score INTEGER DEFAULT 0');
  }

  if (!columns.some((column) => column.name === 'lastSeenAt')) {
    await run('ALTER TABLE jobs ADD COLUMN lastSeenAt DATETIME');
  }

  if (!columns.some((column) => column.name === 'source')) {
    await run("ALTER TABLE jobs ADD COLUMN source TEXT DEFAULT 'linkedin'");
  }

  if (!columns.some((column) => column.name === 'seniority')) {
    await run("ALTER TABLE jobs ADD COLUMN seniority TEXT DEFAULT 'unknown'");
  }

  if (!columns.some((column) => column.name === 'redFlags')) {
    await run("ALTER TABLE jobs ADD COLUMN redFlags TEXT DEFAULT ''");
  }

  await run(
    `
      UPDATE jobs
      SET score = COALESCE(score, 0),
          lastSeenAt = COALESCE(lastSeenAt, createdAt, CURRENT_TIMESTAMP),
          source = COALESCE(NULLIF(source, ''), 'linkedin'),
          seniority = COALESCE(NULLIF(seniority, ''), 'unknown'),
          redFlags = COALESCE(redFlags, '')
    `
  );

  return dbInstance;
}

export function getDbPath() {
  return resolveDbPath();
}

export function getDB() {
  if (!dbInstance) {
    throw new Error('La base de datos no ha sido inicializada. Ejecuta initDB() primero.');
  }

  return dbInstance;
}

export function run(sql, params = []) {
  const db = getDB();

  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) {
        reject(error);
        return;
      }

      resolve({
        lastID: this.lastID,
        changes: this.changes
      });
    });
  });
}

export function all(sql, params = []) {
  const db = getDB();

  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(rows);
    });
  });
}

export function get(sql, params = []) {
  const db = getDB();

  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(row ?? null);
    });
  });
}

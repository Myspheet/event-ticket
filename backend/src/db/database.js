const bcrypt = require("bcryptjs");
const path = require("path");
const fs = require("fs");

const DB_TYPE = (process.env.DB_TYPE || "sqlite").toLowerCase();

// Convert ? placeholders to $1, $2, ... for PostgreSQL
function convertPlaceholders(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

// ─── SQLite Adapter ──────────────────────────────────────────────
class SQLiteAdapter {
  constructor() {
    const Database = require("better-sqlite3");
    const DB_PATH = path.join(__dirname, "../../data/app.db");
    const DATA_DIR = path.join(__dirname, "../../data");
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    this.db = new Database(DB_PATH);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
  }

  async get(sql, params = []) {
    return this.db.prepare(sql).get(...params);
  }

  async all(sql, params = []) {
    return this.db.prepare(sql).all(...params);
  }

  async run(sql, params = []) {
    const result = this.db.prepare(sql).run(...params);
    return { lastId: result.lastInsertRowid, changes: result.changes };
  }

  async exec(sql) {
    return this.db.exec(sql);
  }

  async close() {
    this.db.close();
  }
}

// ─── PostgreSQL Adapter ──────────────────────────────────────────
class PostgresAdapter {
  constructor() {
    const { Pool } = require("pg");
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }

  async get(sql, params = []) {
    const pgSql = convertPlaceholders(sql);
    const result = await this.pool.query(pgSql, params);
    return result.rows[0] || undefined;
  }

  async all(sql, params = []) {
    const pgSql = convertPlaceholders(sql);
    const result = await this.pool.query(pgSql, params);
    return result.rows;
  }

  async run(sql, params = []) {
    let pgSql = convertPlaceholders(sql);
    const isInsert = sql.trim().toUpperCase().startsWith("INSERT");
    if (isInsert && !pgSql.toUpperCase().includes("RETURNING")) {
      pgSql += " RETURNING id";
    }
    const result = await this.pool.query(pgSql, params);
    return {
      lastId: isInsert && result.rows.length > 0 ? result.rows[0].id : null,
      changes: result.rowCount,
    };
  }

  async exec(sql) {
    await this.pool.query(sql);
  }

  async close() {
    await this.pool.end();
  }
}

// ─── Factory ─────────────────────────────────────────────────────
function createAdapter() {
  if (DB_TYPE === "postgres" || DB_TYPE === "postgresql") {
    console.log("[DB] Using PostgreSQL adapter");
    return new PostgresAdapter();
  }
  console.log("[DB] Using SQLite adapter");
  return new SQLiteAdapter();
}

const db = createAdapter();

// ─── Schema + Seed ───────────────────────────────────────────────
const isPg = () => DB_TYPE === "postgres" || DB_TYPE === "postgresql";

async function columnExists(table, column) {
  if (isPg()) {
    const row = await db.get(
      `SELECT 1 FROM information_schema.columns WHERE table_name = ? AND column_name = ?`,
      [table, column],
    );
    return !!row;
  }
  const rows = await db.all(`PRAGMA table_info(${table})`);
  return rows.some((r) => r.name === column);
}

async function addColumnIfMissing(table, column, definition) {
  if (await columnExists(table, column)) return;
  await db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  console.log(`[DB] Added column ${table}.${column}`);
}

async function initializeDatabase() {
  if (isPg()) {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin', 'manager')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.exec(`
      CREATE TABLE IF NOT EXISTS guests (
        id SERIAL PRIMARY KEY,
        unique_code TEXT UNIQUE NOT NULL,
        backup_code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        seat_number TEXT,
        type TEXT NOT NULL CHECK(type IN ('parent', 'child')),
        parent_id INTEGER REFERENCES guests(id) ON DELETE CASCADE,
        checked_in INTEGER DEFAULT 0,
        checked_in_at TIMESTAMP,
        checked_out_at TIMESTAMP,
        qr_code_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.exec(
      `CREATE INDEX IF NOT EXISTS idx_guests_unique_code ON guests(unique_code)`,
    );
    await db.exec(
      `CREATE INDEX IF NOT EXISTS idx_guests_parent_id ON guests(parent_id)`,
    );

    // Audit table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS guest_events (
        id SERIAL PRIMARY KEY,
        guest_id INTEGER NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
        action TEXT NOT NULL,
        from_status TEXT,
        to_status TEXT,
        performed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        performed_by_username TEXT,
        ip TEXT,
        user_agent TEXT,
        reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.exec(
      `CREATE INDEX IF NOT EXISTS idx_guest_events_guest_id ON guest_events(guest_id)`,
    );
    await db.exec(
      `CREATE INDEX IF NOT EXISTS idx_guest_events_created_at ON guest_events(created_at)`,
    );
  } else {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin', 'manager')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS guests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        unique_code TEXT UNIQUE NOT NULL,
        backup_code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        seat_number TEXT,
        type TEXT NOT NULL CHECK(type IN ('parent', 'child')),
        parent_id INTEGER REFERENCES guests(id) ON DELETE CASCADE,
        checked_in INTEGER DEFAULT 0,
        checked_in_at DATETIME,
        checked_out_at DATETIME,
        qr_code_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_guests_unique_code ON guests(unique_code);
      CREATE INDEX IF NOT EXISTS idx_guests_parent_id ON guests(parent_id);

      CREATE TABLE IF NOT EXISTS guest_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guest_id INTEGER NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
        action TEXT NOT NULL,
        from_status TEXT,
        to_status TEXT,
        performed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        performed_by_username TEXT,
        ip TEXT,
        user_agent TEXT,
        reason TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_guest_events_guest_id ON guest_events(guest_id);
      CREATE INDEX IF NOT EXISTS idx_guest_events_created_at ON guest_events(created_at);
    `);
  }

  // ─── Migrations: new re-entry / audit columns on guests ────────
  await addColumnIfMissing("guests", "status", "TEXT DEFAULT 'pending'");
  await addColumnIfMissing("guests", "entry_count", "INTEGER DEFAULT 0");
  await addColumnIfMissing(
    "guests",
    "last_action_at",
    isPg() ? "TIMESTAMP" : "DATETIME",
  );
  await addColumnIfMissing("guests", "last_action_by", "INTEGER");

  // Backfill status from legacy `checked_in` flag
  await db.exec(`
    UPDATE guests
       SET status = CASE
         WHEN checked_in = 1 THEN 'inside'
         WHEN checked_out_at IS NOT NULL THEN 'stepped_out'
         ELSE 'pending'
       END
     WHERE status IS NULL OR status = ''
  `);

  // ─── Uniqueness: case-insensitive email + seat_number, when not null ─
  if (isPg()) {
    await db.exec(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_guests_email_unique
         ON guests (LOWER(email)) WHERE email IS NOT NULL AND email <> ''`,
    );
    await db.exec(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_guests_seat_unique
         ON guests (seat_number) WHERE seat_number IS NOT NULL AND seat_number <> ''`,
    );
  } else {
    await db.exec(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_guests_email_unique
         ON guests (LOWER(email)) WHERE email IS NOT NULL AND email <> ''`,
    );
    await db.exec(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_guests_seat_unique
         ON guests (seat_number) WHERE seat_number IS NOT NULL AND seat_number <> ''`,
    );
  }

  await seedUsers();
}

async function seedUsers() {
  const adminUsername = process.env.ADMIN_USERNAME || "admin";
  const adminPassword = process.env.ADMIN_PASSWORD || "Admin@123";
  const managerUsername = process.env.MANAGER_USERNAME || "manager";
  const managerPassword = process.env.MANAGER_PASSWORD || "Manager@123";

  const existingAdmin = await db.get(
    "SELECT id FROM users WHERE username = ?",
    [adminUsername],
  );
  if (!existingAdmin) {
    const hash = bcrypt.hashSync(adminPassword, 12);
    await db.run(
      "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
      [adminUsername, hash, "admin"],
    );
    console.log(`[DB] Admin user '${adminUsername}' created.`);
  }

  const existingManager = await db.get(
    "SELECT id FROM users WHERE username = ?",
    [managerUsername],
  );
  if (!existingManager) {
    const hash = bcrypt.hashSync(managerPassword, 12);
    await db.run(
      "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
      [managerUsername, hash, "manager"],
    );
    console.log(`[DB] Manager user '${managerUsername}' created.`);
  }
}

module.exports = { db, initializeDatabase };

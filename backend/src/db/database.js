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
async function initializeDatabase() {
  if (DB_TYPE === "postgres" || DB_TYPE === "postgresql") {
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
    `);
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

import { createClient, Client, ResultSet } from '@libsql/client';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const DB_URL = `file:${path.join(dataDir, 'fee_ledger.db').replace(/\\/g, '/')}`;

let clientInstance: Client | null = null;

// ─── Simple DB helper ─────────────────────────────────────────────────────────
export interface DbHelper {
  get: (sql: string, ...args: any[]) => Promise<Record<string, any> | undefined>;
  all: (sql: string, ...args: any[]) => Promise<Record<string, any>[]>;
  run: (sql: string, ...args: any[]) => Promise<{ changes: number; lastInsertRowid: number }>;
  exec: (sql: string) => Promise<void>;
  transaction: <T>(fn: (db: DbHelper) => Promise<T>) => Promise<T>;
}

function rowToObj(row: any, columns: string[]): Record<string, any> {
  const obj: Record<string, any> = {};
  for (let i = 0; i < columns.length; i++) {
    obj[columns[i]] = row[i];
  }
  return obj;
}

function buildArgs(args: any[]): any[] {
  // Flatten single array argument
  if (args.length === 1 && Array.isArray(args[0])) return args[0];
  return args;
}

function makeHelper(client: Client): DbHelper {
  const helper: DbHelper = {
    async get(sql: string, ...args: any[]) {
      const rs: ResultSet = await client.execute({ sql, args: buildArgs(args) });
      if (!rs.rows.length) return undefined;
      return rowToObj(rs.rows[0], rs.columns as string[]);
    },
    async all(sql: string, ...args: any[]) {
      const rs: ResultSet = await client.execute({ sql, args: buildArgs(args) });
      return rs.rows.map(row => rowToObj(row, rs.columns as string[]));
    },
    async run(sql: string, ...args: any[]) {
      const rs: ResultSet = await client.execute({ sql, args: buildArgs(args) });
      return {
        changes: rs.rowsAffected,
        lastInsertRowid: Number(rs.lastInsertRowid ?? 0)
      };
    },
    async exec(sql: string) {
      // Split and execute individual statements
      const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
      for (const stmt of statements) {
        await client.execute(stmt);
      }
    },
    async transaction<T>(fn: (db: DbHelper) => Promise<T>): Promise<T> {
      const tx = await client.transaction('write');
      const txHelper: DbHelper = {
        async get(sql: string, ...args: any[]) {
          const rs = await tx.execute({ sql, args: buildArgs(args) });
          if (!rs.rows.length) return undefined;
          return rowToObj(rs.rows[0], rs.columns as string[]);
        },
        async all(sql: string, ...args: any[]) {
          const rs = await tx.execute({ sql, args: buildArgs(args) });
          return rs.rows.map(row => rowToObj(row, rs.columns as string[]));
        },
        async run(sql: string, ...args: any[]) {
          const rs = await tx.execute({ sql, args: buildArgs(args) });
          return { changes: rs.rowsAffected, lastInsertRowid: Number(rs.lastInsertRowid ?? 0) };
        },
        async exec(sql: string) {
          const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
          for (const stmt of statements) await tx.execute(stmt);
        },
        transaction: helper.transaction
      };
      try {
        const result = await fn(txHelper);
        await tx.commit();
        return result;
      } catch (err) {
        await tx.rollback();
        throw err;
      }
    }
  };
  return helper;
}

let dbHelper: DbHelper | null = null;

export function getDb(): DbHelper {
  if (!dbHelper) {
    if (!clientInstance) {
      clientInstance = createClient({ url: DB_URL });
    }
    dbHelper = makeHelper(clientInstance);
  }
  return dbHelper;
}

export async function initDatabase(): Promise<void> {
  const database = getDb();

  await database.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT,
      role TEXT DEFAULT 'admin' CHECK(role IN ('superadmin','admin','viewer')),
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      registration_no TEXT UNIQUE NOT NULL,
      student_name TEXT NOT NULL,
      father_name TEXT,
      school TEXT,
      department TEXT,
      program TEXT,
      campus TEXT,
      date_of_joining TEXT,
      date_of_leaving TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS fee_structure_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      registration_no TEXT NOT NULL,
      academic_year TEXT NOT NULL,
      study_year TEXT NOT NULL CHECK(study_year IN ('Freshman Year','Sophomore Year','Junior Year','Senior Year I','Senior Year II')),
      fee_type TEXT NOT NULL,
      installment TEXT NOT NULL CHECK(installment IN ('I','II','III','IV')),
      fee_amount REAL NOT NULL CHECK(fee_amount >= 0),
      import_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (registration_no) REFERENCES students(registration_no) ON DELETE CASCADE,
      UNIQUE(registration_no, academic_year, study_year, fee_type, installment)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      registration_no TEXT NOT NULL,
      payment_date TEXT NOT NULL,
      academic_year TEXT NOT NULL,
      study_year TEXT NOT NULL,
      fee_type TEXT NOT NULL,
      installment TEXT NOT NULL,
      amount_paid REAL NOT NULL CHECK(amount_paid > 0),
      receipt_no TEXT,
      easybuzz_id TEXT,
      payment_mode TEXT,
      is_cancelled INTEGER DEFAULT 0,
      cancellation_reason TEXT,
      cancelled_by INTEGER,
      cancelled_at TEXT,
      import_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (registration_no) REFERENCES students(registration_no) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS deposits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      registration_no TEXT NOT NULL,
      amount REAL NOT NULL,
      receipt_no TEXT,
      deposit_date TEXT,
      remarks TEXT,
      created_by INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (registration_no) REFERENCES students(registration_no) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS adjustments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      registration_no TEXT NOT NULL,
      academic_year TEXT,
      study_year TEXT,
      fee_type TEXT,
      installment TEXT,
      adjustment_type TEXT NOT NULL CHECK(adjustment_type IN ('refund','adjustment','waiver')),
      amount REAL NOT NULL,
      reason TEXT,
      created_by INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (registration_no) REFERENCES students(registration_no) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS imports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_name TEXT NOT NULL,
      import_type TEXT NOT NULL,
      total_students INTEGER DEFAULT 0,
      total_fee_records INTEGER DEFAULT 0,
      total_transactions INTEGER DEFAULT 0,
      valid_records INTEGER DEFAULT 0,
      error_records INTEGER DEFAULT 0,
      duplicate_records INTEGER DEFAULT 0,
      unmatched_records INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','processing','completed','failed')),
      imported_by INTEGER,
      error_report_path TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS import_errors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      import_id INTEGER NOT NULL,
      sheet_name TEXT,
      row_number INTEGER,
      registration_no TEXT,
      field_name TEXT,
      error_type TEXT,
      error_message TEXT,
      raw_data TEXT,
      FOREIGN KEY (import_id) REFERENCES imports(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ledger_generation_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      registration_no TEXT,
      generation_type TEXT CHECK(generation_type IN ('individual','bulk')),
      bulk_criteria TEXT,
      student_count INTEGER,
      file_path TEXT,
      generated_by INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT,
      action TEXT NOT NULL,
      table_name TEXT,
      record_id TEXT,
      old_value TEXT,
      new_value TEXT,
      ip_address TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_students_reg ON students(registration_no);
    CREATE INDEX IF NOT EXISTS idx_fee_struct_reg ON fee_structure_items(registration_no);
    CREATE INDEX IF NOT EXISTS idx_transactions_reg ON transactions(registration_no);
    CREATE INDEX IF NOT EXISTS idx_transactions_cancelled ON transactions(is_cancelled);
    CREATE INDEX IF NOT EXISTS idx_audit_table ON audit_logs(table_name, record_id)
  `);

  // Seed default admin user
  const existingAdmin = await database.get('SELECT id FROM users WHERE username = ?', 'admin');
  if (!existingAdmin) {
    const hash = bcrypt.hashSync('admin123', 12);
    await database.run(
      `INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)`,
      'admin', hash, 'System Administrator', 'superadmin'
    );
    console.log('Default admin created: admin / admin123');
  }

  console.log('Database initialized successfully');
}

export default getDb;

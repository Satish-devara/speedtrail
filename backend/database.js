import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let dbPath = path.resolve(__dirname, '../database.sqlite');

if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
  const tmpDbPath = '/tmp/database.sqlite';
  // Copy the seeded database to /tmp if it does not exist there
  if (!fs.existsSync(tmpDbPath) && fs.existsSync(dbPath)) {
    try {
      fs.copyFileSync(dbPath, tmpDbPath);
      console.log('Copied database.sqlite to /tmp for writing');
    } catch (e) {
      console.error('Failed to copy database to /tmp', e);
    }
  }
  dbPath = tmpDbPath;
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to SQLite database at', dbPath);
    // Auto-initialize schema and seed data if missing
    initializeDatabase(db);
  }
});

function initializeDatabase(dbInstance) {
  dbInstance.get("SELECT name FROM sqlite_master WHERE type='table' AND name='users'", [], (err, row) => {
    if (err) {
      console.error('Failed to check database initialization status', err);
      return;
    }
    if (!row) {
      console.log('Database tables not found. Auto-initializing schema and seeding roommate personas...');
      runAutoSeed(dbInstance);
    } else {
      console.log('Database already initialized. Roommate accounts are ready.');
    }
  });
}

function runAutoSeed(dbInstance) {
  const schema = `
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(100) NOT NULL UNIQUE,
        email VARCHAR(255) UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS group_memberships (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        joined_at TIMESTAMP NOT NULL,
        left_at TIMESTAMP,
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT chk_timeline CHECK (left_at IS NULL OR left_at >= joined_at),
        UNIQUE(group_id, user_id, joined_at)
    );
    CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL,
        paid_by_user_id INTEGER NOT NULL,
        description VARCHAR(255) NOT NULL,
        amount DECIMAL(15, 4) NOT NULL,
        currency VARCHAR(3) NOT NULL DEFAULT 'INR',
        exchange_rate_to_inr DECIMAL(15, 6) NOT NULL DEFAULT 1.000000,
        amount_inr DECIMAL(15, 4) NOT NULL,
        expense_date TIMESTAMP NOT NULL,
        split_type VARCHAR(20) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'FINALIZED',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
        FOREIGN KEY (paid_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT chk_split_type CHECK (split_type IN ('EQUAL', 'EXACT', 'PERCENTAGE', 'SHARES')),
        CONSTRAINT chk_expense_status CHECK (status IN ('PENDING_REVIEW', 'FINALIZED'))
    );
    CREATE TABLE IF NOT EXISTS expense_splits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        expense_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        split_value DECIMAL(15, 4) NOT NULL,
        calculated_amount_inr DECIMAL(15, 4) NOT NULL,
        FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS settlements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL,
        from_user_id INTEGER NOT NULL,
        to_user_id INTEGER NOT NULL,
        amount DECIMAL(15, 4) NOT NULL,
        currency VARCHAR(3) NOT NULL DEFAULT 'INR',
        exchange_rate_to_inr DECIMAL(15, 6) NOT NULL DEFAULT 1.000000,
        amount_inr DECIMAL(15, 4) NOT NULL,
        settled_date TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
        FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS import_anomalies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        raw_row_index INTEGER NOT NULL,
        raw_data TEXT NOT NULL,
        error_type VARCHAR(100) NOT NULL,
        error_description TEXT NOT NULL,
        proposed_fix TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING_REVIEW',
        resolved_at TIMESTAMP,
        resolved_by_user_id INTEGER,
        FOREIGN KEY (resolved_by_user_id) REFERENCES users(id) ON DELETE SET NULL
    );
  `;

  dbInstance.exec(schema, (err) => {
    if (err) {
      console.error('Error creating schema during autoseed', err);
      return;
    }

    // Seed data sequentially using traditional callbacks to guarantee order on connection
    const users = ['Aisha', 'Rohan', 'Priya', 'Meera', 'Sam', 'Dev'];
    let userCount = 0;
    const userIds = {};

    users.forEach(name => {
      dbInstance.run(
        "INSERT INTO users (name, email) VALUES (?, ?)",
        [name, `${name.toLowerCase()}@example.com`],
        function(insertErr) {
          if (insertErr) {
            console.error('Autoseed insert user error', name, insertErr);
            return;
          }
          userIds[name] = this.lastID;
          userCount++;

          if (userCount === users.length) {
            // Group and memberships creation
            dbInstance.run(
              "INSERT INTO groups (name, description) VALUES (?, ?)",
              ['Apartment 4B', 'Shared expenses for the apartment flatmates'],
              function(groupErr) {
                if (groupErr) {
                  console.error('Autoseed insert group error', groupErr);
                  return;
                }
                const groupId = this.lastID;
                const feb1 = '2026-02-01 00:00:00';
                const march31 = '2026-03-31 23:59:59';
                const april15 = '2026-04-15 00:00:00';
                const feb15 = '2026-02-15 00:00:00';
                const march15 = '2026-03-15 23:59:59';

                // Insert memberships
                dbInstance.run("INSERT INTO group_memberships (group_id, user_id, joined_at) VALUES (?, ?, ?)", [groupId, userIds['Aisha'], feb1]);
                dbInstance.run("INSERT INTO group_memberships (group_id, user_id, joined_at) VALUES (?, ?, ?)", [groupId, userIds['Rohan'], feb1]);
                dbInstance.run("INSERT INTO group_memberships (group_id, user_id, joined_at) VALUES (?, ?, ?)", [groupId, userIds['Priya'], feb1]);
                dbInstance.run("INSERT INTO group_memberships (group_id, user_id, joined_at, left_at) VALUES (?, ?, ?, ?)", [groupId, userIds['Meera'], feb1, march31]);
                dbInstance.run("INSERT INTO group_memberships (group_id, user_id, joined_at) VALUES (?, ?, ?)", [groupId, userIds['Sam'], april15]);
                dbInstance.run("INSERT INTO group_memberships (group_id, user_id, joined_at, left_at) VALUES (?, ?, ?, ?)", [groupId, userIds['Dev'], feb15, march15]);

                console.log('Autoseed completed successfully. SQLite tables initialized and seeded.');
              }
            );
          }
        }
      );
    });
  });
}

// Helper to run query with async/await
export function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        reject(err);
      } else {
        resolve({ id: this.lastID, changes: this.changes });
      }
    });
  });
}

export function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

export function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

export function exec(sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

export default {
  run,
  get,
  all,
  exec
};

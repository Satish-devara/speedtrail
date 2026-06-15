import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let sqlite3;
let useMock = false;

try {
  const sqliteModule = await import('sqlite3');
  sqlite3 = sqliteModule.default || sqliteModule;
} catch (e) {
  console.warn('sqlite3 native binary could not be loaded. Falling back to in-memory JS database.');
  useMock = true;
}

let db = null;
let dbPath = path.resolve(__dirname, '../database.sqlite');

if (!useMock) {
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    const tmpDbPath = '/tmp/database.sqlite';
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

  try {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening database', err.message);
        useMock = true;
      } else {
        console.log('Connected to SQLite database at', dbPath);
        initializeDatabase(db);
      }
    });
  } catch (e) {
    console.error('SQLite initialization crash. Switching to in-memory JS database.', e);
    useMock = true;
  }
}

function initializeDatabase(dbInstance) {
  dbInstance.get("SELECT name FROM sqlite_master WHERE type='table' AND name='users'", [], (err, row) => {
    if (err) return;
    if (!row) {
      console.log('Database tables not found. Auto-initializing schema and seeding roommate personas...');
      runAutoSeed(dbInstance);
    }
  });
}

function runAutoSeed(dbInstance) {
  const schema = `
    CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name VARCHAR(100) UNIQUE, email VARCHAR(255));
    CREATE TABLE IF NOT EXISTS groups (id INTEGER PRIMARY KEY AUTOINCREMENT, name VARCHAR(255), description TEXT);
    CREATE TABLE IF NOT EXISTS group_memberships (id INTEGER PRIMARY KEY AUTOINCREMENT, group_id INTEGER, user_id INTEGER, joined_at TIMESTAMP, left_at TIMESTAMP);
    CREATE TABLE IF NOT EXISTS expenses (id INTEGER PRIMARY KEY AUTOINCREMENT, group_id INTEGER, paid_by_user_id INTEGER, description VARCHAR(255), amount DECIMAL, currency VARCHAR(3), exchange_rate_to_inr DECIMAL, amount_inr DECIMAL, expense_date TIMESTAMP, split_type VARCHAR(20), status VARCHAR(20) DEFAULT 'FINALIZED');
    CREATE TABLE IF NOT EXISTS expense_splits (id INTEGER PRIMARY KEY AUTOINCREMENT, expense_id INTEGER, user_id INTEGER, split_value DECIMAL, calculated_amount_inr DECIMAL);
    CREATE TABLE IF NOT EXISTS settlements (id INTEGER PRIMARY KEY AUTOINCREMENT, group_id INTEGER, from_user_id INTEGER, to_user_id INTEGER, amount DECIMAL, currency VARCHAR(3), exchange_rate_to_inr DECIMAL, amount_inr DECIMAL, settled_date TIMESTAMP);
    CREATE TABLE IF NOT EXISTS import_anomalies (id INTEGER PRIMARY KEY AUTOINCREMENT, raw_row_index INTEGER, raw_data TEXT, error_type VARCHAR(100), error_description TEXT, proposed_fix TEXT, status VARCHAR(20) DEFAULT 'PENDING_REVIEW', resolved_at TIMESTAMP, resolved_by_user_id INTEGER);
  `;
  dbInstance.exec(schema, (err) => {
    if (err) return;
    const users = ['Aisha', 'Rohan', 'Priya', 'Meera', 'Sam', 'Dev'];
    const userIds = {};
    let count = 0;
    
    dbInstance.serialize(() => {
      users.forEach(name => {
        dbInstance.run("INSERT INTO users (name, email) VALUES (?, ?)", [name, `${name.toLowerCase()}@example.com`], function() {
          userIds[name] = this.lastID;
          count++;
          if (count === users.length) {
            dbInstance.run("INSERT INTO groups (name, description) VALUES (?, ?)", ['Apartment 4B', 'Shared flatmates group'], function() {
              const gid = this.lastID;
              
              // Seed memberships
              dbInstance.run("INSERT INTO group_memberships (group_id, user_id, joined_at) VALUES (?, ?, ?)", [gid, userIds['Aisha'], '2026-02-01 00:00:00']);
              dbInstance.run("INSERT INTO group_memberships (group_id, user_id, joined_at) VALUES (?, ?, ?)", [gid, userIds['Rohan'], '2026-02-01 00:00:00']);
              dbInstance.run("INSERT INTO group_memberships (group_id, user_id, joined_at) VALUES (?, ?, ?)", [gid, userIds['Priya'], '2026-02-01 00:00:00']);
              dbInstance.run("INSERT INTO group_memberships (group_id, user_id, joined_at, left_at) VALUES (?, ?, ?, ?)", [gid, userIds['Meera'], '2026-02-01 00:00:00', '2026-03-31 23:59:59']);
              dbInstance.run("INSERT INTO group_memberships (group_id, user_id, joined_at) VALUES (?, ?, ?)", [gid, userIds['Sam'], '2026-04-15 00:00:00']);
              dbInstance.run("INSERT INTO group_memberships (group_id, user_id, joined_at, left_at) VALUES (?, ?, ?, ?)", [gid, userIds['Dev'], '2026-02-15 00:00:00', '2026-03-15 23:59:59']);

              // Seed clean historical transactions
              dbInstance.run("INSERT INTO expenses (id, group_id, paid_by_user_id, description, amount, currency, exchange_rate_to_inr, amount_inr, expense_date, split_type, status) VALUES (1, 1, 1, 'February Groceries', 1200, 'INR', 1.0, 1200, '2026-02-10 12:00:00', 'EQUAL', 'FINALIZED')");
              dbInstance.run("INSERT INTO expense_splits (expense_id, user_id, split_value, calculated_amount_inr) VALUES (1, 1, 0, 300)");
              dbInstance.run("INSERT INTO expense_splits (expense_id, user_id, split_value, calculated_amount_inr) VALUES (1, 2, 0, 300)");
              dbInstance.run("INSERT INTO expense_splits (expense_id, user_id, split_value, calculated_amount_inr) VALUES (1, 3, 0, 300)");
              dbInstance.run("INSERT INTO expense_splits (expense_id, user_id, split_value, calculated_amount_inr) VALUES (1, 4, 0, 300)");

              dbInstance.run("INSERT INTO expenses (id, group_id, paid_by_user_id, description, amount, currency, exchange_rate_to_inr, amount_inr, expense_date, split_type, status) VALUES (2, 1, 2, 'March Rent', 8000, 'INR', 1.0, 8000, '2026-03-01 10:00:00', 'EQUAL', 'FINALIZED')");
              dbInstance.run("INSERT INTO expense_splits (expense_id, user_id, split_value, calculated_amount_inr) VALUES (2, 1, 0, 2000)");
              dbInstance.run("INSERT INTO expense_splits (expense_id, user_id, split_value, calculated_amount_inr) VALUES (2, 2, 0, 2000)");
              dbInstance.run("INSERT INTO expense_splits (expense_id, user_id, split_value, calculated_amount_inr) VALUES (2, 3, 0, 2000)");
              dbInstance.run("INSERT INTO expense_splits (expense_id, user_id, split_value, calculated_amount_inr) VALUES (2, 4, 0, 2000)");

              dbInstance.run("INSERT INTO expenses (id, group_id, paid_by_user_id, description, amount, currency, exchange_rate_to_inr, amount_inr, expense_date, split_type, status) VALUES (3, 1, 2, 'Trip Taxi', 60, 'USD', 83.0, 4980, '2026-02-25 18:00:00', 'EQUAL', 'FINALIZED')");
              dbInstance.run("INSERT INTO expense_splits (expense_id, user_id, split_value, calculated_amount_inr) VALUES (3, 2, 0, 1660)");
              dbInstance.run("INSERT INTO expense_splits (expense_id, user_id, split_value, calculated_amount_inr) VALUES (3, 3, 0, 1660)");
              dbInstance.run("INSERT INTO expense_splits (expense_id, user_id, split_value, calculated_amount_inr) VALUES (3, 6, 0, 1660)");

              dbInstance.run("INSERT INTO expenses (id, group_id, paid_by_user_id, description, amount, currency, exchange_rate_to_inr, amount_inr, expense_date, split_type, status) VALUES (4, 1, 3, 'April Internet', 1500, 'INR', 1.0, 1500, '2026-04-18 14:00:00', 'EQUAL', 'FINALIZED')");
              dbInstance.run("INSERT INTO expense_splits (expense_id, user_id, split_value, calculated_amount_inr) VALUES (4, 1, 0, 375)");
              dbInstance.run("INSERT INTO expense_splits (expense_id, user_id, split_value, calculated_amount_inr) VALUES (4, 2, 0, 375)");
              dbInstance.run("INSERT INTO expense_splits (expense_id, user_id, split_value, calculated_amount_inr) VALUES (4, 3, 0, 375)");
              dbInstance.run("INSERT INTO expense_splits (expense_id, user_id, split_value, calculated_amount_inr) VALUES (4, 5, 0, 375)");

              dbInstance.run("INSERT INTO settlements (id, group_id, from_user_id, to_user_id, amount, currency, exchange_rate_to_inr, amount_inr, settled_date) VALUES (1, 1, 4, 2, 2300, 'INR', 1.0, 2300, '2026-03-28 15:00:00')");
            });
          }
        });
      });
    });
  });
}

// ----------------------------------------------------
// IN-MEMORY JS DATABASE ENGINE MOCK (FOR VERCEL COMPATIBILITY)
// ----------------------------------------------------

const mockDb = {
  users: [
    { id: 1, name: 'Aisha', email: 'aisha@example.com' },
    { id: 2, name: 'Rohan', email: 'rohan@example.com' },
    { id: 3, name: 'Priya', email: 'priya@example.com' },
    { id: 4, name: 'Meera', email: 'meera@example.com' },
    { id: 5, name: 'Sam', email: 'sam@example.com' },
    { id: 6, name: 'Dev', email: 'dev@example.com' }
  ],
  groups: [
    { id: 1, name: 'Apartment 4B', description: 'Shared expenses for the apartment flatmates' }
  ],
  memberships: [
    { id: 1, group_id: 1, user_id: 1, joined_at: '2026-02-01 00:00:00', left_at: null },
    { id: 2, group_id: 1, user_id: 2, joined_at: '2026-02-01 00:00:00', left_at: null },
    { id: 3, group_id: 1, user_id: 3, joined_at: '2026-02-01 00:00:00', left_at: null },
    { id: 4, group_id: 1, user_id: 4, joined_at: '2026-02-01 00:00:00', left_at: '2026-03-31 23:59:59' },
    { id: 5, group_id: 1, user_id: 5, joined_at: '2026-04-15 00:00:00', left_at: null },
    { id: 6, group_id: 1, user_id: 6, joined_at: '2026-02-15 00:00:00', left_at: '2026-03-15 23:59:59' }
  ],
  expenses: [
    { id: 1, group_id: 1, paid_by_user_id: 1, description: 'February Groceries', amount: 1200, currency: 'INR', exchange_rate_to_inr: 1, amount_inr: 1200, expense_date: '2026-02-10 12:00:00', split_type: 'EQUAL', status: 'FINALIZED' },
    { id: 2, group_id: 1, paid_by_user_id: 2, description: 'March Rent', amount: 8000, currency: 'INR', exchange_rate_to_inr: 1, amount_inr: 8000, expense_date: '2026-03-01 10:00:00', split_type: 'EQUAL', status: 'FINALIZED' },
    { id: 3, group_id: 1, paid_by_user_id: 2, description: 'Trip Taxi', amount: 60, currency: 'USD', exchange_rate_to_inr: 83, amount_inr: 4980, expense_date: '2026-02-25 18:00:00', split_type: 'EQUAL', status: 'FINALIZED' },
    { id: 4, group_id: 1, paid_by_user_id: 3, description: 'April Internet', amount: 1500, currency: 'INR', exchange_rate_to_inr: 1, amount_inr: 1500, expense_date: '2026-04-18 14:00:00', split_type: 'EQUAL', status: 'FINALIZED' }
  ],
  expenseSplits: [
    { id: 1, expense_id: 1, user_id: 1, split_value: 0, calculated_amount_inr: 300 },
    { id: 2, expense_id: 1, user_id: 2, split_value: 0, calculated_amount_inr: 300 },
    { id: 3, expense_id: 1, user_id: 3, split_value: 0, calculated_amount_inr: 300 },
    { id: 4, expense_id: 1, user_id: 4, split_value: 0, calculated_amount_inr: 300 },
    
    { id: 5, expense_id: 2, user_id: 1, split_value: 0, calculated_amount_inr: 2000 },
    { id: 6, expense_id: 2, user_id: 2, split_value: 0, calculated_amount_inr: 2000 },
    { id: 7, expense_id: 2, user_id: 3, split_value: 0, calculated_amount_inr: 2000 },
    { id: 8, expense_id: 2, user_id: 4, split_value: 0, calculated_amount_inr: 2000 },
    
    { id: 9, expense_id: 3, user_id: 2, split_value: 0, calculated_amount_inr: 1660 },
    { id: 10, expense_id: 3, user_id: 3, split_value: 0, calculated_amount_inr: 1660 },
    { id: 11, expense_id: 3, user_id: 6, split_value: 0, calculated_amount_inr: 1660 },
    
    { id: 12, expense_id: 4, user_id: 1, split_value: 0, calculated_amount_inr: 375 },
    { id: 13, expense_id: 4, user_id: 2, split_value: 0, calculated_amount_inr: 375 },
    { id: 14, expense_id: 4, user_id: 3, split_value: 0, calculated_amount_inr: 375 },
    { id: 15, expense_id: 4, user_id: 5, split_value: 0, calculated_amount_inr: 375 }
  ],
  settlements: [
    { id: 1, group_id: 1, from_user_id: 4, to_user_id: 2, amount: 2300, currency: 'INR', exchange_rate_to_inr: 1, amount_inr: 2300, settled_date: '2026-03-28 15:00:00' }
  ],
  anomalies: [],
  nextId: {
    expenses: 5,
    expenseSplits: 16,
    settlements: 2,
    anomalies: 1
  }
};

function routeMockQuery(sql, params) {
  const sqlLower = sql.toLowerCase().trim();

  if (sqlLower.startsWith('select * from users') && !sqlLower.includes('where')) {
    return mockDb.users;
  }
  if (sqlLower.startsWith('select * from groups')) {
    return mockDb.groups;
  }
  if (sqlLower.includes('join group_memberships') && sqlLower.includes('m.group_id = ?')) {
    const gid = params[0];
    const results = [];
    mockDb.memberships.forEach(m => {
      if (m.group_id == gid) {
        const u = mockDb.users.find(user => user.id == m.user_id);
        if (u) {
          results.push({
            id: u.id,
            name: u.name,
            joined_at: m.joined_at,
            left_at: m.left_at
          });
        }
      }
    });
    return results;
  }
  if (sqlLower.includes('sum(amount_inr)') && sqlLower.includes('from expenses') && sqlLower.includes('group_id = ?') && sqlLower.includes('paid_by_user_id')) {
    const gid = params[0];
    const summary = {};
    mockDb.expenses.forEach(e => {
      if (e.group_id == gid && e.status === 'FINALIZED') {
        summary[e.paid_by_user_id] = (summary[e.paid_by_user_id] || 0) + e.amount_inr;
      }
    });
    return Object.entries(summary).map(([k, v]) => ({
      paid_by_user_id: parseInt(k),
      total_paid: v
    }));
  }
  if (sqlLower.includes('sum(s.calculated_amount_inr)') && sqlLower.includes('expense_splits s') && sqlLower.includes('group_id = ?')) {
    const gid = params[0];
    const summary = {};
    mockDb.expenseSplits.forEach(s => {
      const e = mockDb.expenses.find(exp => exp.id == s.expense_id);
      if (e && e.group_id == gid && e.status === 'FINALIZED') {
        summary[s.user_id] = (summary[s.user_id] || 0) + s.calculated_amount_inr;
      }
    });
    return Object.entries(summary).map(([k, v]) => ({
      user_id: parseInt(k),
      total_owed: v
    }));
  }
  if (sqlLower.includes('sum(amount_inr)') && sqlLower.includes('from settlements') && sqlLower.includes('from_user_id')) {
    const gid = params[0];
    const summary = {};
    mockDb.settlements.forEach(s => {
      if (s.group_id == gid) {
        summary[s.from_user_id] = (summary[s.from_user_id] || 0) + s.amount_inr;
      }
    });
    return Object.entries(summary).map(([k, v]) => ({
      from_user_id: parseInt(k),
      total_sent: v
    }));
  }
  if (sqlLower.includes('sum(amount_inr)') && sqlLower.includes('from settlements') && sqlLower.includes('to_user_id')) {
    const gid = params[0];
    const summary = {};
    mockDb.settlements.forEach(s => {
      if (s.group_id == gid) {
        summary[s.to_user_id] = (summary[s.to_user_id] || 0) + s.amount_inr;
      }
    });
    return Object.entries(summary).map(([k, v]) => ({
      to_user_id: parseInt(k),
      total_received: v
    }));
  }
  if (sqlLower.includes('from users') && sqlLower.includes('lower(name) = ?')) {
    const lowerName = params[0].toLowerCase();
    return mockDb.users.find(u => u.name.toLowerCase() === lowerName) || null;
  }
  if (sqlLower.includes('from group_memberships') && sqlLower.includes('group_id = ?') && sqlLower.includes('user_id = ?')) {
    const gid = params[0];
    const uid = params[1];
    return mockDb.memberships.find(m => m.group_id == gid && m.user_id == uid) || null;
  }
  if (sqlLower.includes('from expenses') && sqlLower.includes('description = ?') && sqlLower.includes('abs(amount - ?)')) {
    const desc = params[0];
    const amount = params[1];
    const dateStr = params[2].replace('%', '');
    const paidBy = params[3];
    return mockDb.expenses.find(e => 
      e.description === desc && 
      Math.abs(e.amount - amount) < 0.05 && 
      e.expense_date.startsWith(dateStr) &&
      e.paid_by_user_id == paidBy
    ) || null;
  }
  if (sqlLower.includes('from expenses') && sqlLower.includes('paid_by_user_id = ?') && sqlLower.includes('finalized')) {
    const gid = params[0];
    const uid = params[1];
    return mockDb.expenses.filter(e => e.group_id == gid && e.paid_by_user_id == uid && e.status === 'FINALIZED');
  }
  if (sqlLower.includes('from expense_splits s') && sqlLower.includes('s.user_id = ?')) {
    const gid = params[0];
    const uid = params[1];
    const results = [];
    mockDb.expenseSplits.forEach(s => {
      if (s.user_id == uid) {
        const e = mockDb.expenses.find(exp => exp.id == s.expense_id);
        if (e && e.group_id == gid && e.status === 'FINALIZED') {
          const u = mockDb.users.find(user => user.id == e.paid_by_user_id);
          results.push({
            id: e.id,
            description: e.description,
            amount: e.amount,
            currency: e.currency,
            exchange_rate_to_inr: e.exchange_rate_to_inr,
            amount_inr: e.amount_inr,
            expense_date: e.expense_date,
            split_value: s.split_value,
            calculated_amount_inr: s.calculated_amount_inr,
            paid_by_name: u ? u.name : 'Unknown'
          });
        }
      }
    });
    return results;
  }
  if (sqlLower.includes('from settlements s') && sqlLower.includes('s.from_user_id = ?')) {
    const gid = params[0];
    const uid = params[1];
    const results = [];
    mockDb.settlements.forEach(s => {
      if (s.group_id == gid && s.from_user_id == uid) {
        const u = mockDb.users.find(user => user.id == s.to_user_id);
        results.push({
          id: s.id,
          amount: s.amount,
          currency: s.currency,
          exchange_rate_to_inr: s.exchange_rate_to_inr,
          amount_inr: s.amount_inr,
          settled_date: s.settled_date,
          to_name: u ? u.name : 'Unknown'
        });
      }
    });
    return results;
  }
  if (sqlLower.includes('from settlements s') && sqlLower.includes('s.to_user_id = ?')) {
    const gid = params[0];
    const uid = params[1];
    const results = [];
    mockDb.settlements.forEach(s => {
      if (s.group_id == gid && s.to_user_id == uid) {
        const u = mockDb.users.find(user => user.id == s.from_user_id);
        results.push({
          id: s.id,
          amount: s.amount,
          currency: s.currency,
          exchange_rate_to_inr: s.exchange_rate_to_inr,
          amount_inr: s.amount_inr,
          settled_date: s.settled_date,
          from_name: u ? u.name : 'Unknown'
        });
      }
    });
    return results;
  }
  if (sqlLower.includes('from import_anomalies') && sqlLower.includes('pending_review')) {
    if (sqlLower.includes('where id = ?')) {
      const aid = params[0];
      return mockDb.anomalies.find(a => a.id == aid) || null;
    }
    return mockDb.anomalies.filter(a => a.status === 'PENDING_REVIEW');
  }
  if (sqlLower.startsWith('insert into')) {
    if (sqlLower.includes('expenses')) {
      const id = mockDb.nextId.expenses++;
      mockDb.expenses.push({
        id,
        group_id: params[0],
        paid_by_user_id: params[1],
        description: params[2],
        amount: params[3],
        currency: params[4],
        exchange_rate_to_inr: params[5],
        amount_inr: params[6],
        expense_date: params[7],
        split_type: params[8],
        status: 'FINALIZED'
      });
      return { id };
    }
    if (sqlLower.includes('expense_splits')) {
      const id = mockDb.nextId.expenseSplits++;
      mockDb.expenseSplits.push({
        id,
        expense_id: params[0],
        user_id: params[1],
        split_value: params[2],
        calculated_amount_inr: params[3]
      });
      return { id };
    }
    if (sqlLower.includes('settlements')) {
      const id = mockDb.nextId.settlements++;
      mockDb.settlements.push({
        id,
        group_id: params[0],
        from_user_id: params[1],
        to_user_id: params[2],
        amount: params[3],
        currency: params[4],
        exchange_rate_to_inr: params[5],
        amount_inr: params[6],
        settled_date: params[7]
      });
      return { id };
    }
    if (sqlLower.includes('import_anomalies')) {
      const id = mockDb.nextId.anomalies++;
      mockDb.anomalies.push({
        id,
        raw_row_index: params[0],
        raw_data: params[1],
        error_type: params[2],
        error_description: params[3],
        proposed_fix: params[4],
        status: 'PENDING_REVIEW'
      });
      return { id };
    }
  }
  if (sqlLower.startsWith('update')) {
    if (sqlLower.includes('import_anomalies')) {
      const status = params[0];
      const resolvedAt = params[1];
      const resolvedBy = params[2];
      const aid = params[3];
      const a = mockDb.anomalies.find(an => an.id === aid);
      if (a) {
        a.status = status;
        a.resolved_at = resolvedAt;
        a.resolved_by_user_id = resolvedBy;
      }
      return { changes: 1 };
    }
  }
  if (sqlLower.startsWith('delete')) {
    if (sqlLower.includes('import_anomalies')) {
      mockDb.anomalies = [];
      return { changes: 1 };
    }
    if (sqlLower.includes('expenses')) {
      mockDb.expenses = [];
      mockDb.expenseSplits = [];
      mockDb.settlements = [];
      return { changes: 1 };
    }
  }
  return [];
}

export function run(sql, params = []) {
  if (useMock) {
    return Promise.resolve(routeMockQuery(sql, params));
  }
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

export function get(sql, params = []) {
  if (useMock) {
    const res = routeMockQuery(sql, params);
    return Promise.resolve(Array.isArray(res) ? res[0] || null : res);
  }
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

export function all(sql, params = []) {
  if (useMock) {
    const res = routeMockQuery(sql, params);
    return Promise.resolve(Array.isArray(res) ? res : [res]);
  }
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

export function exec(sql) {
  if (useMock) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export default {
  run,
  get,
  all,
  exec
};

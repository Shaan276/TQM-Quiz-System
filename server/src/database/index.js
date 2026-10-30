const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const config = require('../config');

let globalDbInstance = null;

function setDatabaseInstance(db) {
  globalDbInstance = db;
}

function getDatabase(customPath = null) {
  if (globalDbInstance && !customPath) {
    return globalDbInstance;
  }

  const targetPath = customPath || config.db.path;
  const dbDir = path.dirname(targetPath);

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const db = new sqlite3.Database(targetPath, (err) => {
    if (err) {
      console.error(`[Database] Failed to open SQLite connection at ${targetPath}:`, err.message);
    } else {
      db.run('PRAGMA journal_mode = WAL;');
      db.run('PRAGMA synchronous = NORMAL;');
      db.run('PRAGMA foreign_keys = ON;');
    }
  });

  if (!customPath) {
    globalDbInstance = db;
  }

  return db;
}

function dbRun(sql, params = [], db = null) {
  const activeDb = db || getDatabase();
  return new Promise((resolve, reject) => {
    activeDb.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function dbGet(sql, params = [], db = null) {
  const activeDb = db || getDatabase();
  return new Promise((resolve, reject) => {
    activeDb.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });
}

function dbAll(sql, params = [], db = null) {
  const activeDb = db || getDatabase();
  return new Promise((resolve, reject) => {
    activeDb.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

module.exports = {
  getDatabase,
  setDatabaseInstance,
  dbRun,
  dbGet,
  dbAll
};

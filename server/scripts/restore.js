const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const config = require('../src/config');
const { logger } = require('../src/utils/logger');

/**
 * Restore an SQLite database from a verified backup file.
 * @param {string} backupFilePath - Path to the verified .db backup file
 * @param {string} targetDbPath - Destination path for restored database
 */
async function performRestore(backupFilePath, targetDbPath = null) {
  const destPath = targetDbPath || config.db.path;

  if (!fs.existsSync(backupFilePath)) {
    throw new Error(`Backup file does not exist at: ${backupFilePath}`);
  }

  logger.info(`Validating backup integrity at ${backupFilePath} before restore...`);

  // 1. Verify integrity of the backup file before restoring
  const backupDb = new sqlite3.Database(backupFilePath);
  const integrityResult = await new Promise((resolve, reject) => {
    backupDb.get('PRAGMA integrity_check;', (err, row) => {
      if (err) reject(err);
      else resolve(row ? row.integrity_check : 'error');
    });
  });

  // Verify critical tables exist in backup
  const tables = await new Promise((resolve, reject) => {
    backupDb.all("SELECT name FROM sqlite_master WHERE type='table';", (err, rows) => {
      if (err) reject(err);
      else resolve(rows.map(r => r.name));
    });
  });

  await new Promise((resolve) => backupDb.close(resolve));

  if (integrityResult !== 'ok') {
    throw new Error(`Cannot restore corrupted backup. Integrity check returned: ${integrityResult}`);
  }

  const requiredTables = ['users', 'quizzes', 'quiz_attempts', 'assignments'];
  const missingTables = requiredTables.filter(t => !tables.includes(t));
  if (missingTables.length > 0) {
    throw new Error(`Backup file is missing essential schema tables: ${missingTables.join(', ')}`);
  }

  // 2. Perform safe swap
  const destDir = path.dirname(destPath);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  // If current database exists, create a pre-restore safety copy
  if (fs.existsSync(destPath)) {
    const preRestoreSafetyCopy = `${destPath}.pre-restore.${Date.now()}`;
    fs.copyFileSync(destPath, preRestoreSafetyCopy);
    logger.info(`Created pre-restore safety copy at ${preRestoreSafetyCopy}`);
  }

  // Copy backup to destination
  fs.copyFileSync(backupFilePath, destPath);

  // 3. Verify restored destination
  const restoredDb = new sqlite3.Database(destPath);
  const finalCheck = await new Promise((resolve, reject) => {
    restoredDb.get('PRAGMA integrity_check;', (err, row) => {
      if (err) reject(err);
      else resolve(row ? row.integrity_check : 'error');
    });
  });
  await new Promise((resolve) => restoredDb.close(resolve));

  if (finalCheck !== 'ok') {
    throw new Error(`Restored database failed final integrity check: ${finalCheck}`);
  }

  logger.info(`Database successfully restored to ${destPath}. All integrity checks passed.`);

  return {
    success: true,
    destPath,
    backupFilePath,
    tableCount: tables.length,
    restoredAt: new Date().toISOString()
  };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const backupFile = args[0];

  if (!backupFile) {
    console.error('Usage: node server/scripts/restore.js <path-to-backup.db> [target-db-path]');
    process.exit(1);
  }

  performRestore(backupFile, args[1])
    .then(res => {
      console.log('✓ Restore completed:', res);
      process.exit(0);
    })
    .catch(err => {
      console.error('✗ Restore failed:', err.message);
      process.exit(1);
    });
}

module.exports = { performRestore };

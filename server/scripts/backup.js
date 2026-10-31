const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const config = require('../src/config');
const { logger } = require('../src/utils/logger');

/**
 * Perform a live, consistent SQLite backup with WAL checkpointing and integrity verification.
 * @param {string} customDbPath - Optional custom database path
 * @param {string} customBackupDir - Optional custom output directory
 */
async function performBackup(customDbPath = null, customBackupDir = null) {
  const sourcePath = customDbPath || config.db.path;
  const backupDir = customBackupDir || path.resolve(__dirname, '../backups');

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source database file does not exist at: ${sourcePath}`);
  }

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFileName = `quiz_system_backup_${timestamp}.db`;
  const backupFilePath = path.join(backupDir, backupFileName);
  const metadataFilePath = path.join(backupDir, `quiz_system_backup_${timestamp}.json`);

  logger.info(`Starting database backup from ${sourcePath} to ${backupFilePath}...`);

  // 1. Open source database and run WAL checkpoint to ensure all uncommitted WAL pages are flushed
  const sourceDb = new sqlite3.Database(sourcePath);

  await new Promise((resolve, reject) => {
    sourceDb.run('PRAGMA wal_checkpoint(TRUNCATE);', (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  // 2. Close source db cleanly to release any locks and ensure full disk sync
  await new Promise((resolve, reject) => {
    sourceDb.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  // 3. Copy database file cleanly
  fs.copyFileSync(sourcePath, backupFilePath);

  // 4. Verify backup integrity
  const verifiedDb = new sqlite3.Database(backupFilePath);
  const integrityResult = await new Promise((resolve, reject) => {
    verifiedDb.get('PRAGMA integrity_check;', (err, row) => {
      if (err) reject(err);
      else resolve(row ? row.integrity_check : 'error');
    });
  });

  await new Promise((resolve) => verifiedDb.close(resolve));

  if (integrityResult !== 'ok') {
    throw new Error(`Backup integrity verification failed: ${integrityResult}`);
  }

  const stats = fs.statSync(backupFilePath);

  const metadata = {
    backupFileName,
    backupFilePath,
    sourcePath,
    sizeBytes: stats.size,
    sizeKb: Math.round(stats.size / 1024),
    integrity: integrityResult,
    createdAt: new Date().toISOString(),
    nodeEnv: config.nodeEnv
  };

  fs.writeFileSync(metadataFilePath, JSON.stringify(metadata, null, 2), 'utf8');

  logger.info(`Database backup completed successfully. File size: ${metadata.sizeKb} KB. Integrity: ${integrityResult}`);

  return metadata;
}

if (require.main === module) {
  performBackup()
    .then(meta => {
      console.log('✓ Backup finished:', meta);
      process.exit(0);
    })
    .catch(err => {
      console.error('✗ Backup failed:', err.message);
      process.exit(1);
    });
}

module.exports = { performBackup };

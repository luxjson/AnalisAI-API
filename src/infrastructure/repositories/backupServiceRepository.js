// Parameterized persistence for backupService.js; the application coordinates transactions.
const database = require("../database");
exports.query = (text, parameters) => database.query(text, parameters);
exports.connect = () => database.connect();
exports.ensureTableSql1 = () => "SELECT 1 FROM system_backups LIMIT 0";
exports.createBackupSql1 = () =>
  "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY";
exports.createBackupSql2 = (part0) => `SELECT * FROM ${part0}`;
exports.createBackupSql3 = () => "COMMIT";
exports.createBackupSql4 = () => "ROLLBACK";
exports.createBackupSql5 = () => `
    SELECT column_name, udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'system_backups'
  `;
exports.createBackupSql6 = (part0, part1) =>
  `INSERT INTO system_backups (${part0}) VALUES (${part1})`;
exports.createBackupSql7 = () =>
  `DELETE FROM system_backups WHERE id NOT IN (SELECT id FROM system_backups ORDER BY created_at DESC LIMIT 15)`;
exports.getBackupStatusSql1 = () => `
    SELECT 
      filename, 
      created_at, 
      origem, 
      size_bytes, 
      table_count,
      tipo_backup,
      snapshot_id
    FROM system_backups 
    ORDER BY created_at DESC 
    LIMIT 15
  `;
exports.getBackupFileSql1 = () =>
  "SELECT content FROM system_backups WHERE filename = $1 LIMIT 1";

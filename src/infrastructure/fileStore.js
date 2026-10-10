const db = require("./database");

let readyPromise;
function ensureTable() {
  if (!readyPromise) {
    readyPromise = db.query("SELECT 1 FROM uploaded_files LIMIT 0");
  }
  return readyPromise;
}

async function save({ storageKey, originalName, mimeType, buffer }) {
  await ensureTable();
  await db.query(
    `INSERT INTO uploaded_files (storage_key, original_name, mime_type, size_bytes, content)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (storage_key) DO UPDATE SET
       original_name = EXCLUDED.original_name,
       mime_type = EXCLUDED.mime_type,
       size_bytes = EXCLUDED.size_bytes,
       content = EXCLUDED.content`,
    [storageKey, originalName, mimeType, buffer.length, buffer],
  );
}

async function get(storageKey) {
  await ensureTable();
  const result = await db.query(
    "SELECT original_name, mime_type, size_bytes, content FROM uploaded_files WHERE storage_key = $1 LIMIT 1",
    [storageKey],
  );
  return result.rows[0] || null;
}

async function remove(storageKey) {
  if (!storageKey) return;
  await ensureTable();
  await db.query("DELETE FROM uploaded_files WHERE storage_key = $1", [
    storageKey,
  ]);
}

module.exports = { save, get, remove, ensureTable };

function uniqueRow(rows) {
  return Array.isArray(rows) && rows.length === 1 ? rows[0] : null;
}

module.exports = { uniqueRow };

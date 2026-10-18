const test = require("node:test");
const assert = require("node:assert/strict");
const { spreadsheetArchiveAllowed } = require("../src/domain/archiveLimits");

function emptyZip({ entries = 0 } = {}) {
  const buffer = Buffer.alloc(22);
  buffer.writeUInt32LE(0x06054b50, 0);
  buffer.writeUInt16LE(entries, 10);
  buffer.writeUInt32LE(0, 12);
  buffer.writeUInt32LE(0, 16);
  return buffer;
}

test("non-ZIP spreadsheet formats use the separate file-size limit", () => {
  assert.equal(spreadsheetArchiveAllowed(Buffer.from("a,b\n1,2\n")), true);
});

test("rejects ZIP files without a valid end-of-central-directory record", () => {
  assert.equal(spreadsheetArchiveAllowed(Buffer.from("PK" + "x".repeat(80))), false);
});

test("accepts an empty valid ZIP and rejects excessive entry counts", () => {
  assert.equal(spreadsheetArchiveAllowed(emptyZip()), true);
  assert.equal(spreadsheetArchiveAllowed(emptyZip({ entries: 2001 })), false);
});

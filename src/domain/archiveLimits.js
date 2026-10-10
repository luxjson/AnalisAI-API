function spreadsheetArchiveAllowed(buffer) {
  if (buffer.subarray(0, 2).toString() !== "PK") return true;
  let end = -1;
  for (
    let i = buffer.length - 22;
    i >= Math.max(0, buffer.length - 65557);
    i--
  ) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) return false;
  const count = buffer.readUInt16LE(end + 10),
    size = buffer.readUInt32LE(end + 12),
    start = buffer.readUInt32LE(end + 16);
  if (count > 2000 || start + size > end) return false;
  let offset = start,
    total = 0;
  for (let i = 0; i < count; i++) {
    if (
      offset + 46 > buffer.length ||
      buffer.readUInt32LE(offset) !== 0x02014b50
    )
      return false;
    const compressed = buffer.readUInt32LE(offset + 20),
      uncompressed = buffer.readUInt32LE(offset + 24);
    total += uncompressed;
    if (
      uncompressed > 16777216 ||
      total > 33554432 ||
      uncompressed > Math.max(1, compressed) * 200
    )
      return false;
    offset +=
      46 +
      buffer.readUInt16LE(offset + 28) +
      buffer.readUInt16LE(offset + 30) +
      buffer.readUInt16LE(offset + 32);
  }
  return offset === start + size;
}
module.exports = { spreadsheetArchiveAllowed };

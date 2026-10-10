const path = require("path");
const crypto = require("crypto");
function storageKey(file) {
  return `tarefa-${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`;
}
function validateFile(file) {
  const ext = path.extname(file.originalname).toLowerCase(),
    b = file.buffer;
  if (!Buffer.isBuffer(b) || b.length === 0 || b.length > 10485760)
    return false;
  const starts = (hex) =>
    b.subarray(0, hex.length / 2).equals(Buffer.from(hex, "hex"));
  if ([".jpg", ".jpeg"].includes(ext)) return starts("ffd8ff");
  if (ext === ".png") return starts("89504e470d0a1a0a");
  if (ext === ".webp")
    return (
      b.toString("ascii", 0, 4) === "RIFF" &&
      b.toString("ascii", 8, 12) === "WEBP"
    );
  if (ext === ".pdf") return b.toString("ascii", 0, 5) === "%PDF-";
  if ([".doc", ".xls", ".ppt"].includes(ext)) return starts("d0cf11e0a1b11ae1");
  if ([".docx", ".xlsx", ".pptx", ".odt", ".zip"].includes(ext))
    return starts("504b0304") || starts("504b0506");
  if (ext === ".rar")
    return starts("526172211a0700") || starts("526172211a070100");
  if ([".txt", ".csv"].includes(ext))
    return !b.includes(0) && !b.toString("utf8").includes("\uFFFD");
  return false;
}
module.exports = { storageKey, validateFile };

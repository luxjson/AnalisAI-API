const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const allowed = new Map([
  [".pdf", ["application/pdf"]],
  [".doc", ["application/msword"]],
  [
    ".docx",
    ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ],
  [".odt", ["application/vnd.oasis.opendocument.text"]],
  [".xls", ["application/vnd.ms-excel"]],
  [
    ".xlsx",
    ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ],
  [".csv", ["text/csv", "application/csv", "application/vnd.ms-excel"]],
  [".ppt", ["application/vnd.ms-powerpoint"]],
  [
    ".pptx",
    [
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ],
  ],
  [".jpg", ["image/jpeg"]],
  [".jpeg", ["image/jpeg"]],
  [".png", ["image/png"]],
  [".webp", ["image/webp"]],
  [".txt", ["text/plain"]],
  [".zip", ["application/zip"]],
  [".rar", ["application/vnd.rar", "application/x-rar-compressed"]],
]);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10485760, files: 1, fields: 30, parts: 35 },
  fileFilter: (_req, file, cb) =>
    allowed
      .get(path.extname(file.originalname).toLowerCase())
      ?.includes(file.mimetype)
      ? cb(null, true)
      : cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", "arquivo")),
});
module.exports = upload;
module.exports.makeStorageKey = (file) =>
  `tarefa-${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`;

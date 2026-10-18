const test = require("node:test");
const assert = require("node:assert/strict");
const { validateFile, storageKey } = require("../src/domain/fileValidation");

function file(name, bytes) {
  return { originalname: name, buffer: Buffer.from(bytes) };
}

test("accepts known file signatures for supported binary formats", () => {
  assert.equal(validateFile(file("photo.JPG", [0xff, 0xd8, 0xff, 0x00])), true);
  assert.equal(validateFile(file("image.png", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), true);
  assert.equal(validateFile(file("document.pdf", Buffer.from("%PDF-1.7\n"))), true);
  assert.equal(validateFile(file("sheet.xlsx", [0x50, 0x4b, 0x03, 0x04, 0x00])), true);
});

test("rejects empty, oversized, and mismatched binary content", () => {
  assert.equal(validateFile(file("empty.pdf", [])), false);
  assert.equal(validateFile(file("fake.pdf", "not a pdf")), false);
  assert.equal(validateFile(file("fake.png", [0xff, 0xd8, 0xff])), false);
  assert.equal(validateFile(file("large.txt", Buffer.alloc(10 * 1024 * 1024 + 1, 65))), false);
});

test("accepts plain UTF-8 text but rejects NUL and replacement characters", () => {
  assert.equal(validateFile(file("notes.txt", "ação escolar".normalize("NFC"))), true);
  assert.equal(validateFile(file("binary.csv", [0x61, 0x00, 0x62])), false);
  assert.equal(validateFile(file("broken.txt", Buffer.from([0xff, 0xfe]))), false);
});

test("storage keys are generated, unique, and retain only a lowercase extension", () => {
  const first = storageKey({ originalname: "../../Report.PDF" });
  const second = storageKey({ originalname: "../../Report.PDF" });
  assert.match(first, /^tarefa-[0-9a-f-]+\.pdf$/);
  assert.notEqual(first, second);
  assert.ok(!first.includes(".."));
});

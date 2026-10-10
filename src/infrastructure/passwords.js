const argon2 = require("argon2");
const bcrypt = require("bcryptjs");
const options = Object.freeze({
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
});
let dummy;
async function hash(value) {
  return argon2.hash(value, options);
}
async function compare(value, encoded) {
  if (
    typeof value !== "string" ||
    value.length > 128 ||
    typeof encoded !== "string"
  )
    return false;
  if (encoded.startsWith("$argon2id$"))
    return argon2.verify(encoded, value).catch(() => false);
  if (/^\$2[aby]\$/.test(encoded))
    return bcrypt.compare(value, encoded).catch(() => false);
  return false;
}
async function dummyVerify(value) {
  dummy ||= hash(require("crypto").randomBytes(32).toString("hex"));
  await compare(value, await dummy);
}
function needsUpgrade(encoded) {
  return (
    !encoded?.startsWith("$argon2id$") || argon2.needsRehash(encoded, options)
  );
}
module.exports = { hash, compare, needsUpgrade, dummyVerify };

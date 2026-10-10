const crypto = require("crypto");
const db = require("../../infrastructure/database");
const config = require("../config");
const safe = new Set(["GET", "HEAD", "OPTIONS"]);
function attachCsrfToken(req, res, next) {
  req.session.csrfToken ||= crypto.randomBytes(32).toString("hex");
  next();
}
function csrfProtection(req, res, next) {
  if (safe.has(req.method)) return next();
  const origin = req.get("origin");
  const referer = req.get("referer");
  let source = origin;
  if (!source && referer) {
    try {
      source = new URL(referer).origin;
    } catch {}
  }
  if (source !== config.origin)
    return res
      .status(403)
      .json({ error: "Origem da requisição não permitida." });
  const supplied = req.get("x-csrf-token"),
    expected = req.session.csrfToken;
  if (
    typeof supplied !== "string" ||
    typeof expected !== "string" ||
    Buffer.byteLength(supplied) !== Buffer.byteLength(expected) ||
    !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
  )
    return res.status(403).json({ error: "Token CSRF inválido." });
  next();
}
function rateLimit({ windowMs, max, keyPrefix = "global" }) {
  return async (req, res, next) => {
    const key = crypto
      .createHash("sha256")
      .update(`${keyPrefix}:${req.ip}`)
      .digest("hex");
    try {
      const result = await db.query(
        `
  INSERT INTO security_rate_limits(rate_key, window_start,
    request_count)
  VALUES ($1, CURRENT_TIMESTAMP, 1) ON CONFLICT(rate_key) DO UPDATE
  SET window_start = CASE
  WHEN security_rate_limits.window_start <= CURRENT_TIMESTAMP - $2::bigint *
  INTERVAL '1 millisecond' THEN
  CURRENT_TIMESTAMP
  ELSE security_rate_limits.window_start END, request_count = CASE
  WHEN security_rate_limits.window_start <= CURRENT_TIMESTAMP - $2::bigint *
  INTERVAL '1 millisecond' THEN
  1
  ELSE security_rate_limits.request_count + 1 END
  RETURNING request_count, window_start
`,
        [key, windowMs],
      );
      const entry = result.rows[0];
      res.set("RateLimit-Limit", String(max));
      res.set(
        "RateLimit-Remaining",
        String(Math.max(0, max - Number(entry.request_count))),
      );
      if (Number(entry.request_count) > max) {
        res.set(
          "Retry-After",
          String(
            Math.max(
              1,
              Math.ceil(
                (new Date(entry.window_start).getTime() +
                  windowMs -
                  Date.now()) /
                  1000,
              ),
            ),
          ),
        );
        return res
          .status(429)
          .json({ error: "Muitas tentativas. Tente novamente mais tarde." });
      }
      next();
    } catch {
      res.status(503).json({ error: "Serviço temporariamente indisponível." });
    }
  };
}
module.exports = { attachCsrfToken, csrfProtection, rateLimit };

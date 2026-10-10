require("dotenv").config();
const crypto = require("crypto");
const production = process.env.NODE_ENV === "production";
const origin = process.env.APP_ORIGIN || "https://analisai-express.onrender.com";
const parsed = new URL(origin);
if (parsed.origin !== origin || (production && parsed.protocol !== "https:"))
  throw new Error(
    "APP_ORIGIN deve ser uma origem exata, HTTPS em produção, sem barra final.",
  );
const secret =
  process.env.SESSION_SECRET ||
  (production ? null : crypto.randomBytes(48).toString("base64url"));
if (!secret || secret.length < 32)
  throw new Error("SESSION_SECRET deve ter pelo menos 32 caracteres.");
module.exports = {
  production,
  origin,
  secret,
  cookieName: production ? "__Host-analisai.sid" : "analisai.sid",
  cookie: {
    httpOnly: true,
    secure: production,
    sameSite: "lax",
    path: "/",
    maxAge: 8 * 60 * 60 * 1000,
  },
  port: Number(process.env.PORT) || 3000,
};

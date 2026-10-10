require("dotenv").config();
const db = require("../src/infrastructure/database");
(async () => {
  let c;
  try {
    c = await db.connect();
    await c.query("BEGIN READ ONLY");
    const r = await c.query(
      "SELECT table_name,column_name,data_type,is_nullable FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position",
    );
    console.log(JSON.stringify({ columns: r.rows }, null, 2));
    await c.query("ROLLBACK");
  } catch (err) {
    console.error("Inspeção indisponível:", err.code || err.name);
    process.exitCode = 1;
  } finally {
    c?.release();
    await db.end();
  }
})();

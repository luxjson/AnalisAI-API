const db = require("./database");
function record({ kind, id, method, resource, status }) {
  return db.query(
    "INSERT INTO security_audit_events(actor_kind,actor_id,method,resource,outcome_status)VALUES($1,$2,$3,$4,$5)",
    [kind || null, id || null, method, resource.slice(0, 255), status],
  );
}
module.exports = { record };

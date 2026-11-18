const Database = require("better-sqlite3");
const path = require("node:path");
const db = new Database(path.join(__dirname, "..", "data", "companion.db"));
const rows = db
  .prepare(
    `SELECT id, role, substr(content,1,80) AS content, is_proactive, created_at
     FROM messages ORDER BY id DESC LIMIT 12`,
  )
  .all();
for (const r of rows.reverse()) {
  console.log(
    `${r.id}\t${r.role}\tp=${r.is_proactive}\t${r.created_at}\t${r.content}`,
  );
}

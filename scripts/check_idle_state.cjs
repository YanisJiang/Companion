const Database = require("better-sqlite3");
const path = require("node:path");
const db = new Database(path.join(__dirname, "..", "data", "companion.db"));
const get = (key) => {
  const row = db.prepare("select value from settings where key = ?").get(key);
  return row ? String(row.value) : "";
};
for (const k of [
  "proactive_enabled",
  "idle_due_at",
  "initiative_ymd",
  "initiative_count",
  "initiative_daily_cap",
  "last_proactive_date",
]) {
  console.log(`${k}=${get(k)}`);
}
const due = Number(get("idle_due_at") || 0);
const now = Date.now();
console.log(`now=${now}`);
if (due) {
  console.log(`due_in_ms=${due - now}`);
  console.log(`due_in_min=${((due - now) / 60000).toFixed(1)}`);
} else {
  console.log("idle_due_at empty");
}

const Database = require("better-sqlite3");
const path = require("node:path");
const dbPath = path.join(__dirname, "..", "data", "companion.db");
const db = new Database(dbPath);
const row = db.prepare("select value from settings where key = ?").get("persona");
if (!row || !String(row.value).trim()) {
  console.log("MISSING");
  process.exit(1);
}
console.log("OK", String(row.value).length);

const Database = require("better-sqlite3");
const path = require("node:path");
const db = new Database(path.join(__dirname, "..", "data", "companion.db"));
const get = (key) => {
  const row = db.prepare("select value from settings where key = ?").get(key);
  return row ? String(row.value) : "";
};
const seed = get("persona_seed_version");
console.log("seed", seed);
console.log("has_round", get("persona").includes("说圆"));
if (seed !== "7") process.exit(1);

const Database = require("better-sqlite3");
const path = require("node:path");
const db = new Database(path.join(__dirname, "..", "data", "companion.db"));
const get = (key) => {
  const row = db.prepare("select value from settings where key = ?").get(key);
  return row ? String(row.value) : "";
};
const seed = get("persona_seed_version");
const persona = get("persona");
const dossier = get("character_dossier");
console.log("seed", seed);
console.log("persona_len", persona.length);
console.log("dossier_len", dossier.length);
console.log("dossier_head", dossier.slice(0, 30).replace(/\n/g, " "));
if (seed !== "3" || !persona || !dossier) process.exit(1);

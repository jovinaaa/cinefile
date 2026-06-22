// ============================================================
// db.js
// Opens (or creates) the SQLite database file, and runs the
// schema.sql script to make sure all 4 tables exist.
// Every other file in this project imports `db` from here.
//
// NOTE: This uses Node's BUILT-IN node:sqlite module (added in
// Node 22.5+, stable enough to use here) instead of an external
// npm package like better-sqlite3. better-sqlite3 needs to
// COMPILE native C++ code on your machine (requiring Visual
// Studio Build Tools on Windows), which caused install errors.
// node:sqlite ships inside Node itself -- nothing extra to
// install, nothing to compile.
// ============================================================

const { DatabaseSync } = require("node:sqlite");
const fs = require("fs");
const path = require("path");

// This creates a file called cinefile.db in this folder.
// That single file IS the entire database -- no separate
// database server process needed, unlike MySQL/Postgres.
const db = new DatabaseSync(path.join(__dirname, "cinefile.db"));

// Read schema.sql as text, then run it.
// "IF NOT EXISTS" in the schema means this is safe to run
// every time the server starts -- it won't wipe existing data.
const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
db.exec(schema);

console.log("Database ready at cinefile.db");
// NOTE: You may see a yellow "ExperimentalWarning: SQLite is an
// experimental feature" line print when the server starts. This
// is just an informational notice from Node -- not an error.
// The feature works fully; it's just not "stable" in Node's
// official labeling yet.

module.exports = db;

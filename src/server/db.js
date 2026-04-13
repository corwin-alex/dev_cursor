const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const databasePath = process.env.DATABASE_PATH || path.join(__dirname, "../../data/learning-tracker.db");
if (databasePath !== ":memory:") {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
}

const db = new sqlite3.Database(databasePath);

db.serialize(() => {
  // Каскадное удаление нужно для связей курс -> модуль -> урок.
  db.run("PRAGMA foreign_keys = ON");

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL DEFAULT 0,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      notes TEXT DEFAULT '[]',
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS modules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      notes TEXT DEFAULT '[]',
      FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS lessons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      progress INTEGER DEFAULT 0,
      notes TEXT DEFAULT '[]',
      FOREIGN KEY(module_id) REFERENCES modules(id) ON DELETE CASCADE
    )
  `);

  // Мягкая миграция для уже существующей локальной базы.
  db.run("ALTER TABLE courses ADD COLUMN user_id INTEGER NOT NULL DEFAULT 0", () => {});
  db.run("ALTER TABLE courses ADD COLUMN notes TEXT DEFAULT '[]'", () => {});
  db.run("ALTER TABLE modules ADD COLUMN notes TEXT DEFAULT '[]'", () => {});
});

module.exports = db;

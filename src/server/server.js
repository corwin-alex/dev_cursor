const path = require("path");
const crypto = require("crypto");
const express = require("express");
const db = require("./db");

const app = express();
const port = process.env.PORT || 3000;
const publicDir = path.join(__dirname, "../../dist/public");

app.use(express.json());
app.use(express.static(publicDir));

const sessions = new Map();

function normalizeNotes(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item || "").trim()).filter(Boolean);
      }
    } catch (err) {
      return [trimmed];
    }
    return [trimmed];
  }
  return [];
}

function normalizeProgress(progress) {
  const parsed = Number(progress);
  if (!Number.isFinite(parsed)) return 0;
  const allowed = [0, 25, 50, 75, 100];
  return allowed.reduce((closest, current) =>
    Math.abs(current - parsed) < Math.abs(closest - parsed) ? current : closest
  );
}

function hashPassword(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function getUserFromToken(req) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return sessions.get(token) || null;
}

function requireAuth(req, res, next) {
  const user = getUserFromToken(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.user = user;
  next();
}

function getCatalog(userId, callback) {
  db.all("SELECT id, title, description, notes FROM courses WHERE user_id = ? ORDER BY id DESC", [userId], (courseErr, courses) => {
    if (courseErr) {
      callback(courseErr);
      return;
    }

    db.all("SELECT id, course_id, title, notes FROM modules ORDER BY id DESC", (moduleErr, modules) => {
      if (moduleErr) {
        callback(moduleErr);
        return;
      }

      db.all(
        "SELECT id, module_id, title, progress, notes FROM lessons ORDER BY id DESC",
        (lessonErr, lessons) => {
          if (lessonErr) {
            callback(lessonErr);
            return;
          }

          const modulesByCourse = new Map();
          modules.forEach((module) => {
            modulesByCourse.set(module.id, { ...module, lessons: [] });
          });

          lessons.forEach((lesson) => {
            const module = modulesByCourse.get(lesson.module_id);
            if (module) {
              module.lessons.push({ ...lesson, notes: normalizeNotes(lesson.notes) });
            }
          });

          const result = courses.map((course) => {
            const courseModules = [...modulesByCourse.values()].filter((mod) => mod.course_id === course.id);
            return {
              ...course,
              notes: normalizeNotes(course.notes),
              modules: courseModules.map((mod) => ({ ...mod, notes: normalizeNotes(mod.notes) }))
            };
          });

          callback(null, result);
        }
      );
    });
  });
}

app.get("/api/catalog", (req, res) => {
  const user = getUserFromToken(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  getCatalog(user.id, (err, catalog) => {
    if (err) {
      res.status(500).json({ error: "Could not load catalog" });
      return;
    }
    res.json(catalog);
  });
});

app.post("/api/auth/register", (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  db.run(
    "INSERT INTO users (email, password_hash) VALUES (?, ?)",
    [email, hashPassword(password)],
    function onCreate(err) {
      if (err) {
        res.status(400).json({ error: "User already exists or invalid data" });
        return;
      }
      const token = crypto.randomUUID();
      sessions.set(token, { id: this.lastID, email });
      res.status(201).json({ token, user: { id: this.lastID, email } });
    }
  );
});

app.post("/api/auth/login", (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  db.get(
    "SELECT id, email, password_hash FROM users WHERE email = ?",
    [email],
    (err, user) => {
      if (err || !user || user.password_hash !== hashPassword(password)) {
        res.status(401).json({ error: "Invalid credentials" });
        return;
      }
      const token = crypto.randomUUID();
      sessions.set(token, { id: user.id, email: user.email });
      res.json({ token, user: { id: user.id, email: user.email } });
    }
  );
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.post("/api/courses", requireAuth, (req, res) => {
  const { title, description = "", notes = [] } = req.body;
  if (!title?.trim()) {
    res.status(400).json({ error: "Course title is required" });
    return;
  }

  db.run(
    "INSERT INTO courses (user_id, title, description, notes) VALUES (?, ?, ?, ?)",
    [req.user.id, title.trim(), description.trim(), JSON.stringify(normalizeNotes(notes))],
    function onInsert(err) {
      if (err) {
        res.status(500).json({ error: "Could not create course" });
        return;
      }
      res.status(201).json({ id: this.lastID });
    }
  );
});

app.post("/api/modules", requireAuth, (req, res) => {
  const { courseId, title, notes = [] } = req.body;
  if (!courseId || !title?.trim()) {
    res.status(400).json({ error: "courseId and module title are required" });
    return;
  }

  db.get("SELECT id FROM courses WHERE id = ? AND user_id = ?", [courseId, req.user.id], (checkErr, course) => {
    if (checkErr || !course) {
      res.status(404).json({ error: "Course not found" });
      return;
    }
    db.run(
      "INSERT INTO modules (course_id, title, notes) VALUES (?, ?, ?)",
      [courseId, title.trim(), JSON.stringify(normalizeNotes(notes))],
      function onInsert(err) {
        if (err) {
          res.status(500).json({ error: "Could not create module" });
          return;
        }
        res.status(201).json({ id: this.lastID });
      }
    );
  });
});

app.post("/api/lessons", requireAuth, (req, res) => {
  const { moduleId, title } = req.body;
  if (!moduleId || !title?.trim()) {
    res.status(400).json({ error: "moduleId and lesson title are required" });
    return;
  }

  db.get(
    `
      SELECT modules.id
      FROM modules
      INNER JOIN courses ON courses.id = modules.course_id
      WHERE modules.id = ? AND courses.user_id = ?
    `,
    [moduleId, req.user.id],
    (checkErr, module) => {
      if (checkErr || !module) {
        res.status(404).json({ error: "Module not found" });
        return;
      }
      db.run(
        "INSERT INTO lessons (module_id, title, progress, notes) VALUES (?, ?, 0, '[]')",
        [moduleId, title.trim()],
        function onInsert(err) {
          if (err) {
            res.status(500).json({ error: "Could not create lesson" });
            return;
          }
          res.status(201).json({ id: this.lastID });
        }
      );
    }
  );
});

app.put("/api/lessons/:id", requireAuth, (req, res) => {
  const lessonId = Number(req.params.id);
  const { title, progress, notes } = req.body;
  if (!lessonId) {
    res.status(400).json({ error: "Invalid lesson id" });
    return;
  }

  const safeProgress = normalizeProgress(progress);
  const safeNotes = JSON.stringify(normalizeNotes(notes));
  db.run(
    `
      UPDATE lessons
      SET title = ?, progress = ?, notes = ?
      WHERE id = ? AND module_id IN (
        SELECT modules.id
        FROM modules
        INNER JOIN courses ON courses.id = modules.course_id
        WHERE courses.user_id = ?
      )
    `,
    [String(title || "").trim(), safeProgress, safeNotes, lessonId, req.user.id],
    function onUpdate(err) {
      if (err) {
        res.status(500).json({ error: "Could not update lesson" });
        return;
      }
      res.json({ updated: this.changes });
    }
  );
});

app.put("/api/courses/:id/notes", requireAuth, (req, res) => {
  const courseId = Number(req.params.id);
  if (!courseId) {
    res.status(400).json({ error: "Invalid course id" });
    return;
  }
  db.run(
    "UPDATE courses SET notes = ? WHERE id = ? AND user_id = ?",
    [JSON.stringify(normalizeNotes(req.body.notes)), courseId, req.user.id],
    function onUpdate(err) {
      if (err) {
        res.status(500).json({ error: "Could not update course notes" });
        return;
      }
      res.json({ updated: this.changes });
    }
  );
});

app.put("/api/modules/:id/notes", requireAuth, (req, res) => {
  const moduleId = Number(req.params.id);
  if (!moduleId) {
    res.status(400).json({ error: "Invalid module id" });
    return;
  }
  db.run(
    `
      UPDATE modules
      SET notes = ?
      WHERE id = ? AND course_id IN (
        SELECT id FROM courses WHERE user_id = ?
      )
    `,
    [JSON.stringify(normalizeNotes(req.body.notes)), moduleId, req.user.id],
    function onUpdate(err) {
      if (err) {
        res.status(500).json({ error: "Could not update module notes" });
        return;
      }
      res.json({ updated: this.changes });
    }
  );
});

app.delete("/api/courses/:id", requireAuth, (req, res) => {
  db.run("DELETE FROM courses WHERE id = ? AND user_id = ?", [req.params.id, req.user.id], function onDelete(err) {
    if (err) {
      res.status(500).json({ error: "Could not delete course" });
      return;
    }
    res.json({ deleted: this.changes });
  });
});

app.delete("/api/modules/:id", requireAuth, (req, res) => {
  db.run(
    `
      DELETE FROM modules
      WHERE id = ? AND course_id IN (
        SELECT id FROM courses WHERE user_id = ?
      )
    `,
    [req.params.id, req.user.id],
    function onDelete(err) {
      if (err) {
        res.status(500).json({ error: "Could not delete module" });
        return;
      }
      res.json({ deleted: this.changes });
    }
  );
});

app.delete("/api/lessons/:id", requireAuth, (req, res) => {
  db.run(
    `
      DELETE FROM lessons
      WHERE id = ? AND module_id IN (
        SELECT modules.id
        FROM modules
        INNER JOIN courses ON courses.id = modules.course_id
        WHERE courses.user_id = ?
      )
    `,
    [req.params.id, req.user.id],
    function onDelete(err) {
      if (err) {
        res.status(500).json({ error: "Could not delete lesson" });
        return;
      }
      res.json({ deleted: this.changes });
    }
  );
});

app.post("/api/auth/logout", requireAuth, (req, res) => {
  const header = req.headers.authorization || "";
  const token = header.slice(7).trim();
  sessions.delete(token);
  res.status(204).end();
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(port, () => {
  console.log(`Server started on http://localhost:${port}`);
});

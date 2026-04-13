const path = require("path");
const express = require("express");
const db = require("./db");

const app = express();
const port = process.env.PORT || 3000;
const publicDir = path.join(__dirname, "../../dist/public");

app.use(express.json());
app.use(express.static(publicDir));

function getCatalog(callback) {
  db.all("SELECT id, title, description FROM courses ORDER BY id DESC", (courseErr, courses) => {
    if (courseErr) {
      callback(courseErr);
      return;
    }

    db.all("SELECT id, course_id, title FROM modules ORDER BY id DESC", (moduleErr, modules) => {
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
              module.lessons.push(lesson);
            }
          });

          const result = courses.map((course) => {
            const courseModules = [...modulesByCourse.values()].filter((mod) => mod.course_id === course.id);
            return { ...course, modules: courseModules };
          });

          callback(null, result);
        }
      );
    });
  });
}

app.get("/api/catalog", (req, res) => {
  getCatalog((err, catalog) => {
    if (err) {
      res.status(500).json({ error: "Could not load catalog" });
      return;
    }
    res.json(catalog);
  });
});

app.post("/api/courses", (req, res) => {
  const { title, description = "" } = req.body;
  if (!title?.trim()) {
    res.status(400).json({ error: "Course title is required" });
    return;
  }

  db.run(
    "INSERT INTO courses (title, description) VALUES (?, ?)",
    [title.trim(), description.trim()],
    function onInsert(err) {
      if (err) {
        res.status(500).json({ error: "Could not create course" });
        return;
      }
      res.status(201).json({ id: this.lastID });
    }
  );
});

app.post("/api/modules", (req, res) => {
  const { courseId, title } = req.body;
  if (!courseId || !title?.trim()) {
    res.status(400).json({ error: "courseId and module title are required" });
    return;
  }

  db.run(
    "INSERT INTO modules (course_id, title) VALUES (?, ?)",
    [courseId, title.trim()],
    function onInsert(err) {
      if (err) {
        res.status(500).json({ error: "Could not create module" });
        return;
      }
      res.status(201).json({ id: this.lastID });
    }
  );
});

app.post("/api/lessons", (req, res) => {
  const { moduleId, title } = req.body;
  if (!moduleId || !title?.trim()) {
    res.status(400).json({ error: "moduleId and lesson title are required" });
    return;
  }

  db.run(
    "INSERT INTO lessons (module_id, title, progress, notes) VALUES (?, ?, 0, '')",
    [moduleId, title.trim()],
    function onInsert(err) {
      if (err) {
        res.status(500).json({ error: "Could not create lesson" });
        return;
      }
      res.status(201).json({ id: this.lastID });
    }
  );
});

app.put("/api/lessons/:id", (req, res) => {
  const lessonId = Number(req.params.id);
  const { title, progress, notes } = req.body;
  if (!lessonId) {
    res.status(400).json({ error: "Invalid lesson id" });
    return;
  }

  const safeProgress = Number.isInteger(progress) ? Math.max(0, Math.min(100, progress)) : 0;
  db.run(
    "UPDATE lessons SET title = ?, progress = ?, notes = ? WHERE id = ?",
    [String(title || "").trim(), safeProgress, String(notes || ""), lessonId],
    function onUpdate(err) {
      if (err) {
        res.status(500).json({ error: "Could not update lesson" });
        return;
      }
      res.json({ updated: this.changes });
    }
  );
});

app.delete("/api/courses/:id", (req, res) => {
  db.run("DELETE FROM courses WHERE id = ?", [req.params.id], function onDelete(err) {
    if (err) {
      res.status(500).json({ error: "Could not delete course" });
      return;
    }
    res.json({ deleted: this.changes });
  });
});

app.delete("/api/modules/:id", (req, res) => {
  db.run("DELETE FROM modules WHERE id = ?", [req.params.id], function onDelete(err) {
    if (err) {
      res.status(500).json({ error: "Could not delete module" });
      return;
    }
    res.json({ deleted: this.changes });
  });
});

app.delete("/api/lessons/:id", (req, res) => {
  db.run("DELETE FROM lessons WHERE id = ?", [req.params.id], function onDelete(err) {
    if (err) {
      res.status(500).json({ error: "Could not delete lesson" });
      return;
    }
    res.json({ deleted: this.changes });
  });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(port, () => {
  console.log(`Server started on http://localhost:${port}`);
});

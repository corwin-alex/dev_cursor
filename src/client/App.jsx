import React, { useEffect, useMemo, useState } from "react";
import { Link, Route, Routes, useNavigate, useParams } from "react-router-dom";

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  if (!response.ok) {
    throw new Error("Request failed");
  }
  if (response.status === 204) {
    return null;
  }
  return response.json();
}

function Layout({ children }) {
  return (
    <div className="app">
      <header>
        <h1>Трекер обучения и прогресса</h1>
        <Link to="/">Каталог курсов</Link>
      </header>
      {children}
    </div>
  );
}

function CatalogPage() {
  const [catalog, setCatalog] = useState([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const load = async () => {
    const data = await api("/api/catalog");
    setCatalog(data);
  };

  useEffect(() => {
    load();
  }, []);

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!title.trim()) return;
    await api("/api/courses", {
      method: "POST",
      body: JSON.stringify({ title, description })
    });
    setTitle("");
    setDescription("");
    load();
  };

  const removeCourse = async (id) => {
    await api(`/api/courses/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <Layout>
      <section className="panel">
        <h2>Новый курс</h2>
        <form onSubmit={onSubmit} className="form-grid">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Название курса" />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Краткое описание"
          />
          <button type="submit">Добавить курс</button>
        </form>
      </section>

      <section className="panel">
        <h2>Каталог</h2>
        {!catalog.length && <p>Пока пусто. Добавьте первый курс.</p>}
        {catalog.map((course) => (
          <article key={course.id} className="card">
            <div>
              <h3>{course.title}</h3>
              <p>{course.description || "Без описания"}</p>
              <small>Модулей: {course.modules.length}</small>
            </div>
            <div className="actions">
              <Link to={`/courses/${course.id}`}>Открыть</Link>
              <button type="button" onClick={() => removeCourse(course.id)}>
                Удалить
              </button>
            </div>
          </article>
        ))}
      </section>
    </Layout>
  );
}

function CoursePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState([]);
  const [moduleTitle, setModuleTitle] = useState("");
  const [lessonTitles, setLessonTitles] = useState({});
  const [saving, setSaving] = useState({});

  const load = async () => {
    const data = await api("/api/catalog");
    setCatalog(data);
  };

  useEffect(() => {
    load();
  }, []);

  const course = useMemo(() => catalog.find((item) => String(item.id) === id), [catalog, id]);

  const addModule = async (event) => {
    event.preventDefault();
    if (!moduleTitle.trim()) return;
    await api("/api/modules", { method: "POST", body: JSON.stringify({ courseId: Number(id), title: moduleTitle }) });
    setModuleTitle("");
    load();
  };

  const addLesson = async (moduleId) => {
    const title = lessonTitles[moduleId];
    if (!title?.trim()) return;
    await api("/api/lessons", { method: "POST", body: JSON.stringify({ moduleId, title }) });
    setLessonTitles((prev) => ({ ...prev, [moduleId]: "" }));
    load();
  };

  const updateLesson = async (lesson) => {
    setSaving((prev) => ({ ...prev, [lesson.id]: true }));
    await api(`/api/lessons/${lesson.id}`, { method: "PUT", body: JSON.stringify(lesson) });
    setSaving((prev) => ({ ...prev, [lesson.id]: false }));
    load();
  };

  const removeModule = async (moduleId) => {
    await api(`/api/modules/${moduleId}`, { method: "DELETE" });
    load();
  };

  const removeLesson = async (lessonId) => {
    await api(`/api/lessons/${lessonId}`, { method: "DELETE" });
    load();
  };

  if (!course) {
    return (
      <Layout>
        <section className="panel">
          <p>Курс не найден.</p>
          <button type="button" onClick={() => navigate("/")}>
            Назад
          </button>
        </section>
      </Layout>
    );
  }

  return (
    <Layout>
      <section className="panel">
        <h2>{course.title}</h2>
        <p>{course.description || "Без описания"}</p>
        <form onSubmit={addModule} className="form-grid">
          <input
            value={moduleTitle}
            onChange={(e) => setModuleTitle(e.target.value)}
            placeholder="Название модуля"
          />
          <button type="submit">Добавить модуль</button>
        </form>
      </section>

      {course.modules.map((module) => (
        <section key={module.id} className="panel">
          <div className="module-head">
            <h3>{module.title}</h3>
            <button type="button" onClick={() => removeModule(module.id)}>
              Удалить модуль
            </button>
          </div>

          <div className="form-grid">
            <input
              value={lessonTitles[module.id] || ""}
              onChange={(e) => setLessonTitles((prev) => ({ ...prev, [module.id]: e.target.value }))}
              placeholder="Название урока"
            />
            <button type="button" onClick={() => addLesson(module.id)}>
              Добавить урок
            </button>
          </div>

          {!module.lessons.length && <p>В модуле нет уроков.</p>}

          {module.lessons.map((lesson) => (
            <LessonCard
              key={lesson.id}
              lesson={lesson}
              isSaving={Boolean(saving[lesson.id])}
              onSave={updateLesson}
              onDelete={removeLesson}
            />
          ))}
        </section>
      ))}
    </Layout>
  );
}

function LessonCard({ lesson, onSave, onDelete, isSaving }) {
  const [form, setForm] = useState(lesson);

  useEffect(() => {
    setForm(lesson);
  }, [lesson]);

  return (
    <article className="lesson-card">
      <div className="form-grid">
        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <input
          type="number"
          min={0}
          max={100}
          value={form.progress}
          onChange={(e) => setForm({ ...form, progress: Number(e.target.value) })}
        />
      </div>
      <textarea
        value={form.notes}
        rows={3}
        onChange={(e) => setForm({ ...form, notes: e.target.value })}
        placeholder="Заметки по уроку"
      />
      <div className="actions">
        <button type="button" onClick={() => onSave(form)} disabled={isSaving}>
          {isSaving ? "Сохраняем..." : "Сохранить"}
        </button>
        <button type="button" onClick={() => onDelete(lesson.id)}>
          Удалить урок
        </button>
      </div>
    </article>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<CatalogPage />} />
      <Route path="/courses/:id" element={<CoursePage />} />
    </Routes>
  );
}

import React, { useEffect, useMemo, useState } from "react";
import { Link, Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";

async function api(path, options = {}, token = "") {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...options
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(errorData.error || "Request failed");
  }
  if (response.status === 204) return null;
  return response.json();
}

// UI работает только с фиксированными шагами прогресса.
const PROGRESS_STEPS = [
  { value: 0, label: "Не начато" },
  { value: 25, label: "25%" },
  { value: 50, label: "50%" },
  { value: 75, label: "75%" },
  { value: 100, label: "Завершено" }
];

function getProgressLabel(value) {
  return PROGRESS_STEPS.find((step) => step.value === value)?.label || "Не начато";
}

function Layout({ children, userEmail, onLogout }) {
  return (
    <div className="app">
      <header>
        <h1>Сам себе трекер прогресса</h1>
        <div className="header-actions">
          <Link to="/">Каталог курсов</Link>
          <span className="user-email">{userEmail}</span>
          <button type="button" onClick={onLogout}>
            Выйти
          </button>
        </div>
      </header>
      {children}
    </div>
  );
}

function AuthPage({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    try {
      const result = await api(`/api/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      onAuth(result.token, result.user);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="auth-wrap">
      <section className="panel auth-panel">
        <h2>{mode === "login" ? "Вход" : "Регистрация"}</h2>
        <form onSubmit={onSubmit} className="auth-form">
          <label className="field-label">
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="field-label">
            Пароль
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {error && <p className="error-text">{error}</p>}
          <button type="submit">{mode === "login" ? "Войти" : "Создать аккаунт"}</button>
        </form>
        <button type="button" className="text-button" onClick={() => setMode(mode === "login" ? "register" : "login")}>
          {mode === "login" ? "Нет аккаунта? Зарегистрироваться" : "Уже есть аккаунт? Войти"}
        </button>
      </section>
    </div>
  );
}

function CatalogPage({ token, user, onLogout }) {
  const [catalog, setCatalog] = useState([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const load = async () => {
    const data = await api("/api/catalog", {}, token);
    setCatalog(data);
  };

  useEffect(() => {
    load();
  }, []);

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!title.trim()) return;
    await api(
      "/api/courses",
      {
        method: "POST",
        body: JSON.stringify({ title, description })
      },
      token
    );
    setTitle("");
    setDescription("");
    load();
  };

  const removeCourse = async (id) => {
    await api(`/api/courses/${id}`, { method: "DELETE" }, token);
    load();
  };

  return (
    <Layout userEmail={user.email} onLogout={onLogout}>
      <section className="panel">
        <h2>Новый курс</h2>
        <form onSubmit={onSubmit} className="form-grid">
          <label className="field-label span-two">
            Название курса
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="field-label span-two">
            Краткое описание
            <input value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
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

function CoursePage({ token, user, onLogout }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState([]);
  const [moduleTitle, setModuleTitle] = useState("");
  const [lessonTitles, setLessonTitles] = useState({});
  const [saving, setSaving] = useState({});

  const load = async () => {
    // Держим страницу синхронной с сервером после любого изменения.
    const data = await api("/api/catalog", {}, token);
    setCatalog(data);
  };

  useEffect(() => {
    load();
  }, []);

  const course = useMemo(() => catalog.find((item) => String(item.id) === id), [catalog, id]);

  const addModule = async (event) => {
    event.preventDefault();
    if (!moduleTitle.trim()) return;
    await api(
      "/api/modules",
      { method: "POST", body: JSON.stringify({ courseId: Number(id), title: moduleTitle }) },
      token
    );
    setModuleTitle("");
    load();
  };

  const addLesson = async (moduleId) => {
    const title = lessonTitles[moduleId];
    if (!title?.trim()) return;
    await api("/api/lessons", { method: "POST", body: JSON.stringify({ moduleId, title }) }, token);
    setLessonTitles((prev) => ({ ...prev, [moduleId]: "" }));
    load();
  };

  const updateLesson = async (lesson) => {
    setSaving((prev) => ({ ...prev, [lesson.id]: true }));
    await api(`/api/lessons/${lesson.id}`, { method: "PUT", body: JSON.stringify(lesson) }, token);
    setSaving((prev) => ({ ...prev, [lesson.id]: false }));
    load();
  };

  const updateCourseNotes = async (courseId, notes) => {
    setSaving((prev) => ({ ...prev, [`course-${courseId}`]: true }));
    await api(`/api/courses/${courseId}/notes`, { method: "PUT", body: JSON.stringify({ notes }) }, token);
    setSaving((prev) => ({ ...prev, [`course-${courseId}`]: false }));
    load();
  };

  const updateModuleNotes = async (moduleId, notes) => {
    setSaving((prev) => ({ ...prev, [`module-${moduleId}`]: true }));
    await api(`/api/modules/${moduleId}/notes`, { method: "PUT", body: JSON.stringify({ notes }) }, token);
    setSaving((prev) => ({ ...prev, [`module-${moduleId}`]: false }));
    load();
  };

  const removeModule = async (moduleId) => {
    await api(`/api/modules/${moduleId}`, { method: "DELETE" }, token);
    load();
  };

  const removeLesson = async (lessonId) => {
    await api(`/api/lessons/${lessonId}`, { method: "DELETE" }, token);
    load();
  };

  if (!course) {
    return (
      <Layout userEmail={user.email} onLogout={onLogout}>
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
    <Layout userEmail={user.email} onLogout={onLogout}>
      <section className="panel">
        <h2>{course.title}</h2>
        <p>{course.description || "Без описания"}</p>
        <NotesEditor
          title="Заметки по курсу"
          notes={course.notes || []}
          isSaving={Boolean(saving[`course-${course.id}`])}
          onSave={(notes) => updateCourseNotes(course.id, notes)}
        />
        <form onSubmit={addModule} className="form-grid">
          <label className="field-label">
            Название модуля
            <input value={moduleTitle} onChange={(e) => setModuleTitle(e.target.value)} />
          </label>
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

          <NotesEditor
            title="Заметки по модулю"
            notes={module.notes || []}
            isSaving={Boolean(saving[`module-${module.id}`])}
            onSave={(notes) => updateModuleNotes(module.id, notes)}
          />

          <div className="form-grid">
            <label className="field-label">
              Название урока
              <input
                value={lessonTitles[module.id] || ""}
                onChange={(e) => setLessonTitles((prev) => ({ ...prev, [module.id]: e.target.value }))}
              />
            </label>
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
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setForm(lesson);
    setIsEditing(false);
  }, [lesson]);

  const saveChanges = async () => {
    await onSave(form);
    setIsEditing(false);
  };

  const cancelChanges = () => {
    setForm(lesson);
    setIsEditing(false);
  };

  return (
    <article className="lesson-card">
      {!isEditing && (
        <div className="lesson-preview">
          <h4>{form.title}</h4>
          <p className="progress-badge">Прогресс: {getProgressLabel(form.progress)}</p>
          <NotesList notes={form.notes || []} emptyText="Нет заметок по уроку." />
        </div>
      )}
      {isEditing && (
        <>
          <div className="form-grid lesson-inline">
            <label className="field-label">
              Название урока
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </label>
            <label className="field-label">
              Прогресс
              <input
                type="range"
                min={0}
                max={100}
                step={25}
                value={form.progress}
                onChange={(e) => setForm({ ...form, progress: Number(e.target.value) })}
              />
              <small>{getProgressLabel(form.progress)}</small>
            </label>
          </div>
          <NotesEditor
            title="Заметки по уроку"
            notes={form.notes || []}
            isSaving={false}
            // В режиме редактирования сначала меняем локальную форму, а не сервер.
            onSave={(notes) => setForm((prev) => ({ ...prev, notes }))}
            localOnly
          />
        </>
      )}
      <div className="actions">
        {!isEditing && (
          <button type="button" onClick={() => setIsEditing(true)}>
            Редактировать
          </button>
        )}
        {isEditing && (
          <>
            <button type="button" onClick={saveChanges} disabled={isSaving}>
              {isSaving ? "Сохранение…" : "Сохранить"}
            </button>
            <button type="button" onClick={cancelChanges}>
              Отмена
            </button>
          </>
        )}
        <button type="button" onClick={() => onDelete(lesson.id)}>
          Удалить урок
        </button>
      </div>
    </article>
  );
}

function NotesList({ notes, emptyText }) {
  if (!notes.length) return <p>{emptyText}</p>;
  return (
    <ul className="notes-list">
      {notes.map((note, index) => (
        <li key={`${note}-${index}`}>{note}</li>
      ))}
    </ul>
  );
}

function NotesEditor({ title, notes, onSave, isSaving, localOnly = false }) {
  const [draft, setDraft] = useState(notes);
  const [input, setInput] = useState("");

  useEffect(() => {
    // Обновляем локальный список, если пришли свежие данные снаружи.
    setDraft(notes);
  }, [notes]);

  const addNote = async () => {
    if (!input.trim()) return;
    const next = [...draft, input.trim()];
    setDraft(next);
    setInput("");
    if (localOnly) {
      onSave(next);
      return;
    }
    await onSave(next);
  };

  const removeNote = async (index) => {
    const next = draft.filter((_, noteIndex) => noteIndex !== index);
    setDraft(next);
    if (localOnly) {
      onSave(next);
      return;
    }
    await onSave(next);
  };

  return (
    <div className="notes-editor">
      <label className="field-label">{title}</label>
      <div className="notes-input-row">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Новая заметка" />
        <button type="button" onClick={addNote} disabled={isSaving}>
          Добавить
        </button>
      </div>
      <NotesList notes={draft} emptyText="Пока нет заметок." />
      <div className="actions">
        {draft.map((note, index) => (
          <button key={`${note}-${index}`} type="button" className="secondary" onClick={() => removeNote(index)} disabled={isSaving}>
            Удалить: {note.slice(0, 20)}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  });

  const onAuth = (newToken, newUser) => {
    localStorage.setItem("token", newToken);
    localStorage.setItem("user", JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const onLogout = async () => {
    try {
      await api("/api/auth/logout", { method: "POST" }, token);
    } catch {}
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken("");
    setUser(null);
  };

  if (!token || !user) {
    return <AuthPage onAuth={onAuth} />;
  }

  return (
    <Routes>
      <Route path="/" element={<CatalogPage token={token} user={user} onLogout={onLogout} />} />
      <Route path="/courses/:id" element={<CoursePage token={token} user={user} onLogout={onLogout} />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

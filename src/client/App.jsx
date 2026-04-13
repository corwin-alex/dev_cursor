import React, { useEffect, useMemo, useState } from "react";
import { Link, Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { library } from "@fortawesome/fontawesome-svg-core";
import { fas } from "@fortawesome/free-solid-svg-icons";
import { far } from "@fortawesome/free-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

library.add(fas, far);

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
        <h1><FontAwesomeIcon icon="book-open" /> Сам себе трекер прогресса</h1>
        <div className="header-actions">
          <Link to="/"><FontAwesomeIcon icon="list" /> Каталог курсов</Link>
          <span className="user-email"><FontAwesomeIcon icon="user" /> {userEmail}</span>
          <button type="button" onClick={onLogout}>
            <FontAwesomeIcon icon="right-from-bracket" /> Выйти
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
        <h2><FontAwesomeIcon icon={mode === "login" ? "sign-in-alt" : "user-plus"} /> {mode === "login" ? "Вход" : "Регистрация"}</h2>
        <form onSubmit={onSubmit} className="auth-form">
          <label className="field-label">
            <FontAwesomeIcon icon="envelope" /> Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="field-label">
            <FontAwesomeIcon icon="lock" /> Пароль
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {error && <p className="error-text"><FontAwesomeIcon icon="circle-exclamation" /> {error}</p>}
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
  const [editingCourse, setEditingCourse] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");

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

  const startEditCourse = (course) => {
    setEditingCourse(course.id);
    setEditTitle(course.title);
    setEditDescription(course.description || "");
  };

  const cancelEditCourse = () => {
    setEditingCourse(null);
    setEditTitle("");
    setEditDescription("");
  };

  const saveEditCourse = async (courseId) => {
    if (!editTitle.trim()) return;
    await api(
      `/api/courses/${courseId}`,
      {
        method: "PUT",
        body: JSON.stringify({ title: editTitle, description: editDescription })
      },
      token
    );
    cancelEditCourse();
    load();
  };

  return (
    <Layout userEmail={user.email} onLogout={onLogout}>
      <section className="panel">
        <h2><FontAwesomeIcon icon="graduation-cap" /> Новый курс</h2>
        <form onSubmit={onSubmit} className="form-grid">
          <label className="field-label span-two">
            <FontAwesomeIcon icon="book" /> Название курса
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="field-label span-two">
            <FontAwesomeIcon icon="align-left" /> Краткое описание
            <input value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <button type="submit"><FontAwesomeIcon icon="plus" /> Добавить курс</button>
        </form>
      </section>

      <section className="panel">
        <h2><FontAwesomeIcon icon="list-ul" /> Каталог</h2>
        {!catalog.length && <p><FontAwesomeIcon icon="inbox" /> Пока пусто. Добавьте первый курс.</p>}
        {catalog.map((course) => (
          <article key={course.id} className="card">
            {editingCourse === course.id ? (
              <div className="edit-form">
                <label className="field-label">
                  <FontAwesomeIcon icon="pencil" /> Название курса
                  <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                </label>
                <label className="field-label">
                  <FontAwesomeIcon icon="align-left" /> Описание
                  <input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
                </label>
                <div className="actions">
                  <button type="button" onClick={() => saveEditCourse(course.id)}>
                    <FontAwesomeIcon icon="check" /> Сохранить
                  </button>
                  <button type="button" onClick={cancelEditCourse}>
                    <FontAwesomeIcon icon="xmark" /> Отмена
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <h3><FontAwesomeIcon icon="book-open" /> {course.title}</h3>
                  <p>{course.description || "Без описания"}</p>
                  <small><FontAwesomeIcon icon="layer-group" /> Модулей: {course.modules.length}</small>
                </div>
                <div className="actions">
                  <Link to={`/courses/${course.id}`}><FontAwesomeIcon icon="folder-open" /> Открыть</Link>
                  <button type="button" onClick={() => startEditCourse(course)}>
                    <FontAwesomeIcon icon="pencil" /> Редактировать
                  </button>
                  <button type="button" onClick={() => removeCourse(course.id)}>
                    <FontAwesomeIcon icon="trash" /> Удалить
                  </button>
                </div>
              </>
            )}
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
  const [editingModule, setEditingModule] = useState(null);
  const [editModuleTitle, setEditModuleTitle] = useState("");

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

  const startEditModule = (module) => {
    setEditingModule(module.id);
    setEditModuleTitle(module.title);
  };

  const cancelEditModule = () => {
    setEditingModule(null);
    setEditModuleTitle("");
  };

  const saveEditModule = async (moduleId) => {
    if (!editModuleTitle.trim()) return;
    await api(
      `/api/modules/${moduleId}`,
      { method: "PUT", body: JSON.stringify({ title: editModuleTitle }) },
      token
    );
    cancelEditModule();
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
          <p><FontAwesomeIcon icon="circle-exclamation" /> Курс не найден.</p>
          <button type="button" onClick={() => navigate("/")}>
            <FontAwesomeIcon icon="arrow-left" /> Назад
          </button>
        </section>
      </Layout>
    );
  }

  return (
    <Layout userEmail={user.email} onLogout={onLogout}>
      <section className="panel">
        <h2><FontAwesomeIcon icon="book-open" /> {course.title}</h2>
        <p>{course.description || "Без описания"}</p>
        <NotesEditor
          title={<><FontAwesomeIcon icon="note-sticky" /> Заметки по курсу</>}
          notes={course.notes || []}
          isSaving={Boolean(saving[`course-${course.id}`])}
          onSave={(notes) => updateCourseNotes(course.id, notes)}
        />
        <form onSubmit={addModule} className="form-grid">
          <label className="field-label">
            <FontAwesomeIcon icon="layer-group" /> Название модуля
            <input value={moduleTitle} onChange={(e) => setModuleTitle(e.target.value)} />
          </label>
          <button type="submit"><FontAwesomeIcon icon="plus" /> Добавить модуль</button>
        </form>
      </section>

      {course.modules.map((module) => (
        <section key={module.id} className="panel">
          {editingModule === module.id ? (
            <div className="edit-form">
              <label className="field-label">
                <FontAwesomeIcon icon="pencil" /> Название модуля
                <input value={editModuleTitle} onChange={(e) => setEditModuleTitle(e.target.value)} />
              </label>
              <div className="actions">
                <button type="button" onClick={() => saveEditModule(module.id)}>
                  <FontAwesomeIcon icon="check" /> Сохранить
                </button>
                <button type="button" onClick={cancelEditModule}>
                  <FontAwesomeIcon icon="xmark" /> Отмена
                </button>
              </div>
            </div>
          ) : (
            <div className="module-head">
              <h3><FontAwesomeIcon icon="folder" /> {module.title}</h3>
              <button type="button" onClick={() => startEditModule(module)}>
                <FontAwesomeIcon icon="pencil" /> Редактировать
              </button>
              <button type="button" onClick={() => removeModule(module.id)}>
                <FontAwesomeIcon icon="trash" /> Удалить модуль
              </button>
            </div>
          )}

          <NotesEditor
            title={<><FontAwesomeIcon icon="note-sticky" /> Заметки по модулю</>}
            notes={module.notes || []}
            isSaving={Boolean(saving[`module-${module.id}`])}
            onSave={(notes) => updateModuleNotes(module.id, notes)}
          />

          <div className="form-grid">
            <label className="field-label">
              <FontAwesomeIcon icon="video" /> Название урока
              <input
                value={lessonTitles[module.id] || ""}
                onChange={(e) => setLessonTitles((prev) => ({ ...prev, [module.id]: e.target.value }))}
              />
            </label>
            <button type="button" onClick={() => addLesson(module.id)}>
              <FontAwesomeIcon icon="plus" /> Добавить урок
            </button>
          </div>

          {!module.lessons.length && <p><FontAwesomeIcon icon="inbox" /> В модуле нет уроков.</p>}

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
          <h4><FontAwesomeIcon icon="file-video" /> {form.title}</h4>
          <p className="progress-badge"><FontAwesomeIcon icon="chart-simple" /> Прогресс: {getProgressLabel(form.progress)}</p>
          <NotesList notes={form.notes || []} emptyText={<><FontAwesomeIcon icon="inbox" /> Нет заметок по уроку.</>} />
        </div>
      )}
      {isEditing && (
        <>
          <div className="form-grid lesson-inline">
            <label className="field-label">
              <FontAwesomeIcon icon="pencil" /> Название урока
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </label>
            <label className="field-label">
              <FontAwesomeIcon icon="circle-notch" /> Прогресс
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
            title={<><FontAwesomeIcon icon="note-sticky" /> Заметки по уроку</>}
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
            <FontAwesomeIcon icon="pencil" /> Редактировать
          </button>
        )}
        {isEditing && (
          <>
            <button type="button" onClick={saveChanges} disabled={isSaving}>
              {isSaving ? <><FontAwesomeIcon icon="spinner" spin /> Сохранение…</> : <><FontAwesomeIcon icon="check" /> Сохранить</>}
            </button>
            <button type="button" onClick={cancelChanges}>
              <FontAwesomeIcon icon="xmark" /> Отмена
            </button>
          </>
        )}
        <button type="button" onClick={() => onDelete(lesson.id)}>
          <FontAwesomeIcon icon="trash" /> Удалить урок
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
        <li key={`${note}-${index}`}><FontAwesomeIcon icon="sticky-note" /> {note}</li>
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
          <FontAwesomeIcon icon="plus" /> Добавить
        </button>
      </div>
      <NotesList notes={draft} emptyText={<><FontAwesomeIcon icon="inbox" /> Пока нет заметок.</>} />
      <div className="actions">
        {draft.map((note, index) => (
          <button key={`${note}-${index}`} type="button" className="secondary" onClick={() => removeNote(index)} disabled={isSaving}>
            <FontAwesomeIcon icon="trash" /> Удалить: {note.slice(0, 20)}
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

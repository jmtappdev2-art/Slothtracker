// ============================================================
// Time Sloth — Supabase Auth + Data Layer
// ============================================================

const SUPABASE_URL = 'https://sktwubhqkbrqmhreqmlt.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNrdHd1Ymhxa2JycW1ocmVxbWx0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4Mjk0NzAsImV4cCI6MjA5NjQwNTQ3MH0.SjTh3xXVy8CufVxJoMtxC7z7IskmhDFjwH_z1hMj-Zg';

// ── Supabase fetch helper ─────────────────────────────────────
let _session = null;

function sbHeaders(extra = {}) {
  const h = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON,
    'Authorization': `Bearer ${_session?.access_token || SUPABASE_ANON}`,
    ...extra
  };
  return h;
}

async function sbFetch(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: sbHeaders(opts.headers || {}),
    ...opts
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error_description || `Supabase error ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ── Auth ──────────────────────────────────────────────────────

async function sbSignUp(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || 'Sign up failed');
  return data;
}

async function sbSignIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || 'Sign in failed');
  _session = data;
  localStorage.setItem('ts_session', JSON.stringify(data));
  return data;
}

async function sbSignOut() {
  await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
    method: 'POST',
    headers: sbHeaders()
  }).catch(() => {});
  _session = null;
  localStorage.removeItem('ts_session');
}

async function sbRefreshSession(refreshToken) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON },
    body: JSON.stringify({ refresh_token: refreshToken })
  });
  const data = await res.json();
  if (!res.ok) throw new Error('Session expired');
  _session = data;
  localStorage.setItem('ts_session', JSON.stringify(data));
  return data;
}

async function sbGetSession() {
  // Try stored session
  const stored = localStorage.getItem('ts_session');
  if (!stored) return null;
  try {
    const sess = JSON.parse(stored);
    // Check if expired (with 60s buffer)
    const expiresAt = (sess.created_at || 0) + (sess.expires_in || 3600) - 60;
    if (Date.now() / 1000 > expiresAt && sess.refresh_token) {
      return await sbRefreshSession(sess.refresh_token);
    }
    _session = sess;
    return sess;
  } catch {
    return null;
  }
}

function sbUser() { return _session?.user || null; }

// ── Data helpers ─────────────────────────────────────────────

// Settings
async function dbGetSettings() {
  try {
    const rows = await sbFetch('settings?select=*&limit=1');
    if (!rows || !rows.length) return { name:'', dailyGoalMins:120, sessionLengthMins:25 };
    const r = rows[0];
    return { name: r.name||'', dailyGoalMins: r.daily_goal_mins||120, sessionLengthMins: r.session_length_mins||25 };
  } catch { return { name:'', dailyGoalMins:120, sessionLengthMins:25 }; }
}

async function dbSaveSettings(s) {
  const uid = sbUser()?.id;
  if (!uid) return;
  await sbFetch('settings', {
    method: 'POST',
    headers: { 'Prefer': 'resolution=merge-duplicates' },
    body: JSON.stringify({ user_id: uid, name: s.name, daily_goal_mins: s.dailyGoalMins, session_length_mins: s.sessionLengthMins, updated_at: new Date().toISOString() })
  });
}

// Categories
async function dbGetCategories() {
  try {
    const rows = await sbFetch('categories?select=*&order=cat_id');
    if (!rows || !rows.length) return null;
    return rows.map(r => ({ id: r.cat_id, label: r.label, color: r.color, locked: r.locked }));
  } catch { return null; }
}

async function dbSaveCategories(cats) {
  const uid = sbUser()?.id;
  if (!uid) return;
  // Upsert all
  const rows = cats.map(c => ({ user_id: uid, cat_id: c.id, label: c.label, color: c.color, locked: !!c.locked, updated_at: new Date().toISOString() }));
  await sbFetch('categories', {
    method: 'POST',
    headers: { 'Prefer': 'resolution=merge-duplicates' },
    body: JSON.stringify(rows)
  });
}

// Todos
async function dbGetTodos() {
  try {
    const rows = await sbFetch('todos?select=*&order=created_at');
    if (!rows) return [];
    return rows.map(r => ({ id: r.item_id, title: r.title, catId: r.cat_id, dueDate: r.due_date, completed: r.completed, completedDate: r.completed_date, sessions: r.sessions||[], source: r.source, emailId: r.email_id, createdAt: new Date(r.created_at).getTime() }));
  } catch { return []; }
}

async function dbSaveTodo(item) {
  const uid = sbUser()?.id;
  if (!uid) return;
  await sbFetch('todos', {
    method: 'POST',
    headers: { 'Prefer': 'resolution=merge-duplicates' },
    body: JSON.stringify({ user_id: uid, item_id: item.id, title: item.title, cat_id: item.catId, due_date: item.dueDate||null, completed: item.completed, completed_date: item.completedDate||null, sessions: item.sessions||[], source: item.source||'manual', email_id: item.emailId||null, updated_at: new Date().toISOString() })
  });
}

async function dbSaveTodos(items) {
  const uid = sbUser()?.id;
  if (!uid) return;
  if (!items.length) return;
  const rows = items.map(item => ({ user_id: uid, item_id: item.id, title: item.title, cat_id: item.catId, due_date: item.dueDate||null, completed: item.completed, completed_date: item.completedDate||null, sessions: item.sessions||[], source: item.source||'manual', email_id: item.emailId||null, updated_at: new Date().toISOString() }));
  await sbFetch('todos', {
    method: 'POST',
    headers: { 'Prefer': 'resolution=merge-duplicates' },
    body: JSON.stringify(rows)
  });
}

async function dbDeleteTodo(itemId) {
  await sbFetch(`todos?item_id=eq.${itemId}`, { method: 'DELETE' });
}

// Manual tasks
async function dbGetManualTasks() {
  try {
    const rows = await sbFetch('manual_tasks?select=*&order=created_at');
    if (!rows) return [];
    return rows.map(r => ({ id: r.task_id, title: r.title, catId: r.cat_id, date: r.date, startTime: r.start_time, endTime: r.end_time, duration: r.duration, notes: r.notes, createdAt: new Date(r.created_at).getTime() }));
  } catch { return []; }
}

async function dbSaveManualTask(task) {
  const uid = sbUser()?.id;
  if (!uid) return;
  await sbFetch('manual_tasks', {
    method: 'POST',
    headers: { 'Prefer': 'resolution=merge-duplicates' },
    body: JSON.stringify({ user_id: uid, task_id: task.id, title: task.title, cat_id: task.catId, date: task.date, start_time: task.startTime||null, end_time: task.endTime||null, duration: task.duration||0, notes: task.notes||'' })
  });
}

async function dbDeleteManualTask(taskId) {
  await sbFetch(`manual_tasks?task_id=eq.${taskId}`, { method: 'DELETE' });
}

// Habits
async function dbGetHabits() {
  try {
    const rows = await sbFetch('habits?select=*&order=created_at');
    if (!rows) return [];
    return rows.map(r => ({ id: r.habit_id, name: r.name, emoji: r.emoji, colour: r.colour, frequency: r.frequency, timesPerWeek: r.times_per_week, groupId: r.group_id, createdAt: new Date(r.created_at).getTime() }));
  } catch { return []; }
}

async function dbSaveHabits(habits) {
  const uid = sbUser()?.id;
  if (!uid) return;
  if (!habits.length) return;
  const rows = habits.map(h => ({ user_id: uid, habit_id: h.id, name: h.name, emoji: h.emoji||'🌟', colour: h.colour||'#6B9E4E', frequency: h.frequency||'daily', times_per_week: h.timesPerWeek||1, group_id: h.groupId||'other' }));
  await sbFetch('habits', {
    method: 'POST',
    headers: { 'Prefer': 'resolution=merge-duplicates' },
    body: JSON.stringify(rows)
  });
}

async function dbDeleteHabit(habitId) {
  await sbFetch(`habits?habit_id=eq.${habitId}`, { method: 'DELETE' });
  await sbFetch(`habit_logs?habit_id=eq.${habitId}`, { method: 'DELETE' });
}

// Habit logs
async function dbGetHabitLogs() {
  try {
    const rows = await sbFetch('habit_logs?select=*');
    if (!rows) return {};
    const logs = {};
    rows.forEach(r => { if(!logs[r.habit_id]) logs[r.habit_id]={}; logs[r.habit_id][r.date]=true; });
    return logs;
  } catch { return {}; }
}

async function dbToggleHabitLog(habitId, date, isDone) {
  const uid = sbUser()?.id;
  if (!uid) return;
  if (isDone) {
    await sbFetch('habit_logs', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=ignore-duplicates' },
      body: JSON.stringify({ user_id: uid, habit_id: habitId, date })
    });
  } else {
    await sbFetch(`habit_logs?habit_id=eq.${habitId}&date=eq.${date}&user_id=eq.${uid}`, { method: 'DELETE' });
  }
}


// ============================================================
// Time Sloth — Supabase Auth + Data Layer
// ============================================================

const SUPABASE_URL  = 'https://sktwubhqkbrqmhreqmlt.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNrdHd1Ymhxa2JycW1ocmVxbWx0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4Mjk0NzAsImV4cCI6MjA5NjQwNTQ3MH0.SjTh3xXVy8CufVxJoMtxC7z7IskmhDFjwH_z1hMj-Zg';

let _session = null;

// ── Core fetch helper ─────────────────────────────────────────
async function sbFetch(path, method, body, extra) {
  const token = (_session && _session.access_token) ? _session.access_token : SUPABASE_ANON;
  const headers = {
    'apikey': SUPABASE_ANON,
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json',
  };
  if (extra) Object.assign(headers, extra);
  const opts = { method: method || 'GET', headers };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(SUPABASE_URL + '/rest/v1/' + path, opts);
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error_description || 'Supabase error ' + res.status);
  return data;
}

async function sbAuth(path, body) {
  const res = await fetch(SUPABASE_URL + '/auth/v1/' + path, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || data.message || 'Auth error');
  return data;
}

// ── Auth ──────────────────────────────────────────────────────
async function sbSignUp(email, password) {
  return sbAuth('signup', { email, password });
}

async function sbSignIn(email, password) {
  const data = await sbAuth('token?grant_type=password', { email, password });
  _session = data;
  localStorage.setItem('ts_session', JSON.stringify(data));
  return data;
}

async function sbSignOut() {
  try {
    await fetch(SUPABASE_URL + '/auth/v1/logout', {
      method: 'POST',
      headers: { 'apikey': SUPABASE_ANON, 'Authorization': 'Bearer ' + (_session?.access_token || '') }
    });
  } catch {}
  _session = null;
  localStorage.removeItem('ts_session');
}

async function sbGetSession() {
  const stored = localStorage.getItem('ts_session');
  if (!stored) return null;
  try {
    const sess = JSON.parse(stored);
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = (sess.created_at || 0) + (sess.expires_in || 3600) - 60;
    if (now > expiresAt && sess.refresh_token) {
      const data = await sbAuth('token?grant_type=refresh_token', { refresh_token: sess.refresh_token });
      _session = data;
      localStorage.setItem('ts_session', JSON.stringify(data));
      return data;
    }
    _session = sess;
    return sess;
  } catch { return null; }
}

function sbUser() { return _session ? _session.user : null; }

// ── Settings ──────────────────────────────────────────────────
async function dbGetSettings() {
  try {
    const rows = await sbFetch('settings?select=*&limit=1');
    if (!rows || !rows.length) return { name:'', dailyGoalMins:120, sessionLengthMins:25 };
    const r = rows[0];
    return { name: r.name||'', dailyGoalMins: r.daily_goal_mins||120, sessionLengthMins: r.session_length_mins||25 };
  } catch(e) { console.warn('getSettings:', e); return { name:'', dailyGoalMins:120, sessionLengthMins:25 }; }
}

async function dbSaveSettings(s) {
  const uid = sbUser()?.id;
  if (!uid) return;
  await sbFetch('settings', 'POST',
    { user_id:uid, name:s.name, daily_goal_mins:s.dailyGoalMins, session_length_mins:s.sessionLengthMins, updated_at:new Date().toISOString() },
    { 'Prefer': 'resolution=merge-duplicates' }
  );
}

// ── Categories ────────────────────────────────────────────────
async function dbGetCategories() {
  try {
    const rows = await sbFetch('categories?select=*&order=cat_id');
    if (!rows || !rows.length) return null;
    return rows.map(r => ({ id:r.cat_id, label:r.label, color:r.color, locked:r.locked }));
  } catch(e) { console.warn('getCategories:', e); return null; }
}

async function dbSaveCategories(cats) {
  const uid = sbUser()?.id;
  if (!uid) return;
  const rows = cats.map(c => ({ user_id:uid, cat_id:c.id, label:c.label, color:c.color, locked:!!c.locked, updated_at:new Date().toISOString() }));
  await sbFetch('categories', 'POST', rows, { 'Prefer': 'resolution=merge-duplicates' });
}

// ── Todos ─────────────────────────────────────────────────────
async function dbGetTodos() {
  try {
    const rows = await sbFetch('todos?select=*&order=created_at');
    if (!rows) return [];
    return rows.map(r => ({ id:r.item_id, title:r.title, catId:r.cat_id, dueDate:r.due_date, completed:r.completed, completedDate:r.completed_date, sessions:r.sessions||[], source:r.source, emailId:r.email_id, createdAt:new Date(r.created_at).getTime() }));
  } catch(e) { console.warn('getTodos:', e); return []; }
}

async function dbSaveTodos(items) {
  const uid = sbUser()?.id;
  if (!uid || !items.length) return;
  const rows = items.map(item => ({ user_id:uid, item_id:item.id, title:item.title, cat_id:item.catId, due_date:item.dueDate||null, completed:!!item.completed, completed_date:item.completedDate||null, sessions:item.sessions||[], source:item.source||'manual', email_id:item.emailId||null, updated_at:new Date().toISOString() }));
  await sbFetch('todos', 'POST', rows, { 'Prefer': 'resolution=merge-duplicates' });
}

async function dbDeleteTodo(itemId) {
  await sbFetch('todos?item_id=eq.' + encodeURIComponent(itemId), 'DELETE');
}

// ── Manual Tasks ──────────────────────────────────────────────
async function dbGetManualTasks() {
  try {
    const rows = await sbFetch('manual_tasks?select=*&order=created_at');
    if (!rows) return [];
    return rows.map(r => ({ id:r.task_id, title:r.title, catId:r.cat_id, date:r.date, startTime:r.start_time, endTime:r.end_time, duration:r.duration, notes:r.notes, createdAt:new Date(r.created_at).getTime() }));
  } catch(e) { console.warn('getManualTasks:', e); return []; }
}

async function dbSaveManualTask(task) {
  const uid = sbUser()?.id;
  if (!uid) return;
  await sbFetch('manual_tasks', 'POST',
    { user_id:uid, task_id:task.id, title:task.title, cat_id:task.catId, date:task.date, start_time:task.startTime||null, end_time:task.endTime||null, duration:task.duration||0, notes:task.notes||'' },
    { 'Prefer': 'resolution=merge-duplicates' }
  );
}

async function dbDeleteManualTask(taskId) {
  await sbFetch('manual_tasks?task_id=eq.' + encodeURIComponent(taskId), 'DELETE');
}

// ── Habits ────────────────────────────────────────────────────
async function dbGetHabits() {
  try {
    const rows = await sbFetch('habits?select=*&order=created_at');
    if (!rows) return [];
    return rows.map(r => ({ id:r.habit_id, name:r.name, emoji:r.emoji, colour:r.colour, frequency:r.frequency, timesPerWeek:r.times_per_week, groupId:r.group_id, createdAt:new Date(r.created_at).getTime() }));
  } catch(e) { console.warn('getHabits:', e); return []; }
}

async function dbSaveHabits(habits) {
  const uid = sbUser()?.id;
  if (!uid || !habits.length) return;
  const rows = habits.map(h => ({ user_id:uid, habit_id:h.id, name:h.name, emoji:h.emoji||'🌟', colour:h.colour||'#6B9E4E', frequency:h.frequency||'daily', times_per_week:h.timesPerWeek||1, group_id:h.groupId||'other' }));
  await sbFetch('habits', 'POST', rows, { 'Prefer': 'resolution=merge-duplicates' });
}

async function dbDeleteHabit(habitId) {
  await sbFetch('habits?habit_id=eq.' + encodeURIComponent(habitId), 'DELETE');
  await sbFetch('habit_logs?habit_id=eq.' + encodeURIComponent(habitId), 'DELETE');
}

// ── Habit Logs ────────────────────────────────────────────────
async function dbGetHabitLogs() {
  try {
    const rows = await sbFetch('habit_logs?select=*');
    if (!rows) return {};
    const logs = {};
    rows.forEach(r => { if(!logs[r.habit_id]) logs[r.habit_id]={}; logs[r.habit_id][r.date]=true; });
    return logs;
  } catch(e) { console.warn('getHabitLogs:', e); return {}; }
}

async function dbToggleHabitLog(habitId, date, isDone) {
  const uid = sbUser()?.id;
  if (!uid) return;
  if (isDone) {
    await sbFetch('habit_logs', 'POST',
      { user_id:uid, habit_id:habitId, date },
      { 'Prefer': 'resolution=ignore-duplicates' }
    );
  } else {
    await sbFetch('habit_logs?habit_id=eq.' + encodeURIComponent(habitId) + '&date=eq.' + date + '&user_id=eq.' + uid, 'DELETE');
  }
}

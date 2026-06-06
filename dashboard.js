// ============================================================
// Time Sloth Web — dashboard.js
// ============================================================

// ─── localStorage shim ───────────────────────────────────────
const store = {
  async get(keys) {
    const result = {};
    const kl = Array.isArray(keys) ? keys : [keys];
    for (const k of kl) { try { const r = localStorage.getItem('st_'+k); result[k] = r !== null ? JSON.parse(r) : undefined; } catch { result[k] = undefined; } }
    return result;
  },
  async set(obj) { for (const [k,v] of Object.entries(obj)) { try { localStorage.setItem('st_'+k, JSON.stringify(v)); } catch {} } },
  async remove(keys) { const kl = Array.isArray(keys) ? keys : [keys]; for (const k of kl) localStorage.removeItem('st_'+k); },
  async clear() { const r=[]; for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith('st_'))r.push(k);} r.forEach(k=>localStorage.removeItem(k)); }
};

// ─── Constants ───────────────────────────────────────────────
const DEFAULT_CATEGORIES = [
  { id:'uncategorised', label:'Uncategorised', color:'#6B7280', locked:true },
  { id:'client-work',   label:'Client Work',   color:'#6B9E4E' },
  { id:'admin',         label:'Admin',          color:'#818cf8' },
  { id:'comms',         label:'Comms',          color:'#f59e0b' },
  { id:'research',      label:'Research',       color:'#38bdf8' },
  { id:'meetings',      label:'Meetings',       color:'#f472b6' },
  { id:'personal',      label:'Personal',       color:'#f87171' },
];
const PALETTE = ['#6B9E4E','#818cf8','#f59e0b','#38bdf8','#f472b6','#a78bfa','#34d399','#60a5fa','#fb923c','#e879f9','#4ade80','#f87171','#facc15','#94a3b8','#fb7185'];
let CATEGORIES = [...DEFAULT_CATEGORIES];

const QUOTES = [
  '"Slow and steady focus."','"One session at a time."','"Consistency beats intensity."',
  '"Small steps, big results."','"Progress, not perfection."','"Every minute counts."',
  '"Build momentum gently."','"Depth over speed."','"Show up. Do the work."','"Rest is part of progress."'
];

// ─── Progression System ──────────────────────────────────────
const STAGES = [
  { name:'🌱 Seedling',      minMins:0,    nextMins:60,   msg:'Plant your first seed of focus.' },
  { name:'🌿 Young Tree',    minMins:60,   nextMins:180,  msg:'You\'re growing steadily.' },
  { name:'🌲 Growing Tree',  minMins:180,  nextMins:420,  msg:'Your roots are deepening.' },
  { name:'🌳 Large Tree',    minMins:420,  nextMins:840,  msg:'Remarkable consistency.' },
  { name:'🏡 Treehouse',     minMins:840,  nextMins:1680, msg:'Your sloth has a home!' },
  { name:'🌲🌳🌿 Forest',   minMins:1680, nextMins:null, msg:'You\'ve built a whole forest.' },
];

function getStage(totalMins) {
  for (let i = STAGES.length-1; i >= 0; i--) { if (totalMins >= STAGES[i].minMins) return { ...STAGES[i], idx: i }; }
  return { ...STAGES[0], idx: 0 };
}

function calcStreak(manualTasks) {
  const today = getTodayKey();
  const daySet = new Set(manualTasks.map(t => t.date));
  let streak = 0, d = new Date();
  // count today too
  for (let i = 0; i < 365; i++) {
    const key = localKey(d);
    if (daySet.has(key)) { streak++; d.setDate(d.getDate()-1); }
    else if (i === 0) { d.setDate(d.getDate()-1); } // today empty is ok, check yesterday
    else break;
  }
  return streak;
}

// ─── Utilities ───────────────────────────────────────────────
function fmtSecs(s) { const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),ss=s%60; if(h>0)return`${h}h ${m}m`; if(m>0)return`${m}m ${ss}s`; return`${ss}s`; }
function fmtMins(m) { if(m>=60){const h=Math.floor(m/60),rm=m%60;return rm>0?`${h}h ${rm}m`:`${h}h`;} return`${m}m`; }
function fmtTimer(s) { const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),ss=s%60; if(h>0)return`${h}:${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`; return`${m}:${String(ss).padStart(2,'0')}`; }
function uid() { return 'id_'+Math.random().toString(36).slice(2,9); }
function localKey(d) { return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function getTodayKey() { return localKey(new Date()); }
function getDateRange(range) {
  const today=new Date(),keys=[];
  if(range==='today'){keys.push(getTodayKey());}
  else if(range==='week'){for(let i=6;i>=0;i--){const d=new Date(today);d.setDate(d.getDate()-i);keys.push(localKey(d));}}
  else if(range==='month'){for(let i=29;i>=0;i--){const d=new Date(today);d.setDate(d.getDate()-i);keys.push(localKey(d));}}
  return keys;
}
function getCat(id) { return CATEGORIES.find(c=>c.id===id)||CATEGORIES[0]; }
function aggregateLogs(logs,dateKeys) { const t={};for(const k of dateKeys)for(const[d,s]of Object.entries(logs[k]||{}))t[d]=(t[d]||0)+s; return t; }

// ─── Settings ────────────────────────────────────────────────
async function getSettings() {
  const r = await store.get('settings');
  return r.settings || { name: '', dailyGoalMins: 120, sessionLengthMins: 25 };
}
async function saveSettings(s) { await store.set({ settings: s }); }

// ─── Storage helpers ─────────────────────────────────────────
async function getData() { return store.get(['logs','domainCategories','sessions','categories','manualTasks','todoItems']); }
async function loadCategories() { const r=await store.get('categories');CATEGORIES=(r.categories&&r.categories.length)?r.categories:[...DEFAULT_CATEGORIES];if(!r.categories)await store.set({categories:CATEGORIES}); }
async function saveCategories() { await store.set({categories:CATEGORIES}); }
async function getManualTasks() { const r=await store.get('manualTasks');return r.manualTasks||[]; }
async function saveManualTask(task) { const t=await getManualTasks();t.push(task);await store.set({manualTasks:t}); }
async function deleteManualTask(id) { const t=await getManualTasks();await store.set({manualTasks:t.filter(x=>x.id!==id)}); }
async function getTodoItems() { const r=await store.get('todoItems');return r.todoItems||[]; }
async function saveTodoItems(items) { await store.set({todoItems:items}); }

// ─── Sloth Images ────────────────────────────────────────────
const SLOTH_IMGS = {
  idle:      'sloth-idle.png',
  active:    'sloth-active.png',
  celebrate: 'sloth-celebrate.png',
};

function setSloth(wrapperId, state, size) {
  const el = document.getElementById(wrapperId);
  if (!el) return;
  const src = SLOTH_IMGS[state] || SLOTH_IMGS.idle;
  const animClass = state==='idle'?'sloth-idle':state==='active'?'sloth-active':'sloth-celebrate';
  // Image is portrait (tall) so we fix height and let width be auto
  el.innerHTML = `<img src="${src}" style="height:${size}px;width:auto;display:block;object-fit:contain;" class="${animClass}" alt="Time Sloth">`;
}

// ─── Active Task & Focus Screen ──────────────────────────────
let activeTask = null;
let timerInterval = null;
let focusScreenOpen = false;
let focusSessionCount = 0;

async function loadActiveTask() {
  const r = await store.get('activeTask');
  activeTask = r.activeTask || null;
  updateBanner();
  if (activeTask) startTimerTick();
}
async function saveActiveTask() { await store.set({activeTask}); }

function updateBanner() {
  const allIdle = !activeTask;
  setSloth('heroSlothWrap', allIdle ? 'idle' : 'active', 180);
  setSloth('companionSlothWrap', allIdle ? 'idle' : 'active', 140);
  const banner = document.getElementById('activeTaskBanner');
  if (!activeTask) { banner.classList.remove('visible'); return; }
  banner.classList.add('visible');
  document.getElementById('bannerTaskName').textContent = activeTask.title;
  updateBannerTime();
}

function updateBannerTime() {
  if (!activeTask) return;
  const elapsed = Math.round((Date.now() - activeTask.startTime) / 1000);
  document.getElementById('bannerTimer').textContent = fmtTimer(elapsed);
  // Also update focus screen if open
  if (focusScreenOpen) {
    document.getElementById('focusTimerDisplay').textContent = fmtTimer(elapsed);
    // Progress toward session goal
    const settings = _cachedSettings || { sessionLengthMins: 25 };
    const goalSecs = (settings.sessionLengthMins || 25) * 60;
    const pct = Math.min(100, (elapsed / goalSecs) * 100);
    document.getElementById('focusProgressFill').style.width = pct + '%';
  }
}

function startTimerTick() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(updateBannerTime, 1000);
}

let _cachedSettings = null;

async function startTask(todoId) {
  if (activeTask) await stopTask(false);
  const items = await getTodoItems();
  const item = items.find(i => i.id === todoId);
  if (!item) return;
  activeTask = { id: todoId, title: item.title, catId: item.catId, startTime: Date.now() };
  await saveActiveTask();
  updateBanner();
  startTimerTick();
  renderTodo();
  openFocusScreen(item.title);
}

async function stopTask(log=true) {
  if (!activeTask) return;
  if (log) {
    const duration = Math.round((Date.now() - activeTask.startTime) / 1000);
    if (duration >= 5) {
      const now = new Date(activeTask.startTime);
      const startTime = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
      await saveManualTask({ id:uid(), title:activeTask.title, catId:activeTask.catId, date:localKey(now), startTime, duration, notes:'via To-Do timer', createdAt:Date.now() });
      focusSessionCount++;
    }
  }
  activeTask = null;
  await store.remove('activeTask');
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  closeFocusScreen();
  // Celebrate
  setSloth('heroSlothWrap', 'celebrate', 180);
  setSloth('companionSlothWrap', 'celebrate', 140);
  setTimeout(() => {
    setSloth('heroSlothWrap', 'idle', 180);
    setSloth('companionSlothWrap', 'idle', 140);
  }, 2500);
  updateBanner();
  renderTodo();
  // Refresh overview if visible
  const active = document.querySelector('.nav-item.active')?.getAttribute('data-section');
  if (active === 'overview') renderOverview();
}

// ─── Focus Screen ─────────────────────────────────────────────
function openFocusScreen(taskName) {
  focusScreenOpen = true;
  document.getElementById('focusScreen').classList.add('visible');
  document.getElementById('focusTaskName').textContent = taskName || 'Focus Session';
  document.getElementById('focusSessionNum').textContent = focusSessionCount + 1;
  document.getElementById('focusProgressFill').style.width = '0%';
  setSloth('focusSlothWrap', 'active', 200);
  const q = QUOTES[Math.floor(Math.random()*QUOTES.length)];
  document.getElementById('focusQuote').textContent = q;
}

function closeFocusScreen() {
  focusScreenOpen = false;
  document.getElementById('focusScreen').classList.remove('visible');
}

document.getElementById('focusDoneBtn').addEventListener('click', () => stopTask(true));
document.getElementById('focusCancelBtn').addEventListener('click', async () => {
  await stopTask(false);
});
document.getElementById('bannerStopBtn').addEventListener('click', () => stopTask(true));

// Hero buttons
document.getElementById('heroFocusBtn').addEventListener('click', async () => {
  // Open to-do to pick a task, or start a generic session
  const items = await getTodoItems();
  const pending = items.filter(i => !i.completed && i.source !== 'flagged');
  if (pending.length > 0) {
    showSection('todo');
  } else {
    showSection('todo');
  }
});
document.getElementById('heroLogBtn').addEventListener('click', () => showSection('timeline'));

// ─── Sidebar ─────────────────────────────────────────────────
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const sidebarOverlay = document.getElementById('sidebarOverlay');

let sidebarCollapsed = localStorage.getItem('st_sidebarCollapsed') === '1';
if (sidebarCollapsed) { sidebar.classList.add('collapsed'); sidebarToggle.textContent = '›'; }

sidebarToggle.addEventListener('click', () => {
  sidebarCollapsed = !sidebarCollapsed;
  sidebar.classList.toggle('collapsed', sidebarCollapsed);
  sidebarToggle.textContent = sidebarCollapsed ? '›' : '‹';
  localStorage.setItem('st_sidebarCollapsed', sidebarCollapsed ? '1' : '0');
});
mobileMenuBtn.addEventListener('click', () => { sidebar.classList.add('mobile-open'); sidebarOverlay.classList.add('visible'); });
sidebarOverlay.addEventListener('click', () => { sidebar.classList.remove('mobile-open'); sidebarOverlay.classList.remove('visible'); });
document.querySelectorAll('.nav-item').forEach(el => {
  el.addEventListener('click', () => {
    if (window.innerWidth <= 768) { sidebar.classList.remove('mobile-open'); sidebarOverlay.classList.remove('visible'); }
  });
});

// ─── Momentum Line Chart ──────────────────────────────────────
function drawLineChart(canvasId, labels, data, todayIdx) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.offsetWidth||300, H = canvas.offsetHeight||180;
  canvas.width = W*devicePixelRatio; canvas.height = H*devicePixelRatio;
  ctx.scale(devicePixelRatio, devicePixelRatio);
  ctx.clearRect(0,0,W,H);

  const padL=36, padR=16, padT=12, padB=36;
  const chartW=W-padL-padR, chartH=H-padT-padB;
  const maxVal = Math.max(...data, 1);
  const pts = data.map((v,i) => ({ x: padL + (i/(data.length-1))*chartW, y: padT + chartH - (v/maxVal)*chartH }));

  // Grid
  ctx.strokeStyle='#EDE8E0'; ctx.lineWidth=1;
  for (let i=0; i<=3; i++) {
    const y = padT + (i/3)*chartH;
    ctx.beginPath(); ctx.moveTo(padL,y); ctx.lineTo(padL+chartW,y); ctx.stroke();
    ctx.fillStyle='#9CA3AF'; ctx.font='10px Inter,sans-serif'; ctx.textAlign='right';
    ctx.fillText(Math.round(((3-i)/3)*maxVal)+'m', padL-4, y+3);
  }

  // Area fill
  ctx.beginPath();
  ctx.moveTo(pts[0].x, padT+chartH);
  pts.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.lineTo(pts[pts.length-1].x, padT+chartH);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, padT, 0, padT+chartH);
  grad.addColorStop(0, 'rgba(107,158,78,0.18)');
  grad.addColorStop(1, 'rgba(107,158,78,0.01)');
  ctx.fillStyle = grad;
  ctx.fill();

  // Line
  ctx.beginPath();
  pts.forEach((p,i) => i===0 ? ctx.moveTo(p.x,p.y) : ctx.lineTo(p.x,p.y));
  ctx.strokeStyle='#6B9E4E'; ctx.lineWidth=2.5; ctx.lineJoin='round'; ctx.stroke();

  // Dots
  pts.forEach((p,i) => {
    const isToday = i===todayIdx;
    ctx.beginPath(); ctx.arc(p.x, p.y, isToday?5:3.5, 0, Math.PI*2);
    ctx.fillStyle = isToday ? '#E8A020' : '#6B9E4E'; ctx.fill();
    if (isToday) { ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.stroke(); }
    ctx.fillStyle='#6B7280'; ctx.font=`${isToday?'700':'400'} 10px Inter,sans-serif`;
    ctx.textAlign='center'; ctx.fillText(labels[i], p.x, H-padB+14);
    if (data[i]>0) { ctx.fillStyle=isToday?'#E8A020':'#6B9E4E'; ctx.font='bold 9px Inter,sans-serif'; ctx.fillText(data[i]+'m', p.x, p.y-8); }
  });
}

// ─── Category Cards ───────────────────────────────────────────
function renderCatCards(catTotals, container) {
  const cats = CATEGORIES.filter(c=>catTotals[c.id]>0).sort((a,b)=>(catTotals[b.id]||0)-(catTotals[a.id]||0));
  const total = Object.values(catTotals).reduce((a,b)=>a+b,0)||1;
  if (!cats.length) {
    container.innerHTML=`<div class="cat-empty"><div class="cat-empty-icon">🌿</div><div>No focus sessions logged yet.<br>Your sloth is waiting for its first climb.</div></div>`;
    return;
  }
  container.innerHTML=`<div class="cat-cards-grid">${cats.map(cat=>{
    const secs=catTotals[cat.id]||0, pct=Math.round((secs/total)*100);
    return`<div class="cat-card">
      <div class="cat-card-dot" style="background:${cat.color}"></div>
      <div class="cat-card-info">
        <div class="cat-card-name">${cat.label}</div>
        <div class="cat-card-bar-wrap"><div class="cat-card-bar" style="width:${pct}%;background:${cat.color}"></div></div>
      </div>
      <div class="cat-card-time">${fmtSecs(secs)}</div>
      <div class="cat-card-pct">${pct}%</div>
    </div>`;
  }).join('')}</div>`;
}

// ─── Overview ────────────────────────────────────────────────
let currentRange = 'today';

async function renderOverview() {
  const settings = await getSettings();
  _cachedSettings = settings;
  const { logs, domainCategories, manualTasks } = await getData();
  const dc = domainCategories||{};
  const dateKeys = getDateRange(currentRange);
  const totals = aggregateLogs(logs||{}, dateKeys);
  const entries = Object.entries(totals).sort((a,b)=>b[1]-a[1]);
  const tasksInRange = (manualTasks||[]).filter(t=>dateKeys.includes(t.date));
  const totalSecs = entries.reduce((s,[,v])=>s+v,0) + tasksInRange.reduce((s,t)=>s+t.duration,0);
  const totalMins = Math.round(totalSecs/60);

  const allTasks = manualTasks||[];
  const todayKey = getTodayKey();
  const todayMins = Math.round(
    (allTasks.filter(t=>t.date===todayKey).reduce((s,t)=>s+t.duration,0)) / 60
  );
  const todaySessionsCount = allTasks.filter(t=>t.date===todayKey).length;
  const streak = calcStreak(allTasks);
  const totalAllTimeMins = Math.round(allTasks.reduce((s,t)=>s+t.duration,0)/60);
  const stage = getStage(totalAllTimeMins);
  const goalMins = settings.dailyGoalMins || 120;
  const goalPct = Math.min(100, Math.round((todayMins/goalMins)*100));

  // Hero
  const hour = new Date().getHours();
  const name = settings.name ? `, ${settings.name}` : '';
  document.getElementById('overviewGreet').textContent = (hour<12?'Good morning':hour<17?'Good afternoon':'Good evening') + name + ' 👋';

  document.getElementById('heroStageBadge').textContent = stage.name;
  document.getElementById('heroFocusTime').textContent = fmtMins(todayMins);
  document.getElementById('heroStreak').textContent = streak;
  document.getElementById('heroSessions').textContent = todaySessionsCount;
  document.getElementById('heroGoalNums').textContent = `${todayMins} / ${goalMins} min`;
  document.getElementById('heroGoalFill').style.width = goalPct + '%';

  let goalMsg;
  if (todayMins === 0) goalMsg = 'Start a focus session to begin your journey.';
  else if (goalPct >= 100) goalMsg = '🎉 Daily goal complete! Your sloth is proud.';
  else if (goalPct >= 75) goalMsg = `Almost there! ${goalMins - todayMins} minutes to go.`;
  else if (goalPct >= 50) goalMsg = `Great progress — you're over halfway!`;
  else goalMsg = `${goalMins - todayMins} minutes remaining to reach your goal.`;
  document.getElementById('heroGoalMessage').textContent = goalMsg;

  let heroSub;
  if (todayMins === 0) heroSub = 'Your sloth is waiting for its first climb today.';
  else heroSub = `Your sloth is resting on ${stage.name}. ${stage.msg}`;
  document.getElementById('heroSub').textContent = heroSub;

  // Streak sidebar
  const streakEl = document.getElementById('streakText');
  if (streakEl) streakEl.textContent = streak > 0 ? `🔥 ${streak} day streak` : 'Keep it consistent';

  // Stat cards
  document.getElementById('statTotal').textContent = fmtMins(currentRange==='today' ? todayMins : totalMins);
  document.getElementById('statTotalSub').textContent = `of ${goalMins} min goal`;
  document.getElementById('statStreak').textContent = `${streak} day${streak!==1?'s':''}`;
  document.getElementById('statSessions').textContent = currentRange==='today' ? todaySessionsCount : tasksInRange.length;

  // Milestone card
  const nextStage = STAGES[stage.idx+1];
  if (nextStage) {
    const remaining = nextStage.minMins - totalAllTimeMins;
    document.getElementById('statMilestone').textContent = nextStage.name;
    document.getElementById('statMilestoneSub').textContent = `${remaining}m to unlock`;
  } else {
    document.getElementById('statMilestone').textContent = '🌲🌳🌿';
    document.getElementById('statMilestoneSub').textContent = 'Forest achieved!';
  }

  // Category cards
  const catTotals = {};
  for (const [d,s] of entries) { const c=dc[d]||'uncategorised'; catTotals[c]=(catTotals[c]||0)+s; }
  for (const t of tasksInRange) { catTotals[t.catId]=(catTotals[t.catId]||0)+t.duration; }
  renderCatCards(catTotals, document.getElementById('catCardsContainer'));

  // Line chart
  const wk = getDateRange('week');
  const bLabels = wk.map(k=>{ const d=new Date(k+'T12:00:00'); return d.toLocaleDateString('en-GB',{weekday:'short'}); });
  const bData = wk.map(k=>{ let s=Object.values((logs||{})[k]||{}).reduce((a,b)=>a+b,0); (manualTasks||[]).filter(t=>t.date===k).forEach(t=>s+=t.duration); return Math.round(s/60); });
  requestAnimationFrame(()=>drawLineChart('weekChart', bLabels, bData, wk.indexOf(todayKey)));

  // Companion panel
  updateCompanion(todayMins, goalMins, streak, todaySessionsCount, totalSecs, stage, nextStage, totalAllTimeMins);
}

function updateCompanion(todayMins, goalMins, streak, sessions, totalSecs, stage, nextStage, totalAllTimeMins) {
  const goalPct = Math.min(100, Math.round((todayMins/goalMins)*100));
  document.getElementById('companionStage').textContent = stage.name;
  document.getElementById('companionStatus').textContent = activeTask ? '🧗 Climbing…' : goalPct>=100 ? '🎉 Goal reached!' : '🦥 Resting…';
  document.getElementById('companionGoalDone').textContent = `${todayMins} min`;
  document.getElementById('companionGoalTotal').textContent = `/ ${goalMins} min`;
  document.getElementById('companionGoalFill').style.width = goalPct+'%';
  document.getElementById('companionStreak').textContent = `${streak} day${streak!==1?'s':''}`;
  document.getElementById('companionSessions').textContent = `${sessions} today`;
  document.getElementById('companionTotal').textContent = fmtSecs(totalSecs);
  if (nextStage) {
    const remaining = nextStage.minMins - totalAllTimeMins;
    document.getElementById('companionNext').textContent = `${nextStage.name} — ${remaining}m away`;
  } else {
    document.getElementById('companionNext').textContent = 'Forest achieved! 🌲';
  }
  const q = QUOTES[Math.floor(Date.now()/1000/60) % QUOTES.length];
  document.getElementById('companionQuote').textContent = q;
}

// ─── To-Do ───────────────────────────────────────────────────
function populateTodoCatSelect() {
  const sel = document.getElementById('todoCatSelect');
  if (!sel) return;
  sel.innerHTML = CATEGORIES.filter(c=>c.id!=='uncategorised').map(c=>`<option value="${c.id}">${c.label}</option>`).join('');
}

function getDueBucket(dueDateStr) {
  if (!dueDateStr) return 'later';
  const today = getTodayKey();
  if (dueDateStr < today) return 'overdue';
  if (dueDateStr === today) return 'today';
  const weekEnd = new Date(); weekEnd.setDate(weekEnd.getDate()+6);
  if (dueDateStr <= localKey(weekEnd)) return 'week';
  return 'later';
}

function updateTodoBadge(items) {
  const badge = document.getElementById('todoBadge');
  const overdue = items.filter(i=>!i.completed&&getDueBucket(i.dueDate)==='overdue').length;
  const pending = items.filter(i=>!i.completed&&i.source!=='flagged').length;
  if (overdue>0){badge.textContent=overdue;badge.style.display='';}
  else if(pending>0){badge.textContent=pending;badge.style.display='';}
  else{badge.style.display='none';}
}

async function renderTodo() {
  const items = await getTodoItems();
  updateTodoBadge(items);
  populateTodoCatSelect();
  const groups = {
    overdue:{ label:'⚠️ Overdue', cls:'overdue', items:[] },
    today:  { label:'📅 Today',   cls:'today',   items:[] },
    week:   { label:'📆 This Week',cls:'week',    items:[] },
    later:  { label:'🗓 Later',    cls:'later',   items:[] },
    flagged:{ label:'📧 Flagged Emails', cls:'flagged', items:[] },
  };
  for (const item of items) {
    if (item.source==='flagged'){ groups.flagged.items.push(item); continue; }
    if (item.completed) continue;
    groups[getDueBucket(item.dueDate)].items.push(item);
  }
  const doneToday = items.filter(i=>i.completed&&i.completedDate===getTodayKey());
  const container = document.getElementById('todoGroups');
  container.innerHTML='';
  const collapseKey='st_todoCollapse';
  let cs={};
  try{cs=JSON.parse(localStorage.getItem(collapseKey)||'{}');}catch{}
  ['overdue','today','week','later','flagged'].forEach(gKey=>{
    if(cs[gKey]===undefined)cs[gKey]=true;
    const g=groups[gKey];
    const allItems=gKey==='later'?[...g.items,...doneToday]:g.items;
    const card=document.createElement('div');
    card.className=`card todo-group ${g.cls} ${cs[gKey]?'open':''}`;
    const header=document.createElement('div');
    header.className='todo-group-header';
    header.innerHTML=`<span class="todo-group-title">${g.label}</span><span class="todo-group-count">${allItems.length}</span><span class="todo-group-arrow">›</span>`;
    header.addEventListener('click',()=>{card.classList.toggle('open');cs[gKey]=card.classList.contains('open');localStorage.setItem(collapseKey,JSON.stringify(cs));});
    const body=document.createElement('div');
    body.className='todo-group-body';
    if(!allItems.length){body.innerHTML=`<div class="todo-empty">Nothing here 🎉</div>`;}
    else{allItems.forEach(item=>renderTodoItem(item,body));}
    card.appendChild(header);card.appendChild(body);container.appendChild(card);
  });
}

function renderTodoItem(item, container) {
  const cat=getCat(item.catId),isRunning=activeTask&&activeTask.id===item.id,bucket=getDueBucket(item.dueDate);
  const dueLabel=item.dueDate?(bucket==='overdue'?`⚠️ ${item.dueDate}`:bucket==='today'?'Due today':`Due ${item.dueDate}`):'';
  const div=document.createElement('div');
  div.className=`todo-item${isRunning?' running':''}${item.completed?' completed':''}`;
  div.innerHTML=`<div class="todo-check" data-id="${item.id}">${item.completed?'✓':''}</div>
    <div class="todo-info">
      <div class="todo-title">${item.title}</div>
      <div class="todo-meta">
        <div class="todo-cat-dot" style="background:${cat.color}"></div>
        <span class="todo-cat-label">${cat.label}</span>
        ${dueLabel?`<span class="todo-due ${bucket==='overdue'?'overdue':''}">${dueLabel}</span>`:''}
        ${item.source==='flagged'?'<span class="todo-source">📧 Email</span>':''}
      </div>
    </div>
    <div class="todo-actions">
      ${!item.completed&&item.source!=='flagged'?`<button class="todo-start-btn ${isRunning?'stop':''}" data-id="${item.id}">${isRunning?'■ Stop':'▶ Start'}</button>`:''}
      <button class="todo-del-btn" data-id="${item.id}">✕</button>
    </div>`;
  div.querySelector('.todo-check').addEventListener('click',async()=>{
    const items=await getTodoItems(),idx=items.findIndex(i=>i.id===item.id);if(idx===-1)return;
    if(!items[idx].completed){items[idx].completed=true;items[idx].completedDate=getTodayKey();if(isRunning)await stopTask(true);}
    else{items[idx].completed=false;items[idx].completedDate=null;}
    await saveTodoItems(items);renderTodo();
  });
  div.querySelector('.todo-start-btn')?.addEventListener('click',async()=>{if(isRunning){await stopTask(true);}else{await startTask(item.id);}});
  div.querySelector('.todo-del-btn').addEventListener('click',async()=>{if(!confirm('Delete this task?'))return;if(isRunning)await stopTask(false);const items=await getTodoItems();await saveTodoItems(items.filter(i=>i.id!==item.id));renderTodo();});
  container.appendChild(div);
}

document.getElementById('todoAddBtn').addEventListener('click',async()=>{
  const title=document.getElementById('todoTitleInput').value.trim();
  const catId=document.getElementById('todoCatSelect').value||'uncategorised';
  const dueDate=document.getElementById('todoDateInput').value||null;
  if(!title){document.getElementById('todoTitleInput').focus();return;}
  const items=await getTodoItems();
  items.push({id:uid(),title,catId,dueDate,completed:false,completedDate:null,createdAt:Date.now(),source:'manual'});
  await saveTodoItems(items);
  document.getElementById('todoTitleInput').value='';
  document.getElementById('todoDateInput').value='';
  renderTodo();
});
document.getElementById('todoTitleInput').addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('todoAddBtn').click();});

// ─── Sync flagged emails ──────────────────────────────────────
async function syncFlaggedEmails() {
  if (!(await isOutlookSignedIn())) return;
  try {
    const data = await graph('/me/messages',{$filter:"flag/flagStatus eq 'flagged'",$select:'id,subject,receivedDateTime',$top:'50',$orderby:'receivedDateTime desc'});
    const flagged=data.value||[];const items=await getTodoItems();let changed=false;
    for(const email of flagged){if(!items.find(i=>i.emailId===email.id)){items.push({id:uid(),title:email.subject||'(no subject)',catId:'comms',dueDate:null,completed:false,completedDate:null,createdAt:Date.now(),source:'flagged',emailId:email.id});changed=true;}}
    if(changed){await saveTodoItems(items);renderTodo();}
  } catch(e){console.warn('Flagged sync:',e.message);}
}

// ─── Categories ──────────────────────────────────────────────
async function renderCategories(){
  const{logs,domainCategories,manualTasks}=await getData();const dc=domainCategories||{};
  const totals=aggregateLogs(logs||{},getDateRange('today'));
  const tasksToday=(manualTasks||[]).filter(t=>t.date===getTodayKey());
  const catTotals={},catTasks={};
  for(const[d,s]of Object.entries(totals)){const c=dc[d]||'uncategorised';catTotals[c]=(catTotals[c]||0)+s;}
  for(const t of tasksToday){catTotals[t.catId]=(catTotals[t.catId]||0)+t.duration;catTasks[t.catId]=(catTasks[t.catId]||0)+1;}
  const grid=document.getElementById('catEditorGrid');
  grid.innerHTML=CATEGORIES.map(cat=>`
    <div class="cat-editor-card">
      <div class="cat-card-top">
        <div class="cat-color-swatch" style="background:${cat.color};cursor:${cat.locked?'default':'pointer'}" data-catid="${cat.id}"></div>
        <input class="cat-name-input" value="${cat.label}" data-catid="${cat.id}" ${cat.locked?'disabled':''}>
        ${!cat.locked?`<button class="cat-delete-btn" data-catid="${cat.id}">✕</button>`:''}
      </div>
      <div class="cat-stat" style="color:${cat.color}">${fmtSecs(catTotals[cat.id]||0)}</div>
      <div class="cat-stat-sub">${catTasks[cat.id]||0} task${(catTasks[cat.id]||0)!==1?'s':''} today</div>
    </div>`).join('')+`<div class="cat-add-card" id="addCatBtn"><div class="cat-add-icon">+</div><div class="cat-add-label">New Category</div></div>`;
  grid.querySelectorAll('.cat-name-input').forEach(inp=>{inp.addEventListener('change',async e=>{const cat=CATEGORIES.find(c=>c.id===e.target.getAttribute('data-catid'));if(cat)cat.label=e.target.value.trim()||cat.label;await saveCategories();});});
  grid.querySelectorAll('.cat-color-swatch').forEach(sw=>{sw.addEventListener('click',e=>{const id=e.target.getAttribute('data-catid');if(CATEGORIES.find(c=>c.id===id)?.locked)return;openColorPicker(id,e.target);});});
  grid.querySelectorAll('.cat-delete-btn').forEach(btn=>{btn.addEventListener('click',async e=>{const id=e.target.getAttribute('data-catid');if(!confirm('Delete?'))return;CATEGORIES=CATEGORIES.filter(c=>c.id!==id);await saveCategories();renderCategories();});});
  document.getElementById('addCatBtn').addEventListener('click',async()=>{const used=CATEGORIES.map(c=>c.color);const color=PALETTE.find(p=>!used.includes(p))||PALETTE[0];const nc={id:uid(),label:'New Category',color};CATEGORIES.push(nc);await saveCategories();renderCategories();setTimeout(()=>{const inp=grid.querySelector(`[data-catid="${nc.id}"].cat-name-input`);if(inp)inp.select();},50);});
}
function openColorPicker(catId,anchor){
  document.getElementById('colorPickerPopup')?.remove();
  const popup=document.createElement('div');popup.id='colorPickerPopup';popup.className='color-picker-popup';
  popup.innerHTML=PALETTE.map(c=>`<div class="cp-swatch" style="background:${c}" data-color="${c}"></div>`).join('');
  const rect=anchor.getBoundingClientRect();popup.style.cssText=`position:fixed;top:${rect.bottom+6}px;left:${rect.left}px;z-index:9999`;
  document.body.appendChild(popup);
  popup.querySelectorAll('.cp-swatch').forEach(sw=>{sw.addEventListener('click',async e=>{const color=e.target.getAttribute('data-color');const cat=CATEGORIES.find(c=>c.id===catId);if(cat)cat.color=color;await saveCategories();popup.remove();renderCategories();});});
  setTimeout(()=>document.addEventListener('click',()=>popup.remove(),{once:true}),10);
}

// ─── Timeline ────────────────────────────────────────────────
async function renderTimeline(dateOverride){
  const{sessions,domainCategories,manualTasks}=await getData();const dc=domainCategories||{};const today=dateOverride||getTodayKey();
  const todaySessions=(sessions||[]).filter(s=>s.date===today).sort((a,b)=>a.start-b.start);
  const todayTasks=(manualTasks||[]).filter(t=>t.date===today).sort((a,b)=>a.startTime.localeCompare(b.startTime));
  const dateNav=document.getElementById('timelineDateNav');
  if(dateNav){
    const d=new Date(today+'T12:00:00'),isToday=today===getTodayKey();
    const label=d.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'});
    dateNav.innerHTML=`<button class="tl-nav-btn" id="tlPrev">&#8249;</button><span class="tl-date-label">${label}${isToday?' <span class="tl-today-badge">Today</span>':''}</span><button class="tl-nav-btn" id="tlNext" ${isToday?'disabled':''}>&#8250;</button>`;
    document.getElementById('tlPrev').onclick=()=>{const d2=new Date(today+'T12:00:00');d2.setDate(d2.getDate()-1);renderTimeline(localKey(d2));};
    if(!isToday)document.getElementById('tlNext').onclick=()=>{const d2=new Date(today+'T12:00:00');d2.setDate(d2.getDate()+1);renderTimeline(localKey(d2));};
  }
  const hours=[];for(let h=6;h<22;h++)hours.push(h);
  document.getElementById('timelineRow').innerHTML=hours.map(h=>{
    const slotStart=new Date(today+'T'+String(h).padStart(2,'0')+':00:00').getTime(),slotEnd=slotStart+3600000;
    const overlap={};for(const s of todaySessions){const ov=Math.min(s.end,slotEnd)-Math.max(s.start,slotStart);if(ov>0)overlap[s.domain]=(overlap[s.domain]||0)+ov;}
    const topDomain=Object.entries(overlap).sort((a,b)=>b[1]-a[1])[0]?.[0];
    const manualInSlot=todayTasks.filter(t=>{const[th,tm]=t.startTime.split(':').map(Number);const ts=new Date(today).setHours(th,tm,0,0);return Math.min(ts+t.duration*1000,slotEnd)-Math.max(ts,slotStart)>0;});
    const topManual=manualInSlot[0];let bg,opacity,title;
    if(topManual){const cat=getCat(topManual.catId);bg=cat.color;opacity=0.9;title=`${topManual.title}`;}
    else if(topDomain){const cat=getCat(dc[topDomain]||'uncategorised');const totalMs=Object.values(overlap).reduce((a,b)=>a+b,0);bg=cat.color;opacity=Math.min(1,totalMs/1800000+0.2);title=topDomain;}
    else{bg='#EDE8E0';opacity=1;title=`${h}:00 — no activity`;}
    return`<div class="timeline-hour"><div class="timeline-block" title="${title}" style="background:${bg};opacity:${opacity}"></div></div>`;
  }).join('');
  document.getElementById('timelineLabels').innerHTML=hours.map(h=>`<div class="timeline-label">${h}</div>`).join('');
  const catOpts=CATEGORIES.filter(c=>c.id!=='uncategorised').map(c=>`<option value="${c.id}">${c.label}</option>`).join('');
  document.getElementById('manualTaskForm').innerHTML=`
    <div class="manual-task-form">
      <div class="form-title">➕ Log a Task</div>
      <div class="form-row">
        <input id="taskTitle" class="form-input" placeholder="Task name" style="flex:2">
        <select id="taskCat" class="form-select">${catOpts}</select>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Date</label><input id="taskDate" class="form-input" type="date" value="${today}"></div>
        <div class="form-group"><label class="form-label">Start</label><input id="taskStart" class="form-input" type="time" value="${new Date().toTimeString().slice(0,5)}"></div>
        <div class="form-group"><label class="form-label">Duration</label><div style="display:flex;gap:6px"><input id="taskDurH" class="form-input" type="number" min="0" max="12" placeholder="0h" style="width:60px"><input id="taskDurM" class="form-input" type="number" min="0" max="59" placeholder="30m" style="width:60px"></div></div>
        <div class="form-group"><label class="form-label">Notes</label><input id="taskNotes" class="form-input" placeholder="Optional"></div>
        <button id="taskSubmit" class="btn btn-sage" style="align-self:flex-end">Log</button>
      </div>
    </div>`;
  document.getElementById('taskSubmit').addEventListener('click',async()=>{
    const title=document.getElementById('taskTitle').value.trim(),catId=document.getElementById('taskCat').value;
    const date=document.getElementById('taskDate').value,startTime=document.getElementById('taskStart').value;
    const h=parseInt(document.getElementById('taskDurH').value)||0,m=parseInt(document.getElementById('taskDurM').value)||0;
    const duration=h*3600+m*60,notes=document.getElementById('taskNotes').value.trim();
    if(!title){alert('Please enter a task name.');return;}if(!duration){alert('Please enter a duration.');return;}
    await saveManualTask({id:uid(),title,catId,date,startTime,duration,notes,createdAt:Date.now()});renderTimeline(today);
  });
  const allEntries=todayTasks.map(t=>({time:t.startTime,label:t.title,catId:t.catId,duration:t.duration,notes:t.notes,id:t.id})).sort((a,b)=>b.time.localeCompare(a.time));
  const log=document.getElementById('sessionLog');
  if(!allEntries.length){log.innerHTML='<tr><td colspan="5" style="text-align:center;color:var(--grey);padding:30px">No tasks logged yet.</td></tr>';return;}
  log.innerHTML=allEntries.map(e=>{const cat=getCat(e.catId);return`<tr><td class="time-cell">${e.time}</td><td>✋ <strong>${e.label}</strong>${e.notes?`<span class="task-notes"> — ${e.notes}</span>`:''}</td><td class="time-cell">${fmtSecs(e.duration)}</td><td><span class="cat-badge" style="background:${cat.color}22;color:${cat.color};border:1px solid ${cat.color}44">${cat.label}</span></td><td><button class="delete-task-btn" data-id="${e.id}">✕</button></td></tr>`;}).join('');
  log.querySelectorAll('.delete-task-btn').forEach(btn=>{btn.addEventListener('click',async e=>{if(!confirm('Delete?'))return;await deleteManualTask(e.target.getAttribute('data-id'));renderTimeline(today);});});
}

// ─── Settings ────────────────────────────────────────────────
async function renderSettings() {
  const s = await getSettings();
  document.getElementById('settingName').value = s.name||'';
  document.getElementById('settingGoal').value = s.dailyGoalMins||120;
  document.getElementById('settingSession').value = s.sessionLengthMins||25;
}
document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
  const s = {
    name: document.getElementById('settingName').value.trim(),
    dailyGoalMins: parseInt(document.getElementById('settingGoal').value)||120,
    sessionLengthMins: parseInt(document.getElementById('settingSession').value)||25,
  };
  await saveSettings(s);
  _cachedSettings = s;
  document.getElementById('saveSettingsBtn').textContent = '✓ Saved!';
  setTimeout(()=>document.getElementById('saveSettingsBtn').textContent='Save Settings', 1500);
});

// ─── Export ──────────────────────────────────────────────────
function renderExport(){
  document.getElementById('jsonExportBtn').onclick=async()=>{const d=await getData();const b=new Blob([JSON.stringify(d,null,2)],{type:'application/json'});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=`time-sloth-${getTodayKey()}.json`;a.click();URL.revokeObjectURL(u);};
  document.getElementById('csvExportBtn').onclick=async()=>{const{manualTasks}=await getData();const rows=[['Task','Category','Duration (sec)','Time','Date']];for(const t of(manualTasks||[]).sort((a,b)=>b.date.localeCompare(a.date)))rows.push([t.title,getCat(t.catId).label,t.duration,fmtSecs(t.duration),t.date]);const b=new Blob([rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n')],{type:'text/csv'});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=`time-sloth-${getTodayKey()}.csv`;a.click();URL.revokeObjectURL(u);};
  document.getElementById('importJsonBtn').onclick=()=>{const input=document.createElement('input');input.type='file';input.accept='.json';input.onchange=async e=>{const file=e.target.files[0];if(!file)return;const text=await file.text();try{const data=JSON.parse(text);if(data.manualTasks)await store.set({manualTasks:data.manualTasks});if(data.categories)await store.set({categories:data.categories});if(data.logs)await store.set({logs:data.logs});if(data.sessions)await store.set({sessions:data.sessions});if(data.domainCategories)await store.set({domainCategories:data.domainCategories});await loadCategories();alert('Data imported!');showSection('overview');}catch{alert('Import failed.');}};input.click();};
  document.getElementById('clearDataBtn').onclick=async()=>{if(confirm('Delete ALL data?')){await store.clear();await loadCategories();alert('Cleared.');renderExport();}};
  const keys=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith('st_'))keys.push(k);}let bytes=0;keys.forEach(k=>{bytes+=((localStorage.getItem(k)||'').length*2);});const el=document.getElementById('storageUsage');if(el)el.textContent=`${(bytes/1024).toFixed(1)} KB used`;
}

// ─── Navigation ───────────────────────────────────────────────
const sections=['overview','todo','habits','categories','timeline','calendar','outlook','settings','export'];
function showSection(id){
  sections.forEach(s=>{document.getElementById('section-'+s).className=s===id?'section-visible':'section-hidden';document.querySelector(`.nav-item[data-section="${s}"]`)?.classList.toggle('active',s===id);});
  const companionPanel=document.getElementById('companionPanel');
  if(companionPanel)companionPanel.style.display=id==='overview'?'':'none';
  if(id==='overview')renderOverview();
  if(id==='todo'){populateTodoCatSelect();renderTodo();}
  if(id==='habits')renderHabits();
  if(id==='categories')renderCategories();
  if(id==='timeline')renderTimeline();
  if(id==='calendar')renderCalendar();
  if(id==='outlook')renderOutlook();
  if(id==='settings')renderSettings();
  if(id==='export')renderExport();
}
document.querySelectorAll('.nav-item').forEach(el=>el.addEventListener('click',()=>showSection(el.getAttribute('data-section'))));
document.querySelectorAll('#section-overview .range-tab').forEach(btn=>btn.addEventListener('click',function(){document.querySelectorAll('#section-overview .range-tab').forEach(b=>b.classList.remove('active'));this.classList.add('active');currentRange=this.getAttribute('data-range');renderOverview();}));

// ─── Outlook ─────────────────────────────────────────────────
const OUTLOOK_CLIENT_ID='4fe008d8-c5ee-4f81-9f2a-98a650ae2b20';
const AUTHORITY='https://login.microsoftonline.com/common/oauth2/v2.0';
const SCOPES='openid profile email Mail.Read offline_access';
const GRAPH_BASE='https://graph.microsoft.com/v1.0';
function getRedirectUri(){return window.location.origin+window.location.pathname;}
let outlookRange='today';
function b64url(buf){return btoa(String.fromCharCode(...new Uint8Array(buf instanceof ArrayBuffer?buf:buf.buffer||buf))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');}
async function makePkce(){const arr=crypto.getRandomValues(new Uint8Array(32));const verifier=b64url(arr);const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier));return{verifier,challenge:b64url(new Uint8Array(digest))};}
async function saveOutlookTokens(t){t.stored_at=Date.now();await store.set({outlookTokens:t});}
async function getOutlookTokens(){const r=await store.get('outlookTokens');return r.outlookTokens||null;}
async function clearOutlookTokens(){await store.remove(['outlookTokens','outlookProfile']);}
async function isOutlookSignedIn(){return!!(await getOutlookTokens());}
async function getAccessToken(){
  const t=await getOutlookTokens();if(!t)throw new Error('Not signed in');
  const expiresAt=t.stored_at+(t.expires_in-60)*1000;if(Date.now()<expiresAt)return t.access_token;
  if(!t.refresh_token){await clearOutlookTokens();throw new Error('Session expired');}
  const res=await fetch(`${AUTHORITY}/token`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:OUTLOOK_CLIENT_ID,grant_type:'refresh_token',refresh_token:t.refresh_token,scope:SCOPES})});
  if(!res.ok){await clearOutlookTokens();throw new Error('Session expired');}
  const nt=await res.json();await saveOutlookTokens(nt);return nt.access_token;
}
async function graph(path,params={}){
  const token=await getAccessToken();const qs=new URLSearchParams(params).toString();
  const res=await fetch(`${GRAPH_BASE}${path}${qs?'?'+qs:''}`,{headers:{Authorization:`Bearer ${token}`}});
  if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e.error?.message||`Graph error ${res.status}`);}
  return res.json();
}
async function outlookSignIn(){
  const{verifier,challenge}=await makePkce();const state=b64url(crypto.getRandomValues(new Uint8Array(8)));
  sessionStorage.setItem('pkce_verifier',verifier);sessionStorage.setItem('pkce_state',state);
  const params=new URLSearchParams({client_id:OUTLOOK_CLIENT_ID,response_type:'code',redirect_uri:getRedirectUri(),scope:SCOPES,code_challenge:challenge,code_challenge_method:'S256',state,prompt:'select_account'});
  window.location.href=`${AUTHORITY}/authorize?${params}`;
}
async function handleOAuthCallback(){
  let url;
  try { url=new URL(window.location.href); } catch(e){ return false; }
  const code=url.searchParams.get('code');const state=url.searchParams.get('state');const error=url.searchParams.get('error');
  if(!code&&!error)return false;
  window.history.replaceState({},document.title,window.location.pathname);
  if(error){alert('Sign-in failed: '+(url.searchParams.get('error_description')||error));return true;}
  const savedState=sessionStorage.getItem('pkce_state');const verifier=sessionStorage.getItem('pkce_verifier');
  sessionStorage.removeItem('pkce_state');sessionStorage.removeItem('pkce_verifier');
  if(state!==savedState){alert('Security error.');return true;}
  const tokenRes=await fetch(`${AUTHORITY}/token`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:OUTLOOK_CLIENT_ID,grant_type:'authorization_code',code,redirect_uri:getRedirectUri(),code_verifier:verifier})});
  if(!tokenRes.ok){const e=await tokenRes.json();alert('Token exchange failed: '+(e.error_description||'unknown'));return true;}
  const tokens=await tokenRes.json();await saveOutlookTokens(tokens);return true;
}
async function fetchEmailStats(rangeKey){
  const now=new Date();let since;
  if(rangeKey==='today'){since=new Date(now);since.setHours(0,0,0,0);}
  else if(rangeKey==='week'){since=new Date(now);const dow=since.getDay();since.setDate(since.getDate()-(dow===0?6:dow-1));since.setHours(0,0,0,0);}
  else{since=new Date(now);since.setDate(1);since.setHours(0,0,0,0);}
  const sinceStr=since.toISOString();
  const[receivedData,sentData]=await Promise.all([graph('/me/mailFolders/Inbox/messages',{$filter:`receivedDateTime ge ${sinceStr}`,$select:'id,subject,receivedDateTime,from,isRead,conversationId',$top:'200',$orderby:'receivedDateTime desc'}),graph('/me/mailFolders/SentItems/messages',{$filter:`sentDateTime ge ${sinceStr}`,$select:'id,subject,sentDateTime,conversationId',$top:'200',$orderby:'sentDateTime desc'})]);
  const received=receivedData.value||[],sent=sentData.value||[];
  const receivedByConv={};for(const m of received)if(!receivedByConv[m.conversationId])receivedByConv[m.conversationId]=m;
  const replyTimes=[];for(const s of sent){const orig=receivedByConv[s.conversationId];if(orig){const diff=(new Date(s.sentDateTime)-new Date(orig.receivedDateTime))/60000;if(diff>0&&diff<60*24*7)replyTimes.push(diff);}}
  const avgReplyMins=replyTimes.length?Math.round(replyTimes.reduce((a,b)=>a+b,0)/replyTimes.length):null;
  return{receivedCount:received.length,sentCount:sent.length,unreadCount:received.filter(m=>!m.isRead).length,avgReplyMins,recent:received.slice(0,10).map(m=>({subject:m.subject||'(no subject)',from:m.from?.emailAddress?.name||m.from?.emailAddress?.address||'?',time:m.receivedDateTime,isRead:m.isRead}))};
}
function fmtReplyTime(mins){if(mins===null)return'—';if(mins<60)return`${mins}m`;const h=Math.floor(mins/60),m=mins%60;return m>0?`${h}h ${m}m`:`${h}h`;}
function fmtEmailTime(iso){const d=new Date(iso),today=new Date();return d.toDateString()===today.toDateString()?d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}):d.toLocaleDateString('en-GB',{day:'numeric',month:'short'});}
async function renderOutlook(){
  const body=document.getElementById('outlookBody');const signedIn=await isOutlookSignedIn();
  if(!signedIn){body.innerHTML=`<div class="outlook-connect-box"><div class="outlook-connect-icon">📧</div><div class="outlook-connect-title">Connect your Outlook</div><div class="outlook-connect-desc">Sign in to pull in email stats and sync flagged emails to your To-Do list automatically.</div><div class="outlook-note">⚠️ Add <code>${getRedirectUri()}</code> as a redirect URI in your Azure app registration first.</div><button class="btn btn-primary" id="outlookSignInBtn" style="width:100%;margin-top:12px">Sign in with Microsoft</button></div>`;document.getElementById('outlookSignInBtn').addEventListener('click',()=>outlookSignIn());return;}
  body.innerHTML=`<div class="outlook-loading"><div class="outlook-loading-spinner"></div>Loading…</div>`;
  try{
    let profile=(await store.get('outlookProfile')).outlookProfile;
    if(!profile){profile=await graph('/me',{$select:'displayName,mail,userPrincipalName'});await store.set({outlookProfile:profile});}
    const displayName=profile.displayName||'You',email=profile.mail||profile.userPrincipalName||'';
    const initials=displayName.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
    const stats=await fetchEmailStats(outlookRange);
    body.innerHTML=`<div class="outlook-profile-bar"><div class="outlook-avatar">${initials}</div><div><div class="outlook-profile-name">${displayName}</div><div class="outlook-profile-email">${email}</div></div><button class="outlook-signout" id="outlookSignOutBtn">Sign out</button></div>
    <div class="email-stats-grid">
      <div class="email-stat-card"><div class="email-stat-icon">📥</div><div class="email-stat-label">Received</div><div class="email-stat-val">${stats.receivedCount}</div><div class="email-stat-sub">${stats.unreadCount} unread</div></div>
      <div class="email-stat-card"><div class="email-stat-icon">📤</div><div class="email-stat-label">Sent</div><div class="email-stat-val">${stats.sentCount}</div><div class="email-stat-sub">emails</div></div>
      <div class="email-stat-card"><div class="email-stat-icon">⚡</div><div class="email-stat-label">Avg Reply</div><div class="email-stat-val" style="font-size:${stats.avgReplyMins!==null&&stats.avgReplyMins>=60?'20px':'26px'}">${fmtReplyTime(stats.avgReplyMins)}</div><div class="email-stat-sub">${stats.avgReplyMins!==null?'per email':'none tracked'}</div></div>
      <div class="email-stat-card"><div class="email-stat-icon">📊</div><div class="email-stat-label">Ratio</div><div class="email-stat-val" style="font-size:20px">${stats.sentCount&&stats.receivedCount?Math.round(stats.sentCount/stats.receivedCount*100)+'%':'—'}</div><div class="email-stat-sub">sent / received</div></div>
    </div>
    <div class="email-recent-card"><div class="card-header"><div class="card-title">Recent Emails</div></div>${stats.recent.length===0?'<div style="text-align:center;padding:30px;color:var(--grey)">No emails in this period</div>':stats.recent.map(m=>`<div class="email-row">${m.isRead?'<div class="email-read-dot"></div>':'<div class="email-unread-dot"></div>'}<div class="email-from">${m.from}</div><div class="email-subject">${m.subject}</div><div class="email-time">${fmtEmailTime(m.time)}</div></div>`).join('')}</div>`;
    document.getElementById('outlookSignOutBtn').addEventListener('click',async()=>{await clearOutlookTokens();renderOutlook();});
    syncFlaggedEmails();
  }catch(e){body.innerHTML=`<div class="outlook-error">❌ ${e.message}</div><button class="btn" id="outlookRetrySignIn" style="margin-top:12px">Sign in again</button>`;document.getElementById('outlookRetrySignIn').addEventListener('click',async()=>{await clearOutlookTokens();renderOutlook();});}
}
document.querySelectorAll('#outlookRangeTabs .range-tab').forEach(btn=>{btn.addEventListener('click',function(){document.querySelectorAll('#outlookRangeTabs .range-tab').forEach(b=>b.classList.remove('active'));this.classList.add('active');outlookRange=this.getAttribute('data-range');renderOutlook();});});

// ─── Calendar ────────────────────────────────────────────────
let calWeekOffset=0,calSlotMins=30;const CAL_START_H=7,CAL_END_H=20;
function getWeekDates(offset){const today=new Date(),dow=today.getDay(),monday=new Date(today);monday.setDate(today.getDate()-(dow===0?6:dow-1)+offset*7);monday.setHours(0,0,0,0);return Array.from({length:5},(_,i)=>{const d=new Date(monday);d.setDate(monday.getDate()+i);return d;});}
function hexToRgb(hex){if(!hex||hex.length<7)return'107,158,78';const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);return`${r},${g},${b}`;}
async function renderCalendar(){
  const{sessions,domainCategories,manualTasks,logs}=await getData();const dc=domainCategories||{};const days=getWeekDates(calWeekOffset);const todayStr=getTodayKey();
  const slotH=calSlotMins===15?22:calSlotMins===30?36:56,slotsPerHour=60/calSlotMins,totalHours=CAL_END_H-CAL_START_H,totalSlots=totalHours*slotsPerHour;
  const fmt=d=>d.toLocaleDateString('en-GB',{day:'numeric',month:'short'});
  document.getElementById('calWeekLabel').textContent=`${fmt(days[0])} – ${fmt(days[4])} ${days[0].getFullYear()}`;
  document.getElementById('calLegend').innerHTML=CATEGORIES.filter(c=>c.id!=='uncategorised').map(cat=>`<div class="cal-legend-item"><div class="cal-legend-dot" style="background:${cat.color}"></div>${cat.label}</div>`).join('');
  const allSessions=sessions||[],allTasks=manualTasks||[];
  function getEvents(dayDate){const dk=localKey(dayDate);const events=[];for(const s of allSessions){if(s.date!==dk)continue;events.push({startMs:s.start,endMs:s.end,catId:dc[s.domain]||'uncategorised',label:s.domain,type:'browser'});}for(const t of allTasks){if(t.date!==dk)continue;const[h,m]=t.startTime.split(':').map(Number);const startMs=new Date(dk+'T00:00:00').setHours(h,m,0,0);events.push({startMs,endMs:startMs+t.duration*1000,catId:t.catId,label:t.title,type:'manual'});}return events;}
  const gutter=document.getElementById('calGutter');gutter.innerHTML='';
  for(let s=0;s<=totalSlots;s++){const totalMins=CAL_START_H*60+s*calSlotMins,h=Math.floor(totalMins/60),m=totalMins%60,isHour=m===0;const div=document.createElement('div');div.className='cal-gutter-slot'+(isHour?' hour-mark':'');div.style.height=slotH+'px';div.textContent=isHour?`${String(h).padStart(2,'0')}:00`:'';gutter.appendChild(div);}
  const calDays=document.getElementById('calDays');calDays.innerHTML='';
  days.forEach(day=>{
    const dk=localKey(day),isToday=dk===todayStr,events=getEvents(day);
    const dayLogs=(logs||{})[dk]||{};const dayTotalSecs=Object.values(dayLogs).reduce((a,b)=>a+b,0)+allTasks.filter(t=>t.date===dk).reduce((a,t)=>a+t.duration,0);
    const col=document.createElement('div');col.className='cal-day-col';
    const dayNames=['Mon','Tue','Wed','Thu','Fri'],dayName=dayNames[days.indexOf(day)];
    col.innerHTML=`<div class="cal-day-header"><div class="cal-day-name">${dayName}</div>${isToday?`<div class="cal-day-num today">${day.getDate()}</div>`:`<div class="cal-day-num">${day.getDate()}</div>`}<div class="cal-day-total">${dayTotalSecs?fmtSecs(dayTotalSecs):''}</div></div>`;
    const slotsWrap=document.createElement('div');slotsWrap.style.position='relative';
    for(let s=0;s<totalSlots;s++){const slotStartMins=CAL_START_H*60+s*calSlotMins,isHour=(slotStartMins%60)===0;const cell=document.createElement('div');cell.className='cal-slot'+(isHour?' hour-start':'');cell.style.height=slotH+'px';slotsWrap.appendChild(cell);}
    if(isToday){const now=new Date(),nowMins=now.getHours()*60+now.getMinutes(),startMins=CAL_START_H*60;if(nowMins>=startMins&&nowMins<=CAL_END_H*60){const pxFromTop=((nowMins-startMins)/calSlotMins)*slotH;const line=document.createElement('div');line.className='cal-now-line';line.style.top=pxFromTop+'px';line.innerHTML='<div class="cal-now-dot"></div>';slotsWrap.appendChild(line);}}
    const calStartMs=new Date(dk+'T00:00:00').setHours(CAL_START_H,0,0,0),pxPerMin=slotH/calSlotMins;
    for(const ev of events){const cat=getCat(ev.catId);const evStartMins=Math.max(0,(ev.startMs-calStartMs)/60000),evEndMins=Math.min(totalHours*60,(ev.endMs-calStartMs)/60000);if(evEndMins<=0||evStartMins>=totalHours*60)continue;const top=evStartMins*pxPerMin,height=Math.max(14,(evEndMins-evStartMins)*pxPerMin-2);const block=document.createElement('div');block.className='cal-event';block.style.cssText=`top:${top}px;height:${height}px;background:rgba(${hexToRgb(cat.color)},0.18);border-left:3px solid ${cat.color};color:${cat.color};`;block.textContent=height>20?(ev.type==='manual'?'✋ ':'')+ev.label:'';block.title=`${ev.label} · ${fmtSecs(Math.round((ev.endMs-ev.startMs)/1000))}`;slotsWrap.appendChild(block);}
    col.appendChild(slotsWrap);calDays.appendChild(col);
  });
  const wrap=document.getElementById('calGridWrap');const scrollTarget=((8-CAL_START_H)*slotsPerHour)*slotH+48;if(wrap._firstRender!==calWeekOffset+'_'+calSlotMins){wrap.scrollTop=scrollTarget;wrap._firstRender=calWeekOffset+'_'+calSlotMins;}
}
document.getElementById('calPrev').addEventListener('click',()=>{calWeekOffset--;renderCalendar();});
document.getElementById('calNext').addEventListener('click',()=>{calWeekOffset++;renderCalendar();});
document.getElementById('calTodayBtn').addEventListener('click',()=>{calWeekOffset=0;renderCalendar();});
document.querySelectorAll('.slot-tab').forEach(btn=>{btn.addEventListener('click',function(){document.querySelectorAll('.slot-tab').forEach(b=>b.classList.remove('active'));this.classList.add('active');calSlotMins=parseInt(this.getAttribute('data-mins'));renderCalendar();});});


// ─── Habits ──────────────────────────────────────────────────

const HABIT_EMOJIS = ['🏃','💪','🧘','📚','✍️','🎯','💧','🥗','😴','🌞','🚴','🎵','🧠','💊','🌿','🍎','🏋️','🤸','📝','🎨','🧹','💰','🙏','❤️','⭐','🔥','🌱','🏆'];
const HABIT_COLOURS = ['#6B9E4E','#E8A020','#818cf8','#f472b6','#38bdf8','#f59e0b','#ef4444','#a78bfa','#34d399','#fb923c','#2D5016','#8B6340'];

async function getHabits() { const r = await store.get('habits'); return r.habits || []; }
async function saveHabits(h) { await store.set({ habits: h }); }
async function getHabitLogs() { const r = await store.get('habitLogs'); return r.habitLogs || {}; }
async function saveHabitLogs(l) { await store.set({ habitLogs: l }); }

function getHabitStreak(habitId, frequency, timesPerWeek, logs) {
  const today = getTodayKey();
  let streak = 0;

  if (frequency === 'daily') {
    let d = new Date();
    for (let i = 0; i < 365; i++) {
      const key = localKey(d);
      if (key > today) { d.setDate(d.getDate()-1); continue; }
      if (logs[habitId]?.[key]) { streak++; d.setDate(d.getDate()-1); }
      else if (key === today) { d.setDate(d.getDate()-1); } // today not done yet = ok
      else break;
    }
  } else if (frequency === 'weekly') {
    // Count consecutive weeks where target met
    const tw = timesPerWeek || 3;
    let weekStart = new Date();
    const dow = weekStart.getDay();
    weekStart.setDate(weekStart.getDate() - (dow === 0 ? 6 : dow - 1));
    for (let w = 0; w < 52; w++) {
      let count = 0;
      for (let d = 0; d < 7; d++) {
        const day = new Date(weekStart);
        day.setDate(weekStart.getDate() + d);
        const key = localKey(day);
        if (key > today) continue;
        if (logs[habitId]?.[key]) count++;
      }
      if (count >= tw || (w === 0 && count > 0)) { streak++; weekStart.setDate(weekStart.getDate() - 7); }
      else if (w === 0) break; // this week not started yet is ok only if no logs
      else break;
    }
  } else if (frequency === 'monthly') {
    // Count consecutive months with at least 1 completion
    let d = new Date();
    for (let m = 0; m < 24; m++) {
      const year = d.getFullYear(), month = d.getMonth();
      const daysInMonth = new Date(year, month+1, 0).getDate();
      let found = false;
      for (let day = 1; day <= daysInMonth; day++) {
        const key = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        if (key > today) continue;
        if (logs[habitId]?.[key]) { found = true; break; }
      }
      if (found) { streak++; d.setMonth(d.getMonth()-1); }
      else if (m === 0) { d.setMonth(d.getMonth()-1); } // current month not done yet = ok
      else break;
    }
  }
  return streak;
}

function isHabitDoneToday(habitId, logs) {
  return !!(logs[habitId]?.[getTodayKey()]);
}

async function toggleHabitToday(habitId) {
  const logs = await getHabitLogs();
  const today = getTodayKey();
  if (!logs[habitId]) logs[habitId] = {};
  if (logs[habitId][today]) {
    delete logs[habitId][today];
  } else {
    logs[habitId][today] = true;
  }
  await saveHabitLogs(logs);
  renderHabits();
}

let selectedHabitEmoji = '🌟';
let selectedHabitColour = '#6B9E4E';
let weeklyCountVal = 3;
let editingHabitId = null;
let viewingHabitId = null;

async function renderHabits() {
  const habits = await getHabits();
  const logs = await getHabitLogs();
  const grid = document.getElementById('habitGrid');
  if (!grid) return;

  if (!habits.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--grey);">
      <div style="font-size:48px;margin-bottom:12px;">🌱</div>
      <div style="font-family:'Plus Jakarta Sans',sans-serif;font-size:16px;font-weight:700;color:var(--forest);margin-bottom:6px;">No habits yet</div>
      <div style="font-size:13px;">Add your first habit to start building consistency.</div>
    </div>`;
    return;
  }

  grid.innerHTML = '';
  habits.forEach(habit => {
    const done = isHabitDoneToday(habit.id, logs);
    const streak = getHabitStreak(habit.id, habit.frequency, habit.timesPerWeek, logs);
    const freqLabel = habit.frequency === 'daily' ? 'Daily' : habit.frequency === 'monthly' ? 'Monthly' : `${habit.timesPerWeek}x / week`;

    const card = document.createElement('div');
    card.className = `habit-card${done ? ' completed-today' : ''}`;
    if (done) card.style.background = habit.colour + '18';
    if (done) card.style.borderColor = habit.colour;

    card.innerHTML = `
      <button class="habit-edit-btn" data-id="${habit.id}">⋯</button>
      <div class="habit-circle" style="color:${habit.colour};background:${done ? habit.colour : 'transparent'};">
        ${done ? '<span style="font-size:36px;">✓</span>' : `<span>${habit.emoji}</span>`}
        ${streak > 0 ? `<div class="habit-streak-badge">${streak}</div>` : ''}
      </div>
      <div class="habit-name">${habit.name}</div>
      <div class="habit-freq">${freqLabel}</div>`;

    card.addEventListener('click', (e) => {
      if (e.target.closest('.habit-edit-btn')) return;
      toggleHabitToday(habit.id);
    });

    card.querySelector('.habit-edit-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      openHabitModal(habit);
    });

    // Long press / double click to see calendar
    let pressTimer;
    card.addEventListener('mousedown', () => { pressTimer = setTimeout(() => showHabitCalendar(habit.id), 500); });
    card.addEventListener('mouseup', () => clearTimeout(pressTimer));
    card.addEventListener('mouseleave', () => clearTimeout(pressTimer));

    grid.appendChild(card);
  });
}

function showHabitCalendar(habitId) {
  viewingHabitId = habitId;
  const detail = document.getElementById('habitCalendarDetail');
  detail.style.display = 'block';
  renderHabitCalendar(habitId);
}

async function renderHabitCalendar(habitId) {
  const habits = await getHabits();
  const logs = await getHabitLogs();
  const habit = habits.find(h => h.id === habitId);
  if (!habit) return;

  document.getElementById('habitCalTitle').textContent = `${habit.emoji} ${habit.name}`;
  document.getElementById('habitCalSub').textContent = `Streak: ${getHabitStreak(habitId, habit.frequency, habit.timesPerWeek, logs)} days`;

  const now = new Date();
  const year = now.getFullYear(), month = now.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const startDow = (firstDay.getDay() + 6) % 7; // Mon=0
  const today = getTodayKey();

  const calGrid = document.getElementById('habitCalGrid');
  const monthName = now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  let html = `<div style="grid-column:1/-1;text-align:center;font-family:'Plus Jakarta Sans',sans-serif;font-weight:700;font-size:14px;color:var(--forest);margin-bottom:8px;">${monthName}</div>`;
  ['M','T','W','T','F','S','S'].forEach(d => { html += `<div class="habit-cal-header">${d}</div>`; });

  // Empty cells before first day
  for (let i = 0; i < startDow; i++) html += `<div></div>`;

  for (let day = 1; day <= daysInMonth; day++) {
    const key = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const done = !!(logs[habitId]?.[key]);
    const isToday = key === today;
    const isFuture = key > today;
    const isPast = key < today && !isFuture;

    let cls = 'habit-cal-day';
    let style = '';
    let content = day;

    if (isFuture) { cls += ' future'; }
    else if (done) { cls += ' done'; style = `background:${habit.colour};`; content = '✓'; }
    else if (isPast) { cls += ' missed'; content = day; }
    if (isToday) cls += ' today';

    html += `<div class="${cls}" style="${style}">${content}</div>`;
  }

  calGrid.innerHTML = html;
}

document.getElementById('habitCalClose').addEventListener('click', () => {
  document.getElementById('habitCalendarDetail').style.display = 'none';
});

function openHabitModal(habitToEdit = null) {
  editingHabitId = habitToEdit ? habitToEdit.id : null;
  selectedHabitEmoji = habitToEdit ? habitToEdit.emoji : '🌟';
  selectedHabitColour = habitToEdit ? habitToEdit.colour : '#6B9E4E';
  weeklyCountVal = habitToEdit?.timesPerWeek || 3;

  document.getElementById('habitModalTitle').textContent = habitToEdit ? 'Edit Habit' : 'New Habit';
  document.getElementById('habitNameInput').value = habitToEdit ? habitToEdit.name : '';

  // Frequency
  const freq = habitToEdit?.frequency || 'daily';
  document.querySelectorAll('input[name="habitFreq"]').forEach(r => { r.checked = r.value === freq; });
  document.getElementById('weeklyCountWrap').style.display = freq === 'weekly' ? 'flex' : 'none';
  document.getElementById('weeklyCount').textContent = weeklyCountVal;

  // Emoji grid
  const emojiGrid = document.getElementById('habitEmojiGrid');
  emojiGrid.innerHTML = HABIT_EMOJIS.map(e =>
    `<div class="habit-emoji-btn${e === selectedHabitEmoji ? ' selected' : ''}" data-emoji="${e}">${e}</div>`
  ).join('');
  emojiGrid.querySelectorAll('.habit-emoji-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedHabitEmoji = btn.getAttribute('data-emoji');
      emojiGrid.querySelectorAll('.habit-emoji-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      document.getElementById('habitEmojiPreview').textContent = selectedHabitEmoji;
    });
  });
  document.getElementById('habitEmojiPreview').textContent = selectedHabitEmoji;

  // Colour grid
  const colourGrid = document.getElementById('habitColourGrid');
  colourGrid.innerHTML = HABIT_COLOURS.map(c =>
    `<div class="habit-colour-swatch${c === selectedHabitColour ? ' selected' : ''}" style="background:${c}" data-colour="${c}"></div>`
  ).join('');
  colourGrid.querySelectorAll('.habit-colour-swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      selectedHabitColour = sw.getAttribute('data-colour');
      colourGrid.querySelectorAll('.habit-colour-swatch').forEach(s => s.classList.remove('selected'));
      sw.classList.add('selected');
    });
  });

  const modal = document.getElementById('habitModal');
  modal.style.display = 'flex';
}

// Frequency radio toggle
document.querySelectorAll('input[name="habitFreq"]').forEach(r => {
  r.addEventListener('change', () => {
    document.getElementById('weeklyCountWrap').style.display = r.value === 'weekly' ? 'flex' : 'none';
  });
});

// Weekly count +/-
document.getElementById('weeklyMinus').addEventListener('click', () => {
  if (weeklyCountVal > 1) { weeklyCountVal--; document.getElementById('weeklyCount').textContent = weeklyCountVal; }
});
document.getElementById('weeklyPlus').addEventListener('click', () => {
  if (weeklyCountVal < 7) { weeklyCountVal++; document.getElementById('weeklyCount').textContent = weeklyCountVal; }
});

document.getElementById('habitModalCancel').addEventListener('click', () => {
  document.getElementById('habitModal').style.display = 'none';
});

document.getElementById('habitModalSave').addEventListener('click', async () => {
  const name = document.getElementById('habitNameInput').value.trim();
  if (!name) { document.getElementById('habitNameInput').focus(); return; }
  const frequency = document.querySelector('input[name="habitFreq"]:checked').value;

  const habits = await getHabits();
  if (editingHabitId) {
    const idx = habits.findIndex(h => h.id === editingHabitId);
    if (idx !== -1) {
      habits[idx] = { ...habits[idx], name, emoji: selectedHabitEmoji, colour: selectedHabitColour, frequency, timesPerWeek: weeklyCountVal };
    }
  } else {
    habits.push({ id: uid(), name, emoji: selectedHabitEmoji, colour: selectedHabitColour, frequency, timesPerWeek: weeklyCountVal, createdAt: Date.now() });
  }
  await saveHabits(habits);
  document.getElementById('habitModal').style.display = 'none';
  renderHabits();
});

// Delete habit from edit modal - add delete button
document.getElementById('habitModalSave').insertAdjacentHTML('beforebegin',
  '<button class="btn" id="habitDeleteBtn" style="flex:1;border-color:#dc2626;color:#dc2626;display:none">Delete</button>');

document.getElementById('habitDeleteBtn').addEventListener('click', async () => {
  if (!editingHabitId) return;
  if (!confirm('Delete this habit and all its history?')) return;
  const habits = (await getHabits()).filter(h => h.id !== editingHabitId);
  await saveHabits(habits);
  document.getElementById('habitModal').style.display = 'none';
  renderHabits();
});

// Show delete button when editing
const origOpen = openHabitModal;

document.getElementById('addHabitBtn').addEventListener('click', () => {
  document.getElementById('habitDeleteBtn').style.display = 'none';
  openHabitModal();
});

// ─── Boot ─────────────────────────────────────────────────────
(async()=>{
  try {
    const wasCallback = await handleOAuthCallback();
    await loadCategories();
    _cachedSettings = await getSettings();
    await loadActiveTask();
    populateTodoCatSelect();
    setSloth('heroSlothWrap', activeTask ? 'active' : 'idle', 180);
    renderHabits();
    setSloth('companionSlothWrap', activeTask ? 'active' : 'idle', 140);
    setSloth('focusSlothWrap', 'active', 200);
    showSection('overview');
    if (wasCallback) showSection('outlook');
    setInterval(async()=>{
      try {
        await loadCategories();
        _cachedSettings = await getSettings();
        const active=document.querySelector('.nav-item.active')?.getAttribute('data-section');
        if(active)showSection(active);
      } catch(e){ console.warn('Refresh error:', e); }
    }, 60000);
    setInterval(syncFlaggedEmails, 5*60*1000);
  } catch(e) {
    console.error('Boot error:', e);
    // Still try to show the page even if boot partially failed
    try { showSection('overview'); } catch(e2){}
  }
})();

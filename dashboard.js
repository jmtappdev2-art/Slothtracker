// ============================================================
// Time Sloth Web — dashboard.js
// ============================================================



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
function uid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random()*16|0;
    return (c==='x' ? r : (r&0x3|0x8)).toString(16);
  });
}
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
async function getSettings() { return dbGetSettings(); }
async function saveSettings(s) { await dbSaveSettings(s); }

// ─── Storage helpers ─────────────────────────────────────────
async function getData() {
  const [manualTasks, todoItems, cats] = await Promise.all([
    dbGetManualTasks(), dbGetTodos(), dbGetCategories()
  ]);
  return { logs:{}, domainCategories:{}, sessions:[], categories:cats, manualTasks, todoItems };
}
async function loadCategories() {
  const cats = await dbGetCategories();
  CATEGORIES = (cats && cats.length) ? cats : [...DEFAULT_CATEGORIES];
  if (!cats || !cats.length) await dbSaveCategories(CATEGORIES);
}
async function saveCategories() { await dbSaveCategories(CATEGORIES); }
async function getManualTasks() { return dbGetManualTasks(); }
async function saveManualTask(task) { await dbSaveManualTask(task); }
async function deleteManualTask(id) { await dbDeleteManualTask(id); }
async function getTodoItems() { return dbGetTodos(); }
async function saveTodoItems(items) { await dbSaveTodos(items); }

// ─── Sloth Images ────────────────────────────────────────────
const SLOTH_IMGS = {
  idle:      'Multitaks Sloth .png',   // overview hero default
  active:    'Hyperspeed sloth.png',   // flying, focus mode
  locked:    'Locked in sloth .png',   // focused at laptop
  celebrate: 'Multitaks Sloth .png',  // juggling, goal complete
  running:   'Running sloth .png',    // banner while task running
  business:  'Business Sloth .png',   // goal achieved
  logo:      'Timesloth Mian logo.png',
};

function setSloth(wrapperId, state, size) {
  const el = document.getElementById(wrapperId);
  if (!el) return;
  const src = SLOTH_IMGS[state] || SLOTH_IMGS.idle;
  const animClass = state==='idle'?'sloth-idle':state==='active'?'sloth-active':'sloth-celebrate';
  el.innerHTML = `<img src="${src}" style="height:${size}px;width:auto;display:block;object-fit:contain;max-width:100%;filter:drop-shadow(0 4px 16px rgba(0,0,0,0.2));" class="${animClass}" alt="Time Sloth">`;
}

// ─── Active Task & Focus Screen ──────────────────────────────
let activeTask = null;
let timerInterval = null;
let focusScreenOpen = false;
let focusSessionCount = 0;

async function loadActiveTask() {
  try { const raw = localStorage.getItem('ts_activeTask'); activeTask = raw ? JSON.parse(raw) : null; } catch { activeTask = null; }
  updateBanner();
  if (activeTask) startTimerTick();
}
function saveActiveTask() { try { localStorage.setItem('ts_activeTask', JSON.stringify(activeTask)); } catch {} }

function updateBanner() {
  const allIdle = !activeTask;
  setSloth('heroSlothWrap', allIdle ? 'idle' : 'active', 180);
  setSloth('companionSlothWrap', allIdle ? 'locked' : 'active', 140);
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
  if (activeTask) await stopTask('cancel');
  const items = await getTodoItems();
  const item = items.find(i => i.id === todoId);
  if (!item) return;
  activeTask = { id: todoId, title: item.title, catId: item.catId, startTime: Date.now() };
  saveActiveTask();
  updateBanner();
  startTimerTick();
  renderTodo();
  openFocusScreen(item.title, item.catId);
}

// action: 'done' | 'pause' | 'cancel'
async function stopTask(action='done') {
  if (!activeTask) return;
  const duration = Math.round((Date.now() - activeTask.startTime) / 1000);
  const shouldLog = (action === 'done' || action === 'pause') && duration >= 5;

  if (shouldLog) {
    const now = new Date(activeTask.startTime);
    const endNow = new Date();
    const startTimeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    const sessionNote = action === 'pause' ? 'paused session' : 'focus session';

    // Log to timeline/calendar as a manual task session
    await saveManualTask({
      id: uid(),
      title: activeTask.title,
      catId: activeTask.catId,
      date: localKey(now),
      startTime: startTimeStr,
      endTime: `${String(endNow.getHours()).padStart(2,'0')}:${String(endNow.getMinutes()).padStart(2,'0')}`,
      duration,
      notes: sessionNote,
      createdAt: Date.now()
    });

    // Record session on the todo item itself
    const todoItems = await getTodoItems();
    const idx = todoItems.findIndex(i=>i.id===activeTask.id);
    if (idx !== -1) {
      if (!todoItems[idx].sessions) todoItems[idx].sessions = [];
      todoItems[idx].sessions.push({ startTime: activeTask.startTime, endTime: Date.now(), duration });
      if (action === 'done') {
        todoItems[idx].completed = true;
        todoItems[idx].completedDate = getTodayKey();
      }
      await saveTodoItems(todoItems);
    }
    focusSessionCount++;
  }

  const wasTask = { ...activeTask };
  activeTask = null;
  localStorage.removeItem('ts_activeTask');
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  closeFocusScreen();

  if (action === 'done') {
    setSloth('heroSlothWrap', 'celebrate', 180);
    setSloth('companionSlothWrap', 'celebrate', 140);
    setTimeout(() => {
      setSloth('heroSlothWrap', 'idle', 180);
      setSloth('companionSlothWrap', 'idle', 140);
    }, 3000);
  } else {
    setSloth('heroSlothWrap', 'idle', 180);
    setSloth('companionSlothWrap', 'idle', 140);
  }

  updateBanner();
  renderTodo();
  const activeSection = document.querySelector('.nav-item.active')?.getAttribute('data-section');
  if (activeSection === 'overview') renderOverview();
}

// ─── Focus Screen ─────────────────────────────────────────────
function openFocusScreen(taskName, catId) {
  focusScreenOpen = true;
  const cat = getCat(catId);
  const screen = document.getElementById('focusScreen');
  screen.classList.add('visible');
  // Category colour gradient background
  screen.style.background = `linear-gradient(160deg, ${cat.color}dd 0%, ${cat.color}99 50%, #1a3a0a 100%)`;
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

document.getElementById('focusDoneBtn').addEventListener('click', () => stopTask('done'));
document.getElementById('focusPauseBtn').addEventListener('click', () => stopTask('pause'));
document.getElementById('focusCancelBtn').addEventListener('click', () => stopTask('cancel'));
document.getElementById('bannerStopBtn').addEventListener('click', () => stopTask('done'));

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
  // Show business sloth when daily goal complete, else idle/active based on task
  if (!activeTask) {
    setSloth('heroSlothWrap', goalPct >= 100 ? 'celebrate' : 'idle', 180);
    setSloth('companionSlothWrap', goalPct >= 100 ? 'celebrate' : 'locked', 140);
  }

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

function bucketToDate(bucket) {
  const d = new Date();
  if (bucket === 'today') return getTodayKey();
  if (bucket === 'overdue') { d.setDate(d.getDate()-1); return localKey(d); }
  if (bucket === 'week') { d.setDate(d.getDate()+2); return localKey(d); }
  if (bucket === 'later') { d.setDate(d.getDate()+14); return localKey(d); }
  return null;
}

function updateTodoBadge(items) {
  const badge = document.getElementById('todoBadge');
  const overdue = items.filter(i=>!i.completed&&getDueBucket(i.dueDate)==='overdue').length;
  const pending = items.filter(i=>!i.completed).length;
  if (overdue>0){badge.textContent=overdue;badge.style.display='';}
  else if(pending>0){badge.textContent=pending;badge.style.display='';}
  else{badge.style.display='none';}
}

function makeCatOptions(selectedId) {
  return CATEGORIES.map(c=>`<option value="${c.id}" ${c.id===selectedId?'selected':''}>${c.label}</option>`).join('');
}

let dragItemId = null;
let dragGhost = null;
let dragPlaceholder = null;

function getDragAfterElement(container, y) {
  const els = [...container.querySelectorAll('.todo-item:not(.dragging)')];
  return els.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height/2;
    if (offset < 0 && offset > closest.offset) return { offset, element: child };
    return closest;
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

async function renderTodo() {
  const items = await getTodoItems();
  updateTodoBadge(items);
  populateTodoCatSelect();

  const groups = {
    overdue:{ label:'⚠️ Overdue',       cls:'overdue', items:[] },
    today:  { label:'📅 Today',          cls:'today',   items:[] },
    week:   { label:'📆 This Week',      cls:'week',    items:[] },
    later:  { label:'🗓 Later',           cls:'later',   items:[] },
    flagged:{ label:'📧 Flagged Emails', cls:'flagged', items:[] },
  };

  for (const item of items) {
    if (item.completed) continue;
    if (item.source==='flagged') { groups.flagged.items.push(item); continue; }
    groups[getDueBucket(item.dueDate)].items.push(item);
  }
  const doneToday = items.filter(i=>i.completed && i.completedDate===getTodayKey());

  const container = document.getElementById('todoGroups');
  container.innerHTML = '';
  const collapseKey = 'st_todoCollapse';
  let cs = {};
  try { cs = JSON.parse(localStorage.getItem(collapseKey)||'{}'); } catch {}

  ['overdue','today','week','later','flagged'].forEach(gKey => {
    if (cs[gKey]===undefined) cs[gKey] = true;
    const g = groups[gKey];
    const allItems = gKey==='later' ? [...g.items,...doneToday] : g.items;

    const card = document.createElement('div');
    card.className = `card todo-group ${g.cls} ${cs[gKey]?'open':''}`;
    card.dataset.bucket = gKey;

    const header = document.createElement('div');
    header.className = 'todo-group-header';
    header.innerHTML = `<span class="todo-group-title">${g.label}</span><span class="todo-group-count">${allItems.length}</span><span class="todo-group-arrow">›</span>`;
    header.addEventListener('click', () => {
      card.classList.toggle('open');
      cs[gKey] = card.classList.contains('open');
      localStorage.setItem(collapseKey, JSON.stringify(cs));
    });

    const body = document.createElement('div');
    body.className = 'todo-group-body';
    body.dataset.bucket = gKey;

    body.addEventListener('dragover', e => {
      e.preventDefault();
      body.classList.add('drag-over');
      if (!card.classList.contains('open')) card.classList.add('open');
      const afterEl = getDragAfterElement(body, e.clientY);
      if (dragPlaceholder) {
        if (afterEl) body.insertBefore(dragPlaceholder, afterEl);
        else body.appendChild(dragPlaceholder);
      }
    });
    body.addEventListener('dragleave', e => {
      if (!body.contains(e.relatedTarget)) body.classList.remove('drag-over');
    });
    body.addEventListener('drop', async e => {
      e.preventDefault();
      body.classList.remove('drag-over');
      if (!dragItemId) return;
      const targetBucket = body.dataset.bucket;
      if (targetBucket === 'flagged') return;
      const newDate = bucketToDate(targetBucket);
      const items = await getTodoItems();
      const idx = items.findIndex(i=>i.id===dragItemId);
      if (idx !== -1) {
        items[idx].dueDate = newDate;
        if (items[idx].completed && targetBucket !== 'later') {
          items[idx].completed = false;
          items[idx].completedDate = null;
        }
        await saveTodoItems(items);
      }
      dragItemId = null;
      renderTodo();
    });

    if (!allItems.length) {
      const empty = document.createElement('div');
      empty.className = 'todo-empty';
      empty.textContent = 'Nothing here — drag tasks here';
      body.appendChild(empty);
    } else {
      allItems.forEach(item => renderTodoItem(item, body));
    }

    card.appendChild(header);
    card.appendChild(body);
    container.appendChild(card);
  });
}

function renderTodoItem(item, container) {
  const cat = getCat(item.catId);
  const isRunning = activeTask && activeTask.id === item.id;
  const totalSessionSecs = (item.sessions||[]).reduce((s,sess)=>s+(sess.duration||0),0);

  const div = document.createElement('div');
  div.className = `todo-item${isRunning?' running':''}${item.completed?' completed':''}`;
  div.draggable = !item.completed;
  div.dataset.id = item.id;

  div.addEventListener('dragstart', e => {
    dragItemId = item.id;
    div.classList.add('dragging');
    dragGhost = div.cloneNode(true);
    dragGhost.style.cssText = `position:fixed;top:-9999px;opacity:.85;pointer-events:none;width:${div.offsetWidth}px;background:#fff;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.15);`;
    document.body.appendChild(dragGhost);
    e.dataTransfer.setDragImage(dragGhost, 30, 20);
    e.dataTransfer.effectAllowed = 'move';
    dragPlaceholder = document.createElement('div');
    dragPlaceholder.className = 'todo-drag-placeholder';
    dragPlaceholder.style.cssText = `height:${div.offsetHeight}px;background:var(--mint);border:2px dashed var(--sage);border-radius:var(--radius-sm);margin:3px 0;transition:height .15s;`;
    setTimeout(() => { div.style.opacity = '0.35'; }, 0);
  });

  div.addEventListener('dragend', () => {
    div.classList.remove('dragging');
    div.style.opacity = '';
    if (dragGhost) { dragGhost.remove(); dragGhost = null; }
    if (dragPlaceholder && dragPlaceholder.parentNode) { dragPlaceholder.remove(); dragPlaceholder = null; }
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
  });

  const catOptsHtml = makeCatOptions(item.catId);
  const dueVal = item.dueDate || '';

  div.innerHTML = `
    <div class="todo-drag-handle" title="Drag to move">⠿</div>
    <div class="todo-check${item.completed?' done':''}" data-id="${item.id}">${item.completed?'✓':''}</div>
    <div class="todo-info">
      <input class="todo-title-input${item.completed?' strikethrough':''}" value="${item.title.replace(/"/g,'&quot;').replace(/'/g,'&#39;')}" data-id="${item.id}" ${item.completed?'disabled':''} placeholder="Task name">
      <div class="todo-meta">
        <select class="todo-cat-select" data-id="${item.id}" style="border-left:3px solid ${cat.color}">${catOptsHtml}</select>
        <input class="todo-date-input" type="date" value="${dueVal}" data-id="${item.id}" title="Due date" ${item.completed?'disabled':''}>
        ${item.source==='flagged'?'<span class="todo-source">📧</span>':''}
        ${totalSessionSecs>0?`<span class="todo-total-time">⏱ ${fmtSecs(totalSessionSecs)}</span>`:''}
      </div>
    </div>
    <div class="todo-actions">
      ${!item.completed?`<button class="todo-start-btn ${isRunning?'stop':''}" data-id="${item.id}" title="${isRunning?'Stop':'Start focus'}">${isRunning?'■':'▶'}</button>`:''}
      <button class="todo-del-btn" data-id="${item.id}" title="Delete">✕</button>
    </div>`;

  // Inline title edit
  div.querySelector('.todo-title-input').addEventListener('change', async e => {
    const newTitle = e.target.value.trim();
    if (!newTitle) return;
    const items = await getTodoItems();
    const idx = items.findIndex(i=>i.id===item.id);
    if (idx !== -1) { items[idx].title = newTitle; await saveTodoItems(items); }
  });

  // Category change
  div.querySelector('.todo-cat-select').addEventListener('change', async e => {
    const items = await getTodoItems();
    const idx = items.findIndex(i=>i.id===item.id);
    if (idx !== -1) {
      items[idx].catId = e.target.value;
      await saveTodoItems(items);
      renderTodo();
    }
  });

  // Date change
  div.querySelector('.todo-date-input').addEventListener('change', async e => {
    const items = await getTodoItems();
    const idx = items.findIndex(i=>i.id===item.id);
    if (idx !== -1) { items[idx].dueDate = e.target.value || null; await saveTodoItems(items); renderTodo(); }
  });

  // Complete toggle
  div.querySelector('.todo-check').addEventListener('click', async () => {
    const items = await getTodoItems();
    const idx = items.findIndex(i=>i.id===item.id);
    if (idx===-1) return;
    if (!items[idx].completed) {
      items[idx].completed = true;
      items[idx].completedDate = getTodayKey();
      if (isRunning) {
        await stopTask('done');
      } else {
        // Log total session time to timeline if task has sessions
        const sessions = items[idx].sessions || [];
        const totalDuration = sessions.reduce((s,sess)=>s+(sess.duration||0),0);
        if (totalDuration > 0) {
          const now = new Date();
          const startTimeStr = String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
          await dbSaveManualTask({
            id: uid(),
            title: items[idx].title,
            catId: items[idx].catId,
            date: getTodayKey(),
            startTime: startTimeStr,
            endTime: startTimeStr,
            duration: totalDuration,
            notes: 'Completed task',
            createdAt: Date.now()
          });
        }
      }
    } else {
      items[idx].completed = false;
      items[idx].completedDate = null;
    }
    await saveTodoItems(items);
    renderTodo();
  });

  // Start/stop
  div.querySelector('.todo-start-btn')?.addEventListener('click', async () => {
    if (isRunning) await stopTask('done');
    else await startTask(item.id);
  });

  // Delete
  div.querySelector('.todo-del-btn').addEventListener('click', async () => {
    if (!confirm('Delete this task?')) return;
    if (isRunning) await stopTask('cancel');
    const items = await getTodoItems();
    await saveTodoItems(items.filter(i=>i.id!==item.id));
    renderTodo();
  });

  container.appendChild(div);
}

document.getElementById('todoAddBtn').addEventListener('click', async () => {
  const btn = document.getElementById('todoAddBtn');
  const title = document.getElementById('todoTitleInput').value.trim();
  const catId = document.getElementById('todoCatSelect').value || 'uncategorised';
  const dueDate = document.getElementById('todoDateInput').value || null;
  if (!title) { document.getElementById('todoTitleInput').focus(); return; }
  btn.textContent = '…'; btn.disabled = true;
  try {
    const newItem = { id:uid(), title, catId, dueDate, completed:false, completedDate:null, sessions:[], createdAt:Date.now(), source:'manual' };
    await dbSaveTodos([newItem]);
    document.getElementById('todoTitleInput').value = '';
    document.getElementById('todoDateInput').value = '';
    await renderTodo();
  } catch(e) {
    console.error('Add task error:', e);
    alert('Could not save task: ' + e.message);
  } finally {
    btn.textContent = '+ Add'; btn.disabled = false;
  }
});
document.getElementById('todoTitleInput').addEventListener('keydown', e => { if(e.key==='Enter') document.getElementById('todoAddBtn').click(); });

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
  document.getElementById('importJsonBtn').onclick=()=>{const input=document.createElement('input');input.type='file';input.accept='.json';input.onchange=async e=>{const file=e.target.files[0];if(!file)return;const text=await file.text();try{const data=JSON.parse(text);if(data.manualTasks){await dbSaveTodos(data.manualTasks || []);}if(data.categories){await dbSaveCategories(data.categories || []);}await loadCategories();alert('Data imported!');showSection('overview');}catch{alert('Import failed.');}};input.click();};
  document.getElementById('clearDataBtn').onclick=async()=>{if(confirm('Delete ALL data?')){try{await sbFetch('todos?user_id=eq.'+sbUser()?.id,'DELETE');await sbFetch('manual_tasks?user_id=eq.'+sbUser()?.id,'DELETE');await sbFetch('habits?user_id=eq.'+sbUser()?.id,'DELETE');await sbFetch('habit_logs?user_id=eq.'+sbUser()?.id,'DELETE');}catch(e){console.warn(e);}await loadCategories();alert('Cleared.');renderExport();}};
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
async function saveOutlookTokens(t){t.stored_at=Date.now();localStorage.setItem('ts_outlookTokens',JSON.stringify(t));}
async function getOutlookTokens(){try{const r=localStorage.getItem('ts_outlookTokens');return r?JSON.parse(r):null;}catch{return null;}}
async function clearOutlookTokens(){localStorage.removeItem('ts_outlookTokens');localStorage.removeItem('ts_outlookProfile');}
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
    let profile=null;try{const rp=localStorage.getItem('ts_outlookProfile');profile=rp?JSON.parse(rp):null;}catch{}
    if(!profile){profile=await graph('/me',{$select:'displayName,mail,userPrincipalName'});localStorage.setItem('ts_outlookProfile',JSON.stringify(profile));}
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

const HABIT_CATEGORY_GROUPS = [
  { id:'health',       label:'🏃 Health',       colour:'#34d399' },
  { id:'productivity', label:'🎯 Productivity',  colour:'#6B9E4E' },
  { id:'personal',     label:'👤 Personal',      colour:'#818cf8' },
  { id:'other',        label:'⭐ Other',          colour:'#E8A020' },
];

const HABIT_MOTIVATIONS = [
  '"One day becomes a week."','"Consistency beats intensity."',
  '"Small actions create extraordinary results."','"Slow and steady focus."',
  '"Show up. Every day."','"Progress is a practice."','"Build the life you want, one habit at a time."'
];

const ACHIEVEMENTS_DEF = [
  { id:'first_habit',   icon:'🌱', label:'First Habit',      desc:'Created your first habit',            check:(h,l)=>h.length>=1 },
  { id:'first_complete',icon:'✅', label:'First Complete',   desc:'Completed a habit for the first time', check:(h,l)=>Object.values(l).some(d=>Object.keys(d).length>=1) },
  { id:'streak_7',      icon:'🔥', label:'7 Day Streak',     desc:'Maintained a 7-day streak',            check:(h,l)=>h.some(hb=>getHabitStreak(hb.id,hb.frequency,hb.timesPerWeek,l)>=7) },
  { id:'streak_30',     icon:'💎', label:'30 Day Streak',    desc:'Maintained a 30-day streak',           check:(h,l)=>h.some(hb=>getHabitStreak(hb.id,hb.frequency,hb.timesPerWeek,l)>=30) },
  { id:'habits_3',      icon:'🎯', label:'Triple Threat',    desc:'Created 3 or more habits',             check:(h,l)=>h.length>=3 },
  { id:'perfect_week',  icon:'🏆', label:'Perfect Week',     desc:'Completed all habits for 7 days straight', check:(h,l)=>{ if(!h.length)return false; const today=getTodayKey(); for(let i=0;i<7;i++){const d=new Date();d.setDate(d.getDate()-i);const k=localKey(d);const allDone=h.filter(hb=>hb.frequency==='daily').every(hb=>l[hb.id]?.[k]);if(!allDone)return false;} return h.filter(hb=>hb.frequency==='daily').length>0; }},
  { id:'early_adopter', icon:'🦥', label:'Early Sloth',      desc:'Used Time Sloth in the first week',    check:(h,l)=>true },
  { id:'habits_5',      icon:'🌟', label:'Habit Master',     desc:'Created 5 or more habits',             check:(h,l)=>h.length>=5 },
];

async function getHabits() { return dbGetHabits(); }
async function saveHabits(h) { await dbSaveHabits(h); }
async function getHabitLogs() { return dbGetHabitLogs(); }
async function saveHabitLogs(l) { /* logs saved individually via toggleHabitToday */ }

function getHabitStreak(habitId, frequency, timesPerWeek, logs) {
  const today = getTodayKey();
  let streak = 0;
  if (frequency === 'daily') {
    let d = new Date();
    for (let i = 0; i < 365; i++) {
      const key = localKey(d);
      if (key > today) { d.setDate(d.getDate()-1); continue; }
      if (logs[habitId]?.[key]) { streak++; d.setDate(d.getDate()-1); }
      else if (key === today) { d.setDate(d.getDate()-1); }
      else break;
    }
  } else if (frequency === 'weekly') {
    const tw = timesPerWeek || 3;
    let weekStart = new Date();
    const dow = weekStart.getDay();
    weekStart.setDate(weekStart.getDate() - (dow === 0 ? 6 : dow - 1));
    for (let w = 0; w < 52; w++) {
      let count = 0;
      for (let d = 0; d < 7; d++) { const day = new Date(weekStart); day.setDate(weekStart.getDate()+d); const key = localKey(day); if(key<=today && logs[habitId]?.[key]) count++; }
      if (count >= tw || (w === 0 && count > 0)) { streak++; weekStart.setDate(weekStart.getDate()-7); }
      else break;
    }
  } else if (frequency === 'monthly') {
    let d = new Date();
    for (let m = 0; m < 24; m++) {
      const year=d.getFullYear(),month=d.getMonth(),daysInMonth=new Date(year,month+1,0).getDate();
      let found=false;
      for(let day=1;day<=daysInMonth;day++){const key=`${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;if(key<=today&&logs[habitId]?.[key]){found=true;break;}}
      if(found){streak++;d.setMonth(d.getMonth()-1);}else if(m===0){d.setMonth(d.getMonth()-1);}else break;
    }
  }
  return streak;
}

function getLongestStreak(habitId, frequency, timesPerWeek, logs) {
  // Check all historical records for max streak
  const entries = Object.keys(logs[habitId]||{}).sort();
  if (!entries.length) return 0;
  let max = 0, current = 1;
  for (let i = 1; i < entries.length; i++) {
    const prev = new Date(entries[i-1]+'T12:00:00'), curr = new Date(entries[i]+'T12:00:00');
    const diff = (curr - prev) / 86400000;
    if (diff === 1) { current++; } else { max = Math.max(max, current); current = 1; }
  }
  return Math.max(max, current);
}

function getCompletionRate(habitId, logs) {
  const entries = Object.keys(logs[habitId]||{});
  if (!entries.length) return 0;
  const sorted = entries.sort();
  const first = new Date(sorted[0]+'T12:00:00');
  const today = new Date(getTodayKey()+'T12:00:00');
  const daysSince = Math.max(1, Math.round((today - first) / 86400000) + 1);
  return Math.round((entries.length / daysSince) * 100);
}

function getWeekDays7() {
  const days = [];
  for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate()-i); days.push({ key: localKey(d), label: d.toLocaleDateString('en-GB',{weekday:'short'})[0] }); }
  return days;
}

function isHabitDoneToday(habitId, logs) { return !!(logs[habitId]?.[getTodayKey()]); }

async function toggleHabitToday(habitId) {
  const logs = await getHabitLogs();
  const today = getTodayKey();
  const isDone = !!(logs[habitId]?.[today]);
  await dbToggleHabitLog(habitId, today, !isDone);
  renderHabits();
}

// ── Habit modal state
let selectedHabitEmoji = '🌟';
let selectedHabitColour = '#6B9E4E';
let weeklyCountVal = 3;
let editingHabitId = null;
let viewingHabitId = null;

async function renderHabits() {
  const habits = await getHabits();
  const logs = await getHabitLogs();
  const today = getTodayKey();
  const container = document.getElementById('habitPageContent');
  if (!container) return;

  const doneToday = habits.filter(h => isHabitDoneToday(h.id, logs)).length;
  const totalActive = habits.filter(h => !h.completed).length;
  const allStreaks = habits.map(h => getHabitStreak(h.id, h.frequency, h.timesPerWeek, logs));
  const maxStreak = allStreaks.length ? Math.max(...allStreaks) : 0;
  const avgRate = habits.length ? Math.round(habits.reduce((s,h)=>s+getCompletionRate(h.id,logs),0)/habits.length) : 0;
  const longestEver = habits.length ? Math.max(...habits.map(h=>getLongestStreak(h.id,h.frequency,h.timesPerWeek,logs))) : 0;

  // Sloth evolution based on max streak
  const evoStage = maxStreak >= 30 ? 3 : maxStreak >= 14 ? 2 : maxStreak >= 7 ? 1 : 0;
  const evoNames = ['Sleepy Sloth','Focused Sloth','Active Sloth','Hero Sloth'];
  const evoImages = ['sloth-idle.png', 'Locked in sloth .png', 'Running sloth .png', 'Business Sloth .png'];
  const evoNext = [7,14,30,null];
  const daysToNext = evoNext[evoStage] ? evoNext[evoStage] - maxStreak : null;

  // Achievements
  const unlocked = ACHIEVEMENTS_DEF.filter(a => a.check(habits, logs));

  container.innerHTML = `
    <!-- Hero -->
    <div class="habit-hero">
      <div class="habit-hero-left">
        <div class="habit-hero-title">Build Your Habits 🔥</div>
        <div class="habit-hero-sub">Small consistent actions create extraordinary results.</div>
        <div class="habit-hero-stats">
          <div class="habit-hero-stat"><div class="habit-hero-stat-val">${doneToday}/${totalActive}</div><div class="habit-hero-stat-label">Done Today</div></div>
          <div class="habit-hero-stat"><div class="habit-hero-stat-val">${maxStreak}</div><div class="habit-hero-stat-label">Best Streak</div></div>
          <div class="habit-hero-stat"><div class="habit-hero-stat-val">${avgRate}%</div><div class="habit-hero-stat-label">Completion</div></div>
        </div>
      </div>
      <div class="habit-hero-centre">
        <img src="${evoImages[evoStage]}" style="height:140px;width:auto;object-fit:contain;filter:drop-shadow(0 8px 24px rgba(0,0,0,.2));" alt="${evoNames[evoStage]}">
        <div class="habit-evo-badge">${evoNames[evoStage]}</div>
        ${daysToNext ? `<div class="habit-evo-next">Next: ${evoNames[evoStage+1]} in ${daysToNext} day${daysToNext!==1?'s':''}</div>` : '<div class="habit-evo-next">🏆 Maximum Evolution!</div>'}
      </div>
      <div class="habit-hero-right">
        <button class="btn btn-gold" id="addHabitBtn" style="font-size:14px;padding:11px 22px;font-weight:800;">+ New Habit</button>
        <div class="habit-today-progress">
          <div class="habit-today-label">Today's Goal</div>
          <div class="habit-today-nums">${doneToday} / ${totalActive} Habits</div>
          <div class="habit-today-bar"><div class="habit-today-fill" style="width:${totalActive?Math.round(doneToday/totalActive*100):0}%"></div></div>
        </div>
      </div>
    </div>

    <!-- Stats row -->
    <div class="habit-stats-row">
      <div class="habit-stat-card"><div class="habit-stat-icon">🔥</div><div class="habit-stat-val">${maxStreak}</div><div class="habit-stat-label">Current Streak</div></div>
      <div class="habit-stat-card"><div class="habit-stat-icon">✅</div><div class="habit-stat-val">${doneToday} / ${totalActive}</div><div class="habit-stat-label">Completed Today</div></div>
      <div class="habit-stat-card"><div class="habit-stat-icon">📈</div><div class="habit-stat-val">${avgRate}%</div><div class="habit-stat-label">Completion Rate</div></div>
      <div class="habit-stat-card"><div class="habit-stat-icon">🏆</div><div class="habit-stat-val">${longestEver}</div><div class="habit-stat-label">Longest Streak</div></div>
    </div>

    <!-- Habit groups -->
    <div id="habitGroupsContainer"></div>

    <!-- Achievements -->
    <div class="card" style="margin-top:8px;">
      <div class="card-header"><div class="card-title">🏆 Achievements</div><div class="card-sub">${unlocked.length} / ${ACHIEVEMENTS_DEF.length} unlocked</div></div>
      <div class="habit-achievements-grid">
        ${ACHIEVEMENTS_DEF.map(a => {
          const earned = unlocked.find(u=>u.id===a.id);
          return `<div class="habit-achievement${earned?'':' locked'}">
            <div class="habit-ach-icon">${a.icon}</div>
            <div class="habit-ach-label">${a.label}</div>
            <div class="habit-ach-desc">${a.desc}</div>
            ${!earned?'<div class="habit-ach-lock">🔒</div>':''}
          </div>`;
        }).join('')}
      </div>
    </div>
  `;

  // Wire add button - use setTimeout since button is in dynamic HTML
  setTimeout(() => {
    const btn = document.getElementById('addHabitBtn');
    if (btn) btn.addEventListener('click', () => {
      document.getElementById('habitDeleteBtn').style.display = 'none';
      openHabitModal();
    });
  }, 50);

  // Render habit groups
  renderHabitGroups(habits, logs);
}

function renderHabitGroups(habits, logs) {
  const container = document.getElementById('habitGroupsContainer');
  if (!container) return;

  if (!habits.length) {
    container.innerHTML = `
      <div class="card" style="margin-bottom:20px;">
        <div style="text-align:center;padding:60px 24px;display:flex;flex-direction:column;align-items:center;gap:16px;">
          <img src="Locked in sloth .png" style="height:120px;width:auto;filter:drop-shadow(0 4px 16px rgba(0,0,0,.1));" alt="">
          <div style="font-family:'Plus Jakarta Sans',sans-serif;font-size:20px;font-weight:800;color:var(--forest);">Your sloth is ready to grow.</div>
          <div style="font-size:14px;color:var(--grey);line-height:1.6;max-width:360px;">Create your first habit and start building momentum.<br>Small steps, taken consistently, create extraordinary results.</div>
          <button class="btn btn-gold" style="padding:12px 28px;font-size:14px;font-weight:800;" onclick="document.getElementById('addHabitBtn').click()">+ Create First Habit</button>
        </div>
      </div>`;
    return;
  }

  // Group habits by category
  const grouped = {};
  HABIT_CATEGORY_GROUPS.forEach(g => { grouped[g.id] = []; });
  habits.forEach(h => {
    const gid = h.groupId || 'other';
    if (!grouped[gid]) grouped[gid] = [];
    grouped[gid].push(h);
  });

  container.innerHTML = '';
  HABIT_CATEGORY_GROUPS.forEach(group => {
    const groupHabits = grouped[group.id] || [];
    if (!groupHabits.length) return;

    const section = document.createElement('div');
    section.className = 'habit-group-section';
    section.innerHTML = `<div class="habit-group-label" style="color:${group.colour}">${group.label}</div>`;

    const grid = document.createElement('div');
    grid.className = 'habit-cards-grid';
    groupHabits.forEach(habit => grid.appendChild(buildHabitCard(habit, logs)));
    section.appendChild(grid);
    container.appendChild(section);
  });
}

function buildHabitCard(habit, logs) {
  const done = isHabitDoneToday(habit.id, logs);
  const streak = getHabitStreak(habit.id, habit.frequency, habit.timesPerWeek, logs);
  const rate = getCompletionRate(habit.id, logs);
  const longest = getLongestStreak(habit.id, habit.frequency, habit.timesPerWeek, logs);
  const weekDays = getWeekDays7();
  const nextMilestone = streak < 7 ? 7 : streak < 14 ? 14 : streak < 30 ? 30 : streak < 100 ? 100 : null;
  const freqLabel = habit.frequency==='daily'?'Daily':habit.frequency==='monthly'?'Monthly':`${habit.timesPerWeek}× / week`;

  const card = document.createElement('div');
  card.className = `habit-wide-card${done?' done':''}`;
  if (done) card.style.borderColor = habit.colour;
  if (done) card.style.background = habit.colour + '08';

  // Progress ring SVG
  const r = 28, circ = 2*Math.PI*r;
  const pct = Math.min(100, rate);
  const dash = (pct/100)*circ;

  card.innerHTML = `
    <div class="habit-card-left">
      <div class="habit-card-ring" style="--ring-colour:${habit.colour}">
        <svg width="72" height="72" viewBox="0 0 72 72">
          <circle cx="36" cy="36" r="${r}" fill="none" stroke="#EDE8E0" stroke-width="6"/>
          <circle cx="36" cy="36" r="${r}" fill="none" stroke="${habit.colour}" stroke-width="6"
            stroke-dasharray="${dash} ${circ}" stroke-dashoffset="${circ/4}"
            stroke-linecap="round" transform="rotate(-90 36 36)"/>
        </svg>
        <div class="habit-card-ring-inner">${done?'✓':habit.emoji}</div>
      </div>
    </div>
    <div class="habit-card-body">
      <div class="habit-card-top-row">
        <div>
          <div class="habit-card-name">${habit.name}</div>
          <div class="habit-card-meta">
            <span class="habit-card-freq">${freqLabel}</span>
            ${streak>0?`<span class="habit-card-streak">🔥 ${streak} day streak</span>`:''}
          </div>
        </div>
        <button class="habit-edit-btn" data-id="${habit.id}">⋯</button>
      </div>
      <div class="habit-card-stats-row">
        <div class="habit-card-stat"><div class="habit-card-stat-val">${rate}%</div><div class="habit-card-stat-label">Success</div></div>
        <div class="habit-card-stat"><div class="habit-card-stat-val">${longest}</div><div class="habit-card-stat-label">Best</div></div>
        ${nextMilestone?`<div class="habit-card-stat"><div class="habit-card-stat-val">${nextMilestone-streak}d</div><div class="habit-card-stat-label">To ${nextMilestone} days</div></div>`:'<div class="habit-card-stat"><div class="habit-card-stat-val">🏆</div><div class="habit-card-stat-label">Legend!</div></div>'}
      </div>
      <!-- Weekly tracker -->
      <div class="habit-week-tracker">
        ${weekDays.map(day => {
          const done2 = logs[habit.id]?.[day.key];
          const isToday2 = day.key === getTodayKey();
          const isPast = day.key < getTodayKey();
          return `<div class="habit-week-day${done2?' done':''}${isToday2?' today':''}${isPast&&!done2?' missed':''}" style="${done2?'background:'+habit.colour+';':''}" title="${day.key}">${day.label}</div>`;
        }).join('')}
      </div>
    </div>
    <div class="habit-card-action">
      <button class="habit-complete-btn${done?' done':''}" data-id="${habit.id}" style="${done?'background:'+habit.colour+';border-color:'+habit.colour+';':' border-color:'+habit.colour+';color:'+habit.colour+';'}">
        ${done ? '✓ Done!' : 'Complete Today'}
      </button>
    </div>`;

  card.querySelector('.habit-edit-btn').addEventListener('click', e => {
    e.stopPropagation();
    openHabitModal(habit);
  });
  card.querySelector('.habit-complete-btn').addEventListener('click', () => toggleHabitToday(habit.id));

  return card;
}

function openHabitModal(habitToEdit = null) {
  editingHabitId = habitToEdit ? habitToEdit.id : null;
  selectedHabitEmoji = habitToEdit ? habitToEdit.emoji : '🌟';
  selectedHabitColour = habitToEdit ? habitToEdit.colour : '#6B9E4E';
  weeklyCountVal = habitToEdit?.timesPerWeek || 3;

  document.getElementById('habitModalTitle').textContent = habitToEdit ? 'Edit Habit' : 'New Habit';
  document.getElementById('habitNameInput').value = habitToEdit ? habitToEdit.name : '';
  document.getElementById('habitDeleteBtn').style.display = habitToEdit ? '' : 'none';

  // Group select
  const groupSel = document.getElementById('habitGroupSelect');
  if (groupSel) groupSel.value = habitToEdit?.groupId || 'other';

  const freq = habitToEdit?.frequency || 'daily';
  document.querySelectorAll('input[name="habitFreq"]').forEach(r => { r.checked = r.value === freq; });
  document.getElementById('weeklyCountWrap').style.display = freq === 'weekly' ? 'flex' : 'none';
  document.getElementById('weeklyCount').textContent = weeklyCountVal;

  const emojiGrid = document.getElementById('habitEmojiGrid');
  emojiGrid.innerHTML = HABIT_EMOJIS.map(e =>
    `<div class="habit-emoji-btn${e===selectedHabitEmoji?' selected':''}" data-emoji="${e}">${e}</div>`).join('');
  emojiGrid.querySelectorAll('.habit-emoji-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedHabitEmoji = btn.getAttribute('data-emoji');
      emojiGrid.querySelectorAll('.habit-emoji-btn').forEach(b=>b.classList.remove('selected'));
      btn.classList.add('selected');
      document.getElementById('habitEmojiPreview').textContent = selectedHabitEmoji;
    });
  });
  document.getElementById('habitEmojiPreview').textContent = selectedHabitEmoji;

  const colourGrid = document.getElementById('habitColourGrid');
  colourGrid.innerHTML = HABIT_COLOURS.map(c =>
    `<div class="habit-colour-swatch${c===selectedHabitColour?' selected':''}" style="background:${c}" data-colour="${c}"></div>`).join('');
  colourGrid.querySelectorAll('.habit-colour-swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      selectedHabitColour = sw.getAttribute('data-colour');
      colourGrid.querySelectorAll('.habit-colour-swatch').forEach(s=>s.classList.remove('selected'));
      sw.classList.add('selected');
    });
  });

  document.getElementById('habitModal').style.display = 'flex';
}

document.querySelectorAll('input[name="habitFreq"]').forEach(r => {
  r.addEventListener('change', () => {
    document.getElementById('weeklyCountWrap').style.display = r.value==='weekly' ? 'flex' : 'none';
  });
});
document.getElementById('weeklyMinus').addEventListener('click', () => { if(weeklyCountVal>1){weeklyCountVal--;document.getElementById('weeklyCount').textContent=weeklyCountVal;} });
document.getElementById('weeklyPlus').addEventListener('click', () => { if(weeklyCountVal<7){weeklyCountVal++;document.getElementById('weeklyCount').textContent=weeklyCountVal;} });
document.getElementById('habitModalCancel').addEventListener('click', () => { document.getElementById('habitModal').style.display='none'; });

document.getElementById('habitModalSave').addEventListener('click', async () => {
  const name = document.getElementById('habitNameInput').value.trim();
  if (!name) { document.getElementById('habitNameInput').focus(); return; }
  const saveBtn = document.getElementById('habitModalSave');
  saveBtn.textContent = 'Saving…'; saveBtn.disabled = true;
  try {
    const frequency = document.querySelector('input[name="habitFreq"]:checked').value;
    const groupId = document.getElementById('habitGroupSelect')?.value || 'other';
    if (editingHabitId) {
      // Update existing
      await dbSaveHabits([{ id:editingHabitId, name, emoji:selectedHabitEmoji, colour:selectedHabitColour, frequency, timesPerWeek:weeklyCountVal, groupId, createdAt:Date.now() }]);
    } else {
      // Create new
      await dbSaveHabits([{ id:uid(), name, emoji:selectedHabitEmoji, colour:selectedHabitColour, frequency, timesPerWeek:weeklyCountVal, groupId, createdAt:Date.now() }]);
    }
    document.getElementById('habitModal').style.display = 'none';
    renderHabits();
  } catch(e) {
    alert('Could not save habit: ' + e.message);
  } finally {
    saveBtn.textContent = 'Save'; saveBtn.disabled = false;
  }
});

document.getElementById('habitDeleteBtn').addEventListener('click', async () => {
  if (!editingHabitId || !confirm('Delete this habit and all its history?')) return;
  try {
    await dbDeleteHabit(editingHabitId);
    document.getElementById('habitModal').style.display = 'none';
    renderHabits();
  } catch(e) {
    alert('Could not delete habit: ' + e.message);
  }
});

async function renderHabitCalendar(habitId) {
  const habits = await getHabits();
  const logs = await getHabitLogs();
  const habit = habits.find(h=>h.id===habitId);
  if (!habit) return;
  document.getElementById('habitCalTitle').textContent = `${habit.emoji} ${habit.name}`;
  document.getElementById('habitCalSub').textContent = `Streak: ${getHabitStreak(habitId,habit.frequency,habit.timesPerWeek,logs)} · Rate: ${getCompletionRate(habitId,logs)}%`;
  const now=new Date(),year=now.getFullYear(),month=now.getMonth();
  const firstDay=new Date(year,month,1),daysInMonth=new Date(year,month+1,0).getDate();
  const startDow=(firstDay.getDay()+6)%7,today=getTodayKey();
  const calGrid=document.getElementById('habitCalGrid');
  const monthName=now.toLocaleDateString('en-GB',{month:'long',year:'numeric'});
  let html=`<div style="grid-column:1/-1;text-align:center;font-family:'Plus Jakarta Sans',sans-serif;font-weight:700;font-size:14px;color:var(--forest);margin-bottom:8px;">${monthName}</div>`;
  ['M','T','W','T','F','S','S'].forEach(d=>{html+=`<div class="habit-cal-header">${d}</div>`;});
  for(let i=0;i<startDow;i++)html+=`<div></div>`;
  for(let day=1;day<=daysInMonth;day++){
    const key=`${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const done=!!(logs[habitId]?.[key]),isToday=key===today,isFuture=key>today,isPast=key<today;
    let cls='habit-cal-day',style='',content=day;
    if(isFuture){cls+=' future';}
    else if(done){cls+=' done';style=`background:${habit.colour};`;content='✓';}
    else if(isPast){cls+=' missed';content=day;}
    if(isToday)cls+=' today';
    html+=`<div class="${cls}" style="${style}">${content}</div>`;
  }
  calGrid.innerHTML=html;
}

document.getElementById('habitCalClose').addEventListener('click', () => {
  document.getElementById('habitCalendarDetail').style.display='none';
});


// ─── Auth UI ──────────────────────────────────────────────────
let _authTab = 'login';

function switchAuthTab(tab) {
  _authTab = tab;
  const loginBtn = document.getElementById('authTabLogin');
  const signupBtn = document.getElementById('authTabSignup');
  loginBtn.style.cssText = `flex:1;padding:8px;border-radius:9px;border:none;font-family:'Inter',sans-serif;font-size:13px;font-weight:700;cursor:pointer;background:${tab==='login'?'#fff':'transparent'};color:${tab==='login'?'var(--forest)':'var(--grey)'};box-shadow:${tab==='login'?'var(--shadow)':'none'};`;
  signupBtn.style.cssText = `flex:1;padding:8px;border-radius:9px;border:none;font-family:'Inter',sans-serif;font-size:13px;font-weight:600;cursor:pointer;background:${tab==='signup'?'#fff':'transparent'};color:${tab==='signup'?'var(--forest)':'var(--grey)'};box-shadow:${tab==='signup'?'var(--shadow)':'none'};`;
  document.getElementById('authSubmitBtn').textContent = tab==='login' ? 'Sign In' : 'Create Account';
  document.getElementById('authSignupNote').style.display = tab==='signup' ? '' : 'none';
  document.getElementById('authError').style.display = 'none';
}

async function handleAuthSubmit() {
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  const btn = document.getElementById('authSubmitBtn');
  const errEl = document.getElementById('authError');
  errEl.style.display = 'none';
  if (!email || !password) { errEl.textContent = 'Please enter your email and password.'; errEl.style.display = ''; return; }
  btn.textContent = 'Please wait…'; btn.disabled = true;
  try {
    if (_authTab === 'login') {
      await sbSignIn(email, password);
    } else {
      await sbSignUp(email, password);
      await sbSignIn(email, password);
    }
    await bootApp();
  } catch(e) {
    errEl.textContent = e.message;
    errEl.style.display = '';
    btn.textContent = _authTab==='login' ? 'Sign In' : 'Create Account';
    btn.disabled = false;
  }
}

async function handleSignOut() {
  if (!confirm('Sign out of Time Sloth?')) return;
  await sbSignOut();
  document.getElementById('authScreen').style.display = 'flex';
  document.getElementById('userBar').style.display = 'none';
  document.getElementById('authEmail').value = '';
  document.getElementById('authPassword').value = '';
}

async function bootApp() {
  document.getElementById('authScreen').style.display = 'none';
  const user = sbUser();
  if (user) {
    document.getElementById('userBar').style.display = 'flex';
    document.getElementById('userBarEmail').textContent = user.email;
  }
  try {
    const wasCallback = await handleOAuthCallback();
    await loadCategories();
    _cachedSettings = await getSettings();
    await loadActiveTask();
    populateTodoCatSelect();
    setSloth('heroSlothWrap', activeTask ? 'active' : 'idle', 180);
    setSloth('companionSlothWrap', activeTask ? 'active' : 'idle', 140);
    setSloth('focusSlothWrap', 'active', 200);
    showSection('overview');
    if (wasCallback) showSection('outlook');
    setInterval(async()=>{
      try {
        await sbGetSession();
        await loadCategories();
        _cachedSettings = await getSettings();
        const active = document.querySelector('.nav-item.active')?.getAttribute('data-section');
        if(active) showSection(active);
      } catch(e){ console.warn('Refresh error:', e); }
    }, 60000);
    setInterval(syncFlaggedEmails, 5*60*1000);
  } catch(e) {
    console.error('Boot error:', e);
    try { showSection('overview'); } catch(e2){}
  }
}

// Enter key support on auth
setTimeout(() => {
  const pwdEl = document.getElementById('authPassword');
  const emailEl = document.getElementById('authEmail');
  if (pwdEl) pwdEl.addEventListener('keydown', e => { if(e.key==='Enter') handleAuthSubmit(); });
  if (emailEl) emailEl.addEventListener('keydown', e => { if(e.key==='Enter') pwdEl?.focus(); });
}, 100);

// ─── Boot ─────────────────────────────────────────────────────
(async()=>{
  try {
    const session = await sbGetSession();
    if (session && sbUser()) {
      await bootApp();
    } else {
      document.getElementById('authScreen').style.display = 'flex';
    }
  } catch(e) {
    console.error('Boot error:', e);
    document.getElementById('authScreen').style.display = 'flex';
  }
})();
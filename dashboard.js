// ============================================================
// Sloth Tracker Web — dashboard.js
// localStorage edition — drop-in for the extension version
// ============================================================

// ─── localStorage shim (mirrors chrome.storage.local API) ────
// All functions are async and return plain objects, exactly
// like the extension did, so all render logic is unchanged.

const store = {
  async get(keys) {
    const result = {};
    const keyList = Array.isArray(keys) ? keys : (typeof keys === 'string' ? [keys] : Object.keys(keys));
    for (const k of keyList) {
      try {
        const raw = localStorage.getItem('st_' + k);
        result[k] = raw !== null ? JSON.parse(raw) : undefined;
      } catch { result[k] = undefined; }
    }
    return result;
  },
  async set(obj) {
    for (const [k, v] of Object.entries(obj)) {
      try { localStorage.setItem('st_' + k, JSON.stringify(v)); } catch {}
    }
  },
  async remove(keys) {
    const keyList = Array.isArray(keys) ? keys : [keys];
    for (const k of keyList) localStorage.removeItem('st_' + k);
  },
  async clear() {
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('st_')) toRemove.push(k);
    }
    toRemove.forEach(k => localStorage.removeItem(k));
  }
};

// ─── Constants ───────────────────────────────────────────────

const DEFAULT_CATEGORIES = [
  { id: 'uncategorised', label: 'Uncategorised', color: '#6B7280', locked: true },
  { id: 'client-work',   label: 'Client Work',   color: '#69C58B' },
  { id: 'admin',         label: 'Admin',          color: '#818cf8' },
  { id: 'comms',         label: 'Comms',          color: '#f59e0b' },
  { id: 'research',      label: 'Research',       color: '#38bdf8' },
  { id: 'meetings',      label: 'Meetings',       color: '#f472b6' },
  { id: 'personal',      label: 'Personal',       color: '#f87171' },
];

const PALETTE = [
  '#69C58B','#818cf8','#f59e0b','#38bdf8','#f472b6',
  '#a78bfa','#34d399','#60a5fa','#fb923c','#e879f9',
  '#4ade80','#f87171','#facc15','#94a3b8','#fb7185',
];

let CATEGORIES = [...DEFAULT_CATEGORIES];

// ─── Utilities ───────────────────────────────────────────────

function fmtSecs(s) {
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), ss = s%60;
  if (h>0) return `${h}h ${m}m`;
  if (m>0) return `${m}m ${ss}s`;
  return `${ss}s`;
}
function uid() { return 'id_' + Math.random().toString(36).slice(2,9); }
function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function getDateRange(range) {
  const today = new Date(), keys = [];
  if (range==='today') { keys.push(getTodayKey()); }
  else if (range==='week') { for(let i=6;i>=0;i--){const d=new Date(today);d.setDate(d.getDate()-i);keys.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);} }
  else if (range==='month') { for(let i=29;i>=0;i--){const d=new Date(today);d.setDate(d.getDate()-i);keys.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);} }
  return keys;
}
function getCat(id) { return CATEGORIES.find(c=>c.id===id)||CATEGORIES[0]; }

// ─── Storage helpers ─────────────────────────────────────────

async function getData() {
  return store.get(['logs','domainCategories','sessions','categories','manualTasks']);
}
async function loadCategories() {
  const r = await store.get('categories');
  CATEGORIES = (r.categories && r.categories.length) ? r.categories : [...DEFAULT_CATEGORIES];
  if (!r.categories) await store.set({ categories: CATEGORIES });
}
async function saveCategories() { await store.set({ categories: CATEGORIES }); }
async function setDomainCat(domain, catId) {
  const r = await store.get('domainCategories');
  const dc = r.domainCategories||{};
  dc[domain] = catId;
  await store.set({ domainCategories: dc });
}
function aggregateLogs(logs, dateKeys) {
  const t={};
  for (const k of dateKeys) for (const [d,s] of Object.entries(logs[k]||{})) t[d]=(t[d]||0)+s;
  return t;
}

// ─── Manual tasks ─────────────────────────────────────────────

async function getManualTasks() { const r=await store.get('manualTasks'); return r.manualTasks||[]; }
async function saveManualTask(task) { const t=await getManualTasks(); t.push(task); await store.set({manualTasks:t}); }
async function deleteManualTask(id) { const t=await getManualTasks(); await store.set({manualTasks:t.filter(x=>x.id!==id)}); }

// ─── Charts (native Canvas — no Chart.js needed) ─────────────

function drawDoughnut(canvasId, segments) {
  // segments: [{label, value, color}]
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.offsetWidth || 240, H = canvas.offsetHeight || 210;
  canvas.width = W * devicePixelRatio; canvas.height = H * devicePixelRatio;
  ctx.scale(devicePixelRatio, devicePixelRatio);
  ctx.clearRect(0,0,W,H);

  const total = segments.reduce((s,sg)=>s+sg.value,0);
  if (!total) { ctx.fillStyle='#EEF1F4'; ctx.beginPath(); ctx.arc(W*0.4,H/2,Math.min(W*0.38,H*0.42),0,Math.PI*2); ctx.fill(); return; }

  const cx=W*0.38, cy=H/2, outerR=Math.min(W*0.36,H*0.42), innerR=outerR*0.62;
  let angle = -Math.PI/2;
  for (const sg of segments) {
    const sweep = (sg.value/total)*Math.PI*2;
    ctx.beginPath();
    ctx.moveTo(cx + outerR*Math.cos(angle), cy + outerR*Math.sin(angle));
    ctx.arc(cx,cy,outerR,angle,angle+sweep);
    ctx.arc(cx,cy,innerR,angle+sweep,angle,true);
    ctx.closePath();
    ctx.fillStyle = sg.color + 'cc';
    ctx.strokeStyle = sg.color;
    ctx.lineWidth = 1.5;
    ctx.fill(); ctx.stroke();
    angle += sweep;
  }

  // Legend on right
  const legendX = cx + outerR + 18;
  let legendY = cy - (segments.length * 14) / 2 + 7;
  ctx.font = `500 11px Inter, sans-serif`;
  for (const sg of segments) {
    ctx.fillStyle = sg.color;
    ctx.fillRect(legendX, legendY - 6, 10, 10);
    ctx.fillStyle = '#6B7280';
    ctx.fillText(sg.label, legendX + 14, legendY + 3);
    legendY += 18;
  }
}

function drawBarChart(canvasId, labels, data, todayIdx) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.offsetWidth || 300, H = canvas.offsetHeight || 210;
  canvas.width = W * devicePixelRatio; canvas.height = H * devicePixelRatio;
  ctx.scale(devicePixelRatio, devicePixelRatio);
  ctx.clearRect(0,0,W,H);

  const padL=28, padR=10, padT=14, padB=32;
  const chartW = W-padL-padR, chartH = H-padT-padB;
  const maxVal = Math.max(...data, 1);
  const barW = (chartW/data.length)*0.6;
  const gap = chartW/data.length;

  // Grid lines
  ctx.strokeStyle='#EEF1F4'; ctx.lineWidth=1;
  for (let i=0;i<=4;i++) {
    const y = padT + chartH - (i/4)*chartH;
    ctx.beginPath(); ctx.moveTo(padL,y); ctx.lineTo(padL+chartW,y); ctx.stroke();
    ctx.fillStyle='#6B7280'; ctx.font=`10px Inter, sans-serif`;
    ctx.textAlign='right';
    ctx.fillText(Math.round((i/4)*maxVal)+'m', padL-4, y+3);
  }

  // Bars
  data.forEach((val,i) => {
    const barH = (val/maxVal)*chartH;
    const x = padL + i*gap + (gap-barW)/2;
    const y = padT + chartH - barH;
    const isToday = i===todayIdx;
    ctx.fillStyle = isToday ? '#69C58Bcc' : '#13223822';
    ctx.strokeStyle = isToday ? '#69C58B' : '#13223855';
    ctx.lineWidth = 1;
    // Rounded top
    const r = Math.min(4, barH/2);
    ctx.beginPath();
    ctx.moveTo(x+r, y); ctx.lineTo(x+barW-r, y);
    ctx.quadraticCurveTo(x+barW, y, x+barW, y+r);
    ctx.lineTo(x+barW, y+barH); ctx.lineTo(x, y+barH);
    ctx.lineTo(x, y+r); ctx.quadraticCurveTo(x, y, x+r, y);
    ctx.closePath(); ctx.fill(); ctx.stroke();

    // Label
    ctx.fillStyle='#6B7280'; ctx.font=`10px Inter, sans-serif`; ctx.textAlign='center';
    ctx.fillText(labels[i], x+barW/2, H-padB+14);
  });
}

// ─── Overview ────────────────────────────────────────────────

let currentRange = 'today';

async function renderOverview() {
  const {logs,domainCategories,manualTasks}=await getData();
  const dc=domainCategories||{};
  const dateKeys=getDateRange(currentRange);
  const totals=aggregateLogs(logs||{},dateKeys);
  const entries=Object.entries(totals).sort((a,b)=>b[1]-a[1]);
  const tasksInRange=(manualTasks||[]).filter(t=>dateKeys.includes(t.date));
  let totalSecs=entries.reduce((s,[,v])=>s+v,0)+tasksInRange.reduce((s,t)=>s+t.duration,0);

  document.getElementById('statTotal').textContent=fmtSecs(totalSecs);
  document.getElementById('statSites').textContent=entries.length;

  const catTotals={};
  for(const [d,s] of entries) { const c=dc[d]||'uncategorised'; catTotals[c]=(catTotals[c]||0)+s; }
  for(const t of tasksInRange) { catTotals[t.catId]=(catTotals[t.catId]||0)+t.duration; }

  const topCat=Object.entries(catTotals).sort((a,b)=>b[1]-a[1])[0];
  if(topCat){const cat=getCat(topCat[0]);document.getElementById('statTopCat').textContent=cat.label;document.getElementById('statTopCatTime').textContent=fmtSecs(topCat[1]);}
  else{document.getElementById('statTopCat').textContent='—';document.getElementById('statTopCatTime').textContent='—';}
  if(entries[0]){document.getElementById('statTopSite').textContent=entries[0][0];document.getElementById('statTopSiteTime').textContent=fmtSecs(entries[0][1]);}
  else{document.getElementById('statTopSite').textContent='—';document.getElementById('statTopSiteTime').textContent='—';}

  document.getElementById('statTotalSub').textContent={today:'today',week:'this week',month:'this month'}[currentRange];
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning 👋' : hour < 17 ? 'Good afternoon 👋' : 'Good evening 👋';
  document.getElementById('overviewGreet').textContent = greet;
  document.getElementById('overviewSub').textContent = 'Here\'s your focus summary for ' + new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'});

  // Doughnut
  const doughnutSegs = CATEGORIES.filter(c=>catTotals[c.id]>0).map(c=>({label:c.label,value:catTotals[c.id],color:c.color}));
  requestAnimationFrame(()=>drawDoughnut('catChart', doughnutSegs));

  // Bar chart
  const weekKeys = getDateRange('week');
  const barLabels = weekKeys.map(k=>{const d=new Date(k+'T12:00:00');return d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric'});});
  const barData = weekKeys.map(k=>{
    let s=Object.values((logs||{})[k]||{}).reduce((a,b)=>a+b,0);
    (manualTasks||[]).filter(t=>t.date===k).forEach(t=>s+=t.duration);
    return Math.round(s/60);
  });
  const todayKey = getTodayKey();
  const todayIdx = weekKeys.indexOf(todayKey);
  requestAnimationFrame(()=>drawBarChart('weekChart', barLabels, barData, todayIdx));
}

// ─── Categories editor ────────────────────────────────────────

async function renderCategories() {
  const {logs,domainCategories,manualTasks}=await getData();
  const dc=domainCategories||{};
  const totals=aggregateLogs(logs||{},getDateRange('today'));
  const tasksToday=(manualTasks||[]).filter(t=>t.date===getTodayKey());
  const catTotals={},catTasks={};
  for(const [,s] of Object.entries(totals)){const c=dc['uncategorised']||'uncategorised';catTotals[c]=(catTotals[c]||0)+s;}
  for(const [d,s] of Object.entries(totals)){const c=dc[d]||'uncategorised';catTotals[c]=(catTotals[c]||0)+s;}
  for(const t of tasksToday){catTotals[t.catId]=(catTotals[t.catId]||0)+t.duration;catTasks[t.catId]=(catTasks[t.catId]||0)+1;}

  const grid=document.getElementById('catEditorGrid');
  grid.innerHTML=CATEGORIES.map(cat=>`
    <div class="cat-editor-card">
      <div class="cat-card-top">
        <div class="cat-color-swatch" style="background:${cat.color};cursor:${cat.locked?'default':'pointer'}" data-catid="${cat.id}" title="${cat.locked?'':'Click to change colour'}"></div>
        <input class="cat-name-input" value="${cat.label}" data-catid="${cat.id}" ${cat.locked?'disabled':''} placeholder="Category name">
        ${!cat.locked?`<button class="cat-delete-btn" data-catid="${cat.id}" title="Delete">✕</button>`:''}
      </div>
      <div class="cat-stat" style="color:${cat.color}">${fmtSecs(catTotals[cat.id]||0)}</div>
      <div class="cat-stat-sub">${catTasks[cat.id]||0} task${(catTasks[cat.id]||0)!==1?'s':''} today</div>
    </div>
  `).join('')+`<div class="cat-add-card" id="addCatBtn"><div class="cat-add-icon">+</div><div class="cat-add-label">New Category</div></div>`;

  grid.querySelectorAll('.cat-name-input').forEach(inp=>{
    inp.addEventListener('change',async e=>{const cat=CATEGORIES.find(c=>c.id===e.target.getAttribute('data-catid'));if(cat)cat.label=e.target.value.trim()||cat.label;await saveCategories();});
  });
  grid.querySelectorAll('.cat-color-swatch').forEach(sw=>{
    sw.addEventListener('click',e=>{const catId=e.target.getAttribute('data-catid');if(CATEGORIES.find(c=>c.id===catId)?.locked)return;openColorPicker(catId,e.target);});
  });
  grid.querySelectorAll('.cat-delete-btn').forEach(btn=>{
    btn.addEventListener('click',async e=>{
      const catId=e.target.getAttribute('data-catid');
      if(!confirm('Delete this category? Tasks assigned to it will revert to Uncategorised.'))return;
      CATEGORIES=CATEGORIES.filter(c=>c.id!==catId);
      const r=await store.get('domainCategories');const dc2=r.domainCategories||{};
      for(const d of Object.keys(dc2))if(dc2[d]===catId)dc2[d]='uncategorised';
      await store.set({domainCategories:dc2});
      await saveCategories();renderCategories();
    });
  });
  document.getElementById('addCatBtn').addEventListener('click',async()=>{
    const used=CATEGORIES.map(c=>c.color);
    const color=PALETTE.find(p=>!used.includes(p))||PALETTE[0];
    const nc={id:uid(),label:'New Category',color};
    CATEGORIES.push(nc);await saveCategories();renderCategories();
    setTimeout(()=>{const inp=grid.querySelector(`[data-catid="${nc.id}"].cat-name-input`);if(inp){inp.select();}},50);
  });
}

function openColorPicker(catId, anchor) {
  document.getElementById('colorPickerPopup')?.remove();
  const popup=document.createElement('div');
  popup.id='colorPickerPopup';popup.className='color-picker-popup';
  popup.innerHTML=PALETTE.map(c=>`<div class="cp-swatch" style="background:${c}" data-color="${c}"></div>`).join('');
  const rect=anchor.getBoundingClientRect();
  popup.style.cssText=`position:fixed;top:${rect.bottom+6}px;left:${rect.left}px;z-index:9999`;
  document.body.appendChild(popup);
  popup.querySelectorAll('.cp-swatch').forEach(sw=>{
    sw.addEventListener('click',async e=>{
      const color=e.target.getAttribute('data-color');
      const cat=CATEGORIES.find(c=>c.id===catId);if(cat)cat.color=color;
      await saveCategories();popup.remove();renderCategories();
    });
  });
  setTimeout(()=>document.addEventListener('click',()=>popup.remove(),{once:true}),10);
}

// ─── Timeline + Manual Tasks ──────────────────────────────────

async function renderTimeline(dateOverride) {
  const {sessions,domainCategories,manualTasks}=await getData();
  const dc=domainCategories||{};
  const today=dateOverride||getTodayKey();
  const todaySessions=(sessions||[]).filter(s=>s.date===today).sort((a,b)=>a.start-b.start);
  const todayTasks=(manualTasks||[]).filter(t=>t.date===today).sort((a,b)=>a.startTime.localeCompare(b.startTime));

  // Date nav
  const dateNav = document.getElementById('timelineDateNav');
  if (dateNav) {
    const d = new Date(today+'T12:00:00');
    const label = d.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'});
    const isToday = today===getTodayKey();
    dateNav.innerHTML=`
      <button class="tl-nav-btn" id="tlPrev">&#8249;</button>
      <span class="tl-date-label">${label}${isToday?' <span class="tl-today-badge">Today</span>':''}</span>
      <button class="tl-nav-btn" id="tlNext" ${isToday?'disabled':''}>&#8250;</button>`;
    document.getElementById('tlPrev').onclick=()=>{ const d2=new Date(today+'T12:00:00');d2.setDate(d2.getDate()-1);renderTimeline(`${d2.getFullYear()}-${String(d2.getMonth()+1).padStart(2,'0')}-${String(d2.getDate()).padStart(2,'0')}`); };
    if (!isToday) document.getElementById('tlNext').onclick=()=>{ const d2=new Date(today+'T12:00:00');d2.setDate(d2.getDate()+1);renderTimeline(`${d2.getFullYear()}-${String(d2.getMonth()+1).padStart(2,'0')}-${String(d2.getDate()).padStart(2,'0')}`); };
  }

  // Heatmap
  const hours=[]; for(let h=6;h<22;h++) hours.push(h);
  document.getElementById('timelineRow').innerHTML=hours.map(h=>{
    const slotStart=new Date(today+'T'+String(h).padStart(2,'0')+':00:00').getTime();
    const slotEnd=slotStart+3600000;
    const overlap={};
    for(const s of todaySessions){const ov=Math.min(s.end,slotEnd)-Math.max(s.start,slotStart);if(ov>0)overlap[s.domain]=(overlap[s.domain]||0)+ov;}
    const topDomain=Object.entries(overlap).sort((a,b)=>b[1]-a[1])[0]?.[0];
    const manualInSlot=todayTasks.filter(t=>{const[th,tm]=t.startTime.split(':').map(Number);const ts=new Date(today).setHours(th,tm,0,0);return Math.min(ts+t.duration*1000,slotEnd)-Math.max(ts,slotStart)>0;});
    const topManual=manualInSlot[0];
    let bg,opacity,title;
    if(topManual){const cat=getCat(topManual.catId);bg=cat.color;opacity=0.9;title=`${topManual.title} (${cat.label})`;}
    else if(topDomain){const cat=getCat(dc[topDomain]||'uncategorised');const totalMs=Object.values(overlap).reduce((a,b)=>a+b,0);bg=cat.color;opacity=Math.min(1,totalMs/1800000+0.2);title=`${topDomain} (${cat.label})`;}
    else{bg='#EEF1F4';opacity=1;title=`${h}:00 — no activity`;}
    return `<div class="timeline-hour"><div class="timeline-block" title="${title}" style="background:${bg};opacity:${opacity}"></div></div>`;
  }).join('');
  document.getElementById('timelineLabels').innerHTML=hours.map(h=>`<div class="timeline-label">${h}</div>`).join('');

  // Manual task form
  const catOpts=CATEGORIES.filter(c=>c.id!=='uncategorised').map(c=>`<option value="${c.id}">${c.label}</option>`).join('');
  document.getElementById('manualTaskForm').innerHTML=`
    <div class="manual-task-form">
      <div class="form-title">➕ Log a Task</div>
      <div class="form-row">
        <input id="taskTitle" class="form-input" placeholder="Task name (e.g. Phone call with client, Team meeting)" style="flex:2">
        <select id="taskCat" class="form-select">${catOpts}</select>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Date</label><input id="taskDate" class="form-input" type="date" value="${today}"></div>
        <div class="form-group"><label class="form-label">Start time</label><input id="taskStart" class="form-input" type="time" value="${new Date().toTimeString().slice(0,5)}"></div>
        <div class="form-group"><label class="form-label">Duration</label>
          <div style="display:flex;gap:6px"><input id="taskDurH" class="form-input" type="number" min="0" max="12" placeholder="0h" style="width:64px"><input id="taskDurM" class="form-input" type="number" min="0" max="59" placeholder="30m" style="width:64px"></div>
        </div>
        <div class="form-group"><label class="form-label">Notes</label><input id="taskNotes" class="form-input" placeholder="Optional"></div>
        <button id="taskSubmit" class="btn btn-sage" style="align-self:flex-end;white-space:nowrap">Log Task</button>
      </div>
    </div>`;

  document.getElementById('taskSubmit').addEventListener('click',async()=>{
    const title=document.getElementById('taskTitle').value.trim();
    const catId=document.getElementById('taskCat').value;
    const date=document.getElementById('taskDate').value;
    const startTime=document.getElementById('taskStart').value;
    const h=parseInt(document.getElementById('taskDurH').value)||0;
    const m=parseInt(document.getElementById('taskDurM').value)||0;
    const duration=h*3600+m*60;
    const notes=document.getElementById('taskNotes').value.trim();
    if(!title){alert('Please enter a task name.');return;}
    if(!duration){alert('Please enter a duration.');return;}
    await saveManualTask({id:uid(),title,catId,date,startTime,duration,notes,createdAt:Date.now()});
    renderTimeline(today);
  });

  // Session log — manual tasks only (no browser sessions in web version)
  const allEntries=todayTasks.map(t=>({type:'manual',time:t.startTime,label:t.title,catId:t.catId,duration:t.duration,notes:t.notes,id:t.id}))
    .sort((a,b)=>b.time.localeCompare(a.time));

  const log=document.getElementById('sessionLog');
  if(!allEntries.length){log.innerHTML='<tr><td colspan="5" style="text-align:center;color:var(--grey);padding:30px">No tasks logged yet — use the form above.</td></tr>';return;}
  log.innerHTML=allEntries.map(e=>{
    const cat=getCat(e.catId);
    return `<tr>
      <td class="time-cell">${e.time}</td>
      <td>✋ <strong>${e.label}</strong>${e.notes?`<span class="task-notes"> — ${e.notes}</span>`:''}</td>
      <td class="time-cell">${fmtSecs(e.duration)}</td>
      <td><span class="cat-badge" style="background:${cat.color}22;color:${cat.color};border:1px solid ${cat.color}44">${cat.label}</span></td>
      <td><button class="delete-task-btn" data-id="${e.id}">✕</button></td>
    </tr>`;
  }).join('');

  log.querySelectorAll('.delete-task-btn').forEach(btn=>{
    btn.addEventListener('click',async e=>{if(!confirm('Delete this task?'))return;await deleteManualTask(e.target.getAttribute('data-id'));renderTimeline(today);});
  });
}

// ─── Export ───────────────────────────────────────────────────

function renderExport() {
  document.getElementById('jsonExportBtn').onclick=async()=>{
    const d=await getData();
    const b=new Blob([JSON.stringify(d,null,2)],{type:'application/json'});
    const u=URL.createObjectURL(b);const a=document.createElement('a');
    a.href=u;a.download=`sloth-tracker-${getTodayKey()}.json`;a.click();URL.revokeObjectURL(u);
  };
  document.getElementById('csvExportBtn').onclick=async()=>{
    const{manualTasks}=await getData();const today=getTodayKey();
    const rows=[['Type','Task','Category','Seconds','Formatted Time','Date']];
    for(const t of (manualTasks||[]).sort((a,b)=>b.date.localeCompare(a.date)))
      rows.push(['manual',t.title,getCat(t.catId).label,t.duration,fmtSecs(t.duration),t.date]);
    const b=new Blob([rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n')],{type:'text/csv'});
    const u=URL.createObjectURL(b);const a=document.createElement('a');
    a.href=u;a.download=`sloth-tracker-${today}.csv`;a.click();URL.revokeObjectURL(u);
  };
  document.getElementById('importJsonBtn').onclick=()=>{
    const input=document.createElement('input');input.type='file';input.accept='.json';
    input.onchange=async e=>{
      const file=e.target.files[0];if(!file)return;
      const text=await file.text();
      try{
        const data=JSON.parse(text);
        if(data.manualTasks)await store.set({manualTasks:data.manualTasks});
        if(data.categories)await store.set({categories:data.categories});
        if(data.logs)await store.set({logs:data.logs});
        if(data.sessions)await store.set({sessions:data.sessions});
        if(data.domainCategories)await store.set({domainCategories:data.domainCategories});
        await loadCategories();
        alert('Data imported successfully!');
        showSection('overview');
      }catch(err){alert('Import failed — invalid JSON file.');}
    };
    input.click();
  };
  document.getElementById('clearDataBtn').onclick=async()=>{
    if(confirm('Delete ALL data? This cannot be undone.')){await store.clear();await loadCategories();alert('All data cleared.');renderExport();}
  };

  // Usage stats
  const keys = [];
  for (let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith('st_'))keys.push(k);}
  let bytes = 0;
  keys.forEach(k=>{bytes+=((localStorage.getItem(k)||'').length*2);});
  const kb = (bytes/1024).toFixed(1);
  const el = document.getElementById('storageUsage');
  if (el) el.textContent = `${kb} KB used in localStorage`;
}

// ─── Navigation ───────────────────────────────────────────────

const sections=['overview','categories','timeline','calendar','outlook','export'];

function showSection(id){
  sections.forEach(s=>{
    document.getElementById('section-'+s).className=s===id?'section-visible':'section-hidden';
    document.querySelector(`.nav-item[data-section="${s}"]`)?.classList.toggle('active',s===id);
  });
  if(id==='overview')renderOverview();
  if(id==='categories')renderCategories();
  if(id==='timeline')renderTimeline();
  if(id==='calendar')renderCalendar();
  if(id==='outlook')renderOutlook();
  if(id==='export')renderExport();
}
document.querySelectorAll('.nav-item').forEach(el=>el.addEventListener('click',()=>showSection(el.getAttribute('data-section'))));
document.querySelectorAll('#section-overview .range-tab').forEach(btn=>btn.addEventListener('click',function(){
  document.querySelectorAll('#section-overview .range-tab').forEach(b=>b.classList.remove('active'));
  this.classList.add('active');currentRange=this.getAttribute('data-range');renderOverview();
}));

// ─── Outlook Integration ──────────────────────────────────────
// Uses standard PKCE redirect flow (no chrome.identity needed)

const OUTLOOK_CLIENT_ID = '4fe008d8-c5ee-4f81-9f2a-98a650ae2b20';
const AUTHORITY         = 'https://login.microsoftonline.com/common/oauth2/v2.0';
const SCOPES            = 'openid profile email Mail.Read offline_access';
const GRAPH_BASE        = 'https://graph.microsoft.com/v1.0';

// Redirect URI = this page + /auth/callback path handled in-page
function getRedirectUri() {
  return window.location.origin + window.location.pathname;
}

let outlookRange = 'today';

function b64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf instanceof ArrayBuffer ? buf : buf.buffer || buf)))
    .replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
}
async function makePkce() {
  const arr = crypto.getRandomValues(new Uint8Array(32));
  const verifier = b64url(arr);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return { verifier, challenge: b64url(new Uint8Array(digest)) };
}

async function saveOutlookTokens(t) { t.stored_at=Date.now(); await store.set({outlookTokens:t}); }
async function getOutlookTokens()   { const r=await store.get('outlookTokens'); return r.outlookTokens||null; }
async function clearOutlookTokens() { await store.remove(['outlookTokens','outlookProfile']); }
async function isOutlookSignedIn()  { return !!(await getOutlookTokens()); }

async function getAccessToken() {
  const t = await getOutlookTokens();
  if (!t) throw new Error('Not signed in');
  const expiresAt = t.stored_at + (t.expires_in - 60) * 1000;
  if (Date.now() < expiresAt) return t.access_token;
  if (!t.refresh_token) { await clearOutlookTokens(); throw new Error('Session expired — please sign in again.'); }
  const res = await fetch(`${AUTHORITY}/token`, {
    method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body: new URLSearchParams({ client_id:OUTLOOK_CLIENT_ID, grant_type:'refresh_token', refresh_token:t.refresh_token, scope:SCOPES })
  });
  if (!res.ok) { await clearOutlookTokens(); throw new Error('Session expired — please sign in again.'); }
  const nt = await res.json(); await saveOutlookTokens(nt); return nt.access_token;
}

async function graph(path, params={}) {
  const token = await getAccessToken();
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${GRAPH_BASE}${path}${qs?'?'+qs:''}`, { headers:{Authorization:`Bearer ${token}`} });
  if (!res.ok) { const e=await res.json().catch(()=>({})); throw new Error(e.error?.message||`Graph error ${res.status}`); }
  return res.json();
}

async function outlookSignIn() {
  const {verifier, challenge} = await makePkce();
  const state = b64url(crypto.getRandomValues(new Uint8Array(8)));
  // Persist PKCE verifier across the redirect
  sessionStorage.setItem('pkce_verifier', verifier);
  sessionStorage.setItem('pkce_state', state);
  const params = new URLSearchParams({
    client_id: OUTLOOK_CLIENT_ID, response_type:'code',
    redirect_uri: getRedirectUri(),
    scope:SCOPES, code_challenge:challenge, code_challenge_method:'S256',
    state, prompt:'select_account'
  });
  window.location.href = `${AUTHORITY}/authorize?${params}`;
}

async function handleOAuthCallback() {
  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (!code && !error) return false; // Not a callback

  // Clean URL immediately
  window.history.replaceState({}, document.title, window.location.pathname);

  if (error) {
    alert('Sign-in failed: ' + (url.searchParams.get('error_description') || error));
    return true;
  }

  const savedState = sessionStorage.getItem('pkce_state');
  const verifier = sessionStorage.getItem('pkce_verifier');
  sessionStorage.removeItem('pkce_state');
  sessionStorage.removeItem('pkce_verifier');

  if (state !== savedState) { alert('Security error — state mismatch.'); return true; }

  const tokenRes = await fetch(`${AUTHORITY}/token`, {
    method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body: new URLSearchParams({ client_id:OUTLOOK_CLIENT_ID, grant_type:'authorization_code', code, redirect_uri:getRedirectUri(), code_verifier:verifier })
  });
  if (!tokenRes.ok) { const e=await tokenRes.json(); alert('Token exchange failed: ' + (e.error_description||'unknown error')); return true; }
  const tokens = await tokenRes.json();
  await saveOutlookTokens(tokens);
  return true;
}

async function fetchEmailStats(rangeKey) {
  const now = new Date(); let since;
  if (rangeKey==='today') { since=new Date(now); since.setHours(0,0,0,0); }
  else if (rangeKey==='week') { since=new Date(now); const dow=since.getDay(); since.setDate(since.getDate()-(dow===0?6:dow-1)); since.setHours(0,0,0,0); }
  else { since=new Date(now); since.setDate(1); since.setHours(0,0,0,0); }
  const sinceStr = since.toISOString();
  const [receivedData, sentData] = await Promise.all([
    graph('/me/mailFolders/Inbox/messages', { $filter:`receivedDateTime ge ${sinceStr}`, $select:'id,subject,receivedDateTime,from,isRead,conversationId', $top:'200', $orderby:'receivedDateTime desc' }),
    graph('/me/mailFolders/SentItems/messages', { $filter:`sentDateTime ge ${sinceStr}`, $select:'id,subject,sentDateTime,conversationId', $top:'200', $orderby:'sentDateTime desc' })
  ]);
  const received = receivedData.value||[], sent = sentData.value||[];
  const receivedByConv = {};
  for (const m of received) if (!receivedByConv[m.conversationId]) receivedByConv[m.conversationId]=m;
  const replyTimes = [];
  for (const s of sent) { const orig=receivedByConv[s.conversationId]; if(orig){const diff=(new Date(s.sentDateTime)-new Date(orig.receivedDateTime))/60000;if(diff>0&&diff<60*24*7)replyTimes.push(diff);} }
  const avgReplyMins = replyTimes.length ? Math.round(replyTimes.reduce((a,b)=>a+b,0)/replyTimes.length) : null;
  return {
    receivedCount:received.length, sentCount:sent.length, unreadCount:received.filter(m=>!m.isRead).length, avgReplyMins,
    recent:received.slice(0,10).map(m=>({subject:m.subject||'(no subject)',from:m.from?.emailAddress?.name||m.from?.emailAddress?.address||'?',time:m.receivedDateTime,isRead:m.isRead}))
  };
}

function fmtReplyTime(mins) {
  if(mins===null)return'—';if(mins<60)return`${mins}m`;
  const h=Math.floor(mins/60),m=mins%60;return m>0?`${h}h ${m}m`:`${h}h`;
}
function fmtEmailTime(iso) {
  const d=new Date(iso),today=new Date();
  return d.toDateString()===today.toDateString()
    ? d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})
    : d.toLocaleDateString('en-GB',{day:'numeric',month:'short'});
}

async function renderOutlook() {
  const body = document.getElementById('outlookBody');
  const signedIn = await isOutlookSignedIn();

  if (!signedIn) {
    body.innerHTML = `
      <div class="outlook-connect-box">
        <div class="outlook-connect-icon">📧</div>
        <div class="outlook-connect-title">Connect your Outlook</div>
        <div class="outlook-connect-desc">Sign in with your Microsoft work account to pull in email stats — received, sent, and average reply time.</div>
        <div class="outlook-note">⚠️ You'll need to add <code>${getRedirectUri()}</code> as a redirect URI in your Azure app registration.</div>
        <button class="btn btn-primary" id="outlookSignInBtn" style="width:100%;margin-top:12px">Sign in with Microsoft</button>
      </div>`;
    document.getElementById('outlookSignInBtn').addEventListener('click', () => outlookSignIn());
    return;
  }

  body.innerHTML = `<div class="outlook-loading"><div class="outlook-loading-spinner"></div>Loading your email stats…</div>`;

  try {
    let profile = (await store.get('outlookProfile')).outlookProfile;
    if (!profile) { profile = await graph('/me', { $select:'displayName,mail,userPrincipalName' }); await store.set({ outlookProfile: profile }); }
    const displayName = profile.displayName || 'You';
    const email = profile.mail || profile.userPrincipalName || '';
    const initials = displayName.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
    const stats = await fetchEmailStats(outlookRange);

    body.innerHTML = `
      <div class="outlook-profile-bar">
        <div class="outlook-avatar">${initials}</div>
        <div><div class="outlook-profile-name">${displayName}</div><div class="outlook-profile-email">${email}</div></div>
        <button class="outlook-signout" id="outlookSignOutBtn">Sign out</button>
      </div>
      <div class="email-stats-grid">
        <div class="email-stat-card"><div class="email-stat-icon">📥</div><div class="email-stat-label">Received</div><div class="email-stat-val">${stats.receivedCount}</div><div class="email-stat-sub">${stats.unreadCount} unread</div></div>
        <div class="email-stat-card"><div class="email-stat-icon">📤</div><div class="email-stat-label">Sent</div><div class="email-stat-val">${stats.sentCount}</div><div class="email-stat-sub">emails sent</div></div>
        <div class="email-stat-card"><div class="email-stat-icon">⚡</div><div class="email-stat-label">Avg Reply</div><div class="email-stat-val" style="font-size:${stats.avgReplyMins!==null&&stats.avgReplyMins>=60?'20px':'28px'}">${fmtReplyTime(stats.avgReplyMins)}</div><div class="email-stat-sub">${stats.avgReplyMins!==null?'per email':'no replies'}</div></div>
        <div class="email-stat-card"><div class="email-stat-icon">📊</div><div class="email-stat-label">Sent/Rcvd</div><div class="email-stat-val" style="font-size:20px">${stats.sentCount&&stats.receivedCount?Math.round(stats.sentCount/stats.receivedCount*100)+'%':'—'}</div><div class="email-stat-sub">ratio</div></div>
      </div>
      <div class="email-recent-card">
        <div class="card-header"><div class="card-title">Recent Emails</div><div style="font-size:11px;color:var(--grey)">● unread</div></div>
        ${stats.recent.length===0?'<div style="text-align:center;padding:30px;color:var(--grey)">No emails in this period</div>':stats.recent.map(m=>`
          <div class="email-row">
            ${m.isRead?'<div class="email-read-dot"></div>':'<div class="email-unread-dot"></div>'}
            <div class="email-from">${m.from}</div>
            <div class="email-subject">${m.subject}</div>
            <div class="email-time">${fmtEmailTime(m.time)}</div>
          </div>`).join('')}
      </div>`;

    document.getElementById('outlookSignOutBtn').addEventListener('click', async()=>{ await clearOutlookTokens(); renderOutlook(); });
  } catch(e) {
    body.innerHTML = `<div class="outlook-error">❌ ${e.message}</div><button class="btn" id="outlookRetrySignIn" style="margin-top:12px">Sign in again</button>`;
    document.getElementById('outlookRetrySignIn').addEventListener('click', async()=>{ await clearOutlookTokens(); renderOutlook(); });
  }
}

document.querySelectorAll('#outlookRangeTabs .range-tab').forEach(btn=>{
  btn.addEventListener('click',function(){document.querySelectorAll('#outlookRangeTabs .range-tab').forEach(b=>b.classList.remove('active'));this.classList.add('active');outlookRange=this.getAttribute('data-range');renderOutlook();});
});

// ─── Calendar View ────────────────────────────────────────────

let calWeekOffset = 0;
let calSlotMins   = 30;
const CAL_START_H = 7;
const CAL_END_H   = 20;

function getWeekDates(offset) {
  const today = new Date();
  const dow = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dow===0?6:dow-1) + offset*7);
  monday.setHours(0,0,0,0);
  return Array.from({length:5},(_,i)=>{ const d=new Date(monday); d.setDate(monday.getDate()+i); return d; });
}

function localDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function hexToRgb(hex) {
  if (!hex || hex.length < 7) return '105,197,139';
  const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  return `${r},${g},${b}`;
}

async function renderCalendar() {
  const { sessions, domainCategories, manualTasks, logs } = await getData();
  const dc = domainCategories || {};
  const days = getWeekDates(calWeekOffset);
  const todayStr = getTodayKey();
  const slotH = calSlotMins===15?22:calSlotMins===30?36:56;
  const slotsPerHour = 60/calSlotMins;
  const totalHours = CAL_END_H-CAL_START_H;
  const totalSlots = totalHours*slotsPerHour;

  const fmt = d=>d.toLocaleDateString('en-GB',{day:'numeric',month:'short'});
  document.getElementById('calWeekLabel').textContent=`${fmt(days[0])} – ${fmt(days[4])} ${days[0].getFullYear()}`;

  const legend=document.getElementById('calLegend');
  legend.innerHTML=CATEGORIES.filter(c=>c.id!=='uncategorised').map(cat=>
    `<div class="cal-legend-item"><div class="cal-legend-dot" style="background:${cat.color}"></div>${cat.label}</div>`
  ).join('');

  const allSessions=sessions||[], allTasks=manualTasks||[];

  function getEvents(dayDate) {
    const dk=localDateKey(dayDate);
    const events=[];
    for(const s of allSessions){
      if(s.date!==dk)continue;
      const catId=dc[s.domain]||'uncategorised';
      events.push({startMs:s.start,endMs:s.end,catId,label:s.domain,type:'browser'});
    }
    for(const t of allTasks){
      if(t.date!==dk)continue;
      const [h,m]=t.startTime.split(':').map(Number);
      const startMs=new Date(dk+'T00:00:00').setHours(h,m,0,0);
      const endMs=startMs+t.duration*1000;
      events.push({startMs,endMs,catId:t.catId,label:t.title,type:'manual'});
    }
    return events;
  }

  // Gutter
  const gutter=document.getElementById('calGutter');
  gutter.innerHTML='';
  for(let s=0;s<=totalSlots;s++){
    const totalMins=CAL_START_H*60+s*calSlotMins;
    const h=Math.floor(totalMins/60),m=totalMins%60;
    const isHour=m===0;
    const div=document.createElement('div');
    div.className='cal-gutter-slot'+(isHour?' hour-mark':'');
    div.style.height=slotH+'px';
    div.textContent=isHour?`${String(h).padStart(2,'0')}:00`:'';
    gutter.appendChild(div);
  }

  const calDays=document.getElementById('calDays');
  calDays.innerHTML='';

  days.forEach(day=>{
    const dk=localDateKey(day);
    const isToday=dk===todayStr;
    const events=getEvents(day);
    const dayLogs=(logs||{})[dk]||{};
    const dayTotalSecs=Object.values(dayLogs).reduce((a,b)=>a+b,0)+allTasks.filter(t=>t.date===dk).reduce((a,t)=>a+t.duration,0);

    const col=document.createElement('div');
    col.className='cal-day-col';
    const dayNames=['Mon','Tue','Wed','Thu','Fri'];
    const dayName=dayNames[days.indexOf(day)];
    const numHtml=isToday?`<div class="cal-day-num today">${day.getDate()}</div>`:`<div class="cal-day-num">${day.getDate()}</div>`;
    col.innerHTML=`<div class="cal-day-header"><div class="cal-day-name">${dayName}</div>${numHtml}<div class="cal-day-total">${dayTotalSecs?fmtSecs(dayTotalSecs):''}</div></div>`;

    const slotsWrap=document.createElement('div');
    slotsWrap.style.position='relative';
    for(let s=0;s<totalSlots;s++){
      const slotStartMins=CAL_START_H*60+s*calSlotMins;
      const isHour=(slotStartMins%60)===0;
      const cell=document.createElement('div');
      cell.className='cal-slot'+(isHour?' hour-start':'');
      cell.style.height=slotH+'px';
      slotsWrap.appendChild(cell);
    }

    if(isToday){
      const now=new Date();
      const nowMins=now.getHours()*60+now.getMinutes();
      const startMins=CAL_START_H*60;
      if(nowMins>=startMins&&nowMins<=CAL_END_H*60){
        const pxFromTop=((nowMins-startMins)/calSlotMins)*slotH;
        const line=document.createElement('div');
        line.className='cal-now-line';line.style.top=pxFromTop+'px';
        line.innerHTML='<div class="cal-now-dot"></div>';
        slotsWrap.appendChild(line);
      }
    }

    const calStartMs=new Date(dk+'T00:00:00').setHours(CAL_START_H,0,0,0);
    const pxPerMin=slotH/calSlotMins;

    for(const ev of events){
      const cat=getCat(ev.catId);
      const evStartMins=Math.max(0,(ev.startMs-calStartMs)/60000);
      const evEndMins=Math.min(totalHours*60,(ev.endMs-calStartMs)/60000);
      if(evEndMins<=0||evStartMins>=totalHours*60)continue;
      const top=evStartMins*pxPerMin;
      const height=Math.max(14,(evEndMins-evStartMins)*pxPerMin-2);
      const block=document.createElement('div');
      block.className='cal-event';
      block.style.cssText=`top:${top}px;height:${height}px;background:rgba(${hexToRgb(cat.color)},0.18);border-left:3px solid ${cat.color};color:${cat.color};`;
      const icon=ev.type==='manual'?'✋ ':'';
      block.textContent=height>20?icon+ev.label:'';
      block.title=`${ev.label} (${cat.label}) · ${fmtSecs(Math.round((ev.endMs-ev.startMs)/1000))}`;
      slotsWrap.appendChild(block);
    }

    col.appendChild(slotsWrap);
    calDays.appendChild(col);
  });

  const wrap=document.getElementById('calGridWrap');
  const scrollTarget=((8-CAL_START_H)*slotsPerHour)*slotH+48;
  if(wrap._firstRender!==calWeekOffset+'_'+calSlotMins){wrap.scrollTop=scrollTarget;wrap._firstRender=calWeekOffset+'_'+calSlotMins;}
}

document.getElementById('calPrev').addEventListener('click',()=>{calWeekOffset--;renderCalendar();});
document.getElementById('calNext').addEventListener('click',()=>{calWeekOffset++;renderCalendar();});
document.getElementById('calTodayBtn').addEventListener('click',()=>{calWeekOffset=0;renderCalendar();});
document.querySelectorAll('.slot-tab').forEach(btn=>{
  btn.addEventListener('click',function(){document.querySelectorAll('.slot-tab').forEach(b=>b.classList.remove('active'));this.classList.add('active');calSlotMins=parseInt(this.getAttribute('data-mins'));renderCalendar();});
});

// ─── Boot ─────────────────────────────────────────────────────

(async()=>{
  // Handle OAuth callback before rendering anything
  const wasCallback = await handleOAuthCallback();

  await loadCategories();
  showSection('overview');

  // If we just came back from OAuth, jump straight to Outlook
  if (wasCallback) showSection('outlook');

  // Auto-refresh every 60s
  setInterval(async()=>{
    await loadCategories();
    const active=document.querySelector('.nav-item.active')?.getAttribute('data-section');
    if(active)showSection(active);
  }, 60000);
})();

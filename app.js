/* Creator Studio – YouTube Admin Dashboard */
const LS = 'creatorstudio_cfg';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
let cfg = {};
try { cfg = JSON.parse(localStorage.getItem(LS) || '{}') || {}; }
catch (error) { console.warn('Saved settings could not be read; using defaults.', error); localStorage.removeItem(LS); }
const S = { range: 30, data: null, charts: {}, view: 'dashboard' };
const fmt = n => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : Math.round(n).toString();
const full = n => Math.round(n).toLocaleString('en-US');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TITLES = {
  dashboard: ['Dashboard', 'Your channel at a glance'], analytics: ['Analytics', 'Watch time, traffic and engagement'],
  videos: ['Videos', 'Every video, ranked'], audience: ['Audience', 'Who is watching'],
  settings: ['Settings', 'Connect your channel'], help: ['Help', 'Tours and answers']
};

/* ---------- toast / banner ---------- */
function toast(msg, type = '') {
  const t = document.createElement('div'); t.className = 'toast ' + type; t.textContent = msg;
  $('#toasts').append(t); setTimeout(() => t.remove(), 4000);
}
function banner(msg, cls = '') {
  const b = $('#banner');
  if (!msg) { b.hidden = true; return; }
  b.className = 'banner ' + cls; b.hidden = false;
  b.innerHTML = `<span>${msg}</span><button id="bnClose">Dismiss</button>`;
  $('#bnClose').onclick = () => b.hidden = true;
}

/* ---------- demo data ---------- */
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function buildSeries(totalViews, totalSubs, days = 90) {
  const r = rng(42), base = totalViews / 900, dates = [], views = [], gains = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(); d.setDate(d.getDate() - (days - 1 - i)); dates.push(d);
    const v = base * (0.75 + 0.5 * i / days) * (1 + 0.22 * Math.sin(i * 2 * Math.PI / 7)) * (0.88 + 0.24 * r());
    views.push(Math.round(v)); gains.push(Math.round(v / 85 * (0.7 + 0.6 * r())));
  }
  let run = totalSubs; const subs = new Array(days);
  for (let i = days - 1; i >= 0; i--) { subs[i] = run; run -= gains[i]; }
  return { dates, views, subs, gains };
}
const DEMO_TITLES = ['I Built a Full-Stack App in 24 Hours', 'React vs Vue: The Honest Truth', 'How I Landed 5 Job Offers (Placement Guide)', 'Learn JavaScript in 1 Hour – Beginner Course', 'My Desk Setup Tour 2026', 'Python Projects That Get You Hired', 'Mock Interview: Frontend Developer', 'CSS Tricks Nobody Teaches You', 'Day in the Life of a Software Engineer', 'Build a YouTube Dashboard from Scratch'];
const GRADS = [['#ff4157', '#7c5cff'], ['#27d3e6', '#7c5cff'], ['#ff8a3d', '#ff4157'], ['#2ee59d', '#27d3e6'], ['#7c5cff', '#ff4157']];
function demoData() {
  const stats = { views: 4826310, subs: 128450, videos: 86 };
  const videos = DEMO_TITLES.map((t, i) => {
    const v = Math.round(612000 / (1 + i * 0.55) * (0.9 + (i % 3) * 0.07));
    return { id: 'demo' + i, title: t, views: v, likes: Math.round(v * (0.035 + (i % 4) * 0.008)), thumb: null, grad: GRADS[i % 5] };
  });
  return { demo: true, channel: { title: 'Code With Aarav', avatar: null }, stats, videos, series: buildSeries(stats.views, stats.subs), avgMin: 4.6 };
}

/* ---------- YouTube API ---------- */
async function yt(path, params) {
  const url = `https://www.googleapis.com/youtube/v3/${path}?` + new URLSearchParams({ ...params, key: cfg.apiKey });
  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error?.message || `Request failed (${res.status})`);
  return json;
}
async function liveData() {
  const id = (cfg.channelId || '').trim();
  const q = id.startsWith('@') ? { forHandle: id } : { id };
  const ch = await yt('channels', { part: 'snippet,statistics', ...q });
  if (!ch.items?.length) throw new Error('Channel not found. Check the channel ID or @handle.');
  const c = ch.items[0], st = c.statistics;
  const stats = { views: +st.viewCount, subs: +st.subscriberCount, videos: +st.videoCount };
  const found = await yt('search', { part: 'id', channelId: c.id, order: 'viewCount', type: 'video', maxResults: 12 });
  let videos = [];
  const ids = found.items.map(i => i.id.videoId).filter(Boolean).join(',');
  if (ids) {
    const vs = await yt('videos', { part: 'snippet,statistics', id: ids });
    videos = vs.items.map(v => ({
      id: v.id, title: v.snippet.title, views: +v.statistics.viewCount || 0, likes: +v.statistics.likeCount || 0,
      thumb: (v.snippet.thumbnails.medium || v.snippet.thumbnails.default).url
    })).sort((a, b) => b.views - a.views);
  }
  return { demo: false, channel: { title: c.snippet.title, avatar: c.snippet.thumbnails.default.url }, stats, videos, series: buildSeries(stats.views, stats.subs), avgMin: 4.2 };
}

/* ---------- loading + fetch flow ---------- */
function showSkeleton() {
  $('#cards').innerHTML = '<div class="sk card"></div>'.repeat(4);
  $('#topVideos').innerHTML = '<div class="sk v"></div>'.repeat(4);
}
async function load() {
  $('#refreshBtn').classList.add('spin'); showSkeleton();
  await new Promise(r => setTimeout(r, 650));
  try {
    if (cfg.apiKey && cfg.channelId) {
      S.data = await liveData(); banner('');
    } else {
      S.data = demoData();
      banner('Showing demo data. Add your API key and channel in <b>Settings</b> to see real stats.', 'info');
    }
  } catch (e) {
    S.data = demoData();
    banner(`Couldn’t load your channel: ${esc(e.message)} Showing demo data instead. Check your key in Settings.`);
    toast('YouTube API error', 'err');
  }
  $('#refreshBtn').classList.remove('spin');
  render();
}

/* ---------- helpers for range ---------- */
function slice() {
  const n = S.range, { series: s } = S.data, len = s.views.length;
  const cur = (a) => a.slice(len - n), prev = (a) => a.slice(len - 2 * n, len - n);
  const sum = a => a.reduce((x, y) => x + y, 0);
  return { dates: cur(s.dates), views: cur(s.views), subs: cur(s.subs), gains: cur(s.gains), pv: sum(prev(s.views)), cv: sum(cur(s.views)), sumGain: sum(cur(s.gains)), pg: sum(prev(s.gains)) };
}
const pct = (a, b) => b ? ((a - b) / b * 100) : 0;
const dTxt = p => `<b class="${p < 0 ? 'neg' : ''}">${p >= 0 ? '▲' : '▼'} ${Math.abs(p).toFixed(1)}%</b>`;

/* ---------- render ---------- */
function render() {
  const D = S.data, R = slice();
  $('#chName').textContent = D.channel.title;
  $('#chMode').textContent = D.demo ? 'Demo mode' : 'Live · YouTube API';
  $('#chAvatar').innerHTML = D.channel.avatar ? `<img src="${esc(D.channel.avatar)}" alt="">` : esc(D.channel.title[0]);
  const hours = D.stats.views * D.avgMin / 60;
  const items = [
    ['Total Views', D.stats.views, '▶', 'var(--red)', `${dTxt(pct(R.cv, R.pv))} vs previous ${S.range} days`],
    ['Total Subscribers', D.stats.subs, '☺', 'var(--vio)', `<b>+${full(R.sumGain)}</b> in last ${S.range} days`],
    ['Total Videos', D.stats.videos, '▣', 'var(--cyan)', 'Published on your channel'],
    ['Total Watch Time', hours, '◷', '#ff8a3d', 'hours · estimated']
  ];
  $('#cards').innerHTML = items.map((c, i) => `<div class="glass card" style="--c:${c[3]}"><div class="ico">${c[2]}</div><div class="lbl">${c[0]}</div><div class="val" data-to="${c[1]}">0</div><div class="sub">${c[4]}</div></div>`).join('');
  $$('.val').forEach(el => countUp(el, +el.dataset.to));
  $('#viewsDelta').innerHTML = `${pct(R.cv, R.pv) >= 0 ? '▲' : '▼'} ${Math.abs(pct(R.cv, R.pv)).toFixed(1)}%`;
  $('#viewsDelta').className = 'chip' + (pct(R.cv, R.pv) < 0 ? ' neg' : '');
  $('#subsDelta').textContent = '+' + full(R.sumGain);
  charts(R, D);
  topVideos(); videosTable(); stats(R, D);
}
function countUp(el, to) {
  const t0 = performance.now(), dur = 900;
  const step = t => { const p = Math.min((t - t0) / dur, 1), e = 1 - Math.pow(1 - p, 3); el.textContent = p < 1 ? fmt(to * e) : (to >= 1e5 ? fmt(to) : full(to)); if (p < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}

/* ---------- charts ---------- */
if (typeof Chart !== 'undefined') {
  Chart.defaults.color = '#a5abc4';
  Chart.defaults.font.family = "'Plus Jakarta Sans',sans-serif";
}
function grad(ctx, c1, c2) { const g = ctx.createLinearGradient(0, 0, 0, 300); g.addColorStop(0, c1); g.addColorStop(1, c2); return g; }
const axes = { x: { grid: { display: false }, ticks: { maxTicksLimit: 7 } }, y: { grid: { color: 'rgba(255,255,255,.06)' }, ticks: { callback: v => fmt(v) } } };
const tip = { backgroundColor: '#171830', borderColor: 'rgba(255,255,255,.1)', borderWidth: 1, padding: 10, cornerRadius: 10 };
function mk(id, cfgObj) {
  if (typeof Chart === 'undefined') return;
  const canvas = $('#' + id);
  if (!canvas) return;
  if (S.charts[id]) S.charts[id].destroy();
  S.charts[id] = new Chart(canvas, cfgObj);
}
const lbls = d => d.map(x => x.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
function charts(R, D) {
  const L = lbls(R.dates), c = id => $('#' + id).getContext('2d');
  const base = { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { display: false }, tooltip: tip }, scales: axes };
  mk('viewsChart', { type: 'line', data: { labels: L, datasets: [{ label: 'Views', data: R.views, borderColor: '#ff4157', backgroundColor: grad(c('viewsChart'), 'rgba(255,65,87,.4)', 'rgba(255,65,87,0)'), fill: true, tension: .38, pointRadius: 0, pointHoverRadius: 5, borderWidth: 2.5 }] }, options: base });
  mk('subsChart', { type: 'line', data: { labels: L, datasets: [{ label: 'Subscribers', data: R.subs, borderColor: '#7c5cff', backgroundColor: grad(c('subsChart'), 'rgba(124,92,255,.4)', 'rgba(124,92,255,0)'), fill: true, tension: .38, pointRadius: 0, pointHoverRadius: 5, borderWidth: 2.5 }] }, options: { ...base, scales: { ...axes, y: { ...axes.y, ticks: { callback: v => fmt(v) } } } } });
  mk('watchChart', { type: 'bar', data: { labels: L, datasets: [{ label: 'Hours', data: R.views.map(v => Math.round(v * D.avgMin / 60)), backgroundColor: '#27d3e6', borderRadius: 6 }] }, options: base });
  const donut = (id, labels, data, colors) => mk(id, { type: 'doughnut', data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, usePointStyle: true } }, tooltip: tip } } });
  const pal = ['#ff4157', '#7c5cff', '#27d3e6', '#ff8a3d', '#2ee59d'];
  donut('trafficChart', ['YouTube search', 'Suggested videos', 'Browse features', 'External', 'Direct'], [32, 28, 19, 13, 8], pal);
  donut('geoChart', ['India', 'United States', 'UK', 'Canada', 'Other'], [46, 21, 9, 6, 18], pal);
  donut('devChart', ['Mobile', 'Desktop', 'TV', 'Tablet'], [62, 27, 7, 4], pal);
  mk('ageChart', { type: 'bar', data: { labels: ['13–17', '18–24', '25–34', '35–44', '45+'], datasets: [{ data: [8, 41, 33, 12, 6], backgroundColor: '#7c5cff', borderRadius: 8 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: tip }, scales: { x: { grid: { display: false } }, y: { grid: { color: 'rgba(255,255,255,.06)' }, ticks: { callback: v => v + '%' } } } } });
}

/* ---------- videos ---------- */
function thumb(v, rank) {
  const g = v.grad || GRADS[0];
  const st = v.thumb ? `background-image:url('${esc(v.thumb)}')` : `background:linear-gradient(135deg,${g[0]},${g[1]})`;
  return `<div class="thumb" style="${st}">${v.thumb ? '' : '▶'}${rank ? `<span class="rank">#${rank}</span>` : ''}</div>`;
}
function emptyState(icon, title, text, btn) {
  return `<div class="empty"><div class="big">${icon}</div><h4>${title}</h4><p>${text}</p>${btn || ''}</div>`;
}
function topVideos() {
  const v = S.data.videos.slice(0, 4), el = $('#topVideos');
  el.style.display = v.length ? '' : 'block';
  el.innerHTML = v.length ? v.map((x, i) => `<a class="vcard" ${x.id.startsWith('demo') ? '' : `href="https://youtu.be/${x.id}" target="_blank" rel="noopener"`}>${thumb(x, i + 1)}<div class="vinfo"><h4>${esc(x.title)}</h4><div class="meta"><span>👁 ${fmt(x.views)}</span><span>👍 ${fmt(x.likes)}</span></div></div></a>`).join('')
    : emptyState('🎬', 'No videos yet', 'Upload your first video and it will show up here once it gets views.', '<button class="btn" data-go="settings">Check connection</button>');
}
function videosTable() {
  const q = $('#vSearch').value.trim().toLowerCase(), s = $('#vSort').value;
  let list = S.data.videos.filter(v => v.title.toLowerCase().includes(q));
  list.sort((a, b) => s === 'title' ? a.title.localeCompare(b.title) : b[s] - a[s]);
  const max = Math.max(...S.data.videos.map(v => v.views), 1);
  $('#vTable').innerHTML = list.map(v => `<tr><td><div class="tcell">${thumb(v)}<span>${esc(v.title)}</span></div></td><td><b>${full(v.views)}</b><div class="bar"><i style="width:${v.views / max * 100}%"></i></div></td><td>${full(v.likes)}</td><td>${v.views ? (v.likes / v.views * 100).toFixed(1) : 0}%</td></tr>`).join('');
  $('#vEmpty').innerHTML = list.length ? '' : emptyState('🔍', 'No videos match', q ? `Nothing matches “${esc(q)}”. Try a different word.` : 'This channel has no public videos yet.', '<button class="btn ghost" id="clearSearch">Clear search</button>');
  const cl = $('#clearSearch'); if (cl) cl.onclick = () => { $('#vSearch').value = ''; videosTable(); };
}
function stats(R, D) {
  const likes = D.videos.reduce((a, v) => a + v.likes, 0), views = D.videos.reduce((a, v) => a + v.views, 0);
  const rows = [[fmt(R.cv), `Views, last ${S.range} days`], [D.avgMin + ' min', 'Avg. view duration (est.)'], [(views ? likes / views * 100 : 0).toFixed(1) + '%', 'Like rate, top videos'], [fmt(R.sumGain), `New subscribers, ${S.range} days`]];
  $('#engStats').innerHTML = rows.map(r => `<div class="stat"><b>${r[0]}</b><span>${r[1]}</span></div>`).join('');
}

/* ---------- navigation ---------- */
function go(view) {
  S.view = view;
  $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + view));
  $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  $('#viewTitle').textContent = TITLES[view][0]; $('#viewSub').textContent = TITLES[view][1];
  closeMenu(); window.scrollTo({ top: 0 });
  requestAnimationFrame(() => Object.values(S.charts).forEach(c => c.resize()));
}
const openMenu = () => { $('#sidebar').classList.add('open'); $('#scrim').classList.add('open'); };
const closeMenu = () => { $('#sidebar').classList.remove('open'); $('#scrim').classList.remove('open'); };
document.addEventListener('click', e => { const g = e.target.closest('[data-go]'); if (g) go(g.dataset.go); });
$('#nav').addEventListener('click', e => { const b = e.target.closest('.nav-btn'); if (b) go(b.dataset.view); });
$('#menuBtn').onclick = openMenu; $('#scrim').onclick = closeMenu;
$('#range').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || !S.data) return;
  S.range = +b.dataset.r; $$('#range button').forEach(x => x.classList.toggle('active', x === b)); render();
});
$('#refreshBtn').onclick = () => { load(); toast('Refreshing data…'); };
$('#vSearch').oninput = () => S.data && videosTable(); $('#vSort').onchange = () => S.data && videosTable();

/* ---------- settings ---------- */
$('#apiKey').value = cfg.apiKey || ''; $('#channelId').value = cfg.channelId || '';
$('#saveBtn').onclick = () => {
  const k = $('#apiKey').value.trim(), c = $('#channelId').value.trim();
  if (!k || !c) return toast('Enter both an API key and a channel ID or @handle.', 'err');
  cfg.apiKey = k; cfg.channelId = c; localStorage.setItem(LS, JSON.stringify(cfg));
  toast('Saved. Connecting…', 'ok'); go('dashboard'); load();
};
$('#demoBtn').onclick = () => { delete cfg.apiKey; delete cfg.channelId; localStorage.removeItem(LS); $('#apiKey').value = ''; $('#channelId').value = ''; toast('Switched to demo data', 'ok'); go('dashboard'); load(); };

/* ---------- Shepherd tour ---------- */
function tour() {
  go('dashboard'); closeMenu();
  const t = new Shepherd.Tour({ useModalOverlay: true, defaultStepOptions: { cancelIcon: { enabled: true }, scrollTo: { behavior: 'smooth', block: 'center' }, classes: 'tour', modalOverlayOpeningRadius: 12, modalOverlayOpeningPadding: 6 } });
  const mobile = innerWidth <= 900;
  const steps = [
    [mobile ? '#menuBtn' : '#sidebar', 'Navigation', 'Switch between Dashboard, Analytics, Videos, Audience, Settings and Help.', 'right'],
    ['#range', 'Date filters', 'Choose 7, 30 or 90 days. Cards and charts update instantly.', 'bottom'],
    ['#cards', 'Key metrics', 'Total views, subscribers, videos and watch time, with growth versus the previous period.', 'bottom'],
    ['#viewsPanel', 'Views chart', 'Hover the line to see views for any day.', 'top'],
    ['#subsPanel', 'Subscriber growth', 'Track how your audience is growing over time.', 'top'],
    ['#topPanel', 'Top videos', 'Your best performers with views and likes. Click one to open it on YouTube.', 'top'],
    ['#refreshBtn', 'Refresh', 'Pull the latest numbers from YouTube any time.', 'bottom']
  ];
  steps.forEach((s, i) => t.addStep({
    id: 's' + i, title: s[1], text: s[2], attachTo: { element: s[0], on: s[3] },
    buttons: [
      ...(i ? [{ text: 'Back', classes: 'shepherd-button-secondary', action: t.back }] : []),
      { text: i === steps.length - 1 ? 'Finish' : 'Next', action: i === steps.length - 1 ? t.complete : t.next }
    ]
  }));
  t.on('complete', () => toast('Tour complete. You’re all set!', 'ok'));
  t.start();
}
$('#tourBtn').onclick = tour; $('#tourBtn2').onclick = tour;

/* ---------- init ---------- */
load().then(() => {
  if (typeof Shepherd !== 'undefined' && !localStorage.getItem('creatorstudio_toured')) {
    localStorage.setItem('creatorstudio_toured', '1');
    setTimeout(tour, 1200);
  }
});

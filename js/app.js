/* Renomates: plain JavaScript, no build step. Needs js/config.js filled in (see README). */
(() => {
'use strict';
const C = window.RENOMATES_CONFIG || {};
// Google Analytics 4 (optional). Only loads if GA_MEASUREMENT_ID is set in config.js. No personal info is ever sent in events.
const GA = /^G-[A-Z0-9]+$/.test(C.GA_MEASUREMENT_ID || '') ? C.GA_MEASUREMENT_ID : '';
if (GA) {
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  gtag('js', new Date());
  gtag('config', GA, {anonymize_ip: true, allow_google_signals: false, allow_ad_personalization_signals: false});
  const gs = document.createElement('script'); gs.async = true; gs.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA; document.head.appendChild(gs);
}
const track = (name, params) => { try { if (GA && window.gtag) gtag('event', name, params || {}); } catch (e) {} };
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const TYPES = ['Kitchen','Bathroom','Extension','Painting','Floors','Laundry','Bedrooms','Living and Dining','Exterior','Full reno','Other'];
const EM = {Kitchen:'🍳',Bathroom:'🛁',Extension:'🏠',Painting:'🎨',Floors:'🪵',Laundry:'🧺',Bedrooms:'🛏️','Living and Dining':'🛋️',Exterior:'🌿','Full reno':'🛠️',Other:'🔨'};
const COL = {Kitchen:['#ffd84d','#ff9f43'],Bathroom:['#7fe0ff','#6c8cff'],Extension:['#ff9aa8','#ff6b57'],Painting:['#e2a6ff','#8f6bff'],Floors:['#ffc98a','#c98a4b'],Laundry:['#9fe3f2','#4bb6d6'],Bedrooms:['#b9b6ff','#7a76f0'],'Living and Dining':['#ffb3c7','#ff6f91'],Exterior:['#c3f26b','#3fbf6a'],'Full reno':['#8ff0c4','#1fcf9f'],Other:['#d8d6ec','#9d9bc4']};
const HOMES = ['Victorian', 'Edwardian', 'Federation', 'Californian bungalow', 'Art deco', 'Post-war (1945–60)', '1960s–70s', '1980s–90s', '2000s or newer', 'Apartment or unit', 'Townhouse'];
const SIZES = {refresh: 'Light refresh', major: 'Big update', structural: 'Structural or rebuild'};
const BANDS = [[0, 10000], [10000, 20000], [20000, 40000], [40000, 60000], [60000, 100000], [100000, 150000], [150000, 250000], [250000, 400000], [400000, 1000000]];
const kk = n => Math.round(n / 1000);
const bandLabel = (lo, hi) => lo <= 0 ? 'Under $' + kk(hi) + 'k' : hi >= 1e6 ? '$' + kk(lo) + 'k+' : '$' + kk(lo) + '–' + kk(hi) + 'k';
const MAXPHOTOS = 10, BUCKET = 'reno-photos';
const configured = C.SUPABASE_URL && C.SUPABASE_ANON_KEY && !C.SUPABASE_URL.includes('YOUR-PROJECT');
const sb = configured ? supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY) : null;

const DEBUG = /[?&]debug=1/.test(location.search);
let diag = 'not loaded yet';
const S = {view: 'explore', authReady: false, wantView: null, book: [], bookKeys: new Set(), blocks: new Map(), user:null, profile:null, renos:[], favs:new Set(), convos:[], seen:{}, sel:null, curThread:null,
  F:{sub:null, q:'', types:new Set(), max:500, sort:'new', mine:false, home:'', size:''}};
try { S.seen = JSON.parse(localStorage.getItem('rm_seen') || '{}'); } catch (e) {}

const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)));
const k = c => '$' + (c >= 1e6 ? (c/1e6).toFixed(1) + 'm' : Math.round(c/1000) + 'k');
const effCost = d => d.cost != null ? d.cost : d.cost_low != null ? (d.cost_low + Math.min(d.cost_high, 500000)) / 2 : null;
const priceLabel = d => d.cost != null ? k(d.cost) : d.cost_low != null ? bandLabel(d.cost_low, d.cost_high) : 'Cost not shared';
const noCost = d => d.cost == null && d.cost_low == null;
const money = c => '$' + Number(c).toLocaleString('en-AU');
function safeUrl(u) {
  if (!u) return ''; let s = String(u).trim(); if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  try { const x = new URL(s); if (!/^https?:$/.test(x.protocol) || !x.hostname.includes('.') || x.username || x.password) return ''; return x.href.length <= 200 ? x.href : ''; } catch (e) { return ''; }
}
const siteHost = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
const tkey = t => { const u = safeUrl(t.website), h = u ? siteHost(u).toLowerCase() : ''; return (h ? 'w:' + h : 'n:' + String(t.name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() + '|' + String(t.trade || '').toLowerCase().trim()).slice(0, 160); };
const stars = n => '★'.repeat(n) + '☆'.repeat(5 - n);
function toast(t) { const e = $('#toast'); e.innerHTML = `<div class="toast">${esc(t)}</div>`; clearTimeout(toast.t); toast.t = setTimeout(() => e.innerHTML = '', 3200); }

/* ---------- suburbs (lazy-loaded, searched in the browser) ---------- */
let subData = null;
const loadSubs = () => subData || (subData = fetch('data/suburbs.json').then(r => r.json()).catch(() => { subData = null; return []; }));
function searchSubs(d, q) {
  const out = [], rest = [];
  if (/^\d+$/.test(q)) { for (const s of d) { if (s[2].startsWith(q)) { out.push(s); if (out.length >= 8) break; } } return out; }
  for (const s of d) {
    const n = s[0].toLowerCase();
    if (n.startsWith(q)) { out.push(s); if (out.length >= 8) return out; }
    else if (rest.length < 8 && n.includes(q)) rest.push(s);
  }
  return out.concat(rest).slice(0, 8);
}
function typeahead(inp, ul, onPick, onEdit) {
  let items = [], idx = -1;
  const draw = () => { ul.innerHTML = items.map((s, i) => `<li role="option" data-i="${i}" aria-selected="${i === idx}">${esc(s[0])}<small>${s[1]} ${s[2]}</small></li>`).join(''); ul.hidden = !items.length; };
  const close = () => { ul.hidden = true; idx = -1; };
  const pick = s => { close(); onPick(s); };
  inp.addEventListener('input', async () => {
    onEdit && onEdit();
    const q = inp.value.trim().toLowerCase();
    if (q.length < 2) { items = []; return draw(); }
    items = searchSubs(await loadSubs(), q); idx = -1; draw();
  });
  inp.addEventListener('keydown', e => {
    if (ul.hidden) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); idx = Math.min(idx + 1, items.length - 1); draw(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); idx = Math.max(idx - 1, 0); draw(); }
    else if (e.key === 'Enter') { e.preventDefault(); if (items[Math.max(idx, 0)]) pick(items[Math.max(idx, 0)]); }
    else if (e.key === 'Escape') close();
  });
  ul.addEventListener('mousedown', e => { const li = e.target.closest('li'); if (li) { e.preventDefault(); pick(items[+li.dataset.i]); } });
  inp.addEventListener('blur', () => setTimeout(close, 150));
}

/* ---------- data ---------- */
const photoUrl = p => sb.storage.from(BUCKET).getPublicUrl(p).data.publicUrl;
const thumbPath = p => p.replace(/\.jpg$/, '_t.jpg');
function norm(r) {
  const ph = (r.reno_photos || []).slice().sort((a, b) => a.position - b.position);
  return {...r, owner: (r.profiles && r.profiles.name) || 'A neighbour', ig: r.profiles && r.profiles.instagram,
    types: (r.types && r.types.length) ? r.types : [r.type],
    label: ((r.types && r.types.length) ? r.types : [r.type]).map(t => t === 'Other' ? (r.other_type || 'Other') : t).join(' + '),
    short: (() => { const a = ((r.types && r.types.length) ? r.types : [r.type]).map(t => t === 'Other' ? (r.other_type || 'Other') : t); return a[0] + (a.length > 1 ? ' +' + (a.length - 1) : ''); })(),
    photos: ph.map(p => ({id: p.id, path: p.path, caption: p.caption, url: photoUrl(p.path), thumb: photoUrl(thumbPath(p.path))}))};
}
async function loadRenos() {
  const {data, error} = await sb.from('renos').select('*, profiles!user_id(name,instagram), reno_photos(id,path,caption,position)').order('created_at', {ascending: false}).limit(500);
  if (error) diag = 'QUERY ERROR: ' + (error.message || JSON.stringify(error));
  if (error) { $('#list').innerHTML = `<div class="empty"><h3>Could not load renos</h3><p class="sub">${esc(error.message)}</p></div>`; return; }
  S.renos = data.flatMap(r => { try { return [norm(r)]; } catch (e) { console.error('Could not read reno', r.id, e); return []; } });
  diag = 'database returned ' + data.length + ' row(s), readable ' + S.renos.length + ', signed in ' + !!S.user;
  if (S.renos.length < data.length) toast((data.length - S.renos.length) + ' reno(s) could not be displayed');
  render(true);
  const m = location.hash.match(/^#r=([0-9a-f-]{36})$/); if (m && S.renos.find(r => r.id === m[1])) openReno(m[1]);
}
async function loadMine() {
  if (!S.user) { S.favs = new Set(); S.convos = []; S.blocks = new Map(); S.book = []; S.bookKeys = new Set(); updateNav(); render(); route(); return; }
  const [p, f, bl, tb] = await Promise.all([
    sb.from('profiles').select('*').eq('id', S.user.id).maybeSingle(),
    sb.from('favourites').select('reno_id'),
    sb.from('blocks').select('blocked_id, p:profiles!blocked_id(name)'),
    sb.from('saved_tradies').select('*').order('created_at', {ascending: false})]);
  S.book = (tb && tb.data) || []; S.bookKeys = new Set(S.book.map(x => x.tkey));
  S.blocks = new Map(((bl && bl.data) || []).map(r => [r.blocked_id, (r.p && r.p.name) || 'A member']));
  S.profile = p.data || {id: S.user.id, name: '', suburb: '', bio: '', instagram: '', email_notifications: true};
  S.favs = new Set((f.data || []).map(x => x.reno_id));
  await loadConvos(); render(); updateNav();
  if (S.wantView) { const w = S.wantView; S.wantView = null; location.hash = w; } else route();
  if (location.hash === '#messages') { history.replaceState(null, '', location.pathname + location.search); inboxModal(); }
}
async function loadConvos() {
  if (!S.user) return;
  const {data} = await sb.from('conversations').select('id,reno_id,asker_id,owner_id,reno:renos(title),asker:profiles!asker_id(name),owner:profiles!owner_id(name),messages(body,created_at,sender_id)')
    .order('created_at', {referencedTable: 'messages', ascending: false}).limit(1, {referencedTable: 'messages'});
  S.convos = (data || []).filter(c => c.messages && c.messages.length).sort((a, b) => b.messages[0].created_at.localeCompare(a.messages[0].created_at));
  updateNav();
}
const otherId = c => c.asker_id === S.user.id ? c.owner_id : c.asker_id;
const unread = c => { const m = c.messages[0]; return m.sender_id !== S.user.id && new Date(m.created_at) > new Date(S.seen[c.id] || 0); };
function updateNav() {
  const on = !!S.user;
  $('#favN').textContent = S.favs.size; $('#favN').hidden = !S.favs.size;
  const u = on ? S.convos.filter(c => !S.blocks.has(otherId(c))).filter(unread).length : 0; $('#msgN').textContent = u; $('#msgN').hidden = !u;
  $('#meBtn').textContent = on ? ((S.profile && S.profile.name) || S.user.email || '?')[0].toUpperCase() : '?';
}

/* ---------- browse ---------- */
function filtered() {
  const F = S.F, q = F.q.toLowerCase();
  const r = S.renos.filter(d => (!F.mine || (S.user && d.user_id === S.user.id)) && (!F.sub || (d.suburb === F.sub.name && d.state === F.sub.state)) && (!F.types.size || d.types.some(t => F.types.has(t))) &&
    (F.max >= 500 || effCost(d) == null || effCost(d) <= F.max * 1000) && (!F.home || d.home_type === F.home) && (!F.size || d.job_size === F.size) &&
    (!q || [d.title, d.story, d.label, d.type, d.suburb, d.owner, ...(d.trades || []).map(t => t.name + ' ' + t.trade)].join(' ').toLowerCase().includes(q)));
  const s = {new: (a, b) => b.created_at.localeCompare(a.created_at), lo: (a, b) => (effCost(a) ?? Infinity) - (effCost(b) ?? Infinity), hi: (a, b) => (effCost(b) ?? -1) - (effCost(a) ?? -1)}[F.sort];
  return r.sort(s);
}
function card(d) {
  const c = COL[d.type] || COL.Other, ph = d.photos[0];
  const bg = ph ? `url(&quot;${ph.thumb}&quot;) center/cover` : `linear-gradient(145deg,${c[0]},${c[1]})`;
  return `<div class="card ${S.sel === d.id ? 'on' : ''}" data-id="${d.id}" tabindex="0" role="button"><div class="cover" style="background:${bg}">${ph ? '' : EM[d.type] || '🔨'}<i class="hb ${S.favs.has(d.id) ? 'on' : ''}" role="button" tabindex="0" aria-label="Save reno" data-fav="${d.id}">♥</i><span class="t">${esc(d.short)}</span></div><div class="cb"><h3 style="font-size:19px;line-height:1.25;margin:0 0 4px">${esc(d.title)}</h3><div class="sub">${esc(d.suburb)}, ${esc(d.state)}${d.home_type ? ' · ' + esc(d.home_type) : ''} · by ${esc(d.owner)}</div><div class="meta"><span class="tag">⏱ ${d.months} mo</span><span class="tag">🏛 ${d.council_days ? d.council_days + ' days' : 'No permit'}</span>${d.job_size ? `<span class="tag">${esc(SIZES[d.job_size])}</span>` : ''}${d.photos.length ? `<span class="tag">📷 ${d.photos.length}</span>` : ''}</div></div></div>`;
}
let map, layer, markers = {}, firstFit = true;
const jit = id => { let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0; return [((h % 1000) / 1000 - .5) * .006, (((h >> 10) % 1000) / 1000 - .5) * .006]; };
const pinIcon = (d, on) => L.divIcon({className: 'pinwrap', iconSize: [0, 0], html: `<div class="pin ${on ? 'on' : ''}">${EM[d.type] || '🔨'}${d.types.length > 1 ? '<small>+' + (d.types.length - 1) + '</small>' : ''}</div>`});
function initMap() {
  if (map || typeof L === 'undefined') return;
  map = L.map('map').setView([-25.3, 133.8], 4);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);
  layer = L.layerGroup().addTo(map);
}
function drawMap(list, fit) {
  initMap(); if (!map) return; layer.clearLayers(); markers = {};
  const pts = [];
  list.forEach(d => { const j = jit(d.id), ll = [d.lat + j[0], d.lng + j[1]]; pts.push(ll);
    const m = L.marker(ll, {icon: pinIcon(d, S.sel === d.id), keyboard: true, title: d.title}).on('click', () => openReno(d.id)).addTo(layer);
    m.on('mouseover', () => setSel(d.id)); markers[d.id] = m; });
  if (fit && pts.length) map.fitBounds(pts, {padding: [40, 40], maxZoom: firstFit && pts.length > 1 ? 13 : 14});
  else if (fit) map.setView([-25.3, 133.8], 4);
  if (fit) firstFit = false;
}
function setSel(id) {
  const prev = S.sel; if (prev === id) return; S.sel = id;
  [prev, id].forEach(x => { const d = S.renos.find(r => r.id === x); if (d && markers[x]) markers[x].setIcon(pinIcon(d, x === S.sel)); });
  document.querySelectorAll('.card').forEach(c => c.classList.toggle('on', c.dataset.id === id));
}
function render(fit) {
  if (!configured) { $('#list').innerHTML = `<div class="empty"><div style="font-size:42px">🔧</div><h3>Almost there</h3><p class="sub">Add your Supabase details to js/config.js. The README walks you through it.</p></div>`; return; }
  $('#maxV').textContent = S.F.max >= 500 ? '$500k+' : '$' + S.F.max + 'k';
  { const n = (S.F.max < 500) + !!S.F.home + !!S.F.size; $('#moreBtn').textContent = 'More filters' + (n ? ' (' + n + ')' : ''); }
  const r = filtered(), where = S.F.mine ? ' from you' : S.F.sub ? ' in ' + S.F.sub.name : ' across Australia';
  $('#count').textContent = r.length + (r.length === 1 ? ' reno' : ' renos') + where + (DEBUG ? ' [DEBUG: ' + diag + '; after filters ' + r.length + '; project ' + (C.SUPABASE_URL || '').replace('https://', '') + ']' : '');
  $('#list').innerHTML = r.length ? r.map(card).join('') : (S.renos.length
    ? '<div class="empty"><div style="font-size:42px">🪚</div><h3>No renos match</h3><p class="sub">Try a higher budget or clear a filter.</p></div>'
    : '<div class="empty"><img class="lg" src="assets/logo.svg" width="62" height="64" alt=""><h3>No renos here yet</h3><p class="sub">Be the first to share yours!</p><button class="btn" data-act="share">Share your reno</button></div>');
  try { drawMap(r, fit !== false && fit !== undefined ? true : false); } catch (e) { console.error('Map error', e); }
}

/* ---------- modal helpers ---------- */
function shell(html, onClose, guard) {
  const m = $('#modal');
  m.innerHTML = `<div class="ov" id="ov"><div class="sheet" role="dialog" aria-modal="true" tabindex="-1" style="outline:none"><div class="xbar" style="position:sticky;top:0;height:0;z-index:20"><button class="x" aria-label="Close" style="position:absolute;right:14px;top:14px;width:40px;height:40px;border:0;border-radius:50%;background:rgba(255,255,255,.96);color:#1d1b3a;font-size:18px;line-height:1;box-shadow:0 2px 10px rgba(0,0,0,.28);cursor:pointer;padding:0">✕</button></div>${html}</div></div>`;
  const close = () => { m.innerHTML = ''; S.curThread = null; if (location.hash.startsWith('#r=')) history.replaceState(null, '', location.pathname + location.search + viewHash()); onClose && onClose(); };
  $('#ov').onclick = e => { if (e.target.closest('.x')) { if (guard && !guard()) return; close(); } else if (e.target.id === 'ov' && !guard) close(); };
  m.querySelector('.sheet').focus();
  return m.querySelector('.sheet');
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') { const lb = $('.lb'); if (lb) lb.remove(); else { const x = $('#modal .x'); if (x) x.click(); } } });
const head = (title, sub, grad) => `<div class="sh" style="background:linear-gradient(145deg,${grad || 'var(--sun),var(--coral)'})"><h2>${title}</h2>${sub ? `<p style="margin:4px 0 0">${sub}</p>` : ''}</div>`;

/* ---------- auth + profile ---------- */
function authModal(mode, msg) {
  mode = mode || 'in';
  const sh = shell(head(mode === 'in' ? 'Welcome back' : 'Join Renomates', 'Sign in to share renos, save favourites and message neighbours.') + `<div class="bd"><form id="af">
  ${mode === 'up' ? '<label class="l">Your name</label><input id="an" required maxlength="60" autocomplete="name" placeholder="e.g. Sam O.">' : ''}
  <label class="l">Email</label><input id="ae" type="email" required autocomplete="email">
  <label class="l">Password</label><input id="ap" type="password" required minlength="8" autocomplete="${mode === 'in' ? 'current-password' : 'new-password'}">
  ${mode === 'in' ? '<button type="button" class="link" id="fp" style="margin-top:8px;font-size:13px">Forgot your password?</button>' : ''}
  ${mode === 'up' ? '<label style="display:flex;gap:8px;align-items:flex-start;margin-top:14px;font-size:13px;font-weight:400"><input type="checkbox" id="ag" required style="width:auto;margin-top:3px;padding:0"><span>I’m 18 or over and agree to the <a href="terms.html" target="_blank" rel="noopener">Terms of use</a> and <a href="privacy.html" target="_blank" rel="noopener">Privacy policy</a>.</span></label>' : ''}
  <p class="err" id="aerr">${esc(msg || '')}</p><p class="hint" id="ainfo"></p>
  <button class="btn" style="width:100%;margin-top:12px">${mode === 'in' ? 'Sign in' : 'Create account'}</button></form>
  <button class="btn alt oauth" id="goog">Continue with Google</button>
  <p class="sub" style="text-align:center;margin-top:14px">${mode === 'in' ? 'New here? <button class="link" id="sw">Create an account</button>' : 'Already a member? <button class="link" id="sw">Sign in</button>'}</p></div>`, null, () => true);
  sh.querySelector('.sh').insertAdjacentHTML('afterbegin', '<img src="assets/logo.svg" width="48" height="49" alt="" style="display:block;margin-bottom:10px">');
  sh.querySelector('#sw').onclick = () => authModal(mode === 'in' ? 'up' : 'in');
  const fp = sh.querySelector('#fp'); if (fp) fp.onclick = () => resetRequestModal($('#ae').value.trim());
  sh.querySelector('#goog').onclick = async () => { const {error} = await sb.auth.signInWithOAuth({provider: 'google', options: {redirectTo: location.origin + location.pathname}}); if (error) sh.querySelector('#aerr').textContent = error.message.includes('provider') ? 'Google sign-in is not switched on yet.' : error.message; };
  sh.querySelector('#af').onsubmit = async e => {
    e.preventDefault(); const em = $('#ae').value.trim(), pw = $('#ap').value, err = $('#aerr'); err.textContent = '';
    if (mode === 'in') { const {error} = await sb.auth.signInWithPassword({email: em, password: pw}); if (error) return err.textContent = error.message; $('#modal').innerHTML = ''; }
    else { const {data, error} = await sb.auth.signUp({email: em, password: pw, options: {data: {full_name: $('#an').value.trim()}, emailRedirectTo: location.origin + location.pathname}});
      if (error) return err.textContent = error.message;
      track('sign_up'); if (!data.session) { $('#ainfo').textContent = 'Check your email for a confirmation link, then sign in.'; return; } $('#modal').innerHTML = ''; }
  };
}
function resetRequestModal(prefill) {
  const sh = shell(head('Reset your password', 'Enter your email and we’ll send you a link to choose a new one.') + `<div class="bd"><form id="rf2">
  <label class="l">Email</label><input id="re" type="email" required autocomplete="email" value="${esc(prefill)}">
  <p class="err" id="rerr" role="alert"></p><p class="hint" id="rok" role="status"></p>
  <button class="btn" style="width:100%;margin-top:12px">Send reset link</button></form>
  <p class="sub" style="text-align:center;margin-top:14px"><button class="link" id="bkIn">Back to sign in</button></p></div>`, null, () => true);
  sh.querySelector('#bkIn').onclick = () => authModal('in');
  sh.querySelector('#rf2').onsubmit = async e => {
    e.preventDefault(); const em = $('#re').value.trim(), err = $('#rerr'), ok = $('#rok'); err.textContent = ''; ok.textContent = '';
    const {error} = await sb.auth.resetPasswordForEmail(em, {redirectTo: location.origin + location.pathname});
    if (error && (error.status === 429 || /seconds|rate limit/i.test(error.message || ''))) return err.textContent = 'Please wait a minute before asking for another link.';
    ok.textContent = 'If there’s an account for ' + em + ', a reset link is on its way. It can take a minute, and it may land in your spam folder.';
  };
}
function newPasswordModal() {
  if ($('#modal h2[data-pw]')) return;
  const sh = shell(head('Choose a new password', 'Pick something at least 8 characters long.') + `<div class="bd"><form id="npf">
  <label class="l">New password</label><input id="np1" type="password" required minlength="8" autocomplete="new-password">
  <label class="l">Type it again</label><input id="np2" type="password" required minlength="8" autocomplete="new-password">
  <p class="err" id="nerr" role="alert"></p>
  <button class="btn" style="width:100%;margin-top:12px">Save new password</button></form></div>`, null, () => true);
  sh.querySelector('h2').dataset.pw = '1';
  sh.querySelector('#npf').onsubmit = async e => {
    e.preventDefault(); const a = $('#np1').value, b = $('#np2').value, err = $('#nerr'); err.textContent = '';
    if (a.length < 8) return err.textContent = 'Use at least 8 characters.';
    if (a !== b) return err.textContent = 'The two passwords don’t match.';
    const {error} = await sb.auth.updateUser({password: a}); if (error) return err.textContent = error.message;
    $('#modal').innerHTML = ''; toast('Password updated. You’re signed in.');
  };
}
function profileModal(msg) {
  if (!S.user) return authModal();
  const p = S.profile || {};
  const sh = shell(head('Your profile', 'Neighbours see your name when you share a reno.') + `<div class="bd"><form id="pf">
  ${msg ? `<p class="err">${esc(msg)}</p>` : ''}
  <label class="l">Name</label><input id="pn" required maxlength="60" value="${esc(p.name)}" placeholder="e.g. Sam O.">
  <label class="l">Suburb (optional)</label><input id="ps" maxlength="60" value="${esc(p.suburb)}">
  <label class="l">About you</label><textarea id="pb" rows="3" maxlength="300">${esc(p.bio)}</textarea>
  <label class="l">Instagram handle (optional)</label><input id="pi" maxlength="30" value="${esc(p.instagram)}" placeholder="yourhandle">
  <p class="hint">Adds a link to your listings. Photos can't be imported from Instagram, so upload them directly.</p>
  <label style="display:flex;gap:8px;align-items:flex-start;margin-top:16px;font-size:14px;font-weight:500"><input type="checkbox" id="pe" ${p.email_notifications === false ? '' : 'checked'} style="width:auto;margin-top:3px;padding:0"><span>Email me when I get a new message<br><small style="color:var(--mute);font-weight:400">We send at most one email every 30 minutes per conversation, and never include the message itself.</small></span></label>
  <button class="btn" style="width:100%;margin-top:14px">Save profile</button></form>
  <p class="sub" style="margin-top:14px">Signed in as ${esc(S.user.email)} · <button class="link" id="so">Sign out</button> · <button class="link" id="cpw">Change password</button></p>
  ${S.blocks.size ? `<div style="margin-top:16px"><b>Blocked members</b>${[...S.blocks].map(([id, n]) => `<div class="trade"><span>${esc(n)}</span><button class="link" data-unb="${esc(id)}">Unblock</button></div>`).join('')}</div>` : ''}
  <p class="sub" style="margin-top:6px"><button class="link" id="del" style="color:#d33">Delete my account</button></p></div>`, null, () => true);
  sh.querySelector('#del').onclick = deleteAccountModal;
  sh.querySelector('#cpw').onclick = newPasswordModal;
  sh.querySelectorAll('[data-unb]').forEach(b => b.onclick = () => unblockMember(b.dataset.unb, () => profileModal()));
  sh.querySelector('#so').onclick = async () => { await sb.auth.signOut(); $('#modal').innerHTML = ''; toast('Signed out'); };
  sh.querySelector('#pf').onsubmit = async e => {
    e.preventDefault();
    const row = {id: S.user.id, name: $('#pn').value.trim(), suburb: $('#ps').value.trim(), bio: $('#pb').value.trim(), instagram: $('#pi').value.replace(/[^A-Za-z0-9._]/g, '').slice(0, 30), email_notifications: $('#pe').checked};
    let {error} = await sb.from('profiles').upsert(row);
    if (error && /email_notifications/.test(error.message)) { const r2 = {...row}; delete r2.email_notifications; ({error} = await sb.from('profiles').upsert(r2)); }
    if (error) return toast('Could not save: ' + error.message);
    S.profile = row; updateNav(); $('#modal').innerHTML = ''; toast('Profile saved'); loadRenos();
  };
}
function deleteAccountModal() {
  const mine = S.renos.filter(r => r.user_id === S.user.id);
  const sh = shell(head('Delete your account', 'This can’t be undone.', 'var(--coral),var(--sun)') + `<div class="bd"><form id="df">
  <p style="margin-top:18px">This will permanently delete:</p>
  <ul><li>your profile and sign-in</li><li>your ${mine.length} ${mine.length === 1 ? 'reno' : 'renos'} and all their photos</li><li>your saved renos</li><li>your messages and conversations</li></ul>
  <p class="hint">Copies other people have already saved or shared can’t be recalled. Backups are removed as they expire.</p>
  <label class="l">Type DELETE to confirm</label><input id="dc" autocomplete="off" autocapitalize="characters" placeholder="DELETE">
  <p class="err" id="derr" role="alert"></p>
  <button class="btn danger" id="dgo" style="width:100%;margin-top:12px" disabled>Permanently delete my account</button></form></div>`, null, () => true);
  const inp = sh.querySelector('#dc'), go = sh.querySelector('#dgo');
  inp.oninput = () => { go.disabled = inp.value.trim() !== 'DELETE'; };
  sh.querySelector('#df').onsubmit = async e => {
    e.preventDefault(); if (inp.value.trim() !== 'DELETE') return;
    go.disabled = true; go.textContent = 'Deleting...'; const err = sh.querySelector('#derr'); err.textContent = '';
    try { await deleteAccount(); }
    catch (x) { go.disabled = false; go.textContent = 'Permanently delete my account'; err.textContent = (x && x.message) || 'Something went wrong. Nothing else was deleted. Please try again.'; return; }
    $('#modal').innerHTML = ''; toast('Your account has been deleted. Take care!');
  };
}
async function deleteAccount() {
  const mine = S.renos.filter(r => r.user_id === S.user.id);
  const paths = mine.flatMap(r => r.photos.flatMap(p => [p.path, thumbPath(p.path)]));
  for (let i = 0; i < paths.length; i += 50) { const {error} = await sb.storage.from(BUCKET).remove(paths.slice(i, i + 50)); if (error) throw new Error('Could not delete your photos: ' + error.message); }
  const {error} = await sb.rpc('delete_my_account'); if (error) throw new Error('Could not delete your account: ' + error.message);
  try { ['rm_draft', 'rm_seen', 'rm_fav', 'rm_prof'].forEach(k => localStorage.removeItem(k)); } catch (x) {}
  await sb.auth.signOut({scope: 'local'});
  S.user = null; S.profile = null; S.favs = new Set(); S.convos = []; updateNav(); loadRenos();
}
const needName = () => { if (!S.user) { authModal(); return true; } if (!S.profile || !S.profile.name) { profileModal('Add your name first so neighbours know who you are.'); return true; } return false; };

/* ---------- favourites ---------- */
async function toggleFav(id) {
  if (!S.user) return authModal();
  const had = S.favs.has(id);
  had ? S.favs.delete(id) : S.favs.add(id); updateNav();
  document.querySelectorAll(`.hb[data-fav="${id}"]`).forEach(x => x.classList.toggle('on', !had));
  const {error} = had ? await sb.from('favourites').delete().eq('reno_id', id) : await sb.from('favourites').insert({reno_id: id});
  if (!had) track('save_reno');
  if (error) { had ? S.favs.add(id) : S.favs.delete(id); updateNav(); render(); return toast('Could not update saved renos'); }
  toast(had ? 'Removed from saved' : 'Saved to your favourites');
  if (S.view === 'saved') renderSaved();
}

/* ---------- reno detail ---------- */

/* ---------- pages: My renos, Tradie book, Saved ---------- */
const viewHash = () => ({mine: '#/mine', book: '#/book', saved: '#/saved'}[S.view] || '');
function currentView() { const m = location.hash.match(/^#\/(mine|book|saved)$/); return m ? m[1] : 'explore'; }
function route() {
  let v = currentView();
  if (v !== 'explore' && !S.user) {
    if (!S.authReady) return;
    const want = v; S.wantView = location.hash; history.replaceState(null, '', location.pathname + location.search); v = 'explore';
    authModal('in', 'Sign in to see your ' + ({mine: 'renos', book: 'tradie book', saved: 'saved renos'}[want]) + '.');
  }
  const changed = S.view !== v; S.view = v;
  $('#exploreView').hidden = v !== 'explore'; $('#pageView').hidden = v === 'explore';
  document.querySelectorAll('#nav .nv[data-v]').forEach(a => a.setAttribute('aria-current', a.dataset.v === v ? 'page' : 'false'));
  if (v === 'mine') renderMine(); else if (v === 'book') renderBook(); else if (v === 'saved') renderSaved();
  else if (map) setTimeout(() => map.invalidateSize(), 60);
  if (changed) window.scrollTo(0, 0);
}
function renderMine() {
  const mine = S.renos.filter(d => S.user && d.user_id === S.user.id);
  $('#pageView').innerHTML = `<div class="pagehead"><div><h1 class="pt">My renos</h1><p class="sub">${mine.length ? mine.length + (mine.length === 1 ? ' reno' : ' renos') + ' shared. Tap one to edit it, copy its link or delete it.' : 'Your renos will live here.'}</p></div><button class="btn" data-act="share">Share a reno</button></div>
  <div class="list">${mine.length ? mine.map(card).join('') : '<div class="empty"><img class="lg" src="assets/logo.svg" width="62" height="64" alt=""><h3>You haven’t shared a reno yet</h3><p class="sub">Share yours and save a neighbour time and money. It takes about 3 minutes.</p></div>'}</div>`;
}
function renderSaved() {
  const l = S.renos.filter(d => S.favs.has(d.id));
  $('#pageView').innerHTML = `<div class="pagehead"><div><h1 class="pt">Saved renos</h1><p class="sub">${l.length} saved. Only you can see this.</p></div></div>
  <div class="list">${l.length ? l.map(card).join('') : '<div class="empty"><div style="font-size:42px">♥</div><h3>Nothing saved yet</h3><p class="sub">Tap the heart on any reno to keep it here.</p></div>'}</div>`;
}
function tradieStats(key) {
  const owners = new Set(); let sum = 0, cnt = 0;
  S.renos.forEach(r => (r.trades || []).forEach(t => { if (tkey(t) === key) { owners.add(r.user_id); sum += t.rating || 0; cnt++; } }));
  return {neighbours: owners.size, avg: cnt ? sum / cnt : 0};
}
function renderBook() {
  const kinds = [...new Set(S.book.map(b => b.trade).filter(Boolean))].sort(), f = S.bookTrade || '';
  const items = S.book.filter(b => !f || b.trade === f).map(b => {
    const reno = S.renos.find(r => r.id === b.reno_id), live = reno && (reno.trades || []).find(t => tkey(t) === b.tkey);
    const name = (live && live.name) || b.name, trade = (live && live.trade) || b.trade, site = safeUrl((live && live.website) || b.website), note = live && live.note, st = tradieStats(b.tkey);
    return `<div class="tcard"><div style="min-width:0"><b class="tn2">${esc(name)}</b>${trade ? `<span class="tag">${esc(trade)}</span>` : ''}
      ${site ? `<div><a class="site" href="${esc(site)}" target="_blank" rel="noopener noreferrer nofollow ugc">🔗 ${esc(siteHost(site))}</a></div>` : ''}
      ${note ? `<div class="note">“${esc(note)}”</div>` : ''}
      <div class="sub" style="margin-top:6px">${st.neighbours ? `★ ${st.avg.toFixed(1)} · recommended by ${st.neighbours} ${st.neighbours === 1 ? 'neighbour' : 'neighbours'}` : 'Not currently listed on a reno'}</div>
      ${reno ? `<div class="sub" style="margin-top:2px">Saved from <button class="link" data-reno="${esc(reno.id)}" style="text-align:left">${esc(reno.title)}</button> in ${esc(reno.suburb)}</div>` : ''}</div>
      <button class="tb on" data-tk="${esc(b.tkey)}" aria-label="Remove ${esc(name)} from your tradie book" title="Remove from your tradie book">♥</button></div>`;
  }).join('');
  $('#pageView').innerHTML = `<div class="pagehead"><div><h1 class="pt">Tradie book</h1><p class="sub">Tradies you’ve saved from your neighbours’ renos. Only you can see this.</p></div>${kinds.length > 1 ? `<select id="bkTrade" aria-label="Filter by trade"><option value="">All trades</option>${kinds.map(t => `<option ${t === f ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>` : ''}</div>
  ${S.book.length ? (items || '<p class="sub" style="margin-top:16px">No saved tradies for that trade.</p>') : '<div class="empty" style="margin-top:16px"><div style="font-size:42px">🧰</div><h3>Your tradie book is empty</h3><p class="sub">Open a reno and tap the ♥ next to a tradie to save them here. Then you’ll always know who your neighbours would call.</p></div>'}`;
}
const paintTradies = () => { document.querySelectorAll('.tb[data-tk]').forEach(b => b.classList.toggle('on', S.bookKeys.has(b.dataset.tk))); if (S.view === 'book') renderBook(); };
async function toggleTradie(tk, renoId, idx) {
  if (!S.user) return authModal();
  if (S.bookKeys.has(tk)) {
    const prev = S.book; S.bookKeys.delete(tk); S.book = S.book.filter(b => b.tkey !== tk); paintTradies();
    const {error} = await sb.from('saved_tradies').delete().eq('tkey', tk);
    if (error) { S.book = prev; S.bookKeys.add(tk); paintTradies(); return toast('Could not remove: ' + error.message); }
    return toast('Removed from your tradie book');
  }
  const d = S.renos.find(r => r.id === renoId), t = d && (d.trades || [])[idx]; if (!t) return;
  const row = {tkey: tk, name: t.name, trade: t.trade || '', website: safeUrl(t.website) || null, reno_id: renoId};
  S.bookKeys.add(tk); S.book = [{...row, created_at: new Date().toISOString()}, ...S.book]; paintTradies();
  const {error} = await sb.from('saved_tradies').insert(row);
  if (error && error.code !== '23505') { S.book = S.book.filter(b => b.tkey !== tk); S.bookKeys.delete(tk); paintTradies(); return toast('Could not save: ' + error.message); }
  track('tradie_saved'); toast('Saved to your tradie book');
}

const km = (a, b) => { const r = Math.PI / 180, dLa = (b.lat - a.lat) * r, dLn = (b.lng - a.lng) * r, x = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLn / 2) ** 2; return 12742 * Math.asin(Math.sqrt(x)); };
function similar(d) {
  return S.renos.filter(r => r.id !== d.id).map(r => {
    const overlap = r.types.filter(t => d.types.includes(t)).length; if (!overlap) return null;
    const dist = km(d, r); if (dist > 25) return null;
    const score = overlap * 3 + (d.home_type && r.home_type === d.home_type ? 2 : 0) + (d.job_size && r.job_size === d.job_size ? 1 : 0) + (dist < 2 ? 3 : dist < 5 ? 2 : dist < 10 ? 1 : 0);
    return {r, score, dist};
  }).filter(Boolean).sort((a, b) => b.score - a.score || a.dist - b.dist).slice(0, 3).map(x => x.r);
}
function openReno(id) {
  track('view_reno');
  const d = S.renos.find(r => r.id === id); if (!d) return; S.sel = id;
  history.replaceState(null, '', '#r=' + id);
  const c = COL[d.type] || COL.Other, mine = S.user && d.user_id === S.user.id, mx = Math.max(1, ...(d.breakdown || []).map(b => b.amount));
  const first = (d.owner || '').split(' ')[0] || 'them';
  const sim = similar(d), simHtml = sim.length ? `<h3>Others nearby who’ve done something similar</h3><div class="list" id="sim">${sim.map(card).join('')}</div>` : '';
  const sh = shell(`<div class="sh" style="background:linear-gradient(145deg,${c[0]},${c[1]})"><i class="hb ${S.favs.has(id) ? 'on' : ''}" role="button" tabindex="0" aria-label="Save reno" data-fav="${id}" style="right:58px;top:14px;width:36px;height:36px">♥</i><div class="big">${EM[d.type] || '🔨'}</div><h2>${esc(d.title)}</h2><p style="margin:6px 0 0;font-weight:500">${esc(d.suburb)}, ${esc(d.state)} · ${new Date(d.created_at).getFullYear()} · ${esc(d.label)}</p><div style="font-size:16px;font-weight:700;margin-top:10px">${noCost(d) ? 'Cost not shared' : esc(priceLabel(d)) + ' spent'} <span style="font-weight:500">· ${d.months} ${d.months === 1 ? 'month' : 'months'}</span></div></div>
  ${d.photos.length ? `<div class="gal"><img class="main-img" id="mi" src="${d.photos[0].url}" alt="${esc(d.photos[0].caption || d.title)}"><div class="thumbs">${d.photos.map((p, i) => `<img src="${p.thumb}" data-i="${i}" class="${i ? '' : 'on'}" alt="${esc(p.caption || 'Photo ' + (i + 1))}">`).join('')}</div><p class="hint" id="cap">${esc(d.photos[0].caption)}</p></div>` : ''}
  <div class="bd"><div class="who"><span class="av" style="display:grid;place-items:center">${esc(d.owner[0] || '?')}</span><div><b>${esc(d.owner)}</b><div class="sub">Renovated in ${esc(d.suburb)}</div></div>${d.ig ? `<a href="https://instagram.com/${esc(d.ig)}" target="_blank" rel="noopener" class="tag" style="margin-left:auto;text-decoration:none;color:inherit">📷 @${esc(d.ig)}</a>` : ''}</div>
  ${(d.home_type || d.job_size) ? `<div class="meta" style="margin-top:12px">${d.home_type ? `<span class="tag">🏠 ${esc(d.home_type)}</span>` : ''}${d.job_size ? `<span class="tag">🔧 ${esc(SIZES[d.job_size])}</span>` : ''}</div>` : ''}
  <h3>The story</h3><p style="margin:0;white-space:pre-wrap">${esc(d.story)}</p>
  ${(d.breakdown || []).length ? `<h3>Where the money went</h3>${d.breakdown.map(b => `<div class="bk"><span>${esc(b.label)}</span><b style="width:${Math.max(6, b.amount / mx * 100)}%"></b><em>${k(b.amount)}</em></div>`).join('')}` : ''}
  ${(d.trades || []).length ? `<h3>Trades worth calling</h3>${d.trades.map((t, i) => { const site = safeUrl(t.website), k2 = tkey(t); return `<div class="trade"><div class="tl"><b>${esc(t.name)}</b><div class="sub">${esc(t.trade)}</div>${site ? `<a class="site" href="${esc(site)}" target="_blank" rel="noopener noreferrer nofollow ugc">🔗 ${esc(siteHost(site))}</a>` : ''}${t.note ? `<div class="note">“${esc(t.note)}”</div>` : ''}</div><div class="tside"><span style="color:var(--coral)">${stars(t.rating || 0)}</span><button class="tb ${S.bookKeys.has(k2) ? 'on' : ''}" data-tk="${esc(k2)}" data-ri="${esc(d.id)}" data-ti="${i}" aria-label="Save ${esc(t.name)} to your tradie book" title="Save to your tradie book">♥</button></div></div>`; }).join('')}` : ''}
  <h3>Working with the council</h3><div class="cn"><div><div class="n disp">${d.council_days || 0}</div><div class="sub">days</div></div><div><b>${d.council_days ? 'Approval needed' : 'No permit needed'}</b><div class="sub">${esc(d.council_notes || '')}</div></div></div>
  ${simHtml}
  <p class="hint" style="margin-top:14px">Costs and reviews are self-reported and not verified.</p>
  ${mine ? `<h3>This is your reno</h3><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="ed">Edit</button><button class="btn alt" id="cl">Copy link</button><button class="btn danger" id="del">Delete</button></div>`
    : `<h3>Ask ${esc(first)} a question</h3>${S.user && S.blocks.has(d.user_id) ? `<p class="sub">You’ve blocked ${esc(first)}. <button class="link" id="ub2">Unblock</button> to send a message.</p>` : S.user ? `<form id="mf"><textarea rows="3" required maxlength="1000" placeholder="Hi! How did you find your builder?"></textarea><p class="hint">Messages are private between you and ${esc(first)}.</p><button class="btn" style="margin-top:10px;width:100%">Connect with ${esc(first)}</button></form>` : `<p class="sub">Sign in to message ${esc(first)}.</p><button class="btn" id="si">Sign in</button>`}
    <div style="display:flex;gap:16px;margin-top:16px"><button class="link" id="cl">Copy link</button><button class="link" id="rp">Report this listing</button>${S.user && !d.sample && !S.blocks.has(d.user_id) ? `<button class="link" id="bm">Block ${esc(first)}</button>` : ''}</div>`}</div>`);
  const g = (q) => sh.querySelector(q);
  if (d.photos.length) {
    sh.querySelector('.thumbs').onclick = e => { const i = e.target.closest('img'); if (!i) return; const p = d.photos[+i.dataset.i]; g('#mi').src = p.url; g('#cap').textContent = p.caption || ''; sh.querySelectorAll('.thumbs img').forEach(x => x.classList.toggle('on', x === i)); };
    g('#mi').onclick = () => { const lb = document.createElement('div'); lb.className = 'lb'; lb.innerHTML = `<img src="${g('#mi').src}" alt="">`; lb.onclick = () => lb.remove(); document.body.appendChild(lb); };
  }
  const sm = g('#sim'); if (sm) sm.onclick = e => { if (e.target.closest('.hb')) return; const c = e.target.closest('.card'); if (c) openReno(c.dataset.id); };
  const cl = g('#cl'); if (cl) cl.onclick = () => { const u = location.origin + location.pathname + '#r=' + id; if (navigator.clipboard) navigator.clipboard.writeText(u).then(() => toast('Link copied'), () => prompt('Copy this link', u)); else prompt('Copy this link', u); };
  if (g('#si')) g('#si').onclick = () => authModal();
  if (g('#ed')) g('#ed').onclick = () => formModal(d);
  if (g('#del')) g('#del').onclick = () => delReno(d);
  if (g('#rp')) g('#rp').onclick = () => reportModal(d);
  if (g('#bm')) g('#bm').onclick = () => blockMember(d.user_id, d.owner, () => openReno(id));
  if (g('#ub2')) g('#ub2').onclick = () => unblockMember(d.user_id, () => openReno(id));
  if (g('#mf')) g('#mf').onsubmit = async e => { e.preventDefault(); if (needName()) return; const txt = g('#mf textarea').value.trim(); if (txt) await startConvo(d, txt); };
}
async function delReno(d) {
  if (!confirm('Delete this reno and its photos? This cannot be undone.')) return;
  const paths = d.photos.flatMap(p => [p.path, thumbPath(p.path)]);
  if (paths.length) await sb.storage.from(BUCKET).remove(paths);
  const {error} = await sb.from('renos').delete().eq('id', d.id); if (error) return toast('Could not delete: ' + error.message);
  $('#modal').innerHTML = ''; toast('Reno deleted'); loadRenos();
}
function reportModal(d) {
  const sh = shell(head('Report this listing', 'Tell us what is wrong. Reports are reviewed by the Renomates team.') + `<div class="bd"><form id="rf"><label class="l">Reason</label><select id="rr"><option>Fake or misleading costs</option><option>Spam or advertising</option><option>Offensive or defamatory</option><option>Shows personal information</option><option>Other</option></select><label class="l">Details (optional)</label><textarea id="rd" rows="3" maxlength="300"></textarea><button class="btn" style="margin-top:12px;width:100%">Send report</button></form></div>`);
  sh.querySelector('#rf').onsubmit = async e => { e.preventDefault(); if (!S.user) return authModal();
    const {error} = await sb.from('reports').insert({reno_id: d.id, reason: ($('#rr').value + ': ' + $('#rd').value).trim().slice(0, 500)});
    $('#modal').innerHTML = ''; toast(error ? 'Could not send report' : 'Thanks. We will take a look.'); };
}

/* ---------- messages ---------- */
async function startConvo(d, text) {
  let {data: ex} = await sb.from('conversations').select('id').eq('reno_id', d.id).eq('asker_id', S.user.id).maybeSingle();
  let id = ex && ex.id;
  if (!id) { const {data, error} = await sb.from('conversations').insert({reno_id: d.id, owner_id: d.user_id}).select('id').single(); if (error) return toast(error.code === '42501' ? 'This member can’t be messaged right now.' : 'Could not start chat: ' + error.message); id = data.id; }
  const {error} = await sb.from('messages').insert({conversation_id: id, body: text.slice(0, 1000)});
  if (error) return toast(error.code === '42501' ? 'This member can’t be messaged right now.' : 'Message not sent: ' + error.message);
  track('message_sent'); await loadConvos(); threadModal(id);
}
async function blockMember(id, name, after) {
  if (!S.user) return authModal();
  if (!confirm('Block ' + name + '? You won’t be able to message each other, and their conversations will be hidden. You can unblock them any time from your profile.')) return;
  const {error} = await sb.from('blocks').insert({blocked_id: id});
  if (error && error.code !== '23505') return toast('Could not block: ' + error.message);
  S.blocks.set(id, name); updateNav(); toast(name + ' is blocked'); if (after) after();
}
async function unblockMember(id, after) {
  const {error} = await sb.from('blocks').delete().eq('blocked_id', id);
  if (error) return toast('Could not unblock: ' + error.message);
  S.blocks.delete(id); updateNav(); toast('Unblocked'); if (after) after();
}
function reportConversationModal(c) {
  const oid = otherId(c);
  const sh = shell(head('Report this conversation', 'Tell us what’s wrong. Reports are reviewed by the Renomates team.') + `<div class="bd"><form id="rcf"><label class="l">Reason</label><select id="rcr"><option>Harassment or threats</option><option>Spam or advertising</option><option>Scam or fraud</option><option>Offensive content</option><option>Other</option></select><label class="l">Details (optional)</label><textarea id="rcd" rows="3" maxlength="300"></textarea><button class="btn" style="margin-top:12px;width:100%">Send report</button></form></div>`);
  sh.querySelector('#rcf').onsubmit = async e => { e.preventDefault();
    const {error} = await sb.from('reports').insert({reno_id: c.reno_id, reason: ('Conversation with member ' + oid + ': ' + $('#rcr').value + ' ' + $('#rcd').value).trim().slice(0, 500)});
    $('#modal').innerHTML = ''; toast(error ? 'Could not send report' : 'Thanks. We’ll take a look.'); };
}
function inboxModal() {
  const l = S.convos.filter(c => !S.blocks.has(otherId(c)));
  const sh = shell(head('Messages', 'Private chats with renovators', 'var(--mint),var(--sun)') + `<div class="bd" style="padding-top:12px">${l.length ? l.map(c => { const o = c.asker_id === S.user.id ? c.owner : c.asker, m = c.messages[0];
    return `<button class="th" data-c="${c.id}"><span class="av" style="display:grid;place-items:center;flex:none">${esc(((o && o.name) || '?')[0])}</span><span style="min-width:0"><b>${esc((o && o.name) || 'A neighbour')}</b><div class="sub">${esc(c.reno && c.reno.title)}</div><div class="sub" style="color:var(--ink)">${esc(m.body.slice(0, 60))}</div></span>${unread(c) ? '<i class="dot"></i>' : ''}</button>`; }).join('')
    : '<div class="empty"><div style="font-size:42px">✉</div><h3>No messages yet</h3><p class="sub">Open a reno and tap Connect to ask a question.</p></div>'}</div>`);
  sh.querySelector('.bd').onclick = e => { const b = e.target.closest('.th'); if (b) threadModal(b.dataset.c); };
}
async function threadModal(id) {
  const c = S.convos.find(x => x.id === id), o = c ? (c.asker_id === S.user.id ? c.owner : c.asker) : null;
  const oid = c ? otherId(c) : null, blocked = !!(oid && S.blocks.has(oid));
  const {data: msgs} = await sb.from('messages').select('*').eq('conversation_id', id).order('created_at');
  S.seen[id] = new Date().toISOString(); try { localStorage.setItem('rm_seen', JSON.stringify(S.seen)); } catch (e) {} updateNav();
  const sh = shell(head(esc((o && o.name) || 'Chat'), esc((c && c.reno && c.reno.title) || ''), 'var(--mint),var(--sun)') + `<div class="bd" style="padding-top:12px"><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="chip" id="bk">← All messages</button>${blocked ? '' : '<button class="chip" id="blk">🚫 Block</button>'}<button class="chip" id="rpt">⚑ Report</button></div><div id="bubs">${(msgs || []).map(m => `<div class="bub ${m.sender_id === S.user.id ? 'me' : ''}">${esc(m.body)}</div>`).join('')}</div>${blocked ? `<p class="sub" style="margin-top:14px">You’ve blocked ${esc((o && o.name) || 'this member')}. <button class="link" id="unb">Unblock</button> to message them again.</p>` : `<form id="tf" style="display:flex;gap:8px;margin-top:12px"><input id="tt" required maxlength="1000" placeholder="Write a message" aria-label="Message" style="flex:1"><button class="btn">Send</button></form>`}</div>`);
  S.curThread = id;
  sh.querySelector('#bk').onclick = inboxModal;
  const blk = sh.querySelector('#blk'); if (blk) blk.onclick = () => blockMember(oid, (o && o.name) || 'this member', () => inboxModal());
  const unb = sh.querySelector('#unb'); if (unb) unb.onclick = () => unblockMember(oid, () => threadModal(id));
  sh.querySelector('#rpt').onclick = () => c && reportConversationModal(c);
  const tf = sh.querySelector('#tf');
  if (tf) tf.onsubmit = async e => { e.preventDefault(); const t = $('#tt').value.trim(); if (!t) return; $('#tt').value = '';
    const {error} = await sb.from('messages').insert({conversation_id: id, body: t}); if (error) toast(error.code === '42501' ? 'This conversation is no longer available.' : 'Message not sent'); else { await loadConvos(); threadModal(id); } };
  sh.scrollTop = 1e5;
}
function subscribeMessages() {
  sb.channel('rm-msgs').on('postgres_changes', {event: 'INSERT', schema: 'public', table: 'messages'}, async p => {
    if (!S.user || p.new.sender_id === S.user.id) return;
    await loadConvos();
    if (S.curThread === p.new.conversation_id) threadModal(S.curThread); else toast('New message');
  }).subscribe();
}

/* ---------- share / edit form ---------- */
async function readImage(file) {
  if (!file.type.startsWith('image/')) throw new Error('Not an image');
  if (file.size > 15 * 1024 * 1024) throw new Error('Over 15MB');
  const bmp = await (window.createImageBitmap ? createImageBitmap(file) : new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = URL.createObjectURL(file); }));
  const w = bmp.width || bmp.naturalWidth, h = bmp.height || bmp.naturalHeight;
  const enc = (max, q) => new Promise((ok, no) => { const s = Math.min(1, max / Math.max(w, h)), cv = document.createElement('canvas'); cv.width = Math.round(w * s); cv.height = Math.round(h * s); cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height); cv.toBlob(b => b ? ok(b) : no(new Error('encode')), 'image/jpeg', q); });
  const [blob, tblob] = [await enc(1600, .8), await enc(480, .7)];   // re-encoding also strips GPS/EXIF data
  return {blob, tblob, url: URL.createObjectURL(tblob)};
}
function formModal(ex) {
  if (!ex && needName()) return;
  let sub = ex ? {name: ex.suburb, state: ex.state, pc: ex.postcode, lat: ex.lat, lng: ex.lng} : null;
  const T = new Set(ex ? ex.types : []), DRAFT = 'rm_draft';
  let costMode = ex ? (ex.cost_display || 'exact') : 'exact';
  const bandIdx = ex && ex.cost_low != null ? Math.max(0, BANDS.findIndex(b => b[0] === ex.cost_low)) : 3;
  let dirty = false;
  let P = ex ? ex.photos.map(p => ({...p})) : [];
  const orig = ex ? ex.photos.map(p => ({...p})) : [];
  const bk = (ex && ex.breakdown) || [], tr = (ex && ex.trades) || [];
  const bkRow = b => `<div class="row"><input class="bl" maxlength="30" placeholder="e.g. Cabinetry" value="${esc(b && b.label)}"><input class="ba" type="number" min="0" inputmode="numeric" placeholder="$" value="${b && b.amount ? b.amount : ''}"></div>`;
  const trRow = t => `<div class="trow"><div class="row3"><input class="tn" maxlength="50" placeholder="Name or business" value="${esc(t && t.name)}"><input class="tt" maxlength="30" placeholder="Trade" value="${esc(t && t.trade)}"><select class="tr">${[5, 4, 3, 2, 1].map(n => `<option value="${n}" ${t && t.rating === n ? 'selected' : ''}>${n}★</option>`).join('')}</select></div><div class="row"><input class="tw" maxlength="200" inputmode="url" autocapitalize="off" placeholder="Website (optional)" value="${esc(t && t.website)}"><input class="tnote" maxlength="140" placeholder="What made them great? (optional)" value="${esc(t && t.note)}"></div></div>`;
  const MAXBK = 15, MAXTR = 10;
  const sh = shell(head(ex ? 'Edit your reno' : 'Share your reno', 'Help the next neighbour budget with confidence.', 'var(--mint),var(--sun)') + `<div class="bd"><form id="sf" novalidate>
  <label class="l">Headline</label><input id="t" maxlength="120" required value="${esc(ex && ex.title)}" placeholder="e.g. Open-plan kitchen in a 1950s brick home">
  <label class="l">Suburb or postcode</label><div class="field-wrap"><input id="sq" autocomplete="off" placeholder="Start typing, then pick from the list" value="${ex ? esc(ex.suburb + ', ' + ex.state + ' ' + ex.postcode) : ''}"><ul class="ac" id="sa" role="listbox" hidden></ul></div>
  <p class="hint">Suburb only. Never enter a street address.</p>
  <label class="l">Type of reno (pick up to 4)</label><div class="tchips" id="tc">${TYPES.map(t => `<button type="button" class="chip" aria-pressed="${T.has(t)}" data-t="${esc(t)}">${EM[t]} ${esc(t)}</button>`).join('')}</div>
  <div id="ow" ${T.has('Other') ? '' : 'hidden'}><label class="l">Describe your reno</label><input id="ot" maxlength="40" value="${esc(ex && ex.other_type)}" placeholder="e.g. Pool, Solar"></div>
  <div class="row"><div><label class="l">Type of home (optional)</label><select id="hm"><option value="">Skip</option>${HOMES.map(h => `<option ${ex && ex.home_type === h ? 'selected' : ''}>${esc(h)}</option>`).join('')}</select></div>
  <div><label class="l">Size of job (optional)</label><select id="js"><option value="">Skip</option>${Object.entries(SIZES).map(([v, l]) => `<option value="${v}" ${ex && ex.job_size === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div></div>
  <p class="hint">Helps neighbours find renos like theirs. Light refresh: cosmetic, no walls moved. Big update: new fittings or layout changes. Structural or rebuild: walls, extensions or permits.</p>
  <label class="l">Cost: what would you like to show?</label>
  <div class="tchips" id="cm">${[['exact', 'Exact amount'], ['range', 'A range'], ['hidden', 'Prefer not to say']].map(([m, l]) => `<button type="button" class="chip" data-m="${m}" aria-pressed="${costMode === m}">${l}</button>`).join('')}</div>
  <p class="hint">It’s your choice. Only what you choose to show is saved. A breakdown of where the money went needs an exact amount.</p>
  <div id="cExact" ${costMode === 'exact' ? '' : 'hidden'}><label class="l">Total cost ($)</label><input id="c" type="number" min="1" inputmode="numeric" value="${ex && ex.cost != null ? ex.cost : ''}" placeholder="45000"></div>
  <div id="cRange" ${costMode === 'range' ? '' : 'hidden'}><label class="l">Roughly how much?</label><select id="cb">${BANDS.map((b, i) => `<option value="${i}" ${i === bandIdx ? 'selected' : ''}>${bandLabel(b[0], b[1])}</option>`).join('')}</select></div>
  <div class="row"><div><label class="l">Months it took</label><input id="mo" type="number" min="1" inputmode="numeric" value="${ex ? ex.months : ''}" placeholder="3"></div><div></div></div>
  <div id="bkBlock" ${costMode === 'exact' ? '' : 'hidden'}>
  <label class="l">Where the money went (optional)</label><div id="bkRows">${Array.from({length: Math.max(5, bk.length)}, (_, i) => bkRow(bk[i])).join('')}</div>
  <button type="button" class="btn alt sm" id="addBk">+ Add another line</button><p class="hint" id="bkSum"></p></div>
  <label class="l">Best tradies (optional)</label><div id="trRows">${Array.from({length: Math.max(3, tr.length)}, (_, i) => trRow(tr[i])).join('')}</div>
  <button type="button" class="btn alt sm" id="addTr">+ Add another tradie</button>
  <p class="hint">Stick to your own honest experience and use the business name where you can. Add their website so neighbours can find them. Only link to the tradie’s own business website or page.</p>
  <div class="row"><div><label class="l">Council approval (days, 0 if none)</label><input id="cd" type="number" min="0" inputmode="numeric" value="${ex ? ex.council_days : 0}"></div><div></div></div>
  <label class="l">Council notes (optional)</label><input id="cn" maxlength="600" value="${esc(ex && ex.council_notes)}" placeholder="What was it like?">
  <label class="l">Your story</label><textarea id="st" rows="4" maxlength="3000" placeholder="What would you tell a neighbour?">${esc(ex && ex.story)}</textarea>
  <label class="l">Photos (<span id="pc">0</span> of ${MAXPHOTOS})</label><label class="drop">📷 Tap to add photos<input type="file" id="pf" accept="image/*" multiple hidden></label>
  <p class="hint">First photo is the cover. Please avoid house numbers, street signs and people's faces. Location data is removed from photos.</p><div class="ph-grid" id="pg"></div>
  <p class="hint" style="margin-top:14px">By publishing you confirm this is your own reno and an honest account of your experience, and that you have the right to share the photos. Please read the <a href="terms.html" target="_blank" rel="noopener">content rules</a>.</p>
  <p class="err" id="ferr" role="alert"></p><button class="btn" id="sv" style="margin-top:14px;width:100%">${ex ? 'Save changes' : 'Publish reno'}</button></form></div>`, null, () => !dirty || confirm('Close without publishing? Your answers are saved as a draft on this device, but photos are not.'));
  const g = q => sh.querySelector(q);
  typeahead(g('#sq'), g('#sa'), s => { sub = {name: s[0], state: s[1], pc: s[2], lat: s[3], lng: s[4]}; g('#sq').value = `${s[0]}, ${s[1]} ${s[2]}`; dirty = true; saveDraft(); }, () => { sub = null; });
  g('#tc').onclick = e => { const b = e.target.closest('.chip'); if (!b) return; const t = b.dataset.t;
    if (T.has(t)) T.delete(t); else if (T.size >= 4) return toast('Up to 4 types'); else T.add(t);
    b.setAttribute('aria-pressed', T.has(t)); g('#ow').hidden = !T.has('Other'); dirty = true; saveDraft(); };
  const applyMode = () => { g('#cm').querySelectorAll('.chip').forEach(x => x.setAttribute('aria-pressed', x.dataset.m === costMode)); g('#cExact').hidden = costMode !== 'exact'; g('#cRange').hidden = costMode !== 'range'; g('#bkBlock').hidden = costMode !== 'exact'; };
  g('#cm').onclick = e => { const b = e.target.closest('.chip'); if (!b) return; costMode = b.dataset.m; applyMode(); dirty = true; saveDraft(); };
  const grow = (box, html, max, btn, focus) => { if (box.children.length >= max) return; box.insertAdjacentHTML('beforeend', html); btn.hidden = box.children.length >= max; if (focus) box.lastElementChild.querySelector('input').focus(); };
  g('#addBk').onclick = () => { grow(g('#bkRows'), bkRow(), MAXBK, g('#addBk'), true); dirty = true; };
  g('#addTr').onclick = () => { grow(g('#trRows'), trRow(), MAXTR, g('#addTr'), true); dirty = true; };
  const sumHint = () => { const t = [...sh.querySelectorAll('.ba')].reduce((a, i) => a + (parseInt(i.value, 10) || 0), 0), c = parseInt(g('#c').value, 10) || 0;
    g('#bkSum').textContent = t ? `Lines add up to ${money(t)}` + (c && c !== t ? ` (total cost is ${money(c)})` : '') : ''; };
  sh.addEventListener('input', sumHint); sumHint();
  const fields = () => [...sh.querySelectorAll('#sf input:not([type=file]):not([data-a]),#sf select,#sf textarea')];
  const saveDraft = () => { if (ex) return; try { localStorage.setItem(DRAFT, JSON.stringify({ver: 3, cm: costMode, v: fields().map(f => f.value), sub, T: [...T], nb: g('#bkRows').children.length, nt: g('#trRows').children.length})); } catch (x) {} };
  sh.addEventListener('input', () => { dirty = true; saveDraft(); });
  if (!ex) { try { const dr = JSON.parse(localStorage.getItem(DRAFT) || 'null');
    if (dr && dr.v && dr.ver === 3) { costMode = dr.cm || 'exact'; while (g('#bkRows').children.length < (dr.nb || 0) && g('#bkRows').children.length < MAXBK) grow(g('#bkRows'), bkRow(), MAXBK, g('#addBk'));
      while (g('#trRows').children.length < (dr.nt || 0) && g('#trRows').children.length < MAXTR) grow(g('#trRows'), trRow(), MAXTR, g('#addTr'));
      fields().forEach((f, i) => { if (dr.v[i] != null) f.value = dr.v[i]; }); sub = dr.sub; (dr.T || []).forEach(t => T.add(t));
      applyMode(); sh.querySelectorAll('#tc .chip').forEach(b => b.setAttribute('aria-pressed', T.has(b.dataset.t))); g('#ow').hidden = !T.has('Other'); toast('Restored your unfinished draft'); } } catch (x) {} }
  const draw = () => { g('#pc').textContent = P.length;
    g('#pg').innerHTML = P.map((p, i) => `<div class="ph ${i ? '' : 'cover-ph'}" data-i="${i}"><img src="${p.url}" alt=""><button class="rm" data-a="rm" aria-label="Remove photo">✕</button>${i ? '<button class="mc" data-a="cv">Make cover</button>' : '<button class="mc">Cover</button>'}<input data-a="cap" maxlength="100" placeholder="Caption" value="${esc(p.caption)}"></div>`).join(''); };
  g('#pg').onclick = e => { const b = e.target.closest('button'), t = e.target.closest('.ph'); if (!b || !t) return; const i = +t.dataset.i;
    if (b.dataset.a === 'rm') P.splice(i, 1); else if (b.dataset.a === 'cv') P.unshift(P.splice(i, 1)[0]); draw(); };
  g('#pg').oninput = e => { if (e.target.dataset.a === 'cap') P[+e.target.closest('.ph').dataset.i].caption = e.target.value; };
  g('#pf').onchange = async e => { const fs = [...e.target.files]; e.target.value = '';
    for (const f of fs) { if (P.length >= MAXPHOTOS) { toast(`Up to ${MAXPHOTOS} photos`); break; }
      try { P.push({...(await readImage(f)), caption: ''}); } catch (x) { toast('Could not use ' + f.name + ': ' + x.message); } }
    draw(); };
  draw();
  g('#sf').onsubmit = async e => {
    e.preventDefault(); const err = g('#ferr'), v = id => g(id).value.trim(); err.textContent = '';
    const months = parseInt(g('#mo').value, 10), cd = parseInt(g('#cd').value || '0', 10);
    let cost = null, lo = null, hi = null;
    if (costMode === 'exact') { cost = parseInt(g('#c').value, 10); if (!(cost > 0)) return err.textContent = 'Enter the total cost, or choose a range or “Prefer not to say”.'; }
    else if (costMode === 'range') { const b = BANDS[+g('#cb').value] || BANDS[3]; lo = b[0]; hi = b[1]; }
    if (v('#t').length < 3) return err.textContent = 'Add a headline.';
    if (!sub) return err.textContent = 'Pick a suburb from the list.';
    if (!T.size) return err.textContent = 'Pick at least one type of reno.';
    if (T.has('Other') && !v('#ot')) return err.textContent = 'Describe your reno (e.g. Pool).';
    if (!(months > 0)) return err.textContent = 'Enter how many months it took.';
    if (!(cd >= 0)) return err.textContent = 'Council days must be 0 or more.';
    if (v('#st').length < 3) return err.textContent = 'Add your story.';
    const labels = [...sh.querySelectorAll('.bl')], amts = [...sh.querySelectorAll('.ba')];
    const breakdown = labels.map((l, i) => ({label: l.value.trim(), amount: parseInt(amts[i].value, 10)})).filter(b => b.label && b.amount > 0);
    const tn = [...sh.querySelectorAll('.tn')], tt = [...sh.querySelectorAll('.tt')], tr2 = [...sh.querySelectorAll('.tr')];
    const tw = [...sh.querySelectorAll('.tw')], tnote = [...sh.querySelectorAll('.tnote')]; let badSite = '';
    const trades = tn.map((n, i) => { const raw = tw[i].value.trim(), u = raw ? safeUrl(raw) : '', note = tnote[i].value.trim(); if (raw && !u) badSite = n.value.trim() || 'one of your tradies';
      return {name: n.value.trim(), trade: tt[i].value.trim() || 'Trade', rating: +tr2[i].value, ...(u ? {website: u} : {}), ...(note ? {note} : {})}; }).filter(t => t.name);
    if (badSite) return err.textContent = 'The website for ' + badSite + ' doesn’t look right. Try something like www.example.com.au';
    const row = {title: v('#t'), suburb: sub.name, state: sub.state, postcode: sub.pc, lat: sub.lat, lng: sub.lng, type: TYPES.find(t => T.has(t)), types: TYPES.filter(t => T.has(t)), other_type: T.has('Other') ? v('#ot') : null,
      cost, cost_display: costMode, cost_low: lo, cost_high: hi, home_type: g('#hm').value || null, job_size: g('#js').value || null,
      months, council_days: cd, council_notes: v('#cn'), story: v('#st'), breakdown: costMode === 'exact' ? breakdown : [], trades};
    const btn = g('#sv'); btn.disabled = true; btn.textContent = 'Saving...';
    let newId;
    try { newId = await saveReno(ex, row, P, orig, n => btn.textContent = `Uploading photo ${n} of ${P.filter(p => p.blob).length}...`); }
    catch (x) { if (x.saved) loadRenos(); btn.disabled = false; btn.textContent = ex ? 'Save changes' : 'Publish reno'; return err.textContent = x.message || 'Something went wrong. Please try again.'; }
    try { localStorage.removeItem(DRAFT); } catch (x) {}
    $('#modal').innerHTML = ''; track(ex ? 'reno_updated' : 'reno_published'); toast(ex ? 'Changes saved' : 'Published. Thanks for sharing!'); await loadRenos();
    if (!ex) { resetFilters(); render(true); } if (newId) openReno(newId);
  };
}
async function saveReno(ex, row, P, orig, progress) {
  let id = ex && ex.id;
  if (ex) { const {error} = await sb.from('renos').update(row).eq('id', id); if (error) throw error; }
  else { const {data, error} = await sb.from('renos').insert(row).select('id').single(); if (error) throw error; id = data.id; }
  const keep = new Set(P.filter(p => p.id).map(p => p.id)), gone = orig.filter(o => !keep.has(o.id));
  if (gone.length) { await sb.storage.from(BUCKET).remove(gone.flatMap(p => [p.path, thumbPath(p.path)])); await sb.from('reno_photos').delete().in('id', gone.map(p => p.id)); }
  let n = 0, failed = 0;
  for (let i = 0; i < P.length; i++) {
    const p = P[i];
    if (p.id) { await sb.from('reno_photos').update({position: i, caption: p.caption || ''}).eq('id', p.id); continue; }
    progress(++n);
    const base = `${S.user.id}/${id}/${uuid()}`;
    const up = await sb.storage.from(BUCKET).upload(base + '.jpg', p.blob, {contentType: 'image/jpeg'});
    const ut = up.error ? up : await sb.storage.from(BUCKET).upload(base + '_t.jpg', p.tblob, {contentType: 'image/jpeg'});
    if (up.error || ut.error) { failed++; continue; }
    const ins = await sb.from('reno_photos').insert({reno_id: id, path: base + '.jpg', caption: p.caption || '', position: i});
    if (ins.error) failed++;
  }
  if (failed) { const e = new Error(`Your reno saved, but ${failed} photo(s) failed to upload. Open My renos, choose Edit and add them again.`); e.saved = true; throw e; }
  return id;
}

/* ---------- wiring ---------- */
function resetFilters() {
  S.F = {sub: null, q: '', types: new Set(), max: 500, sort: 'new', mine: false, home: '', size: ''};
  $('#home').value = ''; $('#size').value = '';
  $('#subQ').value = ''; $('#subClr').hidden = true; $('#q').value = ''; $('#max').value = 500;
  document.querySelectorAll('#chips .chip').forEach(b => b.setAttribute('aria-pressed', 'false'));
}
function init() {
  $('#chips').innerHTML = TYPES.map(t => `<button class="chip" aria-pressed="false" data-t="${esc(t)}">${EM[t]} ${esc(t)}</button>`).join('');
  $('#chips').onclick = e => { const b = e.target.closest('.chip'); if (!b) return; if (b.dataset.mine) { S.F.mine = !S.F.mine; b.setAttribute('aria-pressed', S.F.mine); return render(true); } const t = b.dataset.t; S.F.types.has(t) ? S.F.types.delete(t) : S.F.types.add(t); b.setAttribute('aria-pressed', S.F.types.has(t)); render(true); };
  let qt; $('#q').oninput = e => { clearTimeout(qt); qt = setTimeout(() => { S.F.q = e.target.value.trim(); render(true); }, 200); };
  $('#max').oninput = e => { S.F.max = +e.target.value; render(true); };
  $('#home').innerHTML += HOMES.map(h => `<option>${esc(h)}</option>`).join('');
  $('#size').innerHTML += Object.entries(SIZES).map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('');
  $('#home').onchange = e => { S.F.home = e.target.value; render(true); };
  $('#size').onchange = e => { S.F.size = e.target.value; render(true); };
  $('#moreBtn').onclick = () => { const open = $('#more').hidden; $('#more').hidden = !open; $('#moreBtn').setAttribute('aria-expanded', open); };
  $('#clrMore').onclick = () => { S.F.max = 500; S.F.home = ''; S.F.size = ''; $('#max').value = 500; $('#home').value = ''; $('#size').value = ''; render(true); };
  typeahead($('#subQ'), $('#subAc'), s => { S.F.sub = {name: s[0], state: s[1]}; $('#subQ').value = `${s[0]}, ${s[1]}`; $('#subClr').hidden = false; render(true); }, () => { $('#subClr').hidden = !$('#subQ').value; if (S.F.sub) { S.F.sub = null; render(true); } });
  $('#subClr').onclick = () => { S.F.sub = null; $('#subQ').value = ''; $('#subClr').hidden = true; render(true); };
  const view = m => { $('#main').classList.toggle('map', m); document.body.classList.toggle('mapview', m); $('#vList').setAttribute('aria-pressed', !m); $('#vMap').setAttribute('aria-pressed', m); if (m && map) setTimeout(() => { map.invalidateSize(); render(true); }, 50); };
  $('#vList').onclick = () => view(false); $('#vMap').onclick = () => view(true);
  $('#shareBtn').onclick = () => S.user ? formModal() : authModal('up');
  $('#meBtn').onclick = () => S.user ? profileModal() : authModal();
  $('#msgBtn').onclick = () => { if (!S.user) return authModal(); loadConvos().then(inboxModal); };
  $('#pageView').onclick = e => { if (e.target.closest('.hb') || e.target.closest('.tb')) return; if (e.target.closest('[data-act=share]')) return $('#shareBtn').click(); const r = e.target.closest('[data-reno]'); if (r) return openReno(r.dataset.reno); const c = e.target.closest('.card'); if (c) openReno(c.dataset.id); };
  $('#pageView').onchange = e => { if (e.target.id === 'bkTrade') { S.bookTrade = e.target.value; renderBook(); } };
  window.addEventListener('hashchange', route);
  document.addEventListener('click', e => { const h = e.target.closest('.hb'); if (h) { e.stopPropagation(); e.preventDefault(); toggleFav(h.dataset.fav); return; } const tb = e.target.closest('.tb'); if (tb) { e.stopPropagation(); e.preventDefault(); toggleTradie(tb.dataset.tk, tb.dataset.ri, +tb.dataset.ti); } }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.classList && e.target.classList.contains('hb')) e.target.click(); });
  $('#list').onclick = e => { if (e.target.closest('[data-act=share]')) return $('#shareBtn').click(); const c = e.target.closest('.card'); if (c) openReno(c.dataset.id); };
  $('#list').onkeydown = e => { if (e.key === 'Enter') { const c = e.target.closest('.card'); if (c && e.target === c) openReno(c.dataset.id); } };
  $('#list').onmouseover = e => { const c = e.target.closest('.card'); if (c) setSel(c.dataset.id); };
  render(true); initMap();
  if (!configured) { S.authReady = true; return; }
  loadRenos();
  sb.auth.onAuthStateChange((ev, session) => { S.user = session ? session.user : null; if (!S.user) S.profile = null; setTimeout(loadMine, 0); if (ev === 'PASSWORD_RECOVERY') setTimeout(newPasswordModal, 0); });
  const hash = location.hash, errM = hash.match(/error_description=([^&]+)/), isRecovery = /type=recovery/.test(hash), fromEmail = /access_token=|type=signup|type=magiclink/.test(hash) && !isRecovery;
  if (errM) { const em = decodeURIComponent(errM[1].replace(/\+/g, ' ')); toast(em); history.replaceState(null, '', location.pathname); if (/expired|invalid/i.test(em)) resetRequestModal(); }
  sb.auth.getSession().then(({data}) => {
    if (data.session && !S.user) { S.user = data.session.user; loadMine(); }
    S.authReady = true; route();
    if (isRecovery && data.session) { history.replaceState(null, '', location.pathname); newPasswordModal(); }
    if (fromEmail && data.session) { toast('Email confirmed. Welcome to Renomates!'); history.replaceState(null, '', location.pathname); }
  });
  subscribeMessages();
}
document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
})();

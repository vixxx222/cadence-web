/* UI + session state machine + local persistence. */

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

const store = {
  loadSettings() {
    const defaults = { preRollSec: 180, volume: 0.5, durationMin: 50, variants: {} };
    let s;
    try { s = { ...defaults, ...JSON.parse(localStorage.getItem('soundlab.settings') || '{}') }; }
    catch (e) { s = { ...defaults }; }
    // drop any variant ids that no longer exist, then fill gaps with defaults
    s.variants = s.variants || {};
    for (const [key, preset] of Object.entries(PRESETS)) {
      if (!preset.variants[s.variants[key]]) s.variants[key] = preset.defaultVariant;
    }
    return s;
  },
  saveSettings(s) { localStorage.setItem('soundlab.settings', JSON.stringify(s)); },
  loadSessions() {
    try { return JSON.parse(localStorage.getItem('soundlab.sessions') || '[]'); }
    catch (e) { return []; }
  },
  saveSessions(list) { localStorage.setItem('soundlab.sessions', JSON.stringify(list)); },
  loadRecipes() {
    try { return JSON.parse(localStorage.getItem('soundlab.recipes') || '[]'); }
    catch (e) { return []; }
  },
  saveRecipes(list) { localStorage.setItem('soundlab.recipes', JSON.stringify(list)); },
};

/* Saved lab recipes promoted to a daily state appear as variants of that
 * state — the settings picker and session log treat them like built-ins.
 * Must run before loadSettings(), which validates variant ids. */
function mergeCustomRecipes() {
  for (const r of store.loadRecipes()) {
    for (const st of r.states || []) {
      if (PRESETS[st]) PRESETS[st].variants[r.id] = { label: `${r.name} · lab`, layers: r.layers };
    }
  }
}
mergeCustomRecipes();

const settings = store.loadSettings();

const app = {
  session: null,   // { preset, variant, plannedMin, preRollSec, startTs, workStartTs, phase }
  tickHandle: null,
  wakeLock: null,

  show(screen) {
    $$('.screen').forEach(el => el.classList.remove('active'));
    $(`#screen-${screen}`).classList.add('active');
  },

  // ------------------------------------------------------------- session

  async start(presetKey, override, opts = {}) {
    // override ({label, recipe}) lets the lab hand any mix to the normal
    // session flow — logged with preset 'lab' and the recipe name as variant
    const preset = PRESETS[presetKey];
    if (!preset && !override) return;
    const variantId = override ? override.label : (settings.variants[presetKey] || preset.defaultVariant);
    const recipe = override ? override.recipe : preset.variants[variantId];
    if (!recipe) return;
    const displayName = override ? override.label : preset.name;
    // following a focus block: no settle-in and no countdown of our own;
    // the focus timer decides when this ends
    const follow = !!opts.follow;
    const preRollSec = follow ? 0 : settings.preRollSec;
    const now = Date.now();

    this.session = {
      preset: presetKey,
      variant: variantId,
      displayName,
      follow,
      plannedMin: follow ? 0 : settings.durationMin,
      preRollSec,
      startTs: now,
      workStartTs: now + preRollSec * 1000,
      phase: preRollSec > 0 ? 'preroll' : 'work',
    };

    $('#session-preset').textContent = displayName.toLowerCase();
    $('#aim-input').value = '';
    $('#aim-wrap').classList.remove('hidden');
    $('#aim-display').classList.add('hidden');
    $('#vol-slider').value = Math.round(settings.volume * 100);

    this.show('session');
    engine.setVolume(settings.volume);
    await engine.start(recipe, preRollSec > 0 ? Math.min(preRollSec, 20) : 8);

    this.requestWakeLock();
    this.tickHandle = setInterval(() => this.tick(), 250);
    this.tick();
  },

  tick() {
    const s = this.session;
    if (!s) return;
    const now = Date.now();

    if (s.phase === 'preroll') {
      if (now >= s.workStartTs) {
        this.enterWork();
      } else {
        const left = Math.ceil((s.workStartTs - now) / 1000);
        $('#session-phase').textContent = `settling in — work begins in ${fmt(left)}`;
        $('#session-clock').textContent = fmt(left);
        return;
      }
    }

    const elapsed = Math.max(0, Math.floor((now - s.workStartTs) / 1000));
    if (s.follow) {
      $('#session-clock').textContent = fmt(elapsed);
      $('#session-phase').textContent = `${s.displayName.toLowerCase()} — ${s.held ? 'paused with focus' : 'following your focus timer'}`;
    } else if (s.plannedMin > 0) {
      const left = s.plannedMin * 60 - elapsed;
      if (left <= 0) { this.end(true); return; }
      $('#session-clock').textContent = fmt(left);
      $('#session-phase').textContent = s.displayName.toLowerCase();
    } else {
      $('#session-clock').textContent = fmt(elapsed);
      $('#session-phase').textContent = `${s.displayName.toLowerCase()} — open-ended`;
    }
  },

  enterWork() {
    const s = this.session;
    s.phase = 'work';
    s.aim = $('#aim-input').value.trim();
    $('#aim-wrap').classList.add('hidden');
    if (s.aim) {
      $('#aim-display').textContent = s.aim;
      $('#aim-display').classList.remove('hidden');
    }
    engine.chime();
  },

  async end(auto = false, fadeSec = 2) {
    const s = this.session;
    if (!s) return;
    clearInterval(this.tickHandle);
    this.session = null;
    this.releaseWakeLock();

    if (s.phase === 'preroll') s.aim = $('#aim-input').value.trim();
    const actualMin = Math.max(0, Math.round((Date.now() - s.workStartTs) / 60000));

    // record immediately with rating null; the rating screen updates it,
    // so a closed tab can't lose the session itself
    const sessions = store.loadSessions();
    sessions.push({
      id: `${s.startTs}`,
      ts: new Date(s.startTs).toISOString(),
      preset: s.preset,
      variant: s.variant,
      aim: s.aim || '',
      plannedMin: s.plannedMin,
      actualMin,
      completed: auto,
      rating: null,
      note: '',
      ...(s.follow ? { follow: true } : {}),
    });
    store.saveSessions(sessions);

    if (!s.follow) engine.chime();   // the focus pane owns block-end sounds
    engine.stop(fadeSec);

    // one timer to manage: a followed session never asks for a rating
    if (actualMin < 1 || s.follow) { this.show('home'); return; } // bailed during settle-in
    this.rating = 0;
    $$('#rating-dots button').forEach(b => b.classList.remove('on'));
    $('#rating-note').value = '';
    $('#btn-save-rating').disabled = true;
    this.show('rating');
  },

  saveRating() {
    const sessions = store.loadSessions();
    const last = sessions[sessions.length - 1];
    if (last) {
      last.rating = this.rating;
      last.note = $('#rating-note').value.trim();
      store.saveSessions(sessions);
    }
    this.show('home');
  },

  // ------------------------------------------------------------- history

  renderHistory() {
    const sessions = store.loadSessions().slice().reverse();
    const stats = $('#history-stats');
    const byPreset = {};
    let rated = 0, ratingSum = 0;
    for (const s of store.loadSessions()) {
      byPreset[s.preset] = byPreset[s.preset] || { n: 0, sum: 0, rated: 0 };
      byPreset[s.preset].n++;
      if (s.rating) { byPreset[s.preset].sum += s.rating; byPreset[s.preset].rated++; ratingSum += s.rating; rated++; }
    }
    const cards = [`<div class="stat-card">sessions<b>${store.loadSessions().length}</b></div>`,
      `<div class="stat-card">avg rating<b>${rated ? (ratingSum / rated).toFixed(1) : '—'}</b></div>`];
    for (const [key, v] of Object.entries(byPreset)) {
      cards.push(`<div class="stat-card">${(PRESETS[key]?.name || 'lab').toLowerCase()}<b>${v.rated ? (v.sum / v.rated).toFixed(1) : '—'} <span style="font-weight:400;color:var(--muted)">× ${v.n}</span></b></div>`);
    }
    stats.innerHTML = cards.join('');

    $('#history-list').innerHTML = sessions.slice(0, 30).map(s => {
      const d = new Date(s.ts);
      const when = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      return `<li>
        <span class="hist-main">
          <span>${s.preset === 'lab' ? `lab · ${escapeHtml(s.variant)}` : (PRESETS[s.preset]?.name || s.preset)} · ${s.actualMin}m${s.completed ? '' : ' (ended early)'}</span>
          ${s.aim ? `<span class="hist-aim">${escapeHtml(s.aim)}</span>` : ''}
        </span>
        <span class="hist-meta">${when}<br><span class="hist-rating">${s.rating ? '●'.repeat(s.rating) : 'unrated'}</span></span>
      </li>`;
    }).join('') || '<li><span class="hist-main">no sessions yet</span></li>';
  },

  // ------------------------------------------------------------ wake lock

  async requestWakeLock() {
    try { this.wakeLock = await navigator.wakeLock?.request('screen'); } catch (e) {}
  },
  releaseWakeLock() {
    try { this.wakeLock?.release(); } catch (e) {}
    this.wakeLock = null;
  },
};

/* Stable status contract for host shells.
 *
 * soundlab is embedded as a same-origin iframe pane inside Limitless
 * (/cadence-web/limitless/), which shows a "now playing" chip. The host reads
 * THIS function rather than scraping soundlab's DOM, so internal markup can
 * change freely without breaking the shell. Keep the returned shape
 * backwards-compatible; bump `version` if it ever must change.
 */
window.soundlabStatus = function () {
  try {
    const s = app.session;
    if (s) {
      return { playing: true, mode: 'session', label: s.displayName || '', phase: s.held ? 'held' : s.phase,
               follow: !!s.follow, audible: engine.audible };
    }
    if (typeof lab !== 'undefined' && lab.playing) {
      return { playing: true, mode: 'lab', label: lab.recipe.name || 'lab preview', phase: 'preview' };
    }
    const on = !!(typeof engine !== 'undefined' && engine.playing);
    return { playing: on, mode: on ? 'other' : null, label: '', phase: null };
  } catch (e) {
    return { playing: false, mode: null, label: '', phase: null };
  }
};
window.soundlabStatus.version = 1;

/* Follow contract for host shells (Limitless): the shell watches the focus
 * timer and drives sound from it, so there is one timer to manage.
 *   start(presetKey)  begin an open-ended session (no pre-roll, no rating);
 *                     if something is already playing, adopt it instead
 *   pause() / resume() fade out/in, keeping the graph
 *   stop()            fade out and end, only if the session is a followed one
 *   wake()            resume the AudioContext (call inside a user gesture)
 */
window.soundlabFollow = {
  version: 1,
  start(presetKey) {
    if (app.session) { app.session.follow = true; app.session.plannedMin = 0; this.resume(); return true; }
    if (typeof lab !== 'undefined' && lab.playing) return false;   // mid-lab: leave it alone
    if (!PRESETS[presetKey]) presetKey = 'focus';
    app.start(presetKey, null, { follow: true });
    return true;
  },
  pause() {
    const s = app.session;
    if (!s || !s.follow || s.held) return;
    s.held = true; engine.hold(1.5); app.tick();
  },
  resume() {
    const s = app.session;
    if (!s || !s.follow) return;
    s.held = false; engine.release(3); app.tick();
  },
  stop() {
    const s = app.session;
    if (!s || !s.follow) return;
    app.end(true, 4);
  },
  wake() { return engine.wake(); },
};

function fmt(totalSec) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ------------------------------------------------------------------ wiring

$$('.tile').forEach(t => t.addEventListener('click', () => app.start(t.dataset.preset)));

$('#duration-seg').addEventListener('click', e => {
  const btn = e.target.closest('button');
  if (!btn) return;
  $$('#duration-seg button').forEach(b => b.classList.toggle('on', b === btn));
  settings.durationMin = Number(btn.dataset.min);
  store.saveSettings(settings);
});

$('#preroll-seg').addEventListener('click', e => {
  const btn = e.target.closest('button');
  if (!btn) return;
  $$('#preroll-seg button').forEach(b => b.classList.toggle('on', b === btn));
  settings.preRollSec = Number(btn.dataset.sec);
  store.saveSettings(settings);
});

$('#vol-slider').addEventListener('input', e => {
  settings.volume = Number(e.target.value) / 100;
  store.saveSettings(settings);
  engine.setVolume(settings.volume);
});

$('#btn-end').addEventListener('click', () => app.end(false));

$('#rating-dots').addEventListener('click', e => {
  const btn = e.target.closest('button');
  if (!btn) return;
  app.rating = Number(btn.dataset.r);
  $$('#rating-dots button').forEach(b => b.classList.toggle('on', b === btn));
  $('#btn-save-rating').disabled = false;
});
$('#btn-save-rating').addEventListener('click', () => app.saveRating());

$('#nav-history').addEventListener('click', () => { app.renderHistory(); app.show('history'); });
$('#nav-settings').addEventListener('click', () => app.show('settings'));
$$('[data-back]').forEach(b => b.addEventListener('click', () => app.show('home')));

$('#btn-wipe').addEventListener('click', () => {
  if (confirm('Erase all logged sessions on this device?')) {
    localStorage.removeItem('soundlab.sessions');
    alert('Erased.');
  }
});

// engine picker — built from PRESETS so it can never drift out of sync
function renderEnginePicker() {
  $('#engine-picker').innerHTML = Object.entries(PRESETS).map(([key, preset]) => `
    <div class="engine-group">
      <span>${preset.name}</span>
      <div class="engine-opts" data-preset="${key}">
        ${Object.entries(preset.variants).map(([vid, v]) =>
          `<button data-variant="${vid}" class="${settings.variants[key] === vid ? 'on' : ''}">${v.label}</button>`
        ).join('')}
      </div>
    </div>`).join('');
}

function syncTileDescriptions() {
  for (const [key, preset] of Object.entries(PRESETS)) {
    const tile = $(`.tile[data-preset="${key}"] .tile-desc`);
    if (tile) tile.textContent = preset.variants[settings.variants[key]].label;
  }
}

$('#engine-picker').addEventListener('click', e => {
  const btn = e.target.closest('button[data-variant]');
  if (!btn) return;
  const presetKey = btn.closest('.engine-opts').dataset.preset;
  settings.variants[presetKey] = btn.dataset.variant;
  store.saveSettings(settings);
  renderEnginePicker();
  syncTileDescriptions();
});

// restore persisted choices
$$('#duration-seg button').forEach(b => b.classList.toggle('on', Number(b.dataset.min) === settings.durationMin));
$$('#preroll-seg button').forEach(b => b.classList.toggle('on', Number(b.dataset.sec) === settings.preRollSec));
renderEnginePicker();
syncTileDescriptions();

// deep-link: soundlab/#focus pulses that tile so open-day / Cadence links
// land one tap from sound (browsers require a gesture before audio starts)
const hash = location.hash.replace('#', '');
if (PRESETS[hash]) {
  const tile = $(`.tile[data-preset="${hash}"]`);
  tile.style.borderColor = 'var(--accent)';
  tile.style.boxShadow = '0 0 0 1px var(--accent)';
}

// keep the timer honest after background-tab throttling, and bring the
// audio back if the system suspended it while we were away
document.addEventListener('visibilitychange', () => { if (app.session) { app.tick(); engine.wake(); } });
// any tap here is a user gesture: use it to revive a suspended context
for (const ev of ['pointerdown', 'keydown', 'touchend']) {
  document.addEventListener(ev, () => { if (engine.playing && !engine.audible) engine.wake(); }, true);
}

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

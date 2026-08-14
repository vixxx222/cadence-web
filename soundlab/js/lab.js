/* Lab mode: a live mixer over the same engine the daily presets use.
 * Continuous params update the running graph in place; structural params
 * (voice counts, chords, chorus) crossfade-rebuild it. Touching any control
 * surfaces the matching evidence entry in the insight panel.
 */

const lab = {
  recipe: { name: '', layers: [] },
  playing: false,
  _rebuildTimer: null,

  // ------------------------------------------------------------ param defs

  // path: dot-path into the layer object; log sliders map [0,1000] → exp range
  DEFS: {
    noise: {
      label: 'pink noise',
      badge: 'strong',
      make: () => ({ type: 'noise', level: 0.5, am: { rate: 16, depth: 0 } }),
      params: [
        { path: 'level', label: 'level', min: 0, max: 1, step: 0.01, topic: 'level' },
        { path: 'am.rate', label: 'modulation rate', min: 0.05, max: 45, log: true, unit: 'Hz', topic: 'am.rate', band: true },
        { path: 'am.depth', label: 'modulation depth', min: 0, max: 1, step: 0.01, topic: 'am.depth' },
      ],
    },
    binaural: {
      label: 'binaural beat',
      badge: 'weak',
      make: () => ({ type: 'binaural', carrier: 340, beat: 16, level: 0.08 }),
      params: [
        { path: 'level', label: 'level', min: 0, max: 0.4, step: 0.005, topic: 'level' },
        { path: 'carrier', label: 'carrier', min: 100, max: 500, step: 1, unit: 'Hz', topic: 'beat.carrier' },
        { path: 'beat', label: 'beat frequency', min: 0.5, max: 45, log: true, unit: 'Hz', topic: 'beat.freq', band: true },
      ],
    },
    monaural: {
      label: 'monaural beat',
      badge: 'promising',
      make: () => ({ type: 'monaural', carrier: 250, beat: 6, level: 0.08 }),
      params: [
        { path: 'level', label: 'level', min: 0, max: 0.4, step: 0.005, topic: 'level' },
        { path: 'carrier', label: 'carrier', min: 100, max: 500, step: 1, unit: 'Hz', topic: 'beat.carrier' },
        { path: 'beat', label: 'beat frequency', min: 0.5, max: 45, log: true, unit: 'Hz', topic: 'beat.freq', band: true },
      ],
    },
    isochronic: {
      label: 'isochronic tone',
      badge: 'promising',
      make: () => ({ type: 'isochronic', freq: 340, rate: 16, depth: 1, level: 0.07 }),
      params: [
        { path: 'level', label: 'level', min: 0, max: 0.4, step: 0.005, topic: 'level' },
        { path: 'freq', label: 'tone', min: 100, max: 800, log: true, unit: 'Hz', topic: 'beat.carrier' },
        { path: 'rate', label: 'pulse rate', min: 1, max: 45, log: true, unit: 'Hz', topic: 'am.rate', band: true },
        { path: 'depth', label: 'gate depth', min: 0.3, max: 1, step: 0.01, topic: 'am.depth' },
      ],
    },
    tone: {
      label: 'pure tone',
      badge: 'none',
      make: () => ({ type: 'tone', freq: 432, level: 0.08, chorus: 0 }),
      params: [
        { path: 'level', label: 'level', min: 0, max: 0.4, step: 0.005, topic: 'level' },
        { path: 'freq', label: 'frequency', min: 60, max: 1200, log: true, unit: 'Hz', topic: 'tone.freq' },
        { path: 'chorus', label: 'chorus detune', min: 0, max: 8, step: 1, unit: '¢', topic: 'tone.chorus', structural: true },
      ],
    },
    pad: {
      label: 'harmonic pad',
      badge: 'mixed',
      make: () => ({ type: 'pad', notes: [110, 165], level: 0.45, am: { rate: 0.15, depth: 0.2 } }),
      params: [
        { path: 'level', label: 'level', min: 0, max: 1, step: 0.01, topic: 'level' },
        {
          path: 'notes', label: 'chord', topic: 'pad.chord', structural: true, select: [
            { label: 'open fifth', value: [110, 165] },
            { label: 'calm', value: [110, 164.81, 246.94] },
            { label: 'minor', value: [110, 130.81, 196] },
          ],
        },
        { path: 'am.rate', label: 'swell rate', min: 0.05, max: 2, log: true, unit: 'Hz', topic: 'am.rate' },
        { path: 'am.depth', label: 'swell depth', min: 0, max: 0.6, step: 0.01, topic: 'am.depth' },
      ],
    },
    murmur: {
      label: 'crowd murmur',
      badge: 'promising',
      make: () => ({ type: 'murmur', voices: 6, level: 1.0 }),
      params: [
        { path: 'level', label: 'level', min: 0, max: 1.5, step: 0.01, topic: 'level' },
        { path: 'voices', label: 'crowd size', min: 2, max: 14, step: 1, topic: 'murmur.voices', structural: true },
      ],
    },
  },

  // Prebuilt lab recipes: the shelf (honest labels) + overlay group.
  SHELF: [
    {
      group: 'the shelf', groupTopic: null, items: [
        {
          name: 'isochronic focus', badge: 'promising',
          desc: '16 Hz gated tone over a noise floor — the strongest steady-state driver, masked for comfort',
          layers: [
            { type: 'isochronic', freq: 340, rate: 16, depth: 0.9, level: 0.06 },
            { type: 'noise', level: 0.45, am: { rate: 16, depth: 0 } },
          ],
        },
        {
          name: 'monaural theta calm', badge: 'promising',
          desc: 'physically-present 6 Hz beat in a warm pad — speaker-friendly wind-down',
          layers: [
            { type: 'monaural', carrier: 250, beat: 6, level: 0.09 },
            { type: 'pad', notes: [110, 164.81, 246.94], level: 0.4, am: { rate: 0.15, depth: 0.2 } },
          ],
        },
        {
          name: 'classic binaural beta', badge: 'weak',
          desc: 'the bare stimulus the meta-analyses actually tested — nothing masking it',
          layers: [
            { type: 'binaural', carrier: 340, beat: 18, level: 0.12 },
          ],
        },
        {
          name: '40 Hz gamma', badge: 'experimental',
          desc: 'strong physiology, zero proven benefit in healthy adults; some find it aversive',
          layers: [
            { type: 'isochronic', freq: 240, rate: 40, depth: 0.85, level: 0.06 },
            { type: 'noise', level: 0.35, am: { rate: 16, depth: 0 } },
          ],
        },
      ],
    },
    {
      group: 'under your music', groupTopic: 'overlay', items: [
        {
          name: 'overlay · masked pulse', badge: 'promising',
          desc: 'quiet 16 Hz-modulated noise to sit beneath a stream from another app',
          overlay: true,
          layers: [
            { type: 'noise', level: 0.3, am: { rate: 16, depth: 0.5 } },
          ],
        },
        {
          name: 'overlay · beta beat', badge: 'weak',
          desc: 'low binaural beta only — adds a beat to any instrumental playlist',
          overlay: true,
          layers: [
            { type: 'binaural', carrier: 340, beat: 16, level: 0.06 },
          ],
        },
        {
          name: 'overlay · noise floor', badge: 'strong',
          desc: 'plain pink bed under music — evens out a distracting room',
          overlay: true,
          layers: [
            { type: 'noise', level: 0.35, am: { rate: 16, depth: 0 } },
          ],
        },
      ],
    },
  ],

  // -------------------------------------------------------------- helpers

  getPath(obj, path) {
    return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
  },

  /* Recipes from presets/storage may omit optional params (a tone without
   * chorus, a noise bed without am). Fill gaps from the type's defaults so
   * every control renders; unknown types are dropped. */
  normalize(layers) {
    return layers.filter(l => this.DEFS[l.type]).map(l => {
      const base = this.DEFS[l.type].make();
      const merged = { ...base, ...JSON.parse(JSON.stringify(l)) };
      for (const p of this.DEFS[l.type].params) {
        if (this.getPath(merged, p.path) == null) {
          this.setPath(merged, p.path, this.getPath(base, p.path));
        }
      }
      return merged;
    });
  },
  setPath(obj, path, value) {
    const keys = path.split('.');
    const last = keys.pop();
    let o = obj;
    for (const k of keys) o = o[k] = o[k] || {};
    o[last] = value;
  },

  sliderToValue(def, t) { // t in [0,1000]
    if (def.log) return def.min * Math.exp((t / 1000) * Math.log(def.max / def.min));
    return def.min + (t / 1000) * (def.max - def.min);
  },
  valueToSlider(def, v) {
    if (def.log) return Math.round(1000 * Math.log(v / def.min) / Math.log(def.max / def.min));
    return Math.round(1000 * (v - def.min) / (def.max - def.min));
  },
  fmtValue(def, v) {
    const num = v >= 100 ? Math.round(v) : v >= 10 ? v.toFixed(1) : v >= 1 ? v.toFixed(2) : v.toFixed(3);
    return def.unit ? `${num} ${def.unit}` : `${num}`;
  },
  bandName(hz) {
    if (hz < 0.5) return 'swell';
    if (hz < 4) return 'delta';
    if (hz < 8) return 'theta';
    if (hz < 13) return 'alpha';
    if (hz < 30) return 'beta';
    return 'gamma';
  },

  activeLayers() { return this.recipe.layers.filter(l => !l.muted); },

  // ------------------------------------------------------------ rendering

  render() {
    this.renderLayers();
    this.renderRecipes();
    this.renderShelf();
    this.syncTransport();
  },

  renderLayers() {
    const host = $('#lab-layers');
    if (!this.recipe.layers.length) {
      host.innerHTML = '<p class="fine lab-empty">no layers — add one below, or load a recipe from the shelf</p>';
      return;
    }
    host.innerHTML = this.recipe.layers.map((layer, i) => {
      const def = this.DEFS[layer.type];
      return `<div class="lab-layer ${layer.muted ? 'muted' : ''}" data-i="${i}">
        <div class="lab-layer-head" data-topic="type:${layer.type}">
          <span class="lab-layer-name">${def.label}</span>
          <span class="badge badge-${def.badge}">${GRADE_LABELS[def.badge]}</span>
          <span class="lab-layer-tools">
            <button class="lab-mute" title="mute">${layer.muted ? 'unmute' : 'mute'}</button>
            <button class="lab-remove" title="remove">×</button>
          </span>
        </div>
        <div class="lab-params">${def.params.map(p => this.renderParam(layer, i, p)).join('')}</div>
      </div>`;
    }).join('');
  },

  renderParam(layer, i, p) {
    const v = this.getPath(layer, p.path);
    if (p.select) {
      return `<div class="lab-param" data-topic="${p.topic}">
        <span class="lab-param-label">${p.label}</span>
        <span class="seg seg-small">${p.select.map(opt =>
          `<button data-i="${i}" data-path="${p.path}" data-select='${JSON.stringify(opt.value)}'
            class="${JSON.stringify(v) === JSON.stringify(opt.value) ? 'on' : ''}">${opt.label}</button>`).join('')}
        </span>
      </div>`;
    }
    const band = p.band ? ` <em class="band">${this.bandName(v)}</em>` : '';
    return `<div class="lab-param" data-topic="${p.topic}">
      <span class="lab-param-label">${p.label}</span>
      <input type="range" min="0" max="1000" value="${this.valueToSlider(p, v)}"
        data-i="${i}" data-path="${p.path}" ${p.structural ? 'data-structural="1"' : ''}>
      <span class="lab-param-value">${this.fmtValue(p, v)}${band}</span>
    </div>`;
  },

  renderRecipes() {
    const recipes = store.loadRecipes();
    $('#lab-recipes-list').innerHTML = recipes.length ? recipes.map(r => `
      <div class="lab-recipe" data-id="${r.id}">
        <span class="lab-recipe-name">${escapeHtml(r.name)}</span>
        <span class="lab-recipe-tools">
          <button data-act="load">load</button>
          ${['focus', 'think', 'relax', 'meditate'].map(st =>
            `<button data-act="promote" data-state="${st}" class="${(r.states || []).includes(st) ? 'on' : ''}"
              title="use for ${st}">${st[0].toUpperCase()}</button>`).join('')}
          <button data-act="delete" class="danger-btn">×</button>
        </span>
      </div>`).join('')
      : '<p class="fine">nothing saved yet — mix something and name it</p>';
  },

  renderShelf() {
    $('#lab-shelf').innerHTML = this.SHELF.map(group => `
      <div class="lab-shelf-group" ${group.groupTopic ? `data-topic="${group.groupTopic}"` : ''}>
        <span class="row-label">${group.group}</span>
        ${group.items.map((item, j) => `
          <div class="lab-shelf-item" data-group="${escapeHtml(group.group)}" data-j="${j}">
            <div class="lab-shelf-text">
              <span>${item.name} <span class="badge badge-${item.badge}">${GRADE_LABELS[item.badge]}</span></span>
              <span class="fine">${item.desc}</span>
            </div>
            <button class="lab-shelf-load">load</button>
          </div>`).join('')}
      </div>`).join('');
  },

  syncTransport() {
    $('#lab-play').classList.toggle('playing', this.playing);
    $('#lab-play-label').textContent = this.playing ? 'stop' : 'listen';
    $('#lab-session-btn').disabled = !this.activeLayers().length;
  },

  showInsight(topic, value) {
    const entry = insightFor(topic, value);
    if (!entry) return;
    const panel = $('#lab-insight');
    panel.innerHTML = `
      <div class="insight-head">
        <span class="insight-title">${entry.title}</span>
        <span class="badge badge-${entry.grade}">${GRADE_LABELS[entry.grade]}</span>
      </div>
      <p class="insight-body">${entry.body}</p>
      ${entry.sources.length ? `<p class="insight-sources">${entry.sources.map(s =>
        `<a href="${s.url}" target="_blank" rel="noopener">${s.label}</a>`).join(' · ')}</p>` : ''}`;
    panel.classList.add('visible');
  },

  // --------------------------------------------------------------- audio

  async togglePlay() {
    if (this.playing) {
      this.playing = false;
      this.syncTransport();
      await engine.stop(1);
    } else if (this.activeLayers().length) {
      this.playing = true;
      this.syncTransport();
      engine.setVolume(settings.volume);
      await engine.start({ layers: this.activeLayers() }, 2);
    }
  },

  /* Continuous param → live setter; structural → debounced crossfade. */
  onParamChange(i, path, value, structural) {
    this.setPath(this.recipe.layers[i], path, value);
    if (!this.playing) return;
    const activeIndex = this.activeLayers().indexOf(this.recipe.layers[i]);
    if (structural || activeIndex < 0 || !engine.updateLayer(activeIndex, path, value)) {
      clearTimeout(this._rebuildTimer);
      this._rebuildTimer = setTimeout(() => engine.restart({ layers: this.activeLayers() }), 350);
    }
  },

  rebuildIfPlaying() {
    if (this.playing) engine.restart({ layers: this.activeLayers() });
  },

  async stopPreview() {
    if (this.playing) {
      this.playing = false;
      this.syncTransport();
      await engine.stop(0.5);
    }
  },
};

// ------------------------------------------------------------------ wiring

$('#lab-play').addEventListener('click', () => lab.togglePlay());

$('#lab-vol').addEventListener('input', e => {
  settings.volume = Number(e.target.value) / 100;
  store.saveSettings(settings);
  engine.setVolume(settings.volume);
});

// layer param sliders (input = live; also surface the insight)
$('#lab-layers').addEventListener('input', e => {
  const s = e.target;
  if (s.tagName !== 'INPUT') return;
  const i = Number(s.dataset.i);
  const layer = lab.recipe.layers[i];
  const def = lab.DEFS[layer.type].params.find(p => p.path === s.dataset.path);
  const v = def.step ? Math.round(lab.sliderToValue(def, Number(s.value)) / def.step) * def.step : lab.sliderToValue(def, Number(s.value));
  const valEl = s.parentElement.querySelector('.lab-param-value');
  valEl.innerHTML = lab.fmtValue(def, v) + (def.band ? ` <em class="band">${lab.bandName(v)}</em>` : '');
  lab.onParamChange(i, def.path, v, !!def.structural);
  lab.showInsight(def.topic, v);
});

// chord selects, mute, remove, head-tap insights
$('#lab-layers').addEventListener('click', e => {
  const sel = e.target.closest('button[data-select]');
  if (sel) {
    const i = Number(sel.dataset.i);
    lab.setPath(lab.recipe.layers[i], sel.dataset.path, JSON.parse(sel.dataset.select));
    lab.renderLayers();
    lab.rebuildIfPlaying();
    return;
  }
  const card = e.target.closest('.lab-layer');
  if (!card) return;
  const i = Number(card.dataset.i);
  if (e.target.closest('.lab-remove')) {
    lab.recipe.layers.splice(i, 1);
    lab.renderLayers(); lab.syncTransport(); lab.rebuildIfPlaying();
  } else if (e.target.closest('.lab-mute')) {
    lab.recipe.layers[i].muted = !lab.recipe.layers[i].muted;
    lab.renderLayers(); lab.syncTransport(); lab.rebuildIfPlaying();
  } else {
    const head = e.target.closest('[data-topic]');
    if (head) lab.showInsight(head.dataset.topic);
  }
});

// add-layer chooser
$('#lab-add-toggle').addEventListener('click', () => {
  const host = $('#lab-add-chooser');
  if (host.classList.contains('hidden')) {
    host.innerHTML = Object.entries(lab.DEFS).map(([type, def]) =>
      `<button data-type="${type}">${def.label}
        <span class="badge badge-${def.badge}">${GRADE_LABELS[def.badge]}</span></button>`).join('');
    host.classList.remove('hidden');
  } else {
    host.classList.add('hidden');
  }
});
$('#lab-add-chooser').addEventListener('click', e => {
  const btn = e.target.closest('button[data-type]');
  if (!btn) return;
  lab.recipe.layers.push(lab.DEFS[btn.dataset.type].make());
  $('#lab-add-chooser').classList.add('hidden');
  lab.renderLayers(); lab.syncTransport(); lab.rebuildIfPlaying();
  lab.showInsight('type:' + btn.dataset.type);
});

// recipes: save / load / promote / delete
$('#lab-save').addEventListener('click', () => {
  const name = $('#lab-recipe-name').value.trim();
  if (!name || !lab.recipe.layers.length) return;
  const recipes = store.loadRecipes();
  const id = 'custom-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const existing = recipes.find(r => r.id === id);
  const entry = { id, name, layers: JSON.parse(JSON.stringify(lab.recipe.layers)), states: existing ? existing.states : [] };
  if (existing) Object.assign(existing, entry); else recipes.push(entry);
  store.saveRecipes(recipes);
  mergeCustomRecipes();
  lab.renderRecipes();
});

$('#lab-recipes-list').addEventListener('click', e => {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const id = btn.closest('.lab-recipe').dataset.id;
  const recipes = store.loadRecipes();
  const r = recipes.find(x => x.id === id);
  if (!r) return;
  if (btn.dataset.act === 'load') {
    lab.recipe = { name: r.name, layers: lab.normalize(r.layers) };
    $('#lab-recipe-name').value = r.name;
    lab.renderLayers(); lab.syncTransport(); lab.rebuildIfPlaying();
  } else if (btn.dataset.act === 'promote') {
    const st = btn.dataset.state;
    r.states = r.states || [];
    if (r.states.includes(st)) {
      r.states = r.states.filter(x => x !== st);
      if (settings.variants[st] === id) settings.variants[st] = PRESETS[st].defaultVariant;
      delete PRESETS[st].variants[id];
    } else {
      r.states.push(st);
      settings.variants[st] = id; // promoted = active
    }
    store.saveRecipes(recipes);
    store.saveSettings(settings);
    mergeCustomRecipes();
    renderEnginePicker();
    syncTileDescriptions();
    lab.renderRecipes();
  } else if (btn.dataset.act === 'delete') {
    if (!confirm(`Delete recipe "${r.name}"?`)) return;
    for (const st of r.states || []) {
      if (settings.variants[st] === id) settings.variants[st] = PRESETS[st].defaultVariant;
      delete PRESETS[st].variants[id];
    }
    store.saveRecipes(recipes.filter(x => x.id !== id));
    store.saveSettings(settings);
    renderEnginePicker();
    syncTileDescriptions();
    lab.renderRecipes();
  }
});

// shelf
$('#lab-shelf').addEventListener('click', e => {
  const item = e.target.closest('.lab-shelf-item');
  if (!item) return;
  const group = lab.SHELF.find(g => g.group === item.dataset.group);
  const shelfItem = group.items[Number(item.dataset.j)];
  if (e.target.closest('.lab-shelf-load')) {
    lab.recipe = { name: shelfItem.name, layers: lab.normalize(shelfItem.layers) };
    $('#lab-recipe-name').value = shelfItem.name;
    lab.renderLayers(); lab.syncTransport(); lab.rebuildIfPlaying();
    if (shelfItem.overlay) lab.showInsight('overlay');
  } else if (group.groupTopic) {
    lab.showInsight(group.groupTopic);
  }
});

// hand the current mix to the normal session flow (pre-roll, timer, rating)
$('#lab-session-btn').addEventListener('click', async () => {
  if (!lab.activeLayers().length) return;
  await lab.stopPreview();
  app.start('lab', {
    label: lab.recipe.name || 'lab sketch',
    recipe: { layers: lab.activeLayers() },
  });
});

$('#nav-lab').addEventListener('click', () => {
  if (!lab.recipe.layers.length) {
    // seed the mixer with whatever Deep Focus currently runs
    const v = PRESETS.focus.variants[settings.variants.focus] || PRESETS.focus.variants[PRESETS.focus.defaultVariant];
    lab.recipe = { name: '', layers: lab.normalize(v.layers) };
  }
  $('#lab-vol').value = Math.round(settings.volume * 100);
  lab.render();
  app.show('lab');
});

// leaving the lab stops the preview
$$('#screen-lab [data-back]').forEach(b => b.addEventListener('click', () => lab.stopPreview()));

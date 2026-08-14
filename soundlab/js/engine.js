/* Web Audio synthesis engine. Everything is generated in-browser — no audio
 * assets. One AudioContext lives for the app's lifetime (created on first
 * user gesture, iOS requirement); each session builds a fresh node graph.
 *
 * Layers report live setters keyed by param path ('level', 'am.rate',
 * 'carrier', ...) so the lab mixer can adjust a running graph without
 * rebuilding it. Structural changes (layer added/removed, voice counts,
 * chord choices) go through restart(), which crossfades to a new graph.
 */

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;      // user volume
    this.limiter = null;     // safety compressor before destination
    this.analyser = null;
    this.session = null;     // { nodes: [], bus }
    this.volume = 0.5;       // 0..1 slider value
  }

  _ensureCtx() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();

    this.limiter = this.ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -12;
    this.limiter.knee.value = 10;
    this.limiter.ratio.value = 12;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.25;

    this.master = this.ctx.createGain();
    this.master.gain.value = 0;

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;

    this.master.connect(this.limiter);
    this.limiter.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
  }

  _gainForVolume(v) {
    return Math.pow(v, 2) * 0.9; // perceptual-ish curve, capped below unity
  }

  setVolume(v) {
    this.volume = v;
    if (this.ctx && this.session) {
      this.master.gain.setTargetAtTime(this._gainForVolume(v), this.ctx.currentTime, 0.1);
    }
  }

  get playing() { return !!this.session; }

  async start(recipe, rampSec = 20) {
    this._ensureCtx();
    if (this.ctx.state !== 'running') await this.ctx.resume();
    this.stopNow();

    this.session = this._buildSession(recipe);

    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(0.0001, t);
    this.master.gain.setTargetAtTime(this._gainForVolume(this.volume), t, Math.max(rampSec / 4, 0.05));
  }

  /* Swap the running graph for a new recipe with a short crossfade, keeping
   * master level steady. Falls back to start() when nothing is playing. */
  async restart(recipe) {
    if (!this.session) return this.start(recipe, 2);
    const old = this.session;
    this.session = this._buildSession(recipe, { fadeIn: 0.3 });
    const t = this.ctx.currentTime;
    old.bus.gain.setTargetAtTime(0.0001, t, 0.08);
    setTimeout(() => this._teardown(old), 500);
  }

  _buildSession(recipe, { fadeIn = 0 } = {}) {
    const bus = this.ctx.createGain();
    if (fadeIn > 0) {
      bus.gain.value = 0.0001;
      bus.gain.setTargetAtTime(1, this.ctx.currentTime, fadeIn / 3);
    } else {
      bus.gain.value = 1;
    }
    bus.connect(this.master);

    const nodes = [];
    for (const layer of recipe.layers) {
      const built = this._buildLayer(layer, bus);
      if (built) {
        built.type = layer.type;
        if (layer.muted && built.set.level) built.set.level(0);
        nodes.push(built);
      }
    }
    return { nodes, bus };
  }

  /* Live param update by layer index and param path. Returns false when the
   * running graph has no setter for that path (i.e. structural change). */
  updateLayer(i, path, value) {
    const node = this.session && this.session.nodes[i];
    if (!node || !node.set[path]) return false;
    node.set[path](value);
    return true;
  }

  async stop(fadeSec = 2) {
    if (!this.ctx || !this.session) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(0.0001, t, fadeSec / 4);
    const session = this.session;
    this.session = null;
    await new Promise(r => setTimeout(r, fadeSec * 1000 + 200));
    this._teardown(session);
  }

  stopNow() {
    if (!this.session) return;
    this._teardown(this.session);
    this.session = null;
  }

  _teardown(session) {
    for (const n of session.nodes) {
      for (const src of n.sources) { try { src.stop(); } catch (e) {} }
    }
    try { session.bus.disconnect(); } catch (e) {}
  }

  /* Soft two-partial bell, routed through the limiter so volume applies. */
  chime() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const [freq, amp] of [[740, 0.1], [1110, 0.05]]) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.frequency.value = freq;
      g.gain.setValueAtTime(amp, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
      osc.connect(g);
      g.connect(this.limiter);
      osc.start(t);
      osc.stop(t + 2);
    }
  }

  /* RMS of current output — used for self-checks, not UI. */
  outputRms() {
    if (!this.analyser) return 0;
    const buf = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    return Math.sqrt(sum / buf.length);
  }

  // ---------------------------------------------------------------- layers

  _buildLayer(layer, bus) {
    switch (layer.type) {
      case 'noise':      return this._noiseLayer(layer, bus);
      case 'binaural':   return this._beatLayer(layer, bus, true);
      case 'monaural':   return this._beatLayer(layer, bus, false);
      case 'isochronic': return this._isochronicLayer(layer, bus);
      case 'pad':        return this._padLayer(layer, bus);
      case 'murmur':     return this._murmurLayer(layer, bus);
      case 'tone':       return this._toneLayer(layer, bus);
      default:
        console.warn('unknown layer type', layer.type);
        return null;
    }
  }

  _levelNode(value, bus) {
    const g = this.ctx.createGain();
    g.gain.value = value;
    g.connect(bus);
    const set = v => g.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
    return { node: g, set };
  }

  /* LFO → depth scaler driving a gain that idles at (1 - depth/2), so the
   * modulated signal swings [1-depth, 1]. shape 'square' gates instead of
   * swelling (isochronic character); its edges are softened by a lowpass on
   * the control signal so gating doesn't click. */
  _amChain(rate, depth, sources, shape = 'sine') {
    const amGain = this.ctx.createGain();
    amGain.gain.value = 1 - depth / 2;
    const lfo = this.ctx.createOscillator();
    lfo.type = shape;
    lfo.frequency.value = rate;
    const scale = this.ctx.createGain();
    scale.gain.value = depth / 2;
    lfo.connect(scale);

    let smoother = null;
    if (shape === 'square') {
      smoother = this.ctx.createBiquadFilter();
      smoother.type = 'lowpass';
      smoother.frequency.value = Math.max(rate * 10, 40);
      scale.connect(smoother);
      smoother.connect(amGain.gain);
    } else {
      scale.connect(amGain.gain);
    }
    lfo.start();
    sources.push(lfo);

    const t = () => this.ctx.currentTime;
    return {
      node: amGain,
      setRate: r => {
        lfo.frequency.setTargetAtTime(r, t(), 0.05);
        if (smoother) smoother.frequency.setTargetAtTime(Math.max(r * 10, 40), t(), 0.05);
      },
      setDepth: d => {
        amGain.gain.setTargetAtTime(1 - d / 2, t(), 0.05);
        scale.gain.setTargetAtTime(d / 2, t(), 0.05);
      },
    };
  }

  _pinkBuffer(seconds = 8) {
    const rate = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(2, seconds * rate, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      // Paul Kellet's economy pink noise filter
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < data.length; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      }
    }
    return buf;
  }

  _noiseLayer(layer, bus) {
    const sources = [];
    const src = this.ctx.createBufferSource();
    src.buffer = this._pinkBuffer();
    src.loop = true;

    const level = this._levelNode(layer.level, bus);
    const set = { level: level.set };

    let head = src;
    if (layer.am) {
      const am = this._amChain(layer.am.rate, layer.am.depth, sources);
      src.connect(am.node);
      head = am.node;
      set['am.rate'] = am.setRate;
      set['am.depth'] = am.setDepth;
    }
    head.connect(level.node);
    src.start();
    sources.push(src);
    return { sources, set };
  }

  /* Binaural (dichotic: one carrier per ear, beat constructed in the brain)
   * or monaural (both tones mixed before the ear, beat physically present —
   * the stronger cortical driver, and it works on speakers). */
  _beatLayer(layer, bus, dichotic) {
    const sources = [];
    const level = this._levelNode(layer.level, bus);
    const state = { carrier: layer.carrier, beat: layer.beat };

    const oscs = [];
    for (const [offset, pan] of [[0, -1], [layer.beat, 1]]) {
      const osc = this.ctx.createOscillator();
      osc.frequency.value = layer.carrier + offset;
      if (dichotic) {
        const p = this.ctx.createStereoPanner();
        p.pan.value = pan;
        osc.connect(p);
        p.connect(level.node);
      } else {
        const g = this.ctx.createGain();
        g.gain.value = 0.5;
        osc.connect(g);
        g.connect(level.node);
      }
      osc.start();
      sources.push(osc);
      oscs.push(osc);
    }

    const t = () => this.ctx.currentTime;
    const retune = () => {
      oscs[0].frequency.setTargetAtTime(state.carrier, t(), 0.05);
      oscs[1].frequency.setTargetAtTime(state.carrier + state.beat, t(), 0.05);
    };
    return {
      sources,
      set: {
        level: level.set,
        carrier: v => { state.carrier = v; retune(); },
        beat: v => { state.beat = v; retune(); },
      },
    };
  }

  /* Isochronic: a tone gated on/off at a precise rate — the strongest driver
   * of the auditory steady-state response of the whole beat family. */
  _isochronicLayer(layer, bus) {
    const sources = [];
    const level = this._levelNode(layer.level, bus);

    const osc = this.ctx.createOscillator();
    osc.frequency.value = layer.freq;
    const am = this._amChain(layer.rate, layer.depth != null ? layer.depth : 1, sources, 'square');
    osc.connect(am.node);
    am.node.connect(level.node);
    osc.start();
    sources.push(osc);

    return {
      sources,
      set: {
        level: level.set,
        freq: v => osc.frequency.setTargetAtTime(v, this.ctx.currentTime, 0.05),
        rate: am.setRate,
        depth: am.setDepth,
      },
    };
  }

  _padLayer(layer, bus) {
    const sources = [];
    const level = this._levelNode(layer.level, bus);
    const set = { level: level.set };

    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    lp.Q.value = 0.5;

    let head = lp;
    if (layer.am) {
      const am = this._amChain(layer.am.rate, layer.am.depth, sources);
      lp.connect(am.node);
      head = am.node;
      set['am.rate'] = am.setRate;
      set['am.depth'] = am.setDepth;
    }
    head.connect(level.node);

    for (const note of layer.notes) {
      for (const cents of [-4, 4]) {
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = note * Math.pow(2, cents / 1200);
        const g = this.ctx.createGain();
        g.gain.value = 0.5 / layer.notes.length;
        osc.connect(g);
        g.connect(lp);
        osc.start();
        sources.push(osc);
      }
    }
    return { sources, set };
  }

  /* Steady pure tone — the featureless-constant-stimulus family. `chorus`
   * cents detunes a second oscillator so the two beat slowly; `drift` adds a
   * very slow swell. Both exist to reduce listening fatigue. */
  _toneLayer(layer, bus) {
    const sources = [];
    const level = this._levelNode(layer.level, bus);
    const set = { level: level.set };

    let dest = level.node;
    if (layer.drift) {
      const am = this._amChain(layer.drift.rate, layer.drift.depth, sources);
      am.node.connect(level.node);
      dest = am.node;
    }

    const detunes = layer.chorus ? [-layer.chorus, layer.chorus] : [0];
    const oscs = [];
    for (const cents of detunes) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = layer.freq * Math.pow(2, cents / 1200);
      const g = this.ctx.createGain();
      g.gain.value = 1 / detunes.length;
      osc.connect(g);
      g.connect(dest);
      osc.start();
      sources.push(osc);
      oscs.push({ osc, cents });
    }
    set.freq = v => {
      for (const { osc, cents } of oscs) {
        osc.frequency.setTargetAtTime(v * Math.pow(2, cents / 1200), this.ctx.currentTime, 0.05);
      }
    };
    return { sources, set };
  }

  /* Synthesized unintelligible crowd chatter. Each voice: sawtooth with
   * pitch wander + vibrato → two wandering formant bandpasses → syllabic
   * gating (~4–5 Hz) → utterance gating (slow duty cycle) → distance
   * lowpass → pan. All node-driven (no JS timers), so it survives
   * background-tab throttling. Voices stagger in over the first seconds. */
  _murmurLayer(layer, bus) {
    const sources = [];
    const level = this._levelNode(layer.level, bus);

    const murmurBus = this.ctx.createGain();
    murmurBus.gain.value = 1;

    const distance = this.ctx.createBiquadFilter();
    distance.type = 'lowpass';
    distance.frequency.value = 2200;
    murmurBus.connect(distance);
    distance.connect(level.node);

    const now = this.ctx.currentTime;
    const voices = layer.voices || 6;
    for (let i = 0; i < voices; i++) {
      this._murmurVoice(murmurBus, sources, now + Math.random() * 4, i);
    }
    return { sources, set: { level: level.set } };
  }

  _murmurVoice(out, sources, startAt, idx) {
    const ctx = this.ctx;
    const f0 = 95 + Math.random() * 110; // spans lower/higher voices

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = f0;

    const vibrato = ctx.createOscillator();
    vibrato.frequency.value = 4.5 + Math.random();
    const vibratoAmt = ctx.createGain();
    vibratoAmt.gain.value = 2.5;
    vibrato.connect(vibratoAmt);
    vibratoAmt.connect(osc.frequency);

    const wander = ctx.createOscillator();
    wander.frequency.value = 0.09 + Math.random() * 0.08;
    const wanderAmt = ctx.createGain();
    wanderAmt.gain.value = f0 * 0.12;
    wander.connect(wanderAmt);
    wanderAmt.connect(osc.frequency);

    // two formants with independent slow movement — vowel-ish color that
    // never resolves into words
    const voiceSum = ctx.createGain();
    voiceSum.gain.value = 1;
    for (const [base, span, rate, q] of [
      [430 + Math.random() * 120, 190, 0.8 + Math.random() * 0.5, 5],
      [1250 + Math.random() * 350, 480, 1.0 + Math.random() * 0.6, 7],
    ]) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = base;
      bp.Q.value = q;
      const move = ctx.createOscillator();
      move.frequency.value = rate;
      const moveAmt = ctx.createGain();
      moveAmt.gain.value = span;
      move.connect(moveAmt);
      moveAmt.connect(bp.frequency);
      move.start(startAt);
      sources.push(move);
      osc.connect(bp);
      bp.connect(voiceSum);
    }

    // syllabic gating ~3.5–5.5 Hz: sine → soft half-wave shaper
    const syl = ctx.createGain();
    syl.gain.value = 0;
    const sylLfo = ctx.createOscillator();
    sylLfo.frequency.value = 3.5 + Math.random() * 2;
    const sylShape = ctx.createWaveShaper();
    sylShape.curve = AudioEngine._shaperCurve(x => Math.max(0, x) ** 1.4);
    sylLfo.connect(sylShape);
    sylShape.connect(syl.gain);
    sylLfo.start(startAt);
    sources.push(sylLfo);

    // utterance gating: very slow sine → thresholded shaper ≈ talk/pause
    // duty cycle; per-voice rates decorrelate the room over time
    const utt = ctx.createGain();
    utt.gain.value = 0;
    const uttLfo = ctx.createOscillator();
    uttLfo.frequency.value = 0.05 + Math.random() * 0.09;
    const uttShape = ctx.createWaveShaper();
    const thr = -0.2 + Math.random() * 0.4;
    uttShape.curve = AudioEngine._shaperCurve(x => Math.min(1, Math.max(0, (x - thr) * 3)));
    uttLfo.connect(uttShape);
    uttShape.connect(utt.gain);
    uttLfo.start(startAt);
    sources.push(uttLfo);

    const pan = ctx.createStereoPanner();
    pan.pan.value = -0.8 + (idx % 5) * 0.4 + (Math.random() * 0.2 - 0.1);

    const voiceLevel = ctx.createGain();
    voiceLevel.gain.value = 0.55;

    voiceSum.connect(syl);
    syl.connect(utt);
    utt.connect(pan);
    pan.connect(voiceLevel);
    voiceLevel.connect(out);

    osc.start(startAt);
    vibrato.start(startAt);
    wander.start(startAt);
    sources.push(osc, vibrato, wander);
  }

  static _shaperCurve(fn, n = 1024) {
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = fn(x);
    }
    return curve;
  }
}

const engine = new AudioEngine();

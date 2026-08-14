/* Presets are labels over swappable engine variants. Pick the active variant
 * per state in settings; the session log records which one ran, so the
 * phase 3 experiment engine can assign and blind them automatically.
 *
 * Layer types understood by engine.js:
 *   noise    — pink noise bed; optional amplitude modulation {rate, depth}
 *   binaural — carrier L, carrier+beat R; needs headphones to do anything
 *   pad      — detuned chord of soft partials through a lowpass; optional AM
 *   murmur   — synthesized unintelligible crowd chatter (voice count)
 *   tone     — steady pure sine; optional chorus (cents) and drift (slow AM)
 *
 * Levels are per-layer linear gains, balanced against each other by ear and
 * checked by RMS; master volume scales the whole mix.
 */

const PRESETS = {
  focus: {
    name: 'Deep Focus',
    defaultVariant: 'focus-noise-am',
    variants: {
      // Evidence-first: pink noise carrying 16 Hz beta-rate AM (Woods 2024
      // rapid-modulation finding), low-level beta binaural masked inside
      // (masking didn't cost behavioral benefit in the 2019 meta-analysis).
      'focus-noise-am': {
        label: 'pink noise + 16 Hz modulation',
        layers: [
          { type: 'noise', level: 0.55, am: { rate: 16, depth: 0.35 } },
          { type: 'binaural', carrier: 340, beat: 16, level: 0.05 },
        ],
      },

      // Faithful reproduction of the 852 Hz single-tone videos. The
      // Solfeggio numerology behind that number is invented, but a steady
      // featureless tone is a real and distinct stimulus: total masking,
      // zero information content, nothing for attention to grab.
      'focus-tone-852': {
        label: '852 Hz pure tone',
        layers: [
          { type: 'tone', freq: 852, level: 0.08 },
        ],
      },

      // Same tone softened: two oscillators 3 cents apart beat slowly and a
      // 0.05 Hz swell keeps the ear from fatiguing on one fixed frequency.
      'focus-tone-852-soft': {
        label: '852 Hz tone, softened',
        layers: [
          { type: 'tone', freq: 852, level: 0.085, chorus: 3, drift: { rate: 0.05, depth: 0.18 } },
        ],
      },

      // Hybrid: the tone's steady anchor over a pink-noise bed that adds
      // the broadband masking a bare sine can't provide.
      'focus-tone-bed': {
        label: '852 Hz tone + noise bed',
        layers: [
          { type: 'tone', freq: 852, level: 0.055, chorus: 3 },
          { type: 'noise', level: 0.4 },
        ],
      },

      // Frequency control for the Solfeggio claim. Same engine, loudness-
      // matched (417 Hz sits in a less sensitive part of the equal-loudness
      // contour, so it needs ~+3 dB to match 852 Hz by ear). If 852 is
      // special this should feel worse; if the mechanism is just "a steady
      // tone," it should feel the same.
      'focus-tone-control': {
        label: 'just-a-tone control (417 Hz)',
        layers: [
          { type: 'tone', freq: 417, level: 0.113 },
        ],
      },
    },
  },

  think: {
    name: 'Deep Think',
    defaultVariant: 'think-murmur',
    variants: {
      // The cafe effect: ambient activity to push against. Unintelligible
      // murmur (no lyrics/intelligible speech — irrelevant-speech effect)
      // over a quiet noise floor.
      'think-murmur': {
        label: 'crowd murmur + noise floor',
        layers: [
          { type: 'murmur', voices: 6, level: 1.0 },
          { type: 'noise', level: 0.5 },
        ],
      },
      'think-murmur-dense': {
        label: 'busier room',
        layers: [
          { type: 'murmur', voices: 11, level: 1.0 },
          { type: 'noise', level: 0.55 },
        ],
      },
    },
  },

  relax: {
    name: 'Relax',
    defaultVariant: 'relax-pad',
    variants: {
      // Theta-range beats are the one place beat stimulation has a decent
      // effect size (anxiety, g≈0.69) — masked in a slow-breathing pad.
      'relax-pad': {
        label: 'warm pad + theta beats',
        layers: [
          { type: 'pad', notes: [110, 164.81, 246.94], level: 0.5, am: { rate: 0.15, depth: 0.22 } },
          { type: 'binaural', carrier: 250, beat: 6, level: 0.08 },
          { type: 'noise', level: 0.1 },
        ],
      },
      'relax-pad-no-beat': {
        label: 'warm pad only (beat control)',
        layers: [
          { type: 'pad', notes: [110, 164.81, 246.94], level: 0.5, am: { rate: 0.15, depth: 0.22 } },
          { type: 'noise', level: 0.1 },
        ],
      },
    },
  },

  meditate: {
    name: 'Meditate',
    defaultVariant: 'meditate-drone',
    variants: {
      // Sparse drone, deep-theta binaural, swell at 6 breaths/min (0.1 Hz)
      // as a nonverbal breath pacer.
      'meditate-drone': {
        label: 'drone + breath-paced swell',
        layers: [
          { type: 'pad', notes: [110, 165], level: 0.55, am: { rate: 0.1, depth: 0.4 } },
          { type: 'binaural', carrier: 210, beat: 4.5, level: 0.1 },
        ],
      },
      'meditate-tone': {
        label: 'single sustained tone',
        layers: [
          { type: 'tone', freq: 136.1, level: 0.30, chorus: 4, drift: { rate: 0.1, depth: 0.3 } },
        ],
      },
    },
  },
};

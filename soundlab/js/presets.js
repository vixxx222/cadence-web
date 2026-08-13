/* Presets are labels over swappable engine variants. Phase 1 ships one
 * variant per state; the experiment engine (phase 3) will assign variants
 * per-session and blind what's blindable (AM on/off, beat on/off, rates).
 *
 * Layer types understood by engine.js:
 *   noise    — pink noise bed; optional amplitude modulation {rate, depth}
 *   binaural — carrier L, carrier+beat R; needs headphones to do anything
 *   pad      — detuned chord of soft partials through a lowpass; optional AM
 *   murmur   — synthesized unintelligible crowd chatter (voice count)
 *
 * Levels are per-layer linear gains, balanced against each other by ear;
 * master volume scales the whole mix.
 */

const PRESETS = {
  focus: {
    name: 'Deep Focus',
    defaultVariant: 'focus-a',
    variants: {
      // Evidence-first: pink noise carrying 16 Hz beta-rate AM (Woods 2024
      // rapid-modulation finding), low-level beta binaural masked inside
      // (masking didn't cost behavioral benefit in the 2019 meta-analysis).
      'focus-a': {
        layers: [
          { type: 'noise', level: 0.55, am: { rate: 16, depth: 0.35 } },
          { type: 'binaural', carrier: 340, beat: 16, level: 0.05 },
        ],
      },
    },
  },

  think: {
    name: 'Deep Think',
    defaultVariant: 'think-a',
    variants: {
      // The cafe effect: ambient activity to push against. Unintelligible
      // murmur (no lyrics/intelligible speech — irrelevant-speech effect)
      // over a quiet noise floor.
      'think-a': {
        layers: [
          { type: 'murmur', voices: 6, level: 1.0 },
          { type: 'noise', level: 0.5 },
        ],
      },
    },
  },

  relax: {
    name: 'Relax',
    defaultVariant: 'relax-a',
    variants: {
      // Theta-range beats are the one place beat stimulation has a decent
      // effect size (anxiety, g≈0.69) — masked in a slow-breathing pad.
      'relax-a': {
        layers: [
          { type: 'pad', notes: [110, 164.81, 246.94], level: 0.5, am: { rate: 0.15, depth: 0.22 } },
          { type: 'binaural', carrier: 250, beat: 6, level: 0.08 },
          { type: 'noise', level: 0.1 },
        ],
      },
    },
  },

  meditate: {
    name: 'Meditate',
    defaultVariant: 'meditate-a',
    variants: {
      // Sparse drone, deep-theta binaural, swell at 6 breaths/min (0.1 Hz)
      // as a nonverbal breath pacer.
      'meditate-a': {
        layers: [
          { type: 'pad', notes: [110, 165], level: 0.55, am: { rate: 0.1, depth: 0.4 } },
          { type: 'binaural', carrier: 210, beat: 4.5, level: 0.1 },
        ],
      },
    },
  },
};

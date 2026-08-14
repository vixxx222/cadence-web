/* The insight layer: what the literature actually says about each control,
 * graded honestly. Touching any control in the lab surfaces the matching
 * entry, so parameter exploration doubles as a guided tour of the evidence.
 *
 * Grades: strong — replicated/meta-analytic · promising — real but young or
 * single-team · mixed — results point both ways · weak — mostly null with
 * scattered positives · none — no supporting evidence · experimental —
 * interesting physiology, unproven benefit.
 *
 * An entry: { grade, title, body, sources: [{label, url}] }.
 * Range-dependent topics use { ranges: [{max, ...entry}] } — first range
 * whose max exceeds the current value wins.
 */

const GRADE_LABELS = {
  strong: 'strong evidence',
  promising: 'promising',
  mixed: 'mixed results',
  weak: 'weak evidence',
  none: 'no evidence',
  experimental: 'experimental',
};

const INSIGHTS = {

  // ------------------------------------------------------------ layer types

  'type:noise': {
    grade: 'strong',
    title: 'Pink noise',
    body: 'Broadband noise nudges an under-stimulated brain toward its optimal arousal band (stochastic resonance). A 2024 meta-analysis of 13 studies found small but reliable task-performance gains in ADHD — and slight impairment in neurotypical listeners. That crossover is the signature finding: if noise settles you, you are likely on the side it helps. Expect the room to recede and your own thoughts to get one notch louder.',
    sources: [
      { label: 'Nigg et al. 2024, JAACAP', url: 'https://pubmed.ncbi.nlm.nih.gov/38428577/' },
      { label: 'Söderlund et al. 2007', url: 'https://pubmed.ncbi.nlm.nih.gov/17683456/' },
    ],
  },

  'type:binaural': {
    grade: 'weak',
    title: 'Binaural beats',
    body: 'Two slightly different tones, one per ear; the beat exists only inside your auditory system. The famous "brainwave entrainment" story mostly fails replication — 8 of 14 EEG studies contradict it, and binaural is the weakest entrainer of the whole beat family. Where beats do show effects (theta range, anxiety) the benefit appears without proportional entrainment, so expectation and ritual likely carry much of it. For a personal tool that still counts — just know what you are buying.',
    sources: [
      { label: 'Ingendoh et al. 2023, PLOS ONE', url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10198548/' },
      { label: 'Orozco Perez et al. 2020, eNeuro', url: 'https://www.eneuro.org/content/7/2/ENEURO.0232-19.2020' },
      { label: 'Garcia-Argibay et al. 2019', url: 'https://link.springer.com/article/10.1007/s00426-018-1066-8' },
    ],
  },

  'type:monaural': {
    grade: 'promising',
    title: 'Monaural beats',
    body: 'Both tones mixed before they reach the ear, so the beat is physically present in the sound — and cortex follows it measurably more strongly than a binaural beat. Small trials show anxiety reduction. Practical bonus: works on speakers; binaural does not.',
    sources: [
      { label: 'Orozco Perez et al. 2020, eNeuro', url: 'https://www.eneuro.org/content/7/2/ENEURO.0232-19.2020' },
      { label: 'Chaieb et al. 2015, Front. Psychiatry', url: 'https://www.frontiersin.org/journals/psychiatry/articles/10.3389/fpsyt.2015.00070/full' },
    ],
  },

  'type:isochronic': {
    grade: 'promising',
    title: 'Isochronic tone',
    body: 'A tone switched on and off at a precise rate — the strongest driver of the auditory steady-state response, the one pathway in this family with solid physiology. Direct behavioral studies are thin (~12% of the beat literature), but the modulated-music attention results ride this same mechanism, dressed in music. If you want the brain to actually follow a rhythm, this beats binaural.',
    sources: [
      { label: 'Schwarz & Taylor 2005, Clin. Neurophysiology', url: 'https://pubmed.ncbi.nlm.nih.gov/15661111/' },
      { label: 'Woods et al. 2024, Communications Biology', url: 'https://www.nature.com/articles/s42003-024-07026-3' },
    ],
  },

  'type:tone': {
    grade: 'none',
    title: 'Pure tone',
    body: 'A featureless constant masker: nothing starts, stops, or changes — nothing for attention to grab, and the auditory system habituates to it within minutes while it keeps masking the room. The steadiness is the mechanism. The specific frequency is not: no acoustic evidence distinguishes any "special" frequency (the Solfeggio numbers came from 1970s numerology, not measurement).',
    sources: [],
  },

  'type:pad': {
    grade: 'mixed',
    title: 'Harmonic pad',
    body: 'Lyric-free harmonic texture. The background-music literature nets out: instrumental and familiar material is roughly neutral-to-mildly-positive for complex work; intelligible words are what reliably hurt reading, writing, and verbal memory. A pad gives the warmth of music with none of the words.',
    sources: [
      { label: 'Cheah et al. 2022, Music & Science (review)', url: 'https://journals.sagepub.com/doi/10.1177/20592043221134392' },
    ],
  },

  'type:murmur': {
    grade: 'promising',
    title: 'Crowd murmur',
    body: 'Unintelligible chatter — the cafe effect on demand. It supplies arousal and something to push against, without the irrelevant-speech penalty of real words (interference tracks intelligibility, not sound level; foreign or blurred voices behave like instrumentals). If you focus better in busy rooms than silent ones, this is your layer.',
    sources: [
      { label: 'Cheah et al. 2022, Music & Science (review)', url: 'https://journals.sagepub.com/doi/10.1177/20592043221134392' },
      { label: 'Söderlund et al. 2007', url: 'https://pubmed.ncbi.nlm.nih.gov/17683456/' },
    ],
  },

  // -------------------------------------------------------------- AM rates

  'am.rate': {
    ranges: [
      {
        max: 0.5, grade: 'promising', title: 'Slow swell',
        body: 'Sub-perceptual breathing-rate modulation. At 0.1 Hz the swell paces 6 breaths/min — the slow-breathing sweet spot in the relaxation literature — without a single spoken instruction. Calming; no attention claims.',
        sources: [],
      },
      {
        max: 8, grade: 'mixed', title: 'Theta-rate modulation',
        body: 'Wind-down territory. In beat stimulation, theta (4–8 Hz) is where the one decent meta-analytic effect lives: anxiety reduction, g≈0.69 — from only 4 small studies, so hold it loosely. Expect settling, not sharpening.',
        sources: [
          { label: 'Garcia-Argibay et al. 2019', url: 'https://link.springer.com/article/10.1007/s00426-018-1066-8' },
        ],
      },
      {
        max: 12, grade: 'weak', title: 'Alpha-rate modulation',
        body: 'The "relaxed alert" band by reputation; direct evidence for alpha-rate audio doing anything specific is thin in both directions. Pleasant is a fine reason to use it — just do not expect a documented effect.',
        sources: [],
      },
      {
        max: 21, grade: 'promising', title: 'Beta-rate modulation — the tested sweet spot',
        body: 'This is where the strongest modern result sits: 16 Hz amplitude modulation woven into music improved sustained attention, with fMRI showing greater attention-network engagement — and the benefit was largest in listeners with more ADHD traits (low-ADHD listeners preferred slower rates). Single team (Brain.fm-affiliated), so replication is pending, but the mechanism rides the well-established steady-state response.',
        sources: [
          { label: 'Woods et al. 2024, Communications Biology', url: 'https://www.nature.com/articles/s42003-024-07026-3' },
          { label: 'Woods et al. 2019 (arXiv)', url: 'https://arxiv.org/abs/1907.06909' },
        ],
      },
      {
        max: 30, grade: 'weak', title: 'Upper beta',
        body: 'Past the tested sweet spot. Nothing here has been shown to help; perceptually it starts reading as flutter or edge before it reads as drive.',
        sources: [],
      },
      {
        max: 999, grade: 'experimental', title: 'Gamma / 40 Hz',
        body: 'Rock-solid physiology — auditory cortex resonates at 40 Hz and entrains reliably — but no demonstrated cognition benefit in healthy adults, and some people find sustained 40 Hz actively aversive. The genuinely interesting 40 Hz story is the Alzheimer\'s work (GENUS), and that is preliminary, with one prominent mouse replication failure. Here for curiosity, honestly labeled.',
        sources: [
          { label: 'Chan et al. 2022, PLOS ONE (GENUS Phase 2A)', url: 'https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0278412' },
          { label: 'Soula et al. 2023, Nat. Neuroscience (failed replication)', url: 'https://www.nature.com/articles/s41593-023-01270-2' },
        ],
      },
    ],
  },

  'am.depth': {
    grade: 'mixed',
    title: 'Modulation depth',
    body: 'How hard the rhythm is stamped into the sound. The attention studies used modest, music-masked depths — enough for the brain to track, not enough to distract. Masking the modulation did not cost behavioral benefit in the 2019 meta-analysis, so err toward subtle: if you can tap along to it, it is probably deep enough.',
    sources: [
      { label: 'Garcia-Argibay et al. 2019', url: 'https://link.springer.com/article/10.1007/s00426-018-1066-8' },
    ],
  },

  // ------------------------------------------------------------ beat params

  'beat.freq': {
    ranges: [
      {
        max: 4, grade: 'weak', title: 'Delta-range beat (0.5–4 Hz)',
        body: 'Marketed for sleep; the controlled evidence is sparse and mostly null. Harmless, occasionally pleasant, unproven.',
        sources: [],
      },
      {
        max: 8, grade: 'mixed', title: 'Theta-range beat (4–8 Hz)',
        body: 'The one place beat stimulation earns a real effect size: anxiety reduction, g≈0.69 across 4 small studies. Use it for wind-down and pre-sleep, not for sharpening. Blinded studies suggest expectancy carries a share — which still works in your favor.',
        sources: [
          { label: 'Garcia-Argibay et al. 2019', url: 'https://link.springer.com/article/10.1007/s00426-018-1066-8' },
        ],
      },
      {
        max: 13, grade: 'weak', title: 'Alpha-range beat (8–13 Hz)',
        body: 'Relaxation-adjacent claims, thin results in both directions. Fine to like; do not expect a documented mechanism.',
        sources: [],
      },
      {
        max: 30, grade: 'mixed', title: 'Beta-range beat (13–30 Hz)',
        body: 'The attention/vigilance claim. Results are genuinely mixed: some studies find small gains, a careful 2025 parametric study found no rescue of the vigilance decrement — and the one ADHD pilot RCT (15 Hz) reduced mind-wandering without moving core symptoms. Worth testing on yourself; not worth believing on faith.',
        sources: [
          { label: 'Parametric study, Sci. Reports 2025', url: 'https://www.nature.com/articles/s41598-025-88517-z' },
          { label: 'Schoen et al. 2022 (ADHD pilot)', url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9564012/' },
        ],
      },
      {
        max: 999, grade: 'experimental', title: 'Gamma-range beat (30+ Hz)',
        body: 'At 40 Hz the steady-state physiology is real, but a binaural beat is the weakest way to drive it — if you want gamma, the isochronic layer does the same job with an actually-measurable stimulus. No cognition benefit demonstrated in healthy adults either way.',
        sources: [
          { label: 'Orozco Perez et al. 2020, eNeuro', url: 'https://www.eneuro.org/content/7/2/ENEURO.0232-19.2020' },
        ],
      },
    ],
  },

  'beat.carrier': {
    grade: 'promising',
    title: 'Carrier frequency',
    body: 'The pitch the beat rides on. Positive studies cluster at 200–450 Hz, and lower carriers make the beat percept more salient — a 2025 parametric study\'s best-performing cell used a 340 Hz carrier (over 400 Hz). Below ~150 Hz the beat gets muddy; above ~500 Hz it thins out.',
    sources: [
      { label: 'Parametric study, Sci. Reports 2025', url: 'https://www.nature.com/articles/s41598-025-88517-z' },
    ],
  },

  // ------------------------------------------------------------ tone params

  'tone.freq': {
    grade: 'none',
    title: 'Tone frequency',
    body: 'Pick by comfort: mids (200–900 Hz) mask speech best; low tones read as drones, high ones as whistles that fatigue faster. No frequency has documented special effects — if a number feels meaningful, that meaning came from marketing, not measurement. Steadiness does the work.',
    sources: [],
    solfeggio: {
      grade: 'none',
      title: 'A "Solfeggio" number',
      body: 'You have landed near one of the Solfeggio frequencies (396/417/528/639/741/852). That set was produced in the 1970s by numerological reduction of Bible verse numbers, later marketed as ancient. No acoustic or biological evidence distinguishes these values from their neighbors. If this tone works for you, it works because it is a steady tone — and your session ratings can prove that either way.',
      sources: [
        { label: 'RationalWiki: Solfeggio frequencies', url: 'https://rationalwiki.org/wiki/Solfeggio_frequencies' },
      ],
    },
  },

  'tone.chorus': {
    grade: 'none',
    title: 'Chorus detune',
    body: 'Splits the tone into two oscillators a few cents apart; they drift in and out of phase, adding a slow shimmer. Purely for listening comfort on long sessions — a bare sine parks all its energy on one spot in the cochlea and fatigues faster.',
    sources: [],
  },

  // ----------------------------------------------------------- misc params

  'murmur.voices': {
    grade: 'promising',
    title: 'Crowd size',
    body: 'Fewer voices read as a quiet cafe, more as a busy room. This is your arousal knob: the optimal external stimulation level is personal (and higher for ADHD-pattern brains than neurotypical ones — the inverted-U). Dose the crowd until the room feels alive but no single voice is followable.',
    sources: [
      { label: 'Söderlund et al. 2007', url: 'https://pubmed.ncbi.nlm.nih.gov/17683456/' },
    ],
  },

  'pad.chord': {
    grade: 'mixed',
    title: 'Chord color',
    body: 'Open fifths read neutral and vast; added thirds warm it toward music. The more musical it gets, the more attention it can attract — for deep work, duller is often better. Preference beats prescription here.',
    sources: [],
  },

  'level': {
    grade: 'strong',
    title: 'Layer level',
    body: 'Balance layers so no single one draws focus. Whole-mix guidance: lab-effective noise sat near 77–80 dB, which is too loud for hours of listening — stay where the sound sits behind your thoughts (≤~70 dB). For neurotypical listeners the measured optimum was far quieter (~45 dB). Louder is not deeper.',
    sources: [
      { label: 'Awada et al. 2022, Sci. Reports', url: 'https://www.nature.com/articles/s41598-022-18862-w' },
    ],
  },

  'overlay': {
    grade: 'strong',
    title: 'Playing under your own music',
    body: 'These recipes are tuned quiet, to sit beneath a stream from another app. The one hard rule from the literature: no intelligible lyrics during verbal work — words reliably impair reading, writing, and verbal memory, while familiar instrumentals are safe. Start your music, start the overlay, then lower the overlay until you stop noticing it.',
    sources: [
      { label: 'Cheah et al. 2022, Music & Science (review)', url: 'https://journals.sagepub.com/doi/10.1177/20592043221134392' },
      { label: 'Lyrics interference, J. Cognition 2023', url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10162369/' },
    ],
  },
};

const SOLFEGGIO_FREQS = [396, 417, 528, 639, 741, 852];

/* Resolve a topic (+ current value for range topics) to a concrete entry. */
function insightFor(topic, value) {
  const entry = INSIGHTS[topic];
  if (!entry) return null;
  if (topic === 'tone.freq' && value != null &&
      SOLFEGGIO_FREQS.some(f => Math.abs(f - value) <= 4)) {
    return entry.solfeggio;
  }
  if (entry.ranges) {
    for (const r of entry.ranges) if (value < r.max) return r;
    return entry.ranges[entry.ranges.length - 1];
  }
  return entry;
}

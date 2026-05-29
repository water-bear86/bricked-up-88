type NoteName = string;

export interface ProceduralBar {
  chord: NoteName[];
  bassPattern: Array<number | null>;
  arpPattern: Array<number | null>;
  hiHatPattern: number[];
  stabPattern: number[];
  openHatPattern: number[];
  clapPattern: number[];
}

interface PhraseSeed {
  arpContour: number[];
  bassMotif: Array<number | null>;
  hatDensity: 'eighths' | 'sixteenths' | 'syncopated';
  stabAnchor: number;
  openHatStep: number;
}

interface OscillatorLayer {
  type: OscillatorType;
  detune: number;
  gain: number;
}

interface FilterShape {
  type: BiquadFilterType;
  frequency: number;
  q: number;
}

interface VoiceShape {
  oscillators: OscillatorLayer[];
  filter: FilterShape;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  gain: number;
}

export const SOUND_PALETTE: Record<
  'bass' | 'arp' | 'chordStab',
  VoiceShape
> = {
  bass: {
    oscillators: [
      { type: 'sawtooth', detune: -9, gain: 0.45 },
      { type: 'square', detune: 7, gain: 0.22 },
      { type: 'triangle', detune: -1200, gain: 0.24 },
    ],
    filter: { type: 'lowpass', frequency: 650, q: 8 },
    attack: 0.002,
    decay: 0.18,
    sustain: 0.1,
    release: 0.08,
    gain: 0.48,
  },
  arp: {
    oscillators: [
      { type: 'triangle', detune: 0, gain: 0.42 },
      { type: 'square', detune: 4, gain: 0.12 },
    ],
    filter: { type: 'bandpass', frequency: 1700, q: 1.4 },
    attack: 0.002,
    decay: 0.2,
    sustain: 0.05,
    release: 0.06,
    gain: 0.22,
  },
  chordStab: {
    oscillators: [
      { type: 'sawtooth', detune: -7, gain: 0.22 },
      { type: 'sawtooth', detune: 7, gain: 0.22 },
      { type: 'triangle', detune: 0, gain: 0.1 },
    ],
    filter: { type: 'lowpass', frequency: 2400, q: 5 },
    attack: 0.005,
    decay: 0.24,
    sustain: 0.09,
    release: 0.12,
    gain: 0.24,
  },
};

const PHRASE_LENGTH = 4;
const STEPS_PER_BAR = 16;
const BASS_SCALE_SIZE = 7;

const PROGRESSION_POOL: NoteName[][][] = [
  [
    ['C4', 'Eb4', 'G4', 'Bb4'],
    ['F3', 'Ab3', 'C4', 'Eb4'],
    ['G3', 'Bb3', 'D4', 'F4'],
    ['C4', 'Eb4', 'G4', 'Bb4'],
  ],
  [
    ['C4', 'Eb4', 'G4', 'Bb4'],
    ['Ab3', 'C4', 'Eb4', 'G4'],
    ['F3', 'Ab3', 'C4', 'Eb4'],
    ['G3', 'Bb3', 'D4', 'F4'],
  ],
  [
    ['Ab3', 'C4', 'Eb4', 'G4'],
    ['G3', 'Bb3', 'D4', 'F4'],
    ['F3', 'Ab3', 'C4', 'Eb4'],
    ['G3', 'Bb3', 'D4', 'F4'],
  ],
];

const EIGHTH_HATS = [0, 2, 4, 6, 8, 10, 12, 14];
const SIXTEENTH_HATS = Array.from({ length: STEPS_PER_BAR }, (_, index) => index);
const SYNCOPATED_HATS = [0, 2, 3, 6, 8, 10, 11, 14];

class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next() {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  int(maxExclusive: number) {
    return Math.floor(this.next() * maxExclusive);
  }

  chance(probability: number) {
    return this.next() < probability;
  }

  pick<T>(values: T[]) {
    return values[this.int(values.length)];
  }
}

export class ProceduralMusicGenerator {
  private readonly random: SeededRandom;
  private phraseBarIndex = 0;
  private currentProgression = PROGRESSION_POOL[0];
  private phraseSeed: PhraseSeed = {
    arpContour: [0, 1, 2, 1],
    bassMotif: Array(STEPS_PER_BAR).fill(null),
    hatDensity: 'eighths',
    stabAnchor: 6,
    openHatStep: 14,
  };

  constructor(seed = Date.now()) {
    this.random = new SeededRandom(seed);
  }

  public nextBar(): ProceduralBar {
    if (this.phraseBarIndex === 0) {
      this.refreshPhrase();
    }

    const chord = this.currentProgression[this.phraseBarIndex];
    const bar: ProceduralBar = {
      chord,
      bassPattern: this.createBassBar(this.phraseBarIndex),
      arpPattern: this.createArpBar(this.phraseBarIndex, chord.length),
      hiHatPattern: this.createHiHatBar(this.phraseBarIndex),
      stabPattern: this.createStabBar(this.phraseBarIndex),
      openHatPattern: this.createOpenHatBar(this.phraseBarIndex),
      clapPattern: this.createClapBar(this.phraseBarIndex),
    };

    this.phraseBarIndex = (this.phraseBarIndex + 1) % PHRASE_LENGTH;
    return bar;
  }

  private refreshPhrase() {
    this.currentProgression = this.random.pick(PROGRESSION_POOL);
    this.phraseSeed = {
      arpContour: this.createArpContour(),
      bassMotif: this.createBassMotif(),
      hatDensity: this.random.pick(['eighths', 'sixteenths', 'syncopated']),
      stabAnchor: this.random.pick([3, 6, 7, 11]),
      openHatStep: this.random.pick([11, 14, 15]),
    };
  }

  private createBassMotif() {
    const motif = Array<number | null>(STEPS_PER_BAR).fill(null);
    motif[0] = 0;

    for (const step of [2, 4, 6, 8, 10, 12, 14]) {
      if (this.random.chance(0.75)) {
        motif[step] = this.random.pick([0, 1, 2, 3, 4, 5]);
      }
    }

    if (this.random.chance(0.55)) {
      motif[7] = this.random.pick([null, 3, 4]);
    }

    if (this.random.chance(0.7)) {
      motif[15] = this.random.pick([null, 2, 4, 5]);
    }

    return motif;
  }

  private createArpContour() {
    const contour = [0];

    while (contour.length < 8) {
      const last = contour[contour.length - 1] ?? 0;
      const move = this.random.pick([-1, 1, 1, 2]);
      contour.push(Math.max(0, Math.min(3, last + move)));
    }

    return contour;
  }

  private createBassBar(barIndex: number) {
    const bar = [...this.phraseSeed.bassMotif];

    if (barIndex === 1) {
      this.swapSteps(bar, 6, 7);
      if (bar[10] !== null) {
        bar[10] = Math.min(BASS_SCALE_SIZE - 1, bar[10] + 1);
      }
    }

    if (barIndex === 2) {
      if (bar[4] !== null) {
        bar[4] = this.random.pick([4, 5, 6]);
      }
      bar[11] = this.random.pick([null, 2, 3, 5]);
    }

    if (barIndex === 3) {
      bar[12] = 0;
      bar[13] = this.random.pick([1, 2, null]);
      bar[14] = this.random.pick([3, 4, 5]);
      bar[15] = this.random.pick([4, 5, 6]);
    }

    return bar.map((degree, step) => {
      if (degree === null) {
        return step === 0 ? 0 : null;
      }

      return Math.max(0, Math.min(BASS_SCALE_SIZE - 1, degree));
    });
  }

  private createArpBar(barIndex: number, chordToneCount: number) {
    const bar = Array<number | null>(STEPS_PER_BAR).fill(null);
    const startOffset = barIndex % 2 === 0 ? 1 : 2;

    for (let step = startOffset; step < STEPS_PER_BAR; step += 2) {
      const contourIndex = (Math.floor(step / 2) + barIndex) % this.phraseSeed.arpContour.length;
      let note = this.phraseSeed.arpContour[contourIndex] % chordToneCount;

      if (barIndex === 1 && step % 4 === 2) {
        note = (note + 1) % chordToneCount;
      }

      if (barIndex === 2 && step % 8 === 6) {
        note = (note + chordToneCount - 1) % chordToneCount;
      }

      if (barIndex === 3 && step >= 10) {
        note = (note + 1) % chordToneCount;
      }

      bar[step] = note;
    }

    if (barIndex !== 0) {
      for (const step of [5, 13]) {
        if (this.random.chance(0.45)) {
          bar[step] = null;
        }
      }
    }

    return bar;
  }

  private createHiHatBar(barIndex: number) {
    const source =
      this.phraseSeed.hatDensity === 'sixteenths'
        ? SIXTEENTH_HATS
        : this.phraseSeed.hatDensity === 'syncopated'
          ? SYNCOPATED_HATS
          : EIGHTH_HATS;

    const pattern = [...source];

    if (barIndex === 2 && this.phraseSeed.hatDensity !== 'sixteenths') {
      pattern.push(11);
    }

    if (barIndex === 3) {
      pattern.push(15);
    }

    return Array.from(new Set(pattern)).sort((left, right) => left - right);
  }

  private createStabBar(barIndex: number) {
    const anchor = this.phraseSeed.stabAnchor;
    const pattern =
      barIndex === 0
        ? [anchor]
        : barIndex === 1
          ? [anchor, 14]
          : barIndex === 2
            ? [anchor - 1, anchor + 4]
            : [anchor, 12, 15];

    return pattern
      .map((step) => Math.max(0, Math.min(STEPS_PER_BAR - 1, step)))
      .filter((step, index, steps) => steps.indexOf(step) === index)
      .sort((left, right) => left - right);
  }

  private createOpenHatBar(barIndex: number) {
    return [
      barIndex === 3 ? 15 : this.phraseSeed.openHatStep,
    ].filter((step) => step >= 0 && step < STEPS_PER_BAR);
  }

  private createClapBar(barIndex: number) {
    const claps = [4, 12];

    if (barIndex === 3 && this.random.chance(0.6)) {
      claps.push(11);
    }

    return claps.sort((left, right) => left - right);
  }

  private swapSteps(pattern: Array<number | null>, left: number, right: number) {
    const nextPattern = pattern;
    const temp = nextPattern[left];
    nextPattern[left] = nextPattern[right];
    nextPattern[right] = temp;
  }
}

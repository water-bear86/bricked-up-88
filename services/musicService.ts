import {
  ProceduralMusicGenerator,
  SOUND_PALETTE,
} from './musicGenerator';

/**
 * A procedural music player using the Web Audio API.
 * Builds an 80s funk phrase one bar at a time instead of rotating fixed loops.
 */
export class MusicPlayer {
  private audioContext: AudioContext | null = null;
  private isPlaying = false;
  private masterGain: GainNode | null = null;
  private schedulerTimerId: number | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private clapBuffer: AudioBuffer | null = null;
  private generator = new ProceduralMusicGenerator();
  private currentBar = this.generator.nextBar();
  private shouldAdvanceBar = false;

  // Music state
  private nextNoteTime = 0.0;
  private current16thNote = 0;

  private static readonly BPM = 122;
  private static readonly LOOKAHEAD_MS = 25.0;
  private static readonly SCHEDULE_AHEAD_TIME_SEC = 0.1;
  private static readonly BASS_SCALE_INTERVALS = [0, 3, 5, 7, 10, 12, 15];

  constructor() {}

  private initialize() {
    if (this.audioContext) return;

    try {
      const Ctx = window.AudioContext || (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      this.audioContext = new Ctx();
      this.masterGain = this.audioContext.createGain();
      this.masterGain.connect(this.audioContext.destination);
      this.masterGain.gain.setValueAtTime(0.2, this.audioContext.currentTime);
      this.nextNoteTime = this.audioContext.currentTime;

      const bufferSize = this.audioContext.sampleRate;
      this.noiseBuffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
      const noiseOutput = this.noiseBuffer.getChannelData(0);
      for (let index = 0; index < bufferSize; index++) {
        noiseOutput[index] = Math.random() * 2 - 1;
      }

      this.clapBuffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
      const clapOutput = this.clapBuffer.getChannelData(0);
      for (let hit = 0; hit < 3; hit++) {
        const attack = Math.floor(hit * 340);
        for (let frame = 0; frame < 220; frame++) {
          clapOutput[attack + frame] =
            (Math.random() * 2 - 1) * (1 - frame / 220);
        }
      }
    } catch (error) {
      console.error('Could not create AudioContext.', error);
    }
  }

  private noteToFreq(note: string): number {
    const notes: Record<string, number> = {
      A: 9,
      'A#': 10,
      Bb: 10,
      B: 11,
      C: 0,
      'C#': 1,
      Db: 1,
      D: 2,
      'D#': 3,
      Eb: 3,
      E: 4,
      F: 5,
      'F#': 6,
      Gb: 6,
      G: 7,
      'G#': 8,
      Ab: 8,
    };
    const octave = parseInt(note.slice(-1), 10);
    const key = note.slice(0, -1);
    const semitone = notes[key];

    if (semitone === undefined) {
      console.error(`Invalid note: ${note}`);
      return 0;
    }

    return 440 * Math.pow(2, octave - 4 + (semitone - 9) / 12);
  }

  private getBassScaleForChord(chord: string[]) {
    const root = chord[0]?.slice(0, -1) ?? 'C';
    const rootFreq = this.noteToFreq(`${root}2`);

    return MusicPlayer.BASS_SCALE_INTERVALS.map(
      (interval) => rootFreq * Math.pow(2, interval / 12),
    );
  }

  private createVoice(
    time: number,
    palette: (typeof SOUND_PALETTE)[keyof typeof SOUND_PALETTE],
    frequency: number,
    duration: number,
  ) {
    if (!this.audioContext || !this.masterGain) {
      return;
    }

    const voiceGain = this.audioContext.createGain();
    const filter = this.audioContext.createBiquadFilter();
    filter.type = palette.filter.type;
    filter.frequency.setValueAtTime(palette.filter.frequency, time);
    filter.Q.setValueAtTime(palette.filter.q, time);
    voiceGain.connect(filter).connect(this.masterGain);

    const peakGain = palette.gain;
    const sustainGain = peakGain * palette.sustain;
    voiceGain.gain.setValueAtTime(0.001, time);
    voiceGain.gain.linearRampToValueAtTime(peakGain, time + palette.attack);
    voiceGain.gain.exponentialRampToValueAtTime(
      Math.max(0.001, sustainGain),
      time + palette.attack + palette.decay,
    );
    voiceGain.gain.exponentialRampToValueAtTime(
      0.001,
      time + duration + palette.release,
    );

    for (const layer of palette.oscillators) {
      const oscillator = this.audioContext.createOscillator();
      oscillator.type = layer.type;
      oscillator.frequency.setValueAtTime(frequency, time);
      oscillator.detune.setValueAtTime(layer.detune, time);

      const layerGain = this.audioContext.createGain();
      layerGain.gain.setValueAtTime(layer.gain, time);

      oscillator.connect(layerGain).connect(voiceGain);
      oscillator.start(time);
      oscillator.stop(time + duration + palette.release);
    }
  }

  private playKick = (time: number) => {
    if (!this.audioContext || !this.masterGain) return;
    const oscillator = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(140, time);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(120, time);
    oscillator.frequency.exponentialRampToValueAtTime(42, time + 0.16);

    gain.gain.setValueAtTime(1, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.28);

    oscillator.connect(gain).connect(filter).connect(this.masterGain);
    oscillator.start(time);
    oscillator.stop(time + 0.28);
  };

  private playClap = (time: number) => {
    if (!this.audioContext || !this.masterGain || !this.clapBuffer) return;
    const source = this.audioContext.createBufferSource();
    const gain = this.audioContext.createGain();
    const filter = this.audioContext.createBiquadFilter();

    source.buffer = this.clapBuffer;
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1550, time);
    filter.Q.setValueAtTime(0.8, time);
    gain.gain.setValueAtTime(0.55, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);

    source.connect(filter).connect(gain).connect(this.masterGain);
    source.start(time);
  };

  private playClosedHiHat = (time: number) => {
    if (!this.audioContext || !this.masterGain || !this.noiseBuffer) return;
    const source = this.audioContext.createBufferSource();
    const gain = this.audioContext.createGain();
    const filter = this.audioContext.createBiquadFilter();

    source.buffer = this.noiseBuffer;
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(6200, time);
    gain.gain.setValueAtTime(0.11, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);

    source.connect(filter).connect(gain).connect(this.masterGain);
    source.start(time);
    source.stop(time + 0.08);
  };

  private playOpenHiHat = (time: number) => {
    if (!this.audioContext || !this.masterGain || !this.noiseBuffer) return;
    const source = this.audioContext.createBufferSource();
    const gain = this.audioContext.createGain();
    const filter = this.audioContext.createBiquadFilter();

    source.buffer = this.noiseBuffer;
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(7600, time);
    gain.gain.setValueAtTime(0.18, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);

    source.connect(filter).connect(gain).connect(this.masterGain);
    source.start(time);
    source.stop(time + 0.22);
  };

  private playBassNote = (freq: number, time: number) => {
    this.createVoice(time, SOUND_PALETTE.bass, freq, 0.18);
  };

  private playArpNote = (note: string, time: number) => {
    this.createVoice(time, SOUND_PALETTE.arp, this.noteToFreq(note), 0.16);
  };

  private playChordStab = (chord: string[], time: number) => {
    for (const note of chord.slice(0, 3)) {
      this.createVoice(time, SOUND_PALETTE.chordStab, this.noteToFreq(note), 0.28);
    }
  };

  private scheduleNotes() {
    if (!this.audioContext) return;

    const secondsPer16th = (60 / MusicPlayer.BPM) / 4;

    while (
      this.nextNoteTime <
      this.audioContext.currentTime + MusicPlayer.SCHEDULE_AHEAD_TIME_SEC
    ) {
      const noteInBar = this.current16thNote % 16;

      if (noteInBar === 0 && this.shouldAdvanceBar) {
        this.currentBar = this.generator.nextBar();
        this.shouldAdvanceBar = false;
      }

      if (noteInBar % 4 === 0) {
        this.playKick(this.nextNoteTime);
      }

      if (this.currentBar.clapPattern.includes(noteInBar)) {
        this.playClap(this.nextNoteTime);
      }

      const hasOpenHat = this.currentBar.openHatPattern.includes(noteInBar);

      if (this.currentBar.hiHatPattern.includes(noteInBar) && !hasOpenHat) {
        this.playClosedHiHat(this.nextNoteTime);
      }

      if (hasOpenHat) {
        this.playOpenHiHat(this.nextNoteTime);
      }

      if (this.currentBar.stabPattern.includes(noteInBar)) {
        this.playChordStab(this.currentBar.chord, this.nextNoteTime);
      }

      const bassScale = this.getBassScaleForChord(this.currentBar.chord);
      const bassDegree = this.currentBar.bassPattern[noteInBar];
      if (bassDegree !== null && bassScale[bassDegree]) {
        this.playBassNote(bassScale[bassDegree], this.nextNoteTime);
      }

      const arpNoteIndex = this.currentBar.arpPattern[noteInBar];
      if (arpNoteIndex !== null) {
        const noteToPlay = this.currentBar.chord[arpNoteIndex];
        if (noteToPlay) {
          this.playArpNote(noteToPlay, this.nextNoteTime);
        }
      }

      this.nextNoteTime += secondsPer16th;
      this.current16thNote = (this.current16thNote + 1) % 16;
      if (this.current16thNote === 0) {
        this.shouldAdvanceBar = true;
      }
    }
  }

  private scheduler = () => {
    this.scheduleNotes();
    this.schedulerTimerId = window.setTimeout(
      this.scheduler,
      MusicPlayer.LOOKAHEAD_MS,
    );
  };

  public getAudioContext(): AudioContext | null {
    this.initialize();
    return this.audioContext;
  }

  public getMasterGain(): GainNode | null {
    this.initialize();
    return this.masterGain;
  }

  public play() {
    this.initialize();
    if (this.isPlaying || !this.audioContext) return;
    if (this.audioContext.state === 'suspended') {
      void this.audioContext.resume();
    }

    this.generator = new ProceduralMusicGenerator();
    this.currentBar = this.generator.nextBar();
    this.shouldAdvanceBar = false;
    this.isPlaying = true;
    this.current16thNote = 0;
    this.nextNoteTime = this.audioContext.currentTime;
    this.scheduler();
  }

  public stop() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    if (this.schedulerTimerId) clearTimeout(this.schedulerTimerId);
    this.schedulerTimerId = null;

    if (this.audioContext && this.masterGain) {
      this.masterGain.disconnect();
      this.masterGain = this.audioContext.createGain();
      this.masterGain.connect(this.audioContext.destination);
    }
  }

  public setMuted(mute: boolean) {
    if (!this.masterGain || !this.audioContext) return;
    const targetVolume = mute ? 0 : 0.2;
    this.masterGain.gain.linearRampToValueAtTime(
      targetVolume,
      this.audioContext.currentTime + 0.1,
    );
  }
}

import { describe, expect, it } from 'vitest';
import {
  ProceduralMusicGenerator,
  SOUND_PALETTE,
} from './musicGenerator';

describe('ProceduralMusicGenerator', () => {
  it('produces deterministic bars from the same seed', () => {
    const left = new ProceduralMusicGenerator(1988);
    const right = new ProceduralMusicGenerator(1988);

    const leftBars = Array.from({ length: 4 }, () => left.nextBar());
    const rightBars = Array.from({ length: 4 }, () => right.nextBar());

    expect(leftBars).toEqual(rightBars);
  });

  it('creates phrase variation instead of repeating the same bass and arp bars forever', () => {
    const generator = new ProceduralMusicGenerator(88);
    const bars = Array.from({ length: 4 }, () => generator.nextBar());

    const uniqueBassBars = new Set(
      bars.map((bar) => JSON.stringify(bar.bassPattern)),
    );
    const uniqueArpBars = new Set(
      bars.map((bar) => JSON.stringify(bar.arpPattern)),
    );

    expect(uniqueBassBars.size).toBeGreaterThan(1);
    expect(uniqueArpBars.size).toBeGreaterThan(1);
  });

  it('keeps generated note choices within valid pattern bounds', () => {
    const generator = new ProceduralMusicGenerator(1234);
    const bar = generator.nextBar();

    expect(bar.bassPattern).toHaveLength(16);
    expect(bar.arpPattern).toHaveLength(16);
    expect(bar.hiHatPattern.every((step) => step >= 0 && step < 16)).toBe(true);
    expect(bar.stabPattern.every((step) => step >= 0 && step < 16)).toBe(true);
    expect(
      bar.bassPattern.every(
        (degree) => degree === null || (degree >= 0 && degree <= 6),
      ),
    ).toBe(true);
    expect(
      bar.arpPattern.every(
        (chordToneIndex) =>
          chordToneIndex === null ||
          (chordToneIndex >= 0 && chordToneIndex < bar.chord.length),
      ),
    ).toBe(true);
  });
});

describe('SOUND_PALETTE', () => {
  it('defines a richer 80s palette with bass, arp, and chord stab layers', () => {
    expect(SOUND_PALETTE.bass.oscillators.length).toBeGreaterThan(1);
    expect(SOUND_PALETTE.arp.oscillators.length).toBeGreaterThan(1);
    expect(SOUND_PALETTE.chordStab.oscillators.length).toBeGreaterThan(1);
    expect(SOUND_PALETTE.chordStab.filter.frequency).toBeGreaterThan(500);
  });
});

import { describe, expect, it } from 'vitest';
import type { ActiveEffect, PowerupType } from '../types';
import {
  POWERUP_DEFINITIONS,
  getBallSpeedMultiplier,
  getPaddleWidth,
  pruneExpiredEffects,
  rollPowerupType,
  upsertTimedEffect,
} from './powerupRules';

describe('rollPowerupType', () => {
  it('skips drops when the chance roll misses', () => {
    expect(rollPowerupType(0.99, 0.1)).toBeNull();
  });

  it('keeps the weighted pool mostly positive', () => {
    const totals = Object.values(POWERUP_DEFINITIONS).reduce(
      (accumulator, definition) => {
        if (definition.positive) {
          accumulator.positive += definition.weight;
        } else {
          accumulator.negative += definition.weight;
        }
        return accumulator;
      },
      { positive: 0, negative: 0 },
    );

    expect(totals.positive).toBeGreaterThan(totals.negative);
  });

  it('maps deterministic rolls into known powerup types', () => {
    expect(rollPowerupType(0.1, 0.0)).toBe('expand');
    expect(rollPowerupType(0.1, 0.999)).toBe('overclock');
  });
});

describe('timed powerup effects', () => {
  it('refreshes the same effect and removes its opposing effect', () => {
    const effects: ActiveEffect[] = [
      { type: 'shrink', expiresAt: 1000 },
      { type: 'slow', expiresAt: 9000 },
    ];

    const nextEffects = upsertTimedEffect(effects, 'expand', 5000, 12000);

    expect(nextEffects).toContainEqual({ type: 'expand', expiresAt: 17000 });
    expect(nextEffects.some((effect) => effect.type === 'shrink')).toBe(false);
    expect(nextEffects).toContainEqual({ type: 'slow', expiresAt: 9000 });
  });

  it('prunes expired effects and derives paddle and ball modifiers', () => {
    const effects: ActiveEffect[] = [
      { type: 'expand', expiresAt: 1000 },
      { type: 'overclock', expiresAt: 9000 },
    ];

    const currentEffects = pruneExpiredEffects(effects, 5000);

    expect(currentEffects).toEqual([{ type: 'overclock', expiresAt: 9000 }]);
    expect(getPaddleWidth(120, currentEffects)).toBe(120);
    expect(getBallSpeedMultiplier(currentEffects)).toBeGreaterThan(1);
  });
});

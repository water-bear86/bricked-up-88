import { ActiveEffect, PowerupType } from '../types';

export const POWERUP_DROP_CHANCE = 0.28;

export const POWERUP_DEFINITIONS: Record<
  PowerupType,
  {
    color: string;
    durationMs?: number;
    glyph: string;
    label: string;
    positive: boolean;
    weight: number;
  }
> = {
  expand: {
    color: '#22d3ee',
    durationMs: 11000,
    glyph: 'W',
    label: 'WIDE',
    positive: true,
    weight: 26,
  },
  slow: {
    color: '#a3e635',
    durationMs: 9000,
    glyph: 'S',
    label: 'SLOW',
    positive: true,
    weight: 20,
  },
  multiball: {
    color: '#facc15',
    glyph: 'M',
    label: 'MULTI',
    positive: true,
    weight: 12,
  },
  extraLife: {
    color: '#fb7185',
    glyph: '+',
    label: 'LIFE',
    positive: true,
    weight: 6,
  },
  shrink: {
    color: '#c084fc',
    durationMs: 9000,
    glyph: '-',
    label: 'SHRINK',
    positive: false,
    weight: 12,
  },
  overclock: {
    color: '#f97316',
    durationMs: 8000,
    glyph: '!',
    label: 'FAST',
    positive: false,
    weight: 10,
  },
};

const POWERUP_ORDER: PowerupType[] = [
  'expand',
  'slow',
  'multiball',
  'extraLife',
  'shrink',
  'overclock',
];

const OPPOSING_EFFECTS: Record<ActiveEffect['type'], ActiveEffect['type']> = {
  expand: 'shrink',
  shrink: 'expand',
  slow: 'overclock',
  overclock: 'slow',
};

export const pruneExpiredEffects = (
  effects: ActiveEffect[],
  now: number,
): ActiveEffect[] => effects.filter((effect) => effect.expiresAt > now);

export const isTimedPowerupType = (
  type: PowerupType,
): type is ActiveEffect['type'] =>
  type === 'expand' ||
  type === 'slow' ||
  type === 'shrink' ||
  type === 'overclock';

export const upsertTimedEffect = (
  effects: ActiveEffect[],
  type: ActiveEffect['type'],
  now: number,
  durationMs: number,
) => {
  const prunedEffects = pruneExpiredEffects(effects, now);
  const opposingEffect = OPPOSING_EFFECTS[type];

  return [
    ...prunedEffects.filter(
      (effect) => effect.type !== type && effect.type !== opposingEffect,
    ),
    { type, expiresAt: now + durationMs },
  ];
};

export const getPaddleWidth = (
  baseWidth: number,
  effects: ActiveEffect[],
) => {
  const effectTypes = new Set(effects.map((effect) => effect.type));
  let nextWidth = baseWidth;

  if (effectTypes.has('expand')) {
    nextWidth *= 1.35;
  }

  if (effectTypes.has('shrink')) {
    nextWidth *= 0.72;
  }

  return Math.round(nextWidth);
};

export const getBallSpeedMultiplier = (effects: ActiveEffect[]) => {
  const effectTypes = new Set(effects.map((effect) => effect.type));
  let nextMultiplier = 1;

  if (effectTypes.has('slow')) {
    nextMultiplier *= 0.82;
  }

  if (effectTypes.has('overclock')) {
    nextMultiplier *= 1.2;
  }

  return nextMultiplier;
};

export const rollPowerupType = (
  dropRoll: number,
  typeRoll: number,
): PowerupType | null => {
  if (dropRoll >= POWERUP_DROP_CHANCE) {
    return null;
  }

  const totalWeight = POWERUP_ORDER.reduce(
    (sum, type) => sum + POWERUP_DEFINITIONS[type].weight,
    0,
  );
  let cursor = typeRoll * totalWeight;

  for (const type of POWERUP_ORDER) {
    cursor -= POWERUP_DEFINITIONS[type].weight;
    if (cursor < 0) {
      return type;
    }
  }

  return POWERUP_ORDER[POWERUP_ORDER.length - 1] ?? null;
};

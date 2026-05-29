export interface Ball {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  radius: number;
}

export interface Paddle {
  x: number;
  width: number;
  height: number;
}

export interface Brick {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  glowColor: string;
  status: 1 | 0;
}

export type PowerupType =
  | 'expand'
  | 'slow'
  | 'multiball'
  | 'extraLife'
  | 'shrink'
  | 'overclock';

export interface Powerup {
  id: number;
  type: PowerupType;
  x: number;
  y: number;
  dy: number;
  size: number;
}

export interface ActiveEffect {
  type: 'expand' | 'slow' | 'shrink' | 'overclock';
  expiresAt: number;
}

export interface ScoreEntry {
  rank: number;
  name: string;
  score: number;
}

export enum GameState {
  OpeningSequence,
  MainMenu,
  Playing,
  GameOver,
  SavingScore
}

export interface GameHandle {
  move: (direction: 'left' | 'right', pressed: boolean) => void;
}

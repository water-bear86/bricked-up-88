import { ScoreEntry } from '../types';

const LEADERBOARD_STORAGE_KEY = "bricked-up-88:leaderboard";
const MAX_LEADERBOARD_ENTRIES = 10;
const MAX_PLAYER_NAME_LENGTH = 8;

export const DEFAULT_LEADERBOARD: ScoreEntry[] = [
  { rank: 1, name: 'VPR', score: 9980 },
  { rank: 2, name: 'BLAZE', score: 8750 },
  { rank: 3, name: 'MAX_PWR', score: 8100 },
  { rank: 4, name: 'CYBER', score: 7650 },
  { rank: 5, name: 'GHOST', score: 6900 },
  { rank: 6, name: 'HAWK', score: 6230 },
  { rank: 7, name: 'NINJA', score: 5500 },
  { rank: 8, name: 'JAX', score: 4890 },
  { rank: 9, name: 'REPL', score: 4120 },
  { rank: 10, name: 'GRID', score: 3500 },
];

const cloneLeaderboard = (scores: ScoreEntry[]) =>
  scores.map((entry) => ({ ...entry }));

const normalizeName = (playerName: string) => {
  const normalized = playerName
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9!_-]/g, '')
    .slice(0, MAX_PLAYER_NAME_LENGTH);

  return normalized || 'YOU';
};

const normalizeScore = (score: number) => Math.max(0, Math.floor(score));

const isScoreEntry = (value: unknown): value is ScoreEntry => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const entry = value as Partial<ScoreEntry>;
  return (
    typeof entry.name === 'string' &&
    typeof entry.score === 'number' &&
    Number.isFinite(entry.score)
  );
};

const sanitizeLeaderboard = (scores: ScoreEntry[]) =>
  scores
    .filter(isScoreEntry)
    .map((entry) => ({
      rank: 0,
      name: normalizeName(entry.name),
      score: normalizeScore(entry.score),
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, MAX_LEADERBOARD_ENTRIES)
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));

const getStorage = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch (error) {
    console.error('Could not access local leaderboard storage:', error);
    return null;
  }
};

export const buildUpdatedLeaderboard = (
  playerName: string,
  playerScore: number,
  currentLeaderboard: ScoreEntry[],
) =>
  sanitizeLeaderboard([
    ...currentLeaderboard,
    {
      rank: 0,
      name: normalizeName(playerName),
      score: normalizeScore(playerScore),
    },
  ]);

// Keep the leaderboard API async so a hosted backend can replace localStorage later.
export const loadLeaderboard = async (): Promise<ScoreEntry[]> => {
  const storage = getStorage();

  if (!storage) {
    return cloneLeaderboard(DEFAULT_LEADERBOARD);
  }

  try {
    const storedLeaderboard = storage.getItem(LEADERBOARD_STORAGE_KEY);

    if (!storedLeaderboard) {
      return cloneLeaderboard(DEFAULT_LEADERBOARD);
    }

    const parsedLeaderboard = JSON.parse(storedLeaderboard);

    if (!Array.isArray(parsedLeaderboard)) {
      return cloneLeaderboard(DEFAULT_LEADERBOARD);
    }

    return sanitizeLeaderboard(parsedLeaderboard);
  } catch (error) {
    console.error('Could not load local leaderboard:', error);
    return cloneLeaderboard(DEFAULT_LEADERBOARD);
  }
};

export const submitScore = async (
  playerName: string,
  playerScore: number,
  currentLeaderboard: ScoreEntry[],
): Promise<ScoreEntry[]> => {
  const updatedLeaderboard = buildUpdatedLeaderboard(
    playerName,
    playerScore,
    currentLeaderboard,
  );
  const storage = getStorage();

  if (storage) {
    try {
      storage.setItem(
        LEADERBOARD_STORAGE_KEY,
        JSON.stringify(updatedLeaderboard),
      );
    } catch (error) {
      console.error('Could not save local leaderboard:', error);
    }
  }

  return updatedLeaderboard;
};

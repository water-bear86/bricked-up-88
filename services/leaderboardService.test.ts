import { describe, expect, it } from 'vitest';
import { buildUpdatedLeaderboard, DEFAULT_LEADERBOARD } from './leaderboardService';

describe('buildUpdatedLeaderboard', () => {
  it('inserts a qualifying score, trims the board, and re-ranks entries', () => {
    const updated = buildUpdatedLeaderboard('zoe', 9000, DEFAULT_LEADERBOARD);

    expect(updated).toHaveLength(10);
    expect(updated[0]).toMatchObject({ rank: 1, name: 'VPR', score: 9980 });
    expect(updated[1]).toMatchObject({ rank: 2, name: 'ZOE', score: 9000 });
    expect(updated[9]).toMatchObject({ rank: 10, name: 'REPL', score: 4120 });
  });

  it('drops non-qualifying scores and normalizes player names', () => {
    const updated = buildUpdatedLeaderboard('  low!  ', 100, DEFAULT_LEADERBOARD);

    expect(updated).toEqual(DEFAULT_LEADERBOARD);
  });
});

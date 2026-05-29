import React from 'react';
import { ScoreEntry } from '../types';

interface LeaderboardProps {
  scores: ScoreEntry[];
}

export default function Leaderboard({ scores }: LeaderboardProps) {
  return (
    <div 
      className="w-full p-2"
    >
      <h2 
        className="font-press-start text-2xl text-center text-yellow-400 mb-4" 
        style={{
          textShadow: '0 0 8px #facc15, 1px 1px 0 #713f12, 2px 2px 0 #713f12',
        }}
      >
        HIGH SCORES
      </h2>
      <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-lg">
        {scores.map((entry) => (
          <div 
            key={entry.rank} 
            className="flex justify-between items-baseline"
          >
            <span className="text-cyan-400 w-8" style={{textShadow: '0 0 5px #22d3ee'}}>{entry.rank.toString().padStart(2, ' ')}</span>
            <span className="text-white mx-2 flex-1 text-left font-semibold">{entry.name}</span>
            <span className="text-lime-400 font-mono tracking-tighter" style={{textShadow: '0 0 5px #a3e635'}}>{entry.score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
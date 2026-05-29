import React, { useState, useCallback, useEffect, useRef } from 'react';
import { GameState, ScoreEntry, GameHandle } from './types';
import Game from './components/Game';
import Leaderboard from './components/Leaderboard';
import {
  DEFAULT_LEADERBOARD,
  loadLeaderboard,
  submitScore,
} from './services/leaderboardService';
import OpeningAnimation from './components/OpeningAnimation';
import { MusicPlayer } from './services/musicService';

export default function App() {
  const [gameState, setGameState] = useState<GameState>(GameState.OpeningSequence);
  const [playStatus, setPlayStatus] = useState<'ready' | 'playing' | 'paused'>('ready');
  const [leaderboard, setLeaderboard] = useState<ScoreEntry[]>(DEFAULT_LEADERBOARD);
  const [finalScore, setFinalScore] = useState(0);
  const [playerName, setPlayerName] = useState("YOU");
  const [isMobile, setIsMobile] = useState(false);
  const [isPortrait, setIsPortrait] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const musicPlayerRef = useRef<MusicPlayer | null>(null);
  const gameRef = useRef<GameHandle>(null);

  if (musicPlayerRef.current === null) {
    musicPlayerRef.current = new MusicPlayer();
  }

  useEffect(() => {
    musicPlayerRef.current?.setMuted(isMuted);
  }, [isMuted]);

  useEffect(() => {
    let isMounted = true;

    loadLeaderboard().then((scores) => {
      if (isMounted) {
        setLeaderboard(scores);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const mobileCheck = typeof window.ontouchstart !== 'undefined';
    setIsMobile(mobileCheck);
    
    if (mobileCheck) {
      const mediaQuery = window.matchMedia("(orientation: portrait)");
      const handleOrientationChange = (e: MediaQueryListEvent) => setIsPortrait(e.matches);
      
      setIsPortrait(mediaQuery.matches);
      mediaQuery.addEventListener('change', handleOrientationChange);

      return () => mediaQuery.removeEventListener('change', handleOrientationChange);
    }
  }, []);

  const handleGameOver = useCallback((score: number) => {
    setFinalScore(score);
    setGameState(GameState.GameOver);
  }, []);
  
  const handleContinueFromOpening = () => {
    setGameState(GameState.MainMenu);
    musicPlayerRef.current?.play();
  };

  const toggleMute = () => {
    setIsMuted(prevMuted => !prevMuted);
  };

  const handleScoreSubmit = async () => {
    if (!playerName.trim()) {
        alert("Please enter a name.");
        return;
    }
    setGameState(GameState.SavingScore);
    const newLeaderboard = await submitScore(playerName, finalScore, leaderboard);
    setLeaderboard(newLeaderboard);
    setGameState(GameState.MainMenu);
  };

  const handleStartGame = () => {
    setGameState(GameState.Playing);
    setPlayStatus('ready');
  };

  const handleStartPauseClick = () => {
    if (playStatus === 'ready' || playStatus === 'paused') {
      setPlayStatus('playing');
    } else {
      setPlayStatus('paused');
    }
  };

  const getPlayButtonText = () => {
    if (playStatus === 'playing') return 'Pause';
    if (playStatus === 'paused') return 'Resume';
    return 'Start';
  };

  const renderGameArea = () => {
    switch (gameState) {
      case GameState.OpeningSequence:
        return <OpeningAnimation />;
      case GameState.Playing:
        return <Game 
                 ref={gameRef}
                 onGameOver={handleGameOver} 
                 musicPlayer={musicPlayerRef.current}
                 playStatus={playStatus}
                 onPlayStatusChange={setPlayStatus} 
               />;
      default:
        // Render a static background for menu states
        return <div className="absolute inset-0 bg-black/60 z-0"></div>;
    }
  };
  
  const renderUIOverlay = () => {
    switch (gameState) {
      case GameState.OpeningSequence:
        return (
          <div 
            className="absolute inset-0 bg-black/20 flex flex-col items-center justify-center z-10 cursor-pointer"
            onClick={handleContinueFromOpening}
          >
            <p className="font-press-start text-xl text-white/80 animate-pulse text-center" style={{textShadow: '0 0 10px #fff'}}>
                CLICK ANYWHERE TO CONTINUE
            </p>
          </div>
        );
      case GameState.GameOver:
        return (
            <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-20 backdrop-blur-sm p-4">
                <div className="w-full max-w-lg flex flex-col items-center gap-4">
                    <div className="text-center">
                        <h2 className="font-press-start text-4xl text-red-500" style={{ textShadow: '0 0 10px #f00, 1px 1px 0 #450a0a, 2px 2px 0 #450a0a, 3px 3px 0 #450a0a' }}>GAME OVER</h2>
                        <p className="mt-4 text-2xl text-white">FINAL SCORE: <span className="text-cyan-400" style={{ textShadow: '0 0 8px #0ff' }}>{finalScore}</span></p>
                    </div>
                    
                    <Leaderboard scores={leaderboard} />

                    <div className="flex flex-col items-center w-full max-w-xs">
                        <label htmlFor="playerName" className="text-xl text-white mb-2">ENTER YOUR NAME:</label>
                        <input
                            id="playerName"
                            type="text"
                            maxLength={8}
                            value={playerName}
                            onChange={(e) => setPlayerName(e.target.value.toUpperCase())}
                            className="bg-transparent border-2 border-purple-500 focus:border-cyan-400 focus:outline-none caret-cyan-400 text-cyan-400 text-center text-2xl w-full p-2 font-press-start"
                            style={{textShadow: '0 0 5px #0ff', boxShadow: 'inset 0 0 8px rgba(168, 85, 247, 0.6), 0 0 8px rgba(168, 85, 247, 0.6)'}}
                        />
                        <button
                            onClick={handleScoreSubmit}
                            className="mt-6 px-8 py-3 bg-transparent border-2 border-lime-500 text-lime-400 font-press-start text-lg hover:bg-lime-500/20 hover:-translate-y-1 transition-transform duration-200"
                            style={{
                                textShadow: '0 0 8px #a3e635',
                                boxShadow: '0 0 15px #a3e635'
                            }}
                        >
                            SUBMIT SCORE
                        </button>
                    </div>
                </div>
            </div>
        );

      case GameState.SavingScore:
        return (
            <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-20 backdrop-blur-sm" style={{ transform: 'perspective(800px) rotateX(15deg)', transformStyle: 'preserve-3d' }}>
                <h2 className="font-press-start text-3xl text-yellow-400 animate-pulse" style={{ textShadow: '0 0 10px #facc15' }}>
                    SAVING SCORE...
                </h2>
                <p className="mt-4 text-xl text-white">Updating the local cabinet records</p>
            </div>
        );
        
      case GameState.MainMenu:
        return (
          <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center z-10 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg flex flex-col items-center gap-6">
                <div className="text-center">
                    <div style={{ transform: 'perspective(600px) rotateX(30deg) translateY(-20px)', transformStyle: 'preserve-3d' }}>
                        <h1 className="font-press-start text-4xl md:text-5xl text-cyan-400" style={{textShadow: '0 0 15px #22d3ee, 0 0 25px #22d3ee, 1px 1px 0px #155e75, 2px 2px 0px #155e75, 3px 3px 0px #155e75, 4px 4px 0px #155e75, 5px 5px 0px #155e75' }}>
                          BRICKED UP!
                        </h1>
                        <h2 className="font-press-start text-4xl md:text-6xl text-pink-500 mt-2" style={{textShadow: '0 0 15px #ec4899, 0 0 25px #ec4899, 1px 1px 0px #831843, 2px 2px 0px #831843, 3px 3px 0px #831843, 4px 4px 0px #831843, 5px 5px 0px #831843' }}>
                          <center>'88</center>
                        </h2>
                    </div>
                </div>
                
                <Leaderboard scores={leaderboard} />
                
                <div className="flex flex-col items-center">
                  <button
                    onClick={handleStartGame}
                    className="px-10 py-4 bg-transparent border-2 border-purple-500 text-purple-400 font-press-start text-xl hover:bg-purple-500/20 hover:-translate-y-1 transition-all duration-200"
                    style={{
                      textShadow: '0 0 8px #c084fc, 0 0 15px #c084fc',
                      boxShadow: '0 0 20px #a855f7, inset 0 0 10px #a855f7',
                    }}
                  >
                    START GAME
                  </button>
                  <p className="mt-4 text-purple-300/80 text-sm" style={{ textShadow: '0 0 4px #c084fc' }}>
                      Use On-Screen Buttons or Arrow Keys to Move
                  </p>
                </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <main className="bg-black text-white min-h-screen flex flex-col items-center justify-center p-4 overflow-hidden relative selection:bg-pink-500 selection:text-white"
        style={{
            backgroundImage: 'radial-gradient(rgba(107, 33, 168, 0.3) 0.5px, transparent 0.5px), radial-gradient(rgba(107, 33, 168, 0.3) 0.5px, #000 0.5px)',
            backgroundSize: '20px 20px',
            backgroundPosition: '0 0, 10px 10px',
        }}
    >
      {isMobile && isPortrait && (
        <div className="absolute inset-0 bg-black flex flex-col items-center justify-center z-50 text-center p-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24 text-purple-400 mb-4 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <h2 className="font-press-start text-xl text-white">PLEASE ROTATE YOUR DEVICE</h2>
          <p className="mt-2 text-purple-300">This experience is designed for landscape mode.</p>
        </div>
      )}
      <div className="w-full max-w-4xl mx-auto flex flex-col items-center" style={{ perspective: '1200px' }}>
        <div className="relative w-full aspect-video max-w-4xl border-2 border-purple-800" style={{boxShadow: 'inset 0 0 20px 5px rgba(76, 29, 149, 0.7), 0 0 20px rgba(76, 29, 149, 0.5)'}}>
            <div className="absolute inset-0 pointer-events-none" style={{
                background: 'linear-gradient(rgba(18, 18, 18, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.03), rgba(0, 255, 0, 0.02), rgba(0, 0,255, 0.03))',
                backgroundSize: '100% 4px, 3px 100%',
            }}></div>

            {renderGameArea()}
            {renderUIOverlay()}
            
             {gameState !== GameState.OpeningSequence && (
                <button
                    onClick={toggleMute}
                    className="absolute top-3 right-3 z-30 p-2 text-purple-400/60 hover:text-white transition-colors"
                    aria-label={isMuted ? "Unmute Music" : "Mute Music"}
                    style={{ backdropFilter: 'blur(2px)'}}
                >
                    {isMuted ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                        </svg>
                    )}
                </button>
            )}
        </div>
        
        {gameState === GameState.Playing && (
          <div className="w-full max-w-4xl mt-3 p-2 rounded-b-lg flex justify-around items-center"
               style={{background: 'rgba(15, 23, 42, 0.4)', border: '1px solid #4c1d95', borderTop: 'none', boxShadow: '0 10px 15px -5px rgba(0,0,0,0.5)'}}
          >
            <button
              className="px-8 py-3 bg-purple-500/20 active:bg-purple-500/40 border-2 border-purple-500 text-purple-300 font-press-start text-lg transition-colors select-none"
              style={{textShadow: '0 0 5px #c084fc', boxShadow: '0 0 10px #a855f7'}}
              onPointerDown={() => gameRef.current?.move('left', true)}
              onPointerUp={() => gameRef.current?.move('left', false)}
              onPointerLeave={() => gameRef.current?.move('left', false)}
              onContextMenu={(e) => e.preventDefault()}
            >
              Left
            </button>
            <button
              className="px-8 py-3 bg-lime-500/20 active:bg-lime-500/40 border-2 border-lime-500 text-lime-300 font-press-start text-lg transition-colors select-none"
              style={{textShadow: '0 0 5px #a3e635', boxShadow: '0 0 10px #a3e635'}}
              onClick={handleStartPauseClick}
            >
              {getPlayButtonText()}
            </button>
            <button
              className="px-8 py-3 bg-cyan-500/20 active:bg-cyan-500/40 border-2 border-cyan-500 text-cyan-300 font-press-start text-lg transition-colors select-none"
              style={{textShadow: '0 0 5px #22d3ee', boxShadow: '0 0 10px #22d3ee'}}
              onPointerDown={() => gameRef.current?.move('right', true)}
              onPointerUp={() => gameRef.current?.move('right', false)}
              onPointerLeave={() => gameRef.current?.move('right', false)}
              onContextMenu={(e) => e.preventDefault()}
            >
              Right
            </button>
          </div>
        )}
      </div>
      <footer className="absolute bottom-2 text-center text-purple-400/50 text-sm">
        <p>A retro-futuristic arcade experience.</p>
      </footer>
    </main>
  );
}

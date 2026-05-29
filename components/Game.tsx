import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  ActiveEffect,
  Ball,
  Brick,
  GameHandle,
  Paddle,
  Powerup,
  PowerupType,
} from '../types';
import { MusicPlayer } from '../services/musicService';
import {
  getBallSpeedMultiplier,
  getPaddleWidth,
  isTimedPowerupType,
  POWERUP_DEFINITIONS,
  pruneExpiredEffects,
  rollPowerupType,
  upsertTimedEffect,
} from '../services/powerupRules';

interface GameProps {
  onGameOver: (score: number) => void;
  musicPlayer: MusicPlayer | null;
  playStatus: 'ready' | 'playing' | 'paused';
  onPlayStatusChange: (status: 'ready' | 'playing' | 'paused') => void;
}

const VIEW_WIDTH = 800;
const VIEW_HEIGHT = 600;

const HORIZON_Y = VIEW_HEIGHT * 0.25;
const NEAR_PLANE_Z = 1.0;
const FAR_PLANE_Z = 0.4;

const PADDLE_BASE_WIDTH = 120;
const PADDLE_HEIGHT = 15;
const PADDLE_DEPTH = 10;
const PADDLE_Y = VIEW_HEIGHT - 60;
const PADDLE_ACCELERATION = 0.25;
const PADDLE_FRICTION = 0.92;
const PADDLE_MAX_SPEED = 10;

const BALL_RADIUS = 8;
const BALL_INITIAL_SPEED_Y = -2.2;
const BALL_MAX_SPEED_X = 3;

const POWERUP_SIZE = 26;
const POWERUP_FALL_SPEED = 2.35;
const MAX_LIVES = 9;

const BRICK_COLS = 10;
const BRICK_WIDTH = 75;
const BRICK_HEIGHT = 20;
const BRICK_DEPTH = 10;
const BRICK_PADDING = 5;
const BRICK_OFFSET_TOP = HORIZON_Y + 50;
const BRICK_OFFSET_LEFT =
  (VIEW_WIDTH - BRICK_COLS * (BRICK_WIDTH + BRICK_PADDING) + BRICK_PADDING) / 2;

const BRICK_COLORS = [
  { main: '#ec4899', top: '#be185d', glow: 'drop-shadow-[0_0_6px_#ec4899]' },
  { main: '#f97316', top: '#c2410c', glow: 'drop-shadow-[0_0_6px_#f97316]' },
  { main: '#facc15', top: '#ca8a04', glow: 'drop-shadow-[0_0_6px_#facc15]' },
  { main: '#a3e635', top: '#65a30d', glow: 'drop-shadow-[0_0_6px_#a3e635]' },
  { main: '#22c55e', top: '#15803d', glow: 'drop-shadow-[0_0_6px_#22c55e]' },
  { main: '#22d3ee', top: '#0e7490', glow: 'drop-shadow-[0_0_6px_#22d3ee]' },
  { main: '#8b5cf6', top: '#5b21b6', glow: 'drop-shadow-[0_0_6px_#8b5cf6]' },
];

const ACTIVE_EFFECT_ORDER: ActiveEffect['type'][] = [
  'expand',
  'slow',
  'shrink',
  'overclock',
];

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const playBrickHitSound = (context: AudioContext, masterGain: GainNode) => {
  const time = context.currentTime;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(880 + Math.random() * 440, time);
  gain.gain.setValueAtTime(0.3, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
  oscillator.connect(gain).connect(masterGain);
  oscillator.start(time);
  oscillator.stop(time + 0.15);
};

const playPaddleHitSound = (context: AudioContext, masterGain: GainNode) => {
  const time = context.currentTime;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = 'square';
  oscillator.frequency.setValueAtTime(110, time);
  gain.gain.setValueAtTime(0.4, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
  oscillator.connect(gain).connect(masterGain);
  oscillator.start(time);
  oscillator.stop(time + 0.2);
};

const playLoseLifeSound = (context: AudioContext, masterGain: GainNode) => {
  const time = context.currentTime;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = 'sawtooth';
  oscillator.frequency.setValueAtTime(440, time);
  oscillator.frequency.exponentialRampToValueAtTime(110, time + 0.5);
  gain.gain.setValueAtTime(0.4, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.5);
  oscillator.connect(gain).connect(masterGain);
  oscillator.start(time);
  oscillator.stop(time + 0.5);
};

const playLevelUpSound = (context: AudioContext, masterGain: GainNode) => {
  const time = context.currentTime;
  const mainGain = context.createGain();
  mainGain.gain.setValueAtTime(0.3, time);
  mainGain.connect(masterGain);

  const notes = [261.63, 329.63, 392.0, 523.25];
  notes.forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.001, time + index * 0.1);
    gain.gain.linearRampToValueAtTime(1, time + index * 0.1 + 0.02);
    gain.gain.linearRampToValueAtTime(0.001, time + index * 0.1 + 0.15);
    oscillator.connect(gain).connect(mainGain);
    oscillator.start(time + index * 0.1);
    oscillator.stop(time + index * 0.1 + 0.15);
  });
};

const playPositivePowerupSound = (context: AudioContext, masterGain: GainNode) => {
  const time = context.currentTime;
  [523.25, 659.25, 783.99].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(frequency, time + index * 0.04);
    gain.gain.setValueAtTime(0.001, time + index * 0.04);
    gain.gain.linearRampToValueAtTime(0.22, time + index * 0.04 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, time + index * 0.04 + 0.22);
    oscillator.connect(gain).connect(masterGain);
    oscillator.start(time + index * 0.04);
    oscillator.stop(time + index * 0.04 + 0.24);
  });
};

const playNegativePowerupSound = (context: AudioContext, masterGain: GainNode) => {
  const time = context.currentTime;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = 'sawtooth';
  oscillator.frequency.setValueAtTime(260, time);
  oscillator.frequency.exponentialRampToValueAtTime(130, time + 0.24);
  gain.gain.setValueAtTime(0.22, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.24);
  oscillator.connect(gain).connect(masterGain);
  oscillator.start(time);
  oscillator.stop(time + 0.24);
};

const playMultiballSound = (context: AudioContext, masterGain: GainNode) => {
  const time = context.currentTime;
  [392.0, 523.25, 659.25, 783.99].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(frequency, time + index * 0.05);
    gain.gain.setValueAtTime(0.001, time + index * 0.05);
    gain.gain.linearRampToValueAtTime(0.18, time + index * 0.05 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, time + index * 0.05 + 0.18);
    oscillator.connect(gain).connect(masterGain);
    oscillator.start(time + index * 0.05);
    oscillator.stop(time + index * 0.05 + 0.2);
  });
};

const createBricks = (level: number): Brick[] => {
  const bricks: Brick[] = [];
  const brickRows = Math.min(8, Math.round(3 + (level - 1) * (5 / 9)));
  const startCol = level >= 6 ? 0 : 1;
  const endCol = level >= 8 ? BRICK_COLS : BRICK_COLS - 1;

  for (let column = startCol; column < endCol; column++) {
    for (let row = 0; row < brickRows; row++) {
      const brickX = column * (BRICK_WIDTH + BRICK_PADDING) + BRICK_OFFSET_LEFT;
      const brickY = row * (BRICK_HEIGHT + BRICK_PADDING) + BRICK_OFFSET_TOP;
      bricks.push({
        x: brickX,
        y: brickY,
        width: BRICK_WIDTH,
        height: BRICK_HEIGHT,
        color: '',
        glowColor: '',
        status: 1,
      });
    }
  }

  return bricks;
};

const getInitialBallState = (level: number, id: number): Ball => {
  const speedMultiplier = Math.min(1.33, 1 + ((level - 1) / 9) * 0.33);
  const ballInitialDy = BALL_INITIAL_SPEED_Y * speedMultiplier;
  const ballMaxSpeedX = BALL_MAX_SPEED_X * speedMultiplier;

  return {
    id,
    x: VIEW_WIDTH / 2,
    y: PADDLE_Y - PADDLE_DEPTH - BALL_RADIUS - 5,
    dx: (Math.random() - 0.5) * ballMaxSpeedX,
    dy: ballInitialDy,
    radius: BALL_RADIUS,
  };
};

const createPowerupDrop = (type: PowerupType, brick: Brick, id: number): Powerup => ({
  id,
  type,
  x: brick.x + brick.width / 2,
  y: brick.y + brick.height / 2,
  dy: POWERUP_FALL_SPEED,
  size: POWERUP_SIZE,
});

const createSplitBalls = (sourceBall: Ball, nextBallId: () => number): Ball[] => {
  const horizontalSpeed = Math.max(Math.abs(sourceBall.dx), 1.5);
  const upwardSpeed = -Math.max(Math.abs(sourceBall.dy), 2.2);

  return [
    {
      ...sourceBall,
      id: nextBallId(),
      dx: -horizontalSpeed,
      dy: upwardSpeed,
    },
    {
      ...sourceBall,
      id: nextBallId(),
      dx: horizontalSpeed,
      dy: upwardSpeed * 0.96,
    },
  ];
};

const project = (xWorld: number, yWorld: number) => {
  const perspectiveFactor = (yWorld - HORIZON_Y) / (VIEW_HEIGHT - HORIZON_Y);
  const scale = FAR_PLANE_Z + perspectiveFactor * (NEAR_PLANE_Z - FAR_PLANE_Z);
  const screenX = (xWorld - VIEW_WIDTH / 2) * scale + VIEW_WIDTH / 2;
  return { x: screenX, y: yWorld, scale };
};

const FloorGrid = () => {
  const lines = [];
  const numLines = 20;

  for (let index = 0; index <= numLines; index++) {
    const y = HORIZON_Y + (index / numLines) * (VIEW_HEIGHT - HORIZON_Y);
    const { x: x1, scale } = project(0, y);
    const { x: x2 } = project(VIEW_WIDTH, y);
    lines.push(
      <line
        key={`h-${index}`}
        x1={x1}
        y1={y}
        x2={x2}
        y2={y}
        stroke="#a855f7"
        strokeOpacity={0.2 * scale}
      />,
    );
  }

  for (let index = 0; index <= numLines; index++) {
    const xWorld = (index / numLines) * VIEW_WIDTH;
    const { x: x1 } = project(xWorld, HORIZON_Y);
    const { x: x2 } = project(xWorld, VIEW_HEIGHT);
    lines.push(
      <line
        key={`v-${index}`}
        x1={x1}
        y1={HORIZON_Y}
        x2={x2}
        y2={VIEW_HEIGHT}
        stroke="#a855f7"
        strokeOpacity={0.3}
      />,
    );
  }

  return <g>{lines}</g>;
};

const Brick3D = ({ brick }: { brick: Brick }) => {
  const totalRowsForColors = 8;
  const colorIndex =
    Math.floor((brick.y - BRICK_OFFSET_TOP) / (BRICK_HEIGHT + BRICK_PADDING)) %
    totalRowsForColors %
    BRICK_COLORS.length;
  const colors = BRICK_COLORS[colorIndex];
  const topY = brick.y;
  const pTop = project(0, topY);
  const thickness = BRICK_DEPTH * pTop.scale;
  const pTl = project(brick.x, topY);
  const pTr = project(brick.x + brick.width, topY);
  const pBl = project(brick.x, brick.y + brick.height);
  const pBr = project(brick.x + brick.width, brick.y + brick.height);
  const frontFacePoints = `${pBl.x},${pBl.y} ${pBr.x},${pBr.y} ${pTr.x},${pTr.y} ${pTl.x},${pTl.y}`;
  const topFacePoints = `${pTl.x},${pTl.y} ${pTr.x},${pTr.y} ${pTr.x},${pTr.y - thickness} ${pTl.x},${pTl.y - thickness}`;

  return (
    <g className={colors.glow}>
      <polygon points={topFacePoints} fill="none" stroke={colors.top} strokeWidth="1.5" />
      <polygon points={frontFacePoints} fill="none" stroke={colors.main} strokeWidth="1.5" />
    </g>
  );
};

const PowerupDropSprite = ({ powerup }: { powerup: Powerup }) => {
  const definition = POWERUP_DEFINITIONS[powerup.type];
  const projected = project(powerup.x, powerup.y);
  const size = Math.max(16, powerup.size * projected.scale);
  const half = size / 2;

  return (
    <g
      transform={`translate(${projected.x}, ${projected.y})`}
      style={{ filter: `drop-shadow(0 0 8px ${definition.color})` }}
    >
      <polygon
        points={`0,${-half} ${half},0 0,${half} ${-half},0`}
        fill="rgba(0, 0, 0, 0.18)"
        stroke={definition.color}
        strokeWidth="2"
      />
      <text
        x="0"
        y={size * 0.18}
        fill={definition.color}
        fontFamily="'Press Start 2P', monospace"
        fontSize={Math.max(8, size * 0.28)}
        textAnchor="middle"
      >
        {definition.glyph}
      </text>
    </g>
  );
};

const Game = forwardRef<GameHandle, GameProps>(
  ({ onGameOver, musicPlayer, playStatus, onPlayStatusChange }, ref) => {
    const nextBallId = useRef(1);
    const nextPowerupId = useRef(1);
    const [paddle, setPaddle] = useState<Paddle>({
      x: (VIEW_WIDTH - PADDLE_BASE_WIDTH) / 2,
      width: PADDLE_BASE_WIDTH,
      height: PADDLE_HEIGHT,
    });
    const [paddleVelocity, setPaddleVelocity] = useState(0);
    const [level, setLevel] = useState(1);
    const [balls, setBalls] = useState<Ball[]>(() => [
      getInitialBallState(1, nextBallId.current++),
    ]);
    const [bricks, setBricks] = useState<Brick[]>(() => createBricks(1));
    const [score, setScore] = useState(0);
    const [lives, setLives] = useState(3);
    const [powerups, setPowerups] = useState<Powerup[]>([]);
    const [activeEffects, setActiveEffects] = useState<ActiveEffect[]>([]);
    const [levelStartTime, setLevelStartTime] = useState(0);
    const [showLevelUp, setShowLevelUp] = useState(false);

    const gameStatus = playStatus;
    const setGameStatus = onPlayStatusChange;

    const keysPressed = useRef<{ [key: string]: boolean }>({});
    const animationFrameId = useRef<number | null>(null);

    const audioContext = musicPlayer?.getAudioContext() ?? null;
    const masterGain = musicPlayer?.getMasterGain() ?? null;

    const nextBall = () => nextBallId.current++;
    const nextPowerup = () => nextPowerupId.current++;

    useImperativeHandle(ref, () => ({
      move(direction: 'left' | 'right', pressed: boolean) {
        const key = direction === 'left' ? 'ArrowLeft' : 'ArrowRight';
        keysPressed.current[key] = pressed;
      },
    }));

    const sfx = useCallback(
      (soundGenerator: (ctx: AudioContext, gain: GainNode) => void) => {
        if (audioContext && masterGain) {
          soundGenerator(audioContext, masterGain);
        }
      },
      [audioContext, masterGain],
    );

    const resetBallAndPaddle = useCallback(
      (currentLevel: number, clearTransientState = false) => {
        setBalls([getInitialBallState(currentLevel, nextBall())]);
        setPaddle((currentPaddle) => ({
          ...currentPaddle,
          x: clamp(
            (VIEW_WIDTH - currentPaddle.width) / 2,
            0,
            VIEW_WIDTH - currentPaddle.width,
          ),
        }));
        setPaddleVelocity(0);
        if (clearTransientState) {
          setPowerups([]);
          setActiveEffects([]);
        }
        setGameStatus('ready');
      },
      [setGameStatus],
    );

    useEffect(() => {
      setBricks(createBricks(level));
      setPowerups([]);
      resetBallAndPaddle(level);
      setLevelStartTime(Date.now());

      if (level > 1) {
        setShowLevelUp(true);
        sfx(playLevelUpSound);
        const timer = setTimeout(() => setShowLevelUp(false), 2000);
        return () => clearTimeout(timer);
      }
    }, [level, resetBallAndPaddle, sfx]);

    useEffect(() => {
      const targetWidth = getPaddleWidth(PADDLE_BASE_WIDTH, activeEffects);
      setPaddle((currentPaddle) => {
        if (currentPaddle.width === targetWidth) {
          return currentPaddle;
        }

        const center = currentPaddle.x + currentPaddle.width / 2;
        return {
          ...currentPaddle,
          width: targetWidth,
          x: clamp(center - targetWidth / 2, 0, VIEW_WIDTH - targetWidth),
        };
      });
    }, [activeEffects]);

    const gameLoop = useCallback(() => {
      const now = Date.now();
      let currentEffects = pruneExpiredEffects(activeEffects, now);
      if (currentEffects.length !== activeEffects.length) {
        setActiveEffects(currentEffects);
      }

      if (showLevelUp) {
        animationFrameId.current = requestAnimationFrame(gameLoop);
        return;
      }

      let newPaddle = { ...paddle };
      let newBalls = balls.map((ball) => ({ ...ball }));
      let newBricks = [...bricks];
      let newPowerups = powerups.map((powerup) => ({ ...powerup }));
      let newScore = score;
      let newLives = lives;
      let newPaddleVelocity = paddleVelocity;

      const speedMultiplier = getBallSpeedMultiplier(currentEffects);
      const leftPressed = keysPressed.current['ArrowLeft'];
      const rightPressed = keysPressed.current['ArrowRight'];

      if (leftPressed) {
        newPaddleVelocity -= PADDLE_ACCELERATION;
      }
      if (rightPressed) {
        newPaddleVelocity += PADDLE_ACCELERATION;
      }
      if ((!leftPressed && !rightPressed) || (leftPressed && rightPressed)) {
        newPaddleVelocity *= PADDLE_FRICTION;
      }

      newPaddleVelocity = clamp(
        newPaddleVelocity,
        -PADDLE_MAX_SPEED,
        PADDLE_MAX_SPEED,
      );
      newPaddle.x += newPaddleVelocity;
      newPaddle.x = clamp(newPaddle.x, 0, VIEW_WIDTH - newPaddle.width);

      if (gameStatus !== 'playing') {
        if (gameStatus === 'ready' && newBalls[0]) {
          newBalls[0] = {
            ...newBalls[0],
            x: newPaddle.x + newPaddle.width / 2,
            y: PADDLE_Y - PADDLE_DEPTH - BALL_RADIUS - 5,
          };
        }

        setBalls(newBalls);
        setPaddle(newPaddle);
        setPaddleVelocity(newPaddleVelocity);
        animationFrameId.current = requestAnimationFrame(gameLoop);
        return;
      }

      const survivingBalls: Ball[] = [];
      const spawnedPowerups: Powerup[] = [];

      for (const ballState of newBalls) {
        const currentBall = { ...ballState };
        const effectiveDx = currentBall.dx * speedMultiplier;
        const effectiveDy = currentBall.dy * speedMultiplier;

        currentBall.x += effectiveDx;
        currentBall.y += effectiveDy;

        if (
          currentBall.x > VIEW_WIDTH - currentBall.radius ||
          currentBall.x < currentBall.radius
        ) {
          currentBall.dx = -currentBall.dx;
          currentBall.x = clamp(
            currentBall.x,
            currentBall.radius,
            VIEW_WIDTH - currentBall.radius,
          );
          sfx(playPaddleHitSound);
        }

        if (currentBall.y < HORIZON_Y + currentBall.radius) {
          currentBall.y = HORIZON_Y + currentBall.radius;
          currentBall.dy = -currentBall.dy;
          sfx(playPaddleHitSound);
        }

        if (
          currentBall.dy > 0 &&
          currentBall.y + currentBall.radius >= PADDLE_Y &&
          currentBall.y - currentBall.radius <= PADDLE_Y + PADDLE_HEIGHT &&
          currentBall.x + currentBall.radius > newPaddle.x &&
          currentBall.x - currentBall.radius < newPaddle.x + newPaddle.width
        ) {
          currentBall.y = PADDLE_Y - currentBall.radius;
          currentBall.dy = -Math.abs(currentBall.dy);
          sfx(playPaddleHitSound);

          const deltaX = currentBall.x - (newPaddle.x + newPaddle.width / 2);
          const updatedDx = deltaX * 0.08;
          const levelSpeedMultiplier = Math.min(1.33, 1 + ((level - 1) / 9) * 0.33);
          const ballMaxSpeedX = BALL_MAX_SPEED_X * levelSpeedMultiplier;
          currentBall.dx = clamp(updatedDx, -ballMaxSpeedX, ballMaxSpeedX);
        }

        for (let brickIndex = 0; brickIndex < newBricks.length; brickIndex++) {
          const brick = newBricks[brickIndex];
          if (brick.status !== 1) {
            continue;
          }

          if (
            currentBall.x + currentBall.radius > brick.x &&
            currentBall.x - currentBall.radius < brick.x + brick.width &&
            currentBall.y + currentBall.radius > brick.y &&
            currentBall.y - currentBall.radius < brick.y + brick.height
          ) {
            newBricks[brickIndex] = { ...brick, status: 0 };
            sfx(playBrickHitSound);

            const timeElapsedSeconds = (now - levelStartTime) / 1000;
            const timeBonus = Math.floor(Math.max(0, 50 - timeElapsedSeconds));
            const pointsPerBrick = 10 + timeBonus;
            newScore += pointsPerBrick;

            const prevBallY = currentBall.y - effectiveDy;
            const verticalHit =
              (prevBallY + currentBall.radius <= brick.y &&
                currentBall.y + currentBall.radius > brick.y) ||
              (prevBallY - currentBall.radius >= brick.y + brick.height &&
                currentBall.y - currentBall.radius < brick.y + brick.height);

            if (verticalHit) {
              currentBall.dy = -currentBall.dy;
            } else {
              currentBall.dx = -currentBall.dx;
            }

            const powerupType = rollPowerupType(Math.random(), Math.random());
            if (powerupType) {
              spawnedPowerups.push(
                createPowerupDrop(powerupType, brick, nextPowerup()),
              );
            }
          }
        }

        if (currentBall.y <= VIEW_HEIGHT - currentBall.radius) {
          survivingBalls.push(currentBall);
        }
      }

      newPowerups = [...newPowerups, ...spawnedPowerups]
        .map((powerup) => ({ ...powerup, y: powerup.y + powerup.dy }))
        .filter((powerup) => powerup.y - powerup.size / 2 <= VIEW_HEIGHT + powerup.size);

      const collectedTypes: PowerupType[] = [];
      newPowerups = newPowerups.filter((powerup) => {
        const caught =
          powerup.y + powerup.size / 2 >= PADDLE_Y &&
          powerup.y - powerup.size / 2 <= PADDLE_Y + PADDLE_HEIGHT + PADDLE_DEPTH &&
          powerup.x >= newPaddle.x &&
          powerup.x <= newPaddle.x + newPaddle.width;

        if (caught) {
          collectedTypes.push(powerup.type);
          return false;
        }

        return true;
      });

      for (const type of collectedTypes) {
        const definition = POWERUP_DEFINITIONS[type];

        if (type === 'extraLife') {
          newLives = Math.min(MAX_LIVES, newLives + 1);
          sfx(playPositivePowerupSound);
          continue;
        }

        if (type === 'multiball') {
          const sourceBall = survivingBalls[0];
          if (sourceBall) {
            survivingBalls.push(...createSplitBalls(sourceBall, nextBall));
            sfx(playMultiballSound);
          }
          continue;
        }

        if (isTimedPowerupType(type) && definition.durationMs) {
          currentEffects = upsertTimedEffect(
            currentEffects,
            type,
            now,
            definition.durationMs,
          );
          sfx(
            definition.positive ? playPositivePowerupSound : playNegativePowerupSound,
          );
        }
      }

      const hasRemainingBricks = newBricks.some((brick) => brick.status === 1);
      if (!hasRemainingBricks) {
        newScore += 1000 * level;
        setScore(newScore);
        setActiveEffects(currentEffects);
        setPowerups([]);
        setLevel(level + 1);
        return;
      }

      if (survivingBalls.length === 0) {
        newLives -= 1;
        sfx(playLoseLifeSound);
        if (newLives <= 0) {
          onGameOver(newScore);
          return;
        }

        setLives(newLives);
        resetBallAndPaddle(level, true);
        return;
      }

      setBalls(survivingBalls);
      setBricks(newBricks);
      setPowerups(newPowerups);
      setActiveEffects(currentEffects);
      setScore(newScore);
      setLives(newLives);
      setPaddle(newPaddle);
      setPaddleVelocity(newPaddleVelocity);

      animationFrameId.current = requestAnimationFrame(gameLoop);
    }, [
      activeEffects,
      balls,
      bricks,
      gameStatus,
      level,
      levelStartTime,
      lives,
      onGameOver,
      paddle,
      paddleVelocity,
      powerups,
      resetBallAndPaddle,
      score,
      sfx,
      showLevelUp,
    ]);

    useEffect(() => {
      animationFrameId.current = requestAnimationFrame(gameLoop);
      return () => {
        if (animationFrameId.current) {
          cancelAnimationFrame(animationFrameId.current);
        }
      };
    }, [gameLoop]);

    useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === ' ' || event.key === 'Spacebar') {
          event.preventDefault();
          if (gameStatus === 'playing') {
            setGameStatus('paused');
          } else if (gameStatus !== 'ready') {
            setGameStatus('playing');
          }
        }
        keysPressed.current[event.key] = true;
      };

      const handleKeyUp = (event: KeyboardEvent) => {
        keysPressed.current[event.key] = false;
      };

      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);

      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
      };
    }, [gameStatus, setGameStatus]);

    const projectedPaddle = project(paddle.x, PADDLE_Y);
    const paddleWidth = paddle.width * projectedPaddle.scale;
    const paddleTopThickness = PADDLE_DEPTH * projectedPaddle.scale;
    const paddleFrontHeight = PADDLE_HEIGHT * projectedPaddle.scale;

    return (
      <div className="w-full h-full bg-black relative overflow-hidden">
        <svg viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} className="w-full h-full absolute inset-0 bg-black">
          <defs>
            <radialGradient id="skyGradient" cx="50%" cy="10%" r="70%" fx="50%" fy="10%">
              <stop offset="0%" stopColor="#2c0b4d" />
              <stop offset="100%" stopColor="#000" />
            </radialGradient>
          </defs>
          <rect x="0" y="0" width={VIEW_WIDTH} height={VIEW_HEIGHT} fill="url(#skyGradient)" />
          <FloorGrid />
          {balls.map((ball) => {
            const projectedBall = project(ball.x, ball.y);
            const ballRadius = ball.radius * projectedBall.scale;
            return (
              <React.Fragment key={ball.id}>
                <ellipse
                  cx={projectedBall.x}
                  cy={projectedBall.y + ballRadius + 2}
                  rx={ballRadius}
                  ry={ballRadius * 0.3}
                  fill="black"
                  opacity={0.4 * projectedBall.scale}
                  style={{ filter: 'blur(3px)' }}
                />
                <g
                  transform={`translate(${projectedBall.x}, ${projectedBall.y})`}
                  className="drop-shadow-[0_0_8px_#ec4899]"
                >
                  <circle cx={0} cy={0} r={ballRadius} fill="none" stroke="#f43f5e" strokeWidth="2" />
                </g>
              </React.Fragment>
            );
          })}
          {bricks.map((brick) => (brick.status === 1 ? <Brick3D key={`${brick.x}-${brick.y}`} brick={brick} /> : null))}
          {powerups.map((powerup) => (
            <PowerupDropSprite key={powerup.id} powerup={powerup} />
          ))}
          <g className="drop-shadow-[0_0_8px_#22d3ee]">
            <polygon
              points={`${projectedPaddle.x},${PADDLE_Y} ${projectedPaddle.x + paddleWidth},${PADDLE_Y} ${projectedPaddle.x + paddleWidth},${PADDLE_Y - paddleTopThickness} ${projectedPaddle.x},${PADDLE_Y - paddleTopThickness}`}
              fill="none"
              stroke="#0891b2"
              strokeWidth="2"
            />
            <polygon
              points={`${projectedPaddle.x},${PADDLE_Y} ${projectedPaddle.x + paddleWidth},${PADDLE_Y} ${projectedPaddle.x + paddleWidth},${PADDLE_Y + paddleFrontHeight} ${projectedPaddle.x},${PADDLE_Y + paddleFrontHeight}`}
              fill="none"
              stroke="#06b6d4"
              strokeWidth="2"
            />
          </g>
        </svg>
        <div
          className="absolute top-0 left-0 right-0 flex justify-between p-4 text-xl font-press-start"
          style={{
            transform: 'perspective(600px) rotateX(15deg) translateY(-20px) scale(0.9)',
            transformStyle: 'preserve-3d',
            color: 'white',
            textShadow: '0 0 5px #fff',
          }}
        >
          <div>
            SCORE:{' '}
            <span className="text-lime-400" style={{ textShadow: '0 0 8px #a3e635' }}>
              {score}
            </span>
          </div>
          <div>
            LEVEL:{' '}
            <span className="text-yellow-400" style={{ textShadow: '0 0 8px #facc15' }}>
              {level}
            </span>
          </div>
          <div>
            LIVES:{' '}
            <span className="text-red-500" style={{ textShadow: '0 0 8px #ef4444' }}>
              {'♥ '.repeat(lives)}
            </span>
          </div>
        </div>

        {activeEffects.length > 0 && (
          <div className="absolute top-12 left-1/2 -translate-x-1/2 flex gap-2 z-20">
            {ACTIVE_EFFECT_ORDER.map((effectType) => {
              const effect = activeEffects.find((item) => item.type === effectType);
              if (!effect) {
                return null;
              }

              const definition = POWERUP_DEFINITIONS[effectType];
              const remainingSeconds = Math.max(
                1,
                Math.ceil((effect.expiresAt - Date.now()) / 1000),
              );

              return (
                <div
                  key={effectType}
                  className="px-3 py-1 text-xs font-press-start border"
                  style={{
                    color: definition.color,
                    borderColor: definition.color,
                    background: 'rgba(0, 0, 0, 0.45)',
                    boxShadow: `0 0 10px ${definition.color}`,
                    textShadow: `0 0 6px ${definition.color}`,
                  }}
                >
                  {definition.label} {remainingSeconds}
                </div>
              );
            })}
          </div>
        )}

        {showLevelUp && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30" style={{ transformStyle: 'preserve-3d' }}>
            <h2 className="font-press-start text-5xl text-yellow-400 level-up-message">LEVEL {level}</h2>
          </div>
        )}

        {gameStatus === 'paused' && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center pointer-events-none z-30 backdrop-blur-sm">
            <h2 className="font-press-start text-5xl text-yellow-400 animate-pulse" style={{ textShadow: '0 0 10px #facc15' }}>
              PAUSED
            </h2>
          </div>
        )}
      </div>
    );
  },
);

export default Game;

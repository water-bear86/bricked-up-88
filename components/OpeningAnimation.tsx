import React, { useState, useEffect, useRef } from 'react';

// --- Constants ---
const VIEW_WIDTH = 800;
const VIEW_HEIGHT = 600;
const HORIZON_Y = VIEW_HEIGHT * 0.4;

const BRICK_COLOR = { 
  main: '#ec4899',   // pink-500
  top: '#f472b6',    // pink-400
  glow: 'drop-shadow-[0_0_8px_#ec4899]' 
};

// --- Types ---
interface WorldObject {
  x: number; // world x-coordinate
  y: number; // world y-coordinate (height off floor)
  z: number; // world z-coordinate (distance from camera, 0=far, 1=near)
  width: number;
  height: number;
}

interface Particle {
  x: number; y: number; dx: number; dy: number;
  life: number; maxLife: number;
  vertices: { x: number, y: number }[];
  color: string; rotation: number; rotationSpeed: number;
}

enum AnimationPhase { FLYING, IMPACT, COOLDOWN }

// --- 3D Projection Logic ---
const project = (x_world: number, y_world: number, z_world: number, cameraShake: {x: number, y: number}) => {
  const scale = z_world * 2; // Make Z scale more aggressively
  const screenX = VIEW_WIDTH / 2 + (x_world - VIEW_WIDTH / 2) * scale;
  const screenY = HORIZON_Y + (VIEW_HEIGHT - HORIZON_Y) * z_world - (y_world * scale);
  return { x: screenX + cameraShake.x, y: screenY + cameraShake.y, scale };
};

// --- Drawing Components (Memoized) ---
const FloorGrid = React.memo(({ cameraShake, gridOffset }: { cameraShake: {x:number, y:number}, gridOffset: number }) => {
    const lines = [];
    const numLines = 20;
    const gridColor = "#a855f7";
    const step = 1.0 / numLines;

    // Horizontal lines
    for (let i = 0; i <= numLines; i++) {
        const z = (i * step + gridOffset + 1) % 1;
        const p1 = project(0, 0, z, {x:0,y:0});
        const p2 = project(VIEW_WIDTH, 0, z, {x:0,y:0});
        lines.push(<line key={`h-${i}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={gridColor} strokeOpacity={0.1 + z * 0.2} />);
    }
    // Vertical lines
    for (let i = 0; i <= numLines; i++) {
        const x = (i / numLines) * VIEW_WIDTH;
        const p1 = project(x, 0, 0, {x:0,y:0});
        const p2 = project(x, 0, 1, {x:0,y:0});
        lines.push(<line key={`v-${i}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={gridColor} strokeOpacity={0.3} />);
    }
    return <g style={{transform: `translate(${cameraShake.x}px, ${cameraShake.y}px)`}}>{lines}</g>;
});

const Brick3D = React.memo(({ brick, cameraShake }: { brick: WorldObject, cameraShake: {x:number, y:number} }) => {
    const { x, y, z, width, height } = brick;
    const p_base = project(x, y, z, cameraShake);
    const p_top = project(x, y + height, z, cameraShake);
    const p_base_right = project(x + width, y, z, cameraShake);
    
    const frontFacePoints = `${p_base.x},${p_base.y} ${p_base_right.x},${p_base_right.y} ${project(x + width, y + height, z, cameraShake).x},${project(x + width, y + height, z, cameraShake).y} ${p_top.x},${p_top.y}`;
    const topFacePoints = `${p_top.x},${p_top.y} ${project(x + width, y + height, z, cameraShake).x},${project(x + width, y + height, z, cameraShake).y} ${project(x + width, y + height, z * 0.95, cameraShake).x},${project(x + width, y + height, z * 0.95, cameraShake).y} ${project(x, y + height, z * 0.95, cameraShake).x},${project(x, y + height, z * 0.95, cameraShake).y}`;

    return (
        <g className={BRICK_COLOR.glow}>
            <polygon points={topFacePoints} fill="none" stroke={BRICK_COLOR.top} strokeWidth="1.5" />
            <polygon points={frontFacePoints} fill="none" stroke={BRICK_COLOR.main} strokeWidth="1.5" />
        </g>
    );
});

const Puck3D = React.memo(({ puck, cameraShake }: { puck: WorldObject, cameraShake: {x:number, y:number} }) => {
    const {x, y, z, width, height} = puck;
    const puckHeight = height * 0.4; 
    
    const p_base = project(x, y, z, cameraShake);
    const p_top = project(x, y + puckHeight, z, cameraShake);
    
    const radiusX = (width / 2) * p_base.scale;
    const ellipseRy = Math.max(2, radiusX * 0.25); 

    const segments = 24;
    const topPoints = [];
    const basePoints = [];

    for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const px = radiusX * Math.cos(angle);
        const py = ellipseRy * Math.sin(angle);
        topPoints.push({ x: p_top.x + px, y: p_top.y + py });
        basePoints.push({ x: p_base.x + px, y: p_base.y + py });
    }

    const topFacePoints = topPoints.map(p => `${p.x},${p.y}`).join(' ');
    
    // Create a collection of quads for the front-facing side wall
    const sideQuads = [];
    // The front half corresponds to sin(angle) >= 0, which is i from 0 to segments/2
    for (let i = 0; i < segments / 2; i++) {
        const quadPoints = [
            topPoints[i],
            topPoints[i+1],
            basePoints[i+1],
            basePoints[i]
        ].map(p => `${p.x},${p.y}`).join(' ');
        sideQuads.push(
            <polygon key={i} points={quadPoints} fill="#f43f5e" stroke="#db2777" strokeWidth="0.5" />
        );
    }

    const p_shadow = project(x, 0, z, cameraShake);

    return (
      <g>
          {/* Shadow */}
          <ellipse cx={p_shadow.x} cy={p_shadow.y + 5} rx={radiusX} ry={ellipseRy} fill="black" opacity={0.4 * p_base.scale} style={{filter: 'blur(3px)'}} />
          
          <g style={{filter: 'drop-shadow(0 0 8px #f43f5e)'}}>
              {/* Side wall of the puck */}
              {sideQuads}
              
              {/* Top face of the puck */}
              <polygon points={topFacePoints} fill="#f9a8d4" stroke="#db2777" strokeWidth="1.5" />
          </g>
      </g>
    );
});


export default function OpeningAnimation() {
    const animationFrameId = useRef<number | null>(null);
    const timeoutId = useRef<number | undefined>(undefined);
    const [, forceUpdate] = useState(0);

    const phase = useRef<AnimationPhase>(AnimationPhase.FLYING);
    
    const puck = useRef<WorldObject>({ x: VIEW_WIDTH/2 - 20, y: 15, z: 0.9, width: 40, height: 20 });
    const initialBrickState: WorldObject = { x: VIEW_WIDTH/2 - 50, y: 0, z: 0.15, width: 100, height: 20 };
    const brick = useRef<WorldObject>({ ...initialBrickState });
    
    const particles = useRef<Particle[]>([]);
    const cameraShake = useRef({x: 0, y: 0});
    const gridOffset = useRef(0);
    
    const resetAnimation = () => {
        phase.current = AnimationPhase.FLYING;
        brick.current = { ...initialBrickState };
        particles.current = [];
        cameraShake.current = {x: 0, y: 0};
        gridOffset.current = 0;
        if (timeoutId.current) clearTimeout(timeoutId.current);
    };
    
    useEffect(() => {
        const createExplosion = (origin: {x: number, y: number}) => {
            const newParticles: Particle[] = [];
            for (let i = 0; i < 80; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = Math.random() * 6 + 2;
                const size = Math.random() * 9 + 3;
                const life = Math.random() * 120 + 60;
                const numVertices = Math.floor(Math.random() * 3) + 3;
                const vertices = Array.from({ length: numVertices }, (_, j) => ({
                    x: Math.cos((Math.PI * 2 / numVertices) * j) * size,
                    y: Math.sin((Math.PI * 2 / numVertices) * j) * size
                }));

                newParticles.push({
                    x: origin.x, y: origin.y,
                    dx: Math.cos(angle) * speed, dy: Math.sin(angle) * speed,
                    life, maxLife: life, vertices,
                    color: ['#ec4899', '#f97316', '#facc15', '#22d3ee', '#c084fc', '#fff'][Math.floor(Math.random() * 6)],
                    rotation: Math.random() * 360, rotationSpeed: (Math.random() - 0.5) * 8
                });
            }
            particles.current = newParticles;
        };

        const animationLoop = () => {
            let needsRender = false;
            
            // --- Phase Logic ---
            if (phase.current === AnimationPhase.FLYING) {
                const speed = 0.007;

                // Brick moves towards the camera
                const newBrickZ = brick.current.z + speed;
                brick.current = { ...brick.current, z: newBrickZ };

                // Puck bobs at a fixed Z-depth
                const newPuckY = 15 + Math.sin(Date.now() / 200) * 5;
                puck.current = { ...puck.current, y: newPuckY };

                // Grid scrolls to give illusion of movement
                gridOffset.current = (gridOffset.current - speed);

                // Check for impact
                if (brick.current.z >= puck.current.z) {
                    phase.current = AnimationPhase.IMPACT;
                    const impactPoint = project(puck.current.x + puck.current.width / 2, puck.current.y, puck.current.z, {x:0, y:0});
                    createExplosion(impactPoint);
                    timeoutId.current = window.setTimeout(() => {
                        phase.current = AnimationPhase.COOLDOWN;
                        cameraShake.current = {x: 0, y: 0};
                        timeoutId.current = window.setTimeout(resetAnimation, 2500);
                    }, 500); // Shake duration
                }
                needsRender = true;
            }
            
            if (phase.current === AnimationPhase.IMPACT) {
                cameraShake.current = { x: (Math.random() - 0.5) * 20, y: (Math.random() - 0.5) * 20 };
                needsRender = true;
            }
            
            // --- Particle Logic (runs in IMPACT and COOLDOWN) ---
            if (particles.current.length > 0) {
                particles.current = particles.current.map(p => ({
                    ...p,
                    life: p.life - 1,
                    x: p.x + p.dx, y: p.y + p.dy,
                    rotation: p.rotation + p.rotationSpeed,
                    dy: p.dy + 0.08, // gravity
                })).filter(p => p.life > 0);
                needsRender = true;
            }

            if (needsRender) forceUpdate(c => c + 1);
            animationFrameId.current = requestAnimationFrame(animationLoop);
        };

        resetAnimation();
        animationFrameId.current = requestAnimationFrame(animationLoop);

        return () => {
            if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
            if (timeoutId.current) clearTimeout(timeoutId.current);
        };
    }, []);
  
    return (
        <div className="w-full h-full bg-black relative cursor-none overflow-hidden">
            <svg viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} className="w-full h-full absolute inset-0 bg-black">
                <defs>
                    <radialGradient id="skyChase" cx="50%" cy="40%" r="60%" fx="50%" fy="40%">
                        <stop offset="0%" stopColor="#2c0b4d" />
                        <stop offset="100%" stopColor="#000" />
                    </radialGradient>
                </defs>
                <rect x="0" y="0" width={VIEW_WIDTH} height={VIEW_HEIGHT} fill="url(#skyChase)" />
                
                <FloorGrid cameraShake={cameraShake.current} gridOffset={gridOffset.current} />
                
                {phase.current === AnimationPhase.FLYING && (
                    <>
                      <Brick3D brick={brick.current} cameraShake={cameraShake.current} />
                      <Puck3D puck={puck.current} cameraShake={cameraShake.current} />
                    </>
                )}

                {/* Particles need to be rendered outside the main camera shake group to feel like they are in screen space */}
                <g>
                    {particles.current.map((p, i) => (
                        <polygon
                            key={i}
                            points={p.vertices.map(v => `${v.x},${v.y}`).join(' ')}
                            fill="none"
                            stroke={p.color}
                            strokeWidth="2"
                            opacity={(p.life / p.maxLife)}
                            style={{
                                transform: `translate(${p.x}px, ${p.y}px) rotate(${p.rotation}deg)`,
                            }}
                        />
                    ))}
                </g>
            </svg>
        </div>
    );
}
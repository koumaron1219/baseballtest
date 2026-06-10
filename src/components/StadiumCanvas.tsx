import React, { useRef, useEffect, useState } from 'react';
import { MatchState, Ball3D, PitchType, Vector3D, CPULevel } from '../types';
import { gameAudio } from '../utils/audio';
import { PlayState } from '../types';
import { Volume2, VolumeX, Eye, HelpCircle, Swords, Zap, HelpCircle as InfoIcon } from 'lucide-react';

interface StadiumCanvasProps {
  match: MatchState;
  onPlayResult: (result: {
    type: 'STRIKE' | 'BALL' | 'OUT' | 'HIT' | 'HOMERUN' | 'FOUL' | 'SINGLE' | 'DOUBLE' | 'TRIPLE';
    detail?: string;
  }) => void;
  cpuLevel: CPULevel;
  playState: PlayState;
  setPlayState: (state: PlayState) => void;
  isMuted: boolean;
  setIsMuted: (muted: boolean) => void;
}

// Canvas resolution constants
const WIDTH = 800;
const HEIGHT = 450;

export default function StadiumCanvas({
  match,
  onPlayResult,
  cpuLevel,
  playState,
  setPlayState,
  isMuted,
  setIsMuted,
}: StadiumCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Batting Cursor state (relative to strike zone center)
  const [batPos, setBatPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [swingFrame, setSwingFrame] = useState<number>(-1); // -1: Not swinging, 0-10: swinging
  const [screenShake, setScreenShake] = useState<number>(0);
  const [hasSwungThisPitch, setHasSwungThisPitch] = useState<boolean>(false);
  const hasSwungThisPitchRef = useRef<boolean>(false);
  const [pitchStep, setPitchStep] = useState<'TYPE' | 'COURSE'>('TYPE');

  // Pitching States (Interactive Pitch Selection and Aiming)
  const [pitchType, setPitchType] = useState<PitchType>('FAST');
  const [pitchTarget, setPitchTarget] = useState<{ x: number; y: number }>({ x: 0, y: 0 }); // TARGET: x (-1.5 to 1.5), y (-1.5 to 1.5)
  const [timingRing, setTimingRing] = useState<number>(0); // Timing ring for PITCh (0 to 1)
  const [pitchPower, setPitchPower] = useState<number>(1); // Speed multiplier

  // Ball states
  const [ball, setBall] = useState<Ball3D | null>(null);
  const [prevBallPos, setPrevBallPos] = useState<Vector3D[]>([]); // for trajectory line
  const [flightTimer, setFlightTimer] = useState<number>(0);
  const [resultText, setResultText] = useState<string>('');
  const [resultSubtitle, setResultSubtitle] = useState<string>('');
  const [showResultBanner, setShowResultBanner] = useState<boolean>(false);

  // Fielders positions (Fielder coordinates: Left, Center, Right in 3D field coordinates)
  // z: 80 to 110 (outfield)
  const [fielders, setFielders] = useState<{ pos: Vector3D; target: Vector3D; name: string }[]>([
    { pos: { x: -30, y: 0, z: 80 }, target: { x: -30, y: 0, z: 80 }, name: 'レフト' },
    { pos: { x: 0, y: 0, z: 95 }, target: { x: 0, y: 0, z: 95 }, name: 'センター' },
    { pos: { x: 30, y: 0, z: 80 }, target: { x: 30, y: 0, z: 80 }, name: 'ライト' },
    { pos: { x: -10, y: 0, z: 35 }, target: { x: -10, y: 0, z: 35 }, name: 'ショート' },
    { pos: { x: 10, y: 0, z: 35 }, target: { x: 10, y: 0, z: 35 }, name: 'セカンド' }
  ]);

  // Track if CPU batting has triggered its swing decision
  const [cpuSwingTriggered, setCpuSwingTriggered] = useState<boolean>(false);
  const [cpuSwingFrame, setCpuSwingFrame] = useState<number>(-1);
  const [cpuBatX, setCpuBatX] = useState<number>(0);
  const [cpuBatY, setCpuBatY] = useState<number>(0);

  // Base Runner 3D positions for visual rendering during 'RUNNER_ADVANCE'
  const [runnerPositions, setRunnerPositions] = useState<{ x: number; z: number; progress: number }[]>([]);

  // Sound toggler
  const handleToggleMute = () => {
    const status = gameAudio.toggleMute();
    setIsMuted(status);
  };

  // Reset play situation for the next pitch
  useEffect(() => {
    if (playState === 'PITCHER_WINDUP') {
      setBall(null);
      setPrevBallPos([]);
      setResultText('');
      setResultSubtitle('');
      setShowResultBanner(false);
      setSwingFrame(-1);
      setCpuSwingFrame(-1);
      setCpuSwingTriggered(false);
      setHasSwungThisPitch(false);
      hasSwungThisPitchRef.current = false;
      setPitchStep('TYPE');
      
      // Let fielders return to original positions
      setFielders([
        { pos: { x: -30, y: 0, z: 85 }, target: { x: -30, y: 0, z: 85 }, name: 'レフト' },
        { pos: { x: 0, y: 0, z: 100 }, target: { x: 0, y: 0, z: 100 }, name: 'センター' },
        { pos: { x: 30, y: 0, z: 85 }, target: { x: 30, y: 0, z: 85 }, name: 'ライト' },
        { pos: { x: -10, y: 0, z: 35 }, target: { x: -10, y: 0, z: 35 }, name: 'ショート' },
        { pos: { x: 10, y: 0, z: 35 }, target: { x: 10, y: 0, z: 35 }, name: 'セカンド' }
      ]);

      // If CPU is pitching, launch automatically after windup delay
      if (match.currentRole === 'BATTING') {
        const timer = setTimeout(() => {
          triggerCPUPitch();
        }, 1200);
        return () => clearTimeout(timer);
      }
    }
  }, [playState, match.currentRole]);

  // Trigger CPUPitch logic
  const triggerCPUPitch = () => {
    // Determine random pitch type: 60% straight (FAST), 40% breaking balls (CURVE, SLIDER, FORK)
    let selectedType: PitchType = 'FAST';
    if (Math.random() < 0.40) {
      const breakingTypes: PitchType[] = ['CURVE', 'SLIDER', 'FORK'];
      selectedType = breakingTypes[Math.floor(Math.random() * breakingTypes.length)];
    } else {
      selectedType = 'FAST';
    }
    
    // Choose random but somewhat reasonable pitch target (strike zone is -1 to 1)
    // CPU level affects how accurate CPU pitches are. Hard CPU will throw on corners.
    const accuracyNoise = 0.4;
    const targetX = (Math.random() * 2 - 1) * 1.2;
    const targetY = (Math.random() * 2 - 1) * 1.2;

    gameAudio.playThrow();
    setPlayState('PITCH_FLIGHT');

    const startPos = { x: 0, y: 1.6, z: 60 }; // mound
    
    // speed changes based on PitchType & difficulty
    let speed = 1.35 * cpuLevel.pitchSpeedMult;
    if (selectedType === 'CURVE') speed *= 0.75;
    if (selectedType === 'SLIDER') speed *= 0.85;
    if (selectedType === 'FORK') speed *= 0.80;

    // Calculate initial velocity to reach target on z = 12
    const totalFrames = Math.ceil((startPos.z - 12) / speed);
    const velZ = -speed;
    const velX = (targetX - startPos.x) / totalFrames;
    const velY = (targetY - startPos.y) / totalFrames;

    setBall({
      pos: startPos,
      vel: { x: velX, y: velY, z: velZ },
      r: 0.15,
      isHit: false,
      type: selectedType
    });
  };

  // Human pitches the ball with coordinate target
  const handleThrowPitchWithCoords = (target: { x: number; y: number }) => {
    if (playState !== 'PITCHER_WINDUP' || match.currentRole !== 'PITCHING') return;

    gameAudio.playThrow();
    setPlayState('PITCH_FLIGHT');

    const startPos = { x: 0, y: 1.6, z: 60 }; // from mound
    const finalTargetX = target.x;
    const finalTargetY = target.y + 1.0; // adjust height offset

    const speed = pitchType === 'FAST' ? 1.4 : pitchType === 'CURVE' ? 0.9 : pitchType === 'SLIDER' ? 1.15 : 1.05;

    const totalFrames = Math.ceil((startPos.z - 12) / speed);
    const velZ = -speed;
    const velX = (finalTargetX - startPos.x) / totalFrames;
    const velY = (finalTargetY - startPos.y) / totalFrames;

    setBall({
      pos: startPos,
      vel: { x: velX, y: velY, z: velZ },
      r: 0.15,
      isHit: false,
      type: pitchType
    });
  };

  // Human pitches the ball
  const handleThrowPitch = () => {
    handleThrowPitchWithCoords(pitchTarget);
  };

  // Keyboard navigation for batting cursor
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (match.currentRole !== 'BATTING' || playState !== 'PITCH_FLIGHT') return;

      const delta = 0.12;
      let newX = batPos.x;
      let newY = batPos.y;

      if (e.key === 'ArrowLeft' || e.key === 'a') newX = Math.max(-2, batPos.x - delta);
      if (e.key === 'ArrowRight' || e.key === 'd') newX = Math.min(2, batPos.x + delta);
      if (e.key === 'ArrowUp' || e.key === 'w') newY = Math.min(2, batPos.y + delta);
      if (e.key === 'ArrowDown' || e.key === 's') newY = Math.max(-2, batPos.y - delta);

      setBatPos({ x: newX, y: newY });

      // Swing bat with Space
      if (e.key === ' ' || e.key === 'Enter') {
        triggerSwing();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [batPos, playState, match.currentRole]);

  // Click / Space triggered swing
  const triggerSwing = () => {
    if (swingFrame === -1 && match.currentRole === 'BATTING' && playState === 'PITCH_FLIGHT') {
      setSwingFrame(0);
      setHasSwungThisPitch(true);
      hasSwungThisPitchRef.current = true;
      gameAudio.playThrow(); // swoosh style
    }
  };

  // Animation ticks & Game mechanics core logic
  useEffect(() => {
    let active = true;
    const tick = () => {
      if (!active) return;

      // 1. Swing animation frames tick
      if (swingFrame >= 0) {
        if (swingFrame < 10) {
          setSwingFrame(f => f + 1);
        } else {
          setSwingFrame(-1);
        }
      }

      if (cpuSwingFrame >= 0) {
        if (cpuSwingFrame < 10) {
          setCpuSwingFrame(f => f + 1);
        } else {
          setCpuSwingFrame(-1);
        }
      }

      // 2. Screen shake decay
      if (screenShake > 0) setScreenShake(s => Math.max(0, s - 0.5));

      // 3. Ball flight processing
      if (ball) {
        let bp = { ...ball.pos };
        let bv = { ...ball.vel };
        
        // Save history for trajectory tracing
        setPrevBallPos(prev => {
          const list = [...prev, { ...bp }];
          if (list.length > 15) list.shift();
          return list;
        });

        if (playState === 'PITCH_FLIGHT') {
          // Break trajectory depending on pitch type
          if (ball.type && bp.z > 20) {
            // Slider breaks horizontally (Reduced curvature to be more controllable and stay in strike zone)
            if (ball.type === 'SLIDER') {
              bv.x += 0.007;
            }
            // Curveball horizontal and vertical diagonal drop (Reduced curvature)
            if (ball.type === 'CURVE') {
              bv.x -= 0.0045;
              bv.y -= 0.0035;
            }
            // Forkball dips sharply at the end (Reduced curvature)
            if (ball.type === 'FORK' && bp.z < 28) {
              bv.y -= 0.011;
            }
          }

          // Move ball
          bp.x += bv.x;
          bp.y += bv.y;
          bp.z += bv.z;

          // CPU batting swing decisions (if CPU is Batting)
          if (match.currentRole === 'PITCHING' && !cpuSwingTriggered) {
            // Check when ball is very close to home plate (e.g., z is near 12 + 2.5 * speed)
            const speedVal = Math.abs(bv.z);
            const triggerDistance = 12 + 2.5 * speedVal;
            if (bp.z <= triggerDistance && bp.z >= 12) {
              setCpuSwingTriggered(true);
              
              // Decide whether to swing based on whether pitch is a strike or a ball
              const isStrike = (bp.x >= -1.0 && bp.x <= 1.0) && (bp.y >= -0.2 && bp.y <= 1.5);
              let willSwing = false;
              let swingAtBall = false;

              if (isStrike) {
                // Strike has a realistic swinging probability based on CPU level (Harder CPU swings more consistently)
                const strikeSwingChance = 0.60 + cpuLevel.swingAccuracy * 0.30;
                willSwing = Math.random() < strikeSwingChance;
              } else {
                // CPU can also chase ball pitches outside the strike zone (chase rate), especially if close to the zone
                const distToStrikeX = Math.max(0, Math.abs(bp.x) - 1.0);
                const distToStrikeY = Math.max(0, bp.y > 1.5 ? bp.y - 1.5 : (bp.y < -0.2 ? -0.2 - bp.y : 0));
                const distToZone = Math.sqrt(distToStrikeX * distToStrikeX + distToStrikeY * distToStrikeY);
                
                // Further away from strike zone = less likely to chase.
                const chaseChance = Math.max(0.05, (0.35 + cpuLevel.swingAccuracy * 0.15) - distToZone * 0.25);
                if (Math.random() < chaseChance) {
                  willSwing = true;
                  swingAtBall = true;
                }
              }
              
              if (willSwing) {
                // Since this is evaluated when the ball is very close (bp.z between 12 and 15), 
                // any curve has already finished, so we determine the bat offset to simulate hit quality.
                let errorScale = 0.55 * (1.20 - cpuLevel.swingAccuracy);
                if (swingAtBall) {
                  errorScale *= 2.2; // Extra large error scale when chasing balls
                }

                // Random contact offsets to ensure CPU hits are diverse (grounder, popfly, normal, homerun, or miss)
                let offsetX = (Math.random() * 2 - 1) * errorScale;
                let offsetY = (Math.random() * 2 - 1) * errorScale;

                const randType = Math.random();
                if (!swingAtBall) {
                  if (randType < 0.25) {
                    // Top the ball (grounder) -> bat sits slightly above ball
                    offsetY = 0.22 + Math.random() * 0.30;
                  } else if (randType < 0.50) {
                    // Under-cut the ball (pop-up) -> bat sits significantly below ball
                    offsetY = -0.32 - Math.random() * 0.35;
                  } else if (randType < 0.70) {
                    // Slightly off center (medium line drive/hit)
                    offsetX = (Math.random() > 0.5 ? 0.3 : -0.3) + (Math.random() * 2 - 1) * 0.15;
                  } else if (randType < 0.85) {
                    // Sweet spot (potential home run) -> perfect vertical undercut
                    offsetX = (Math.random() * 2 - 1) * 0.08;
                    offsetY = 0.15; 
                  } else {
                    // Swing and miss completely
                    offsetX = (Math.random() > 0.5 ? 1.2 : -1.2);
                  }
                } else {
                  // Chased a ball pitch -> high miss rate or very poor contact
                  if (randType < 0.65) {
                    // Swing and miss
                    offsetX = (Math.random() > 0.5 ? 1.3 : -1.3);
                  } else {
                    // Weak contact pop/grounder
                    offsetY = (Math.random() > 0.5 ? 0.55 : -0.55);
                    offsetX = (Math.random() * 2 - 1) * 0.45;
                  }
                }

                setCpuBatX(bp.x + offsetX);
                setCpuBatY(bp.y + offsetY);
                setCpuSwingFrame(0);
              }
            }
          }

          // Collision detection between bat and ball at contact plane z = 12
          const userSwung = (match.currentRole === 'BATTING' && swingFrame >= 0 && swingFrame <= 4);
          const cpuSwung = (match.currentRole === 'PITCHING' && cpuSwingFrame >= 0 && cpuSwingFrame <= 4);

          let hitOccurred = false;
          let finalBatX = 0;
          let finalBatY = 0;
          let collisionChecked = false;

          if (match.currentRole === 'BATTING') {
            // Expanded hit timing window: Check collision if user swings while ball is in plate zone (z between 9.5 and 17.5)
            if (userSwung && bp.z >= 9.5 && bp.z <= 17.5) {
              hitOccurred = true;
              finalBatX = batPos.x;
              finalBatY = batPos.y;
              collisionChecked = true;
            } else if (bp.z <= 9.5) {
              // No swing, ball crossed home plate
              collisionChecked = true;
              hitOccurred = false;
            }
          } else {
            // CPU Batting
            if (cpuSwung && bp.z >= 9.5 && bp.z <= 15.5) {
              hitOccurred = true;
              finalBatX = cpuBatX;
              finalBatY = cpuBatY;
              collisionChecked = true;
            } else if (bp.z <= 9.5) {
              collisionChecked = true;
              hitOccurred = false;
            }
          }

          if (collisionChecked) {
            if (hitOccurred) {
              // Calculate horizontal and vertical distances
              const dx = bp.x - finalBatX;
              const dy = bp.y - finalBatY;
              const dist = Math.sqrt(dx * dx + dy * dy);

              // REVOLUTIONARY BATTING EASING: Max contact distance increased from 0.65m to 1.15m!
              if (dist <= 1.15) {
                // SATISFYING PERFECT OR REASONABLE ACCURACY HIT!
                gameAudio.playBatCrack();
                setScreenShake(dist <= 0.65 ? 7 : 4);

                const timingFactor = 1.0 - Math.min(0.7, dist * 0.6); // closer to center = harder hit
                const angleX = -dx * 2.2; // pull/slice angle
                const angleY = (0.35 - dy) * 1.5; // launch vertical angle

                // Base speed vector outward towards field
                const baseZVel = 1.6 + timingFactor * 1.4;
                const launchHeightVel = Math.max(0.35, angleY * 1.8);

                // Setup the hitting outward flight
                const hitBall: Ball3D = {
                  pos: { x: bp.x, y: 1.0, z: 12 },
                  vel: { x: angleX * 1.4, y: launchHeightVel, z: baseZVel },
                  r: 0.15,
                  isHit: true
                };

                setBall(hitBall);
                setPlayState('BALL_FLIGHT');
                setPrevBallPos([]);

                // Set fielders to run towards estimated landing point
                const estZ = 12 + hitBall.vel.z * 35;
                const estX = hitBall.pos.x + hitBall.vel.x * 35;
                
                setFielders(prev => prev.map(f => {
                  const distToLand = Math.sqrt((f.pos.x - estX)**2 + (f.pos.z - estZ)**2);
                  if (distToLand < 50) {
                    return { ...f, target: { x: estX, y: 0, z: estZ } };
                  }
                  return f;
                }));

                return;
              } else {
                hitOccurred = false;
              }
            }

            // Missed swing or let-go ball evaluation
            setBall(null);
            
            const playerSwungButMissed = (match.currentRole === 'BATTING' && hasSwungThisPitchRef.current);
            const cpuSwungButMissed = (match.currentRole === 'PITCHING' && cpuSwingFrame >= 0);
            const didSwingMiss = playerSwungButMissed || cpuSwungButMissed;

            // Strike Zone limits: width -1.0 to 1.0, height -0.2 to 1.5
            const isStrike = didSwingMiss || ((bp.x >= -1.0 && bp.x <= 1.0) && (bp.y >= -0.2 && bp.y <= 1.5));
            if (isStrike) {
              gameAudio.playCatch();
              gameAudio.playStrikeCall();
              
              setResultText('STRIKE!');
              setResultSubtitle(didSwingMiss ? '空振りストライク！' : (match.currentRole === 'BATTING' ? '見逃しストライク' : 'ナイスピッチ！'));
              setShowResultBanner(true);
              setPlayState('SWING_RESULT');
              
              setTimeout(() => {
                onPlayResult({ type: 'STRIKE' });
              }, 1200);
            } else {
              gameAudio.playCatch();
              
              // Walk check
              const isWalk = match.balls >= 3;
              if (isWalk) {
                gameAudio.playCheer();
                setResultText('FOUR BALLS!');
                setResultSubtitle(match.currentRole === 'BATTING' ? 'フォアボール！一塁へ進塁！' : 'ピッチャー乱調！フォアボールを与えました');
              } else {
                gameAudio.playBallCall();
                setResultText('BALL!');
                setResultSubtitle('ボールゾーン');
              }
              
              setShowResultBanner(true);
              setPlayState('SWING_RESULT');

              setTimeout(() => {
                onPlayResult({ type: 'BALL' });
              }, 1200);
            }
          } else {
            // Keep flying pitch ball
            setBall({ ...ball, pos: bp, vel: bv });
          }

        } else if (playState === 'BALL_FLIGHT') {
          // Ball hit in play and flying towards stadium field
          // Apply gravity and air resistance on y axis
          bv.y -= 0.038; // gravity
          bp.x += bv.x;
          bp.y += bv.y;
          bp.z += bv.z;

          // Outfield fielders move towards their target to defend !
          const speed = cpuLevel.id === 'EASY' ? 0.35 : cpuLevel.id === 'NORMAL' ? 0.5 : 0.65;
          setFielders(prev => prev.map(f => {
            const dx = f.target.x - f.pos.x;
            const dz = f.target.z - f.pos.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist > 0.5) {
              return {
                ...f,
                pos: {
                  x: f.pos.x + (dx / dist) * speed,
                  y: f.pos.y,
                  z: f.pos.z + (dz / dist) * speed
                }
              };
            }
            return f;
          }));

          // Track if outfielder caught the ball before bouncing
          // If y approaches <= 0
          if (bp.y <= 0) {
            bp.y = 0; // lock on ground

            // Evaluate if any outfielder gets close enough before/at bounce to make a clean catch!
            let caught = false;
            let makingPlayFielder = '';
            fielders.forEach(f => {
              const dX = f.pos.x - bp.x;
              const dZ = f.pos.z - bp.z;
              const gap = Math.sqrt(dX*dX + dZ*dZ);
              // Catches ball if outfielder is within 3.5 meters
              if (gap < 4.0 && ball.vel.y < 0) {
                caught = true;
                makingPlayFielder = f.name;
              }
            });

            // Is it out or hit?
            setBall(null);
            
            // Check FOUL lines: standard baseball baseline runs at ~45 degree angles
            // If ball landing spot is beyond bounds limits:
            const angleFromPlate = Math.abs(bp.x / (bp.z - 12));
            const isFoul = angleFromPlate > 1.04; // Outer bounds limit (~45 degrees)

            if (isFoul) {
              setResultText('FOUL BALL');
              setResultSubtitle('ファウルゾーン');
              setShowResultBanner(true);
              setPlayState('SWING_RESULT');
              
              gameAudio.playBallCall();
              setTimeout(() => {
                onPlayResult({ type: 'FOUL' });
              }, 1200);

            } else if (caught) {
              // Outfield flyout!
              gameAudio.playCatch();
              gameAudio.playOutCall();

              setResultText('OUT!');
              setResultSubtitle(`${makingPlayFielder}がキャッチ！ キャッチアウト`);
              setShowResultBanner(true);
              setPlayState('SWING_RESULT');

              setTimeout(() => {
                onPlayResult({ type: 'OUT' });
              }, 1600);

            } else {
              // The ball bounced on the grass ground - evaluate hit types based on distance!
              // Home Run Wall sits at z = 100 meters
              if (bp.z >= 95) {
                // HOME RUN!
                gameAudio.playHomerunTheme();
                setResultText('HOME RUN!!!');
                setResultSubtitle('超特大のホームラン！！');
                setShowResultBanner(true);
                setPlayState('SWING_RESULT');
                setScreenShake(8);

                setTimeout(() => {
                  onPlayResult({ type: 'HOMERUN' });
                }, 2200);
              } else {
                // Infield/Outfield bounce - Single, Double, or Triple based on how deep it hit
                gameAudio.playCatch();
                
                let hitType: 'SINGLE' | 'DOUBLE' | 'TRIPLE' = 'SINGLE';
                let msg = '1塁打ヒット！';

                if (bp.z > 70) {
                  hitType = 'TRIPLE';
                  msg = '3塁打！スーパーヒット！';
                } else if (bp.z > 45) {
                  hitType = 'DOUBLE';
                  msg = 'ライト/レフトを破る2塁打！';
                }

                setResultText('HIT!');
                setResultSubtitle(msg);
                setShowResultBanner(true);
                setPlayState('SWING_RESULT');

                setTimeout(() => {
                  onPlayResult({ type: hitType });
                }, 1800);
              }
            }
          } else {
            // Ball continues high trajectory
            setBall({ ...ball, pos: bp, vel: bv });
          }
        }
      }
    };

    const interval = setInterval(tick, 1000 / 45); // highly responsive 45 Frames Per Second
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [ball, playState, swingFrame, cpuSwingFrame, cpuSwingTriggered, pitchTarget, pitchType, batPos, fielders, match.currentRole]);

  // Canvas drawing effect called on state changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Apply overall camera shake
    ctx.save();
    if (screenShake > 0) {
      const dx = (Math.random() - 0.5) * screenShake * 2;
      const dy = (Math.random() - 0.5) * screenShake * 2;
      ctx.translate(dx, dy);
    }

    // Clear canvas
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    // PERSPECTIVE PROJECTION UTILITIES
    const focalLength = 300;
    
    // Determine whether we are in Pitcher Perspective (Pitcher is human and ball is not hit yet)
    const isPitchingView = match.currentRole === 'PITCHING' && playState !== 'BALL_FLIGHT' && playState !== 'RUNNER_ADVANCE';

    const project = (v: Vector3D) => {
      let pz = v.z;
      if (isPitchingView) {
        // Reverse mapping for pitcher visual view: Camera sits behind pitcher mound
        pz = 72 - v.z;
        // If elements are physically behind our pitcher camera (e.g., outfield wall v.z > 72),
        // we map them safely into the deep visual backdrop to avoid graphical distortion
        if (pz < 10) {
          pz = 100 + Math.abs(pz);
        }
      }

      // Scale based on depth (z)
      const scale = focalLength / (focalLength + pz);
      
      // Canvas center offset
      const cx = WIDTH / 2;
      const cy = HEIGHT * 0.72; // Pitching plate ground level is near 72% down

      const screenX = cx + v.x * scale * 15; // standard scaling multiplier
      const screenY = cy - v.y * scale * 15;

      return {
        x: screenX,
        y: screenY,
        scale: scale
      };
    };

    // DRAW STADIUM SKY & BACKGROUND SEATS
    // Sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, HEIGHT * 0.4);
    skyGrad.addColorStop(0, '#091535'); // deep dark stadium atmosphere
    skyGrad.addColorStop(1, '#1b2f63');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Stadium lighting glow effects
    const drawLight = (lx: number, ly: number) => {
      ctx.beginPath();
      const radial = ctx.createRadialGradient(lx, ly, 2, lx, ly, 45);
      radial.addColorStop(0, 'rgba(255, 255, 240, 1)');
      radial.addColorStop(0.3, 'rgba(255, 255, 220, 0.45)');
      radial.addColorStop(1, 'rgba(255, 255, 220, 0)');
      ctx.fillStyle = radial;
      ctx.arc(lx, ly, 45, 0, Math.PI * 2);
      ctx.fill();

      // draw small metal structure
      ctx.fillStyle = '#333';
      ctx.fillRect(lx - 12, ly - 4, 24, 6);
    };

    drawLight(80, 50);
    drawLight(220, 45);
    drawLight(WIDTH - 220, 45);
    drawLight(WIDTH - 80, 50);

    // Spectator stands semicircles matching the baseball arc
    ctx.fillStyle = '#1e2439';
    ctx.beginPath();
    ctx.moveTo(0, HEIGHT * 0.45);
    ctx.quadraticCurveTo(WIDTH / 2, HEIGHT * 0.28, WIDTH, HEIGHT * 0.45);
    ctx.lineTo(WIDTH, HEIGHT * 0.75);
    ctx.lineTo(0, HEIGHT * 0.75);
    ctx.closePath();
    ctx.fill();

    // Thousands of glowing fans pixels (spectator seating sparkles!)
    ctx.save();
    ctx.globalAlpha = 0.55;
    for (let col = 10; col < WIDTH; col += 18) {
      // determine ground height curve
      const standsTopY = HEIGHT * 0.36 + Math.pow(col - WIDTH/2, 2) * 0.00015;
      for (let row = standsTopY; row < HEIGHT * 0.65; row += 10) {
        ctx.fillStyle = (col + Math.floor(row)) % 3 === 0 ? '#b91c1c' : (col + Math.floor(row)) % 5 === 0 ? '#1d4ed8' : '#dedede';
        ctx.fillRect(col, row, 3, 3);
      }
    }
    ctx.restore();

    // DRAW BASEBALL INFIELD CLAY & OUTFIELD LAWN
    // Outfield curved wall
    const wallLeft = project({ x: -120, y: 0, z: 110 });
    const wallCenter = project({ x: 0, y: 0, z: 115 });
    const wallRight = project({ x: 120, y: 0, z: 110 });

    ctx.fillStyle = '#065f46'; // beautiful green grass turf
    ctx.beginPath();
    ctx.moveTo(wallLeft.x, wallLeft.y);
    ctx.quadraticCurveTo(wallCenter.x, wallCenter.y, wallRight.x, wallRight.y);
    ctx.lineTo(WIDTH, HEIGHT);
    ctx.lineTo(0, HEIGHT);
    ctx.closePath();
    ctx.fill();

    // Draw dark green grass rings to simulate beautiful lawn stripe patterns
    ctx.fillStyle = '#047857';
    for (let rZ = 100; rZ >= 20; rZ -= 16) {
      ctx.beginPath();
      const ptLeft = project({ x: -100, y: 0, z: rZ });
      const ptCenter = project({ x: 0, y: 0, z: rZ });
      const ptRight = project({ x: 100, y: 0, z: rZ });
      
      const ptLeftFar = project({ x: -100, y: 0, z: rZ - 8 });
      const ptCenterFar = project({ x: 0, y: 0, z: rZ - 8 });
      const ptRightFar = project({ x: 100, y: 0, z: rZ - 8 });

      ctx.moveTo(ptLeft.x, ptLeft.y);
      ctx.quadraticCurveTo(ptCenter.x, ptCenter.y, ptRight.x, ptRight.y);
      ctx.lineTo(ptRightFar.x, ptRightFar.y);
      ctx.quadraticCurveTo(ptCenterFar.x, ptCenterFar.y, ptLeftFar.x, ptLeftFar.y);
      ctx.closePath();
      ctx.fill();
    }

    // Draw Infield Dirt Diamond
    const homeBase = project({ x: 0, y: 0, z: 12 });
    const firstBase = project({ x: 18, y: 0, z: 35 });
    const secondBase = project({ x: 0, y: 0, z: 58 });
    const thirdBase = project({ x: -18, y: 0, z: 35 });

    ctx.fillStyle = '#bf7e51'; // rich orange brown baseball sand
    ctx.beginPath();
    ctx.moveTo(homeBase.x, homeBase.y);
    ctx.lineTo(firstBase.x, firstBase.y);
    ctx.lineTo(secondBase.x, secondBase.y);
    ctx.lineTo(thirdBase.x, thirdBase.y);
    ctx.closePath();
    ctx.fill();

    // Grass inside diamond
    const shortIntOffset = 4.5;
    const homeBaseInt = project({ x: 0, y: 0, z: 16 });
    const firstBaseInt = project({ x: 18 - shortIntOffset, y: 0, z: 35 });
    const secondBaseInt = project({ x: 0, y: 0, z: 58 - shortIntOffset });
    const thirdBaseInt = project({ x: -18 + shortIntOffset, y: 0, z: 35 });

    ctx.fillStyle = '#065f46';
    ctx.beginPath();
    ctx.moveTo(homeBaseInt.x, homeBaseInt.y);
    ctx.lineTo(firstBaseInt.x, firstBaseInt.y);
    ctx.lineTo(secondBaseInt.x, secondBaseInt.y);
    ctx.lineTo(thirdBaseInt.x, thirdBaseInt.y);
    ctx.closePath();
    ctx.fill();

    // Base Line white lines
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(homeBase.x, homeBase.y);
    const leftLimit = project({ x: -90, y: 0, z: 110 });
    ctx.lineTo(leftLimit.x, leftLimit.y);
    ctx.moveTo(homeBase.x, homeBase.y);
    const rightLimit = project({ x: 90, y: 0, z: 110 });
    ctx.lineTo(rightLimit.x, rightLimit.y);
    ctx.stroke();

    // Draw actual white base pads
    const drawBasePad = (pt: { x: number; y: number; scale: number }) => {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#cccccc';
      ctx.lineWidth = 1;

      const size = 6 * pt.scale;
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y - size);
      ctx.lineTo(pt.x + size * 1.4, pt.y);
      ctx.lineTo(pt.x, pt.y + size);
      ctx.lineTo(pt.x - size * 1.4, pt.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    };

    drawBasePad(homeBase);
    
    // Highlight base pads if there is a runner!
    if (match.runners[0]) {
      ctx.shadowColor = '#eab308';
      ctx.shadowBlur = 10;
    }
    drawBasePad(firstBase);
    ctx.shadowBlur = 0;

    if (match.runners[1]) {
      ctx.shadowColor = '#eab308';
      ctx.shadowBlur = 10;
    }
    drawBasePad(secondBase);
    ctx.shadowBlur = 0;

    if (match.runners[2]) {
      ctx.shadowColor = '#eab308';
      ctx.shadowBlur = 10;
    }
    drawBasePad(thirdBase);
    ctx.shadowBlur = 0;

    // Pitcher Mound Rubber
    const moundRubber = project({ x: 0, y: 0, z: 38 });
    ctx.fillStyle = '#bf7e51'; // Mound mud circle
    ctx.beginPath();
    ctx.arc(moundRubber.x, moundRubber.y, 16 * moundRubber.scale, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff'; // rubber bar
    ctx.fillRect(moundRubber.x - 7 * moundRubber.scale, moundRubber.y - 1, 14 * moundRubber.scale, 2.5);

    // DRAW BASEBALL WALL DISTANCE MARKERS & TEXT
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    
    const labelL = project({ x: -45, y: 3, z: 108 });
    ctx.fillText('95m (レフト)', labelL.x, labelL.y);

    const labelC = project({ x: 0, y: 3, z: 115 });
    ctx.fillText('115m (センター)', labelC.x, labelC.y);

    const labelR = project({ x: 45, y: 3, z: 108 });
    ctx.fillText('95m (ライト)', labelR.x, labelR.y);

    // DRAW PLAYERS (PITCHER & BATTER)
    // 1. CPU Pitcher on the Mound
    const pitcherPos = project({ x: 0, y: 1.5, z: 38 });
    if (playState !== 'BALL_FLIGHT') {
      // Windup animation based on timing
      const windupOffset = (playState === 'PITCHER_WINDUP') ? Math.sin(Date.now() * 0.01) * 2 : 0;
      
      // Face circle
      ctx.fillStyle = '#fbcfe8';
      ctx.beginPath();
      ctx.arc(pitcherPos.x, pitcherPos.y - 15 * pitcherPos.scale, 5 * pitcherPos.scale, 0, Math.PI * 2);
      ctx.fill();
      
      // Caps (blue)
      ctx.fillStyle = '#1d4ed8';
      ctx.beginPath();
      ctx.arc(pitcherPos.x, pitcherPos.y - 16 * pitcherPos.scale, 5.5 * pitcherPos.scale, Math.PI, 0);
      ctx.fill();

      // Jersey (white structure)
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 6 * pitcherPos.scale;
      ctx.beginPath();
      ctx.moveTo(pitcherPos.x, pitcherPos.y - 10 * pitcherPos.scale);
      ctx.lineTo(pitcherPos.x, pitcherPos.y + 2 * pitcherPos.scale);
      ctx.stroke();

      // Thrown Hand
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3.5 * pitcherPos.scale;
      ctx.beginPath();
      ctx.moveTo(pitcherPos.x, pitcherPos.y - 8 * pitcherPos.scale);
      // animated windup throwing hand
      ctx.lineTo(pitcherPos.x - 6 * pitcherPos.scale, pitcherPos.y - (8 + windupOffset) * pitcherPos.scale);
      ctx.stroke();

      // Leg shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(pitcherPos.x - 3 * pitcherPos.scale, pitcherPos.y + 4, 6 * pitcherPos.scale, 2);
    }

    // 2. Batter in Batter Box (Foreground)
    const batterPosRealX = match.currentRole === 'BATTING' ? -3.0 : 3.0; // Left side or Right side stance
    const batterVisualPos = project({ x: batterPosRealX, y: 1.2, z: 13.5 });
    
    // Draw Batter stance
    if (playState !== 'BALL_FLIGHT') {
      // Face
      ctx.fillStyle = '#fed7aa';
      ctx.beginPath();
      ctx.arc(batterVisualPos.x, batterVisualPos.y - 32 * batterVisualPos.scale, 10 * batterVisualPos.scale, 0, Math.PI * 2);
      ctx.fill();

      // Helmet (Red or blue depending on CPU/Player role)
      ctx.fillStyle = match.currentRole === 'BATTING' ? '#dc2626' : '#2563eb';
      ctx.beginPath();
      ctx.arc(batterVisualPos.x, batterVisualPos.y - 35 * batterVisualPos.scale, 11 * batterVisualPos.scale, Math.PI * 1.1, Math.PI * 1.9);
      ctx.fill();

      // Jersey
      ctx.strokeStyle = match.currentRole === 'BATTING' ? '#ef4444' : '#3b82f6';
      ctx.lineWidth = 14 * batterVisualPos.scale;
      ctx.beginPath();
      ctx.moveTo(batterVisualPos.x, batterVisualPos.y - 22 * batterVisualPos.scale);
      ctx.lineTo(batterVisualPos.x, batterVisualPos.y + 5 * batterVisualPos.scale);
      ctx.stroke();

      // BAT DRAWING
      const isSwingAnimating = match.currentRole === 'BATTING' ? swingFrame >= 0 : cpuSwingFrame >= 0;
      const actFrame = match.currentRole === 'BATTING' ? swingFrame : cpuSwingFrame;
      
      ctx.save();
      ctx.translate(batterVisualPos.x, batterVisualPos.y - 18 * batterVisualPos.scale);
      
      let batAngle = -1.2; // default resting position
      if (isSwingAnimating) {
        // Sweep bat quickly from 1.2 to 2.2 radians
        batAngle = -1.2 + (actFrame / 10) * Math.PI * 1.2;
      }
      
      ctx.rotate(batAngle);
      
      // Draw Bat trail during active swing
      if (isSwingAnimating && actFrame > 0 && actFrame < 8) {
        ctx.strokeStyle = 'rgba(234, 179, 8, 0.45)';
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.arc(0, 0, 48 * batterVisualPos.scale, -1.2, batAngle, false);
        ctx.stroke();
      }

      // Draw Wooden Bat
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 4;
      
      // Bat grip
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(12, 0);
      ctx.stroke();

      // Bat barrel
      ctx.strokeStyle = '#d97706'; // nice wood amber color
      ctx.lineWidth = 6.5;
      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.lineTo(48 * batterVisualPos.scale, 0);
      ctx.stroke();

      ctx.restore();
    }

    // DRAW OUTFIELDERS RUNNING
    fielders.forEach(f => {
      const fPt = project(f.pos);
      
      // Fielder Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(fPt.x, fPt.y, 8 * fPt.scale, 3 * fPt.scale, 0, 0, Math.PI * 2);
      ctx.fill();

      // Jersey body
      ctx.fillStyle = match.currentRole === 'PITCHING' ? '#eb4034' : '#1d4ed8'; // CPU red, Player blue
      ctx.beginPath();
      ctx.arc(fPt.x, fPt.y - 12 * fPt.scale, 6 * fPt.scale, 0, Math.PI * 2);
      ctx.fill();

      // Pants (white)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(fPt.x - 3 * fPt.scale, fPt.y - 7, 6 * fPt.scale, 7);

      // Label text
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.font = '8px sans-serif';
      ctx.fillText(f.name, fPt.x, fPt.y - 20 * fPt.scale);
    });

    // DRAW THE BALL IN FLIGHT WITH SATISFYING DEPTH SHADOWS & PERSPECTIVE
    if (ball) {
      // 1. Draw Ground Shadow of the Ball (Critical for perspective depth perception!)
      const shadowPos = project({ x: ball.pos.x, y: 0, z: ball.pos.z });
      const currentScale = shadowPos.scale;
      
      ctx.fillStyle = 'rgba(0,0,0,0.32)';
      ctx.beginPath();
      const shadowRadius = Math.max(2, 8 * currentScale - (ball.pos.y * 1.5));
      ctx.ellipse(shadowPos.x, shadowPos.y, shadowRadius, shadowRadius * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();

      // 2. Draw Trajectory Line behind Ball
      if (prevBallPos.length > 1) {
        ctx.beginPath();
        const startProj = project(prevBallPos[0]);
        ctx.moveTo(startProj.x, startProj.y);
        for (let idx = 1; idx < prevBallPos.length; idx++) {
          const nextProj = project(prevBallPos[idx]);
          ctx.lineTo(nextProj.x, nextProj.y);
        }
        ctx.strokeStyle = ball.isHit ? 'rgba(254, 240, 138, 0.45)' : 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = ball.isHit ? 3.5 : 1.8;
        ctx.stroke();
      }

      // 3. Draw Actual 3D Ball
      const ballProj = project(ball.pos);
      const projR = Math.max(3, 10 * ballProj.scale);

      ctx.save();
      // Glow on ball if hit
      if (ball.isHit) {
        ctx.shadowColor = '#fef08a';
        ctx.shadowBlur = 12;
      }

      // Red stitchings on White baseball
      ctx.fillStyle = '#fcfcfc';
      ctx.beginPath();
      ctx.arc(ballProj.x, ballProj.y, projR, 0, Math.PI * 2);
      ctx.fill();

      // simple shadow overlay inside ball
      const radial = ctx.createRadialGradient(
        ballProj.x - projR * 0.3, ballProj.y - projR * 0.3, projR * 0.1,
        ballProj.x, ballProj.y, projR
      );
      radial.addColorStop(0, 'rgba(255, 255, 255, 1)');
      radial.addColorStop(0.7, 'rgba(240, 240, 240, 1)');
      radial.addColorStop(1, 'rgba(160, 160, 160, 0.4)');
      ctx.fillStyle = radial;
      ctx.beginPath();
      ctx.arc(ballProj.x, ballProj.y, projR, 0, Math.PI * 2);
      ctx.fill();

      // Red lining stitchings
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 0.55;
      ctx.beginPath();
      ctx.arc(ballProj.x - projR*0.2, ballProj.y, projR*0.8, -Math.PI*0.35, Math.PI*0.35);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(ballProj.x + projR*0.2, ballProj.y, projR*0.8, Math.PI*0.65, Math.PI*1.35);
      ctx.stroke();

      // Draw shrinking timing circle around the ball to assist with swinging timing
      if (playState === 'PITCH_FLIGHT' && !ball.isHit && match.currentRole === 'BATTING') {
        const timingProgress = Math.max(0, (ball.pos.z - 12) / (60 - 12));
        
        ctx.save();
        // Inner radius of the timing helper
        const ringRadius = projR * (1.0 + timingProgress * 5.0);
        
        // Define color based on perfect timing window
        const isPerfectWindow = ball.pos.z >= 9.5 && ball.pos.z <= 17.5;
        
        ctx.beginPath();
        ctx.arc(ballProj.x, ballProj.y, ringRadius, 0, Math.PI * 2);
        
        if (isPerfectWindow) {
          ctx.strokeStyle = '#22c55e'; // vibrant neon green
          ctx.lineWidth = 3;
          ctx.shadowColor = '#22c55e';
          ctx.shadowBlur = 12;
        } else {
          ctx.strokeStyle = timingProgress < 0.25 ? '#eab308' : '#38bdf8'; // yellow when close, light blue when far
          ctx.lineWidth = 1.8;
          ctx.shadowColor = timingProgress < 0.25 ? '#eab308' : '#38bdf8';
          ctx.shadowBlur = 6;
        }
        
        ctx.stroke();
        
        // Add a secondary dashed ring slightly outer to make it look futuristic and clean
        if (timingProgress > 0.02) {
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.arc(ballProj.x, ballProj.y, ringRadius + 6, 0, Math.PI * 2);
          ctx.strokeStyle = isPerfectWindow ? 'rgba(34, 197, 94, 0.45)' : 'rgba(255, 255, 255, 0.2)';
          ctx.lineWidth = 1.2;
          ctx.stroke();
          ctx.setLineDash([]);
        }
        
        // Let's also render a "TIMING" helper text above the ball!
        ctx.fillStyle = isPerfectWindow ? '#22c55e' : 'rgba(255, 255, 255, 0.55)';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(isPerfectWindow ? '打て！ (SWING!!!)' : '待て (WAIT)', ballProj.x, ballProj.y - projR - 12);

        ctx.restore();
      }

      ctx.restore();
    }

    // DRAW STRIKE ZONE GUIDE BOX (only if human batting or throwing pitch target)
    const showGuide = (match.currentRole === 'BATTING' && playState === 'PITCH_FLIGHT') || 
                      (match.currentRole === 'PITCHING' && playState === 'PITCHER_WINDUP' && pitchStep === 'COURSE');

    if (showGuide) {
      // 3D strike zone projection parameters
      // standard coordinates matching home plate: width at -1 to 1, height at 0.5 to 1.7
      const tl = project({ x: -1.0, y: 1.5, z: 12 });
      const br = project({ x: 1.0, y: -0.1, z: 12 });
      const szW = br.x - tl.x;
      const szH = br.y - tl.y; // note physical height goes down in negative y coordinate projection

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(tl.x, tl.y, szW, szH);

      // outer bounding zone
      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.fillRect(tl.x, tl.y, szW, szH);

      // Draw inside 3x3 dashed grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.setLineDash([4, 4]);
      
      // vertical grid lines
      ctx.beginPath();
      ctx.moveTo(tl.x + szW / 3, tl.y);
      ctx.lineTo(tl.x + szW / 3, br.y);
      ctx.moveTo(tl.x + (szW / 3) * 2, tl.y);
      ctx.lineTo(tl.x + (szW / 3) * 2, br.y);
      // horizontal
      ctx.moveTo(tl.x, tl.y + szH / 3);
      ctx.lineTo(br.x, tl.y + szH / 3);
      ctx.moveTo(tl.x, tl.y + (szH / 3) * 2);
      ctx.lineTo(br.x, tl.y + (szH / 3) * 2);
      ctx.stroke();
      ctx.setLineDash([]); // reset

      // Strike zone title label
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.font = '8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('STRIKE ZONE', WIDTH / 2, tl.y - 5);
    }

    // DRAW IN-GAME INTERACTIVE TARGET BARS (BASED ON STATE)
    if (match.currentRole === 'BATTING' && playState === 'PITCH_FLIGHT') {
      // BATTING: DRAW HIGHLIGHTED USER BATTING CURSOR AT CURSOR LOCATION (batPos)
      const cursorProj = project({ x: batPos.x, y: batPos.y, z: 12 });
      
      // Custom green styling for the bat sweet spot circle
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#22c55e';
      ctx.shadowBlur = 8;
      
      ctx.beginPath();
      ctx.arc(cursorProj.x, cursorProj.y, 22, 0, Math.PI * 2);
      ctx.stroke();

      // inner sweetspot target dot
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(cursorProj.x, cursorProj.y, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0; // reset
    }

    if (match.currentRole === 'PITCHING' && playState === 'PITCHER_WINDUP' && pitchStep === 'COURSE') {
      // PITCHING target marker selected by client
      const targetProj = project({ x: pitchTarget.x, y: pitchTarget.y + 1.0, z: 12 });

      ctx.strokeStyle = '#dc2626'; // bold pitch target
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(targetProj.x, targetProj.y, 14, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.arc(targetProj.x, targetProj.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }, [match, playState, batPos, swingFrame, cpuSwingFrame, pitchTarget, pitchType, ball, prevBallPos, fielders, screenShake, cpuLevel, pitchStep]);

  // Click handler on Canvas
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (match.currentRole === 'PITCHING' && playState === 'PITCHER_WINDUP' && pitchStep === 'COURSE') {
      // map canvas coordinates back to pitching target space
      // Account for pitcher perspective's smaller visual home plate scale to align the target precisely
      const isPitchingView = true;
      const sensitivityMult = 0.8333 / 0.9615;
      const divisorX = 60 * sensitivityMult;
      const divisorY = 50 * sensitivityMult;

      const mappedX = ((x - WIDTH / 2) / divisorX);
      const mappedY = -((y - HEIGHT * 0.72) / divisorY) - 1.0;

      const finalTarget = {
        x: Math.max(-1.8, Math.min(1.8, mappedX)),
        y: Math.max(-1.8, Math.min(1.8, mappedY))
      };

      setPitchTarget(finalTarget);
      handleThrowPitchWithCoords(finalTarget);
    }

    if (match.currentRole === 'BATTING' && playState === 'PITCH_FLIGHT') {
      // Clicking triggers swinging!
      triggerSwing();
    }
  };

  // Mouse move handler on Canvas
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (match.currentRole === 'BATTING' && playState === 'PITCH_FLIGHT') {
      // intuitive mouse tracking for batting cursor without auto-swinging
      const mappedX = ((x - WIDTH / 2) / 60);
      const mappedY = -((y - HEIGHT * 0.72) / 40);
      setBatPos({
        x: Math.max(-2, Math.min(2, mappedX)),
        y: Math.max(-1.8, Math.min(2, mappedY))
      });
    }

    if (match.currentRole === 'PITCHING' && playState === 'PITCHER_WINDUP' && pitchStep === 'COURSE') {
      // track target reticle with cursor position
      // Account for pitcher perspective's smaller visual home plate scale
      const isPitchingView = true;
      const sensitivityMult = 0.8333 / 0.9615;
      const divisorX = 60 * sensitivityMult;
      const divisorY = 50 * sensitivityMult;

      const mappedX = ((x - WIDTH / 2) / divisorX);
      const mappedY = -((y - HEIGHT * 0.72) / divisorY) - 1.0;
      setPitchTarget({
        x: Math.max(-1.8, Math.min(1.8, mappedX)),
        y: Math.max(-1.8, Math.min(1.8, mappedY))
      });
    }
  };

  return (
    <div className="relative bg-[#0c0e14] rounded-xl overflow-hidden shadow-[0_4px_30px_rgba(0,0,0,0.8)] border border-slate-800 flex flex-col items-center">
      
      {/* Audio & Quick status controls */}
      <div className="absolute top-3 right-3 z-20 flex gap-2">
        <button
          onClick={handleToggleMute}
          className="p-2 bg-[#13161c]/95 hover:bg-[#1a1c24] text-slate-400 hover:text-white rounded-lg backdrop-blur border border-slate-800 transition-all flex items-center gap-1.5 text-xs font-semibold"
          title="オーディオ調整"
        >
          {isMuted ? <VolumeX size={15} className="text-rose-500" /> : <Volume2 size={15} className="text-amber-500" />}
          音量をオン・オフ
        </button>
      </div>

      {/* Main Canvas Workspace */}
      <div className="relative w-full overflow-hidden select-none cursor-crosshair">
        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          onClick={handleCanvasClick}
          onMouseMove={(e) => {
            // Track mouse to move batting cursor in flight or pitching target in windup
            if (playState === 'PITCH_FLIGHT' && match.currentRole === 'BATTING') {
              handleCanvasMouseMove(e);
            } else if (playState === 'PITCHER_WINDUP' && match.currentRole === 'PITCHING') {
              handleCanvasMouseMove(e);
            }
          }}
          className="w-full h-auto aspect-video block bg-[#0c0e14]"
          id="stadium-game-canvas"
        />

        {/* Big HUD instruction on start */}
        {playState === 'PITCHER_WINDUP' && match.currentRole === 'BATTING' && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 px-4 py-2 bg-[#13161c]/95 backdrop-blur rounded-xl border border-amber-500/30 text-white text-xs font-semibold text-center pointer-events-none flex items-center gap-2 shadow-[0_4px_24px_rgba(245,158,11,0.15)] animate-fade-in">
            <Swords size={14} className="text-amber-500 animate-pulse" />
            <span>CPUピッチャーが投球します！マウス操作、または [矢印キー] でカーソルを動かし、クリックか [スペースキー] でスイング！</span>
          </div>
        )}

        {/* Pitching STEP 1: PITCH TYPE SELECTION */}
        {playState === 'PITCHER_WINDUP' && match.currentRole === 'PITCHING' && pitchStep === 'TYPE' && (
          <div className="absolute inset-x-0 bottom-4 flex justify-center z-10 p-4 animate-fade-in">
            <div className="bg-[#13161c]/95 backdrop-blur-md border border-slate-800 p-4 rounded-xl shadow-2xl w-[90%] max-w-md flex flex-col items-center">
              <span className="text-amber-500 text-[10px] font-black tracking-widest flex items-center gap-1.5 mb-1.5 uppercase">
                <Zap size={12} className="fill-amber-500 stroke-amber-500 animate-pulse" /> PITCH SELECT
              </span>
              <h2 className="text-xs font-bold mb-3 text-slate-200 text-center">投げる球種を選択してください</h2>
              
              <div className="grid grid-cols-4 gap-2 w-full">
                {(['FAST', 'CURVE', 'SLIDER', 'FORK'] as PitchType[]).map((type) => {
                  const names: Record<PitchType, string> = {
                    FAST: 'ストレート',
                    CURVE: 'カーブ',
                    SLIDER: 'スライダー',
                    FORK: 'フォーク',
                  };
                  return (
                    <button
                      key={type}
                      onClick={() => {
                        setPitchType(type);
                        setPitchStep('COURSE');
                        gameAudio.playCatch();
                      }}
                      className="py-2.5 rounded-lg text-xs font-bold bg-[#0c0e14] border border-slate-800 hover:bg-slate-900 text-slate-300 hover:text-white hover:border-slate-700 transition-all active:scale-95 cursor-pointer"
                    >
                      {names[type]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Pitching STEP 2: COURSE SELECTION & PITCH THROWS */}
        {playState === 'PITCHER_WINDUP' && match.currentRole === 'PITCHING' && pitchStep === 'COURSE' && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 px-4 py-2.5 bg-[#13161c]/95 backdrop-blur-md rounded-xl border border-amber-500/30 text-white text-[11px] font-semibold text-center flex flex-col sm:flex-row items-center gap-2 shadow-[0_4px_24px_rgba(245,158,11,0.2)] animate-fade-in w-[90%] sm:w-auto">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
              <span>球種: <strong className="text-amber-400 font-extrabold">
                {pitchType === 'FAST' ? 'ストレート' : pitchType === 'CURVE' ? 'カーブ' : pitchType === 'SLIDER' ? 'スライダー' : 'フォーク'}
              </strong></span>
            </div>
            <span className="text-slate-600 hidden sm:inline">|</span>
            <span className="text-slate-300">
              コース（赤い輪）を狙って <strong className="text-yellow-400 font-extrabold">画面をクリック</strong> すると投球します！
            </span>
            <button
              onClick={() => setPitchStep('TYPE')}
              className="px-2 py-0.5 mt-1 sm:mt-0 text-[9px] font-black bg-slate-800 hover:bg-slate-700 text-slate-350 rounded border border-slate-700 active:scale-95 transition-all cursor-pointer"
            >
              球種変更
            </button>
          </div>
        )}

        {/* Dynamic Big Match Outcome Board Banner Overlay */}
        {showResultBanner && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[1.5px] flex flex-col justify-center items-center z-15 select-none pointer-events-none animate-fade-in">
            <div className={`p-6 px-12 rounded-2xl text-center shadow-2xl border flex flex-col items-center gap-1.5 transition-all duration-300 ${
              resultText.includes('STRIKE') ? 'bg-rose-950/95 border-rose-500/40 text-rose-200 shadow-[0_0_30px_rgba(239,68,68,0.4)]' :
              resultText.includes('BALL') ? 'bg-amber-950/95 border-amber-500/40 text-amber-200 shadow-[0_0_30px_rgba(245,158,11,0.4)]' :
              resultText.includes('HOME RUN') ? 'bg-emerald-950/95 border-emerald-500/40 text-emerald-200 scale-110 animate-bounce shadow-[0_0_40px_rgba(16,185,129,0.5)]' :
              resultText.includes('HIT') ? 'bg-emerald-950/95 border-emerald-700/50 text-emerald-200 shadow-[0_0_30px_rgba(16,185,129,0.4)]' :
              'bg-[#13161c]/95 border-slate-800 text-slate-200 shadow-[0_0_20px_rgba(0,0,0,0.6)]'
            }`}>
              <h1 className="text-4xl md:text-5xl font-black tracking-widest text-white drop-shadow-lg scale-[1.05] uppercase">{resultText}</h1>
              <p className="text-sm text-yellow-500 font-black">{resultSubtitle}</p>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

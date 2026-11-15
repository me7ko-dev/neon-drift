import React, { useEffect, useRef, useState } from 'react';
import { GameHud } from './components/GameHud';
import { GameOverModal } from './components/GameOverModal';
import { PauseModal } from './components/PauseModal';
import { StartOverlay } from './components/StartOverlay';
import { TouchControls } from './components/TouchControls';
import { NeonDriftEngine } from './game/NeonDriftEngine';
import { BASE_SPEED, SPEED_TO_KMH, loadBestScore } from './game/simulation';
import { HudSnapshot } from './game/types';

function shouldAutostart(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('autostart') === '1';
}

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<NeonDriftEngine | null>(null);

  const [contextLost, setContextLost] = useState(false);
  const [hud, setHud] = useState<HudSnapshot>(() => ({
    phase: shouldAutostart() ? 'playing' : 'title',
    score: 0,
    bestScore: loadBestScore(),
    coins: 0,
    speedKmh: Math.round(BASE_SPEED * SPEED_TO_KMH),
    maxSpeedKmh: Math.round(BASE_SPEED * SPEED_TO_KMH),
    distanceMeters: 0,
    isNewBest: false,
    muted: false,
  }));

  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const engine = new NeonDriftEngine(
      mount,
      (snapshot) => setHud(snapshot),
      shouldAutostart(),
      (lost) => setContextLost(lost),
    );
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  return (
    <main className="relative w-full h-full overflow-hidden bg-[#090414]">
      {/* Isolated WebGL canvas container */}
      <div
        ref={canvasMountRef}
        data-testid="game-canvas-mount"
        className="absolute inset-0 w-full h-full"
      />

      {contextLost && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-6 bg-[#090414]/92 text-center">
          <div className="max-w-sm rounded-xl border border-fuchsia-500/40 bg-[#120826] p-6">
            <h2 className="font-display text-xl font-bold text-white">
              Връзката с графиката бе прекъсната
            </h2>
            <p className="mt-2 text-sm text-cyan-100/80">
              Моля, презаредете страницата, за да възстановите 3D визуализацията.
            </p>
          </div>
        </div>
      )}

      {hud.phase === 'title' && (
        <StartOverlay
          bestScore={hud.bestScore}
          muted={hud.muted}
          onStart={() => engineRef.current?.startOrRestart()}
          onToggleMute={() => engineRef.current?.toggleMute()}
        />
      )}

      {hud.phase === 'playing' && (
        <>
          <GameHud
            hud={hud}
            onPause={() => engineRef.current?.pauseGame()}
            onToggleMute={() => engineRef.current?.toggleMute()}
          />
          <TouchControls
            onSteerChange={(dir) => engineRef.current?.setTouchSteer(dir)}
          />
        </>
      )}

      {hud.phase === 'paused' && (
        <PauseModal
          score={hud.score}
          onResume={() => engineRef.current?.resumeGame()}
          onRestart={() => engineRef.current?.startOrRestart()}
          onReturnTitle={() => engineRef.current?.returnToTitle()}
        />
      )}

      {hud.phase === 'gameover' && (
        <GameOverModal
          hud={hud}
          onRestart={() => engineRef.current?.startOrRestart()}
          onReturnTitle={() => engineRef.current?.returnToTitle()}
        />
      )}
    </main>
  );
}

import React from 'react';
import { HudSnapshot } from '../game/types';

interface GameOverModalProps {
  hud: HudSnapshot;
  onRestart: () => void;
  onReturnTitle: () => void;
}

export function GameOverModal({
  hud,
  onRestart,
  onReturnTitle,
}: GameOverModalProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="gameover-title"
      className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-[#070312]/76"
    >
      <div className="w-full max-w-md rounded-xl bg-[#0e0722]/96 border border-fuchsia-500/50 p-6 sm:p-7 shadow-[0_20px_60px_rgba(0,0,0,0.82)] text-center">
        {hud.isNewBest && (
          <p className="font-display text-xs font-extrabold tracking-[0.2em] text-amber-300 uppercase mb-1">
            НОВ РЕКОРД!
          </p>
        )}

        <h2
          id="gameover-title"
          className="font-display text-3xl sm:text-4xl font-extrabold italic tracking-wide text-white"
        >
          КРАЙ НА ИГРАТА
        </h2>
        <p className="mt-1 text-sm text-fuchsia-200/80">
          Сблъсък на неоновата магистрала
        </p>

        {/* Clean 2x2 tabular-nums stats grid */}
        <div className="mt-5 grid grid-cols-2 gap-3 text-left">
          <div className="rounded-lg bg-[#160b31] border border-white/10 px-3.5 py-2.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-fuchsia-300">
              Точки
            </div>
            <div
              data-testid="gameover-score"
              className="font-mono-tabular text-2xl font-bold text-white mt-0.5"
            >
              {hud.score}
            </div>
          </div>

          <div className="rounded-lg bg-[#160b31] border border-white/10 px-3.5 py-2.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-300">
              Най-добър резултат
            </div>
            <div
              data-testid="gameover-best"
              className="font-mono-tabular text-2xl font-bold text-amber-200 mt-0.5"
            >
              {hud.bestScore}
            </div>
          </div>

          <div className="rounded-lg bg-[#160b31] border border-white/10 px-3.5 py-2.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-cyan-300">
              Монети
            </div>
            <div className="font-mono-tabular text-xl font-bold text-white mt-0.5">
              {hud.coins}
            </div>
          </div>

          <div className="rounded-lg bg-[#160b31] border border-white/10 px-3.5 py-2.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-cyan-300">
              Макс. скорост
            </div>
            <div className="font-mono-tabular text-xl font-bold text-white mt-0.5">
              {hud.maxSpeedKmh} <span className="text-xs font-medium text-cyan-200">км/ч</span>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            data-start="true"
            onClick={(e) => {
              e.currentTarget.blur();
              onRestart();
            }}
            className="w-full py-3.5 px-6 rounded-lg bg-[#ff1e8a] text-white border border-[#ff8ac4] shadow-[0_0_20px_rgba(255,30,138,0.45)] font-display font-extrabold text-base tracking-wide hover:bg-[#ff3b98] active:scale-[0.98] transition-all focus-visible:outline-2 focus-visible:outline-cyan-300 cursor-pointer"
          >
            ИГРАЙ ОТНОВО
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onReturnTitle();
            }}
            className="w-full py-2.5 px-5 rounded-lg bg-transparent border border-white/15 text-slate-300 font-semibold text-sm hover:text-white hover:border-white/35 transition-colors focus-visible:outline-2 focus-visible:outline-cyan-300 cursor-pointer"
          >
            Начален екран
          </button>
        </div>
      </div>
    </div>
  );
}

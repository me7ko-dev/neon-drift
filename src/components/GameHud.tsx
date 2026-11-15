import React from 'react';
import { HudSnapshot } from '../game/types';
import { CoinSvgIcon, PauseSvgIcon, SoundSvgIcon } from './Icons';

interface GameHudProps {
  hud: HudSnapshot;
  onPause: () => void;
  onToggleMute: () => void;
}

export function GameHud({ hud, onPause, onToggleMute }: GameHudProps) {
  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-3 sm:p-6">
      <div className="flex items-start justify-between gap-2 sm:gap-4">
        {/* Top-left cluster: Score, Best Score, Coins */}
        <div className="flex flex-col gap-1 sm:gap-1.5 bg-[#0c061a]/84 border border-fuchsia-500/35 rounded-lg px-3 py-2 sm:px-4 sm:py-2.5 shadow-[0_6px_20px_rgba(0,0,0,0.5)] shrink-0">
          <div className="flex items-baseline gap-2.5 sm:gap-3">
            <div>
              <div className="text-[10px] sm:text-[11px] font-semibold tracking-wider text-fuchsia-300 uppercase">
                Точки
              </div>
              <div
                data-testid="hud-score"
                className="font-mono-tabular text-xl sm:text-3xl font-bold text-white leading-none"
              >
                {hud.score}
              </div>
            </div>

            <div className="h-6 sm:h-7 w-px bg-white/15" aria-hidden="true" />

            <div>
              <div className="text-[10px] sm:text-[11px] font-semibold tracking-wider text-amber-300 uppercase">
                Рекорд
              </div>
              <div
                data-testid="hud-best"
                className="font-mono-tabular text-base sm:text-xl font-bold text-amber-200 leading-none"
              >
                {hud.bestScore}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 pt-0.5 text-[11px] sm:text-xs font-semibold text-cyan-200 whitespace-nowrap">
            <CoinSvgIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span>Монети:</span>
            <span data-testid="hud-coins" className="font-mono-tabular text-white font-bold">
              {hud.coins}
            </span>
          </div>
        </div>

        {/* Top-right cluster: Speedometer + compact Pause/Mute buttons */}
        <div className="flex items-start gap-1.5 sm:gap-2.5 shrink-0">
          <div className="bg-[#0c061a]/84 border border-cyan-400/35 rounded-lg px-2.5 py-2 sm:px-3.5 sm:py-2 text-right shadow-[0_6px_20px_rgba(0,0,0,0.5)] whitespace-nowrap">
            <div className="text-[10px] sm:text-[11px] font-semibold tracking-wider text-cyan-300 uppercase">
              Скорост
            </div>
            <div className="flex items-baseline justify-end gap-1 leading-none mt-0.5 whitespace-nowrap">
              <span
                data-testid="hud-speed"
                className="font-mono-tabular text-lg sm:text-2xl font-bold text-white"
              >
                {hud.speedKmh}
              </span>
              <span className="text-[11px] sm:text-xs font-semibold text-cyan-200">км/ч</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 pointer-events-auto shrink-0">
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleMute();
              }}
              aria-label={hud.muted ? 'Включи звука (M)' : 'Изключи звука (M)'}
              title={hud.muted ? 'Включи звука (M)' : 'Изключи звука (M)'}
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-[#0c061a]/85 border border-cyan-400/35 text-cyan-100 flex items-center justify-center hover:border-cyan-300 hover:bg-[#180d33] transition-colors cursor-pointer"
            >
              <SoundSvgIcon muted={hud.muted} className="w-5 h-5" />
            </button>

            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onPause();
              }}
              aria-label="Пауза (P)"
              title="Пауза (P)"
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-[#0c061a]/85 border border-fuchsia-400/35 text-white flex items-center justify-center hover:border-fuchsia-300 hover:bg-[#210b36] transition-colors cursor-pointer"
            >
              <PauseSvgIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

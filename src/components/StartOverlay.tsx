import React from 'react';
import { NeonDriftEmblem, SoundSvgIcon } from './Icons';

interface StartOverlayProps {
  bestScore: number;
  muted: boolean;
  onStart: () => void;
  onToggleMute: () => void;
}

export function StartOverlay({
  bestScore,
  muted,
  onStart,
  onToggleMute,
}: StartOverlayProps) {
  return (
    <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-5 sm:p-8">
      {/* Top bar: quiet utility mute button on top-right */}
      <div className="flex items-start justify-end">
        <button
          type="button"
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleMute();
          }}
          aria-label={muted ? 'Включи звука' : 'Изключи звука'}
          className="pointer-events-auto inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#0d061c]/85 border border-cyan-400/35 text-xs font-semibold text-cyan-100 hover:border-cyan-300 hover:bg-[#170b30] transition-colors focus-visible:outline-2 focus-visible:outline-cyan-300 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <SoundSvgIcon muted={muted} className="w-4 h-4 text-cyan-200" />
          <span>{muted ? 'Звук: Изкл.' : 'Звук: Вкл.'}</span>
        </button>
      </div>

      {/* Upper-center title & primary CTA framed above the cruising supercar */}
      <div className="flex flex-col items-center text-center mb-auto mt-2 sm:mt-4">
        <NeonDriftEmblem />

        <h1 className="font-display text-4xl sm:text-6xl font-extrabold italic tracking-tight text-white hud-text-stroke mt-1 text-balance">
          NEON DRIFT
        </h1>
        <p className="font-display text-base sm:text-xl font-bold tracking-[0.18em] text-cyan-300 hud-text-stroke mt-1">
          НЕОНОВ ДРИФТ
        </p>

        {bestScore > 0 && (
          <div className="mt-3 flex items-center gap-2 text-sm text-amber-300 font-semibold hud-text-stroke">
            <span>Най-добър резултат:</span>
            <span className="font-mono-tabular text-base text-white">{bestScore}</span>
          </div>
        )}

        <div className="mt-6">
          <button
            type="button"
            data-start="true"
            onClick={(e) => {
              e.currentTarget.blur();
              onStart();
            }}
            className="pointer-events-auto font-display text-base sm:text-lg font-extrabold tracking-wide px-8 py-3.5 rounded-lg bg-[#ff1e8a] text-white border-2 border-[#ff8ac4] shadow-[0_0_24px_rgba(255,30,138,0.55)] hover:bg-[#ff3b98] active:scale-[0.98] transition-all focus-visible:outline-2 focus-visible:outline-cyan-300 whitespace-nowrap cursor-pointer"
          >
            ЗАПОЧНИ ИГРАТА
          </button>
        </div>
      </div>

      {/* Flat borderless bottom control hint */}
      <div className="text-center pb-1">
        <p className="text-xs sm:text-sm font-medium text-cyan-100/85 hud-text-stroke">
          <span className="hidden sm:inline">← → или A / D за завиване · P или Esc за пауза · M за звук</span>
          <span className="sm:hidden">Докоснете Наляво / Надясно за управление</span>
        </p>
      </div>
    </div>
  );
}

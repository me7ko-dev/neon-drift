import React from 'react';

interface PauseModalProps {
  score: number;
  onResume: () => void;
  onRestart: () => void;
  onReturnTitle: () => void;
}

export function PauseModal({
  score,
  onResume,
  onRestart,
  onReturnTitle,
}: PauseModalProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-title"
      className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-[#070312]/72"
    >
      <div className="w-full max-w-sm rounded-xl bg-[#0e0722]/96 border border-cyan-400/45 p-6 shadow-[0_18px_50px_rgba(0,0,0,0.75)] text-center">
        <h2
          id="pause-title"
          className="font-display text-3xl font-extrabold italic tracking-wide text-white"
        >
          ПАУЗА
        </h2>
        <p className="mt-1.5 text-sm text-cyan-200/80">
          Текущи точки:{' '}
          <span className="font-mono-tabular font-bold text-white">{score}</span>
        </p>

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onResume();
            }}
            className="w-full py-3 px-5 rounded-lg bg-[#00d9ff] text-[#070312] font-display font-extrabold text-base tracking-wide hover:bg-cyan-300 transition-colors focus-visible:outline-2 focus-visible:outline-white cursor-pointer"
          >
            ПРОДЪЛЖИ
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onRestart();
            }}
            className="w-full py-2.5 px-5 rounded-lg bg-[#1a0d38] border border-fuchsia-400/45 text-white font-semibold text-sm hover:bg-[#271252] transition-colors focus-visible:outline-2 focus-visible:outline-cyan-300 cursor-pointer"
          >
            Рестарт
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

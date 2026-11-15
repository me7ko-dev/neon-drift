import React, { useRef } from 'react';

interface TouchControlsProps {
  onSteerChange: (dir: number) => void;
}

export function TouchControls({ onSteerChange }: TouchControlsProps) {
  const activePointers = useRef<{ left: number | null; right: number | null }>({
    left: null,
    right: null,
  });

  const updateSteer = () => {
    const l = activePointers.current.left !== null;
    const r = activePointers.current.right !== null;
    if (l && !r) onSteerChange(-1);
    else if (r && !l) onSteerChange(1);
    else onSteerChange(0);
  };

  const handleDown = (side: 'left' | 'right') => (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    activePointers.current[side] = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore synthetic pointer capture errors
    }
    updateSteer();
  };

  const handleUp = (side: 'left' | 'right') => (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (activePointers.current[side] === e.pointerId) {
      activePointers.current[side] = null;
    }
    updateSteer();
  };

  return (
    <div className="fixed inset-x-0 bottom-4 z-15 pointer-events-none flex items-center justify-between px-4 sm:px-6 lg:hidden">
      <button
        type="button"
        aria-label="Завий наляво"
        onPointerDown={handleDown('left')}
        onPointerUp={handleUp('left')}
        onPointerCancel={handleUp('left')}
        onPointerLeave={handleUp('left')}
        className="pointer-events-auto min-w-[116px] h-14 px-5 rounded-xl bg-[#0d061d]/82 border border-cyan-400/50 text-cyan-100 font-display font-bold text-sm tracking-wide flex items-center justify-center gap-2 active:bg-cyan-500/30 active:border-cyan-300 select-none touch-none"
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" aria-hidden="true">
          <path d="M15 6L9 12L15 18" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>НАЛЯВО</span>
      </button>

      <button
        type="button"
        aria-label="Завий надясно"
        onPointerDown={handleDown('right')}
        onPointerUp={handleUp('right')}
        onPointerCancel={handleUp('right')}
        onPointerLeave={handleUp('right')}
        className="pointer-events-auto min-w-[116px] h-14 px-5 rounded-xl bg-[#0d061d]/82 border border-fuchsia-400/50 text-fuchsia-100 font-display font-bold text-sm tracking-wide flex items-center justify-center gap-2 active:bg-fuchsia-500/30 active:border-fuchsia-300 select-none touch-none"
      >
        <span>НАДЯСНО</span>
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" aria-hidden="true">
          <path d="M9 6L15 12L9 18" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}

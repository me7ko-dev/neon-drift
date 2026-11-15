import React from 'react';

export function NeonDriftEmblem() {
  return (
    <svg
      viewBox="0 0 320 44"
      className="w-[220px] sm:w-[290px] h-auto"
      role="img"
      aria-label="Неонов Дрифт — емблема"
    >
      {/* Left aerodynamic speed wings */}
      <path d="M 14 14 L 118 14 L 106 20 L 26 20 Z" fill="#00F5FF" opacity="0.9" />
      <path d="M 38 24 L 112 24 L 102 29 L 48 29 Z" fill="#FF2D95" opacity="0.85" />

      {/* Center apex racing chevron */}
      <polygon
        points="160,4 186,28 174,28 160,14 146,28 134,28"
        fill="#FFD166"
        stroke="#090414"
        strokeWidth="1.5"
      />
      <polygon points="160,18 170,34 150,34" fill="#00F5FF" />

      {/* Right aerodynamic speed wings */}
      <path d="M 306 14 L 202 14 L 214 20 L 294 20 Z" fill="#00F5FF" opacity="0.9" />
      <path d="M 282 24 L 208 24 L 218 29 L 272 29 Z" fill="#FF2D95" opacity="0.85" />
    </svg>
  );
}

export function CoinSvgIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#090414" stroke="#FFD166" strokeWidth="2.2" />
      <circle cx="12" cy="12" r="6.2" fill="#00E5FF" fillOpacity="0.22" stroke="#00F5FF" strokeWidth="1.4" />
      <polygon points="12,7.2 15.5,12 12,16.8 8.5,12" fill="#FFD166" />
    </svg>
  );
}

export function SoundSvgIcon({ muted, className = 'w-5 h-5' }: { muted: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M4 9.5V14.5H8L13.5 19V5L8 9.5H4Z"
        fill="currentColor"
        stroke="#090414"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      {muted ? (
        <path
          d="M17 9L21 15M21 9L17 15"
          stroke="#FF2D95"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      ) : (
        <>
          <path
            d="M16.5 8.8C17.6 9.8 18.2 10.9 18.2 12C18.2 13.1 17.6 14.2 16.5 15.2"
            stroke="#00F5FF"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M19 6.5C20.8 8.1 21.8 10 21.8 12C21.8 14 20.8 15.9 19 17.5"
            stroke="#00F5FF"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
  );
}

export function PauseSvgIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <rect x="6.5" y="5" width="4" height="14" rx="1" fill="currentColor" />
      <rect x="13.5" y="5" width="4" height="14" rx="1" fill="currentColor" />
    </svg>
  );
}

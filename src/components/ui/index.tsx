import React from 'react';
import type { TrophyTier } from '../../types';

// ── Trophy badge ───────────────────────────────────────────────────────────────
const TROPHY_COLORS: Record<TrophyTier, string> = {
  none: '#555',
  bronze: '#cd7f32',
  silver: '#c0c0c0',
  gold: '#ffd700',
  platinum: '#e5e4e2',
};

const TROPHY_LABELS: Record<TrophyTier, string> = {
  none: '',
  bronze: 'Bronze',
  silver: 'Prata',
  gold: 'Ouro',
  platinum: '✦ Platina',
};

interface TrophyBadgeProps {
  tier: TrophyTier;
}

export const TrophyBadge: React.FC<TrophyBadgeProps> = ({ tier }) => {
  if (tier === 'none') return null;
  return (
    <span
      style={{
        color: TROPHY_COLORS[tier],
        fontWeight: 700,
        fontSize: 11,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
      }}
    >
      {TROPHY_LABELS[tier]}
    </span>
  );
};

// ── Progress bar ───────────────────────────────────────────────────────────────
interface ProgressBarProps {
  percent: number;
  color?: string;
  height?: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  percent,
  color = 'var(--accent)',
  height = 4,
}) => (
  <div
    style={{
      width: '100%',
      height,
      background: 'var(--b2)',
      borderRadius: 99,
      overflow: 'hidden',
    }}
  >
    <div
      style={{
        width: `${Math.min(100, percent)}%`,
        height: '100%',
        background: color,
        borderRadius: 99,
        transition: 'width .4s',
      }}
    />
  </div>
);

// ── Filter button bar ──────────────────────────────────────────────────────────
interface FilterBarProps<T extends string> {
  options: { value: T; label: string }[];
  active: T;
  onChange: (v: T) => void;
}

export function FilterBar<T extends string>({
  options,
  active,
  onChange,
}: FilterBarProps<T>) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      {options.map((opt) => (
        <button
          key={opt.value}
          className={`btn-filter${active === opt.value ? ' active' : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────
interface EmptyProps {
  icon?: string;
  title: string;
  sub?: string;
}

export const Empty: React.FC<EmptyProps> = ({ icon = '🎮', title, sub }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '60px 20px',
      color: 'var(--txt3)',
      textAlign: 'center',
    }}
  >
    <div style={{ fontSize: 40, marginBottom: 12 }}>{icon}</div>
    <div style={{ fontSize: 16, color: 'var(--txt2)', fontWeight: 600 }}>{title}</div>
    {sub && <div style={{ fontSize: 13, marginTop: 6 }}>{sub}</div>}
  </div>
);

// ── Avatar ─────────────────────────────────────────────────────────────────────
interface AvatarProps {
  src?: string;
  fallback?: string;
  size?: number;
}

export const Avatar: React.FC<AvatarProps> = ({ src, fallback = '👤', size = 48 }) => {
  const style: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: '50%',
    border: '2px solid var(--b3)',
    objectFit: 'cover',
    flexShrink: 0,
    background: 'var(--bg3)',
  };

  if (src) {
    return <img src={src} alt="avatar" style={style} />;
  }
  return (
    <div
      style={{
        ...style,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.5,
      }}
    >
      {fallback}
    </div>
  );
};

// ── Steam logo SVG ─────────────────────────────────────────────────────────────
export const SteamLogo: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 233 233" xmlns="http://www.w3.org/2000/svg">
    <path
      fill="#c6d4df"
      d="M116.5 0C52.2 0 0 52.2 0 116.5c0 55.2 38.5 101.6 90.4 113.3l30.5-74.4c-3-.8-5.8-2-8.4-3.6l-34.1 13.9C70.2 155.7 64 144.7 64 132.3c0-29 23.6-52.5 52.5-52.5 7.3 0 14.2 1.5 20.5 4.2l14.2-34.7C139.5 44.1 128.4 41 116.5 41c-41.7 0-75.5 33.8-75.5 75.5S74.8 192 116.5 192s75.5-33.8 75.5-75.5c0-5.2-.5-10.2-1.5-15.1l36.6-14.9C228.3 98.1 233 107 233 116.5 233 180.8 180.8 233 116.5 233S0 180.8 0 116.5 52.2 0 116.5 0z"
    />
    <circle fill="#c6d4df" cx="116.5" cy="132.3" r="26.5" />
  </svg>
);

// ── Trophy SVG Icon ────────────────────────────────────────────────────────────
export const TrophyIcon: React.FC<{ size?: number }> = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="35" fill="none" stroke="#3a7acc" strokeWidth="3" />
    <path
      d="M50 20 L55 40 L75 40 L60 55 L65 75 L50 62 L35 75 L40 55 L25 40 L45 40 Z"
      fill="#ffd700"
      stroke="#b8860b"
      strokeWidth="2"
    />
  </svg>
);

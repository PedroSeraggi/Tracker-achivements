import React from 'react';
import type { Game } from '../../types';
import { TrophyBadge, ProgressBar } from '../ui';
import { useAppStore } from '../../store/useAppStore';

interface GameCardProps {
  game: Game;
  onClick?: () => void;
  readonly?: boolean;
}

const GameCard: React.FC<GameCardProps> = ({ game, onClick, readonly }) => {
  const openGameDetail = useAppStore((s) => s.openGameDetail);

  const handleClick = onClick ?? (() => openGameDetail(game.appId));

  const tierColor: Record<string, string> = {
    platinum: 'var(--plat, #e5e4e2)',
    gold: '#ffd700',
    silver: '#c0c0c0',
    bronze: '#cd7f32',
    none: 'var(--b3)',
  };

  return (
    <div
      className="game-card"
      onClick={handleClick}
      style={{ cursor: 'pointer', position: 'relative' }}
    >
      {/* Header image */}
      <div className="game-card-img-wrap">
        <img
          src={game.headerImage}
          alt={game.name}
          className="game-card-img"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      </div>

      {/* Info */}
      <div className="game-card-info">
        <div className="game-card-title">{game.name}</div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <span className="game-card-pct">{game.percentage}%</span>
          <span style={{ fontSize: 11, color: 'var(--txt3)' }}>
            {game.unlockedCount}/{game.totalCount}
          </span>
          {readonly && (
            <span
              style={{
                fontSize: 10,
                color: 'var(--txt3)',
                background: 'var(--bg3)',
                border: '1px solid var(--b2)',
                borderRadius: 4,
                padding: '2px 6px',
                letterSpacing: 1,
                marginLeft: 'auto',
              }}
            >
              SOMENTE LEITURA
            </span>
          )}
        </div>

        <ProgressBar
          percent={game.percentage}
          color={tierColor[game.trophyTier] !== 'var(--b3)' ? tierColor[game.trophyTier] : 'var(--accent)'}
          height={3}
        />

        <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 4 }}>
          {Math.round(game.playtimeForever / 60)} horas jogadas
        </div>
      </div>
    </div>
  );
};

export default GameCard;

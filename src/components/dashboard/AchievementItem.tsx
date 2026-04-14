import React from 'react';
import type { Achievement } from '../../types';
import { TrophyBadge } from '../ui';

interface AchievementItemProps {
  achievement: Achievement;
  readonly?: boolean;
}

const AchievementItem: React.FC<AchievementItemProps> = ({ achievement, readonly }) => {
  const { displayName, description, iconUrl, iconGrayUrl, achieved, globalPercent, unlockTime, tier } =
    achievement;

  const icon = achieved ? iconUrl : iconGrayUrl;
  const unlockDate = unlockTime
    ? new Date(unlockTime * 1000).toLocaleDateString('pt-BR')
    : null;

  return (
    <div className={`ach-item${achieved ? ' unlocked' : ''}`}>
      <img
        className="ach-icon"
        src={icon}
        alt={displayName}
        onError={(e) => {
          (e.target as HTMLImageElement).style.visibility = 'hidden';
        }}
      />
      <div className="ach-info">
        <div className="ach-name">
          {displayName}
          {tier && tier !== 'none' && (
            <span style={{ marginLeft: 8 }}>
              <TrophyBadge tier={tier} />
            </span>
          )}
        </div>
        <div className="ach-desc">{description || 'Conquista oculta'}</div>
        {unlockDate && (
          <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 2 }}>
            Desbloqueado em {unlockDate}
          </div>
        )}
        {globalPercent != null && (
          <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 1 }}>
            {Number(globalPercent).toFixed(1)}% dos jogadores desbloquearam
          </div>
        )}
      </div>
      <div className="ach-status">
        {achieved ? (
          <span style={{ color: 'var(--gold, #ffd700)', fontWeight: 700 }}>✓</span>
        ) : (
          <span style={{ color: 'var(--txt3)' }}>✗</span>
        )}
      </div>
    </div>
  );
};

export default AchievementItem;

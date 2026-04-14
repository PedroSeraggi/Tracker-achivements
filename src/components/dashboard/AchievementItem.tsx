import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { Achievement, Game } from '../../types';
import { TrophyBadge } from '../ui';

interface AchievementItemProps {
  achievement: Achievement;
  readonly?: boolean;
  game?: Game;
}

const AchievementItem: React.FC<AchievementItemProps> = ({ achievement, readonly, game }) => {
  const { displayName, description, iconUrl, iconGrayUrl, achieved, globalPercent, unlockTime, tier, apiName } =
    achievement;
  const openGuideCreator = useAppStore((s) => s.openGuideCreator);
  const currentUser = useAppStore((s) => s.currentUser);

  const icon = achieved ? iconUrl : iconGrayUrl;
  const unlockDate = unlockTime
    ? new Date(unlockTime * 1000).toLocaleDateString('pt-BR')
    : null;

  const handleCreateGuide = () => {
    if (!game || !currentUser) return;
    const setDashView = useAppStore.getState().setDashView;
    setDashView('guides');
    openGuideCreator({
      id: '',
      title: `Guia: ${displayName}`,
      gameAppId: game.appId,
      gameName: game.name,
      achievementApiName: apiName,
      achievementName: displayName,
      steps: [{ id: 'step-1', title: '', content: '' }],
      authorSteamId: currentUser.steamId,
      authorName: currentUser.personaName,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  };

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
      <div className="ach-status" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        {achieved ? (
          <span style={{ color: 'var(--gold, #ffd700)', fontWeight: 700 }}>✓</span>
        ) : (
          <span style={{ color: 'var(--txt3)' }}>✗</span>
        )}
        {!readonly && game && (
          <button
            onClick={handleCreateGuide}
            style={{
              padding: '4px 8px',
              fontSize: 10,
              fontWeight: 600,
              background: 'transparent',
              border: '1px solid var(--txt3)',
              borderRadius: 4,
              color: 'var(--txt2)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              marginLeft: -12,
            }}
          >
            📖 Guia
          </button>
        )}
      </div>
    </div>
  );
};

export default AchievementItem;

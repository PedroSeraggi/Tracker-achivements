import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { TrophyIcon } from '../ui';

const LoadingScreen: React.FC = () => {
  const { status, progress, loadedGames } = useAppStore((s) => s.loading);

  return (
    <div id="screen-loading" className="screen">
      <div className="loading-logo" style={{ animation: 'pulse 1.5s infinite' }}>
        <TrophyIcon size={60} />
      </div>

      <div className="loading-title">Conectando à Steam</div>
      <div className="loading-sub">Buscando seus jogos e conquistas...</div>

      <div className="loading-bar-wrap">
        <div
          className="loading-bar"
          style={{ width: `${progress}%`, transition: 'width 0.4s ease' }}
        />
      </div>

      <div className="mono" style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 8 }}>
        {status}
      </div>

      {loadedGames.length > 0 && (
        <div className="loading-games" id="loading-games">
          {loadedGames.slice(-8).map((name, i) => (
            <div key={i} className="loading-game-pill">
              ✓ {name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LoadingScreen;

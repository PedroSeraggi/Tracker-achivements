// ─────────────────────────────────────────────────────────────────────────────
//  src/components/duel/GameSelectionPhase.tsx
//  Phase 1 of Trophy Duel: let the user pick up to 5 games.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo, useState } from 'react';
import type { Game } from '../../types';
import { MAX_GAME_SELECTION } from '../../utils/duelUtils';

interface GameSelectionPhaseProps {
  games           : Game[];
  selectedIds     : Set<number>;
  error           : string | null;
  searchQuery     : string;
  onToggle        : (appId: number) => void;
  onGenerate      : () => void;
  onSearch        : (query: string) => void;
}

const GameSelectionPhase: React.FC<GameSelectionPhaseProps> = ({
  games,
  selectedIds,
  error,
  searchQuery,
  onToggle,
  onGenerate,
  onSearch,
}) => {
  const atMax      = selectedIds.size >= MAX_GAME_SELECTION;
  const hasSelection = selectedIds.size > 0;

  // Filter games by search query
  const filteredGames = useMemo(() => {
    if (!searchQuery.trim()) return games;
    const q = searchQuery.toLowerCase();
    return games.filter((g) => g.name.toLowerCase().includes(q));
  }, [games, searchQuery]);

  return (
    <div id="view-duel">
      {/* Top bar */}
      <div className="duel-topbar">
        <div>
          <div className="duel-topbar-title">⚔️ Trophy Duel</div>
          <div className="duel-topbar-sub">
            Selecione até {MAX_GAME_SELECTION} jogos para gerar seu deck de cartas
          </div>
        </div>
      </div>

      <div className="duel-phase">
        {/* Error banner */}
        {error && (
          <div className="duel-error-banner">{error}</div>
        )}

        {/* Search bar */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
          <input
            type="text"
            placeholder="🔍 Buscar jogo..."
            value={searchQuery}
            onChange={(e) => onSearch(e.target.value)}
            style={{
              background: 'var(--bg3)',
              border: '1px solid var(--b2)',
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 14,
              color: 'var(--txt)',
              outline: 'none',
              flex: 1,
              maxWidth: 400,
              transition: 'border-color .2s',
            }}
            onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
            onBlur={(e) => (e.target.style.borderColor = 'var(--b2)')}
          />
          <span style={{ fontSize: 12, color: 'var(--txt3)' }}>
            {filteredGames.length} jogos encontrados
          </span>
        </div>

        {/* Section label */}
        <div className="duel-phase-label">
          Jogos com conquistas desbloqueadas —{' '}
          {selectedIds.size}/{MAX_GAME_SELECTION} selecionados
        </div>

        {/* Game grid */}
        {filteredGames.length === 0 ? (
          <div
            style={{
              textAlign : 'center',
              padding   : '40px 0',
              color     : 'var(--txt2)',
              fontSize  : 14,
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>🎮</div>
            <div style={{ fontWeight: 700, marginBottom: 6, color: '#fff' }}>
              Nenhum jogo com conquistas encontrado
            </div>
            <div style={{ fontSize: 13, color: 'var(--txt3)' }}>
              Adicione jogos na aba principal e clique em ↺ Atualizar.
            </div>
          </div>
        ) : (
          <div className="duel-game-selection-grid">
            {filteredGames.map((game) => {
              const isSelected = selectedIds.has(game.appId);
              const isDisabled = atMax && !isSelected;

              return (
                <div
                  key={game.appId}
                  className={[
                    'duel-game-tile',
                    isSelected ? 'selected' : '',
                    isDisabled ? 'disabled' : '',
                  ].join(' ').trim()}
                  role="checkbox"
                  aria-checked={isSelected}
                  tabIndex={isDisabled ? -1 : 0}
                  onClick={() => !isDisabled && onToggle(game.appId)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      if (!isDisabled) onToggle(game.appId);
                    }
                  }}
                >
                  {/* Selection checkmark */}
                  <div className="duel-tile-check">✓</div>

                  {/* Game header image */}
                  <img
                    className="duel-tile-img"
                    src={game.headerImage}
                    alt={game.name}
                    loading="lazy"
                    onError={(e) => {
                      const img = e.target as HTMLImageElement;
                      img.style.display = 'none';
                      // Show placeholder sibling
                      const ph = img.nextElementSibling as HTMLElement | null;
                      if (ph) ph.style.display = 'flex';
                    }}
                  />
                  <div className="duel-tile-img-ph" style={{ display: 'none' }}>
                    🎮
                  </div>

                  <div className="duel-tile-name">{game.name}</div>
                  <div className="duel-tile-meta">
                    {game.unlockedCount} conquista{game.unlockedCount !== 1 ? 's' : ''} desbloqueada{game.unlockedCount !== 1 ? 's' : ''}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Generate button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
          <button
            className="btn-duel-generate"
            disabled={!hasSelection}
            onClick={onGenerate}
          >
            ⚔️ Gerar Deck de Cartas
          </button>
          <span style={{ fontSize: 12, color: 'var(--txt3)' }}>
            {hasSelection
              ? `${selectedIds.size} jogo${selectedIds.size > 1 ? 's' : ''} selecionado${selectedIds.size > 1 ? 's' : ''}`
              : 'Selecione pelo menos 1 jogo'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default GameSelectionPhase;

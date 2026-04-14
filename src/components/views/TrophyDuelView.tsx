// ─────────────────────────────────────────────────────────────────────────────
//  src/components/duel/TrophyDuelView.tsx
//  Main orchestrator for the Trophy Duel feature.
//
//  Responsibilities:
//    - Reads games from useAppStore (already loaded by the main app)
//    - Manages the three phases: select → loading → deck
//    - Calls duelUtils for pure logic (no business logic in this file)
//    - Delegates rendering to GameSelectionPhase and DeckPhase
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useDuelStore } from '../../store/useDuelStore';
import { getEligibleGames, generateDeck } from '../../utils/duelUtils';
import GameSelectionPhase from './GameSelectionPhase';
import DeckPhase from './DeckPhase';

const TrophyDuelView: React.FC = () => {
  // ── Read games from the main app store ──────────────────────────────────
  const allGames = useAppStore((s) => s.games);

  // ── Duel state ──────────────────────────────────────────────────────────
  const phase          = useDuelStore((s) => s.phase);
  const selectedGameIds = useDuelStore((s) => s.selectedGameIds);
  const cards          = useDuelStore((s) => s.cards);
  const sortKey        = useDuelStore((s) => s.sortKey);
  const rarityFilter   = useDuelStore((s) => s.rarityFilter);
  const searchQuery    = useDuelStore((s) => s.searchQuery);
  const error          = useDuelStore((s) => s.error);

  const toggleGame     = useDuelStore((s) => s.toggleGame);
  const setPhase       = useDuelStore((s) => s.setPhase);
  const setCards       = useDuelStore((s) => s.setCards);
  const setError       = useDuelStore((s) => s.setError);
  const setSortKey     = useDuelStore((s) => s.setSortKey);
  const setRarityFilter = useDuelStore((s) => s.setRarityFilter);
  const setSearchQuery = useDuelStore((s) => s.setSearchQuery);
  const reset          = useDuelStore((s) => s.reset);

  // ── Only games with at least 1 unlocked achievement ─────────────────────
  const eligibleGames = React.useMemo(
    () => getEligibleGames(allGames),
    [allGames]
  );

  // ── Deck generation ──────────────────────────────────────────────────────
  const handleGenerate = useCallback(() => {
    if (selectedGameIds.size === 0) return;

    setPhase('loading');

    // One tick so React renders the loading spinner before the (sync) generation
    requestAnimationFrame(() => {
      try {
        const selectedGames = eligibleGames.filter((g) =>
          selectedGameIds.has(g.appId)
        );
        const generatedCards = generateDeck(selectedGames);

        if (generatedCards.length === 0) {
          setError(
            'Nenhuma conquista desbloqueada nos jogos selecionados. ' +
            'Verifique se o perfil Steam está público e clique em ↺ Atualizar.'
          );
          return;
        }

        setCards(generatedCards);
      } catch (err) {
        console.error('[TrophyDuel] Erro ao gerar deck:', err);
        setError(
          err instanceof Error ? err.message : 'Erro desconhecido ao gerar o deck.'
        );
      }
    });
  }, [selectedGameIds, eligibleGames, setPhase, setCards, setError]);

  // ── Render ───────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div id="view-duel">
        <div className="duel-topbar">
          <div>
            <div className="duel-topbar-title">⚔️ Trophy Duel</div>
            <div className="duel-topbar-sub">
              Gerando deck de {selectedGameIds.size} jogo
              {selectedGameIds.size !== 1 ? 's' : ''}…
            </div>
          </div>
        </div>
        <div className="duel-loading">
          <div className="duel-loading-spinner" />
          <div className="duel-loading-text">
            Calculando raridade das conquistas…
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'deck') {
    return (
      <DeckPhase
        allCards={cards}
        sortKey={sortKey}
        rarityFilter={rarityFilter}
        searchQuery={searchQuery}
        onSort={setSortKey}
        onFilter={setRarityFilter}
        onSearch={setSearchQuery}
        onReset={reset}
      />
    );
  }

  // phase === 'select'
  return (
    <GameSelectionPhase
      games={eligibleGames}
      selectedIds={selectedGameIds}
      error={error}
      searchQuery={searchQuery}
      onToggle={toggleGame}
      onGenerate={handleGenerate}
      onSearch={setSearchQuery}
    />
  );
};

export default TrophyDuelView;

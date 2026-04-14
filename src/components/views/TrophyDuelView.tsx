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

import React, { useCallback, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useDuelStore } from '../../store/useDuelStore';
import { getEligibleGames, generateDeck } from '../../utils/duelUtils';
import GameSelectionPhase from './GameSelectionPhase';
import DeckPhase from './DeckPhase';
import SavedDecksView from './SavedDecksView';
import SavedDeckDetail from './SavedDeckDetail';

const TrophyDuelView: React.FC = () => {
  // ── Read games from the main app store ──────────────────────────────────
  const allGames = useAppStore((s) => s.games);
  const duelView = useAppStore((s) => s.duelView);
  const setDuelView = useAppStore((s) => s.setDuelView);

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

  // ── Save deck state ────────────────────────────────────────────────────
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [deckName, setDeckName] = useState('');
  const saveDeck = useAppStore((s) => s.saveDeck);

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

  // ── Save deck handler ──────────────────────────────────────────────────
  const handleSaveDeck = useCallback(() => {
    if (!deckName.trim()) return;
    const gameIds = Array.from(selectedGameIds);
    saveDeck(deckName.trim(), cards, gameIds);
    setShowSaveModal(false);
    setDeckName('');
  }, [deckName, cards, selectedGameIds, saveDeck]);

  // ── Tabs ────────────────────────────────────────────────────────────────
  const tabs = [
    { key: 'duel', label: '⚔️ Novo Deck' },
    { key: 'my-decks', label: '📁 Meus Decks' },
  ] as const;

  // ── Render ───────────────────────────────────────────────────────────────
  if (duelView === 'my-decks') {
    return (
      <div id="view-duel">
        {/* Tabs */}
        <div className="duel-tabs">
          {tabs.map((t) => (
            <button
              key={t.key}
              className={`duel-tab ${duelView === t.key ? 'active' : ''}`}
              onClick={() => setDuelView(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <SavedDecksView />
      </div>
    );
  }

  if (duelView === 'view-deck') {
    return (
      <div id="view-duel">
        {/* Tabs */}
        <div className="duel-tabs">
          {tabs.map((t) => (
            <button
              key={t.key}
              className={`duel-tab ${duelView === 'view-deck' && t.key === 'my-decks' ? 'active' : ''}`}
              onClick={() => setDuelView('my-decks')}
            >
              {t.label}
            </button>
          ))}
        </div>
        <SavedDeckDetail />
      </div>
    );
  }

  // duelView === 'duel'
  return (
    <div id="view-duel">
      {/* Tabs */}
      <div className="duel-tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`duel-tab ${duelView === t.key ? 'active' : ''}`}
            onClick={() => setDuelView(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {phase === 'loading' && (
        <div className="duel-loading">
          <div className="duel-loading-spinner" />
          <div className="duel-loading-text">
            Calculando raridade das conquistas…
          </div>
        </div>
      )}

      {phase === 'deck' && (
        <>
          <DeckPhase
            allCards={cards}
            sortKey={sortKey}
            rarityFilter={rarityFilter}
            searchQuery={searchQuery}
            onSort={setSortKey}
            onFilter={setRarityFilter}
            onSearch={setSearchQuery}
            onReset={reset}
            onSave={() => setShowSaveModal(true)}
          />

          {/* Save Modal */}
          {showSaveModal && (
            <div
              onClick={() => setShowSaveModal(false)}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.8)',
                backdropFilter: 'blur(4px)',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: 'var(--bg1)',
                  border: '1px solid var(--b2)',
                  borderRadius: 16,
                  padding: '24px 32px',
                  maxWidth: 400,
                  width: '100%',
                }}
              >
                <h3 style={{ margin: '0 0 16px 0', fontSize: 18 }}>💾 Salvar Deck</h3>
                <input
                  type="text"
                  value={deckName}
                  onChange={(e) => setDeckName(e.target.value)}
                  placeholder="Nome do deck..."
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    fontSize: 14,
                    background: 'var(--bg3)',
                    border: '1px solid var(--b2)',
                    borderRadius: 8,
                    color: 'var(--txt)',
                    marginBottom: 16,
                    outline: 'none',
                  }}
                  autoFocus
                />
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={handleSaveDeck}
                    disabled={!deckName.trim()}
                    style={{
                      flex: 1,
                      padding: '10px',
                      background: 'var(--accent)',
                      border: 'none',
                      borderRadius: 8,
                      color: '#fff',
                      fontWeight: 600,
                      cursor: deckName.trim() ? 'pointer' : 'not-allowed',
                      opacity: deckName.trim() ? 1 : 0.6,
                    }}
                  >
                    Salvar
                  </button>
                  <button
                    onClick={() => {
                      setShowSaveModal(false);
                      setDeckName('');
                    }}
                    style={{
                      flex: 1,
                      padding: '10px',
                      background: 'var(--bg3)',
                      border: '1px solid var(--b2)',
                      borderRadius: 8,
                      color: 'var(--txt)',
                      cursor: 'pointer',
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {phase === 'select' && (
        <GameSelectionPhase
          games={eligibleGames}
          selectedIds={selectedGameIds}
          error={error}
          searchQuery={searchQuery}
          onToggle={toggleGame}
          onGenerate={handleGenerate}
          onSearch={setSearchQuery}
        />
      )}
    </div>
  );
};

export default TrophyDuelView;

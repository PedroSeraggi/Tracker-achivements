// ─────────────────────────────────────────────────────────────────────────────
//  src/components/duel/SavedDecksView.tsx
//  Displays saved decks as groups of games with stacked card effect
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { useAppStore } from '../../store/useAppStore';

const SavedDecksView: React.FC = () => {
  const savedDecks = useAppStore((s) => s.savedDecks);
  const games = useAppStore((s) => s.games);
  const viewSavedDeck = useAppStore((s) => s.viewSavedDeck);
  const deleteDeck = useAppStore((s) => s.deleteDeck);

  if (savedDecks.length === 0) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📁</div>
        <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--txt)', marginBottom: 8 }}>
          Nenhum deck salvo
        </div>
        <div style={{ fontSize: 14, color: 'var(--txt2)' }}>
          Gere um deck na aba "Novo Deck" e salve-o para visualizar aqui.
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px 0' }}>
          📁 Meus Decks ({savedDecks.length})
        </h2>
        <p style={{ fontSize: 13, color: 'var(--txt2)', margin: 0 }}>
          Clique em um deck para ver suas cartas. Passe o mouse para ver os jogos.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, padding: '10px', overflow: 'visible' }}>
        {savedDecks.map((deck) => {
          // Get games info for this deck
          const deckGames = deck.gameIds
            .map((id) => games.find((g) => g.appId === id))
            .filter((g): g is NonNullable<typeof g> => g !== undefined);

          return (
            <div
              key={deck.id}
              className="saved-deck-card"
              onClick={() => viewSavedDeck(deck.id)}
              style={{
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                padding: 10,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 3px 0' }}>
                    {deck.name}
                  </h3>
                  <div style={{ fontSize: 11, color: 'var(--txt2)' }}>
                    {deck.cards.length} cartas · {deckGames.length} jogos
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('Tem certeza que deseja excluir este deck?')) {
                      deleteDeck(deck.id);
                    }
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--txt3)',
                    cursor: 'pointer',
                    fontSize: 16,
                    padding: '4px 6px',
                    borderRadius: 4,
                    transition: 'color 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#ff4444';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--txt3)';
                  }}
                  title="Excluir deck"
                >
                  🗑️
                </button>
              </div>

              {/* Games Stack - Overlapping images */}
              <div 
                className="games-stack"
                style={{ 
                  position: 'relative', 
                  height: 75, 
                  marginBottom: 8,
                  overflow: 'visible',
                }}
              >
                {deckGames.map((game, index) => (
                  <div
                    key={game.appId}
                    className="game-cover"
                    data-index={index}
                    style={{
                      position: 'absolute',
                      left: index * 15,
                      top: 0,
                      width: 120,
                      height: 60,
                      borderRadius: 6,
                      overflow: 'hidden',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                      border: '2px solid var(--bg1)',
                      transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
                      zIndex: deckGames.length - index,
                    }}
                    title={game.name}
                  >
                    <img
                      src={game.headerImage}
                      alt={game.name}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                ))}
              </div>

              <div style={{ fontSize: 10, color: 'var(--txt3)' }}>
                Criado em {new Date(deck.createdAt).toLocaleDateString('pt-BR')}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SavedDecksView;

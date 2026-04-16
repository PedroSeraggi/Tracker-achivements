// ─────────────────────────────────────────────────────────────────────────────
//  src/components/views/DeckSelectorForDuel.tsx
//  Deck selection screen for starting a duel
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useMemo, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useBattleStore, type BotDifficulty } from '../../store/useBattleStore';
import type { Game } from '../../types';
import { playHoverSound, playCardSelectSound, playReadySound, initAudio } from '../../utils/soundEffects';

// ── XP / Level calculations ────────────────────────────────────────────────────
function calcXP(games: Game[]): number {
  return games.reduce((total, g) => {
    const base = g.unlockedCount * 10;
    const bonus =
      g.trophyTier === 'platinum' ? 500 :
      g.trophyTier === 'gold'     ? 150 :
      g.trophyTier === 'silver'   ? 50  :
      g.trophyTier === 'bronze'   ? 15  : 0;
    return total + base + bonus;
  }, 0);
}

const LEVELS = [
  { min: 0,       label: 'Nível 1' },
  { min: 500,     label: 'Nível 2' },
  { min: 1500,    label: 'Nível 3' },
  { min: 3500,    label: 'Nível 4' },
  { min: 7000,    label: 'Nível 5' },
  { min: 12000,   label: 'Nível 6' },
  { min: 20000,   label: 'Nível 7' },
  { min: 30000,   label: 'Nível 8' },
  { min: 50000,   label: 'Nível 9' },
  { min: 75000,   label: 'Nível 10' },
  { min: 100000,  label: 'Nível 11' },
  { min: 150000,  label: 'Nível 12' },
  { min: 250000,  label: 'Nível 13' },
  { min: 500000,  label: 'Nível 14' },
];

function getLevelNumber(xp: number): number {
  let current = LEVELS[0];
  for (const lvl of LEVELS) {
    if (xp >= lvl.min) current = lvl;
  }
  return parseInt(current.label.replace(/\D/g, ''), 10) || 1;
}

const DIFFICULTY_CONFIG: Record<BotDifficulty, { label: string; emoji: string; color: string; desc: string }> = {
  easy:   { label: 'Fácil',   emoji: '🌱', color: '#4ade80', desc: 'Para filhinhos do papai' },
  normal: { label: 'Normal',  emoji: '⚔️', color: '#3b82f6', desc: 'Vamos ver do que você é capaz... ' },
  hard:   { label: 'Difícil', emoji: '🔥', color: '#f59e0b', desc: 'Aqui a parada fica seria' },
  king:   { label: 'REI!!',   emoji: '👑', color: '#a855f7', desc: 'ESSE MALDITO ESTA ROUBANDO!!' },
};

const DeckSelectorForDuel: React.FC = () => {
  const savedDecks = useAppStore((s) => s.savedDecks);
  const games = useAppStore((s) => s.games);
  const startBattle = useBattleStore((s) => s.startBattle);
  const [selectedDifficulty, setSelectedDifficulty] = useState<BotDifficulty>('normal');
  const [confirmDeck, setConfirmDeck] = useState<{ id: string; name: string; cards: any[] } | null>(null);
  
  // Inicializar audio
  useEffect(() => {
    initAudio();
  }, []);
  
  // Calcular nível do usuário
  const userXP = useMemo(() => calcXP(games), [games]);
  const levelNumber = useMemo(() => getLevelNumber(userXP), [userXP]);
  const isKingUnlocked = levelNumber >= 8;

  const handleDifficultyClick = (diff: BotDifficulty, isLocked: boolean) => {
    if (!isLocked) {
      playCardSelectSound();
      setSelectedDifficulty(diff);
    }
  };

  const handleDeckClick = (deck: typeof savedDecks[0]) => {
    playCardSelectSound();
    setConfirmDeck({ id: deck.id, name: deck.name, cards: deck.cards });
  };

  const handleConfirmStart = () => {
    if (confirmDeck) {
      playReadySound();
      const deck = savedDecks.find(d => d.id === confirmDeck.id);
      if (deck) {
        startBattle(deck.cards, games, selectedDifficulty);
      }
      setConfirmDeck(null);
    }
  };

  if (savedDecks.length === 0) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
        <h3 style={{ fontSize: 18, margin: '0 0 8px 0' }}>Nenhum deck salvo</h3>
        <p style={{ fontSize: 14, color: 'var(--txt2)', margin: 0 }}>
          Crie um deck primeiro na aba "Criador de Decks" para poder duelar!
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      {/* Difficulty Selector */}
      <div
        style={{
          marginBottom: 24,
          padding: 16,
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 16px 0', textAlign: 'center' }}>
          🎯 Selecione a Dificuldade
        </h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16, maxWidth: 480, margin: '0 auto 16px' }}>
          {(Object.keys(DIFFICULTY_CONFIG) as BotDifficulty[]).map((diff) => {
            const isLocked = diff === 'king' && !isKingUnlocked;
            return (
              <button
                key={diff}
                onClick={() => handleDifficultyClick(diff, isLocked)}
                disabled={isLocked}
                style={{
                  aspectRatio: '1',
                  padding: '12px',
                  background: isLocked 
                    ? 'var(--bg3)' 
                    : selectedDifficulty === diff 
                      ? `${DIFFICULTY_CONFIG[diff].color}20` 
                      : 'var(--bg1)',
                  border: `2px solid ${
                    isLocked 
                      ? 'var(--b3)' 
                      : selectedDifficulty === diff 
                        ? DIFFICULTY_CONFIG[diff].color 
                        : 'var(--b2)'
                  }`,
                  borderRadius: 10,
                  cursor: isLocked ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  opacity: isLocked ? 0.5 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!isLocked) playHoverSound();
                  if (!isLocked && selectedDifficulty !== diff) {
                    e.currentTarget.style.borderColor = DIFFICULTY_CONFIG[diff].color;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isLocked && selectedDifficulty !== diff) {
                    e.currentTarget.style.borderColor = 'var(--b2)';
                  }
                }}
              >
                <span style={{ fontSize: isLocked ? 20 : 24 }}>
                  {isLocked ? '🔒' : DIFFICULTY_CONFIG[diff].emoji}
                </span>
                <div style={{ 
                  fontSize: 12, 
                  fontWeight: 700, 
                  color: isLocked 
                    ? 'var(--txt3)' 
                    : selectedDifficulty === diff 
                      ? DIFFICULTY_CONFIG[diff].color 
                      : 'var(--txt)'
                }}>
                  {isLocked ? 'Nv. 8' : DIFFICULTY_CONFIG[diff].label}
                </div>
              </button>
            );
          })}
        </div>
        
        <div
          style={{
            padding: 12,
            background: `${DIFFICULTY_CONFIG[selectedDifficulty].color}15`,
            borderRadius: 8,
            fontSize: 13,
            color: DIFFICULTY_CONFIG[selectedDifficulty].color,
            textAlign: 'center',
          }}
        >
          {DIFFICULTY_CONFIG[selectedDifficulty].emoji} <strong>{DIFFICULTY_CONFIG[selectedDifficulty].label}:</strong> {DIFFICULTY_CONFIG[selectedDifficulty].desc}
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmDeck && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={() => setConfirmDeck(null)}
        >
          <div
            style={{
              background: 'var(--bg2)',
              border: '2px solid var(--accent)',
              borderRadius: 16,
              padding: '32px',
              maxWidth: 400,
              width: '100%',
              textAlign: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚔️</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px 0' }}>
              Confirmar Deck
            </h2>
            <p style={{ fontSize: 14, color: 'var(--txt2)', margin: '0 0 24px 0' }}>
              Você quer mesmo usar o deck <strong>"{confirmDeck.name}"</strong>?
            </p>
            <p style={{ fontSize: 12, color: 'var(--txt3)', margin: '0 0 24px 0' }}>
              Dificuldade: {DIFFICULTY_CONFIG[selectedDifficulty].emoji} {DIFFICULTY_CONFIG[selectedDifficulty].label}
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                onClick={() => setConfirmDeck(null)}
                onMouseEnter={playHoverSound}
                style={{
                  padding: '12px 24px',
                  background: 'var(--bg3)',
                  border: '1px solid var(--b2)',
                  borderRadius: 8,
                  color: 'var(--txt)',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmStart}
                onMouseEnter={playHoverSound}
                style={{
                  padding: '12px 24px',
                  background: 'var(--accent)',
                  border: 'none',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Sim, começar duelo!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bot Deck Info */}
      <div
        style={{
          marginBottom: 24,
          padding: 20,
          background: 'linear-gradient(135deg, var(--bg2) 0%, var(--bg3) 100%)',
          borderRadius: 16,
          border: '2px solid var(--accent)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 48 }}>{DIFFICULTY_CONFIG[selectedDifficulty].emoji}</div>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px 0' }}>
              Oponente: {selectedDifficulty === 'king' ? 'REI DOS TROFÉUS!!' : 'Bot Supreme'}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--txt2)', margin: 0 }}>
              Dificuldade: {DIFFICULTY_CONFIG[selectedDifficulty].label} · {games.length} jogos
            </p>
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt3)', margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: 1 }}>
            Jogos do Bot (suas conquistas):
          </h4>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {games.slice(0, 8).map((game) => (
              <div
                key={game.appId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 10px',
                  background: 'var(--bg1)',
                  borderRadius: 6,
                  border: '1px solid var(--b2)',
                }}
              >
                <img
                  src={game.headerImage}
                  alt={game.name}
                  style={{ width: 40, height: 18, borderRadius: 3, objectFit: 'cover' }}
                />
                <span style={{ fontSize: 11, color: 'var(--txt)' }}>{game.name}</span>
              </div>
            ))}
            {games.length > 8 && (
              <div
                style={{
                  padding: '4px 10px',
                  background: 'var(--bg3)',
                  borderRadius: 6,
                  border: '1px solid var(--b2)',
                  fontSize: 11,
                  color: 'var(--txt2)',
                }}
              >
                +{games.length - 8} mais
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            padding: 12,
            background: 'rgba(58, 122, 204, 0.1)',
            borderRadius: 8,
            fontSize: 12,
            color: 'var(--txt2)',
          }}
        >
          💡 <strong>Dica:</strong> O bot usa conquistas REAIS dos seus jogos! 
          As cartas do bot têm os mesmos ícones, nomes e raridades das suas conquistas. Boa sorte! 🎮
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px 0' }}>
          🎴 Escolha seu Deck
        </h3>
        <p style={{ fontSize: 13, color: 'var(--txt2)', margin: 0 }}>
          Selecione um dos seus decks salvos para enfrentar o bot.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {savedDecks.map((deck) => {
          const deckGames = deck.gameIds
            .map((id) => games.find((g) => g.appId === id))
            .filter((g): g is NonNullable<typeof g> => g !== undefined);

          return (
            <div
              key={deck.id}
              onClick={() => handleDeckClick(deck)}
              style={{
                background: 'var(--bg2)',
                border: '1px solid var(--b2)',
                borderRadius: 12,
                padding: 16,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--b2)';
                e.currentTarget.style.transform = 'none';
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 4px 0' }}>
                    {deck.name}
                  </h3>
                  <div style={{ fontSize: 12, color: 'var(--txt2)' }}>
                    {deck.cards.length} cartas · {deckGames.length} jogos
                  </div>
                </div>
                <div style={{ fontSize: 24 }}>⚔️</div>
              </div>

              {/* Games preview */}
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {deckGames.slice(0, 4).map((game) => (
                  <img
                    key={game.appId}
                    src={game.headerImage}
                    alt={game.name}
                    style={{
                      width: 60,
                      height: 28,
                      borderRadius: 4,
                      objectFit: 'cover',
                    }}
                  />
                ))}
                {deckGames.length > 4 && (
                  <div
                    style={{
                      width: 60,
                      height: 28,
                      borderRadius: 4,
                      background: 'var(--bg3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      color: 'var(--txt2)',
                    }}
                  >
                    +{deckGames.length - 4}
                  </div>
                )}
              </div>

              <div style={{ marginTop: 12, fontSize: 11, color: 'var(--txt3)' }}>
                Criado em {new Date(deck.createdAt).toLocaleDateString('pt-BR')}
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          marginTop: 24,
          padding: 16,
          background: 'var(--bg2)',
          borderRadius: 8,
          border: '1px solid var(--b2)',
        }}
      >
        <h4 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 8px 0' }}>📜 Regras do Duelo</h4>
        <ul style={{ fontSize: 12, color: 'var(--txt2)', margin: 0, paddingLeft: 16, lineHeight: 1.6 }}>
          <li>Cada jogador começa com 5 cartas na mão</li>
          <li>Você tem 30 segundos para escolher até 3 cartas</li>
          <li>Quem jogar mais dano total ganha 1 ponto</li>
          <li>Primeiro a fazer 5 pontos vence!</li>
          <li>Custo por carta: Common=1, Uncommon=2, Rare=3, Epic=4, Legendary/Mythic=5</li>
        </ul>
      </div>
    </div>
  );
};

export default DeckSelectorForDuel;

// ─────────────────────────────────────────────────────────────────────────────
//  src/components/views/DeckSelectorForDuel.tsx
//  Deck selection screen for starting a duel
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useBattleStore } from '../../store/useBattleStore';

// Games used by the bot (from the achievements database)
const BOT_GAMES = [
  { name: 'Counter-Strike 2', appId: 730, header: 'https://cdn.akamai.steamstatic.com/steam/apps/730/header.jpg' },
  { name: 'Dota 2', appId: 570, header: 'https://cdn.akamai.steamstatic.com/steam/apps/570/header.jpg' },
  { name: 'Team Fortress 2', appId: 440, header: 'https://cdn.akamai.steamstatic.com/steam/apps/440/header.jpg' },
  { name: 'Apex Legends', appId: 1172470, header: 'https://cdn.akamai.steamstatic.com/steam/apps/1172470/header.jpg' },
  { name: 'Rocket League', appId: 252950, header: 'https://cdn.akamai.steamstatic.com/steam/apps/252950/header.jpg' },
  { name: 'Rust', appId: 252490, header: 'https://cdn.akamai.steamstatic.com/steam/apps/252490/header.jpg' },
  { name: 'Warframe', appId: 230410, header: 'https://cdn.akamai.steamstatic.com/steam/apps/230410/header.jpg' },
  { name: 'ARK: Survival Evolved', appId: 346110, header: 'https://cdn.akamai.steamstatic.com/steam/apps/346110/header.jpg' },
  { name: 'Terraria', appId: 105600, header: 'https://cdn.akamai.steamstatic.com/steam/apps/105600/header.jpg' },
  { name: 'Half-Life 2', appId: 220, header: 'https://cdn.akamai.steamstatic.com/steam/apps/220/header.jpg' },
  { name: 'Portal 2', appId: 620, header: 'https://cdn.akamai.steamstatic.com/steam/apps/620/header.jpg' },
];

const DeckSelectorForDuel: React.FC = () => {
  const savedDecks = useAppStore((s) => s.savedDecks);
  const games = useAppStore((s) => s.games);
  const startBattle = useBattleStore((s) => s.startBattle);

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
          <div style={{ fontSize: 48 }}>🤖</div>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px 0' }}>
              Oponente: Bot Supreme
            </h2>
            <p style={{ fontSize: 13, color: 'var(--txt2)', margin: 0 }}>
              Deck com {games.length} jogos · 20 cartas
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
              onClick={() => startBattle(deck.cards, games)}
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
          <li>Você tem 10 segundos para escolher uma carta</li>
          <li>Quem jogar a carta mais forte ganha 1 ponto</li>
          <li>Primeiro a fazer 5 pontos vence!</li>
          <li>A cada round, ambos compram 1 nova carta</li>
        </ul>
      </div>
    </div>
  );
};

export default DeckSelectorForDuel;

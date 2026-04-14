import React from 'react';
import { useAppStore, selectFilteredGames } from '../../store/useAppStore';
import { FilterBar, Empty } from '../ui';
import GameCard from '../dashboard/GameCard';
import type { GameFilter, GameSort } from '../../types';

const GAME_FILTERS: { value: GameFilter; label: string }[] = [
  { value: 'all',        label: 'Todos' },
  { value: 'started',    label: 'Em Progresso' },
  { value: 'notstarted', label: 'Não Iniciados' },
  { value: 'platinum',   label: 'Platinados' },
];

const SORT_OPTIONS: { value: GameSort; label: string }[] = [
  { value: 'name_asc',      label: 'A → Z' },
  { value: 'name_desc',     label: 'Z → A' },
  { value: 'pct_desc',      label: '% (maior → menor)' },
  { value: 'pct_asc',       label: '% (menor → maior)' },
  { value: 'playtime_desc', label: 'Mais jogados' },
  { value: 'recent',        label: 'Conquista recente' },
];

const GridView: React.FC = () => {
  const gameFilter    = useAppStore((s) => s.gameFilter);
  const setGameFilter = useAppStore((s) => s.setGameFilter);
  const gameSort      = useAppStore((s) => s.gameSort);
  const setGameSort   = useAppStore((s) => s.setGameSort);
  const gameSearch    = useAppStore((s) => s.gameSearch);
  const setGameSearch = useAppStore((s) => s.setGameSearch);
  const games         = useAppStore(selectFilteredGames);
  const totalGames    = useAppStore((s) => s.games.length);

  return (
    <div id="view-grid">
      {/* Filter + Sort + Search bar */}
      <div
        className="grid-filter-bar"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '16px 20px',
          flexWrap: 'wrap',
          borderBottom: '1px solid var(--b2)',
          maxWidth: 1400,
          margin: '0 auto',
          width: '100%',
        }}
      >
        {/* Status filter pills */}
        <FilterBar options={GAME_FILTERS} active={gameFilter} onChange={setGameFilter} />

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Search input */}
        <input
          type="text"
          placeholder="🔍 Buscar jogo..."
          value={gameSearch}
          onChange={(e) => setGameSearch(e.target.value)}
          style={{
            background: 'var(--bg3)',
            border: '1px solid var(--b2)',
            borderRadius: 8,
            padding: '7px 12px',
            fontSize: 13,
            color: 'var(--txt)',
            outline: 'none',
            width: 200,
            transition: 'border-color .2s',
          }}
          onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
          onBlur={(e) => (e.target.style.borderColor = 'var(--b2)')}
        />

        {/* Sort select */}
        <select
          value={gameSort}
          onChange={(e) => setGameSort(e.target.value as GameSort)}
          style={{
            background: 'var(--bg3)',
            border: '1px solid var(--b2)',
            borderRadius: 8,
            padding: '7px 10px',
            fontSize: 13,
            color: 'var(--txt)',
            outline: 'none',
          }}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <span
          style={{
            fontSize: 11,
            color: 'var(--txt3)',
            whiteSpace: 'nowrap',
          }}
        >
          {games.length} / {totalGames}
        </span>
      </div>

      {/* Grid */}
      {games.length === 0 ? (
        <Empty
          icon="🎮"
          title="Nenhum jogo encontrado"
          sub={
            gameSearch
              ? `Nenhum resultado para "${gameSearch}"`
              : 'Tente mudar o filtro ou adicione jogos à sua biblioteca.'
          }
        />
      ) : (
        <div className="games-grid" id="games-grid">
          {games.map((game) => (
            <GameCard key={game.appId} game={game} />
          ))}
        </div>
      )}
    </div>
  );
};

export default GridView;

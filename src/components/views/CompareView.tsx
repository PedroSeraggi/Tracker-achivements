// =============================================================================
//  src/components/search/CompareView.tsx  (redesenhado)
//
//  Comparação de conquistas lado-a-lado entre o usuário logado e o jogador
//  pesquisado para um jogo específico.
//
//  Melhorias vs. versão anterior:
//    · Chips de resumo clicáveis com contadores (Ambos / Só eu / Só ele / Nenhum)
//    · Rows coloridas por categoria (verde / azul / roxo / cinza)
//    · Check circles com cor de player
//    · Conquistas raras destacadas com badge de porcentagem
//    · Animação de entrada suave
//    · Responsivo para mobile
// =============================================================================

import React, { useMemo } from 'react';
import {
  useAppStore,
  selectSearchActiveGame,
} from '../../store/useAppStore';
import { Avatar, FilterBar } from '../ui';
import type { CompareFilter, Achievement } from '../../types';

// ─── Constants ────────────────────────────────────────────────────────────────

const COMPARE_FILTERS: { value: CompareFilter; label: string }[] = [
  { value: 'all',        label: 'Todos'       },
  { value: 'only_me',   label: 'Só eu tenho'  },
  { value: 'only_them', label: 'Só ele(a) tem' },
  { value: 'both',      label: 'Ambos temos'  },
  { value: 'neither',   label: 'Nenhum tem'   },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface CompareRow {
  ach     : Achievement;
  meHas   : boolean;
  themHas : boolean;
  category: 'both' | 'only_me' | 'only_them' | 'neither';
}

// ─── Summary chip ─────────────────────────────────────────────────────────────

interface SummaryChipProps {
  icon      : string;
  label     : string;
  count     : number;
  variant   : 'both' | 'only-me' | 'only-them' | 'neither';
  active    : boolean;
  onClick   : () => void;
}

const SummaryChip: React.FC<SummaryChipProps> = ({
  icon, label, count, variant, active, onClick,
}) => (
  <button
    className={`compare-chip compare-chip--${variant}${active ? '' : ' compare-chip--inactive'}`}
    onClick={onClick}
    title={`Filtrar: ${label}`}
  >
    {icon}
    <span>{label}</span>
    <span
      style={{
        fontWeight    : 900,
        fontSize      : '13px',
        marginLeft    : '2px',
      }}
    >
      {count}
    </span>
  </button>
);

// ─── Main component ───────────────────────────────────────────────────────────

const CompareView: React.FC = () => {
  const theirGame      = useAppStore(selectSearchActiveGame);
  const myGame         = useAppStore((s) =>
    s.games.find((g) => g.appId === s.searchActiveGameAppId)
  );
  const compareFilter    = useAppStore((s) => s.compareFilter);
  const setCompareFilter = useAppStore((s) => s.setCompareFilter);
  const setSearchView    = useAppStore((s) => s.setSearchView);
  const currentUser      = useAppStore((s) => s.currentUser);
  const searchedPlayer   = useAppStore((s) => s.searchedPlayer);

  // ── Build compare rows ──────────────────────────────────────────────────
  const rows = useMemo<CompareRow[]>(() => {
    if (!myGame) return [];
    return myGame.achievements.map((ach) => {
      const meHas   = ach.achieved;
      const theirAch = theirGame?.achievements.find((a) => a.apiName === ach.apiName);
      const themHas  = theirAch?.achieved ?? false;
      const category: CompareRow['category'] =
        meHas && themHas  ? 'both'       :
        meHas             ? 'only_me'    :
        themHas           ? 'only_them'  :
                            'neither';
      return { ach, meHas, themHas, category };
    });
  }, [myGame, theirGame]);

  // ── Category counts (for chips) ─────────────────────────────────────────
  const counts = useMemo(() => ({
    both      : rows.filter((r) => r.category === 'both').length,
    only_me   : rows.filter((r) => r.category === 'only_me').length,
    only_them : rows.filter((r) => r.category === 'only_them').length,
    neither   : rows.filter((r) => r.category === 'neither').length,
  }), [rows]);

  // ── Filtered rows ────────────────────────────────────────────────────────
  const filtered = useMemo(
    () =>
      compareFilter === 'all'
        ? rows
        : rows.filter((r) => r.category === compareFilter),
    [rows, compareFilter]
  );

  // ── Guard ────────────────────────────────────────────────────────────────
  if (!myGame) return null;

  const myPct    = myGame.percentage;
  const theirPct = theirGame?.percentage ?? 0;

  // ── Chip click handler: toggle filter ────────────────────────────────────
  const handleChipClick = (
    filter: 'both' | 'only_me' | 'only_them' | 'neither'
  ) => {
    setCompareFilter(compareFilter === filter ? 'all' : filter);
  };

  // ── Label helpers ─────────────────────────────────────────────────────────
  const myName    = currentUser?.personaName    ?? 'Você';
  const theirName = searchedPlayer?.user.personaName ?? 'Jogador';

  // ────────────────────────────────────────────────────────────────────────
  //  RENDER
  // ────────────────────────────────────────────────────────────────────────
  return (
    <div id="search-compare-view">

      {/* ── Topbar ─────────────────────────────────────────────────── */}
      <div className="compare-topbar">
        <button
          className="detail-back"
          onClick={() => setSearchView('game')}
        >
          ← Voltar ao Jogo
        </button>
        <div className="compare-title">
          {myGame.name} — Comparação
        </div>
      </div>

      {/* ── Player header cards ─────────────────────────────────────── */}
      <div className="compare-header-cards">

        {/* Me */}
        <div className="compare-player-card me">
          <Avatar src={currentUser?.avatarUrl} size={52} />
          <div className="compare-player-info">
            <div className="compare-player-name">{myName}</div>
            <div
              className="compare-player-pct"
              style={{ color: 'var(--pp-me-color)', fontSize: 32, fontWeight: 900 }}
            >
              {myPct}%
            </div>
            <div className="compare-player-sub">
              {myGame.unlockedCount}/{myGame.totalCount} conquistas
            </div>
          </div>
        </div>

        <span className="compare-vs">VS</span>

        {/* Them */}
        <div className="compare-player-card them">
          <Avatar src={searchedPlayer?.user.avatarUrl} size={52} />
          <div className="compare-player-info">
            <div className="compare-player-name">{theirName}</div>
            <div
              className="compare-player-pct"
              style={{ color: 'var(--pp-them-color)', fontSize: 32, fontWeight: 900 }}
            >
              {theirPct}%
            </div>
            <div className="compare-player-sub">
              {theirGame?.unlockedCount ?? 0}/
              {theirGame?.totalCount ?? myGame.totalCount} conquistas
            </div>
          </div>
        </div>
      </div>

      {/* ── Side-by-side progress bars ──────────────────────────────── */}
      <div className="compare-pbar-wrap">
        <div className="compare-pbar-side" style={{ textAlign: 'right' }}>
          <div className="compare-pbar-label">{myName}</div>
          <div className="compare-pbar-track" style={{ direction: 'rtl' }}>
            <div
              className="compare-pbar-fill-me"
              style={{ width: `${myPct}%` }}
            />
          </div>
        </div>
        <div className="compare-pbar-center">
          <span style={{ fontSize: 10, color: 'var(--txt3)' }}>VS</span>
        </div>
        <div className="compare-pbar-side">
          <div className="compare-pbar-label">{theirName}</div>
          <div className="compare-pbar-track">
            <div
              className="compare-pbar-fill-them"
              style={{ width: `${theirPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── Summary chips ───────────────────────────────────────────── */}
      <div className="compare-summary-chips">
        <SummaryChip
          icon="🤝"
          label="Ambos"
          count={counts.both}
          variant="both"
          active={compareFilter === 'all' || compareFilter === 'both'}
          onClick={() => handleChipClick('both')}
        />
        <SummaryChip
          icon="👤"
          label="Só eu"
          count={counts.only_me}
          variant="only-me"
          active={compareFilter === 'all' || compareFilter === 'only_me'}
          onClick={() => handleChipClick('only_me')}
        />
        <SummaryChip
          icon="👥"
          label="Só ele(a)"
          count={counts.only_them}
          variant="only-them"
          active={compareFilter === 'all' || compareFilter === 'only_them'}
          onClick={() => handleChipClick('only_them')}
        />
        <SummaryChip
          icon="⭕"
          label="Nenhum"
          count={counts.neither}
          variant="neither"
          active={compareFilter === 'all' || compareFilter === 'neither'}
          onClick={() => handleChipClick('neither')}
        />
      </div>

      {/* ── Filter bar (text labels, for accessibility) ─────────────── */}
      <div className="compare-filters">
        <FilterBar
          options={COMPARE_FILTERS}
          active={compareFilter}
          onChange={setCompareFilter}
        />
      </div>

      {/* ── Achievement rows ─────────────────────────────────────────── */}
      <div id="compare-list" className="compare-list">
        {filtered.length === 0 ? (
          <div
            style={{
              padding   : '40px 0',
              textAlign : 'center',
              color     : 'var(--txt3)',
              fontSize  : 13,
            }}
          >
            Nenhuma conquista nesta categoria.
          </div>
        ) : (
          filtered.map(({ ach, meHas, themHas, category }) => {
            const isRare =
              ach.globalPercent != null && ach.globalPercent <= 5;

            return (
              <div
                key={ach.apiName}
                className={`compare-item ${category}`}
              >
                {/* My check */}
                <div
                  className={`compare-check${meHas ? ' me-yes' : ''}`}
                  title={meHas ? `${myName} desbloqueou` : `${myName} não desbloqueou`}
                >
                  {meHas ? '✓' : ''}
                </div>

                {/* Center info */}
                <div className="compare-item-center">
                  <img
                    className="compare-item-icon"
                    src={
                      // Show colored icon if either player has it
                      meHas || themHas ? ach.iconUrl : ach.iconGrayUrl
                    }
                    alt={ach.displayName}
                    onError={(e) =>
                      ((e.currentTarget as HTMLImageElement).style.visibility = 'hidden')
                    }
                  />
                  <div className="compare-item-text">
                    <div className="compare-item-name">{ach.displayName}</div>
                    {ach.description && (
                      <div className="compare-item-desc">{ach.description}</div>
                    )}
                    {isRare && (
                      <div className="compare-item-pct" title="Conquista rara — poucos jogadores têm">
                        💎 {ach.globalPercent!.toFixed(2)}% dos jogadores
                      </div>
                    )}
                    {!isRare && ach.globalPercent != null && (
                      <div
                        className="compare-item-pct"
                        style={{
                          color     : 'var(--txt3)',
                          background: 'transparent',
                          border    : 'none',
                          padding   : '0',
                          fontWeight: 400,
                          fontSize  : '10px',
                        }}
                      >
                        {ach.globalPercent.toFixed(1)}% dos jogadores
                      </div>
                    )}
                  </div>
                </div>

                {/* Their check */}
                <div
                  className={`compare-check${themHas ? ' them-yes' : ''}`}
                  title={themHas ? `${theirName} desbloqueou` : `${theirName} não desbloqueou`}
                >
                  {themHas ? '✓' : ''}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Legend ───────────────────────────────────────────────────── */}
      <div
        style={{
          display   : 'flex',
          justifyContent: 'center',
          gap       : 20,
          padding   : '12px 0 32px',
          fontSize  : 11,
          color     : 'var(--txt3)',
        }}
      >
        <span>
          <span style={{ color: 'var(--pp-me-color)', fontWeight: 700 }}>■</span>
          {' '}{myName}
        </span>
        <span>
          <span style={{ color: 'var(--pp-them-color)', fontWeight: 700 }}>■</span>
          {' '}{theirName}
        </span>
        <span>
          <span style={{ color: '#4ade80', fontWeight: 700 }}>■</span>
          {' '}Ambos
        </span>
      </div>
    </div>
  );
};

export default CompareView;

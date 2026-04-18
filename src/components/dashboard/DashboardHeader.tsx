import React, { useState } from 'react';
import { useAppStore, selectGlobalStats } from '../../store/useAppStore';
import { TrophyIcon } from '../ui';
import { fetchGames, logoutRequest, clearGamesCache } from '../../api/steamApi';

const TABS = [
  { id: 'grid',     label: 'Todos os Jogos' },
  { id: 'overview', label: 'Visão Geral' },
  { id: 'profile',  label: '🏆 Perfil' },
  { id: 'guides',   label: '📖 Guias' },
  { id: 'search',   label: '🔍 Buscar Jogadores' },
  { id: 'duel',     label: '⚔️ Duelo' },
  { id: 'leaderboard', label: '🏆 Leaderboard' },
] as const;

const DashboardHeader: React.FC = () => {
  const dashView       = useAppStore((s) => s.dashView);
  const setDashView    = useAppStore((s) => s.setDashView);
  const currentUser    = useAppStore((s) => s.currentUser);
  const setLibraryOpen = useAppStore((s) => s.setLibraryOpen);
  const setScreen      = useAppStore((s) => s.setScreen);
  const setGames       = useAppStore((s) => s.setGames);
  const setLoading     = useAppStore((s) => s.setLoading);
  const addLoadingGame = useAppStore((s) => s.addLoadingGame);
  const addToast       = useAppStore((s) => s.addToast);
  const logout         = useAppStore((s) => s.logout);

  const { totalUnlocked, totalAch, platCount, pct } = useAppStore(selectGlobalStats);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    clearGamesCache(); // force fresh fetch from Steam
    setScreen('loading');
    setLoading({ status: 'Atualizando dados...', progress: 3, loadedGames: [] });
    try {
      const games = await fetchGames(currentUser?.steamId, (name, progress) => {
        addLoadingGame(name);
        setLoading({ status: `Carregando: ${name}`, progress });
      }, true); // forceRefresh = true
      setGames(games);
      setLoading({ status: 'Concluído! 🎉', progress: 100 });
      setTimeout(() => {
        setScreen('dashboard');
        addToast('success', 'Dados atualizados com sucesso!');
      }, 400);
    } catch {
      setScreen('dashboard');
      addToast('error', 'Erro ao atualizar. Tente novamente.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleLogout = async () => {
    try { await logoutRequest(); } finally { logout(); }
  };

  return (
    <header className="dash-header">
      <div className="dash-header-inner">
        <div className="dash-header-top">
          <TrophyIcon size={30} />
          <div className="header-title">
            <h1>Steam <span>Trophy Tracker</span></h1>
            <p className="mono" style={{ fontSize: 11, color: 'var(--txt3)' }}>
              {currentUser?.personaName ?? 'Steam conectado'}
            </p>
          </div>

          <div className="header-stats">
            <div className="hstat">
              <div className="hstat-val" style={{ color: 'var(--accent)' }}>{totalUnlocked}/{totalAch}</div>
              <div className="hstat-lbl">TROFÉUS</div>
            </div>
            <div className="hstat">
              <div className="hstat-val" style={{ color: 'var(--plat, #e5e4e2)' }}>{platCount}</div>
              <div className="hstat-lbl">PLATINAS</div>
            </div>
            <div className="hstat">
              <div className="hstat-val" style={{ color: 'var(--accent)' }}>{pct}%</div>
              <div className="hstat-lbl">GERAL</div>
            </div>
          </div>

          <div className="header-actions">
            <button className="btn-sm" onClick={() => setLibraryOpen(true)}>+ Adicionar Jogos</button>
            <button
              className="btn-sm"
              onClick={handleRefresh}
              disabled={refreshing}
              style={{ opacity: refreshing ? 0.5 : 1 }}
              title="Recarregar dados da Steam"
            >
              {refreshing ? '⏳' : '↺'} Atualizar
            </button>
            <button className="btn-sm" onClick={handleLogout}>✕ Sair</button>
          </div>
        </div>

        <div className="progress-strip">
          <div className="progress-strip-fill" style={{ width: `${pct}%`, transition: 'width .6s' }} />
        </div>

        <nav className="dash-nav">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`nav-tab${dashView === tab.id ? ' active' : ''}`}
              onClick={() => setDashView(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
};

export default DashboardHeader;

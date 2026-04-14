import { useCallback, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import {
  fetchMe,
  fetchGames,
  fetchAchievements,
  searchPlayer as apiSearchPlayer,
  clearGamesCache,
} from '../api/steamApi';

// ── Init — runs once on app mount ─────────────────────────────────────────────
export function useInit() {
  const setScreen      = useAppStore((s) => s.setScreen);
  const setCurrentUser = useAppStore((s) => s.setCurrentUser);
  const setGames       = useAppStore((s) => s.setGames);
  const setLoading     = useAppStore((s) => s.setLoading);
  const addLoadingGame = useAppStore((s) => s.addLoadingGame);
  const addToast       = useAppStore((s) => s.addToast);

  useEffect(() => {
    const params       = new URLSearchParams(window.location.search);
    const justLoggedIn = params.get('loggedIn') === '1';
    if (justLoggedIn) window.history.replaceState({}, '', '/');

    async function init() {
      setScreen('loading');
      setLoading({ status: 'Verificando sessão...', progress: 2, loadedGames: [] });

      const user = await fetchMe();
      if (!user) {
        setScreen('login');
        return;
      }

      setCurrentUser(user);
      setLoading({ status: 'Buscando lista de jogos...', progress: 5, loadedGames: [] });

      try {
        const games = await fetchGames(user.steamId, (name, pct) => {
          addLoadingGame(name);
          setLoading({ status: `Carregando: ${name}`, progress: pct });
        });
        setGames(games);
        setLoading({ status: 'Concluído! 🎉', progress: 100 });
        setTimeout(() => setScreen('dashboard'), 400);
      } catch {
        addToast('error', 'Erro ao carregar seus jogos. Tente atualizar.');
        setTimeout(() => setScreen('dashboard'), 600);
      }
    }

    init();
  }, []); // runs once on mount
}

// ── Player search ──────────────────────────────────────────────────────────────
export function usePlayerSearch() {
  const setSearchedPlayer    = useAppStore((s) => s.setSearchedPlayer);
  const setSearchPlayerGames = useAppStore((s) => s.setSearchPlayerGames);
  const setSearchError       = useAppStore((s) => s.setSearchError);
  const setSearchView        = useAppStore((s) => s.setSearchView);
  const setSearchLoading     = useAppStore((s) => s.setSearchLoading);
  const addToast             = useAppStore((s) => s.addToast);

  const search = useCallback(
    async (query: string) => {
      setSearchError('');
      setSearchLoading(true);
      try {
        const user = await apiSearchPlayer(query);
        setSearchedPlayer({ user, games: [], gamesLoaded: false });
        addToast('success', `Jogador encontrado: ${user.personaName}`);
      } catch {
        setSearchError('Jogador não encontrado. Verifique o SteamID ou URL do perfil.');
        addToast('error', 'Jogador não encontrado.');
      } finally {
        setSearchLoading(false);
      }
    },
    [setSearchedPlayer, setSearchError, setSearchLoading, addToast]
  );

  const loadPlayerGames = useCallback(
    async (steamId: string) => {
      setSearchView('profile');
      setSearchLoading(true);
      try {
        const games = await fetchGames(steamId);
        setSearchPlayerGames(games);
        addToast('info', `${games.length} jogo${games.length !== 1 ? 's' : ''} carregado${games.length !== 1 ? 's' : ''}.`);
      } catch {
        setSearchError('Não foi possível carregar os jogos. O perfil pode ser privado.');
        addToast('error', 'Erro ao carregar jogos. Perfil pode ser privado.');
        setSearchView('home');
      } finally {
        setSearchLoading(false);
      }
    },
    [setSearchPlayerGames, setSearchError, setSearchView, setSearchLoading, addToast]
  );

  return { search, loadPlayerGames };
}

// ── Achievement refresh (individual game) ─────────────────────────────────────
export function useRefreshAchievements() {
  const games    = useAppStore((s) => s.games);
  const setGames = useAppStore((s) => s.setGames);
  const addToast = useAppStore((s) => s.addToast);

  const refresh = useCallback(
    async (appId: number) => {
      try {
        const updated  = await fetchAchievements(appId);
        const unlocked = updated.filter((a) => a.achieved).length;
        const pct      = updated.length > 0 ? Math.round((unlocked / updated.length) * 100) : 0;
        setGames(
          games.map((g) =>
            g.appId !== appId
              ? g
              : { ...g, achievements: updated, unlockedCount: unlocked, percentage: pct }
          )
        );
        addToast('success', 'Conquistas atualizadas!');
      } catch {
        addToast('error', 'Erro ao atualizar conquistas.');
      }
    },
    [games, setGames, addToast]
  );

  return { refresh };
}

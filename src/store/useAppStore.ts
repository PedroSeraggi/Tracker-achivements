import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type {
  Screen,
  DashView,
  GameFilter,
  GameSort,
  AchFilter,
  CompareFilter,
  SteamUser,
  Game,
  Guide,
  GuideStep,
  SearchedPlayer,
  LoadingState,
  Toast,
  ToastKind,
} from '../types';

// ─── State shape ───────────────────────────────────────────────────────────────
interface AppState {
  // ── Auth
  screen: Screen;
  currentUser: SteamUser | null;

  // ── Games / Data
  games: Game[];
  loading: LoadingState;
  featuredGameIds: number[]; // games featured in profile
  perfectGameIds: number[]; // platinum games showcased in profile

  // ── Dashboard navigation
  dashView: DashView;
  activeGameAppId: number | null; // currently open game detail

  // ── Filters & sort
  gameFilter: GameFilter;
  gameSort: GameSort;
  gameSearch: string;
  achFilter: AchFilter;

  // ── Guides
  guides: Guide[];
  guideView: 'list' | 'create' | 'edit' | 'read';
  editingGuide: Partial<Guide> | null;
  readingGuide: Guide | null;

  // ── Player Search
  searchQuery: string;
  searchError: string;
  searchedPlayer: SearchedPlayer | null;
  searchGameFilter: GameFilter;
  searchAchFilter: AchFilter;
  searchActiveGameAppId: number | null;
  searchView: 'home' | 'profile' | 'game' | 'compare';

  // ── Compare
  compareFilter: CompareFilter;

  // ── Game Library modal
  libraryOpen: boolean;

  // ── Toasts
  toasts: Toast[];

  // ── Search loading
  searchLoading: boolean;

  // ── Actions
  setScreen: (s: Screen) => void;
  setCurrentUser: (u: SteamUser | null) => void;
  setGames: (g: Game[]) => void;
  setLoading: (l: Partial<LoadingState>) => void;
  addLoadingGame: (name: string) => void;

  // Featured games actions
  addFeaturedGame: (appId: number) => void;
  removeFeaturedGame: (appId: number) => void;
  setFeaturedGameIds: (ids: number[]) => void;
  // Perfect games actions
  addPerfectGame: (appId: number) => void;
  removePerfectGame: (appId: number) => void;
  setPerfectGameIds: (ids: number[]) => void;

  setDashView: (v: DashView) => void;
  openGameDetail: (appId: number) => void;
  closeGameDetail: () => void;

  setGameFilter: (f: GameFilter) => void;
  setGameSort: (s: GameSort) => void;
  setGameSearch: (q: string) => void;
  setAchFilter: (f: AchFilter) => void;

  // Guides actions
  setGuides: (g: Guide[]) => void;
  addGuide: (g: Guide) => void;
  updateGuide: (g: Guide) => void;
  deleteGuide: (id: string) => void;
  openGuideCreator: (guide?: Guide) => void;
  closeGuideCreator: () => void;
  openGuideReader: (guide: Guide) => void;
  closeGuideReader: () => void;
  setEditingGuide: (patch: Partial<Guide>) => void;
  addGuideStep: () => void;
  removeGuideStep: (idx: number) => void;
  updateGuideStep: (idx: number, step: Partial<GuideStep>) => void;

  // Search actions
  setSearchQuery: (q: string) => void;
  setSearchError: (e: string) => void;
  setSearchedPlayer: (p: SearchedPlayer | null) => void;
  setSearchPlayerGames: (games: Game[]) => void;
  setSearchGameFilter: (f: GameFilter) => void;
  setSearchAchFilter: (f: AchFilter) => void;
  setSearchView: (v: 'home' | 'profile' | 'game' | 'compare') => void;
  openSearchGameDetail: (appId: number) => void;
  closeSearchGameDetail: () => void;

  // Compare actions
  setCompareFilter: (f: CompareFilter) => void;

  // Library modal
  setLibraryOpen: (open: boolean) => void;

  // Toasts
  addToast: (kind: ToastKind, message: string) => void;
  removeToast: (id: string) => void;

  // Search loading
  setSearchLoading: (v: boolean) => void;

  // Auth actions
  logout: () => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────
export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set, get) => ({
        // ── Initial state
        screen: 'login',
        currentUser: null,
        games: [],
        loading: { status: 'Iniciando...', progress: 0, loadedGames: [] },
        featuredGameIds: [],
        perfectGameIds: [],
        dashView: 'grid',
        activeGameAppId: null,
        gameFilter: 'all',
        gameSort: 'name_asc',
        gameSearch: '',
        achFilter: 'all',
        guides: [],
        guideView: 'list',
        editingGuide: null,
        readingGuide: null,
        searchQuery: '',
        searchError: '',
        searchedPlayer: null,
        searchGameFilter: 'all',
        searchAchFilter: 'all',
        searchActiveGameAppId: null,
        searchView: 'home',
        compareFilter: 'all',
        libraryOpen: false,
        toasts: [],
        searchLoading: false,

        // ── Auth
        setScreen: (screen) => set({ screen }),
        setCurrentUser: (currentUser) => set({ currentUser }),
        logout: () =>
          set({
            screen: 'login',
            currentUser: null,
            games: [],
            dashView: 'grid',
            activeGameAppId: null,
            gameFilter: 'all',
            searchedPlayer: null,
            searchView: 'home',
          }),

        // ── Games
        setGames: (games) => set({ games }),
        setLoading: (l) =>
          set((s) => ({ loading: { ...s.loading, ...l } })),
        addLoadingGame: (name) =>
          set((s) => ({
            loading: {
              ...s.loading,
              loadedGames: [...s.loading.loadedGames, name],
            },
          })),

        // ── Featured games
        addFeaturedGame: (appId) =>
          set((s) => ({
            featuredGameIds: s.featuredGameIds.includes(appId)
              ? s.featuredGameIds
              : [...s.featuredGameIds, appId].slice(0, 6),
          })),
        removeFeaturedGame: (appId) =>
          set((s) => ({
            featuredGameIds: s.featuredGameIds.filter((id) => id !== appId),
          })),
        setFeaturedGameIds: (ids) => set({ featuredGameIds: ids.slice(0, 6) }),

        // ── Perfect games
        addPerfectGame: (appId) =>
          set((s) => ({
            perfectGameIds: s.perfectGameIds.includes(appId)
              ? s.perfectGameIds
              : [...s.perfectGameIds, appId].slice(0, 6),
          })),
        removePerfectGame: (appId) =>
          set((s) => ({
            perfectGameIds: s.perfectGameIds.filter((id) => id !== appId),
          })),
        setPerfectGameIds: (ids) => set({ perfectGameIds: ids.slice(0, 6) }),

        // ── Dashboard
        setDashView: (dashView) =>
          set({ dashView, activeGameAppId: null }),
        openGameDetail: (appId) =>
          set({ activeGameAppId: appId }),
        closeGameDetail: () =>
          set({ activeGameAppId: null, achFilter: 'all' }),

        // ── Filters
        setGameFilter: (gameFilter) => set({ gameFilter }),
        setGameSort: (gameSort) => set({ gameSort }),
        setGameSearch: (gameSearch) => set({ gameSearch }),
        setAchFilter: (achFilter) => set({ achFilter }),

        // ── Guides
        setGuides: (guides) => set({ guides }),
        addGuide: (guide) =>
          set((s) => ({ guides: [guide, ...s.guides] })),
        updateGuide: (guide) =>
          set((s) => ({
            guides: s.guides.map((g) => (g.id === guide.id ? guide : g)),
          })),
        deleteGuide: (id) =>
          set((s) => ({ guides: s.guides.filter((g) => g.id !== id) })),
        openGuideCreator: (guide) =>
          set({
            guideView: guide ? 'edit' : 'create',
            editingGuide: guide ?? {
              title: '',
              steps: [],
              gameAppId: undefined,
              achievementApiName: undefined,
            },
          }),
        closeGuideCreator: () =>
          set({ guideView: 'list', editingGuide: null }),
        openGuideReader: (guide) =>
          set({ guideView: 'read', readingGuide: guide }),
        closeGuideReader: () =>
          set({ guideView: 'list', readingGuide: null }),
        setEditingGuide: (patch) =>
          set((s) => ({
            editingGuide: s.editingGuide ? { ...s.editingGuide, ...patch } : patch,
          })),
        addGuideStep: () =>
          set((s) => {
            const step: GuideStep = {
              id: `step-${Date.now()}`,
              title: '',
              content: '',
            };
            const current = s.editingGuide ?? {};
            return {
              editingGuide: {
                ...current,
                steps: [...(current.steps ?? []), step],
              },
            };
          }),
        removeGuideStep: (idx) =>
          set((s) => {
            const steps = [...(s.editingGuide?.steps ?? [])];
            steps.splice(idx, 1);
            return { editingGuide: { ...s.editingGuide, steps } };
          }),
        updateGuideStep: (idx, patch) =>
          set((s) => {
            const steps = [...(s.editingGuide?.steps ?? [])];
            steps[idx] = { ...steps[idx], ...patch };
            return { editingGuide: { ...s.editingGuide, steps } };
          }),

        // ── Search
        setSearchQuery: (searchQuery) => set({ searchQuery }),
        setSearchError: (searchError) => set({ searchError }),
        setSearchedPlayer: (searchedPlayer) =>
          set({ searchedPlayer, searchView: 'home' }),
        setSearchPlayerGames: (games) =>
          set((s) => ({
            searchedPlayer: s.searchedPlayer
              ? { ...s.searchedPlayer, games, gamesLoaded: true }
              : null,
          })),
        setSearchGameFilter: (searchGameFilter) => set({ searchGameFilter }),
        setSearchAchFilter: (searchAchFilter) => set({ searchAchFilter }),
        setSearchView: (searchView) => set({ searchView }),
        openSearchGameDetail: (appId) =>
          set({ searchActiveGameAppId: appId, searchView: 'game' }),
        closeSearchGameDetail: () =>
          set({ searchActiveGameAppId: null, searchView: 'profile', searchAchFilter: 'all' }),

        // ── Compare
        setCompareFilter: (compareFilter) => set({ compareFilter }),

        // ── Library
        setLibraryOpen: (libraryOpen) => set({ libraryOpen }),

        // ── Toasts
        addToast: (kind, message) => {
          const id = `toast-${Date.now()}`;
          set((s) => ({ toasts: [...s.toasts, { id, kind, message }] }));
          // Auto-remove after 3.5s
          setTimeout(() => {
            set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
          }, 3500);
        },
        removeToast: (id) =>
          set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

        // ── Search loading
        setSearchLoading: (searchLoading) => set({ searchLoading }),
      }),
      {
        name: 'steam-tracker-storage',
        // Only persist guides and featured/perfect games locally; auth/games come from server
        partialize: (s) => ({ guides: s.guides, featuredGameIds: s.featuredGameIds, perfectGameIds: s.perfectGameIds }),
      }
    )
  )
);

// ─── Computed selectors ────────────────────────────────────────────────────────
function applySort(games: Game[], sort: GameSort): Game[] {
  const copy = [...games];
  switch (sort) {
    case 'name_asc':      return copy.sort((a, b) => a.name.localeCompare(b.name));
    case 'name_desc':     return copy.sort((a, b) => b.name.localeCompare(a.name));
    case 'pct_desc':      return copy.sort((a, b) => b.percentage - a.percentage);
    case 'pct_asc':       return copy.sort((a, b) => a.percentage - b.percentage);
    case 'playtime_desc': return copy.sort((a, b) => b.playtimeForever - a.playtimeForever);
    case 'recent':
      return copy.sort((a, b) => {
        const aLatest = Math.max(...a.achievements.map((x) => x.unlockTime ?? 0));
        const bLatest = Math.max(...b.achievements.map((x) => x.unlockTime ?? 0));
        return bLatest - aLatest;
      });
    default: return copy;
  }
}

export const selectFilteredGames = (state: AppState): Game[] => {
  const { games, gameFilter, gameSort, gameSearch } = state;
  let result = games;

  // Filter by status
  switch (gameFilter) {
    case 'started':
      result = result.filter((g) => g.unlockedCount > 0 && g.percentage < 100);
      break;
    case 'notstarted':
      result = result.filter((g) => g.unlockedCount === 0);
      break;
    case 'platinum':
      result = result.filter((g) => g.trophyTier === 'platinum');
      break;
  }

  // Filter by name search
  if (gameSearch.trim()) {
    const q = gameSearch.toLowerCase();
    result = result.filter((g) => g.name.toLowerCase().includes(q));
  }

  return applySort(result, gameSort);
};

export const selectFilteredSearchGames = (state: AppState): Game[] => {
  const { searchedPlayer, searchGameFilter } = state;
  const games = searchedPlayer?.games ?? [];
  switch (searchGameFilter) {
    case 'started':
      return games.filter((g) => g.unlockedCount > 0 && g.percentage < 100);
    case 'platinum':
      return games.filter((g) => g.trophyTier === 'platinum');
    default:
      return games;
  }
};

export const selectActiveGame = (state: AppState): Game | undefined =>
  state.games.find((g) => g.appId === state.activeGameAppId);

export const selectSearchActiveGame = (state: AppState): Game | undefined =>
  state.searchedPlayer?.games.find((g) => g.appId === state.searchActiveGameAppId);

export const selectGlobalStats = (state: AppState) => {
  const { games } = state;
  const totalUnlocked = games.reduce((s, g) => s + g.unlockedCount, 0);
  const totalAch = games.reduce((s, g) => s + g.totalCount, 0);
  const platCount = games.filter((g) => g.trophyTier === 'platinum').length;
  const pct = totalAch > 0 ? Math.round((totalUnlocked / totalAch) * 100) : 0;
  return { totalUnlocked, totalAch, platCount, pct };
};

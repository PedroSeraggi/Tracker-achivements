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
  FeaturedSection,
  FeaturedType,
  FeaturedAchievement,
  FeaturedCard,
  LeaderboardEntry,
  LeaderboardStatus,
} from '../types';
import type { SavedDeck, TrophyCard } from '../types/duel';

// ─── State shape ───────────────────────────────────────────────────────────────
interface AppState {
  // ── Auth
  screen: Screen;
  currentUser: SteamUser | null;

  // ── Games / Data
  games: Game[];
  loading: LoadingState;
  perfectGameIds: number[]; // platinum games showcased in profile
  profileBannerGameId: number | null; // game banner displayed on profile
  featuredSections: FeaturedSection[]; // multiple showcase sections (max 3 of each type)

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

  // ── Duel / Saved Decks
  savedDecks: SavedDeck[];
  duelView: 'duel' | 'my-decks' | 'view-deck' | 'battle';
  viewingSavedDeckId: string | null;

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

  // Featured sections actions (multiple)
  addFeaturedSection: (type: FeaturedType, title: string) => string; // returns id
  removeFeaturedSection: (id: string) => void;
  updateFeaturedSectionTitle: (id: string, title: string) => void;
  addFeaturedGameToSection: (sectionId: string, appId: number) => void;
  removeFeaturedGameFromSection: (sectionId: string, appId: number) => void;
  addFeaturedAchievementToSection: (sectionId: string, gameAppId: number, apiName: string) => void;
  removeFeaturedAchievementFromSection: (sectionId: string, gameAppId: number, apiName: string) => void;
  addFeaturedCardToSection: (sectionId: string, card: FeaturedCard) => void;
  removeFeaturedCardFromSection: (sectionId: string, gameAppId: number, apiName: string) => void;
  clearFeaturedSections: () => void;
  // Perfect games actions
  addPerfectGame: (appId: number) => void;
  removePerfectGame: (appId: number) => void;
  setPerfectGameIds: (ids: number[]) => void;
  setProfileBannerGame: (appId: number | null) => void;

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

  // Leaderboard
  leaderboard        : LeaderboardEntry[];
  leaderboardStatus  : LeaderboardStatus;
  leaderboardSearch  : string;
  leaderboardError   : string | null;
  setLeaderboard      : (entries: LeaderboardEntry[]) => void;
  setLeaderboardStatus: (s: LeaderboardStatus) => void;
  setLeaderboardSearch: (q: string) => void;
  setLeaderboardError : (e: string | null) => void;

  // Saved deck actions
  saveDeck: (name: string, cards: TrophyCard[], gameIds: number[]) => void;
  deleteDeck: (id: string) => void;
  updateDeck: (id: string, patch: Partial<SavedDeck>) => void;
  setDuelView: (view: 'duel' | 'my-decks' | 'view-deck' | 'battle') => void;
  viewSavedDeck: (id: string | null) => void;

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
        perfectGameIds: [],
        profileBannerGameId: null,
        featuredSections: [],
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
        savedDecks: [],
        duelView: 'duel',
        viewingSavedDeckId: null,
        libraryOpen: false,
        toasts: [],
        searchLoading: false,
        leaderboard: [],
        leaderboardStatus: 'idle',
        leaderboardSearch: '',
        leaderboardError: null,

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
            leaderboard: [],
            leaderboardStatus: 'idle',
            leaderboardSearch: '',
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

        // ── Featured sections (multiple)
        addFeaturedSection: (type, title) => {
          const id = `featured-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
          const section: FeaturedSection = { id, type, title, gameIds: [], achievements: [], cards: [] };
          set((s) => ({
            featuredSections: [...s.featuredSections, section].slice(0, 9), // max 9 total
          }));
          return id;
        },
        removeFeaturedSection: (id) =>
          set((s) => ({
            featuredSections: s.featuredSections.filter((sec) => sec.id !== id),
          })),
        updateFeaturedSectionTitle: (id, title) =>
          set((s) => ({
            featuredSections: s.featuredSections.map((sec) =>
              sec.id === id ? { ...sec, title } : sec
            ),
          })),
        addFeaturedGameToSection: (sectionId, appId) =>
          set((s) => ({
            featuredSections: s.featuredSections.map((sec) => {
              if (sec.id !== sectionId || sec.type !== 'games') return sec;
              const gameIds = sec.gameIds || [];
              if (gameIds.includes(appId)) return sec;
              return { ...sec, gameIds: [...gameIds, appId].slice(0, 6) };
            }),
          })),
        removeFeaturedGameFromSection: (sectionId, appId) =>
          set((s) => ({
            featuredSections: s.featuredSections.map((sec) => {
              if (sec.id !== sectionId || sec.type !== 'games') return sec;
              const gameIds = sec.gameIds || [];
              return { ...sec, gameIds: gameIds.filter((id) => id !== appId) };
            }),
          })),
        addFeaturedAchievementToSection: (sectionId, gameAppId, apiName) =>
          set((s) => ({
            featuredSections: s.featuredSections.map((sec) => {
              if (sec.id !== sectionId || sec.type !== 'achievements') return sec;
              const achievements = sec.achievements || [];
              const exists = achievements.some((a) => a.gameAppId === gameAppId && a.apiName === apiName);
              if (exists) return sec;
              const achievement: FeaturedAchievement = { gameAppId, apiName };
              return { ...sec, achievements: [...achievements, achievement].slice(0, 6) };
            }),
          })),
        removeFeaturedAchievementFromSection: (sectionId, gameAppId, apiName) =>
          set((s) => ({
            featuredSections: s.featuredSections.map((sec) => {
              if (sec.id !== sectionId || sec.type !== 'achievements') return sec;
              const achievements = sec.achievements || [];
              return { ...sec, achievements: achievements.filter((a) => !(a.gameAppId === gameAppId && a.apiName === apiName)) };
            }),
          })),
        addFeaturedCardToSection: (sectionId, card) =>
          set((s) => ({
            featuredSections: s.featuredSections.map((sec) => {
              if (sec.id !== sectionId || sec.type !== 'cards') return sec;
              const cards = sec.cards || [];
              const exists = cards.some((c) => c.gameAppId === card.gameAppId && c.apiName === card.apiName);
              if (exists) return sec;
              return { ...sec, cards: [...cards, card].slice(0, 6) };
            }),
          })),
        removeFeaturedCardFromSection: (sectionId, gameAppId, apiName) =>
          set((s) => ({
            featuredSections: s.featuredSections.map((sec) => {
              if (sec.id !== sectionId || sec.type !== 'cards') return sec;
              const cards = sec.cards || [];
              return { ...sec, cards: cards.filter((c) => !(c.gameAppId === gameAppId && c.apiName === apiName)) };
            }),
          })),
        clearFeaturedSections: () => set({ featuredSections: [] }),

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
        setProfileBannerGame: (appId) => set({ profileBannerGameId: appId }),

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

        // ── Saved Decks
        saveDeck: (name, cards, gameIds) =>
          set((s) => {
            const now = new Date().toISOString();
            const newDeck: SavedDeck = {
              id: `deck-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              name,
              cards,
              gameIds,
              createdAt: now,
              updatedAt: now,
            };
            return { savedDecks: [...s.savedDecks, newDeck] };
          }),
        deleteDeck: (id) =>
          set((s) => ({
            savedDecks: s.savedDecks.filter((d) => d.id !== id),
          })),
        updateDeck: (id, patch) =>
          set((s) => ({
            savedDecks: s.savedDecks.map((d) =>
              d.id === id ? { ...d, ...patch, updatedAt: new Date().toISOString() } : d
            ),
          })),
        setDuelView: (duelView) => set({ duelView }),
        viewSavedDeck: (viewingSavedDeckId) => set({ viewingSavedDeckId, duelView: viewingSavedDeckId ? 'view-deck' : 'my-decks' }),

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

        // ── Leaderboard
        setLeaderboard: (leaderboard) => set({ leaderboard }),
        setLeaderboardStatus: (leaderboardStatus) => set({ leaderboardStatus }),
        setLeaderboardSearch: (leaderboardSearch) => set({ leaderboardSearch }),
        setLeaderboardError: (leaderboardError) => set({ leaderboardError }),
      }),
      {
        name: 'steam-tracker-storage',
        // Only persist guides, featured/perfect games, and saved decks locally; auth/games come from server
        partialize: (s) => ({ guides: s.guides, featuredSections: s.featuredSections, perfectGameIds: s.perfectGameIds, savedDecks: s.savedDecks }),
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

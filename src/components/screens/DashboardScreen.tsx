import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import DashboardHeader from '../dashboard/DashboardHeader';
import LibraryModal from '../dashboard/LibraryModal';
import GridView from '../views/GridView';
import OverviewView from '../views/OverviewView';
import ProfileView from '../views/ProfileView';
import GuidesView from '../views/GuidesView';
import SearchView from '../views/SearchView';
import GameDetailView from '../views/GameDetailView';
import TrophyDuelView from '../views/TrophyDuelView';
import LeaderboardView from '../views/LeaderboardView';

const DashboardScreen: React.FC = () => {
  const dashView        = useAppStore((s) => s.dashView);
  const activeGameAppId = useAppStore((s) => s.activeGameAppId);

  return (
    <div id="screen-dash" className="screen">
      <DashboardHeader />

      <main className="dash-main">
        {activeGameAppId !== null ? (
          <GameDetailView />
        ) : (
          <>
            {dashView === 'grid'     && <GridView />}
            {dashView === 'overview' && <OverviewView />}
            {dashView === 'profile'  && <ProfileView />}
            {dashView === 'guides'   && <GuidesView />}
            {dashView === 'search'   && <SearchView />}
            {dashView === 'duel'     && <TrophyDuelView />}
            {dashView === 'leaderboard' && <LeaderboardView />}
          </>
        )}
      </main>

      {/* Modals — rendered outside main so they overlay everything */}
      <LibraryModal />
    </div>
  );
};

export default DashboardScreen;

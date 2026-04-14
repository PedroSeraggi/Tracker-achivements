import React from 'react';
import { useAppStore } from './store/useAppStore';
import { useInit } from './hooks';
import LoginScreen from './components/screens/LoginScreen';
import LoadingScreen from './components/screens/LoadingScreen';
import DashboardScreen from './components/screens/DashboardScreen';
import ErrorBoundary from './components/ui/ErrorBoundary';
import ToastContainer from './components/ui/ToastContainer';

const AppInner: React.FC = () => {
  useInit();
  const screen = useAppStore((s) => s.screen);

  return (
    <>
      {screen === 'login'     && <LoginScreen />}
      {screen === 'loading'   && <LoadingScreen />}
      {screen === 'dashboard' && <DashboardScreen />}
      <ToastContainer />
    </>
  );
};

const App: React.FC = () => (
  <ErrorBoundary>
    <AppInner />
  </ErrorBoundary>
);

export default App;

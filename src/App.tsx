import React, { useState } from 'react';
import { Header } from './components/Header';
import { Sidebar, TabType } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { WebsiteBlocker } from './pages/WebsiteBlocker';
import { AppBlocker } from './pages/AppBlocker';
import { Schedules } from './pages/Schedules';
import { FocusSessionPage } from './pages/FocusSession';
import { ActivityLogPage } from './pages/ActivityLog';
import { SettingsPage } from './pages/Settings';
import { useBlockerStore } from './hooks/useBlockerStore';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<TabType>('dashboard');
  const store = useBlockerStore();

  const renderTabContent = () => {
    switch (currentTab) {
      case 'dashboard':
        return (
          <Dashboard
            data={store.data}
            remainingSeconds={store.remainingSeconds}
            onStartSession={store.startSession}
            onPauseSession={store.pauseSession}
            onResumeSession={store.resumeSession}
            onStopSession={store.stopSession}
            onNavigateTab={(tab) => setCurrentTab(tab)}
          />
        );
      case 'websites':
        return (
          <WebsiteBlocker
            websites={store.data.websites}
            onAddWebsite={store.addWebsite}
            onToggleWebsite={store.toggleWebsite}
            onRemoveWebsite={store.removeWebsite}
          />
        );
      case 'apps':
        return (
          <AppBlocker
            apps={store.data.apps}
            onAddApp={store.addApp}
            onToggleApp={store.toggleApp}
            onRemoveApp={store.removeApp}
          />
        );
      case 'schedules':
        return (
          <Schedules
            schedules={store.data.schedules}
            onAddSchedule={store.addSchedule}
            onToggleSchedule={store.toggleSchedule}
            onRemoveSchedule={store.removeSchedule}
          />
        );
      case 'session':
        return (
          <FocusSessionPage
            activeSession={store.data.activeSession}
            remainingSeconds={store.remainingSeconds}
            onStartSession={store.startSession}
            onStopSession={() => store.stopSession(false)}
            onNavigateTab={(tab) => setCurrentTab(tab)}
          />
        );
      case 'activity':
        return (
          <ActivityLogPage
            logs={store.data.activityLogs}
            onClearLogs={async () => {
              if (window.focusGuardApi) {
                await window.focusGuardApi.clearLogs();
                store.refreshConfig();
              }
            }}
          />
        );
      case 'settings':
        return (
          <SettingsPage
            settings={store.data.settings}
            onUpdateSettings={store.updateSettings}
            onRefreshConfig={store.refreshConfig}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 select-none">
      {/* Titlebar */}
      <Header
        activeSession={store.data.activeSession}
        remainingSeconds={store.remainingSeconds}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onTabChange={setCurrentTab}
          websitesCount={store.data.websites.filter((w) => w.enabled).length}
          appsCount={store.data.apps.filter((a) => a.enabled).length}
          schedulesCount={store.data.schedules.filter((s) => s.enabled).length}
          activeSession={store.data.activeSession}
        />

        {/* Tab Page Container */}
        <main className="flex-1 overflow-hidden relative bg-[#070b14]">
          {renderTabContent()}

          {/* Toast Notification Banner */}
          {store.toastMessage && (
            <div className="absolute bottom-5 right-5 z-50 pointer-events-none">
              <div className="px-4 py-2.5 rounded-xl bg-slate-900/95 border border-sky-500/40 text-sky-200 text-xs font-medium shadow-2xl backdrop-blur-md animate-fade-in flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-sky-400"></span>
                <span>{store.toastMessage}</span>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;

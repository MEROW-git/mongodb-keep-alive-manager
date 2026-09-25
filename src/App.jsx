import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Logs from './pages/Logs';
import Settings from './pages/Settings';
import Login from './pages/Login';
import api, { getToken, clearAuthSession } from './services/api';

export default function App() {
  const [token, setToken] = useState(getToken());
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [dashboardData, setDashboardData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPinging, setIsPinging] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [notification, setNotification] = useState(null);

  // Show temporary toast notification
  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Fetch dashboard statistics
  const loadDashboard = useCallback(async (quiet = false) => {
    if (!getToken()) return;
    if (!quiet) setIsLoading(true);
    try {
      const data = await api.getDashboard();
      setDashboardData(data);
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
    } finally {
      if (!quiet) setIsLoading(false);
    }
  }, []);

  // Check authentication session on mount
  useEffect(() => {
    if (token) {
      api.verifySession()
        .then(() => loadDashboard())
        .catch(() => {
          clearAuthSession();
          setToken(null);
        });
    }
  }, [token, loadDashboard]);

  // Periodic polling for dashboard updates
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => {
      loadDashboard(true);
    }, 15000); // Poll stats every 15 seconds
    return () => clearInterval(interval);
  }, [token, loadDashboard]);

  // Keep-alive automation runner while browser is open (in addition to Netlify scheduled functions)
  useEffect(() => {
    if (!token || !dashboardData?.automation?.enabled) return;
    const intervalMinutes = dashboardData.automation.interval || 5;
    const intervalMs = intervalMinutes * 60 * 1000;

    const autoPingTimer = setInterval(async () => {
      try {
        console.log('Automated Keep-Alive Ping executing...');
        await api.triggerPing();
        loadDashboard(true);
      } catch (e) {
        console.warn('Auto ping execution error:', e);
      }
    }, intervalMs);

    return () => clearInterval(autoPingTimer);
  }, [token, dashboardData?.automation?.enabled, dashboardData?.automation?.interval, loadDashboard]);

  // Manual Trigger Ping
  const handleTriggerPing = async () => {
    setIsPinging(true);
    try {
      const res = await api.triggerPing();
      showNotification(`Ping completed in ${res.responseTime}! Database is active.`, 'success');
      await loadDashboard(true);
    } catch (err) {
      showNotification(err.message || 'Ping failed.', 'error');
    } finally {
      setIsPinging(false);
    }
  };

  // Toggle Keep Alive Bot
  const handleToggleAutomation = async (newEnabledState) => {
    try {
      await api.updateSettings({ enabled: newEnabledState });
      showNotification(
        newEnabledState ? 'Keep Alive Bot ENABLED' : 'Keep Alive Bot DISABLED',
        'success'
      );
      await loadDashboard(true);
    } catch (err) {
      showNotification('Failed to toggle automation: ' + err.message, 'error');
    }
  };

  const handleTabChange = (newTab) => {
    setCurrentTab(newTab);
    if (newTab === 'dashboard') {
      loadDashboard(true);
    }
  };

  const handleSettingsUpdated = () => {
    loadDashboard(true);
  };

  if (!token) {
    return (
      <Login
        onLoginSuccess={() => {
          setToken(getToken());
          loadDashboard();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1120] text-white flex flex-col font-sans">
      
      {/* Top Navbar */}
      <Navbar
        onPingTriggered={handleTriggerPing}
        isPinging={isPinging}
        dbStatus={dashboardData?.databaseStatus || 'ONLINE'}
        onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        isMobileMenuOpen={isMobileMenuOpen}
      />

      {/* Toast Notification Banner */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50">
          <div
            className={`px-4 py-3 rounded-xl border shadow-2xl flex items-center space-x-2 text-xs font-semibold backdrop-blur-lg ${
              notification.type === 'success'
                ? 'bg-cardBg/95 border-mongo/40 text-mongo shadow-[0_0_20px_rgba(0,237,100,0.2)]'
                : 'bg-cardBg/95 border-red-500/40 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.2)]'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
            <span>{notification.message}</span>
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        {/* Sidebar */}
        <Sidebar
          currentTab={currentTab}
          setTab={handleTabChange}
          isMobileOpen={isMobileMenuOpen}
          closeMobile={() => setIsMobileMenuOpen(false)}
          dbInfo={dashboardData?.database}
        />

        {/* Page Content Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {currentTab === 'dashboard' && (
            <Dashboard
              dashboardData={dashboardData}
              isLoading={isLoading}
              onRefresh={() => loadDashboard()}
              onTriggerPing={handleTriggerPing}
              isPinging={isPinging}
              onToggleAutomation={handleToggleAutomation}
            />
          )}

          {currentTab === 'logs' && <Logs />}

          {currentTab === 'settings' && (
            <Settings onSettingsUpdated={handleSettingsUpdated} />
          )}
        </main>
      </div>

    </div>
  );
}

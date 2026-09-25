import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, AlertCircle, X, Zap } from 'lucide-react';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Logs from './pages/Logs';
import Settings from './pages/Settings';
import TelegramBot from './pages/TelegramBot';
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
  const showNotification = (payload, type = 'success') => {
    if (typeof payload === 'string') {
      setNotification({ title: 'Notification', message: payload, type });
    } else {
      setNotification({ ...payload, type: payload.type || type });
    }
    setTimeout(() => setNotification(null), 5000);
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

  // Trigger Ping (both automated from countdown & manual button)
  const handleTriggerPing = async () => {
    setIsPinging(true);
    try {
      const res = await api.triggerPing();
      showNotification({
        title: 'Ping Successful',
        message: `Atlas Keep-Alive executed (${res.responseTime}) • Database active`,
        type: 'success',
      });
      await loadDashboard(true);
    } catch (err) {
      showNotification({
        title: 'Ping Failed',
        message: err.message || 'Database connection error.',
        type: 'error',
      });
    } finally {
      setIsPinging(false);
    }
  };

  // Toggle Keep Alive Bot
  const handleToggleAutomation = async (newEnabledState) => {
    try {
      await api.updateSettings({ enabled: newEnabledState });
      showNotification({
        title: 'Automation Updated',
        message: newEnabledState ? 'Keep Alive Bot is now ENABLED' : 'Keep Alive Bot is now DISABLED',
        type: 'success',
      });
      await loadDashboard(true);
    } catch (err) {
      showNotification({
        title: 'Settings Error',
        message: 'Failed to toggle automation: ' + err.message,
        type: 'error',
      });
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

      {/* Eye-Level Top-Right Toast Notification Banner */}
      {notification && (
        <div className="fixed top-20 right-4 sm:right-8 z-50 max-w-sm w-full transition-all duration-300">
          <div
            className={`p-4 rounded-2xl border shadow-2xl backdrop-blur-2xl flex items-start space-x-3.5 ${
              notification.type === 'success'
                ? 'bg-[#111827]/95 border-mongo/60 text-white shadow-[0_0_30px_rgba(0,237,100,0.25)]'
                : 'bg-[#111827]/95 border-red-500/60 text-white shadow-[0_0_30px_rgba(239,68,68,0.25)]'
            }`}
          >
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                notification.type === 'success'
                  ? 'bg-mongo/15 text-mongo border border-mongo/30'
                  : 'bg-red-500/15 text-red-400 border border-red-500/30'
              }`}
            >
              {notification.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-mongo" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-400" />
              )}
            </div>

            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-mongo font-mono">
                  {notification.title || 'Notification'}
                </h4>
                <button
                  onClick={() => setNotification(null)}
                  className="text-gray-400 hover:text-white transition p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-xs text-gray-200 mt-1 font-medium leading-relaxed">
                {notification.message}
              </p>
            </div>
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

          {currentTab === 'telegram' && <TelegramBot />}
        </main>
      </div>

    </div>
  );
}

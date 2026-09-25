import React, { useState, useEffect, useRef } from 'react';
import {
  Server,
  Activity,
  Clock,
  Zap,
  CheckCircle2,
  Database,
  Layers,
  Power,
  Timer,
  Calendar,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import StatusCard from '../components/StatusCard';
import Chart from '../components/Chart';
import api from '../services/api';

export default function Dashboard({
  dashboardData,
  isLoading,
  onRefresh,
  onTriggerPing,
  isPinging,
  onToggleAutomation,
}) {
  const stats = dashboardData?.stats || {};
  const dbInfo = dashboardData?.database || {};
  const automation = dashboardData?.automation || {};
  const recentActivity = dashboardData?.recentActivity || [];
  const charts = dashboardData?.charts || {};

  const isOnline = dashboardData?.databaseStatus === 'ONLINE';

  // 60fps Ultra-smooth countdown timer via requestAnimationFrame & direct DOM ref
  const progressBarRef = useRef(null);
  const isAutoPingingRef = useRef(false);
  const [countdownText, setCountdownText] = useState('--:--');

  useEffect(() => {
    if (!automation.enabled) {
      setCountdownText('PAUSED');
      if (progressBarRef.current) {
        progressBarRef.current.style.width = '0%';
      }
      return;
    }

    const intervalMinutes = automation.interval || 5;
    const intervalTotalMs = intervalMinutes * 60 * 1000;
    let animId;
    let lastLoggedSec = -1;

    const renderFrame = () => {
      if (!stats.lastPingFull) {
        setCountdownText('00:00');
        if (progressBarRef.current) progressBarRef.current.style.width = '0%';
        return;
      }

      const lastPingTime = new Date(stats.lastPingFull).getTime();
      const nextPingTime = lastPingTime + intervalTotalMs;
      const now = Date.now();
      const diffMs = nextPingTime - now;

      if (diffMs <= 0) {
        setCountdownText('Pinging...');
        if (progressBarRef.current) progressBarRef.current.style.width = '0%';

        // Auto-trigger keep-alive ping when countdown reaches 00:00!
        if (!isAutoPingingRef.current && onTriggerPing && !isPinging) {
          isAutoPingingRef.current = true;
          onTriggerPing().finally(() => {
            setTimeout(() => {
              isAutoPingingRef.current = false;
            }, 2000);
          });
        }
      } else {
        isAutoPingingRef.current = false;
        const remainingSec = Math.floor(diffMs / 1000);
        if (remainingSec !== lastLoggedSec) {
          lastLoggedSec = remainingSec;
          const mins = Math.floor(remainingSec / 60);
          const secs = remainingSec % 60;
          setCountdownText(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
        }

        // Direct GPU style update at 60Hz/120Hz/144Hz for butter-smooth progress
        const ratio = Math.min(1, Math.max(0, diffMs / intervalTotalMs));
        if (progressBarRef.current) {
          progressBarRef.current.style.width = `${(ratio * 100).toFixed(2)}%`;
        }
      }

      animId = requestAnimationFrame(renderFrame);
    };

    animId = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(animId);
  }, [stats.lastPingFull, automation.enabled, automation.interval, onTriggerPing, isPinging]);

  return (
    <div className="space-y-6">
      
      {/* Top Banner: Atlas Cluster & Overview */}
      <div className="glass-panel rounded-2xl p-6 bg-gradient-to-r from-cardBg via-cardBg to-gray-900/60 border border-gray-800/90 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-full bg-mongo/5 blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <span className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                MongoDB Keep Alive Manager
              </span>
              <span
                className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  isOnline
                    ? 'bg-mongo/10 text-mongo border border-mongo/30'
                    : 'bg-red-500/10 text-red-400 border border-red-500/30'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-mongo animate-ping' : 'bg-red-500'}`} />
                <span>{isOnline ? 'ONLINE' : 'OFFLINE'}</span>
              </span>
            </div>
            <p className="text-xs sm:text-sm text-gray-400">
              Automated high-frequency keep-alive pings ensuring your MongoDB Atlas cluster never goes idle.
            </p>
          </div>

          {/* Quick cluster details header pill */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            <div className="px-3 py-1.5 rounded-xl bg-gray-900/90 border border-gray-800 text-gray-300">
              <span className="text-gray-500 mr-1.5">Cluster:</span>
              <span className="text-white font-semibold">Production Database</span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-gray-900/90 border border-gray-800 text-gray-300">
              <span className="text-gray-500 mr-1.5">DB:</span>
              <span className="text-mongo font-semibold">{dbInfo.name || 'system_reset'}</span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-gray-900/90 border border-gray-800 text-gray-300">
              <span className="text-gray-500 mr-1.5">Collection:</span>
              <span className="text-white font-semibold">{dbInfo.collection || 'sysreset'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Main Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <StatusCard
          title="Database Status"
          value={stats.databaseStatus || 'ONLINE'}
          subtitle={isOnline ? 'MongoDB Atlas operational' : 'Connection unreachable'}
          icon={Server}
          color={isOnline ? 'mongo' : 'blue'}
          pulse={isOnline}
        />
        <StatusCard
          title="Last Ping"
          value={stats.lastPing || '--:--:--'}
          subtitle="Keep-alive verified"
          icon={Clock}
          color="blue"
          badge="Live"
        />
        <StatusCard
          title="Response Time"
          value={stats.responseTime || '0 ms'}
          subtitle="Latency (ping: 1)"
          icon={Activity}
          color="purple"
        />
        <StatusCard
          title="Total Successful Ping"
          value={(stats.totalSuccessfulPing || 0).toLocaleString()}
          subtitle="Verified ping cycles"
          icon={CheckCircle2}
          color="mongo"
        />
      </div>

      {/* Two Column Layout: Automation & DB Info on Left, Recent Activity on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Automation Status Panel */}
        <div className="glass-panel rounded-2xl p-5 bg-cardBg/90 border border-gray-800/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Power className="w-4 h-4 text-mongo" />
                <h3 className="text-sm font-semibold text-white">Automation Status</h3>
              </div>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700">
                Daemonless
              </span>
            </div>

            <div className="space-y-4">
              {/* Bot Switch */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-gray-900/80 border border-gray-800">
                <div>
                  <div className="text-sm font-medium text-white">Keep Alive Bot</div>
                  <div className="text-xs text-gray-400">Scheduled serverless execution</div>
                </div>
                <button
                  id="toggle-automation-btn"
                  onClick={() => onToggleAutomation(!automation.enabled)}
                  className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ease-in-out ${
                    automation.enabled ? 'bg-mongo' : 'bg-gray-700'
                  }`}
                >
                  <div
                    className={`bg-black w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                      automation.enabled ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Intervals & Live Real-Time Countdown */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-gray-900/60 border border-gray-800/80 flex flex-col justify-between">
                  <div>
                    <div className="text-[11px] text-gray-500 uppercase font-mono flex items-center justify-between">
                      <span>Interval</span>
                      <Timer className="w-3 h-3 text-gray-500" />
                    </div>
                    <div className="text-base font-bold text-white font-mono mt-0.5">
                      {automation.interval || 5} min
                    </div>
                  </div>
                  <div className="text-[10px] text-gray-400 font-mono mt-2">
                    At {automation.nextScheduledPing || '--:--'}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-gray-900/70 border border-mongo/30 shadow-[0_0_20px_rgba(0,237,100,0.12)] relative overflow-hidden flex flex-col justify-between">
                  {/* Subtle ambient lighting */}
                  <div className="absolute -right-6 -bottom-6 w-20 h-20 bg-mongo/10 rounded-full blur-xl pointer-events-none" />

                  <div>
                    <div className="text-[11px] uppercase font-mono flex items-center justify-between">
                      <span className="text-mongo font-semibold tracking-wider">Countdown</span>
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-mongo opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-mongo"></span>
                      </span>
                    </div>

                    <div className="text-xl font-black text-mongo font-mono tabular-nums tracking-wider mt-0.5">
                      {countdownText}
                    </div>
                  </div>

                  {/* 60fps Ultra-smooth Progress Track */}
                  <div className="w-full bg-gray-800/90 h-2 rounded-full mt-2.5 overflow-hidden p-0.5 border border-gray-700/50">
                    <div
                      ref={progressBarRef}
                      className="bg-gradient-to-r from-emerald-500 via-mongo to-teal-300 h-full rounded-full shadow-[0_0_10px_#00ED64]"
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-800/80 flex items-center justify-between text-xs text-gray-400">
            <span>Next trigger</span>
            <span className="font-mono text-gray-300">Netlify Cron / Webhook</span>
          </div>
        </div>

        {/* Database Information Panel */}
        <div className="glass-panel rounded-2xl p-5 bg-cardBg/90 border border-gray-800/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <Database className="w-4 h-4 text-mongo" />
              <h3 className="text-sm font-semibold text-white">Database Information</h3>
            </div>

            <div className="space-y-2.5 font-mono text-xs">
              <div className="p-2.5 rounded-xl bg-gray-900/80 border border-gray-800 flex justify-between items-center gap-2">
                <span className="text-gray-400 font-sans">Database</span>
                <span className="font-bold text-white truncate">{dbInfo.name || 'system_reset'}</span>
              </div>

              <div className="p-2.5 rounded-xl bg-gray-900/80 border border-gray-800 flex justify-between items-center gap-2">
                <span className="text-gray-400 font-sans">Target Collection</span>
                <span className="font-bold text-mongo truncate">{dbInfo.collection || 'sysreset'}</span>
              </div>

              <div className="p-2.5 rounded-xl bg-gray-900/80 border border-gray-800 flex justify-between items-center gap-2">
                <span className="text-gray-400 font-sans">Connection</span>
                <span className="inline-flex items-center space-x-1.5 text-mongo font-bold shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-mongo" />
                  <span>{dbInfo.connection || 'Connected'}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-800/80 flex items-center justify-between text-xs text-gray-400">
            <span>Driver Pool</span>
            <span className="font-mono text-gray-300">10 Pooled Connections</span>
          </div>
        </div>

        {/* Recent Activity Panel */}
        <div className="glass-panel rounded-2xl p-5 bg-cardBg/90 border border-gray-800/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Activity className="w-4 h-4 text-mongo" />
                <h3 className="text-sm font-semibold text-white">Recent Activity</h3>
              </div>
              <button
                onClick={onRefresh}
                className="text-gray-400 hover:text-white transition p-1 rounded-lg hover:bg-gray-800"
                title="Refresh activity"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-mongo' : ''}`} />
              </button>
            </div>

            {/* Scrollable Feed with no horizontal overflow */}
            <div className="space-y-2 max-h-[17rem] overflow-y-auto overflow-x-hidden pr-1">
              {recentActivity.length === 0 ? (
                <div className="text-xs text-gray-500 py-6 text-center font-mono">
                  No activity logs yet.
                </div>
              ) : (
                recentActivity.map((activity) => {
                  const isSuccess = activity.status === 'SUCCESS';
                  return (
                    <div
                      key={activity.id}
                      className="p-2.5 rounded-xl bg-gray-900/70 border border-gray-800/80 flex items-center justify-between hover:border-gray-700 transition gap-2.5"
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            isSuccess ? 'bg-mongo shadow-[0_0_8px_#00ED64]' : 'bg-red-500 shadow-[0_0_8px_#EF4444]'
                          }`}
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-white truncate" title={activity.message}>
                            {activity.message}
                          </div>
                          <div className="flex items-center space-x-2 text-[10px] font-mono text-gray-400 mt-0.5">
                            <span>{activity.time}</span>
                            <span>•</span>
                            <span className={isSuccess ? 'text-mongo font-semibold' : 'text-red-400 font-semibold'}>
                              {activity.status}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <span className="font-mono text-[11px] font-medium text-gray-200 bg-gray-800/90 px-2 py-0.5 rounded-lg border border-gray-700/70 whitespace-nowrap">
                          {activity.responseTime}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-800/80 flex items-center justify-between text-xs text-gray-400">
            <span>Ping command</span>
            <span className="font-mono text-mongo text-[11px]">{'{ ping: 1 }'}</span>
          </div>
        </div>

      </div>

      {/* Recharts Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Chart
            type="latency"
            data={charts.latencyHistory || []}
            title="Ping Response Time History"
            subtitle="Real-time latency progression in milliseconds (ms)"
          />
        </div>
        <div>
          <Chart
            type="distribution"
            data={charts.statusDistribution || []}
            title="Successful vs Failed Ping"
          />
        </div>
      </div>

      {/* Daily Activity Chart */}
      <div>
        <Chart
          type="daily"
          data={charts.dailyActivity || []}
          title="Daily Keep Alive Activity"
          subtitle="Ping volume distribution across the past 7 days"
        />
      </div>

    </div>
  );
}

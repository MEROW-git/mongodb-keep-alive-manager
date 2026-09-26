import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Cpu,
  Radio,
  ExternalLink,
} from 'lucide-react';
import StatusCard from '../components/StatusCard';
import Chart from '../components/Chart';

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

  // State for filtering connections in the database fleet explorer
  const [engineFilter, setEngineFilter] = useState('ALL');

  // Extract all configured database instances
  const allDatabasesList = useMemo(() => {
    if (Array.isArray(dbInfo.allDatabases) && dbInfo.allDatabases.length > 0) {
      return dbInfo.allDatabases;
    }
    const list = [
      { type: 'MongoDB', label: 'MongoDB', name: dbInfo.name || 'system_reset', badge: 'Atlas', isPrimary: true, status: 'ONLINE' },
      dbInfo.postgres?.configured && { type: 'PostgreSQL', label: 'PostgreSQL', name: dbInfo.postgres.name, badge: 'Aiven', status: 'ONLINE' },
      dbInfo.mysql?.configured && { type: 'MySQL', label: 'MySQL', name: dbInfo.mysql.name, badge: 'Aiven', status: 'ONLINE' },
    ].filter(Boolean);
    return list;
  }, [dbInfo]);

  const mongoCount = useMemo(() => allDatabasesList.filter((d) => d.type === 'MongoDB').length, [allDatabasesList]);
  const pgCount = useMemo(() => allDatabasesList.filter((d) => d.type === 'PostgreSQL').length, [allDatabasesList]);
  const mysqlCount = useMemo(() => allDatabasesList.filter((d) => d.type === 'MySQL').length, [allDatabasesList]);

  // Filtered databases for display
  const displayedDatabases = useMemo(() => {
    if (engineFilter === 'ALL') return allDatabasesList;
    return allDatabasesList.filter((d) => d.type === engineFilter);
  }, [allDatabasesList, engineFilter]);

  const isMultiDb = allDatabasesList.length > 1;

  const progressBarRef = useRef(null);
  const isAutoPingingRef = useRef(false);
  const [countdownText, setCountdownText] = useState('--:--');

  // Format 12-hour time with AM/PM
  const formatTime12h = (dateInput, fallback = '--:--:--') => {
    if (!dateInput) return fallback;
    try {
      const d = new Date(dateInput);
      if (isNaN(d.getTime())) return fallback;
      return d.toLocaleTimeString('en-US', {
        hour12: true,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return fallback;
    }
  };

  const nextScheduledDisplay = useMemo(() => {
    if (!automation.enabled) return 'Paused';
    if (!stats.lastPingFull) return automation.nextScheduledPing || '--:--';
    try {
      const intervalMs = (automation.interval || 5) * 60 * 1000;
      const nextTime = new Date(new Date(stats.lastPingFull).getTime() + intervalMs);
      return nextTime.toLocaleTimeString('en-US', {
        hour12: true,
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return automation.nextScheduledPing || '--:--';
    }
  }, [stats.lastPingFull, automation.enabled, automation.interval, automation.nextScheduledPing]);

  // Real-time butter-smooth progress countdown
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
        setCountdownText('Syncing...');
        if (progressBarRef.current) progressBarRef.current.style.width = '0%';

        if (!isAutoPingingRef.current) {
          isAutoPingingRef.current = true;
          if (diffMs < -15000 && onTriggerPing && !isPinging) {
            onTriggerPing().finally(() => {
              setTimeout(() => { isAutoPingingRef.current = false; }, 4000);
            });
          } else if (onRefresh) {
            onRefresh().finally(() => {
              setTimeout(() => { isAutoPingingRef.current = false; }, 4000);
            });
          }
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

      {/* Top Banner: Fleet Overview & Quick Action */}
      <div className="glass-panel rounded-2xl p-6 bg-gradient-to-r from-cardBg via-cardBg to-gray-900/70 border border-gray-800/90 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-full bg-mongo/5 blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          {/* Left Title & Status */}
          <div className="max-w-xl">
            <div className="flex flex-wrap items-center gap-2.5 mb-2">
              <span className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                {isMultiDb ? 'Multi-DB Keep Alive Manager' : 'MongoDB Keep Alive Manager'}
              </span>
              <span
                className={`inline-flex items-center space-x-1.5 px-3 py-0.5 rounded-full text-xs font-semibold ${
                  isOnline
                    ? 'bg-mongo/10 text-mongo border border-mongo/30'
                    : 'bg-red-500/10 text-red-400 border border-red-500/30'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-mongo animate-ping' : 'bg-red-500'}`} />
                <span>{isOnline ? `${allDatabasesList.length} Connected · Online` : 'OFFLINE'}</span>
              </span>
            </div>
            <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
              Autonomous high-frequency keep-alive monitoring actively maintaining cloud database connections across MongoDB Atlas, PostgreSQL, and MySQL to prevent inactivity hibernation.
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-xs font-mono text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-mongo/70" />
                <span>Primary Cluster: <span className="text-gray-300 font-sans font-medium">Production Database</span></span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400/70" />
                <span>Collection: <span className="text-gray-300 font-sans font-medium">{dbInfo.collection || 'sysreset'}</span></span>
              </span>
            </div>
          </div>

          {/* Right: Fleet Health & Quick Multi-Ping Action */}
          <div className="bg-gray-950/80 border border-gray-800/90 rounded-2xl p-4 sm:p-5 backdrop-blur-md shadow-xl shadow-black/30 flex flex-col justify-between gap-3.5 min-w-[280px] lg:min-w-[340px]">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-300">
                <Database className="w-4 h-4 text-mongo" />
                Fleet Health
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                All Engines Responding
              </span>
            </div>

            {/* Engine Breakdown Chips */}
            <div className="flex flex-wrap items-center gap-2">
              {mongoCount > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-gray-900/90 border border-mongo/30 text-xs font-mono text-mongo font-medium shadow-[0_0_10px_rgba(0,237,100,0.08)]">
                  <span className="w-2 h-2 rounded-full bg-mongo" />
                  <span>MongoDB ({mongoCount})</span>
                </div>
              )}
              {pgCount > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-gray-900/90 border border-sky-500/30 text-xs font-mono text-sky-400 font-medium shadow-[0_0_10px_rgba(56,189,248,0.08)]">
                  <span className="w-2 h-2 rounded-full bg-sky-400" />
                  <span>PostgreSQL ({pgCount})</span>
                </div>
              )}
              {mysqlCount > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-gray-900/90 border border-amber-400/30 text-xs font-mono text-amber-400 font-medium shadow-[0_0_10px_rgba(251,191,36,0.08)]">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span>MySQL ({mysqlCount})</span>
                </div>
              )}
            </div>

            {/* Quick Ping Trigger Button */}
            <button
              id="header-trigger-ping-btn"
              onClick={onTriggerPing}
              disabled={isPinging}
              className="w-full mt-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-black bg-gradient-to-r from-emerald-400 via-mongo to-teal-300 hover:opacity-95 active:scale-[0.99] transition shadow-[0_0_15px_rgba(0,237,100,0.25)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isPinging ? 'animate-spin' : ''}`} />
              <span>{isPinging ? 'Pinging All Databases...' : '⚡ Ping All Databases Now'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 Main Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <StatusCard
          title="Database Status"
          value={stats.databaseStatus || 'ONLINE'}
          subtitle={
            isOnline
              ? `${allDatabasesList.length} of ${allDatabasesList.length} Connected`
              : 'Connection unreachable'
          }
          icon={Server}
          color={isOnline ? 'mongo' : 'blue'}
          pulse={isOnline}
        />
        <StatusCard
          title="Last Ping"
          value={formatTime12h(stats.lastPingFull, stats.lastPing)}
          subtitle="Keep-alive verified"
          icon={Clock}
          color="blue"
          badge="Live"
        />
        <StatusCard
          title="Response Time"
          value={stats.responseTime || '0 ms'}
          subtitle="Latest cycle latency"
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

      {/* SECTION: Connected Database Fleet (Full-width, scalable 1..15 grid) */}
      <div className="space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
          <div>
            <div className="flex items-center space-x-2">
              <Database className="w-5 h-5 text-mongo" />
              <h2 className="text-base font-bold text-white tracking-tight">
                Active Database Connections
              </h2>
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-gray-800 text-gray-300 border border-gray-700">
                {allDatabasesList.length} Active / 15 Max Slots
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Individual connection health, latency, and query status for each configured cluster.
            </p>
          </div>

          {/* Filter Pills (All / Mongo / Postgres / MySQL) */}
          {allDatabasesList.length > 2 && (
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-gray-900/90 border border-gray-800 self-start sm:self-auto">
              <button
                onClick={() => setEngineFilter('ALL')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                  engineFilter === 'ALL'
                    ? 'bg-gray-800 text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                All ({allDatabasesList.length})
              </button>
              {mongoCount > 0 && (
                <button
                  onClick={() => setEngineFilter('MongoDB')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                    engineFilter === 'MongoDB'
                      ? 'bg-mongo/20 text-mongo border border-mongo/30'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  MongoDB ({mongoCount})
                </button>
              )}
              {pgCount > 0 && (
                <button
                  onClick={() => setEngineFilter('PostgreSQL')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                    engineFilter === 'PostgreSQL'
                      ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  PostgreSQL ({pgCount})
                </button>
              )}
              {mysqlCount > 0 && (
                <button
                  onClick={() => setEngineFilter('MySQL')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                    engineFilter === 'MySQL'
                      ? 'bg-amber-400/20 text-amber-400 border border-amber-400/30'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  MySQL ({mysqlCount})
                </button>
              )}
            </div>
          )}
        </div>

        {/* Scalable Grid of Databases: 1 to 15 connections with ZERO squishing */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedDatabases.map((db, idx) => {
            const isMongo = db.type === 'MongoDB';
            const isPg = db.type === 'PostgreSQL';
            const isMy = db.type === 'MySQL';

            const cardBorder = isMongo
              ? 'hover:border-mongo/50'
              : isPg
              ? 'hover:border-sky-500/50'
              : 'hover:border-amber-400/50';

            const iconBg = isMongo
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : isPg
              ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
              : 'bg-amber-500/10 text-amber-400 border-amber-500/20';

            const nameColor = isMongo
              ? 'text-mongo'
              : isPg
              ? 'text-sky-400'
              : 'text-amber-400';

            const pulseColor = isMongo
              ? 'bg-mongo shadow-[0_0_8px_rgba(0,237,100,0.6)]'
              : isPg
              ? 'bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.6)]'
              : 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]';

            return (
              <div
                key={db.index ? `${db.type}_${db.index}` : idx}
                className={`glass-panel rounded-2xl p-4 sm:p-5 bg-cardBg/90 border border-gray-800/80 transition-all duration-200 flex flex-col justify-between gap-4 shadow-lg shadow-black/20 ${cardBorder}`}
              >
                {/* Header: Icon, Label & Status Badge */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${iconBg}`}>
                      {isMongo ? (
                        <Database className="w-5 h-5 text-mongo" />
                      ) : isPg ? (
                        <Server className="w-5 h-5 text-sky-400" />
                      ) : (
                        <Zap className="w-5 h-5 text-amber-400" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">
                          {db.label}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-gray-800/90 text-gray-400 border border-gray-700/60">
                          {db.badge || (isMongo ? 'Atlas' : 'Aiven')}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-400 font-sans mt-0.5">
                        {isMongo
                          ? (db.isPrimary ? 'Primary Storage & Auth' : 'Secondary Keep-Alive')
                          : isPg
                          ? 'PostgreSQL Engine'
                          : 'MySQL Engine'}
                      </div>
                    </div>
                  </div>

                  {/* Online Badge */}
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                    <span className={`w-2 h-2 rounded-full ${pulseColor}`} />
                    ONLINE
                  </span>
                </div>

                {/* Target Database Details */}
                <div className="p-3 rounded-xl bg-gray-900/80 border border-gray-800/90 space-y-1.5">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-gray-500">
                    Target Database
                  </div>
                  <div className={`font-mono font-bold text-sm tracking-wide break-all ${nameColor}`}>
                    {db.name || 'system_reset'}
                  </div>
                </div>

                {/* Footer Metrics: Latency & Target Protocol */}
                <div className="pt-2 border-t border-gray-800/80 flex items-center justify-between text-xs text-gray-400">
                  <span className="flex items-center gap-1.5 font-mono">
                    <span className="text-gray-500">Latency:</span>
                    <span className="font-semibold text-gray-200 bg-gray-800 px-2 py-0.5 rounded border border-gray-700">
                      {db.responseTime || 'Active'}
                    </span>
                  </span>

                  <span className="flex items-center gap-1 text-[11px] text-gray-400 font-mono">
                    {isMongo ? (
                      <span>Coll: <span className="text-gray-300 font-semibold">{dbInfo.collection || 'sysreset'}</span></span>
                    ) : (
                      <span>Query: <span className="text-gray-300 font-semibold">SELECT 1</span></span>
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Two Column Layout: Automation Panel on Left, Recent Activity on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Automation Status Panel (5 cols) */}
        <div className="lg:col-span-5 glass-panel rounded-2xl p-5 sm:p-6 bg-cardBg/90 border border-gray-800/80 flex flex-col justify-between">
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
                <div className="p-3.5 rounded-xl bg-gray-900/60 border border-gray-800/80 flex flex-col justify-between">
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
                    At {nextScheduledDisplay}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-gray-900/70 border border-mongo/30 shadow-[0_0_20px_rgba(0,237,100,0.12)] relative overflow-hidden flex flex-col justify-between">
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

        {/* Recent Activity Panel (7 cols - spacious, no cramped wrapping) */}
        <div className="lg:col-span-7 glass-panel rounded-2xl p-5 sm:p-6 bg-cardBg/90 border border-gray-800/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <div className="flex items-center space-x-2">
                <Activity className="w-4 h-4 text-mongo" />
                <h3 className="text-sm font-semibold text-white">Recent Keep-Alive Activity</h3>
              </div>
              <button
                onClick={onRefresh}
                className="text-gray-400 hover:text-white transition p-1.5 rounded-lg hover:bg-gray-800"
                title="Refresh activity"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-mongo' : ''}`} />
              </button>
            </div>

            {/* Scrollable Feed */}
            <div className="space-y-2 max-h-[17.5rem] overflow-y-auto overflow-x-hidden pr-1">
              {recentActivity.length === 0 ? (
                <div className="text-xs text-gray-500 py-8 text-center font-mono">
                  No activity logs recorded yet.
                </div>
              ) : (
                recentActivity.map((activity) => {
                  const isSuccess = activity.status === 'SUCCESS';
                  return (
                    <div
                      key={activity.id}
                      className="p-3 rounded-xl bg-gray-900/70 border border-gray-800/80 flex items-center justify-between hover:border-gray-700 transition gap-3"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
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
                            <span>
                              {activity.fullTimestamp
                                ? new Date(activity.fullTimestamp).toLocaleTimeString('en-US', {
                                    hour12: true,
                                    hour: 'numeric',
                                    minute: '2-digit',
                                    second: '2-digit',
                                  })
                                : activity.time}
                            </span>
                            <span>•</span>
                            <span className={isSuccess ? 'text-mongo font-semibold' : 'text-red-400 font-semibold'}>
                              {activity.status}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <span className="font-mono text-xs font-medium text-gray-200 bg-gray-800/90 px-2.5 py-1 rounded-lg border border-gray-700/70 whitespace-nowrap">
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
            <span className="font-mono text-mongo text-xs font-semibold">Multi-DB Concurrent Ping</span>
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

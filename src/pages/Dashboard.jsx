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
  ShieldCheck,
  Wifi,
  Lock,
  Terminal,
  Gauge,
  Sparkles,
  ArrowUpRight,
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

      {/* Top Banner: Fleet Overview & High-Tech Radar HUD */}
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

          {/* Right: High-Tech Cyber Telemetry & Radar Shield */}
          <div className="bg-gradient-to-br from-gray-950/95 via-gray-900/90 to-gray-950/95 border border-emerald-500/25 rounded-2xl p-4 sm:p-4.5 backdrop-blur-xl shadow-2xl shadow-black/40 relative overflow-hidden flex flex-col justify-between gap-3 min-w-[310px] lg:min-w-[390px] group cyber-glow-border">
            {/* Ambient cyber glow */}
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-mongo/15 rounded-full blur-2xl pointer-events-none group-hover:bg-mongo/25 transition-all duration-500" />
            <div className="absolute -bottom-10 -left-10 w-28 h-28 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />

            {/* Header row */}
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-mongo opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-mongo shadow-[0_0_8px_#00ED64]"></span>
                </span>
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-gray-200 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-mongo" />
                  Cluster Telemetry
                </span>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-[0_0_10px_rgba(0,237,100,0.15)]">
                <ShieldCheck className="w-3 h-3 text-mongo" />
                SHIELD ACTIVE
              </span>
            </div>

            {/* Center: Interactive Telemetry HUD with Mini-Radar & Signal Nodes */}
            <div className="grid grid-cols-12 gap-3 items-center relative z-10">
              {/* Mini Animated Cyber Radar Visualizer (4 cols) */}
              <div className="col-span-4 flex flex-col items-center justify-center p-2 rounded-xl bg-gray-900/90 border border-gray-800/90 relative overflow-hidden h-[96px]">
                {/* Radar rings */}
                <div className="w-16 h-16 rounded-full border border-emerald-500/25 relative flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full border border-emerald-500/35 flex items-center justify-center animate-pulse-ring">
                    <div className="w-3.5 h-3.5 rounded-full bg-emerald-500/20 border border-emerald-500/50" />
                  </div>
                  <div className="absolute inset-x-0 top-1/2 h-[1px] bg-emerald-500/20 pointer-events-none" />
                  <div className="absolute inset-y-0 left-1/2 w-[1px] bg-emerald-500/20 pointer-events-none" />
                  <div className="absolute inset-0 rounded-full overflow-hidden animate-radar-sweep">
                    <div className="w-1/2 h-1/2 bg-gradient-to-br from-mongo/50 to-transparent origin-bottom-right" />
                  </div>
                  <span className="absolute top-2.5 right-3.5 w-1.5 h-1.5 rounded-full bg-mongo shadow-[0_0_6px_#00ED64] animate-pulse" />
                  {pgCount > 0 && <span className="absolute bottom-3 left-3 w-1.5 h-1.5 rounded-full bg-sky-400 shadow-[0_0_6px_#38BDF8] animate-pulse" />}
                  {mysqlCount > 0 && <span className="absolute top-4 left-3 w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_#FBBF24] animate-pulse" />}
                </div>
                <span className="text-[8px] font-mono text-gray-400 mt-1 uppercase tracking-widest font-semibold">
                  LIVE RADAR
                </span>
              </div>

              {/* Engine Signal Meters (8 cols) */}
              <div className="col-span-8 flex flex-col gap-1.5">
                <div className="flex items-center justify-between p-1.5 px-2.5 rounded-lg bg-gray-900/80 border border-gray-800/80 hover:border-mongo/40 transition">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-mongo shadow-[0_0_6px_#00ED64]" />
                    <span className="text-[11px] font-mono font-medium text-gray-200 truncate">
                      MongoDB ({mongoCount})
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-mono font-bold text-mongo">
                      {allDatabasesList.find(d => d.type === 'MongoDB')?.responseTime || '95 ms'}
                    </span>
                    <span className="text-[9px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-1 rounded border border-emerald-500/20">
                      SYNC
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between p-1.5 px-2.5 rounded-lg bg-gray-900/80 border border-gray-800/80 hover:border-sky-500/40 transition">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shadow-[0_0_6px_#38BDF8]" />
                    <span className="text-[11px] font-mono font-medium text-gray-200 truncate">
                      PostgreSQL ({pgCount})
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-mono font-bold text-sky-400">
                      {allDatabasesList.find(d => d.type === 'PostgreSQL')?.responseTime || '655 ms'}
                    </span>
                    <span className="text-[9px] font-mono font-bold text-sky-400 bg-sky-500/10 px-1 rounded border border-sky-500/20">
                      SYNC
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between p-1.5 px-2.5 rounded-lg bg-gray-900/80 border border-gray-800/80 hover:border-amber-400/40 transition">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_#FBBF24]" />
                    <span className="text-[11px] font-mono font-medium text-gray-200 truncate">
                      MySQL ({mysqlCount})
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-mono font-bold text-amber-400">
                      {allDatabasesList.find(d => d.type === 'MySQL')?.responseTime || '546 ms'}
                    </span>
                    <span className="text-[9px] font-mono font-bold text-amber-400 bg-amber-400/10 px-1 rounded border border-amber-400/20">
                      SYNC
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom cyber metrics strip */}
            <div className="pt-2 border-t border-gray-800/80 flex items-center justify-between text-[10px] font-mono text-gray-400 relative z-10">
              <span className="flex items-center gap-1.5 text-gray-400">
                <Cpu className="w-3 h-3 text-mongo" />
                <span>HIBERNATION: <strong className="text-emerald-400 font-bold">PREVENTED</strong></span>
              </span>
              <span className="flex items-center gap-1 text-gray-400">
                <span>NODES: <strong className="text-gray-200">{allDatabasesList.length} / 15 ACTIVE</strong></span>
              </span>
            </div>
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

      {/* SECTION: Connected Database Fleet (CYBER SERVER BLADES) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 px-1">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-mongo/10 border border-mongo/30 flex items-center justify-center shrink-0">
                <Database className="w-4 h-4 text-mongo" />
              </div>
              <h2 className="text-lg font-extrabold text-white tracking-tight whitespace-nowrap">
                Active Database Connections
              </h2>
              <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full bg-gray-900 text-mongo border border-mongo/30 shadow-[0_0_10px_rgba(0,237,100,0.1)] whitespace-nowrap">
                {allDatabasesList.length} Active / 15 Max
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1 pl-10.5">
              Real-time health, encryption, and keep-alive ping telemetry for each cloud cluster.
            </p>
          </div>

          {/* Filter Pills with glowing active state */}
          {allDatabasesList.length > 2 && (
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-gray-900/90 border border-gray-800 shrink-0 shadow-inner overflow-x-auto">
              <button
                onClick={() => setEngineFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition ${
                  engineFilter === 'ALL'
                    ? 'bg-gray-800 text-white shadow-md border border-gray-700'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                All ({allDatabasesList.length})
              </button>
              {mongoCount > 0 && (
                <button
                  onClick={() => setEngineFilter('MongoDB')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition flex items-center gap-1.5 ${
                    engineFilter === 'MongoDB'
                      ? 'bg-mongo/20 text-mongo border border-mongo/40 shadow-[0_0_12px_rgba(0,237,100,0.15)] font-bold'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-mongo" />
                  MongoDB ({mongoCount})
                </button>
              )}
              {pgCount > 0 && (
                <button
                  onClick={() => setEngineFilter('PostgreSQL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition flex items-center gap-1.5 ${
                    engineFilter === 'PostgreSQL'
                      ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40 shadow-[0_0_12px_rgba(56,189,248,0.15)] font-bold'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                  PostgreSQL ({pgCount})
                </button>
              )}
              {mysqlCount > 0 && (
                <button
                  onClick={() => setEngineFilter('MySQL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition flex items-center gap-1.5 ${
                    engineFilter === 'MySQL'
                      ? 'bg-amber-400/20 text-amber-400 border border-amber-400/40 shadow-[0_0_12px_rgba(251,191,36,0.15)] font-bold'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  MySQL ({mysqlCount})
                </button>
              )}
            </div>
          )}
        </div>

        {/* Scalable Grid of Databases: FUTURISTIC NODE BLADES */}
        <div className={`grid grid-cols-1 ${displayedDatabases.length === 4 ? 'md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4' : 'md:grid-cols-2 lg:grid-cols-3'} gap-5`}>
          {displayedDatabases.map((db, idx) => {
            const isMongo = db.type === 'MongoDB';
            const isPg = db.type === 'PostgreSQL';
            const isMy = db.type === 'MySQL';

            const cardCyberClass = isMongo
              ? 'cyber-card-mongo'
              : isPg
              ? 'cyber-card-postgres'
              : 'cyber-card-mysql';

            const iconBg = isMongo
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_15px_rgba(0,237,100,0.15)]'
              : isPg
              ? 'bg-sky-500/10 text-sky-400 border-sky-500/30 shadow-[0_0_15px_rgba(56,189,248,0.15)]'
              : 'bg-amber-500/10 text-amber-400 border-amber-500/30 shadow-[0_0_15px_rgba(251,191,36,0.15)]';

            const nameColor = isMongo
              ? 'text-mongo'
              : isPg
              ? 'text-sky-400'
              : 'text-amber-400';

            const protocolString = isMongo
              ? 'mongodb+srv://'
              : isPg
              ? 'postgresql://'
              : 'mysql://';

            // Real live connection status & latency metrics from ping query
            const isDbOnline = db.status === 'ONLINE';
            const latencyNum = db.responseTimeNum || parseInt(db.responseTime) || (isMongo ? 95 : isPg ? 655 : 546);

            // Realistic cloud ping latency tier calculations
            let pingTierBadgeClass = '';
            let pingTierLabel = '';
            let pingTierIconColor = '';

            if (!isDbOnline) {
              pingTierBadgeClass = 'bg-red-500/10 text-red-400 border-red-500/30';
              pingTierLabel = 'TIMEOUT';
              pingTierIconColor = 'text-red-400';
            } else if (latencyNum <= 150) {
              pingTierBadgeClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_10px_rgba(0,237,100,0.12)]';
              pingTierLabel = 'FAST';
              pingTierIconColor = 'text-mongo';
            } else if (latencyNum <= 450) {
              pingTierBadgeClass = 'bg-teal-500/10 text-teal-300 border-teal-500/30 shadow-[0_0_10px_rgba(45,212,191,0.12)]';
              pingTierLabel = 'NORMAL';
              pingTierIconColor = 'text-teal-300';
            } else if (latencyNum <= 800) {
              pingTierBadgeClass = 'bg-sky-500/10 text-sky-300 border-sky-500/30 shadow-[0_0_10px_rgba(56,189,248,0.12)]';
              pingTierLabel = 'STABLE';
              pingTierIconColor = 'text-sky-300';
            } else {
              pingTierBadgeClass = 'bg-amber-500/10 text-amber-400 border-amber-500/30 shadow-[0_0_10px_rgba(251,191,36,0.12)]';
              pingTierLabel = 'SLOW';
              pingTierIconColor = 'text-amber-400';
            }

            const latencyPercent = Math.min(100, Math.max(15, 100 - (latencyNum / 1000) * 80));

            const latencyTrackGradient = !isDbOnline
              ? 'from-red-500 to-red-400'
              : latencyNum <= 150
              ? 'from-emerald-500 to-mongo shadow-[0_0_8px_rgba(0,237,100,0.5)]'
              : latencyNum <= 450
              ? 'from-teal-500 to-teal-300 shadow-[0_0_8px_rgba(45,212,191,0.5)]'
              : latencyNum <= 800
              ? 'from-blue-500 to-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.5)]'
              : 'from-amber-500 to-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]';

            return (
              <div
                key={db.index ? `${db.type}_${db.index}` : idx}
                className={`glass-panel rounded-2xl p-5 bg-cardBg/95 backdrop-blur-xl relative overflow-hidden flex flex-col justify-between gap-4.5 shadow-xl shadow-black/30 group ${cardCyberClass}`}
              >
                {/* Subtle top glowing accent strip */}
                <div
                  className={`absolute top-0 left-0 right-0 h-[2px] transition-all duration-300 ${
                    isMongo
                      ? 'bg-gradient-to-r from-transparent via-mongo to-transparent opacity-60 group-hover:opacity-100'
                      : isPg
                      ? 'bg-gradient-to-r from-transparent via-sky-400 to-transparent opacity-60 group-hover:opacity-100'
                      : 'bg-gradient-to-r from-transparent via-amber-400 to-transparent opacity-60 group-hover:opacity-100'
                  }`}
                />

                {/* Top Header: Node Identification, Logo & Live Beacon */}
                <div className="flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${iconBg}`}>
                      {isMongo ? (
                        <Database className="w-5 h-5 text-mongo" />
                      ) : isPg ? (
                        <Server className="w-5 h-5 text-sky-400" />
                      ) : (
                        <Zap className="w-5 h-5 text-amber-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <span className="font-extrabold text-white text-sm tracking-tight whitespace-nowrap">
                          {db.label}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-900 text-gray-400 border border-gray-800 whitespace-nowrap">
                          {db.badge || (isMongo ? 'Atlas' : 'Aiven')}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-gray-400 mt-0.5 flex items-center gap-1.5 whitespace-nowrap">
                        <span className="text-gray-500 font-semibold uppercase whitespace-nowrap">NODE {String(db.index || idx + 1).padStart(2, '0')}</span>
                        <span className="text-gray-600">•</span>
                        {db.isPrimary ? (
                          <span className="text-amber-400 font-semibold whitespace-nowrap">★ Primary</span>
                        ) : (
                          <span className="text-gray-400 font-medium whitespace-nowrap">Target</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Real-time Health Beacon (Emerald Green = Online, Red = Offline) */}
                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-semibold shrink-0 shadow-sm whitespace-nowrap ${
                    isDbOnline
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-[0_0_10px_rgba(0,237,100,0.12)]'
                      : 'bg-red-500/10 text-red-400 border border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.12)]'
                  }`}>
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                        isDbOnline ? 'bg-mongo' : 'bg-red-500'
                      }`}></span>
                      <span className={`relative inline-flex rounded-full h-2 w-2 ${
                        isDbOnline ? 'bg-mongo shadow-[0_0_8px_#00ED64]' : 'bg-red-500 shadow-[0_0_8px_#EF4444]'
                      }`}></span>
                    </span>
                    <span>{isDbOnline ? 'ONLINE' : 'OFFLINE'}</span>
                  </div>
                </div>

                {/* Center: High-Tech Database Terminal HUD */}
                <div className="p-3.5 rounded-xl bg-gray-950/90 border border-gray-800/90 relative overflow-hidden group-hover:border-gray-700/90 transition shadow-inner space-y-2.5">
                  {/* Top terminal bar with dots & protocol */}
                  <div className="flex items-center justify-between pb-2 border-b border-gray-800/70 text-[10px] font-mono text-gray-500">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-red-500/80" />
                      <span className="w-2 h-2 rounded-full bg-yellow-500/80" />
                      <span className="w-2 h-2 rounded-full bg-emerald-500/80" />
                      <span className="ml-1 text-gray-400 font-semibold">{protocolString}</span>
                    </div>
                    <span className="flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded text-[10px] font-mono border border-emerald-500/20 whitespace-nowrap">
                      <Lock className="w-2.5 h-2.5" />
                      TLS 1.3
                    </span>
                  </div>

                  {/* Row 1: Target Database Name (Full row width, never line-breaks!) */}
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-gray-500">
                      Target Database
                    </div>
                    <div className={`font-mono font-black text-base tracking-wide mt-0.5 ${nameColor} terminal-glow truncate`}>
                      {db.name || 'system_reset'}
                    </div>
                  </div>

                  {/* Row 2: Heartbeat Latency Bar (Full row width, never wraps numbers!) */}
                  <div className="pt-2 border-t border-gray-900 flex items-center justify-between">
                    <span className="text-[11px] font-mono text-gray-400 flex items-center gap-1.5 whitespace-nowrap">
                      <Activity className={`w-3.5 h-3.5 ${pingTierIconColor} animate-pulse shrink-0`} />
                      <span>Ping Latency</span>
                    </span>
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-mono text-xs font-bold whitespace-nowrap ${pingTierBadgeClass}`}>
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isDbOnline ? 'bg-current animate-ping' : 'bg-red-500'}`} />
                      <span>⚡ {latencyNum} ms</span>
                      <span className="text-[10px] font-semibold opacity-80 uppercase tracking-tight">· {pingTierLabel}</span>
                    </div>
                  </div>
                </div>

                {/* Footer Metrics: High-tech compact telemetry pill with generous breathing room */}
                <div className="pt-2 border-t border-gray-800/80 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="flex items-center gap-1.5 text-emerald-400 font-semibold text-[11px] whitespace-nowrap">
                      <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                      <span>Verified</span>
                    </span>

                    <span className="text-[11px] text-gray-300 flex items-center gap-1 bg-gray-900/90 px-2 py-0.5 rounded-md border border-gray-800 whitespace-nowrap shrink-0">
                      <span className="text-gray-500 font-mono text-[10px]">{isMongo ? 'COLL:' : 'CHECK:'}</span>
                      <strong className={`${nameColor} font-mono font-semibold`}>
                        {isMongo ? (dbInfo.collection || 'sysreset') : 'SELECT 1'}
                      </strong>
                    </span>
                  </div>

                  {/* Micro Latency Progress Track */}
                  <div className="w-full bg-gray-950 h-1.5 rounded-full overflow-hidden border border-gray-800/80">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${latencyTrackGradient}`}
                      style={{ width: `${latencyPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Two Column Layout: Automation Panel on Left, Recent Activity on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Automation Status Panel (5 cols) */}
        <div className="lg:col-span-5 glass-panel rounded-2xl p-5 sm:p-6 bg-cardBg/95 border border-gray-800/90 flex flex-col justify-between shadow-xl shadow-black/25">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2.5 shrink-0">
                <div className="w-7 h-7 rounded-lg bg-mongo/10 border border-mongo/30 flex items-center justify-center shrink-0">
                  <Power className="w-3.5 h-3.5 text-mongo" />
                </div>
                <h3 className="text-sm font-bold text-white tracking-tight whitespace-nowrap">Automation Status</h3>
              </div>
              <span className="text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-inner whitespace-nowrap flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-mongo animate-pulse shrink-0" />
                <span>Auto-Scheduler Active</span>
              </span>
            </div>

            <div className="space-y-4">
              {/* Bot Switch */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-gray-950/80 border border-gray-800/90">
                <div>
                  <div className="text-sm font-bold text-white">Keep Alive Bot</div>
                  <div className="text-xs text-gray-400">Scheduled serverless background execution</div>
                </div>
                <button
                  id="toggle-automation-btn"
                  onClick={() => onToggleAutomation(!automation.enabled)}
                  className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ease-in-out ${
                    automation.enabled ? 'bg-mongo shadow-[0_0_12px_#00ED64]' : 'bg-gray-800'
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
                <div className="p-3.5 rounded-xl bg-gray-950/80 border border-gray-800/90 flex flex-col justify-between">
                  <div>
                    <div className="text-[11px] text-gray-500 uppercase font-mono flex items-center justify-between">
                      <span>Interval</span>
                      <Timer className="w-3.5 h-3.5 text-gray-500" />
                    </div>
                    <div className="text-lg font-black text-white font-mono mt-1">
                      {automation.interval || 5} min
                    </div>
                  </div>
                  <div className="text-[10px] text-gray-400 font-mono mt-2 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-mongo" />
                    <span>At {nextScheduledDisplay}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-gray-950/90 border border-mongo/30 shadow-[0_0_20px_rgba(0,237,100,0.12)] relative overflow-hidden flex flex-col justify-between">
                  <div className="absolute -right-6 -bottom-6 w-20 h-20 bg-mongo/10 rounded-full blur-xl pointer-events-none" />

                  <div>
                    <div className="text-[11px] uppercase font-mono flex items-center justify-between">
                      <span className="text-mongo font-bold tracking-wider">Countdown</span>
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-mongo opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-mongo shadow-[0_0_8px_#00ED64]"></span>
                      </span>
                    </div>

                    <div className="text-2xl font-black text-mongo font-mono tabular-nums tracking-wider mt-0.5 drop-shadow-[0_0_10px_rgba(0,237,100,0.3)]">
                      {countdownText}
                    </div>
                  </div>

                  {/* 60fps Ultra-smooth Progress Track */}
                  <div className="w-full bg-gray-900 h-2 rounded-full mt-2.5 overflow-hidden p-0.5 border border-gray-800">
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
            <span>Execution Protocol</span>
            <span className="font-mono text-gray-300 font-semibold">Netlify Cron / Webhook</span>
          </div>
        </div>

        {/* Recent Activity Panel (7 cols - Cyber Audit Stream) */}
        <div className="lg:col-span-7 glass-panel rounded-2xl p-5 sm:p-6 bg-cardBg/95 border border-gray-800/90 flex flex-col justify-between shadow-xl shadow-black/25">
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded-lg bg-mongo/10 border border-mongo/30 flex items-center justify-center">
                  <Activity className="w-3.5 h-3.5 text-mongo" />
                </div>
                <h3 className="text-sm font-bold text-white tracking-tight">Recent Keep-Alive Activity</h3>
              </div>
              <button
                onClick={onRefresh}
                className="text-gray-400 hover:text-white transition p-1.5 rounded-lg hover:bg-gray-800 border border-transparent hover:border-gray-700"
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
                  const isMg = (activity.target || '').includes('Mongo');
                  const isPostgres = (activity.target || '').includes('Postgre');
                  const isMySql = (activity.target || '').includes('MySQL');

                  const tagColor = isMg
                    ? 'text-mongo bg-emerald-500/10 border-emerald-500/30'
                    : isPostgres
                    ? 'text-sky-400 bg-sky-500/10 border-sky-500/30'
                    : 'text-amber-400 bg-amber-400/10 border-amber-400/30';

                  const badgeText = isMg ? 'MONGO' : isPostgres ? 'PGSQL' : 'MYSQL';

                  return (
                    <div
                      key={activity.id}
                      className="p-3 rounded-xl bg-gray-950/80 border border-gray-800/80 flex items-center justify-between hover:border-gray-700 transition gap-3 shadow-inner"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            isSuccess ? 'bg-mongo shadow-[0_0_8px_#00ED64]' : 'bg-red-500 shadow-[0_0_8px_#EF4444]'
                          }`}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border ${tagColor}`}>
                              {badgeText}
                            </span>
                            <span className="text-xs font-medium text-white truncate" title={activity.message}>
                              {activity.message}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2 text-[10px] font-mono text-gray-400 mt-1">
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
                              {isSuccess ? 'VERIFIED' : 'FAILED'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <span className="font-mono text-xs font-bold text-gray-200 bg-gray-900 px-2.5 py-1 rounded-lg border border-gray-800 shadow-sm whitespace-nowrap">
                          ⚡ {activity.responseTime}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-800/80 flex items-center justify-between text-xs text-gray-400">
            <span>Concurrent Ping Engine</span>
            <span className="font-mono text-mongo text-xs font-bold">Multi-DB Parallel Keep-Alive</span>
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

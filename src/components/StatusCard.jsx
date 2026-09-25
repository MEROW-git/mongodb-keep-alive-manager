import React from 'react';

export default function StatusCard({ title, value, subtitle, icon: Icon, color = 'mongo', badge, pulse }) {
  const colorMap = {
    mongo: {
      text: 'text-mongo',
      bg: 'bg-mongo/10',
      border: 'border-mongo/30',
      glow: 'shadow-[0_0_15px_rgba(0,237,100,0.12)]',
    },
    blue: {
      text: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/30',
      glow: 'shadow-[0_0_15px_rgba(59,130,246,0.12)]',
    },
    purple: {
      text: 'text-purple-400',
      bg: 'bg-purple-500/10',
      border: 'border-purple-500/30',
      glow: 'shadow-[0_0_15px_rgba(168,85,247,0.12)]',
    },
    amber: {
      text: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
      glow: 'shadow-[0_0_15px_rgba(245,158,11,0.12)]',
    },
  };

  const scheme = colorMap[color] || colorMap.mongo;

  return (
    <div className="glass-panel glass-panel-hover rounded-2xl p-5 relative overflow-hidden bg-cardBg/80 border border-gray-800/80">
      {/* Background ambient radial gradient */}
      <div className="absolute -top-12 -right-12 w-28 h-28 rounded-full bg-mongo/5 blur-2xl pointer-events-none" />

      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
          {title}
        </span>
        {Icon && (
          <div className={`w-9 h-9 rounded-xl ${scheme.bg} ${scheme.border} border flex items-center justify-center ${scheme.text} ${scheme.glow}`}>
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>

      <div className="flex items-baseline space-x-2">
        <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-mono">
          {value}
        </span>
        {pulse && (
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-mongo opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-mongo"></span>
          </span>
        )}
      </div>

      {subtitle && (
        <div className="mt-2 flex items-center space-x-2 text-xs text-gray-400">
          {badge && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-800 text-gray-300 border border-gray-700">
              {badge}
            </span>
          )}
          <span className="truncate">{subtitle}</span>
        </div>
      )}
    </div>
  );
}

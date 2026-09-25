import React from 'react';
import { LayoutDashboard, FileText, Sliders, Server, ShieldCheck, ExternalLink } from 'lucide-react';

export default function Sidebar({ currentTab, setTab, isMobileOpen, closeMobile, dbInfo }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'logs', label: 'Activity Logs', icon: FileText },
    { id: 'settings', label: 'Automation Settings', icon: Sliders },
  ];

  const content = (
    <div className="h-full flex flex-col justify-between p-4">
      {/* Navigation links */}
      <div>
        <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-3 mb-2">
          Navigation
        </div>
        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setTab(item.id);
                  if (closeMobile) closeMobile();
                }}
                className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? 'bg-mongo/10 text-mongo border border-mongo/30 shadow-[0_0_12px_rgba(0,237,100,0.1)]'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-mongo' : 'text-gray-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Database Context Widget */}
      <div className="space-y-3">
        <div className="p-3.5 rounded-xl bg-cardBg/90 border border-gray-800/80 text-xs">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="font-semibold uppercase tracking-wider text-[10px]">MongoDB Atlas</span>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-mongo opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-mongo"></span>
            </span>
          </div>

          <div className="space-y-1.5 font-mono text-[11px]">
            <div className="flex justify-between">
              <span className="text-gray-500">Database:</span>
              <span className="text-gray-200 truncate max-w-[110px]">{dbInfo?.name || 'system_reset'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Collection:</span>
              <span className="text-mongo truncate max-w-[110px]">{dbInfo?.collection || 'sysreset'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Cluster:</span>
              <span className="text-gray-300">Cluster0</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-2 text-[11px] text-gray-500">
          <span className="flex items-center space-x-1">
            <ShieldCheck className="w-3.5 h-3.5 text-mongo" />
            <span>Netlify Serverless</span>
          </span>
          <span className="text-[10px] text-gray-600">v1.0.0</span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:block w-64 shrink-0 glass-panel border-r border-gray-800/80 min-h-[calc(100vh-4rem)] bg-[#0B1120]/60">
        {content}
      </aside>

      {/* Mobile Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={closeMobile}
          />
          <div className="relative w-64 bg-[#0B1120] border-r border-gray-800 z-10 h-full">
            {content}
          </div>
        </div>
      )}
    </>
  );
}

import React, { useState } from 'react';
import { Database, Zap, LogOut, Menu, X, RefreshCw, UserCheck } from 'lucide-react';
import api, { getCurrentUser } from '../services/api';

export default function Navbar({ onPingTriggered, isPinging, dbStatus = 'ONLINE', onToggleMobileMenu, isMobileMenuOpen }) {
  const user = getCurrentUser();

  const handleLogout = () => {
    api.logout();
    window.location.href = '/login';
  };

  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-gray-800/80 bg-[#0B1120]/90 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Left: Brand & Status */}
        <div className="flex items-center space-x-3 sm:space-x-4">
          <button
            onClick={onToggleMobileMenu}
            className="md:hidden p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800/60 transition"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-mongo/10 border border-mongo/30 flex items-center justify-center text-mongo shadow-[0_0_15px_rgba(0,237,100,0.15)]">
              <Database className="w-5 h-5 text-mongo" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-white text-sm sm:text-base tracking-tight">
                  MongoDB Keep Alive
                </span>
                <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-mongo/20 text-mongo border border-mongo/40">
                  Manager
                </span>
              </div>
              <p className="text-xs text-gray-400 hidden sm:block">
                Serverless Atlas Keep-Alive & Monitoring
              </p>
            </div>
          </div>
        </div>

        {/* Right: Actions & User */}
        <div className="flex items-center space-x-2 sm:space-x-4">
          
          {/* Status Indicator */}
          <div className="hidden sm:flex items-center space-x-2 px-3 py-1 rounded-full bg-gray-900/80 border border-gray-800 text-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                dbStatus === 'ONLINE' ? 'bg-mongo status-indicator-online' : 'bg-red-500 status-indicator-offline'
              }`}
            />
            <span className="font-mono font-medium text-gray-300">
              {dbStatus === 'ONLINE' ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>

          {/* Quick Ping Now Button */}
          <button
            id="navbar-ping-btn"
            onClick={onPingTriggered}
            disabled={isPinging}
            className="flex items-center space-x-1.5 sm:space-x-2 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium rounded-lg bg-mongo text-black hover:bg-mongo-400 active:scale-95 transition-all shadow-[0_0_20px_rgba(0,237,100,0.25)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Zap className={`w-3.5 h-3.5 sm:w-4 sm:h-4 fill-black ${isPinging ? 'animate-spin' : ''}`} />
            <span>{isPinging ? 'Pinging...' : 'Ping Now'}</span>
          </button>

          {/* User Profile Pill */}
          <div className="hidden md:flex items-center space-x-2 pl-2 border-l border-gray-800">
            <div className="w-8 h-8 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-xs text-gray-300">
              <UserCheck className="w-4 h-4 text-mongo" />
            </div>
            <div className="text-left text-xs">
              <div className="text-white font-medium">{user?.username || 'Admin'}</div>
              <div className="text-gray-500 text-[10px] uppercase font-mono">{user?.role || 'admin'}</div>
            </div>
          </div>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            title="Logout"
            className="p-2 text-gray-400 hover:text-red-400 rounded-lg hover:bg-gray-800/60 transition"
          >
            <LogOut className="w-4 h-4" />
          </button>

        </div>
      </div>
    </header>
  );
}

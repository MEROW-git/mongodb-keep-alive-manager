import React, { useState } from 'react';
import { Database, Lock, User, ArrowRight, Eye, EyeOff, ShieldCheck, AlertCircle } from 'lucide-react';
import api from '../services/api';

export default function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMessage('Please provide both username and password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const data = await api.login(username.trim(), password);
      if (data.token) {
        if (onLoginSuccess) {
          onLoginSuccess(data.user);
        } else {
          window.location.href = '/';
        }
      }
    } catch (err) {
      setErrorMessage(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B1120] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-mongo/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-cardBg border border-mongo/30 shadow-[0_0_25px_rgba(0,237,100,0.2)] mb-4">
            <Database className="w-8 h-8 text-mongo" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            MongoDB Keep Alive
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Admin Authentication & Monitoring Portal
          </p>
        </div>

        {/* Login Form Card */}
        <div className="glass-panel rounded-2xl p-6 sm:p-8 bg-cardBg/90 border border-gray-800/90 shadow-2xl">
          {errorMessage && (
            <div className="mb-5 p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start space-x-2 text-red-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username Input */}
            <div>
              <label className="block text-xs font-medium text-gray-300 uppercase tracking-wider mb-2">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="username-input"
                  type="text"
                  required
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter admin username"
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-900/90 border border-gray-800 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:border-mongo focus:ring-1 focus:ring-mongo transition font-mono"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-xs font-medium text-gray-300 uppercase tracking-wider mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password-input"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-11 py-2.5 bg-gray-900/90 border border-gray-800 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:border-mongo focus:ring-1 focus:ring-mongo transition font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-500 hover:text-gray-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Login Submit Button */}
            <button
              id="login-submit-btn"
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3 px-4 bg-mongo hover:bg-mongo-400 text-black font-semibold rounded-xl text-sm transition-all shadow-[0_0_20px_rgba(0,237,100,0.25)] active:scale-[0.99] flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>{isLoading ? 'Authenticating...' : 'LOGIN'}</span>
              {!isLoading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          {/* Quick Credential Helper Pill */}
          <div className="mt-6 pt-5 border-t border-gray-800/80 text-center">
            <p className="text-[11px] text-gray-500">
              Secured with bcrypt & JSON Web Tokens
            </p>
          </div>
        </div>

        {/* Security badge footer */}
        <div className="flex items-center justify-center space-x-2 mt-6 text-xs text-gray-500">
          <ShieldCheck className="w-4 h-4 text-mongo" />
          <span>Restricted Admin Portal</span>
        </div>
      </div>
    </div>
  );
}

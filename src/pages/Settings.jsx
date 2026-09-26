import React, { useState, useEffect } from 'react';
import { Sliders, Save, Database, ShieldCheck, CheckCircle2, AlertCircle, Copy, Check, Layers } from 'lucide-react';
import api from '../services/api';

export default function Settings({ onSettingsUpdated }) {
  const [enabled, setEnabled] = useState(true);
  const [intervalVal, setIntervalVal] = useState(5);
  const [databaseInfo, setDatabaseInfo] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [copiedKey, setCopiedKey] = useState(null);

  const handleCopyUri = (uri, key = 'primary') => {
    if (uri) {
      navigator.clipboard.writeText(uri);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  useEffect(() => {
    async function loadSettings() {
      setIsLoading(true);
      try {
        const data = await api.getSettings();
        if (data.settings) {
          setEnabled(data.settings.enabled);
          setIntervalVal(data.settings.interval || 5);
        }
        if (data.database) {
          setDatabaseInfo(data.database);
        }
      } catch (err) {
        setMessage({ text: err.message || 'Failed to load settings', type: 'error' });
      } finally {
        setIsLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage({ text: '', type: '' });

    try {
      const res = await api.updateSettings({
        enabled,
        interval: parseInt(intervalVal, 10),
      });
      setMessage({ text: 'Settings updated successfully!', type: 'success' });
      if (onSettingsUpdated) {
        onSettingsUpdated(res.settings);
      }
      setTimeout(() => setMessage({ text: '', type: '' }), 4000);
    } catch (err) {
      setMessage({ text: err.message || 'Failed to update settings', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };



  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="glass-panel rounded-2xl p-6 bg-cardBg/90 border border-gray-800/80">
        <div className="flex items-center space-x-2.5">
          <Sliders className="w-5 h-5 text-mongo" />
          <h1 className="text-xl font-bold text-white">Automation & Database Settings</h1>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Configure MongoDB Atlas keep-alive frequency and view cluster connection security.
        </p>
      </div>

      {message.text && (
        <div
          className={`p-3.5 rounded-xl border flex items-center space-x-2 text-xs font-medium ${
            message.type === 'success'
              ? 'bg-mongo/10 border-mongo/30 text-mongo'
              : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="space-y-6">
        
        {/* Automation Card */}
        <div className="glass-panel rounded-2xl p-6 bg-cardBg/90 border border-gray-800/80 space-y-5">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider text-gray-300">
            Automation Controls
          </h2>

          {/* Enable Keep Alive */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-gray-900/80 border border-gray-800 gap-3">
            <div>
              <div className="text-sm font-semibold text-white">Enable Keep Alive</div>
              <div className="text-xs text-gray-400">
                When enabled, scheduled ping functions will continuously maintain cluster activity.
              </div>
            </div>

            <button
              type="button"
              onClick={() => setEnabled(!enabled)}
              className={`w-14 h-7 flex items-center rounded-full p-1 transition-colors duration-200 ease-in-out shrink-0 ${
                enabled ? 'bg-mongo' : 'bg-gray-700'
              }`}
            >
              <div
                className={`bg-black w-5 h-5 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                  enabled ? 'translate-x-7' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Interval Selector */}
          <div className="p-4 rounded-xl bg-gray-900/80 border border-gray-800 space-y-3">
            <label className="block text-sm font-semibold text-white">
              Ping Interval
            </label>
            <p className="text-xs text-gray-400">
              Select the frequency interval between automated database ping operations.
            </p>

            <select
              value={intervalVal}
              onChange={(e) => setIntervalVal(Number(e.target.value))}
              className="w-full sm:w-64 px-3.5 py-2 bg-[#0B1120] border border-gray-800 rounded-xl text-white text-sm focus:outline-none focus:border-mongo focus:ring-1 focus:ring-mongo font-mono"
            >
              <option value={1}>1 minute (High Frequency)</option>
              <option value={2}>2 minutes</option>
              <option value={5}>5 minutes (Recommended)</option>
              <option value={10}>10 minutes</option>
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={60}>60 minutes (1 hour)</option>
            </select>
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSaving || isLoading}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-mongo hover:bg-mongo-400 text-black text-sm font-semibold transition-all shadow-[0_0_15px_rgba(0,237,100,0.2)] disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving...' : 'Save Settings'}</span>
            </button>
          </div>
        </div>

        {/* Database Information (Read-only / Security) */}
        <div className="glass-panel rounded-2xl p-6 bg-cardBg/90 border border-gray-800/80 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Database className="w-4 h-4 text-mongo" />
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider text-gray-300">
                Database Configuration
              </h2>
            </div>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {(databaseInfo.allDatabases || [1]).length} Configured
            </span>
          </div>

          <div className="space-y-3 text-xs font-mono">
            {(databaseInfo.allDatabases && databaseInfo.allDatabases.length > 0
              ? databaseInfo.allDatabases
              : [{ type: "MongoDB", label: "MongoDB", dbName: databaseInfo.name, maskedUri: databaseInfo.maskedUri, badge: "Atlas" }]
            ).map((db, idx) => {
              const isMongo = db.type === "MongoDB";
              const isPg = db.type === "PostgreSQL";
              const dotColor = isMongo
                ? "bg-mongo shadow-[0_0_6px_rgba(0,237,100,0.6)]"
                : isPg
                ? "bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.6)]"
                : "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]";
              const textColor = isMongo ? "text-mongo" : isPg ? "text-sky-400" : "text-amber-400";
              const isCopied = copiedKey === `db_${idx}`;

              return (
                <div key={idx} className="p-3.5 rounded-xl bg-gray-900/80 border border-gray-800 space-y-2">
                  <div className="flex items-center justify-between font-sans">
                    <span className="flex items-center gap-1.5 font-semibold text-white">
                      <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                      {db.label}
                      <span className="text-[10px] font-mono text-gray-400 bg-gray-800 px-1.5 py-0.5 rounded">
                        {db.badge || (isMongo ? "Atlas" : "Aiven")}
                      </span>
                      {db.isPrimary && (
                        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                          Primary
                        </span>
                      )}
                    </span>
                    <span className="text-gray-400 text-xs font-mono">
                      Database: <strong className={textColor}>{db.dbName || "system_reset"}</strong>
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <code className="text-gray-300 text-xs truncate max-w-lg">
                      {db.maskedUri || "Loading..."}
                    </code>
                    <button
                      type="button"
                      onClick={() => handleCopyUri(db.maskedUri, `db_${idx}`)}
                      title={`Copy ${db.label} URI`}
                      className="p-1.5 rounded-lg bg-gray-800 text-gray-300 hover:text-white shrink-0"
                    >
                      {isCopied ? <Check className="w-3.5 h-3.5 text-mongo" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              );
            })}

            <div className="p-3 rounded-xl bg-gray-950/60 border border-gray-800 flex justify-between items-center font-sans text-xs">
              <span className="text-gray-400">Target System Collection:</span>
              <span className="font-mono font-bold text-mongo">{databaseInfo.collection || "sysreset"}</span>
            </div>
          </div>
        </div>

        {/* Multi-Database Scaling Guide */}
        <div className="glass-panel rounded-2xl p-6 bg-cardBg/90 border border-gray-800/80 space-y-3">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-sky-400" />
            <h2 className="text-sm font-semibold text-white">Multi-Database Scaling (Up to 5 Each)</h2>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">
            Need to monitor additional databases? You can configure up to 5 connections for each engine in your <code className="text-mongo">.env</code> file:
          </p>
          <div className="p-3.5 rounded-xl bg-gray-950 border border-gray-800 space-y-2 font-mono text-xs text-gray-300">
            <div>
              <span className="text-mongo font-semibold">🍃 MongoDB:</span>{' '}
              <code className="text-gray-400">MONGO_URI, MONGO_URI2, MONGO_URI3, MONGO_URI4, MONGO_URI5</code>
            </div>
            <div>
              <span className="text-sky-400 font-semibold">🐘 PostgreSQL:</span>{' '}
              <code className="text-gray-400">postgresql_url, postgresql_url2, postgresql_url3, postgresql_url4, postgresql_url5</code>
            </div>
            <div>
              <span className="text-amber-400 font-semibold">🐬 MySQL:</span>{' '}
              <code className="text-gray-400">mysql_url, mysql_url2, mysql_url3, mysql_url4, mysql_url5</code>
            </div>
          </div>
          <p className="text-[11px] text-gray-500">
            💡 Databases defined in your environment are automatically detected on startup and included in automated keep-alive cycles.
          </p>
        </div>

        {/* Serverless Deployment & Cron Trigger Info */}
        <div className="glass-panel rounded-2xl p-6 bg-cardBg/90 border border-gray-800/80 space-y-3">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-mongo" />
            <h2 className="text-sm font-semibold text-white">Cron & Webhook Keep-Alive Trigger</h2>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">
            Automated keep-alive pings run internally every 5 minutes. You can also trigger keep-alive cycles from external monitoring services (such as UptimeRobot, cron-job.org, or curl) using the secure header-authenticated endpoint:
          </p>
          <div className="p-3.5 rounded-xl bg-gray-950 border border-gray-800 space-y-2 font-mono text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-gray-300">
              <span className="text-gray-500 font-sans">Endpoint:</span>
              <code className="text-mongo">POST /api/ping</code>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-gray-300">
              <span className="text-gray-500 font-sans">Header:</span>
              <code className="text-sky-400">x-cron-secret: YOUR_CRON_SECRET</code>
            </div>
          </div>
          <p className="text-[11px] text-gray-500">
            🔒 <strong>Security best practice:</strong> Transmitting secrets via HTTP request headers prevents tokens from being recorded in web server access logs, browser history, or proxy referrer headers.
          </p>
        </div>

      </form>
    </div>
  );
}

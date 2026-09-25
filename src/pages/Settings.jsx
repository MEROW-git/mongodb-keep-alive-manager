import React, { useState, useEffect } from 'react';
import { Sliders, Save, Database, ShieldCheck, CheckCircle2, AlertCircle, Copy, Check } from 'lucide-react';
import api from '../services/api';

export default function Settings() {
  const [enabled, setEnabled] = useState(true);
  const [intervalVal, setIntervalVal] = useState(5);
  const [databaseInfo, setDatabaseInfo] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [copied, setCopied] = useState(false);

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
      await api.updateSettings({
        enabled,
        interval: parseInt(intervalVal, 10),
      });
      setMessage({ text: 'Settings updated successfully!', type: 'success' });
      setTimeout(() => setMessage({ text: '', type: '' }), 4000);
    } catch (err) {
      setMessage({ text: err.message || 'Failed to update settings', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyUri = () => {
    if (databaseInfo.maskedUri) {
      navigator.clipboard.writeText(databaseInfo.maskedUri);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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
          <div className="flex items-center space-x-2">
            <Database className="w-4 h-4 text-mongo" />
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider text-gray-300">
              Database Configuration
            </h2>
          </div>

          <div className="space-y-3 text-xs font-mono">
            {/* Masked URI */}
            <div className="p-3.5 rounded-xl bg-gray-900/80 border border-gray-800">
              <div className="flex items-center justify-between text-gray-400 mb-1 font-sans">
                <span className="font-semibold">MongoDB URI:</span>
                <span className="text-[10px] text-gray-500 uppercase">(Hidden / Protected)</span>
              </div>
              <div className="flex items-center justify-between gap-2 mt-1">
                <code className="text-gray-300 text-xs truncate max-w-lg">
                  {databaseInfo.maskedUri || 'Loading...'}
                </code>
                <button
                  type="button"
                  onClick={handleCopyUri}
                  title="Copy masked URI"
                  className="p-1.5 rounded-lg bg-gray-800 text-gray-300 hover:text-white shrink-0"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-mongo" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* DB Name & Collection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-gray-900/80 border border-gray-800 flex justify-between items-center font-sans">
                <span className="text-gray-400">Database:</span>
                <span className="font-mono font-bold text-white">{databaseInfo.name || 'system_reset'}</span>
              </div>

              <div className="p-3.5 rounded-xl bg-gray-900/80 border border-gray-800 flex justify-between items-center font-sans">
                <span className="text-gray-400">Collection:</span>
                <span className="font-mono font-bold text-mongo">{databaseInfo.collection || 'sysreset'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Serverless Deployment & Cron Trigger Info */}
        <div className="glass-panel rounded-2xl p-6 bg-cardBg/90 border border-gray-800/80 space-y-3">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-mongo" />
            <h2 className="text-sm font-semibold text-white">Cron & Webhook Keep-Alive Trigger</h2>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">
            The application is 100% serverless with zero background processes. Ping operations can be triggered automatically by Netlify Scheduled Functions or by external cron services (such as UptimeRobot, cron-job.org, or GitHub Actions) using the endpoint:
          </p>
          <div className="p-3 rounded-xl bg-gray-950 border border-gray-800 font-mono text-xs text-mongo flex items-center justify-between">
            <code>/.netlify/functions/ping?key=CRON_SECRET</code>
            <span className="text-[10px] text-gray-500 uppercase font-sans">HTTP GET/POST</span>
          </div>
        </div>

      </form>
    </div>
  );
}

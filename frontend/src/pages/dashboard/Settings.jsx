import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../services/auth/authProvider';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const INTERVAL_PRESETS = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '1 hour', value: 60 },
  { label: '3 hours', value: 180 },
  { label: '6 hours', value: 360 },
  { label: '12 hours', value: 720 },
  { label: '24 hours', value: 1440 },
];

export default function Settings() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    scheduler_enabled: false,
    scheduler_interval_minutes: 360,
  });

  useEffect(() => {
    if (!token) return;
    const fetchSettings = async () => {
      try {
        const res = await axios.get('/api/settings/scheduler/', {
          headers: { Accept: 'application/json' },
        });
        setSettings(res.data);
      } catch {
        toast.error('Failed to load settings');
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, [token]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await axios.put('/api/settings/scheduler/', settings, {
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      });
      setSettings(res.data);
      toast.success(
        res.data.scheduler_enabled
          ? `Scheduler enabled (every ${res.data.scheduler_interval_minutes} min)`
          : 'Scheduler disabled'
      );
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm animate-pulse">
          <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-1/4 mb-4" />
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-5 max-w-2xl">
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm">
        <p className="text-sm text-slate-500 dark:text-slate-400">Monitor</p>
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Settings</h2>
      </div>

      {/* Scheduler Settings */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm space-y-5">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Scheduled Monitoring</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Automatically re-check all assets that have monitoring enabled.
          </p>
        </div>

        {/* Enable toggle */}
        <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-700">
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Enable Scheduler</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              When enabled, assets with "Enable Monitoring" will be checked periodically.
            </p>
          </div>
          <button
            onClick={() => setSettings((s) => ({ ...s, scheduler_enabled: !s.scheduler_enabled }))}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings.scheduler_enabled ? 'bg-cyan-600' : 'bg-slate-300 dark:bg-slate-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                settings.scheduler_enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Interval */}
        {settings.scheduler_enabled && (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Default Check Interval</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Used for assets without a custom interval. Individual assets can override this.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {INTERVAL_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => setSettings((s) => ({ ...s, scheduler_interval_minutes: preset.value }))}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                    settings.scheduler_interval_minutes === preset.value
                      ? 'bg-cyan-600 text-white border-cyan-600'
                      : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-cyan-400'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500 dark:text-slate-400">Or custom:</span>
              <input
                type="number"
                min="1"
                max="10080"
                value={settings.scheduler_interval_minutes}
                onChange={(e) => setSettings((s) => ({ ...s, scheduler_interval_minutes: parseInt(e.target.value) || 1 }))}
                className="w-24 px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <span className="text-sm text-slate-500 dark:text-slate-400">minutes</span>
            </div>
          </div>
        )}

        {/* Save button */}
        <div className="flex justify-end pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-cyan-600 hover:bg-cyan-700 text-white py-2 px-5 rounded-lg transition-colors disabled:opacity-50 inline-flex items-center gap-2 font-medium text-sm"
          >
            {saving ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </div>

      {/* Info box */}
      <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-sm text-slate-600 dark:text-slate-400">
        <p className="font-medium text-slate-700 dark:text-slate-300 mb-1">How it works</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Only assets with <span className="font-medium">"Enable Monitoring"</span> toggled on will be checked.</li>
          <li>Each asset can have a <span className="font-medium">custom interval</span> set in its edit dialog, overriding the default.</li>
          <li>When a new blacklisting is detected and alerts are enabled, you'll be notified via email/webhook.</li>
          <li>Check results appear in the <span className="font-medium">History</span> tab of each asset's detail page.</li>
        </ul>
      </div>

      <ToastContainer position="top-center" autoClose={3000} />
    </section>
  );
}

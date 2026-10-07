import { useEffect, useId, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useAuth } from '../../services/auth/authProvider';
import { Alert, PageHeader, Spinner, cardClass, inputClass, primaryButtonClass } from '../../components/shared/ui';

const INTERVAL_PRESETS = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '1 hour', value: 60 },
  { label: '3 hours', value: 180 },
  { label: '6 hours', value: 360 },
  { label: '12 hours', value: 720 },
  { label: '24 hours', value: 1440 },
];

function SchedulerSettings({ isAdmin }) {
  const { token } = useAuth();
  const id = useId();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({ scheduler_enabled: false, scheduler_interval_minutes: 360 });

  useEffect(() => {
    if (!token) return;
    axios.get('/api/settings/scheduler/', { headers: { Accept: 'application/json' } })
      .then((res) => setSettings(res.data))
      .catch(() => toast.error('Could not load scheduler settings.'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await axios.put('/api/settings/scheduler/', settings, {
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      });
      setSettings(res.data);
      toast.success(res.data.scheduler_enabled ? `Scheduler on, default interval ${res.data.scheduler_interval_minutes} min` : 'Scheduler turned off');
    } catch (err) {
      toast.error(err.response?.status === 403 ? 'Only admins can change scheduler settings.' : 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className={`${cardClass} p-6 h-40 animate-pulse`} aria-busy="true" aria-label="Loading scheduler settings" />;
  }

  const interval = settings.scheduler_interval_minutes;

  return (
    <div className={`${cardClass} p-6 space-y-5`}>
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Scheduled monitoring</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Re-checks every asset that has scheduled monitoring turned on.
        </p>
      </div>

      {!isAdmin && <Alert tone="info">Only admins can change these settings.</Alert>}

      <div className="flex items-center justify-between gap-4 py-3 border-b border-slate-100 dark:border-slate-700">
        <div>
          <p id={`${id}-label`} className="text-sm font-medium text-slate-700 dark:text-slate-300">Run the scheduler</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">When off, assets are only checked when you add them or select Re-check.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={settings.scheduler_enabled}
          aria-labelledby={`${id}-label`}
          disabled={!isAdmin}
          onClick={() => setSettings((s) => ({ ...s, scheduler_enabled: !s.scheduler_enabled }))}
          className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            settings.scheduler_enabled ? 'bg-cyan-600' : 'bg-slate-300 dark:bg-slate-600'
          }`}
        >
          <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${settings.scheduler_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>

      {settings.scheduler_enabled && (
        <fieldset className="space-y-3" disabled={!isAdmin}>
          <legend className="text-sm font-medium text-slate-700 dark:text-slate-300">Default check interval</legend>
          <p className="text-xs text-slate-500 dark:text-slate-400 -mt-1">Used for assets without their own interval. Set a per-asset interval from the asset&apos;s Edit dialog.</p>
          <div className="flex flex-wrap gap-2">
            {INTERVAL_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                aria-pressed={interval === preset.value}
                onClick={() => setSettings((s) => ({ ...s, scheduler_interval_minutes: preset.value }))}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors border disabled:opacity-50 ${
                  interval === preset.value
                    ? 'bg-cyan-600 text-white border-cyan-600'
                    : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-cyan-400'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor={`${id}-custom`} className="text-sm text-slate-600 dark:text-slate-400">Custom</label>
            <input
              id={`${id}-custom`}
              type="number"
              min="1"
              max="10080"
              value={interval}
              onChange={(e) => setSettings((s) => ({ ...s, scheduler_interval_minutes: Math.min(10080, Math.max(1, parseInt(e.target.value, 10) || 1)) }))}
              className={`${inputClass.replace('w-full', '')} w-28`}
            />
            <span className="text-sm text-slate-600 dark:text-slate-400">minutes</span>
          </div>
        </fieldset>
      )}

      {isAdmin && (
        <div className="flex justify-end pt-2">
          <button type="button" onClick={handleSave} disabled={saving} className={primaryButtonClass}>
            {saving && <Spinner />}
            {saving ? 'Saving' : 'Save changes'}
          </button>
        </div>
      )}
    </div>
  );
}

function ChangePassword() {
  const id = useId();
  const { setToken } = useAuth();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const mismatch = form.confirm && form.next !== form.confirm;
  const tooShort = form.next && form.next.length < 8;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (mismatch || tooShort) return;
    setSaving(true);
    setError('');
    try {
      const res = await axios.post('/api/user/change-password/', {
        current_password: form.current,
        new_password: form.next,
      });
      // The old tokens are revoked server-side; switch to the fresh pair.
      setToken(res.data.access, res.data.refresh);
      setForm({ current: '', next: '', confirm: '' });
      toast.success('Password changed. Other sessions were signed out.');
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not change the password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={`${cardClass} p-6 space-y-4`} noValidate>
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Change password</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          If you still use the default <code className="text-xs">password123</code>, change it now. This signs out your other sessions.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor={`${id}-current`} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Current password</label>
          <input id={`${id}-current`} type="password" autoComplete="current-password" value={form.current} onChange={update('current')} className={inputClass} required />
        </div>
        <div>
          <label htmlFor={`${id}-next`} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">New password</label>
          <input id={`${id}-next`} type="password" autoComplete="new-password" minLength={8} value={form.next} onChange={update('next')} className={inputClass} aria-invalid={Boolean(tooShort)} aria-describedby={`${id}-next-hint`} required />
          <p id={`${id}-next-hint`} className={`mt-1 text-xs ${tooShort ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'}`}>At least 8 characters.</p>
        </div>
        <div>
          <label htmlFor={`${id}-confirm`} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Confirm new password</label>
          <input id={`${id}-confirm`} type="password" autoComplete="new-password" value={form.confirm} onChange={update('confirm')} className={inputClass} aria-invalid={Boolean(mismatch)} aria-describedby={mismatch ? `${id}-confirm-error` : undefined} required />
          {mismatch && <p id={`${id}-confirm-error`} className="mt-1 text-xs text-rose-600 dark:text-rose-400">Passwords don&apos;t match.</p>}
        </div>
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      <div className="flex justify-end">
        <button type="submit" className={primaryButtonClass} disabled={saving || !form.current || !form.next || mismatch || tooShort || form.next !== form.confirm}>
          {saving && <Spinner />}
          {saving ? 'Saving' : 'Change password'}
        </button>
      </div>
    </form>
  );
}

export default function Settings() {
  const { token } = useAuth();
  const [me, setMe] = useState(null);

  useEffect(() => {
    if (!token) return;
    axios.get('/api/user/me/').then((res) => setMe(res.data)).catch(() => setMe(null));
  }, [token]);

  return (
    <section className="space-y-5 max-w-3xl">
      <PageHeader eyebrow="Monitor" title="Settings" description={me ? `Signed in as ${me.username}${me.is_superuser ? ' (admin)' : ''}.` : undefined} />

      <SchedulerSettings isAdmin={Boolean(me?.is_superuser)} />

      <ChangePassword />

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4 text-sm text-slate-600 dark:text-slate-400">
        <h2 className="font-medium text-slate-700 dark:text-slate-300 mb-1">How monitoring works</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Only assets with scheduled monitoring turned on are re-checked.</li>
          <li>Each asset can override the default interval from its Edit dialog.</li>
          <li>When an asset becomes newly listed and alerts are on, AbuseBox sends an email (SMTP) and/or webhook, if configured.</li>
          <li>If too many blacklists don&apos;t answer, the result is marked inconclusive and the previous status is kept.</li>
        </ul>
      </div>
    </section>
  );
}

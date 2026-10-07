import { useCallback, useEffect, useId, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { HiCheckCircle, HiExclamation, HiMinusCircle } from 'react-icons/hi';
import axios from 'axios';
import { useAuth } from '../../services/auth/authProvider';
import useCurrentUser, { invalidateCurrentUser } from '../../services/users/useCurrentUser';
import {
  getNotificationSettings, getSchedulerSettings, sendTestNotification, updateNotificationSettings, updateSchedulerSettings,
} from '../../services/settings';
import UsersPanel from '../../components/dashboard/settings/UsersPanel';
import { Alert, PageHeader, Spinner, cardClass, inputClass, primaryButtonClass, secondaryButtonClass } from '../../components/shared/ui';

const INTERVAL_PRESETS = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '1 hour', value: 60 },
  { label: '3 hours', value: 180 },
  { label: '6 hours', value: 360 },
  { label: '12 hours', value: 720 },
  { label: '24 hours', value: 1440 },
];

const RETENTION_OPTIONS = [
  { label: 'Keep everything', value: 0 },
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
  { label: '180 days', value: 180 },
  { label: '1 year', value: 365 },
];

const TABS = [
  { key: 'general', label: 'General' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'security', label: 'Security' },
  { key: 'users', label: 'Users', adminOnly: true },
];

const labelClass = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5';
const narrowInput = inputClass.replace('w-full', '');

function Section({ title, description, children, footer }) {
  return (
    <section className={`${cardClass} p-6 space-y-5`}>
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
        {description && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{description}</p>}
      </div>
      {children}
      {footer && <div className="flex flex-wrap justify-end gap-2 pt-2">{footer}</div>}
    </section>
  );
}

function Switch({ checked, onChange, labelledBy, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${checked ? 'bg-cyan-600' : 'bg-slate-300 dark:bg-slate-600'}`}
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

function SwitchRow({ title, description, checked, onChange, disabled }) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-slate-100 dark:border-slate-700 last:border-0">
      <div>
        <p id={id} className="text-sm font-medium text-slate-700 dark:text-slate-300">{title}</p>
        {description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>}
      </div>
      <Switch checked={checked} onChange={onChange} labelledBy={id} disabled={disabled} />
    </div>
  );
}

/* ---------- General ---------- */
function GeneralTab({ isAdmin }) {
  const id = useId();
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSchedulerSettings().then(setSettings).catch(() => toast.error('Could not load settings.'));
  }, []);

  if (!settings) return <div className={`${cardClass} p-6 h-48 animate-pulse`} aria-busy="true" />;

  const update = (patch) => setSettings((s) => ({ ...s, ...patch }));
  const save = async () => {
    setSaving(true);
    try {
      setSettings(await updateSchedulerSettings(settings));
      toast.success('Settings saved');
    } catch (err) {
      toast.error(err.response?.status === 403 ? 'Only admins can change these settings.' : 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {!isAdmin && <Alert tone="info">Only admins can change these settings.</Alert>}
      <Section
        title="Scheduled monitoring"
        description="Re-checks every asset that has scheduled monitoring turned on."
        footer={isAdmin && (
          <button type="button" onClick={save} disabled={saving} className={primaryButtonClass}>
            {saving && <Spinner />} {saving ? 'Saving' : 'Save changes'}
          </button>
        )}
      >
        <SwitchRow
          title="Run the scheduler"
          description="When off, assets are only checked when you add them or select Re-check."
          checked={settings.scheduler_enabled}
          onChange={(value) => update({ scheduler_enabled: value })}
          disabled={!isAdmin}
        />

        {settings.scheduler_enabled && (
          <fieldset className="space-y-3" disabled={!isAdmin}>
            <legend className="text-sm font-medium text-slate-700 dark:text-slate-300">Default check interval</legend>
            <p className="text-xs text-slate-500 dark:text-slate-400 -mt-1">Used for assets without their own interval. Set a per-asset interval from the asset&apos;s Edit dialog.</p>
            <div className="flex flex-wrap gap-2">
              {INTERVAL_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  aria-pressed={settings.scheduler_interval_minutes === preset.value}
                  onClick={() => update({ scheduler_interval_minutes: preset.value })}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors border disabled:opacity-50 ${
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
              <label htmlFor={`${id}-custom`} className="text-sm text-slate-600 dark:text-slate-400">Custom</label>
              <input
                id={`${id}-custom`}
                type="number"
                min="1"
                max="10080"
                value={settings.scheduler_interval_minutes}
                onChange={(e) => update({ scheduler_interval_minutes: Math.min(10080, Math.max(1, parseInt(e.target.value, 10) || 1)) })}
                className={`${narrowInput} w-28`}
              />
              <span className="text-sm text-slate-600 dark:text-slate-400">minutes</span>
            </div>
          </fieldset>
        )}
      </Section>

      <Section title="Data retention" description="Older check results and activity are deleted automatically. Each asset's latest result is always kept.">
        <div>
          <label htmlFor={`${id}-retention`} className={labelClass}>Keep history for</label>
          <select
            id={`${id}-retention`}
            value={settings.history_retention_days}
            disabled={!isAdmin}
            onChange={(e) => update({ history_retention_days: Number(e.target.value) })}
            className={`${narrowInput} w-56`}
          >
            {RETENTION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        {isAdmin && (
          <div className="flex justify-end">
            <button type="button" onClick={save} disabled={saving} className={secondaryButtonClass}>
              {saving && <Spinner />} Save retention
            </button>
          </div>
        )}
      </Section>
    </div>
  );
}

/* ---------- Notifications ---------- */
function ChannelStatus({ label, ok, detail }) {
  const Icon = ok ? HiCheckCircle : HiMinusCircle;
  return (
    <div className="flex items-start gap-3 rounded-lg border border-slate-200 dark:border-slate-600 p-3">
      <Icon className={`mt-0.5 text-lg ${ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} aria-hidden="true" />
      <div>
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{label}: {ok ? 'configured' : 'not configured'}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{detail}</p>
      </div>
    </div>
  );
}

function NotificationsTab({ isAdmin }) {
  const id = useId();
  const [form, setForm] = useState(null);
  const [savedWebhook, setSavedWebhook] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const applySaved = useCallback((data) => {
    setForm(data);
    setSavedWebhook(data.webhook_url || '');
  }, []);

  useEffect(() => {
    getNotificationSettings().then(applySaved).catch(() => toast.error('Could not load notification settings.'));
  }, [applySaved]);

  if (!form) return <div className={`${cardClass} p-6 h-48 animate-pulse`} aria-busy="true" />;

  const update = (patch) => setForm((f) => ({ ...f, ...patch }));
  const webhookDirty = (form.webhook_url || '') !== savedWebhook;
  const save = async ({ quiet = false } = {}) => {
    setSaving(true);
    try {
      applySaved(await updateNotificationSettings({
        notify_on_delisted: form.notify_on_delisted,
        notify_on_server_down: form.notify_on_server_down,
        ssl_expiry_warning_days: form.ssl_expiry_warning_days,
        domain_expiry_warning_days: form.domain_expiry_warning_days,
        webhook_url: form.webhook_url || null,
      }));
      if (!quiet) toast.success('Notification settings saved');
      return true;
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not save notification settings.');
      return false;
    } finally {
      setSaving(false);
    }
  };
  const test = async () => {
    // Test what's in the form, not a previously saved URL.
    if (webhookDirty && !(await save({ quiet: true }))) return;
    setTesting(true);
    setTestResult(null);
    try {
      setTestResult(await sendTestNotification());
    } catch {
      toast.error('Could not send a test notification.');
    } finally {
      setTesting(false);
    }
  };

  const webhookDetail = form.webhook_source === 'settings'
    ? 'Using the URL below.'
    : form.webhook_source === 'environment' ? 'Using WEBHOOK_URL from the server environment. A URL below overrides it.' : 'Add a URL below (Slack and Discord webhooks are formatted automatically).';

  return (
    <div className="space-y-5">
      {!isAdmin && <Alert tone="info">Only admins can change notification settings.</Alert>}
      <Section title="Channels" description="Alerts go to the asset owner's email address and to the webhook. Each asset also needs alerts turned on.">
        <div className="grid gap-3 sm:grid-cols-2">
          <ChannelStatus
            label="Email"
            ok={form.email_configured}
            detail={form.email_configured ? `Sent from ${form.smtp_from}.` : 'Set SMTP_HOST and SMTP_FROM_EMAIL in the server environment.'}
          />
          <ChannelStatus label="Webhook" ok={form.webhook_configured} detail={webhookDetail} />
        </div>
        <div>
          <label htmlFor={`${id}-webhook`} className={labelClass}>Webhook URL</label>
          <input
            id={`${id}-webhook`}
            type="url"
            inputMode="url"
            autoComplete="off"
            placeholder="https://hooks.slack.com/services/…"
            value={form.webhook_url || ''}
            onChange={(e) => update({ webhook_url: e.target.value })}
            disabled={!isAdmin}
            className={inputClass}
          />
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">Slack and Discord URLs receive a chat message. Any other URL receives a JSON payload.</p>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button type="button" onClick={test} disabled={testing || saving} className={secondaryButtonClass}>
              {testing && <Spinner />} {webhookDirty ? 'Save and send test' : 'Send test notification'}
            </button>
          </div>
        )}
        {testResult && (
          <ul className="space-y-1 text-sm" aria-live="polite">
            {Object.entries(testResult).map(([channel, outcome]) => (
              <li key={channel} className="flex items-start gap-2">
                {outcome.status === 'sent'
                  ? <HiCheckCircle className="mt-0.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  : <HiExclamation className="mt-0.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />}
                <span className="text-slate-700 dark:text-slate-300">
                  <span className="font-medium capitalize">{channel}</span>: {outcome.status.replace('_', ' ')}{outcome.detail ? ` (${outcome.detail})` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="What to alert on"
        description="Changes are always recorded on the Activity page; these settings decide which ones also send an alert."
        footer={isAdmin && (
          <button type="button" onClick={() => save()} disabled={saving} className={primaryButtonClass}>
            {saving && <Spinner />} {saving ? 'Saving' : 'Save changes'}
          </button>
        )}
      >
        <div>
          <SwitchRow title="Newly listed on a blacklist" description="Always on for assets with alerts enabled." checked onChange={() => {}} disabled />
          <SwitchRow title="Removed from all blacklists" checked={form.notify_on_delisted} onChange={(v) => update({ notify_on_delisted: v })} disabled={!isAdmin} />
          <SwitchRow title="Server down and recovered" description="Needs the Server status check on the asset." checked={form.notify_on_server_down} onChange={(v) => update({ notify_on_server_down: v })} disabled={!isAdmin} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${id}-ssl`} className={labelClass}>SSL certificate expiry warning</label>
            <select id={`${id}-ssl`} value={form.ssl_expiry_warning_days} disabled={!isAdmin} onChange={(e) => update({ ssl_expiry_warning_days: Number(e.target.value) })} className={inputClass}>
              {[0, 7, 14, 21, 30].map((d) => <option key={d} value={d}>{d ? `${d} days before` : 'Off'}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor={`${id}-domain`} className={labelClass}>Domain expiry warning</label>
            <select id={`${id}-domain`} value={form.domain_expiry_warning_days} disabled={!isAdmin} onChange={(e) => update({ domain_expiry_warning_days: Number(e.target.value) })} className={inputClass}>
              {[0, 14, 30, 60, 90].map((d) => <option key={d} value={d}>{d ? `${d} days before` : 'Off'}</option>)}
            </select>
          </div>
        </div>
      </Section>
    </div>
  );
}

/* ---------- Security ---------- */
function SecurityTab({ me }) {
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
      const res = await axios.post('/api/user/change-password/', { current_password: form.current, new_password: form.next });
      // The old tokens are revoked server-side; switch to the fresh pair.
      invalidateCurrentUser();
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
    <form onSubmit={handleSubmit} noValidate>
      <Section
        title="Change password"
        description="Changing your password signs out every other session."
        footer={(
          <button type="submit" className={primaryButtonClass} disabled={saving || !form.current || !form.next || mismatch || tooShort || form.next !== form.confirm}>
            {saving && <Spinner />} {saving ? 'Saving' : 'Change password'}
          </button>
        )}
      >
        {me?.using_default_password && (
          <Alert tone="warning">This account still uses the default password from the installation guide. Anyone who has read the README can sign in.</Alert>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor={`${id}-current`} className={labelClass}>Current password</label>
            <input id={`${id}-current`} type="password" autoComplete="current-password" value={form.current} onChange={update('current')} className={inputClass} required />
          </div>
          <div>
            <label htmlFor={`${id}-next`} className={labelClass}>New password</label>
            <input id={`${id}-next`} type="password" autoComplete="new-password" minLength={8} value={form.next} onChange={update('next')} className={inputClass} aria-invalid={Boolean(tooShort)} aria-describedby={`${id}-next-hint`} required />
            <p id={`${id}-next-hint`} className={`mt-1 text-xs ${tooShort ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'}`}>At least 8 characters.</p>
          </div>
          <div>
            <label htmlFor={`${id}-confirm`} className={labelClass}>Confirm new password</label>
            <input id={`${id}-confirm`} type="password" autoComplete="new-password" value={form.confirm} onChange={update('confirm')} className={inputClass} aria-invalid={Boolean(mismatch)} aria-describedby={mismatch ? `${id}-confirm-error` : undefined} required />
            {mismatch && <p id={`${id}-confirm-error`} className="mt-1 text-xs text-rose-600 dark:text-rose-400">Passwords don&apos;t match.</p>}
          </div>
        </div>
        {error && <Alert tone="error">{error}</Alert>}
      </Section>
    </form>
  );
}

export default function Settings() {
  const me = useCurrentUser();
  const isAdmin = Boolean(me?.is_superuser);
  const [searchParams, setSearchParams] = useSearchParams();
  const tabs = TABS.filter((tab) => !tab.adminOnly || isAdmin);
  const requested = searchParams.get('tab');
  const active = tabs.some((tab) => tab.key === requested) ? requested : 'general';
  const select = useCallback((key) => setSearchParams(key === 'general' ? {} : { tab: key }, { replace: true }), [setSearchParams]);

  const onKeyDown = (event) => {
    const index = tabs.findIndex((tab) => tab.key === active);
    const next = { ArrowRight: index + 1, ArrowLeft: index - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    const tab = tabs[(next + tabs.length) % tabs.length];
    select(tab.key);
    document.getElementById(`settings-tab-${tab.key}`)?.focus();
  };

  return (
    <section className="space-y-5 max-w-4xl">
      <PageHeader eyebrow="Monitor" title="Settings" description={me ? `Signed in as ${me.username}${isAdmin ? ' (admin)' : ''}.` : undefined} />

      <div role="tablist" aria-label="Settings sections" onKeyDown={onKeyDown} className="flex gap-1 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            id={`settings-tab-${tab.key}`}
            type="button"
            role="tab"
            aria-selected={active === tab.key}
            aria-controls="settings-panel"
            tabIndex={active === tab.key ? 0 : -1}
            onClick={() => select(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${active === tab.key ? 'border-cyan-600 text-cyan-700 dark:text-cyan-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div id="settings-panel" role="tabpanel" aria-labelledby={`settings-tab-${active}`}>
        {active === 'general' && <GeneralTab isAdmin={isAdmin} />}
        {active === 'notifications' && <NotificationsTab isAdmin={isAdmin} />}
        {active === 'security' && <SecurityTab me={me} />}
        {active === 'users' && isAdmin && <UsersPanel currentUserId={me?.id} />}
      </div>
    </section>
  );
}

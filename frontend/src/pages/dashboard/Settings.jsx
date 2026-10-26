import { useCallback, useEffect, useId, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import axios from 'axios';
import { useAuth } from '../../services/auth/authProvider';
import useCurrentUser, { invalidateCurrentUser } from '../../services/users/useCurrentUser';
import { updateMe } from '../../services/users';
import {
  getNotificationSettings, getSchedulerSettings, sendTestNotification, updateNotificationSettings, updateSchedulerSettings,
} from '../../services/settings';
import UsersPanel from '../../components/dashboard/settings/UsersPanel';
import { SkeletonLine } from '../../components/shared/Skeleton';
import { SeverityBadge, SeverityCode } from '../../components/shared/activity';
import {
  Alert, Field, Fields, PageHeader, Section, Spinner, inputClass, primaryButtonClass, secondaryButtonClass, selectClass,
} from '../../components/shared/ui';

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

// The first tab is the default and has no ?tab= parameter. Unknown values
// (including the old ?tab=general) fall back to it.
const TABS = [
  { key: 'scheduler', label: 'Scheduler' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'retention', label: 'Data retention' },
  { key: 'users', label: 'Users', adminOnly: true },
  { key: 'security', label: 'Password' },
];
const DEFAULT_TAB = TABS[0].key;

const labelClass = 'block text-sm font-medium text-ink mb-1.5';
const helpClass = 'mt-1.5 text-xs text-ink-2';
const narrowInput = inputClass.replace('w-full', '');

/* ---------- Local building blocks ---------- */

function useWideScreen(query = '(min-width: 1024px)') {
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia?.(query).matches);
  useEffect(() => {
    const media = window.matchMedia?.(query);
    if (!media) return undefined;
    const onChange = () => setWide(media.matches);
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [query]);
  return wide;
}

function FormSkeleton() {
  return (
    <div className="space-y-6 max-w-2xl" aria-busy="true">
      {[0, 1].map((group) => (
        <div key={group} className="space-y-3">
          <SkeletonLine className="h-4 w-40" />
          <SkeletonLine className="h-px w-full" />
          <SkeletonLine className="h-3 w-24" />
          <SkeletonLine className="h-9 w-full max-w-sm" />
          <SkeletonLine className="h-3 w-64" />
        </div>
      ))}
    </div>
  );
}

/** Save row at the bottom of a settings form: the form's one primary action. */
function FormFooter({ children }) {
  return <div className="flex flex-wrap items-center gap-2 pt-1">{children}</div>;
}

function SaveButton({ saving, label = 'Save changes', disabled }) {
  return (
    <button type="submit" className={primaryButtonClass} disabled={saving || disabled}>
      {saving && <Spinner />} {saving ? 'Saving' : label}
    </button>
  );
}

function Switch({ checked, onChange, labelledBy, describedBy, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${checked ? 'bg-accent' : 'bg-rule-strong'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-paper ring-1 ring-ink/10 transition-transform ${checked ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
    </button>
  );
}

function SwitchRow({ title, description, checked, onChange, disabled }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-rule last:border-b-0">
      <div className="min-w-0">
        <p id={id} className="text-sm font-medium text-ink">{title}</p>
        {description && <p id={`${id}-help`} className="text-xs text-ink-2 mt-0.5">{description}</p>}
      </div>
      <Switch checked={checked} onChange={onChange} labelledBy={id} describedBy={description ? `${id}-help` : undefined} disabled={disabled} />
    </div>
  );
}

/* ---------- Scheduler and data retention (one settings object, two tabs) ---------- */
function SchedulerSettingsTab({ isAdmin, view }) {
  const id = useId();
  const [settings, setSettings] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSchedulerSettings().then(setSettings).catch(() => setLoadError(true));
  }, []);

  if (loadError) return <Alert tone="error" className="max-w-2xl">Could not load settings. Reload the page to try again.</Alert>;
  if (!settings) return <FormSkeleton />;

  const update = (patch) => setSettings((s) => ({ ...s, ...patch }));
  const save = async (event) => {
    event.preventDefault();
    if (!isAdmin || saving) return;
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
    <form onSubmit={save} noValidate className="space-y-6 max-w-2xl">
      {!isAdmin && <Alert tone="info">Only admins can change these settings.</Alert>}

      {view === 'scheduler' && (
        <Section title="Scheduled monitoring" id={`${id}-scheduler`}>
          <p className="text-xs text-ink-2 -mt-1 mb-2">Re-checks every asset that has scheduled monitoring turned on.</p>
          <SwitchRow
            title="Run the scheduler"
            description="When off, assets are only checked when you add them or select Re-check."
            checked={settings.scheduler_enabled}
            onChange={(value) => update({ scheduler_enabled: value })}
            disabled={!isAdmin}
          />

          {settings.scheduler_enabled && (
            <fieldset className="mt-4" disabled={!isAdmin} aria-describedby={`${id}-interval-help`}>
              <legend className={labelClass}>Default check interval</legend>
              <div>
                <div className="flex flex-wrap gap-1.5">
                  {INTERVAL_PRESETS.map((preset) => {
                    const on = settings.scheduler_interval_minutes === preset.value;
                    return (
                      <button
                        key={preset.value}
                        type="button"
                        aria-pressed={on}
                        onClick={() => update({ scheduler_interval_minutes: preset.value })}
                        className={`h-8 px-3 rounded-md border text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          on
                            ? 'border-accent bg-accent-soft text-ink font-semibold'
                            : 'border-rule-strong bg-paper text-ink-2 hover:text-ink hover:bg-sunk'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
                <p id={`${id}-interval-help`} className={helpClass}>
                  Used for assets without their own interval. Set a per-asset interval from the asset&apos;s Edit dialog.
                </p>
              </div>
              <div className="mt-4">
                <label htmlFor={`${id}-custom`} className={labelClass}>Custom interval</label>
                <div className="flex items-center gap-2">
                  <input
                    id={`${id}-custom`}
                    type="number"
                    min="1"
                    max="10080"
                    value={settings.scheduler_interval_minutes}
                    onChange={(e) => update({ scheduler_interval_minutes: Math.min(10080, Math.max(1, parseInt(e.target.value, 10) || 1)) })}
                    className={`${narrowInput} w-28 tabular-nums`}
                    aria-describedby={`${id}-custom-help`}
                  />
                  <span className="text-sm text-ink-2">minutes</span>
                </div>
                <p id={`${id}-custom-help`} className={helpClass}>Any value from 1 minute to 7 days (10080 minutes).</p>
              </div>
            </fieldset>
          )}
        </Section>
      )}

      {view === 'retention' && (
        <Section title="Data retention" id={`${id}-retention-title`}>
          <label htmlFor={`${id}-retention`} className={labelClass}>Keep history for</label>
          <select
            id={`${id}-retention`}
            value={settings.history_retention_days}
            disabled={!isAdmin}
            onChange={(e) => update({ history_retention_days: Number(e.target.value) })}
            className={`${selectClass.replace('w-full', '')} w-56`}
            aria-describedby={`${id}-retention-help`}
          >
            {RETENTION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <p id={`${id}-retention-help`} className={helpClass}>
            Older check results and activity are deleted automatically. Each asset&apos;s latest result is always kept.
          </p>
        </Section>
      )}

      {isAdmin && <FormFooter><SaveButton saving={saving} /></FormFooter>}
    </form>
  );
}

/* ---------- Notifications ---------- */
function ChannelState({ ok }) {
  if (ok) return <SeverityBadge severity="ok" label="Configured" />;
  return (
    <span className="inline-flex rounded px-1.5 py-0.5 text-xs font-semibold bg-sunk text-ink-2 ring-1 ring-inset ring-rule">
      Not configured
    </span>
  );
}

// Mirrors deliverable_address() in the backend: these domains never receive mail.
const UNDELIVERABLE_DOMAIN = /\.(local|localhost|invalid|test)$/i;
const isDeliverable = (email) => {
  const domain = (email || '').split('@')[1] || '';
  return domain.includes('.') && !UNDELIVERABLE_DOMAIN.test(domain);
};

/** Every user's own alert address: alerts for the assets they own go here. */
function AlertEmailSection() {
  const id = useId();
  const me = useCurrentUser();
  const [saved, setSaved] = useState(null);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (me && saved === null) {
      setSaved(me.email);
      setValue(me.email);
    }
  }, [me, saved]);

  if (saved === null) return <FormSkeleton />;

  const dirty = value.trim() !== saved;
  const onSubmit = async (event) => {
    event.preventDefault();
    if (!dirty || saving) return;
    setSaving(true);
    setError('');
    try {
      const user = await updateMe({ email: value.trim() });
      invalidateCurrentUser();
      setSaved(user.email);
      setValue(user.email);
      toast.success('Alert email saved');
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Enter a full email address, like you@example.com.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section title="Your alert email" id={`${id}-me`}>
      <form onSubmit={onSubmit} noValidate>
        {!isDeliverable(saved) && (
          <Alert tone="warning" className="mb-4">
            Alerts for your assets go to <span className="font-mono">{saved}</span>, which can&apos;t receive mail. Enter your real address below.
          </Alert>
        )}
        <label htmlFor={`${id}-email`} className={labelClass}>Email address</label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            id={`${id}-email`}
            type="email"
            autoComplete="email"
            spellCheck="false"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className={`${inputClass} sm:flex-1`}
            aria-describedby={`${id}-email-help`}
            aria-invalid={error ? 'true' : undefined}
          />
          <button type="submit" disabled={!dirty || saving} className={primaryButtonClass}>
            {saving && <Spinner />} Save email
          </button>
        </div>
        {error
          ? <p role="alert" className="mt-1.5 text-xs text-s5">{error}</p>
          : <p id={`${id}-email-help`} className={helpClass}>Alerts for the assets you own are sent here.</p>}
      </form>
    </Section>
  );
}

function NotificationsTab({ isAdmin }) {
  const id = useId();
  const [form, setForm] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [savedWebhook, setSavedWebhook] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const applySaved = useCallback((data) => {
    setForm(data);
    setSavedWebhook(data.webhook_url || '');
  }, []);

  useEffect(() => {
    getNotificationSettings().then(applySaved).catch(() => setLoadError(true));
  }, [applySaved]);

  if (loadError) return <Alert tone="error" className="max-w-2xl">Could not load notification settings. Reload the page to try again.</Alert>;
  if (!form) return <FormSkeleton />;

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
  const onSubmit = (event) => {
    event.preventDefault();
    if (!isAdmin || saving) return;
    save();
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
    <div className="space-y-6 max-w-2xl">
      <AlertEmailSection />
      <form onSubmit={onSubmit} noValidate className="space-y-6">
        {!isAdmin && <Alert tone="info">Only admins can change notification settings.</Alert>}

        <Section title="Channels" id={`${id}-channels`}>
          <p className="text-xs text-ink-2 -mt-1 mb-3">
            Alerts go to the asset owner&apos;s email address and to the webhook. Each asset also needs alerts turned on.
          </p>
          <Fields className="gap-y-2.5">
            <Field name="Email">
              <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <ChannelState ok={form.email_configured} />
                <span className="text-xs text-ink-2">
                  {form.email_configured
                    ? <>Sent from <span className="font-mono">{form.smtp_from}</span>.</>
                    : <>Set <span className="font-mono">SMTP_HOST</span> and <span className="font-mono">SMTP_FROM_EMAIL</span> in the server environment.</>}
                </span>
              </span>
            </Field>
            <Field name="Webhook">
              <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <ChannelState ok={form.webhook_configured} />
                <span className="text-xs text-ink-2">{webhookDetail}</span>
              </span>
            </Field>
          </Fields>

          <div className="mt-5">
            <label htmlFor={`${id}-webhook`} className={labelClass}>Webhook URL</label>
            <input
              id={`${id}-webhook`}
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck="false"
              placeholder="https://hooks.slack.com/services/…"
              value={form.webhook_url || ''}
              onChange={(e) => update({ webhook_url: e.target.value })}
              disabled={!isAdmin}
              className={`${inputClass} font-mono`}
              aria-describedby={`${id}-webhook-help`}
            />
            <p id={`${id}-webhook-help`} className={helpClass}>Slack and Discord URLs receive a chat message. Any other URL receives a JSON payload.</p>
          </div>

          {isAdmin && (
            <div className="mt-3">
              <button type="button" onClick={test} disabled={testing || saving} className={secondaryButtonClass}>
                {testing && <Spinner />} {webhookDirty ? 'Save and send test' : 'Send test notification'}
              </button>
            </div>
          )}
          {testResult && (
            <div aria-live="polite" className="mt-3">
              <Fields>
                {Object.entries(testResult).map(([channel, outcome]) => (
                  <Field key={channel} name={channel.charAt(0).toUpperCase() + channel.slice(1)}>
                    <span className="inline-flex flex-wrap items-baseline gap-x-2">
                      <SeverityCode severity={outcome.status === 'sent' ? 'success' : 'warning'} />
                      <span>{outcome.status.replace('_', ' ')}</span>
                      {outcome.detail && <span className="text-xs text-ink-2 break-words">{outcome.detail}</span>}
                    </span>
                  </Field>
                ))}
              </Fields>
            </div>
          )}
        </Section>

        <Section title="What to alert on" id={`${id}-events`}>
          <p className="text-xs text-ink-2 -mt-1 mb-2">
            Changes are always recorded on the Activity page; these settings decide which ones also send an alert.
          </p>
          <div>
            <SwitchRow title="Newly listed on a blacklist" description="Always on for assets with alerts enabled." checked onChange={() => {}} disabled />
            <SwitchRow title="Removed from all blacklists" checked={form.notify_on_delisted} onChange={(v) => update({ notify_on_delisted: v })} disabled={!isAdmin} />
            <SwitchRow title="Server down and recovered" description="Needs the Server status check on the asset." checked={form.notify_on_server_down} onChange={(v) => update({ notify_on_server_down: v })} disabled={!isAdmin} />
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={`${id}-ssl`} className={labelClass}>SSL certificate expiry warning</label>
              <select id={`${id}-ssl`} value={form.ssl_expiry_warning_days} disabled={!isAdmin} onChange={(e) => update({ ssl_expiry_warning_days: Number(e.target.value) })} className={selectClass}>
                {[0, 7, 14, 21, 30].map((d) => <option key={d} value={d}>{d ? `${d} days before` : 'Off'}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor={`${id}-domain`} className={labelClass}>Domain expiry warning</label>
              <select id={`${id}-domain`} value={form.domain_expiry_warning_days} disabled={!isAdmin} onChange={(e) => update({ domain_expiry_warning_days: Number(e.target.value) })} className={selectClass}>
                {[0, 14, 30, 60, 90].map((d) => <option key={d} value={d}>{d ? `${d} days before` : 'Off'}</option>)}
              </select>
            </div>
          </div>
        </Section>

        {isAdmin && <FormFooter><SaveButton saving={saving} /></FormFooter>}
      </form>
    </div>
  );
}

/* ---------- Password ---------- */
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
    <form onSubmit={handleSubmit} noValidate className="space-y-6 max-w-2xl">
      {me?.using_default_password && (
        <Alert tone="warning">This account still uses the default password from the installation guide. Anyone who has read the README can sign in.</Alert>
      )}
      <Section title="Change password" id={`${id}-title`}>
        <p className="text-xs text-ink-2 -mt-1 mb-3">Changing your password signs out every other session.</p>
        <div className="space-y-4 max-w-sm">
          <div>
            <label htmlFor={`${id}-current`} className={labelClass}>Current password</label>
            <input id={`${id}-current`} type="password" autoComplete="current-password" value={form.current} onChange={update('current')} className={inputClass} required />
          </div>
          <div>
            <label htmlFor={`${id}-next`} className={labelClass}>New password</label>
            <input id={`${id}-next`} type="password" autoComplete="new-password" minLength={8} value={form.next} onChange={update('next')} className={inputClass} aria-invalid={Boolean(tooShort)} aria-describedby={`${id}-next-hint`} required />
            <p id={`${id}-next-hint`} className={`mt-1.5 text-xs ${tooShort ? 'text-s5' : 'text-ink-2'}`}>At least 8 characters.</p>
          </div>
          <div>
            <label htmlFor={`${id}-confirm`} className={labelClass}>Confirm new password</label>
            <input id={`${id}-confirm`} type="password" autoComplete="new-password" value={form.confirm} onChange={update('confirm')} className={inputClass} aria-invalid={Boolean(mismatch)} aria-describedby={mismatch ? `${id}-confirm-error` : undefined} required />
            {mismatch && <p id={`${id}-confirm-error`} className="mt-1.5 text-xs text-s5">Passwords don&apos;t match.</p>}
          </div>
        </div>
      </Section>
      {error && <Alert tone="error">{error}</Alert>}
      <FormFooter>
        <SaveButton saving={saving} label="Change password" disabled={!form.current || !form.next || mismatch || tooShort || form.next !== form.confirm} />
      </FormFooter>
    </form>
  );
}

export default function Settings() {
  const me = useCurrentUser();
  const isAdmin = Boolean(me?.is_superuser);
  const wide = useWideScreen();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabs = TABS.filter((tab) => !tab.adminOnly || isAdmin);
  const requested = searchParams.get('tab');
  const active = tabs.some((tab) => tab.key === requested) ? requested : DEFAULT_TAB;
  const select = useCallback((key) => setSearchParams(key === DEFAULT_TAB ? {} : { tab: key }, { replace: true }), [setSearchParams]);

  // Arrow keys move between tabs in either orientation; Home/End jump to the ends.
  const onKeyDown = (event) => {
    const index = tabs.findIndex((tab) => tab.key === active);
    const next = {
      ArrowRight: index + 1, ArrowDown: index + 1, ArrowLeft: index - 1, ArrowUp: index - 1, Home: 0, End: tabs.length - 1,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    const tab = tabs[(next + tabs.length) % tabs.length];
    select(tab.key);
    document.getElementById(`settings-tab-${tab.key}`)?.focus();
  };

  return (
    <section className="space-y-6">
      <PageHeader title="Settings" description={me ? `Signed in as ${me.username}${isAdmin ? ' (admin)' : ''}.` : undefined} />

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">
        <div
          role="tablist"
          aria-label="Settings sections"
          aria-orientation={wide ? 'vertical' : 'horizontal'}
          onKeyDown={onKeyDown}
          className="flex gap-px overflow-x-auto rounded-xl border border-rule/80 bg-paper shadow-e1 p-1 lg:flex-col lg:w-52 lg:flex-shrink-0 lg:sticky lg:top-20"
        >
          {tabs.map((tab) => {
            const on = active === tab.key;
            return (
              <button
                key={tab.key}
                id={`settings-tab-${tab.key}`}
                type="button"
                role="tab"
                aria-selected={on}
                aria-controls="settings-panel"
                tabIndex={on ? 0 : -1}
                onClick={() => select(tab.key)}
                className={`flex items-center h-8 px-2.5 rounded-md text-sm whitespace-nowrap text-left transition-colors ${
                  on
                    ? 'bg-paper text-ink font-semibold ring-1 ring-rule shadow-[0_1px_2px_rgb(20_23_28/0.06)]'
                    : 'text-ink-2 hover:text-ink hover:bg-paper/70'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div id="settings-panel" role="tabpanel" aria-labelledby={`settings-tab-${active}`} className="min-w-0 flex-1 max-w-3xl">
          {active === 'scheduler' && <SchedulerSettingsTab key="scheduler" isAdmin={isAdmin} view="scheduler" />}
          {active === 'notifications' && <NotificationsTab isAdmin={isAdmin} />}
          {active === 'retention' && <SchedulerSettingsTab key="retention" isAdmin={isAdmin} view="retention" />}
          {active === 'security' && <SecurityTab me={me} />}
          {active === 'users' && isAdmin && <UsersPanel currentUserId={me?.id} />}
        </div>
      </div>
    </section>
  );
}

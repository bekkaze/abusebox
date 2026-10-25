import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { HiOutlinePlay, HiOutlineServerStack } from "react-icons/hi2";
import HistoryChart from "../../components/dashboard/home/HistoryChart";
import { SkeletonLine } from "../../components/shared/Skeleton";
import AutoRefresh from "../../components/shared/AutoRefresh";
import TimeAgo from "../../components/shared/TimeAgo";
import { EventList, IssueRow } from "../../components/shared/activity";
import { groupIssuesByAsset } from "../../components/shared/severity";
import { Alert, EmptyState, Field, Fields, Section, Spinner, linkClass, primaryButtonClass, secondaryButtonClass } from "../../components/shared/ui";
import HostnameService from "../../services/hostname";
import { listEvents } from "../../services/events";
import { getSchedulerStatus, runSchedulerNow } from "../../services/settings";
import { useAuth } from "../../services/auth/authProvider";
import useCurrentUser from "../../services/users/useCurrentUser";

const DEFAULT_FAVICON = "/logo.png";
const ALERT_FAVICON = "/favicon-alert.svg";
const ATTENTION_LIMIT = 8;

function formatInterval(minutes) {
  if (!minutes) return "—";
  if (minutes % 1440 === 0) return `${minutes / 1440} day${minutes === 1440 ? "" : "s"}`;
  if (minutes % 60 === 0) return `${minutes / 60} h`;
  return `${minutes} min`;
}

const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** The page's one-line verdict, written like an SMTP reply: class code, then meaning. */
function StatusLine({ assets, attention }) {
  const critical = attention.filter((group) => group.issues[0].severity === "critical").length;
  const warning = attention.filter((group) => group.issues[0].severity === "warning").length;
  const status = critical
    ? { code: "5.x", tone: "text-s5", text: `${plural(critical, "asset")} need${critical === 1 ? "s" : ""} action` }
    : warning
      ? { code: "4.x", tone: "text-s4", text: `${plural(warning, "asset")} with warnings` }
      : { code: "2.x", tone: "text-s2", text: assets.length === 1 ? "Your asset is clear" : `All ${assets.length} assets are clear` };
  // The headline names the worst class; the rest of the attention list is counted beside it.
  const rest = attention.length - (critical || warning);
  return (
    <h1 className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span className={`font-mono text-[1.75rem] leading-none font-semibold ${status.tone}`}>{status.code}</span>
      <span className="text-2xl font-semibold tracking-tight text-ink">{status.text}</span>
      {(critical || warning) > 0 && rest > 0 && (
        <span className="text-base font-normal text-ink-2">+ {rest} more to review</span>
      )}
    </h1>
  );
}

function Summary({ assets, listed, monitored, scheduler }) {
  const items = [
    ["Assets", assets.length],
    ["Listed", listed],
    ["Monitored", `${monitored} of ${assets.length}`],
    ["Last-Run", scheduler?.last_cycle_finished ? <TimeAgo date={scheduler.last_cycle_finished} /> : "not yet"],
  ];
  return (
    <p className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
      {items.map(([name, value]) => (
        <span key={name} className="whitespace-nowrap">
          <span className="font-mono text-xs text-ink-2">{name}:</span> <span className="text-ink tabular-nums">{value}</span>
        </span>
      ))}
    </p>
  );
}

function Scheduler({ status, isAdmin, onRun, running }) {
  if (!status) {
    return (
      <div className="space-y-2" aria-busy="true">
        {[...Array(4)].map((_, i) => <SkeletonLine key={i} className="h-4" />)}
      </div>
    );
  }
  const healthy = status.enabled && status.running && !status.last_error;
  const state = !status.enabled ? "Off" : status.cycle_in_progress ? "Checking assets now" : status.running ? "Running" : "Enabled, not running";
  return (
    <>
      <Fields>
        <Field name="Status">
          <span className="inline-flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${healthy ? "bg-s2" : status.enabled ? "bg-s4" : "bg-ink-3"}`} aria-hidden="true" />
            {state}
          </span>
        </Field>
        <Field name="Interval">{formatInterval(status.interval_minutes)}</Field>
        <Field name="Monitored"><span className="tabular-nums">{status.monitored_assets}</span></Field>
        <Field name="Due-Now"><span className="tabular-nums">{status.due_assets}</span></Field>
      </Fields>
      {status.last_error && <p className="mt-3 text-xs text-s5">Last run failed: {status.last_error}</p>}
      {!status.enabled && (
        <p className="mt-3 text-xs text-ink-2">
          Assets are only checked when added or re-checked. <Link to="/dashboard/settings" className={linkClass}>Turn it on in Settings</Link>.
        </p>
      )}
      {isAdmin && status.enabled && (
        <button type="button" onClick={onRun} disabled={running || status.cycle_in_progress || status.due_assets === 0} className={`${secondaryButtonClass} mt-4 w-full`}>
          {running || status.cycle_in_progress ? <Spinner /> : <HiOutlinePlay aria-hidden="true" />}
          {status.due_assets === 0 ? "Nothing due" : `Check ${plural(status.due_assets, "due asset")} now`}
        </button>
      )}
    </>
  );
}

export default function Home() {
  const { token } = useAuth();
  const me = useCurrentUser();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [assets, setAssets] = useState([]);
  const [events, setEvents] = useState([]);
  const [scheduler, setScheduler] = useState(null);
  const [runningCycle, setRunningCycle] = useState(false);

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (quiet) setRefreshing(true);
    try {
      setError("");
      const [list, feed, status] = await Promise.all([
        HostnameService().listHostname(false),
        listEvents({ limit: 8 }).catch(() => []),
        getSchedulerStatus().catch(() => null),
      ]);
      setAssets(list);
      setEvents(feed);
      setScheduler(status);
    } catch {
      setError("Could not load dashboard data. Check your connection and try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { if (token) load(); }, [token, load]);
  const refresh = useCallback(() => load({ quiet: true }), [load]);

  const listed = assets.filter((item) => item.is_blacklisted);
  const attention = groupIssuesByAsset(assets);
  const monitored = assets.filter((item) => item.is_monitor_enabled).length;

  // Red badge on the tab icon while anything is listed.
  useEffect(() => {
    const link = document.querySelector("link[rel~='icon']");
    if (!link) return undefined;
    link.href = listed.length > 0 ? ALERT_FAVICON : DEFAULT_FAVICON;
    return () => { link.href = DEFAULT_FAVICON; };
  }, [listed.length]);

  const runNow = async () => {
    setRunningCycle(true);
    try {
      await runSchedulerNow();
      toast.info("Checking due assets in the background. Results appear here as they finish.");
      setTimeout(refresh, 4000);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Could not start a check run.");
    } finally {
      setRunningCycle(false);
    }
  };

  const chartAssets = (listed.length ? listed : assets.filter((asset) => asset.check_blacklist)).slice(0, 2);

  if (error) {
    return (
      <Alert tone="error">
        {error}{" "}
        <button type="button" className="font-semibold underline" onClick={() => load()}>Retry</button>
      </Alert>
    );
  }

  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading dashboard">
        <SkeletonLine className="h-8 w-80" />
        <SkeletonLine className="h-4 w-96" />
        <div className="pt-6 space-y-3">{[...Array(5)].map((_, i) => <SkeletonLine key={i} className="h-10" />)}</div>
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <EmptyState
        icon={HiOutlineServerStack}
        title="Nothing to monitor yet"
        action={<Link to="/dashboard/assets" className={primaryButtonClass}>Add an asset</Link>}
      >
        Add the domains and mail server IPs you look after. AbuseBox checks them on a schedule and lists anything that needs action here.
      </EmptyState>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-rule">
        <div className="min-w-0">
          <StatusLine assets={assets} attention={attention} />
          <Summary assets={assets} listed={listed.length} monitored={monitored} scheduler={scheduler} />
        </div>
        <AutoRefresh onRefresh={refresh} loading={refreshing} />
      </div>

      <div className="mt-6 grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="space-y-8 min-w-0">
          <Section
            title={attention.length ? `Needs attention (${attention.length})` : "Needs attention"}
            action={attention.length > ATTENTION_LIMIT && (
              <Link to="/dashboard/assets?filter=attention" className={`text-sm ${linkClass}`}>All {attention.length}</Link>
            )}
          >
            {attention.length === 0 ? (
              <p className="py-2 text-sm text-ink-2">Nothing is listed, expiring or down. AbuseBox keeps checking on schedule.</p>
            ) : (
              <ul>
                {attention.slice(0, ATTENTION_LIMIT).map((group) => (
                  <IssueRow key={group.hostnameId} issues={group.issues} hostname={group.hostname} hostnameId={group.hostnameId} />
                ))}
              </ul>
            )}
          </Section>

          <Section title="Recent activity" action={<Link to="/dashboard/activity" className={`text-sm ${linkClass}`}>View all</Link>}>
            <EventList events={events} emptyText="No changes detected yet. Listings, recoveries and expiry warnings will show up here." />
          </Section>
        </div>

        <aside className="space-y-8 min-w-0">
          <Section title="Scheduler">
            <Scheduler status={scheduler} isAdmin={Boolean(me?.is_superuser)} onRun={runNow} running={runningCycle} />
          </Section>
          {chartAssets.length > 0 && (
            <Section title="Blacklist history">
              <div className="space-y-6">
                {chartAssets.map((asset) => (
                  <HistoryChart key={asset.id} hostnameId={asset.id} hostname={asset.hostname} />
                ))}
              </div>
            </Section>
          )}
        </aside>
      </div>
    </div>
  );
}

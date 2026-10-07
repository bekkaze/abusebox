import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { HiDesktopComputer, HiExclamationCircle, HiPlay, HiShieldCheck, HiShieldExclamation, HiCheckCircle } from "react-icons/hi";
import StatGrid from "../../components/dashboard/home/StatGrid";
import HistoryChart from "../../components/dashboard/home/HistoryChart";
import { StatSkeleton } from "../../components/shared/Skeleton";
import AutoRefresh from "../../components/shared/AutoRefresh";
import TimeAgo from "../../components/shared/TimeAgo";
import { EventList, IssueRow } from "../../components/shared/activity";
import { groupIssuesByAsset } from "../../components/shared/severity";
import { Alert, EmptyState, PageHeader, Spinner, cardClass, primaryButtonClass, secondaryButtonClass } from "../../components/shared/ui";
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

function Card({ title, action, children, className = "" }) {
  return (
    <section className={`${cardClass} p-5 ${className}`}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function SchedulerCard({ status, isAdmin, onRun, running }) {
  if (!status) return <div className={`${cardClass} p-5 h-full animate-pulse`} aria-busy="true" />;
  const healthy = status.enabled && status.running && !status.last_error;
  return (
    <Card title="Scheduler" className="h-full">
      <div className="flex items-center gap-2 mb-4">
        <span className={`h-2.5 w-2.5 rounded-full ${healthy ? "bg-emerald-500" : status.enabled ? "bg-amber-500" : "bg-slate-400"}`} aria-hidden="true" />
        <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
          {!status.enabled ? "Off" : status.cycle_in_progress ? "Checking assets now" : status.running ? "Running" : "Enabled, not running"}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div>
          <dt className="text-xs text-slate-500 dark:text-slate-400">Default interval</dt>
          <dd className="font-medium text-slate-800 dark:text-slate-100">{formatInterval(status.interval_minutes)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500 dark:text-slate-400">Monitored</dt>
          <dd className="font-medium text-slate-800 dark:text-slate-100 tabular-nums">{status.monitored_assets}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500 dark:text-slate-400">Last run</dt>
          <dd className="font-medium text-slate-800 dark:text-slate-100">
            {status.last_cycle_finished ? <TimeAgo date={status.last_cycle_finished} /> : "Not yet"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500 dark:text-slate-400">Due now</dt>
          <dd className="font-medium text-slate-800 dark:text-slate-100 tabular-nums">{status.due_assets}</dd>
        </div>
      </dl>
      {status.last_error && <p className="mt-3 text-xs text-rose-600 dark:text-rose-400">Last run failed: {status.last_error}</p>}
      {!status.enabled && (
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Assets are only checked when added or re-checked. <Link to="/dashboard/settings" className="text-cyan-700 dark:text-cyan-400 hover:underline">Turn it on in Settings</Link>.
        </p>
      )}
      {isAdmin && status.enabled && (
        <button type="button" onClick={onRun} disabled={running || status.cycle_in_progress || status.due_assets === 0} className={`${secondaryButtonClass} mt-4 w-full`}>
          {running || status.cycle_in_progress ? <Spinner /> : <HiPlay aria-hidden="true" />}
          {status.due_assets === 0 ? "Nothing due" : `Check ${status.due_assets} due asset${status.due_assets === 1 ? "" : "s"} now`}
        </button>
      )}
    </Card>
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
  const urgentAssets = attention.filter((group) => group.issues.some((issue) => issue.severity !== "info")).length;
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

  return (
    <section className="space-y-5">
      <PageHeader
        eyebrow="Overview"
        title="Monitoring summary"
        description="What needs your attention across every monitored domain and IP."
        actions={<AutoRefresh onRefresh={refresh} loading={refreshing} />}
      />

      {error ? (
        <Alert tone="error">
          {error}{" "}
          <button type="button" className="font-medium underline" onClick={() => load()}>Retry</button>
        </Alert>
      ) : loading ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4" aria-busy="true">
          {[...Array(4)].map((_, i) => <StatSkeleton key={i} />)}
        </div>
      ) : assets.length === 0 ? (
        <div className={cardClass}>
          <EmptyState
            icon={HiShieldCheck}
            title="Nothing to monitor yet"
            action={<Link to="/dashboard/assets" className={primaryButtonClass}>Add an asset</Link>}
          >
            Add the domains and mail server IPs you care about. AbuseBox checks them on a schedule and lists anything that needs attention here.
          </EmptyState>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:gap-4 grid-cols-2 xl:grid-cols-4">
            <StatGrid title="Assets" bodyText={assets.length} icon={<HiDesktopComputer />} tone="sky" />
            <StatGrid title="Currently listed" bodyText={listed.length} icon={<HiShieldExclamation />} tone="rose" />
            <StatGrid title="Need attention" bodyText={urgentAssets} icon={<HiExclamationCircle />} tone="amber" />
            <StatGrid title="Monitored" bodyText={`${monitored} of ${assets.length}`} icon={<HiShieldCheck />} tone="emerald" />
          </div>

          <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
            <Card
              title="Needs attention"
              className="lg:col-span-2"
              action={attention.length > ATTENTION_LIMIT && (
                <Link to="/dashboard/assets?filter=attention" className="text-sm font-medium text-cyan-700 dark:text-cyan-400 hover:underline">
                  All {attention.length}
                </Link>
              )}
            >
              {attention.length === 0 ? (
                <div className="flex items-center gap-3 py-6 text-emerald-700 dark:text-emerald-400">
                  <HiCheckCircle className="text-2xl" aria-hidden="true" />
                  <p className="text-sm font-medium">All clear. Nothing is listed, expiring or down.</p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                  {attention.slice(0, ATTENTION_LIMIT).map((group) => (
                    <IssueRow key={group.hostnameId} issues={group.issues} hostname={group.hostname} hostnameId={group.hostnameId} />
                  ))}
                </ul>
              )}
            </Card>

            <SchedulerCard status={scheduler} isAdmin={Boolean(me?.is_superuser)} onRun={runNow} running={runningCycle} />
          </div>

          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
            <Card
              title="Recent activity"
              action={<Link to="/dashboard/activity" className="text-sm font-medium text-cyan-700 dark:text-cyan-400 hover:underline">View all</Link>}
            >
              <EventList events={events} emptyText="No changes detected yet. Listings, recoveries and expiry warnings will show up here." />
            </Card>
            <div className="space-y-4">
              {chartAssets.map((asset) => (
                <HistoryChart key={asset.id} hostnameId={asset.id} hostname={asset.hostname} />
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

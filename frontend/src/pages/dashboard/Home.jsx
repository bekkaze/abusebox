import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { HiBell, HiDesktopComputer, HiShieldCheck, HiExclamationCircle } from "react-icons/hi";
import StatGrid from "../../components/dashboard/home/StatGrid";
import HistoryChart from "../../components/dashboard/home/HistoryChart";
import { StatSkeleton } from "../../components/shared/Skeleton";
import AutoRefresh from "../../components/shared/AutoRefresh";
import { Alert, EmptyState, PageHeader, cardClass, primaryButtonClass } from "../../components/shared/ui";
import HostnameService from "../../services/hostname";
import { useAuth } from "../../services/auth/authProvider";

const DEFAULT_FAVICON = "/logo.png";
const ALERT_FAVICON = "/favicon-alert.svg";

export default function Home() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [hostnames, setHostnames] = useState([]);

  const loadStats = useCallback(async ({ quiet = false } = {}) => {
    if (quiet) setRefreshing(true);
    try {
      setError("");
      setHostnames(await HostnameService().listHostname());
    } catch {
      setError("Could not load dashboard data. Check your connection and try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (token) loadStats();
  }, [token, loadStats]);

  const refresh = useCallback(() => loadStats({ quiet: true }), [loadStats]);

  const stats = {
    total: hostnames.length,
    monitoringEnabled: hostnames.filter((item) => item.is_monitor_enabled).length,
    alertEnabled: hostnames.filter((item) => item.is_alert_enabled).length,
    blacklisted: hostnames.filter((item) => item.is_blacklisted).length,
  };

  // Red badge on the tab icon while anything is listed.
  useEffect(() => {
    const link = document.querySelector("link[rel~='icon']");
    if (!link) return undefined;
    link.href = stats.blacklisted > 0 ? ALERT_FAVICON : DEFAULT_FAVICON;
    return () => { link.href = DEFAULT_FAVICON; };
  }, [stats.blacklisted]);

  // Show listed assets first in the history charts.
  const chartAssets = [...hostnames].sort((a, b) => Number(b.is_blacklisted) - Number(a.is_blacklisted)).slice(0, 4);

  return (
    <section className="space-y-5">
      <PageHeader
        eyebrow="Overview"
        title="Monitoring summary"
        description="Track your monitored assets and prioritize blacklist incidents."
        actions={<AutoRefresh onRefresh={refresh} loading={refreshing} />}
      />

      {error ? (
        <Alert tone="error">
          {error}{' '}
          <button type="button" className="font-medium underline" onClick={() => loadStats()}>Retry</button>
        </Alert>
      ) : loading ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4" aria-busy="true">
          {[...Array(4)].map((_, i) => <StatSkeleton key={i} />)}
        </div>
      ) : hostnames.length === 0 ? (
        <div className={cardClass}>
          <EmptyState
            icon={HiShieldCheck}
            title="Nothing to monitor yet"
            action={<Link to="/dashboard/assets" className={primaryButtonClass}>Add an asset</Link>}
          >
            Add the domains and mail server IPs you care about. They show up here with their blacklist history.
          </EmptyState>
        </div>
      ) : (
        <>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
            <StatGrid title="Assets" bodyText={stats.total} icon={<HiDesktopComputer />} tone="sky" />
            <StatGrid title="Monitored" bodyText={stats.monitoringEnabled} icon={<HiShieldCheck />} tone="emerald" />
            <StatGrid title="Alerts on" bodyText={stats.alertEnabled} icon={<HiBell />} tone="amber" />
            <StatGrid title="Currently listed" bodyText={stats.blacklisted} icon={<HiExclamationCircle />} tone="rose" />
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Blacklist history</h2>
            <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
              {chartAssets.map((h) => (
                <HistoryChart key={h.id} hostnameId={h.id} hostname={h.hostname} />
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

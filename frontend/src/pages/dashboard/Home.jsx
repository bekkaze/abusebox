import React, { useEffect, useState } from "react";
import { HiBell, HiDesktopComputer, HiShieldCheck, HiExclamationCircle } from "react-icons/hi";
import StatGrid from "../../components/dashboard/home/StatGrid";
import HistoryChart from "../../components/dashboard/home/HistoryChart";
import HostnameService from "../../services/hostname";
import { useAuth } from "../../services/auth/authProvider";

export default function Home() {
  const { token } = useAuth();
  const hostnameService = HostnameService();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hostnames, setHostnames] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    monitoringEnabled: 0,
    alertEnabled: 0,
    blacklisted: 0,
  });

  useEffect(() => {
    const loadStats = async () => {
      try {
        setError("");
        const list = await hostnameService.listHostname();
        setHostnames(list);
        setStats({
          total: list.length,
          monitoringEnabled: list.filter((item) => item.is_monitor_enabled).length,
          alertEnabled: list.filter((item) => item.is_alert_enabled).length,
          blacklisted: list.filter((item) => item.result?.is_blacklisted).length,
        });
      } catch (error) {
        setError("Failed to load dashboard stats. Please check your connection.");
        console.error("Failed to load dashboard stats", error);
      } finally {
        setLoading(false);
      }
    };

    if (token) loadStats();
  }, [token]);

  return (
    <section className="space-y-5">
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm">
        <p className="text-sm text-slate-500 dark:text-slate-400">Overview</p>
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mt-1">Monitoring Summary</h2>
        <p className="text-slate-600 dark:text-slate-300 mt-2 text-sm">Track your monitored assets and prioritize blacklist incidents.</p>
      </div>

      {error ? (
        <div className="bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 rounded-xl p-4 text-sm text-rose-700 dark:text-rose-300">{error}</div>
      ) : loading ? (
        <div className="text-sm text-slate-500 dark:text-slate-400 p-4">Loading stats...</div>
      ) : (
        <>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
            <StatGrid title="Total Monitors" bodyText={stats.total} icon={<HiDesktopComputer />} tone="sky" />
            <StatGrid title="Monitoring Enabled" bodyText={stats.monitoringEnabled} icon={<HiShieldCheck />} tone="emerald" />
            <StatGrid title="Alert Enabled" bodyText={stats.alertEnabled} icon={<HiBell />} tone="amber" />
            <StatGrid title="Currently Blacklisted" bodyText={stats.blacklisted} icon={<HiExclamationCircle />} tone="rose" />
          </div>

          {hostnames.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Check History</h3>
              <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
                {hostnames.slice(0, 4).map((h) => (
                  <HistoryChart key={h.id} hostnameId={h.id} hostname={h.hostname} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

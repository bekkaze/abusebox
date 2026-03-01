import React, { useEffect, useState } from "react";
import { HiBell, HiDesktopComputer, HiShieldCheck, HiExclamationCircle } from "react-icons/hi";
import StatGrid from "../../components/dashboard/home/StatGrid";
import HostnameService from "../../services/hostname";

export default function Home() {
  const hostnameService = HostnameService();
  const [stats, setStats] = useState({
    total: 0,
    monitoringEnabled: 0,
    alertEnabled: 0,
    blacklisted: 0,
  });

  useEffect(() => {
    const loadStats = async () => {
      try {
        const hostnames = await hostnameService.listHostname();
        setStats({
          total: hostnames.length,
          monitoringEnabled: hostnames.filter((item) => item.is_monitor_enabled).length,
          alertEnabled: hostnames.filter((item) => item.is_alert_enabled).length,
          blacklisted: hostnames.filter((item) => item.result?.is_blacklisted).length,
        });
      } catch (error) {
        console.error("Failed to load dashboard stats", error);
      }
    };

    loadStats();
  }, []);

  return (
    <section className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <p className="text-sm text-slate-500">Overview</p>
        <h2 className="text-2xl font-semibold text-slate-900 mt-1">Monitoring Summary</h2>
        <p className="text-slate-600 mt-2 text-sm">Track your monitored assets and prioritize blacklist incidents.</p>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <StatGrid title="Total Monitors" bodyText={stats.total} icon={<HiDesktopComputer />} tone="sky" />
        <StatGrid title="Monitoring Enabled" bodyText={stats.monitoringEnabled} icon={<HiShieldCheck />} tone="emerald" />
        <StatGrid title="Alert Enabled" bodyText={stats.alertEnabled} icon={<HiBell />} tone="amber" />
        <StatGrid title="Currently Blacklisted" bodyText={stats.blacklisted} icon={<HiExclamationCircle />} tone="rose" />
      </div>
    </section>
  )
}

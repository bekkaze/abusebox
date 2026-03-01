import React, { useEffect, useState } from "react";
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
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
      <StatGrid title="Total Monitors" bodyText={stats.total} />
      <StatGrid title="Monitoring Enabled" bodyText={stats.monitoringEnabled} />
      <StatGrid title="Alert Enabled" bodyText={stats.alertEnabled} />
      <StatGrid title="Currently Blacklisted" bodyText={stats.blacklisted} />
    </div>
  )
}

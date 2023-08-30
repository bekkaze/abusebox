import React from "react";
import DashboardStatsGrid from "./DashboardStatsGrid";
import DashboardChart from "./charts/DashboardChart";

export default function Dashboard() {
  

  return (
    <div className="flex gap-4">
      <DashboardStatsGrid/>
      <DashboardChart/>
    </div>
  )
}
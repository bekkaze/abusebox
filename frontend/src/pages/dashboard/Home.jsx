import React from "react";
import StatGrid from "../../components/dashboard/home/StatGrid";
import { IoBagHandle } from "react-icons/io5";

export default function Home() {
  return (
    <div className="flex gap-4">
      <StatGrid title="Hostnames" bodyText="10" />
      <StatGrid title="Hostnames" bodyText="10" />
      <StatGrid title="Hostnames" bodyText="10" />
      <StatGrid title="Hostnames" bodyText="10" />
    </div>
  )
}
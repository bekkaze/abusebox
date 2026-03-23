import React from "react";
import { IoBagHandle } from "react-icons/io5";

const StatGrid = ({ title, bodyText, icon = <IoBagHandle />, tone = "sky" }) => {
  const toneClass = {
    sky: "from-sky-500 to-blue-600",
    emerald: "from-emerald-500 to-teal-600",
    amber: "from-amber-500 to-orange-600",
    rose: "from-rose-500 to-red-600",
  }[tone] || "from-sky-500 to-blue-600";

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 flex items-center shadow-sm">
      <div className="flex items-center">
        <div className={`rounded-xl h-12 w-12 flex items-center justify-center bg-gradient-to-br ${toneClass}`}>
          <span className="text-2xl text-white">{icon}</span>
        </div>
        <div className="pl-4">
          <span className="text-sm text-slate-500 dark:text-slate-400">{title}</span>
          <div className="flex items-center">
            <strong className="text-2xl text-slate-900 dark:text-white font-semibold">{bodyText}</strong>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatGrid;

import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import ResultTable from '../../components/blacklist/ResultTable';

export default function ViewReport() {
  const location = useLocation();
  const hostnameData = location.state.hostnameData;

  return (
    <section className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
      <div className="rounded-xl border border-slate-200 p-4">
        {hostnameData ? (        
          <div className="inline-block min-w-full py-2">
            <h1 className="text-2xl font-semibold mb-4 text-slate-900">Report of {hostnameData.hostname}</h1>
            <ResultTable data={hostnameData.result}/>
        </div>
        ) : null}
      </div>
    </section>
  )
}

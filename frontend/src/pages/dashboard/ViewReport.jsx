import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import ResultTable from '../../components/blacklist/ResultTable';

export default function ViewReport() {
  const location = useLocation();
  const hostnameData = location.state.hostnameData;

  return (
    <div className="bg-white px-4 pt-3 pb-4 rounded-sm border border-gray-200 flex-1">
      <div className="border-x border-gray-200 rounded-sm mt-3">
        {hostnameData ? (        
          <div className="inline-block min-w-full py-2 sm:px-6 lg:px-8">
            <h1 className="text-2xl font-bold mb-4 text-center">Report of {hostnameData.hostname}</h1>
            <ResultTable data={hostnameData.result}/>
        </div>
        ) : null}
      </div>
    </div>
  )
}

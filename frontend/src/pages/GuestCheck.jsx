import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { checkBlacklist } from '../services/blacklist';
import ResultTable from '../components/blacklist/ResultTable';

const GuestCheck = () => {
  const location = useLocation();
  const hostname = location.state.hostname;
  const [data, setData] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await checkBlacklist(hostname);
        setData(result);
      } catch (error) {
        console.error('Failed to check blacklist:', error);
      }
    };

    fetchData();
  }, [hostname]);

  const LoadingSpinner = () => {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-indigo-900"></div>
      </div>
    );
  };

  if (!data) {
    return <LoadingSpinner />;
  }

  return (
    <div className="flex flex-col items-center justify-center bg-gray-200">
    <div className="overflow-x-auto sm:-mx-6 lg:-mx-8 bg-white w-1/2 mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-center">Report of {hostname}</h1>
      <div className="inline-block min-w-full py-2 sm:px-6 lg:px-8">
        <div className="overflow-hidden">
          <ResultTable data={data} />
        </div>
      </div>
    </div>
    </div>
  );
};

export default GuestCheck;

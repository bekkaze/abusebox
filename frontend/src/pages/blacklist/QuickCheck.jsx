import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { checkBlacklist } from '../../services/blacklist/checkService';
import ResultTableQuick from '../../components/blacklist/ResultTable';

const QuickCheck = () => {
  const location = useLocation();
  const hostname = location.state?.hostname;
  const [data, setData] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        if (hostname && isMounted) {
          const result = await checkBlacklist(hostname);
          setData(result);
        }
      } catch (error) {
        console.error('Failed to check blacklist:', error);
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
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
    <div className="bg-white px-4 pt-3 pb-4 rounded-sm border border-gray-200 flex-1">
      <div className="border-x border-gray-200 rounded-sm mt-3">
        <h1 className="text-2xl font-bold mb-4 text-center">Report of {hostname}</h1>
        <div className="inline-block min-w-full py-2 sm:px-6 lg:px-8">
          <div className="overflow-hidden">
            <ResultTableQuick data={data} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuickCheck;

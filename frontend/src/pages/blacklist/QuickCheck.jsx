import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { checkBlacklist } from '../../services/blacklist/checkService';
import ResultTableQuick from '../../components/blacklist/ResultTableQuick';

const QuickCheck = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const hostname = location.state?.hostname || searchParams.get('hostname');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        if (hostname && isMounted) {
          const result = await checkBlacklist(hostname);
          setData(result);
        } else if (isMounted) {
          setError('No hostname was provided. Go back and submit a hostname.');
        }
      } catch (error) {
        setError(error.message || 'Failed to check blacklist.');
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
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-900"></div>
      </div>
    );
  };

  if (!data && !error) {
    return <LoadingSpinner />;
  }

  return (
    <section className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="max-w-5xl mx-auto bg-white px-5 py-5 rounded-xl border border-slate-200 shadow-sm">
        <div className='flex items-center justify-between'>
          <div>
            <p className='text-sm text-slate-500'>Public Check</p>
            <h2 className='text-2xl font-semibold text-slate-900'>Blacklist Report</h2>
          </div>
          <button
            className='text-sm font-medium text-cyan-700 hover:text-cyan-800'
            onClick={() => navigate('/')}
          >
            Back to Home
          </button>
        </div>
        {error ? (
          <p className="text-red-600 text-center py-6">{error}</p>
        ) : (
          <>
            <h1 className="text-lg font-semibold mt-5 mb-4 text-slate-800">Target: <span className='text-cyan-700'>{hostname}</span></h1>
            <div className="overflow-hidden rounded-lg border border-slate-200">
                <ResultTableQuick data={data} />
            </div>
          </>
        )}
      </div>
    </section>
  );
};

export default QuickCheck;

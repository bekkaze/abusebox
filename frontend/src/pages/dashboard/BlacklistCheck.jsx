import React, { useState } from 'react';
import { checkBlacklist } from '../../services/blacklist/checkService';
import ResultTableQuick from '../../components/blacklist/ResultTableQuick';

export default function BlacklistCheck() {
  const [hostname, setHostname] = useState('');
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  const fetchData = async () => {
    try {
      if (hostname) {
        const result = await checkBlacklist(hostname);
        setData(result);
      }
    } catch (error) {
      console.log('Failed to check blacklist: ', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBlacklistCheck = async () => {
    setLoading(true);
    fetchData();
  };

  return (
    <>
      <div className='bg-white h-16 px-4 flex items-center border-b border-color-gray-200'>
        <div className="flex items-center w-full max-w-3xl mx-auto">
          <div className="flex-1 flex items-center">
            <div className="relative flex-1">
              <i className="fa fa-search text-gray-400 z-10 absolute left-3"></i>
              <input
                type="text"
                className="h-10 w-full pl-10 pr-12 rounded-l-lg focus:shadow focus:outline-none border border-color-slate-900"
                placeholder="IP address or domain name"
                value={hostname}
                onChange={(e) => setHostname(e.target.value)}
              />
            </div>
            <button 
              className={`h-10 px-4 rounded-r-lg ${loading ? 'bg-gray-400' : 'bg-red-500 hover:bg-red-600'} text-white`}
              onClick={handleBlacklistCheck}
              disabled={loading}
            >
              {loading ? 'Processing...' : 'Blacklist Check'}
            </button>
          </div>
        </div>
      </div>
      <div className="bg-white px-4 pt-3 pb-4 rounded-sm border border-gray-200 flex-1">
        <div className="border-x border-gray-200 rounded-sm mt-3">
          {data ? (        
            <div className="inline-block min-w-full py-2 sm:px-6 lg:px-8">
              <h1 className="text-2xl font-bold mb-4 text-center">Report of {hostname}</h1>
              <div className="overflow-hidden">
                <ResultTableQuick data={data} />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

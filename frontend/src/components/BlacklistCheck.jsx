import React, { useState } from 'react';

export default function BlacklistCheck() {
  const tableContainerStyle = {
    maxHeight: '80vh',
    border: '1px solid #e2e8f0',
    borderRadius: '4px',
    overflowY: 'auto',
  };

  const [hostname, setHostname] = useState('');
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleBlacklistCheck = async () => {
    try {
      setLoading(true); // Start loading
      const response = await fetch(`http://localhost:8000/api/blacklist/?target=${hostname}`);
      const data = await response.json();
      setResponse(data);
    } catch (error) {
      console.error('Error fetching data: ', error);
    } finally {
      setLoading(false); // Done loading, regardless of success or error
    }
  };

  const sortProviders = (providers, detected) => {
    const listedProviders = providers.filter(provider => detected[provider]);
    const notListedProviders = providers.filter(provider => !detected[provider]);
    return [...listedProviders, ...notListedProviders];
  };

  const [delistingProviders, setDelistingProviders] = useState([]);

  const handleDelist = async (provider) => {
    try {
      setDelistingProviders([...delistingProviders, provider]); // Mark the provider as delisting

      const response = await fetch('http://localhost:8000/api/blacklist/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ target: hostname, provider }),
      });

      const data = await response.json();
      setResponse(data);
    } catch (error) {
      console.error('Error delisting provider: ', error);
    } finally {
      setDelistingProviders(delistingProviders.filter(p => p !== provider)); // Clear delisting status
    }
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
      <div className="mt-4">
      {response && (
          <div style={tableContainerStyle} className="overflow-y-auto">
            <table className="table-auto w-full">
              <thead>
                <tr>
                  <th className="px-4 py-2">Provider</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {sortProviders(response.result.providers, response.result.detected).map((provider, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-gray-100' : ''}>
                    <td className="px-4 py-2">{provider}</td>
                    <td className="px-4 py-2">
                      {response.result.detected[provider] ? (
                        response.result.delist_requests[provider] &&
                        response.result.delist_requests[provider].status === 'sent' ? (
                          <span className="text-gray-600">Sent</span>
                        ) : (
                          <button
                            className={`h-8 px-3 rounded-md ${delistingProviders.includes(provider) ? 'bg-gray-400' : 'bg-red-500 hover:bg-red-600'} text-white`}
                            onClick={() => handleDelist(provider)}
                            disabled={loading || delistingProviders.includes(provider)}
                          >
                            {delistingProviders.includes(provider) ? (
                              <span className="text-gray-800">Processing...</span>
                            ) : (
                              'Delist'
                            )}
                          </button>
                        )
                      ) : (
                        <span className="text-green-600">Not listed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

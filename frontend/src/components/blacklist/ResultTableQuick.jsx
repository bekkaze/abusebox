import React from 'react';

const ResultTableQuick = ({ data }) => {
  const providers = [...data.providers].sort((a, b) => {
    const isBlacklistedA = data.detected_on.some((item) => item.provider === a);
    const isBlacklistedB = data.detected_on.some((item) => item.provider === b);

    return isBlacklistedB - isBlacklistedA;
  });

  const isBlacklisted = (provider) => {
    return data.detected_on.some((item) => item.provider === provider);
  };

  const handleDelist = (provider, hostname) => {
    setSelectedProvider(provider);
    setSelectedHostname(hostname);;
  }

  return (
    <div className="scrollable-table overflow-auto h-screen">
      <table className="w-full text-gray-700 border-collapse">
        <thead>
        <tr className="text-left border-b border-gray-300">
            <th className="px-4 py-2">Provider</th>
            <th className="px-4 py-2">Status</th>
        </tr>
        </thead>
        <tbody>
        {providers.map((provider, index) => (
        <tr key={index} className="border-b border-gray-300">
            <td className="px-4 py-2">{provider}</td>
            <td className={`px-4 py-2 ${isBlacklisted(provider) ? 'text-red-600 font-bold' : 'text-green-600'}`}>
              {isBlacklisted(provider) ? 'Blacklisted' : 'Clear'}
            </td>
        </tr>
        ))}
        </tbody>
      </table>
    </div>
  );
};

export default ResultTableQuick;

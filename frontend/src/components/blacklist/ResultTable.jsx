import React from 'react';

const ResultTable = ({ data }) => {
  const providers = [...data.providers].sort((a, b) => {
  const isBlacklistedA = data.detected_on.some((item) => item.provider === a);
  const isBlacklistedB = data.detected_on.some((item) => item.provider === b);

  return isBlacklistedB - isBlacklistedA;
  });

  const isBlacklisted = (provider) => {
  return data.detected_on.some((item) => item.provider === provider);
  };

  return (
  <table className="w-full min-w-max table-auto text-left">
  <thead>
    <tr>
      <th className="border-b border-blue-gray-100 bg-blue-gray-50 p-4">Provider</th>
      <th className="border-b border-blue-gray-100 bg-blue-gray-50 p-4">Status</th>
      <th className="border-b border-blue-gray-100 bg-blue-gray-50 p-4">Delist</th>
    </tr>
  </thead>
  <tbody>
    {providers.map((provider, index) => (
      <tr key={index}>
        <td className="p-2 border-b border-blue-gray-50">{provider}</td>
        <td className={`p-2 border-b border-blue-gray-50 ${isBlacklisted(provider) ? 'text-red-600 font-bold' : 'text-green-600'}`}>
          {isBlacklisted(provider) ? 'Blacklisted' : 'Clear'}
        </td>
        <td className="p-2 border-b border-blue-gray-50">
          {isBlacklisted(provider) && (
            <button className="bg-[#EF4444] hover:bg-[#ff7676] text-white font-bold py-0.5 px-4 rounded">
              Delist
            </button>
          )}
        </td>
      </tr>
    ))}
  </tbody>
  </table>
  );
};

export default ResultTable;

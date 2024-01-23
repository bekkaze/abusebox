import React from 'react';

const ResultTable = ({ data }) => {
  const tableContainerStyle = {
    maxHeight: '80vh',
    border: '1px solid #e2e8f0',
    borderRadius: '4px',
    overflowY: 'auto',
  };

  const providers = [...data.providers].sort((a, b) => {
  const isBlacklistedA = data.detected_on.some((item) => item.provider === a);
  const isBlacklistedB = data.detected_on.some((item) => item.provider === b);

  return isBlacklistedB - isBlacklistedA;
  });

  const isBlacklisted = (provider) => {
  return data.detected_on.some((item) => item.provider === provider);
  };

  return (
  <div style={tableContainerStyle} className="overflow-y-auto">
    <table className="table-auto w-full">
    <thead>
      <tr>
        <th className="px-4 py-2">Provider</th>
        <th className="px-4 py-2">Status</th>
        {/* <th className="px-4 py-2">Action</th> */}
      </tr>
    </thead>
    <tbody>
      {providers.map((provider, index) => (
        <tr key={index}>
          <td className="px-4 py-2">{provider}</td>
          <td className={`px-4 py-2 ${isBlacklisted(provider) ? 'text-red-600 font-bold' : 'text-green-600'}`}>
            {isBlacklisted(provider) ? 'Blacklisted' : 'Clear'}
          </td>
          {/* <td className="px-4 py-2">
          {isBlacklisted(provider) ? <button className="bg-[#EF4444] hover:bg-[#ff7676] text-white font-bold py-0.5 px-4 rounded">
              Delist
            </button> : ''}
          </td> */}
        </tr>
      ))}
    </tbody>
    </table>
  </div>
  );
};

export default ResultTable;

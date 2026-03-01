import React, { useState } from 'react';
import providerFields from './delist/constant';
import DelistModal from './delist/DelistModal';

const ResultTable = ({ data }) => {
  const providers = [...data.providers].sort((a, b) => {
    const isBlacklistedA = data.detected_on.some((item) => item.provider === a);
    const isBlacklistedB = data.detected_on.some((item) => item.provider === b);

    return isBlacklistedB - isBlacklistedA;
  });

  const isBlacklisted = (provider) => {
    return data.detected_on.some((item) => item.provider === provider);
  };

  const getProviderStatus = (provider) => {
    const detectedProvider = data.detected_on.find((item) => item.provider === provider);
    return detectedProvider ? detectedProvider.status : 'unknown';
  };

  const [selectedProvider, setSelectedProvider] = useState(null);
  const handleDelist = (provider) => {
    setSelectedProvider(provider);
    setIsModalOpen(true);
    const fields = providerFields[provider];
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const handleCloseModal = () => {
    setSelectedProvider(null);
    setIsModalOpen(false);
  };

  const modalFields = selectedProvider ? providerFields[selectedProvider] : [];

  return (
    <div className="scrollable-table overflow-auto max-h-[70vh] rounded-lg border border-slate-200">
      <table className="w-full text-slate-700 border-collapse">
        <thead className="sticky top-0 bg-slate-50">
          <tr className="text-left border-b border-slate-200">
            <th className="px-4 py-3 text-xs uppercase tracking-wide text-slate-500">Provider</th>
            <th className="px-4 py-3 text-xs uppercase tracking-wide text-slate-500">Status</th>
            <th className="px-4 py-3 text-xs uppercase tracking-wide text-slate-500">Action</th>
          </tr>
        </thead>
        <tbody>
          {providers.map((provider, index) => (
            <tr key={index} className="border-b border-slate-200 hover:bg-slate-50/60">
              <td className="px-4 py-2.5 font-medium">{provider}</td>
              <td className="px-4 py-2.5">
                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${isBlacklisted(provider) ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  {isBlacklisted(provider) ? 'Blacklisted' : 'Clear'}
                </span>
              </td>
              <td className="px-4 py-2.5">
                {isBlacklisted(provider) ? (
                  getProviderStatus(provider) === 'open' ? (
                    <button
                      className="bg-rose-600 hover:bg-rose-700 text-white font-semibold py-1 px-4 rounded-lg transition-colors"
                      onClick={() => handleDelist(provider)}
                    >
                      Delist
                    </button>
                  ) : (
                    <button className="text-gray-500 cursor-not-allowed py-0.5 px-4 rounded" disabled>
                      Delist request sent
                    </button>
                  )
                ) : (
                  ''
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <DelistModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        provider={selectedProvider}
        data={data}
        fields={modalFields}
      />
    </div>
  );
};

export default ResultTable;

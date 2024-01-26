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
    <div className="scrollable-table overflow-auto h-screen">
      <table className="w-full text-gray-700 border-collapse">
        <thead>
          <tr className="text-left border-b border-gray-300">
            <th className="px-4 py-2">Provider</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2">Action</th>
          </tr>
        </thead>
        <tbody>
          {providers.map((provider, index) => (
            <tr key={index} className="border-b border-gray-300">
              <td className="px-4 py-2">{provider}</td>
              <td className={`px-4 py-2 ${isBlacklisted(provider) ? 'text-red-600 font-bold' : 'text-green-600'}`}>
                {isBlacklisted(provider) ? 'Blacklisted' : 'Clear'}
              </td>
              <td className="px-4 py-2">
                {isBlacklisted(provider) ? (
                  getProviderStatus(provider) === 'open' ? (
                    <button
                      className="bg-[#EF4444] hover:bg-[#ff7676] text-white font-bold py-0.5 px-4 rounded"
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

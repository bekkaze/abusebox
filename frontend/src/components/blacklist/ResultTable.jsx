import { useState } from 'react';
import DelistModal from './delist/DelistModal';
import { ProviderRows } from './ResultTableQuick';
import { sortProviders } from './providerStatus';
import { linkClass } from '../shared/ui';

const ResultTable = ({ data, checkId, onDelistRecorded }) => {
  const [selectedProvider, setSelectedProvider] = useState(null);
  const providers = sortProviders(data);

  const action = (provider, status, entry) => {
    if (status === 'listed') {
      return (
        <button type="button" className={`text-sm ${linkClass}`} onClick={() => setSelectedProvider(provider)}>
          Request removal
        </button>
      );
    }
    if (status === 'requested' && entry?.requested_at) {
      return <span className="text-xs text-ink-2">since {new Date(entry.requested_at).toLocaleDateString()}</span>;
    }
    return null;
  };

  return (
    <>
      <ProviderRows data={data} providers={providers} action={action} />
      <DelistModal
        isOpen={Boolean(selectedProvider)}
        onClose={() => setSelectedProvider(null)}
        provider={selectedProvider}
        target={data?.hostname}
        checkId={checkId}
        onRecorded={onDelistRecorded}
      />
    </>
  );
};

export default ResultTable;

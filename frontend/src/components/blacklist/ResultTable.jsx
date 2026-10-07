import { useState } from 'react';
import DelistModal from './delist/DelistModal';
import ProviderStatusBadge from './ProviderStatusBadge';
import { providerStatus, sortProviders } from './providerStatus';

const ResultTable = ({ data, checkId, onDelistRecorded }) => {
  const [selectedProvider, setSelectedProvider] = useState(null);
  const providers = sortProviders(data);
  const detectedOn = data?.detected_on || [];

  return (
    <div className="overflow-auto max-h-[70vh] rounded-lg border border-slate-200 dark:border-slate-600">
      <table className="w-full text-sm text-slate-700 dark:text-slate-300 border-collapse">
        <thead className="sticky top-0 bg-slate-50 dark:bg-slate-700 z-[1]">
          <tr className="text-left border-b border-slate-200 dark:border-slate-600">
            <th scope="col" className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">Provider</th>
            <th scope="col" className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">Status</th>
            <th scope="col" className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400"><span className="sr-only">Action</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
          {providers.map((provider) => {
            const status = providerStatus(data, provider);
            const entry = detectedOn.find((item) => item.provider === provider);
            return (
              <tr key={provider} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/40">
                <td className="px-4 py-2.5 font-medium break-all">{provider}</td>
                <td className="px-4 py-2.5"><ProviderStatusBadge status={status} /></td>
                <td className="px-4 py-2.5 text-right">
                  {status === 'listed' && (
                    <button
                      type="button"
                      className="text-sm font-medium text-rose-700 dark:text-rose-300 hover:underline"
                      onClick={() => setSelectedProvider(provider)}
                    >
                      Request removal
                    </button>
                  )}
                  {status === 'requested' && entry?.requested_at && (
                    <span className="text-xs text-slate-500 dark:text-slate-400">since {new Date(entry.requested_at).toLocaleDateString()}</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <DelistModal
        isOpen={Boolean(selectedProvider)}
        onClose={() => setSelectedProvider(null)}
        provider={selectedProvider}
        target={data?.hostname}
        checkId={checkId}
        onRecorded={onDelistRecorded}
      />
    </div>
  );
};

export default ResultTable;
